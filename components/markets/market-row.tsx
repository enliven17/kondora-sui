import Link from "next/link";

import { CategoryThumb } from "@/components/app/category-thumb";
import { CATEGORY_META } from "@/lib/categories";
import { formatChance, formatSignedPts, formatUsdCompact } from "@/lib/format";
import type { Market, Side } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LeverageTag } from "./leverage-tag";
import { OutcomeLabel } from "./outcome-label";
import { TimeLeft } from "./time-left";

const SIDE_CHIP: Record<Side, string> = {
  yes: "bg-up/15 text-up hover:bg-up hover:text-ink",
  no: "bg-down/15 text-down hover:bg-down hover:text-fg",
};

export function QuickBetChip({ marketId, side, amount }: { marketId: string; side: Side; amount: number }) {
  return (
    <Link
      href={`/markets/${marketId}?side=${side}&amount=${amount}`}
      aria-label={`Bet ${amount} kUSD on ${side.toUpperCase()}`}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1 rounded-sm px-2 sm:min-w-[4.25rem] sm:gap-1.5 sm:px-2.5 text-xs font-bold transition-[background-color,color,transform] duration-150 active:scale-95",
        SIDE_CHIP[side],
      )}
    >
      <span>{side === "yes" ? "Yes" : "No"}</span>
      <span className="num">+{amount}</span>
    </Link>
  );
}

/** One market in the list: render, question, meta, YES chance and quick bets. */
export function MarketRow({ market, amount, serverNow }: { market: Market; amount: number; serverNow: number }) {
  const open = market.state === "open";
  const up = market.change24h >= 0;
  const meta = CATEGORY_META[market.category];

  return (
    <li className="relative flex flex-wrap items-center gap-x-4 gap-y-3 px-3 py-3.5 transition-colors hover:bg-fg/[0.035] sm:flex-nowrap sm:px-5">
      <div className="flex min-w-0 basis-full items-center gap-3 sm:flex-1 sm:basis-0">
        <CategoryThumb category={market.category} className="size-12 sm:size-14" />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-fg">
            <Link
              href={`/markets/${market.id}`}
              className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-petal-hot"
            >
              {market.question}
            </Link>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-muted">{meta.label}</span>
            {open ? (
              <>
                <LeverageTag market={market} serverNow={serverNow} />
                <span className="text-haze">
                  Closes in <TimeLeft closeTime={market.closeTime} className="num text-muted" />
                </span>
              </>
            ) : (
              <OutcomeLabel market={market} />
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-baseline gap-2 whitespace-nowrap sm:w-28 sm:flex-col sm:items-end sm:gap-0.5">
        <span className="num text-xl leading-none text-fg sm:text-2xl">
          {formatChance(market.yesPrice)}
          <span className="sr-only"> chance of YES</span>
        </span>
        <span className={cn("num text-xs", up ? "text-up" : "text-down")}>
          {formatSignedPts(market.change24h)} <span className="hidden xs:inline">pts</span><span className="hidden text-haze sm:inline"> 24h</span>
        </span>
      </div>

      <div className="hidden w-24 shrink-0 text-right lg:block">
        <span className="num text-sm text-fg">{formatUsdCompact(market.volume)}</span>
        <span className="block text-[11px] text-haze">Volume</span>
      </div>

      <div className="relative z-10 ml-auto flex shrink-0 gap-1.5 sm:ml-0 sm:w-[8.875rem] sm:justify-end">
        {open ? (
          <>
            <QuickBetChip marketId={market.id} side="yes" amount={amount} />
            <QuickBetChip marketId={market.id} side="no" amount={amount} />
          </>
        ) : (
          <span className="inline-flex h-9 w-[8.875rem] items-center justify-center rounded-sm bg-fg/5 text-xs text-muted">Trading closed</span>
        )}
      </div>
    </li>
  );
}
