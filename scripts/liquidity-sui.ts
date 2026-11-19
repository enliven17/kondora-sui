import fs from "node:fs";
import assert from "node:assert/strict";
import { coinWithBalance } from "@mysten/sui/transactions";
import { CLOCK_ID, COIN_TYPE, REGISTRY_ID } from "../lib/sui/config";
import { sui } from "../lib/sui/client";
import { readAllMarkets, readRegistry, readSuiMarket } from "../lib/sui/read";
import { newTransaction, mintTransaction } from "../lib/sui/transactions";
import { localWallet, execute } from "./wallet";
import upgrade from "../deployments/upgrade-testnet.json";

const key = localWallet();
assert.equal((await readRegistry()).admin, key.toSuiAddress(), "Only registry admin may add house liquidity");
const soakIndex = process.argv.indexOf("--soak-dir");
const soakDir = soakIndex < 0 ? null : process.argv[soakIndex + 1];
if (soakIndex >= 0 && (!soakDir || soakDir.startsWith("--"))) throw new Error("--soak-dir needs the prepared run directory");
const soakId: string | null = soakDir ? JSON.parse(fs.readFileSync(`${soakDir}/summary.json`, "utf8")).marketId : null;
const markets = await readAllMarkets();
const plans = markets.flatMap(m => {
  if (m.state !== 0 || Number(m.close_ms) <= Date.now()) return [];
  let tags: string[] = [];
  try { tags = JSON.parse(m.resolution).tags ?? []; } catch { /* unknown markets still use public target */ }
  if (tags.some(t => ["soak", "smoke"].includes(t)) && m.id !== soakId) return [];
  const target = m.id === soakId ? 10_000_000_000n : 5_000_000_000n;
  return BigInt(m.seed) < target ? [{ marketId: m.id, question: m.question, before: m.seed, target, amount: target - BigInt(m.seed) }] : [];
});
const needed = plans.reduce((sum, p) => sum + p.amount, 0n);
let collateral = BigInt((await sui.getBalance({ owner: key.toSuiAddress(), coinType: COIN_TYPE })).balance.balance);
while (collateral < needed) {
  const count = Number((needed - collateral + 999_999_999n) / 1_000_000_000n);
  const result = await execute(mintTransaction(Math.min(50, count)), key);
  console.log(`Minted test collateral: ${result.digest}`);
  collateral = BigInt((await sui.getBalance({ owner: key.toSuiAddress(), coinType: COIN_TYPE })).balance.balance);
}
const file = "deployments/liquidity-testnet.json";
const receipt = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { network: "sui:testnet", entries: [] };
for (const p of plans) {
  const before = await readSuiMarket(p.marketId);
  const amount = p.target - BigInt(before.seed);
  if (amount <= 0n) continue;
  const tx = newTransaction();
  tx.moveCall({ target: `${upgrade.packageId}::market::add_liquidity`, arguments: [tx.object(REGISTRY_ID), tx.object(p.marketId), coinWithBalance({ type: COIN_TYPE, balance: amount }), tx.object(CLOCK_ID)] });
  const result = await execute(tx, key);
  const after = await readSuiMarket(p.marketId);
  assert.equal(BigInt(after.seed), p.target);
  assert(BigInt(after.vault) >= BigInt(after.liability_yes) + BigInt(after.liability_no));
  receipt.entries.push({ marketId: p.marketId, question: p.question, beforeSeed: before.seed, added: String(amount), seed: after.seed, vault: after.vault, digest: result.digest, at: new Date().toISOString() });
  fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + "\n");
  console.log(`${p.question}: seed=${Number(after.seed) / 1e6} kUSD ${result.digest}`);
}
console.log(`Liquidity complete: ${plans.length} markets; no new markets created.`);
