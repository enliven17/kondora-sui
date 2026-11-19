"use node";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { Transaction } from "@mysten/sui/transactions";
import { sui } from "../lib/sui/client";
export function roleKey(role: "CREATOR" | "ORACLE" | "AUDITOR" | "CRANK" | "FAUCET") {
  const secret = process.env[`SUI_${role}_SECRET`];
  return secret ? Ed25519Keypair.fromSecretKey(secret) : null;
}
export async function send(transaction: Transaction, signer: Ed25519Keypair) {
  const result = await sui.signAndExecuteTransaction({ signer, transaction, include: { events: true, effects: true } });
  if (result.FailedTransaction) throw new Error(result.FailedTransaction.status.error?.message ?? "Sui transaction failed");
  await sui.waitForTransaction({ digest: result.Transaction.digest });
  return result.Transaction;
}
