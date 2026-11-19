"use client";

import { useMemo, useState } from "react";

import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { useLiveMarketList } from "@/hooks/use-convex-live";
import { CATEGORY_META } from "@/lib/categories";
import { CATEGORIES, type Category, type Market, type SortKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MarketRow } from "./market-row";
import { NoMarkets } from "./no-markets";

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: "trending", label: "Volume" },
  { value: "closing", label: "Closing soon" },
  { value: "newest", label: "Newest" },
  { value: "liquidity", label: "Liquidity" },
];

export const QUICK_AMOUNTS = [5, 10, 25] as const;

type Filter = Category | "all";

function sortMarkets(list: Market[], sort: SortKey) {
  const openFirst = (a: Market, b: Market) => Number(b.state === "open") - Number(a.state === "open");
  const by: Record<SortKey, (a: Market, b: Market) => number> = {
    trending: (a, b) => b.volume - a.volume,
    closing: (a, b) => a.closeTime - b.closeTime,
    newest: (a, b) => b.openTime - a.openTime,
    liquidity: (a, b) => b.liquidity - a.liquidity,
  };
  return [...list].sort((a, b) => openFirst(a, b) || by[sort](a, b));
}

export function MarketsTable({ markets: initial, initialCategory, serverNow }: { markets: Market[]; initialCategory?: Category; serverNow: number }) {
  const markets = useLiveMarketList(initial);
  const [category, setCategory] = useState<Filter>(initialCategory ?? "all");
  const [sort, setSort] = useState<SortKey>("trending");
  const [amount, setAmount] = useState<number>(QUICK_AMOUNTS[1]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: markets.length };
    for (const m of markets) c[m.category] = (c[m.category] ?? 0) + 1;
    return c;
  }, [markets]);

  const visible = useMemo(
    () => sortMarkets(category === "all" ? markets : markets.filter((m) => m.category === category), sort),
    [markets, category, sort],
  );

  const onCategory = (next: Filter) => {
    setCategory(next);
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", next);
    window.history.replaceState(null, "", url);
  };

  return (
    <Panel as="section" aria-labelledby="markets-title" className="overflow-hidden">
      <h2 id="markets-title" className="sr-only">
        Markets
      </h2>
      <div className="flex items-center justify-between gap-3 bg-blush/90 px-3 sm:px-5">
        <Select<Filter> label="Category" value={category} onChange={onCategory} options={[
          { value: "all", label: "All markets", count: counts.all ?? 0 },
          ...CATEGORIES.map(c => ({ value: c, label: CATEGORY_META[c].label, count: counts[c] ?? 0, icon: CATEGORY_META[c].cover })),
        ]} />
        <div className="flex min-w-0 items-center gap-0.5 text-sm text-mauve">
          <span className="hidden xs:inline">Sort</span>
          <Select label="Sort" value={sort} onChange={setSort} options={SORTS} align="end" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-line/10 px-3 py-2.5 sm:px-5">
        <p className="whitespace-nowrap text-xs text-haze" aria-live="polite">
          <span className="num text-muted">{visible.length}</span> <span className="hidden xs:inline">{visible.length === 1 ? "market" : "markets"}</span>
        </p>
        <div role="radiogroup" aria-label="Quick bet amount in kUSD" className="flex items-center gap-1">
          <span className="mr-1 hidden text-xs text-haze xs:inline">Quick bet</span>
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={amount === a}
              onClick={() => setAmount(a)}
              className={cn(
                "num h-7 min-w-8 rounded-sm px-2 text-xs transition-colors",
                amount === a ? "bg-acc text-acc-ink" : "text-muted hover:bg-fg/5 hover:text-fg",
              )}
            >
              {a}
            </button>
          ))}
          <span className="ml-1 text-xs text-haze">kUSD</span>
        </div>
      </div>

      <div className="hidden items-center gap-4 border-b border-line/10 px-5 py-2 text-xs text-haze sm:flex">
        <span className="min-w-0 flex-1">Market</span>
        <span className="w-28 shrink-0 text-right">Yes chance</span>
        <span className="hidden w-24 shrink-0 text-right lg:block">Volume</span>
        <span className="w-[8.875rem] shrink-0 text-right">Bet</span>
      </div>

      {markets.length === 0 ? (
        <NoMarkets />
      ) : visible.length > 0 ? (
        <ul className="divide-y divide-line/[0.07]">
          {visible.map((m) => (
            <MarketRow key={m.id} market={m} amount={amount} serverNow={serverNow} />
          ))}
        </ul>
      ) : (
        <div className="px-5 py-14 text-center">
          <p className="text-lg font-semibold text-fg">No markets here yet.</p>
          <p className="mt-1 text-sm text-muted">Agents open new markets through the day. Try another category.</p>
        </div>
      )}
    </Panel>
  );
}
