import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { execute, localWallet, oracleWallet } from "./wallet";
import { readAccount } from "../lib/account";
import { poolOf } from "../lib/chain";
import { amm } from "../lib/kondora";
import { sui } from "../lib/sui/client";
import { CLOCK_ID } from "../lib/sui/config";
import { readAllMarkets, readSuiMarket, toMarketAccount } from "../lib/sui/read";
import { createMarketTransaction, mintTransaction, newTransaction, resolutionTransaction, setupTransaction, target } from "../lib/sui/transactions";

const key = localWallet(), owner = key.toSuiAddress();
if (process.argv.includes("--resume")) { await (await import("./smoke-settlement")).resumeSettlement(); process.exit(0); }
const receipts: { action: string; digest: string }[] = [];
async function send(action: string, tx: Parameters<typeof execute>[0]) {
  const result = await execute(tx, action === "propose" ? oracleWallet() : key);
  receipts.push({ action, digest: result.digest });
  console.log(`${action}: ${result.digest}`);
  return result;
}
await send("mint", mintTransaction());
let snap = await readAccount(owner);
if (!snap.id) { await send("create-account", setupTransaction(owner, null, 0n)); snap = await readAccount(owner); }
assert(snap.id);
await send("deposit", setupTransaction(owner, snap.id, 100_000_000n));
const settlement = process.argv.includes("--settlement");
const closeMs = Date.now() + (settlement ? 90000 : 2 * 86400000);
await send("create-market", createMarketTransaction({ question: "Will the Kondora Sui integration smoke test complete?",
  summary: "A public testnet lifecycle check. Outcome is demonstrated by the recorded transaction receipts.", category: "tech",
  resolution: JSON.stringify({ key: `smoke-${Date.now()}`, sourceName: "Kondora integration test", sourceUrl: "https://github.com/enliven17/kondora-sui", tags: ["smoke"], spec: { kind: "council", criteria: "Integration receipts demonstrate mint, deposit, bet, close and withdraw.", sources: ["https://github.com/enliven17/kondora-sui"] } }),
  rules: ["Testnet demonstration market; outcome YES requires a recorded successful integration flow."], closeMs, initialPriceBps: 5000, seed: 500_000_000n,
}));
const market = (await readAllMarkets()).at(-1)!;
const pool = poolOf(toMarketAccount(market));
const q = amm.quoteOpen(pool, 0, 2_000_000, 10000)!;
let tx = newTransaction();
tx.moveCall({ target: target("open_position"), arguments: [tx.object(snap.id), tx.object(market.id), tx.pure.u8(0), tx.pure.u64(2_000_000), tx.pure.u64(10000), tx.pure.u64(BigInt(q.shares) * 9900n / 10000n), tx.object(CLOCK_ID)] });
await send("open-yes", tx);
snap = await readAccount(owner);
assert.equal(snap.user!.positions.filter((p) => p.market_id === market.id).length, 1);
const stranger = Ed25519Keypair.generate().toSuiAddress();
tx = newTransaction(); tx.setSender(stranger);
tx.moveCall({ target: target("withdraw"), arguments: [tx.object(snap.id!), tx.pure.u64(1)] });
const unauthorized = await sui.simulateTransaction({ transaction: tx });
assert(unauthorized.FailedTransaction, "A stranger must not withdraw from a shared account");
console.log("Unauthorized withdrawal rejected");
tx = newTransaction();
tx.moveCall({ target: target("close_position"), arguments: [tx.object(snap.id!), tx.object(market.id), tx.pure.u8(0), tx.pure.u64(5000), tx.pure.u64(1), tx.object(CLOCK_ID)] });
await send("partial-close", tx);
tx = newTransaction();
tx.moveCall({ target: target("withdraw"), arguments: [tx.object(snap.id!), tx.pure.u64(1_000_000)] });
await send("withdraw", tx);
if (settlement) {
  const waitUntil = async (time: number) => {
    while (Date.now() < time) { console.log(`Settlement wait: ${Math.ceil((time - Date.now()) / 1000)}s`); await new Promise((r) => setTimeout(r, Math.min(20000, time - Date.now()))); }
  };
  await waitUntil(closeMs + 2000);
  const bundle = { marketId: market.id, outcome: "yes", receipts: [...receipts] };
  fs.mkdirSync("evidence", { recursive: true });
  fs.writeFileSync("evidence/smoke.json", JSON.stringify(bundle));
  const hash = createHash("sha256").update(JSON.stringify(bundle)).digest();
  await send("propose", resolutionTransaction("propose", market.id, 0, [...hash], "https://raw.githubusercontent.com/enliven17/kondora-sui/main/evidence/smoke.json"));
  const proposal = await readSuiMarket(market.id);
  await waitUntil(Number(proposal.proposed_ms) + 302000);
  await send("finalize", resolutionTransaction("finalize", market.id));
  tx = newTransaction();
  tx.moveCall({ target: target("claim"), arguments: [tx.object(snap.id!), tx.object(market.id), tx.object(CLOCK_ID)] });
  await send("claim", tx);
} else {
  tx = newTransaction();
  tx.moveCall({ target: target("close_position"), arguments: [tx.object(snap.id!), tx.object(market.id), tx.pure.u8(0), tx.pure.u64(10000), tx.pure.u64(1), tx.object(CLOCK_ID)] });
  await send("close-remainder", tx);
}
const end = await readAccount(owner), onchain = await readSuiMarket(market.id);
assert(!end.user!.positions.some((p) => p.market_id === market.id));
assert(BigInt(onchain.vault) >= BigInt(onchain.liability_yes) + BigInt(onchain.liability_no));
fs.writeFileSync("deployments/smoke-testnet.json", JSON.stringify({ network: "testnet", completedAt: new Date().toISOString(), marketId: market.id, unauthorizedWithdrawalRejected: true, reservesVerified: true, settlement, receipts }, null, 2) + "\n");
console.log("Sui smoke passed");
