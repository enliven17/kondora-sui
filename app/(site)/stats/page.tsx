import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ButtonLink } from "@/components/ui/button";
import { CATEGORY_META } from "@/lib/categories";
import { NoMarkets } from "@/components/markets/no-markets";
import { getDailyVolume, getMarkets, getStats } from "@/lib/data";
import { formatUsdCompact } from "@/lib/format";
import { CATEGORIES, type Category, type Outcome } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Stats",
  description: "Volume, liquidity, categories and settlements across every Kondora market.",
};

export const revalidate = 60;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("en-US");
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const CATEGORY_COLOR: Record<Category, string> = {
  crypto: "bg-petal-hot",
  macro: "bg-acc",
  sports: "bg-up",
  esports: "bg-petal",
  politics: "bg-gold",
  world: "bg-online",
  tech: "bg-down",
  culture: "bg-muted",
};

const OUTCOME_META: Record<Outcome, { label: string; color: string; text: string }> = {
  yes: { label: "YES", color: "bg-up", text: "text-up" },
  no: { label: "NO", color: "bg-down", text: "text-down" },
  invalid: { label: "INVALID", color: "bg-muted", text: "text-muted" },
};

function Card({ label, aside, className, children }: { label: string; aside?: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-xl bg-cocoa p-5 text-fg sm:p-6", className)}>
      <header className="flex items-baseline justify-between gap-4 border-b border-line/10 pb-4">
        <h2 className="text-micro uppercase text-muted">{label}</h2>
        {aside && <p className="text-micro uppercase text-haze">{aside}</p>}
      </header>
      <div className="pt-5">{children}</div>
    </section>
  );
}

export default async function StatsPage() {
  const [markets, stats, daily] = await Promise.all([getMarkets(), getStats(), getDailyVolume(14)]);
  const settled = markets.filter((m) => m.state === "resolved" && m.outcome);
  const volume = stats.totalVolume;
  const liquidity = stats.liquidity;
  const openCount = stats.openMarkets;
  const traders = markets.reduce((s, m) => s + m.traders, 0);

  const totalOpen = Math.max(1, openCount);
  const byCategory = CATEGORIES.map((c) => ({ id: c, count: stats.byCategory[c] ?? 0 })).filter((c) => c.count > 0);

  // Daily traded notional over the last 14 UTC days, from the volumeDays buckets kept by the indexer.
  const days = daily.map((d) => ({ t: d.day, v: d.volume }));
  const maxDay = Math.max(1, ...days.map((d) => d.v));

  const outcomes = (["yes", "no", "invalid"] as const).map((o) => ({ id: o, count: settled.filter((m) => m.outcome === o).length }));

  const tiles = [
    { label: "Open markets", value: int.format(openCount) },
    { label: "Settled", value: int.format(settled.length) },
    { label: "Max leverage", value: "5x", tone: "text-acc" },
    { label: "Avg volume per market", value: formatUsdCompact(volume / Math.max(1, markets.length)) },
  ];

  return (
    <div className="page-x mx-auto max-w-[72rem] pb-24 pt-14 sm:pt-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-[clamp(2.75rem,7vw,4.5rem)] font-medium leading-none tracking-[-0.045em] text-cocoa">Platform stats</h1>
        <p className="text-sm text-mauve">Across every market on testnet. Refreshes every minute.</p>
      </div>

      <div className="mt-10 grid gap-3 lg:grid-cols-2">
        <Card label="Volume traded" aside="Since launch">
          <p className="num text-[clamp(2.25rem,6vw,3.75rem)] leading-none text-petal-hot">{usd.format(volume)}</p>
          <p className="mt-3 text-sm text-muted">
            <span className="num text-fg">{int.format(traders)}</span> traders across <span className="num text-fg">{markets.length}</span> markets
          </p>
        </Card>
        <Card label="Liquidity in open markets" aside="pm-AMM pools">
          <p className="num text-[clamp(2.25rem,6vw,3.75rem)] leading-none">{usd.format(liquidity)}</p>
          <p className="mt-3 text-sm text-muted">
            <span className="num text-fg">{openCount}</span> open markets, funded by the House
          </p>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((s) => (
          <div key={s.label} className="rounded-xl bg-cocoa p-5 text-fg">
            <p className="text-sm text-muted">{s.label}</p>
            <p className={cn("num mt-2 text-2xl sm:text-3xl", s.tone)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card label="Open markets by category" aside={`${openCount} total`}>
          {byCategory.length === 0 && <NoMarkets className="py-6" />}
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-xs" role="img" aria-label="Share of open markets by category">
            {byCategory.map((c) => (
              <div key={c.id} className={CATEGORY_COLOR[c.id]} style={{ width: `${(c.count / totalOpen) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {byCategory.map((c) => (
              <li key={c.id} className="flex items-center gap-3 text-sm">
                <span aria-hidden className={cn("size-2.5 shrink-0 rounded-[2px]", CATEGORY_COLOR[c.id])} />
                <span className="flex-1 text-fg/90">{CATEGORY_META[c.id].label}</span>
                <span className="num text-muted">{Math.round((c.count / totalOpen) * 100)}%</span>
                <span className="num w-6 text-right">{c.count}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card label="Settled by outcome" aside={`${settled.length} settled`}>
          <ul className="space-y-4">
            {outcomes.map((o) => (
              <li key={o.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className={OUTCOME_META[o.id].text}>{OUTCOME_META[o.id].label}</span>
                  <span className="num">{o.count}</span>
                </div>
                <div className="mt-2 h-2 rounded-xs bg-panel-deep">
                  <div
                    className={cn("h-full rounded-xs", OUTCOME_META[o.id].color)}
                    style={{ width: `${settled.length ? (o.count / settled.length) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-haze">INVALID pays YES at the final mark and NO at one minus the mark.</p>
        </Card>
      </div>

      <Card label="Daily volume" aside="Last 14 days, UTC" className="mt-3">
        <div className="flex h-48 items-end gap-1 sm:gap-2" role="img" aria-label="Daily traded volume over the last 14 days">
          {days.map((d, i) => (
            <div key={d.t} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <span className="num mb-1 hidden text-center text-[10px] text-muted md:block">{formatUsdCompact(d.v)}</span>
              <div
                className={cn("w-full rounded-t-xs", i === days.length - 1 ? "bg-acc" : "bg-petal-hot/70")}
                style={{ height: `${Math.max(2, (d.v / maxDay) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1 sm:gap-2">
          {days.map((d, i) => (
            <span key={d.t} className={cn("min-w-0 flex-1 truncate text-center text-[10px] text-haze", i % 3 !== 1 && "max-sm:invisible")}>
              {dayFmt.format(new Date(d.t * 1000))}
            </span>
          ))}
        </div>
      </Card>

      <div className="mt-10 flex justify-center">
        <ButtonLink href="/markets" variant="dark" arrow>
          Open markets
        </ButtonLink>
      </div>
    </div>
  );
}
