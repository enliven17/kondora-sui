import {
  BPS,
  exitValue,
  liquidationPrice as programLiquidationPrice,
  isLiquidatable,
  maxLeverageBps,
  micro,
  type PoolState,
  priceOf,
  quoteOpen,
  usdc,
  type Side as ProgramSide,
} from "./kondora/math";
import type { Market, Position, Side } from "./types";

/**
 * UI adapter over lib/kondora/math.ts, the TypeScript mirror of the on-chain engine.
 * Components pass whole kUSD and probabilities; conversion to micro kUSD, basis points
 * and the pool's z/L state happens here and nowhere else.
 */

/** Protocol defaults from PLAN.md section 4. */
export const PROTOCOL = {
  feeBps: 50,
  mmBps: 500,
  maxLevBps: 50_000,
  feeRate: 0.005,
  maintenanceMargin: 0.05,
  maxLeverage: 5,
  tau0: 86_400,
  reduceOnlySecs: 3_600,
  haltSecs: 600,
  borrowRatePerHour: 0.0002,
  maxSidePrice: 0.99,
} as const;

const toProgramSide = (side: Side): ProgramSide => (side === "yes" ? 0 : 1);

export function sidePrice(market: Pick<Market, "yesPrice">, side: Side) {
  return side === "yes" ? market.yesPrice : 1 - market.yesPrice;
}

/**
 * Pool state for a market. z comes from the YES price; L is chosen so the pool's
 * value at z matches the cash on hand (S = L * g(|z|)), in micro kUSD.
 */
export function poolFor(market: Pick<Market, "yesPrice" | "liquidity">): PoolState {
  const cash = BigInt(Math.max(micro(market.liquidity), 1000000));
  const price = BigInt(Math.min(9999, Math.max(1, Math.floor(market.yesPrice * BPS))));
  return { yes: cash * (10000n - price) / 10000n, no: cash * price / 10000n, feeBps: PROTOCOL.feeBps, mmBps: PROTOCOL.mmBps };
}

export type CapReason = "max" | "time" | "price" | "reduce-only";

/** Risk parameters that drive the leverage cap. Defaults to PROTOCOL; pass the market's on-chain params when known. */
export interface CapParams {
  maxLevBps: number;
  tau0: number;
  reduceOnlySecs: number;
}

const DEFAULT_CAP: CapParams = { maxLevBps: PROTOCOL.maxLevBps, tau0: PROTOCOL.tau0, reduceOnlySecs: PROTOCOL.reduceOnlySecs };

/** Live leverage cap from the program's maxLeverageBps, floored to 0.1x. */
export function leverageCap(
  yesPrice: number,
  closeTime: number,
  now = Date.now() / 1000,
  params: CapParams = DEFAULT_CAP,
): { cap: number; reason: CapReason } {
  const tau = closeTime - now;
  if (tau <= params.reduceOnlySecs) return { cap: 1, reason: "reduce-only" };
  const bps = maxLeverageBps(params.maxLevBps, tau, params.tau0, yesPrice, params.reduceOnlySecs);
  const cap = Math.max(1, Math.floor((bps / BPS) * 10) / 10);
  const maxLev = params.maxLevBps / BPS;
  if (cap >= maxLev) return { cap: maxLev, reason: "max" };
  const byTime = 1 + (maxLev - 1) * Math.min(tau / params.tau0, 1);
  const byPrice = 1 + 8 * Math.min(yesPrice, 1 - yesPrice);
  return { cap, reason: byTime <= byPrice ? "time" : "price" };
}

export interface BetQuote {
  margin: number;
  leverage: number;
  notional: number;
  fee: number;
  debt: number;
  shares: number;
  avgPrice: number;
  priceAfter: number;
  /** Side price at which the position is liquidated, null at 1x. */
  liqPrice: number | null;
  /** kUSD paid out if the side wins, after repaying debt. */
  payoutIfWin: number;
  profitIfWin: number;
  /** The pool cannot fill this size (curve limit or price above 99¢). */
  priceLimitHit: boolean;
  /** The program would reject this leveraged size: liquidatable right away or at floor liquidity. */
  unhealthy: boolean;
}

type QuoteArgs = [Pick<Market, "yesPrice" | "liquidity">, Side, PoolState | undefined, number | undefined, number | undefined];

/** True when the program would accept this size: fills, stays under the price cap, healthy at spot and floor. */
function fillable([market, side, pool, maxSide, floorL]: QuoteArgs, margin: number, leverage: number): boolean {
  const q = quoteBet(market, side, margin, leverage, pool, maxSide, floorL);
  return q.shares > 0 && !q.priceLimitHit && !q.unhealthy;
}

