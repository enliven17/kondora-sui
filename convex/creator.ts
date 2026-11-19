"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { planMarkets } from "../agents/creator";
import { cryptoCandidates } from "../agents/sources/crypto";
import { readAllMarkets, readRegistry } from "../lib/sui/read";
import { createMarketTransaction, mintTransaction } from "../lib/sui/transactions";
import { roleKey, send } from "./sui";
export const run = internalAction({ args: {}, handler: async (ctx) => {
  const key = roleKey("CREATOR");
  if (!key || process.env.KONDORA_BACKEND_OFF === "1") return { skipped: true };
  if (!await ctx.runMutation(internal.markets.acquireLock, { name: "sui-creator", ttlMs: 180000 })) return { skipped: true };
  try {
    const registry = await readRegistry();
    if (registry.admin !== key.toSuiAddress()) throw new Error("Creator must be registry admin");
    const markets = await readAllMarkets();
    const open = markets.filter((m) => {
      if (m.state !== 0 || Number(m.close_ms) <= Date.now()) return false;
      try { return !JSON.parse(m.resolution).tags?.some((t: string) => ["smoke", "soak"].includes(t)); }
      catch { return true; }
    });
    const maxOpen = Math.min(24, Math.max(1, Math.floor(Number(process.env.SUI_MAX_OPEN_MARKETS) || 6)));
    const maxNew = Math.min(3, maxOpen - open.length, Math.max(1, Math.floor(Number(process.env.SUI_MAX_NEW_MARKETS) || 1)));
    if (maxNew <= 0) return { created: 0, skipped: "market budget", open: open.length, maxOpen };
    const existingKeys = markets.map((m) => { try { return JSON.parse(m.resolution).key ?? m.id; } catch { return m.id; } });
    const openByCategory: Record<string, number> = {};
    markets.filter((m) => m.state === 0 && Number(m.close_ms) > Date.now()).forEach((m) => { openByCategory[m.category] = (openByCategory[m.category] ?? 0) + 1; });
    // Price-only mode makes no LLM calls and avoids sharing the original project's model quota.
    const candidates = process.env.SUI_ENABLE_LLM === "1"
      ? await planMarkets({ existingKeys: new Set<string>(existingKeys), openByCategory, maxNew })
      : (await cryptoCandidates(60))
        .filter((c) => c.resolution.kind === "price" && ["SUI", "BTC", "ETH"].includes(c.resolution.symbol) && !existingKeys.includes(c.dedupeKey))
        .sort((a, b) => Number(b.resolution.kind === "price" && b.resolution.symbol === "SUI") - Number(a.resolution.kind === "price" && a.resolution.symbol === "SUI") || a.closeTime - b.closeTime)
        .slice(0, maxNew);
    let created = 0;
    for (const c of candidates) {
      const seedKusd = Math.max(100, Math.min(50000, Math.floor(Number(process.env.SUI_MARKET_SEED_KUSD) || 5000)));
      await send(mintTransaction(Math.ceil(seedKusd / 1000)), key);
      await send(createMarketTransaction({ question: c.question, summary: c.summary, category: c.category,
        rules: c.rules, closeMs: c.closeTime * 1000, initialPriceBps: Math.max(500, Math.min(9500, Math.round(c.priceYes * 10000))), seed: BigInt(seedKusd) * 1_000_000n,
        resolution: JSON.stringify({ spec: c.resolution, sourceName: c.sourceName, sourceUrl: c.sourceUrl, key: c.dedupeKey, tags: c.tags ?? [] }),
      }), key);
      created++;
    }
    await ctx.runMutation(internal.markets.agentRun, { agent: "Creator", role: "creator", ok: true, note: `${created} Move markets created` });
    await ctx.runAction(internal.indexer.run, {});
    return { created };
  } finally { await ctx.runMutation(internal.markets.releaseLock, { name: "sui-creator" }); }
} });
