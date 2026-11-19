"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { readAllMarkets } from "../lib/sui/read";
import type { SuiMarket } from "../lib/sui/schema";
import { tradeEvents } from "../lib/sui/events";
export function marketFields(m: SuiMarket) {
  let metadata: { spec?: object; sourceName?: string; sourceUrl?: string; key?: string; tags?: string[] } = {};
  try { metadata = JSON.parse(m.resolution); } catch { /* Preserve readable metadata. */ }
  const priceYes = Number(m.reserve_no) / (Number(m.reserve_yes) + Number(m.reserve_no));
  const status = m.state === 4 ? "resolved" : m.state === 3 ? "disputed" : m.state === 2 ? "proposed" : Number(m.close_ms) <= Date.now() ? "closed" : "open";
  return {
    key: metadata.key ?? m.id, chainId: m.id, status,
    question: m.question, summary: m.summary, category: m.category, rules: m.rules,
    resolution: metadata.spec ?? {}, sourceName: metadata.sourceName ?? "On-chain evidence", sourceUrl: metadata.sourceUrl ?? "https://sui.io",
    tags: metadata.tags ?? [], openTime: Number(m.open_ms) / 1000, closeTime: Number(m.close_ms) / 1000,
    initialPriceYes: priceYes, priceYes, volume: Number(m.volume) / 1e6, liquidity: Number(m.vault) / 1e6,
    trades: Number(m.trades), traders: 0, delegated: false, swept: false,
    ...(m.state === 4 ? { outcome: ["yes", "no", "invalid"][m.outcome] } : {}),
    ...(m.evidence_hash.length ? { evidenceHash: Buffer.from(m.evidence_hash).toString("hex") } : {}),
    ...(Number(m.proposed_ms) ? { proposedAt: Number(m.proposed_ms) / 1000 } : {}), updatedAt: Date.now(),
  };
}
export const run = internalAction({ args: {}, handler: async (ctx) => {
  if (process.env.KONDORA_BACKEND_OFF === "1") return { skipped: true };
  const markets = await readAllMarkets();
  for (const market of markets) await ctx.runMutation(internal.suiStore.upsertMarket, { fields: marketFields(market) });
  let cursor: string | null = await ctx.runQuery(internal.markets.getCursor, { name: "sui-trades-v1" });
  let trades = 0;
  for (let page = 0; page < 5; page++) {
    const batch = await tradeEvents(cursor);
    const rows = [];
    for (const e of batch.events) {
      if (e.kind === 3) continue; // Claims are settlement, not traded notional.
      const market = await ctx.runQuery(internal.markets.getByChain, { chainId: e.market_id });
      if (!market) throw new Error(`Missing indexed market ${e.market_id}`);
      rows.push({ marketId: market._id, chainId: e.market_id, owner: e.owner, side: e.side === 0 ? "yes" : "no",
        kind: ["open", "close", "liquidation"][e.kind], leverage: Number(e.leverage_bps) / 10000,
        amount: Number(e.margin) / 1e6, shares: Number(e.shares) / 1e6, priceYes: Number(e.price_bps) / 10000,
        t: Number(e.timestamp_ms) / 1000, sig: `${e.digest}:${e.sequence}`,
      });
    }
    trades += await ctx.runMutation(internal.markets.insertTradesAndCursor, { rows, cursorName: "sui-trades-v1", cursor: batch.endCursor ?? cursor ?? "" });
    cursor = batch.endCursor;
    if (!batch.hasNextPage) break;
  }
  await ctx.runMutation(internal.markets.agentRun, { agent: "Sui Indexer", role: "crank", ok: true, note: `${markets.length} shared markets synced` });
  return { markets: markets.length, trades };
} });
