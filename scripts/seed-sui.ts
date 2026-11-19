import { cryptoCandidates } from "../agents/sources/crypto";
import { execute } from "./wallet";
import { readAllMarkets } from "../lib/sui/read";
import { createMarketTransaction, mintTransaction } from "../lib/sui/transactions";
const existing = await readAllMarkets();
const keys = new Set(existing.map((m) => { try { return JSON.parse(m.resolution).key; } catch { return m.id; } }));
const candidates = (await cryptoCandidates(8)).filter((c) => !keys.has(c.dedupeKey)).slice(0, 8);
for (const c of candidates) {
  await execute(mintTransaction());
  const result = await execute(createMarketTransaction({ question: c.question, summary: c.summary, category: c.category, rules: c.rules,
    resolution: JSON.stringify({ spec: c.resolution, sourceName: c.sourceName, sourceUrl: c.sourceUrl, key: c.dedupeKey, tags: c.tags ?? [] }),
    closeMs: c.closeTime * 1000, initialPriceBps: Math.max(500, Math.min(9500, Math.round(c.priceYes * 10000))), seed: 500_000_000n,
  }));
  console.log(`${c.question} ${result.digest}`);
}
console.log(`Seeded ${candidates.length} testnet markets`);
