// Pure view helpers and types shared by server pages and client components.

import type { Activity, Category, Market, Side } from "./types";

export interface HistoryItem {
  id: string;
  marketId: string;
  question: string;
  category: Category;
  side: Side;
  kind: "close" | "liquidation" | "claim";
  leverage: number;
  /** Realized PnL, kUSD. Null when only the proceeds are known. */
  pnl: number | null;
  /** kUSD returned to the balance. */
  proceeds: number;
  t: number;
  /** Transaction signature, when known. */
  sig?: string;
}

export interface PlatformStats {
  totalVolume: number;
  openMarkets: number;
  /** Pool cash across open markets, kUSD. */
  liquidity: number;
  settled: number;
  byCategory: Record<string, number>;
}

export interface SearchItem {
  id: string;
  question: string;
  category: Category;
  yesPrice: number;
  state: Market["state"];
}

export interface FeedItem {
  id: string;
  marketId: string;
  question: string;
  category: Category;
  side: Side;
  leverage: number;
  kind: Activity["kind"];
  /** Notional at entry for opens, proceeds for closes. kUSD. */
  size: number;
  /** Margin for opens, kUSD. */
  margin: number;
  /** Mark-to-market for opens, null when unknown. kUSD. */
  pnl: number | null;
  t: number;
}

/** Join trades with their markets for the live tape. Shared by the server and the live client feed. */
export function buildFeed(activity: Activity[], markets: Market[], limit = 18): FeedItem[] {
  const byId = new Map(markets.map((m) => [m.id, m]));
  return activity
    .flatMap((a): FeedItem[] => {
      const m = byId.get(a.marketId);
      if (!m) return [];
      const open = a.kind === "open";
      const mark = a.side === "yes" ? m.yesPrice : 1 - m.yesPrice;
      const size = open ? a.amount * Math.max(1, a.leverage) : a.amount;
      return [
        {
          id: a.id,
          marketId: m.id,
          question: m.question,
          category: m.category,
          side: a.side,
          leverage: Math.max(1, a.leverage),
          kind: a.kind,
          size,
          margin: open ? a.amount : 0,
          pnl: open && a.price > 0 && m.state === "open" ? size * (mark / a.price - 1) : null,
          t: a.t,
        },
      ];
    })
    .sort((a, b) => b.t - a.t)
    .slice(0, limit);
}

/** Light copy for client lists: recent history only, no trail. Keeps RSC payloads small. */
export function toListItem(market: Market): Market {
  return {
    ...market,
    history: downsample(market.history.filter((pt) => pt.t >= (market.history.at(-1)?.t ?? 0) - 3 * 86_400), 48),
    oracleTrail: [],
    rules: [],
  };
}

function downsample<T>(list: T[], target: number): T[] {
  if (list.length <= target) return list;
  const step = (list.length - 1) / (target - 1);
  return Array.from({ length: target }, (_, i) => list[Math.round(i * step)] as T);
}
