"use client";

import Link from "next/link";

import { CategoryThumb } from "@/components/app/category-thumb";
import { formatCents, formatLeverage, formatNumber, formatPct, formatUsd, formatUsdSigned } from "@/lib/format";
import type { PositionView } from "@/lib/leverage";
import type { Market, Position } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface PositionRow {
  key: string;
  position: Position;
  market: Market;
  view: PositionView;
  /** kUSD claimable when the market has settled, else null. */
  claimable: number | null;
  /** Trading has closed and the outcome is not final yet. */
  settling?: boolean;
  /** Read-only demo row. */
  demo?: boolean;
}

/** Health from liquidation (0) to safe (1): a down-to-up gradient revealed up to the current health. */
export function HealthBar({ health, leveraged }: { health: number; leveraged: boolean }) {
  const pct = Math.round(health * 100);
  if (!leveraged) return <span className="text-xs text-haze">No liquidation</span>;
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label="Distance to liquidation"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="relative h-1.5 w-20 overflow-hidden rounded-xs bg-fg/10"
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-down via-acc to-up"
          style={{ width: "5rem", clipPath: `inset(0 ${100 - pct}% 0 0)` }}
        />
      </div>
      <span className={cn("num text-xs", health < 0.25 ? "text-down" : "text-muted")}>{pct}%</span>
    </div>
  );
}

function SideTag({ position }: { position: Position }) {
  const yes = position.side === "yes";
  return (
    <span className={cn("num inline-flex h-5 items-center rounded-xs px-1.5 text-[11px] font-semibold", yes ? "bg-up/15 text-up" : "bg-down/15 text-down")}>
      {formatLeverage(position.leverage)} {yes ? "Yes" : "No"}
    </span>
  );
}

function Action({ row, busy, onClose, onClaim }: { row: PositionRow; busy: boolean; onClose: () => void; onClaim: () => void }) {
  const base = "h-9 rounded-sm px-3 text-xs font-bold transition-[background-color,transform] active:scale-95 disabled:opacity-50";
  if (row.demo) return <span className="text-xs text-haze">Demo</span>;
  if (row.claimable !== null) {
    return row.claimable > 0 ? (
      <button type="button" onClick={onClaim} disabled={busy} className={cn(base, "bg-acc text-acc-ink hover:bg-acc-hover")}>
        {busy ? "Claiming" : `Claim ${formatUsd(row.claimable)}`}
      </button>
    ) : (
      <button type="button" onClick={onClaim} disabled={busy} className={cn(base, "bg-fg/10 text-muted hover:bg-fg/15 hover:text-fg")}>
        {busy ? "Clearing" : "Lost, clear"}
      </button>
    );
  }
  if (row.settling) return <span className="text-xs text-haze">Awaiting settlement</span>;
  return (
    <button type="button" onClick={onClose} disabled={busy} className={cn(base, "bg-fg/10 text-fg hover:bg-fg/15")}>
      {busy ? "Closing" : "Close"}
    </button>
  );
}

export function PositionsTable({
  rows,
  busyKey,
  onClose,
  onClaim,
}: {
  rows: PositionRow[];
  busyKey: string | null;
  onClose: (row: PositionRow) => void;
  onClaim: (row: PositionRow) => void;
}) {
  return (
    <>
      {/* Cards below md */}
      <ul className="divide-y divide-line/[0.07] md:hidden">
        {rows.map((r) => (
          <li key={r.key} className="p-4">
            <div className="flex gap-3">
              <CategoryThumb category={r.market.category} className="size-10" />
              <div className="min-w-0 flex-1">
                <Link href={`/markets/${r.market.id}`} className="line-clamp-2 text-sm font-semibold text-fg">
                  {r.market.question}
                </Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <SideTag position={r.position} />
                  <span className="num text-muted">
                    {formatCents(r.position.entryPrice)} to {formatCents(r.view.mark)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <HealthBar health={r.view.health} leveraged={r.view.liqPrice !== null} />
              <span className={cn("num text-sm", r.view.pnl >= 0 ? "text-up" : "text-down")}>
                {formatUsdSigned(r.view.pnl)} <span className="text-haze">{formatPct(r.view.pnlPct, true)}</span>
              </span>
            </div>
            <div className="mt-3 flex justify-end">
              <Action row={r} busy={busyKey === r.key} onClose={() => onClose(r)} onClaim={() => onClaim(r)} />
            </div>
          </li>
        ))}
      </ul>

      {/* Table from md */}
      <div className="thin-scrollbar hidden overflow-x-auto md:block">
        <table className="w-full min-w-[52rem] text-sm">
          <caption className="sr-only">Open positions</caption>
          <thead>
            <tr className="border-b border-line/10 text-left text-xs text-haze">
              <th scope="col" className="px-5 py-2.5 font-medium">Market</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Shares</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Entry</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Mark</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Liq. price</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Health</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">PnL</th>
              <th scope="col" className="px-5 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/[0.07]">
            {rows.map((r) => (
              <tr key={r.key} className="transition-colors hover:bg-fg/[0.03]">
                <td className="max-w-sm px-5 py-3">
                  <div className="flex items-center gap-3">
                    <CategoryThumb category={r.market.category} className="size-10" />
                    <div className="min-w-0">
                      <Link href={`/markets/${r.market.id}`} className="line-clamp-1 font-semibold text-fg hover:underline">
                        {r.market.question}
                      </Link>
                      <div className="mt-1">
                        <SideTag position={r.position} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="num px-3 py-3 text-right text-fg/85">{formatNumber(r.position.shares)}</td>
                <td className="num px-3 py-3 text-right text-fg/85">{formatCents(r.position.entryPrice)}</td>
                <td className="num px-3 py-3 text-right text-fg">{formatCents(r.view.mark)}</td>
                <td className="num px-3 py-3 text-right text-acc">{r.view.liqPrice === null ? <span className="text-haze">None</span> : formatCents(r.view.liqPrice)}</td>
                <td className="px-3 py-3">
                  <HealthBar health={r.view.health} leveraged={r.view.liqPrice !== null} />
                </td>
                <td className={cn("num px-3 py-3 text-right", r.view.pnl >= 0 ? "text-up" : "text-down")}>
                  {formatUsdSigned(r.view.pnl)}
                  <span className="block text-xs text-haze">{formatPct(r.view.pnlPct, true)}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <Action row={r} busy={busyKey === r.key} onClose={() => onClose(r)} onClaim={() => onClaim(r)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
