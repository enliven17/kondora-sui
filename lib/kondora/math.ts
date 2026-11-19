// Integer arithmetic mirrors Move market.move. Quotes round against the trader.
export const BPS = 10_000;
export type Side = 0 | 1;
export interface PoolState {
  yes: bigint; no: bigint; feeBps: number; mmBps: number;
  vault?: bigint; liabilityYes?: bigint; liabilityNo?: bigint; debt?: bigint; seed?: bigint;
}
export const micro = (amount: number) => Math.floor(amount * 1e6 + 1e-7);
export const usdc = (amount: number | bigint) => Number(amount) / 1e6;
export const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;
export function sqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}
export const priceOf = (pool: PoolState, side: Side) => Number(side === 0 ? pool.no : pool.yes) / Number(pool.yes + pool.no);
export function buyShares(pool: PoolState, side: Side, cost: bigint): bigint {
  if (cost < 0n || pool.yes <= 0n || pool.no <= 0n) throw new Error("Invalid pool or amount");
  const k = pool.yes * pool.no;
  return side === 0 ? pool.yes + cost - ceilDiv(k, pool.no + cost) : pool.no + cost - ceilDiv(k, pool.yes + cost);
}
export function afterBuy(pool: PoolState, side: Side, cost: bigint, shares = buyShares(pool, side, cost)): PoolState {
  return { ...pool, yes: pool.yes + cost - (side === 0 ? shares : 0n), no: pool.no + cost - (side === 1 ? shares : 0n) };
}
export function sellValue(pool: PoolState, side: Side, shares: bigint): bigint {
  if (shares <= 0n) return 0n;
  const sum = pool.yes + pool.no + shares;
  const disc = sum * sum - 4n * (side === 0 ? pool.no : pool.yes) * shares;
  const root = sqrt(disc);
  return (sum - (root * root === disc ? root : root + 1n)) / 2n;
}
export const exitValue = (pool: PoolState, side: Side, shares: number) => Number(sellValue(pool, side, BigInt(Math.floor(shares))));
export function isLiquidatable(pool: PoolState, side: Side, shares: number, debt: number, accrued = 0): boolean {
  return debt > 0 && sellValue(pool, side, BigInt(Math.floor(shares))) * 9500n <= BigInt(Math.ceil(debt + accrued)) * 10000n;
}
export function liquidationPrice(pool: PoolState, side: Side, shares: number, debt: number): number | null {
  void side;
  if (debt <= 0 || shares <= 0) return null;
  return Math.min(1, debt / shares / (1 - pool.mmBps / BPS));
}
export function maxLeverageBps(max: number, tau: number, tau0: number, yesPrice: number, reduceOnly: number): number {
  if (tau <= reduceOnly) return BPS;
  const price = Math.floor(yesPrice * BPS);
  return Math.min(max, BPS + Math.floor((max - BPS) * Math.min(tau / tau0, 1)), BPS + 8 * Math.min(price, BPS - price));
}
export function quoteOpen(pool: PoolState, side: Side, margin: number, levBps: number) {
  if (!Number.isSafeInteger(margin) || margin <= 0 || margin > 200_000_000_000 || levBps < BPS || levBps > 50000) return null;
  const m = BigInt(margin), notional = m * BigInt(levBps) / 10000n;
  const fee = notional * BigInt(pool.feeBps) / 10000n;
  const cost = notional - fee, debt = notional - m;
  const shares = buyShares(pool, side, cost), after = afterBuy(pool, side, cost, shares);
  const liability = (pool.liabilityYes ?? 0n) + (pool.liabilityNo ?? 0n) + shares;
  const reserved = pool.vault === undefined || liability <= pool.vault + m;
  const borrowed = pool.seed === undefined || (pool.debt ?? 0n) + debt <= pool.seed / 2n;
  return {
    notional: Number(notional), fee: Number(fee), debt: Number(debt), shares: Number(shares), after,
    avgPrice: shares > 0n ? Number(cost) / Number(shares) : 0,
    priceAfter: priceOf(after, side), liquidationPrice: liquidationPrice(after, side, Number(shares), Number(debt)),
    maxPayout: Number(shares > debt ? shares - debt : 0n), reserved: reserved && borrowed,
  };
}
