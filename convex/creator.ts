"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { planMarkets } from "../agents/creator";
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
    const existingKeys = markets.map((m) => { try { return JSON.parse(m.resolution).key ?? m.id; } catch { return m.id; } });
    const openByCategory: Record<string, number> = {};
    markets.filter((m) => m.state === 0 && Number(m.close_ms) > Date.now()).forEach((m) => { openByCategory[m.category] = (openByCategory[m.category] ?? 0) + 1; });
    const candidates = await planMarkets({ existingKeys: new Set<string>(existingKeys), openByCategory, maxNew: 3 });
    let created = 0;
    for (const c of candidates) {
      await send(mintTransaction(), key);
      await send(createMarketTransaction({ question: c.question, summary: c.summary, category: c.category,
        rules: c.rules, closeMs: c.closeTime * 1000, initialPriceBps: Math.max(500, Math.min(9500, Math.round(c.priceYes * 10000))), seed: 500_000_000n,
        resolution: JSON.stringify({ spec: c.resolution, sourceName: c.sourceName, sourceUrl: c.sourceUrl, key: c.dedupeKey, tags: c.tags ?? [] }),
      }), key);
      created++;
    }
    await ctx.runMutation(internal.markets.agentRun, { agent: "Creator", role: "creator", ok: true, note: `${created} Move markets created` });
    await ctx.runAction(internal.indexer.run, {});
    return { created };
  } finally { await ctx.runMutation(internal.markets.releaseLock, { name: "sui-creator" }); }
} });
