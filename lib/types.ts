/**
 * UI-facing domain types.
 *
 * Money here is in whole kUSD (floats) and prices are probabilities in [0, 1].
 * The on-chain program uses 6-decimal integers and leverage in basis points;
 * convert at the adapter boundary (lib/data.ts, lib/trade.ts), never in components.
 */

export const CATEGORIES = [
  "crypto",
  "macro",
  "sports",
  "esports",
  "politics",
  "world",
  "tech",
  "culture",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Side = "yes" | "no";

/** Mirrors program market states. */
export type MarketState = "open" | "closed" | "proposed" | "disputed" | "resolved";

export type Outcome = "yes" | "no" | "invalid";

export interface PricePoint {
  /** Unix seconds. */
  t: number;
  /** YES probability, 0..1. */
  p: number;
  /** Traded notional in the interval ending at t, kUSD. */
  v: number;
}

export interface ResolutionSource {
  name: string;
  url: string;
  /** Field or metric the oracle reads, e.g. "BTC/USD close". */
  field: string;
}

export type AgentRole = "creator" | "oracle" | "auditor" | "admin" | "crank";

export interface OracleEvent {
  t: number;
  kind: "created" | "closed" | "proposed" | "audited" | "challenged" | "finalized" | "ruled";
  actor: AgentRole;
  /** Agent display name, e.g. "Creator 01". */
  agent: string;
  note: string;
  /** sha256 of the sealed evidence bundle, hex. */
  evidenceHash?: string;
}

export interface Market {
  id: string;
  question: string;
  category: Category;
  /** One-line context shown under the question. */
  summary: string;
  openTime: number;
  closeTime: number;
  state: MarketState;
  outcome?: Outcome;
  /** Current YES probability, 0..1. */
  yesPrice: number;
  /** Change of YES price over 24h, in probability units (0.03 = +3 pts). */
  change24h: number;
  /** Lifetime traded notional, kUSD. */
  volume: number;
  /** Cash in the market pool (S), kUSD. Used by the pm-AMM estimate. */
  liquidity: number;
  traders: number;
  resolution: ResolutionSource;
  rules: string[];
  history: PricePoint[];
  oracleTrail: OracleEvent[];
}

export type ActivityKind = "open" | "close" | "liquidation";

export interface Activity {
  id: string;
  marketId: string;
  kind: ActivityKind;
  side: Side;
  leverage: number;
  /** Margin for opens, proceeds for closes and liquidations. kUSD. */
  amount: number;
  /** Side price at execution. */
  price: number;
  t: number;
  /** Shortened wallet or agent name. */
  trader: string;
}

export interface Position {
  marketId: string;
  side: Side;
  shares: number;
  margin: number;
  debt: number;
  accrued: number;
  /** Average side price paid. */
  entryPrice: number;
  leverage: number;
  openedAt: number;
}

export type SortKey = "trending" | "closing" | "newest" | "liquidity";
