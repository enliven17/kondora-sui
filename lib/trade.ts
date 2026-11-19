import type { Transaction } from "@mysten/sui/transactions";
import type { AccountSnapshot } from "./account";
import { amm, type PositionData } from "./kondora";
import type { LiveMarket } from "./live";
import { readAccount } from "./account";
import { sui } from "./sui/client";
import { CLOCK_ID, transactionUrl } from "./sui/config";
import { mintTransaction, newTransaction, setupTransaction, target } from "./sui/transactions";
import { friendlyError } from "./trade-errors";
import type { Side } from "./types";

export const SLIPPAGE_BPS = 100;
export interface TradeWallet { address: string; execute: (tx: Transaction) => Promise<string> }
export interface TxLink { signature: string; layer: "sui"; explorer: string }
export type TradeResult = { ok: true; tx: TxLink; steps: TxLink[]; shares?: number } | { ok: false; error: string; tx?: TxLink };
const link = (signature: string): TxLink => ({ signature, layer: "sui", explorer: transactionUrl(signature) });
async function send(wallet: TradeWallet, transaction: Transaction): Promise<TxLink> {
  const digest = await wallet.execute(transaction);
  const result = await sui.waitForTransaction({ digest });
  if (result.FailedTransaction) throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
  if (typeof window !== "undefined") window.dispatchEvent(new Event("kondora:refresh"));
  return link(digest);
}
const done = (steps: TxLink[], shares?: number): TradeResult => ({ ok: true, tx: steps[steps.length - 1], steps, shares });
const fail = (error: unknown): Extract<TradeResult, { ok: false }> => ({ ok: false, error: friendlyError(error) });
function units(amount: number): bigint {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(amm.micro(amount))) throw new Error("Enter a valid amount.");
  return BigInt(amm.micro(amount));
}
function assertWallet(wallet: TradeWallet, snap: AccountSnapshot) {
  if (wallet.address !== snap.owner) throw new Error("Wallet changed. Refresh your account.");
  if (snap.lamports < 3_000_000) throw new Error("Add testnet SUI for network fees.");
}
export async function mintTestCollateral(wallet: TradeWallet): Promise<TradeResult> {
  try { return done([await send(wallet, mintTransaction())]); } catch (e) { return fail(e); }
}
export interface EnableParams { wallet: TradeWallet; snap: AccountSnapshot; deposit: number }
export async function enableTrading({ wallet, snap, deposit }: EnableParams): Promise<TradeResult> {
  const steps: TxLink[] = [];
  try {
    assertWallet(wallet, snap);
    const amount = units(deposit);
    if (amount > snap.usdc) throw new Error("Above your wallet kUSD balance.");
    let id = snap.id;
    if (!id) {
      steps.push(await send(wallet, setupTransaction(wallet.address, null, 0n)));
      id = (await readAccount(wallet.address)).id;
      if (!id) throw new Error("Account created. Refresh and deposit to continue.");
    }
    if (amount > 0n) steps.push(await send(wallet, setupTransaction(wallet.address, id, amount)));
    if (!steps.length) throw new Error("Your account is already ready.");
    return done(steps);
  } catch (e) { return { ...fail(e), tx: steps.at(-1) }; }
}
export interface PlaceBetParams { wallet: TradeWallet; snap: AccountSnapshot; live: LiveMarket; side: Side; margin: number; leverage: number }
export async function placeBet({ wallet, snap, live, side, margin, leverage }: PlaceBetParams): Promise<TradeResult> {
  try {
    assertWallet(wallet, snap);
    if (!snap.id) throw new Error("Enable trading first.");
    const m = units(margin), lev = Math.round(leverage * amm.BPS);
    const q = amm.quoteOpen(live.pool, side === "yes" ? 0 : 1, Number(m), lev);
    if (!q || !q.reserved || q.shares <= 0) throw new Error("This amount exceeds the pool's reserve limit.");
    const tx = newTransaction();
    tx.moveCall({ target: target("open_position"), arguments: [tx.object(snap.id), tx.object(live.account.id),
      tx.pure.u8(side === "yes" ? 0 : 1), tx.pure.u64(m), tx.pure.u64(lev),
      tx.pure.u64(BigInt(q.shares) * 9900n / 10000n), tx.object(CLOCK_ID)] });
    return done([await send(wallet, tx)], amm.usdc(q.shares));
  } catch (e) { return fail(e); }
}
export function expectedCloseOut(live: LiveMarket, position: PositionData, fractionBps = amm.BPS, now = Date.now() / 1000) {
  const f = BigInt(fractionBps), shares = position.shares * f / 10000n;
  const cutoff = Math.min(now, Number(live.account.close_time));
  const interest = BigInt(Math.ceil(Number(position.debt) * 2 * Math.max(0, cutoff - Number(position.last_accrual)) / 10000 / 3600));
  const debt = amm.ceilDiv(position.debt * f, 10000n) + amm.ceilDiv((position.accrued + interest) * f, 10000n);
  return Number(amm.sellValue(live.pool, position.side as amm.Side, shares) - debt);
}
export interface ClosePositionParams { wallet: TradeWallet; snap: AccountSnapshot; live: LiveMarket; position: PositionData; fractionBps?: number }
export async function closePosition({ wallet, snap, live, position, fractionBps = amm.BPS }: ClosePositionParams): Promise<TradeResult> {
  try {
    assertWallet(wallet, snap);
    if (!snap.id || fractionBps <= 0 || fractionBps > 10000) throw new Error("Invalid close request.");
    const minOut = BigInt(Math.max(0, Math.floor(expectedCloseOut(live, position, fractionBps) * 0.99) - 10));
    const tx = newTransaction();
    tx.moveCall({ target: target("close_position"), arguments: [tx.object(snap.id), tx.object(position.market_id),
      tx.pure.u8(position.side), tx.pure.u64(fractionBps), tx.pure.u64(minOut), tx.object(CLOCK_ID)] });
    return done([await send(wallet, tx)]);
  } catch (e) { return fail(e); }
}
export async function claimPosition({ wallet, snap, marketId }: { wallet: TradeWallet; snap: AccountSnapshot; marketId: string }): Promise<TradeResult> {
  try {
    assertWallet(wallet, snap);
    if (!snap.id) throw new Error("Account not found.");
    const tx = newTransaction();
    tx.moveCall({ target: target("claim"), arguments: [tx.object(snap.id), tx.object(marketId), tx.object(CLOCK_ID)] });
    return done([await send(wallet, tx)]);
  } catch (e) { return fail(e); }
}
export interface WithdrawParams { wallet: TradeWallet; snap: AccountSnapshot; amount: number }
export async function withdraw({ wallet, snap, amount }: WithdrawParams): Promise<TradeResult> {
  try {
    assertWallet(wallet, snap);
    const value = units(amount);
    if (!snap.id || value <= 0n || value > (snap.user?.balance ?? 0n)) throw new Error("Enter an amount within your trading balance.");
    const tx = newTransaction();
    tx.moveCall({ target: target("withdraw"), arguments: [tx.object(snap.id), tx.pure.u64(value)] });
    return done([await send(wallet, tx)]);
  } catch (e) { return fail(e); }
}
