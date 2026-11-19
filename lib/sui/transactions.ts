import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { CLOCK_ID, COIN_TYPE, FAUCET_ID, PACKAGE_ID, REGISTRY_ID, requireDeployment } from "./config";
export const target = (name: string) => `${PACKAGE_ID}::market::${name}` as `${string}::${string}::${string}`;
export const newTransaction = () => { requireDeployment(); return new Transaction(); };
export function mintTransaction(count = 1) {
  if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error("Mint count must be 1..50");
  const tx = newTransaction();
  for (let i = 0; i < count; i++) tx.moveCall({ target: `${PACKAGE_ID}::kusd::mint`, arguments: [tx.object(FAUCET_ID)] });
  return tx;
}
export function setupTransaction(owner: string, accountId: string | null, deposit: bigint) {
  const tx = newTransaction();
  if (!accountId) {
    tx.moveCall({ target: target("create_account"), arguments: [tx.object(REGISTRY_ID)] });
    // A newly shared object becomes usable in the next transaction.
    return tx;
  }
  if (deposit <= 0n) throw new Error("Enter a deposit above zero.");
  tx.setSender(owner);
  tx.moveCall({ target: target("deposit"), arguments: [tx.object(accountId), coinWithBalance({ type: COIN_TYPE, balance: deposit })] });
  return tx;
}
export function createMarketTransaction(input: {
  question: string; summary: string; category: string; resolution: string; rules: string[];
  closeMs: number; initialPriceBps: number; seed: bigint;
}) {
  const tx = newTransaction();
  tx.moveCall({ target: target("create_market"), arguments: [
    tx.object(REGISTRY_ID), tx.pure.string(input.question), tx.pure.string(input.summary), tx.pure.string(input.category),
    tx.pure.string(input.resolution), tx.pure(bcs.vector(bcs.string()).serialize(input.rules)),
    tx.pure.u64(input.closeMs), tx.pure.u64(input.initialPriceBps),
    coinWithBalance({ type: COIN_TYPE, balance: input.seed }), tx.object(CLOCK_ID),
  ] });
  return tx;
}
export function resolutionTransaction(action: "propose" | "challenge" | "rule" | "finalize" | "timeout", marketId: string, outcome = 2, hash: number[] = [], uri = "") {
  const tx = newTransaction();
  const args = [];
  if (action === "propose" || action === "rule") args.push(tx.object(REGISTRY_ID));
  args.push(tx.object(marketId));
  if (action === "propose" || action === "rule") args.push(tx.pure.u8(outcome));
  if (["propose", "challenge", "rule"].includes(action)) args.push(tx.pure.vector("u8", hash), tx.pure.string(uri));
  args.push(tx.object(CLOCK_ID));
  tx.moveCall({ target: target(action), arguments: args });
  return tx;
}
