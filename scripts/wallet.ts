import fs from "node:fs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { sui } from "../lib/sui/client";
export function localWallet() {
  const secret = process.env.SUI_PRIVATE_KEY || fs.readFileSync(".keys/sui-deployer.key", "utf8").trim();
  return Ed25519Keypair.fromSecretKey(secret);
}
export async function execute(transaction: Transaction, wallet = localWallet()) {
  transaction.setSenderIfNotSet(wallet.toSuiAddress());
  const retryNetwork = async <T>(fn: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      try { return await fn(); }
      catch (error) {
        if (attempt >= 3 || !/fetch failed|network|ECONN|timeout|temporar|unavailable|429|503/i.test(String(error))) throw error;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  };
  const bytes = await retryNetwork(() => Transaction.from(transaction).build({ client: sui }));
  const { signature } = await wallet.signTransaction(bytes);
  // Retry identical signed bytes, so uncertain network responses cannot duplicate an action.
  const result = await retryNetwork(() => sui.executeTransaction({ transaction: bytes, signatures: [signature], include: { effects: true, events: true, objectTypes: true } }));
  if (result.FailedTransaction) throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
  await retryNetwork(() => sui.waitForTransaction({ digest: result.Transaction.digest }));
  return result.Transaction;
}
