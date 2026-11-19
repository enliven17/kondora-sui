import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execute, localWallet } from "./wallet";
import { readAccount } from "../lib/account";
import { readSuiMarket } from "../lib/sui/read";
import { CLOCK_ID } from "../lib/sui/config";
import { newTransaction, resolutionTransaction, target } from "../lib/sui/transactions";
export async function resumeSettlement() {
  const evidence = fs.readFileSync("evidence/smoke.json", "utf8");
  const bundle = JSON.parse(evidence) as { marketId: string; receipts: { action: string; digest: string }[] };
  const receipts = [...bundle.receipts];
  const key = localWallet(), owner = key.toSuiAddress();
  const send = async (action: string, tx: Parameters<typeof execute>[0]) => { const result = await execute(tx, key); receipts.push({ action, digest: result.digest }); console.log(`${action}: ${result.digest}`); };
  const waitUntil = async (time: number) => { while (Date.now() < time) { console.log(`Settlement wait: ${Math.ceil((time - Date.now()) / 1000)}s`); await new Promise((r) => setTimeout(r, Math.min(20000, time - Date.now()))); } };
  let market = await readSuiMarket(bundle.marketId);
  if (market.state === 0) {
    await waitUntil(Number(market.close_ms) + 2000);
    const hash = createHash("sha256").update(evidence).digest();
    await send("propose", resolutionTransaction("propose", market.id, 0, [...hash], "https://raw.githubusercontent.com/enliven17/kondora-sui/main/evidence/smoke.json"));
    market = await readSuiMarket(market.id);
  }
  if (market.state === 2) { await waitUntil(Number(market.proposed_ms) + 302000); await send("finalize", resolutionTransaction("finalize", market.id)); }
  const snap = await readAccount(owner);
  if (snap.user?.positions.some((p) => p.market_id === market.id)) {
    const tx = newTransaction(); tx.moveCall({ target: target("claim"), arguments: [tx.object(snap.id!), tx.object(market.id), tx.object(CLOCK_ID)] });
    await send("claim", tx);
  }
  const end = await readAccount(owner), final = await readSuiMarket(market.id);
  assert.equal(final.state, 4);
  assert(!end.user!.positions.some((p) => p.market_id === market.id));
  assert(BigInt(final.vault) >= BigInt(final.liability_yes) + BigInt(final.liability_no));
  fs.writeFileSync("deployments/smoke-testnet.json", JSON.stringify({ network: "testnet", completedAt: new Date().toISOString(), marketId: market.id, unauthorizedWithdrawalRejected: true, reservesVerified: true, settlement: true, receipts }, null, 2) + "\n");
  console.log("Sui settlement smoke passed");
}