/**
 * Highest leverage (0.1 steps, up to `cap`) the pool can fill for this margin.
 * Returns 0 when even 1x does not fit, so the UI can ask for a smaller amount.
 */
export function maxFeasibleLeverage(args: QuoteArgs, margin: number, cap: number): number {
  if (!(margin > 0)) return cap;
  if (!fillable(args, margin, 1)) return 0;
  let lo = 10;
  let hi = Math.floor(cap * 10 + 1e-9);
  if (fillable(args, margin, hi / 10)) return hi / 10;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (fillable(args, margin, mid / 10)) lo = mid;
    else hi = mid;
  }
  return lo / 10;
}

/** Largest margin (cents precision) that fills at this leverage, searched up to `upper`. */
export function maxFeasibleMargin(args: QuoteArgs, leverage: number, upper: number): number {
  let lo = 0;
  let hi = Math.max(0, Math.floor(upper * 100));
  if (hi > 0 && fillable(args, hi / 100, leverage)) return hi / 100;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (fillable(args, mid / 100, leverage)) lo = mid;
    else hi = mid;
  }
  return lo / 100;
}

/** Quote a bet. Pass the live on-chain pool when available; otherwise the pool is estimated from the market's price and cash. */
export function quoteBet(
  market: Pick<Market, "yesPrice" | "liquidity">,
  side: Side,
  margin: number,
  leverage: number,
  pool: PoolState = poolFor(market),
  maxSidePrice: number = PROTOCOL.maxSidePrice,
  floorL?: number,
): BetQuote {
  void floorL;
  const m = Math.max(0, margin);
  const price = sidePrice(market, side);
  const empty: BetQuote = {
    margin: m,
    leverage,
    notional: m * leverage,
    fee: 0,
    debt: m * (leverage - 1),
    shares: 0,
    avgPrice: price,
    priceAfter: price,
    liqPrice: null,
    payoutIfWin: 0,
    profitIfWin: 0,
    priceLimitHit: false,
    unhealthy: false,
  };
  if (m <= 0) return empty;
  const q = quoteOpen(pool, toProgramSide(side), micro(m), Math.round(leverage * BPS));
  if (!q) return { ...empty, priceLimitHit: true };
  const payoutIfWin = Math.max(0, usdc(q.maxPayout));
  // Same checks as engine::open: healthy at spot after the trade, and at floor liquidity.
  const ps = toProgramSide(side);
  const after = q.after;
  const unhealthy =
    q.debt > 0 &&
    isLiquidatable(after, ps, q.shares, q.debt);
  return {
    margin: m,
    leverage,
    notional: usdc(q.notional),
    fee: usdc(q.fee),
    debt: usdc(q.debt),
    shares: usdc(q.shares),
    avgPrice: q.avgPrice,
    priceAfter: q.priceAfter,
    liqPrice: q.liquidationPrice,
    payoutIfWin,
    profitIfWin: payoutIfWin - m,
    priceLimitHit: q.priceAfter > maxSidePrice || !q.reserved,
    unhealthy,
  };
}

/** Average fill and price after for a plain 1x buy of `size` kUSD. Used by the price impact chart. */
export function priceImpact(market: Pick<Market, "yesPrice" | "liquidity">, side: Side, size: number) {
  const pool = poolFor(market);
  const q = quoteOpen(pool, toProgramSide(side), micro(size), BPS);
  return q && q.shares > 0 ? { avg: q.avgPrice, after: q.priceAfter } : null;
}

export interface PositionView {
  /** Current side price. */
  mark: number;
  /** Exit value: AMM sell proceeds minus fee. */
  value: number;
  equity: number;
  pnl: number;
  pnlPct: number;
  /** 0 at liquidation, 1 with no debt. */
  health: number;
  /** Side price at which the position is liquidated, null without debt. */
  liqPrice: number | null;
}

export function valuePosition(position: Position, market: Pick<Market, "yesPrice" | "liquidity">, pool: PoolState = poolFor(market)): PositionView {
  const side = toProgramSide(position.side);
  const mark = priceOf(pool, side);
  const value = usdc(exitValue(pool, side, micro(position.shares)));
  const equity = value - position.debt - position.accrued;
  const pnl = equity - position.margin;
  const liqPrice = programLiquidationPrice(pool, side, micro(position.shares), micro(position.debt + position.accrued));
  // Health is the share of the way from the liquidation price up to the current mark, against the entry.
  let health = 1;
  if (liqPrice !== null) {
    const span = Math.max(position.entryPrice - liqPrice, 1e-6);
    health = Math.min(1, Math.max(0, (mark - liqPrice) / span));
  }
  return {
    mark,
    value,
    equity,
    pnl,
    pnlPct: position.margin > 0 ? pnl / position.margin : 0,
    health,
    liqPrice,
  };
}
