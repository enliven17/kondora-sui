"use client";

import { ConvexHttpClient } from "convex/browser";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { EnableTrading } from "@/components/bet/enable-trading";
import { TxLink } from "@/components/bet/tx-link";
import { CategoryThumb } from "@/components/app/category-thumb";
import { WalletButton } from "@/components/app/wallet-button";
import { CountUp } from "@/components/ui/count-up";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { useLiveActivity, useLiveMarketList } from "@/hooks/use-convex-live";
import { useKondoraAccount } from "@/hooks/use-kondora-account";
import { useLiveMarkets } from "@/hooks/use-live-market";
import { useNow } from "@/hooks/use-now";
import { api, CONVEX_ENABLED, toMarket } from "@/lib/convex";
import { formatLeverage, formatTimeAgo, formatUsd, formatUsdSigned } from "@/lib/format";
import { activePositions, amm, OUTCOME, type PositionData, STATE } from "@/lib/kondora";
import { valuePosition } from "@/lib/leverage";
import type { LiveMarket } from "@/lib/live";
import type { TradeResult, TxLink as TxLinkData } from "@/lib/trade";
import { claimPosition, closePosition } from "@/lib/trade-lazy";
import type { Market, Position } from "@/lib/types";
import { cn } from "@/lib/utils";
import { type HistoryItem, toListItem } from "@/lib/views";
import { FundsPanel } from "./funds-panel";
import { type PositionRow, PositionsTable } from "./positions-table";

const noopSubscribe = () => () => {};

/** Chain position (micro units) to the UI position (whole kUSD). */
function toPosition(p: PositionData, feeBps: number, closeTime?: number): Position {
  const margin = amm.usdc(p.margin);
  const debt = amm.usdc(p.debt);
  const shares = amm.usdc(p.shares);
  const spent = (margin + debt) * (1 - feeBps / amm.BPS);
  return {
    marketId: String(p.market_id),
    side: p.side === 0 ? "yes" : "no",
    shares,
    margin,
    debt,
    accrued: amm.usdc(p.accrued) + debt * 0.0002 * Math.max(0, Math.min(Date.now() / 1000, closeTime ?? Infinity) - Number(p.last_accrual)) / 3600,
    entryPrice: shares > 0 ? spent / shares : 0,
    leverage: margin > 0 ? (margin + debt) / margin : 1,
    openedAt: Number(p.opened_at),
  };
}

/** Payout per share of `side` once resolved, from the chain account when known. */
function settledMark(position: Position, market: Market, live: LiveMarket | undefined): number | null {
  if (live && live.account.state === STATE.RESOLVED) {
    const o = live.account.outcome;
    if (o === OUTCOME.INVALID) return position.side === "yes" ? live.account.final_price_yes : 1 - live.account.final_price_yes;
    return (o === OUTCOME.YES) === (position.side === "yes") ? 1 : 0;
  }
  if (market.state !== "resolved") return null;
  const o = market.outcome ?? "invalid";
  if (o === "invalid") return position.side === "yes" ? market.yesPrice : 1 - market.yesPrice;
  return o === position.side ? 1 : 0;
}

function toRow(position: Position, market: Market, live: LiveMarket | undefined, demo: boolean): PositionRow {
  const key = `${position.marketId}:${position.side}`;
  const mark = settledMark(position, market, live);
  if (mark !== null) {
    const value = Math.max(0, position.shares * mark - position.debt - position.accrued);
    const pnl = value - position.margin;
    return {
      key,
      position,
      market,
      demo,
      claimable: value,
      view: { mark, value, equity: value, pnl, pnlPct: position.margin > 0 ? pnl / position.margin : 0, health: 1, liqPrice: null },
    };
  }
  const tradingOpen = live ? live.account.state === STATE.OPEN : market.state === "open";
  return { key, position, market, demo, claimable: null, settling: !tradingOpen, view: valuePosition(position, market, live?.pool) };
}

/** Markets a wallet holds that are not in the list (older settled ones): fetched once by id. */
function useMissingMarkets(ids: string[], known: Map<string, Market>): Map<string, Market> {
  const [extra, setExtra] = useState<Map<string, Market>>(new Map());
  const missing = ids.filter((id) => !known.has(id) && !extra.has(id)).join(",");
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!CONVEX_ENABLED || !url || !missing) return;
    const client = new ConvexHttpClient(url);
    let cancelled = false;
    void Promise.all(missing.split(",").map((id) => client.query(api.markets.get, { id }).catch(() => null))).then((rows) => {
      if (cancelled) return;
      setExtra((prev) => {
        const next = new Map(prev);
        rows.forEach((r) => {
          const m = r ? toMarket(r) : null;
          if (m) next.set(m.id, toListItem(m));
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [missing]);
  return extra;
}

function BalanceStat({ label, value, tone, signed }: { label: string; value: number; tone?: string; signed?: boolean }) {
  return (
    <div className="min-w-0 py-4 xs:px-4 xs:first:pl-0 sm:px-6">
      <dt className="text-xs text-haze">{label}</dt>
      <dd>
        <CountUp value={value} format={signed ? formatUsdSigned : formatUsd} className={cn("num block truncate text-2xl sm:text-3xl", tone ?? "text-fg")} />
      </dd>
    </div>
  );
}

export function PortfolioView({ markets: initialMarkets, demoPositions, serverNow }: { markets: Market[]; demoPositions: Position[]; serverNow: number }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const { snap, wallet, ready, reload, connected, error: readError } = useKondoraAccount();
  const now = useNow(30_000) ?? serverNow;
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error"; tx?: TxLinkData } | null>(null);

  const markets = useLiveMarketList(initialMarkets);
  const owner = mounted && snap ? snap.owner : null;
  const ownerActivity = useLiveActivity(owner ? { owner, limit: 40 } : "skip", []);

  const chainPositions = useMemo(() => (snap?.user ? activePositions(snap.user) : []), [snap]);
  const ids = useMemo(() => chainPositions.map((p) => String(p.market_id)), [chainPositions]);
  const lives = useLiveMarkets(ids);
  const known = useMemo(() => new Map(markets.map((m) => [m.id, m])), [markets]);
  const extra = useMissingMarkets(ids, known);

  const demo = !connected && demoPositions.length > 0;
  const rows = useMemo(() => {
    const byId = (id: string) => known.get(id) ?? extra.get(id);
    if (demo) return demoPositions.flatMap((p) => (byId(p.marketId) ? [toRow(p, byId(p.marketId) as Market, undefined, true)] : []));
    return chainPositions.flatMap((p) => {
      const id = String(p.market_id);
      const m = byId(id);
      const live = lives[id];
      if (!m) return [];
      return [toRow(toPosition(p, live?.account.params.fee_bps ?? 50, live ? Number(live.account.close_time) : m.closeTime), m, live, false)];
    });
  }, [demo, demoPositions, chainPositions, known, extra, lives]);

  const history: HistoryItem[] = useMemo(
    () =>
      ownerActivity.flatMap((a): HistoryItem[] => {
        const m = known.get(a.marketId) ?? extra.get(a.marketId);
        if (!m || a.kind === "open") return [];
        return [{ id: a.id, marketId: a.marketId, question: m.question, category: m.category, side: a.side, kind: a.kind, leverage: Math.max(1, a.leverage), pnl: null, proceeds: a.amount, t: a.t }];
      }),
    [ownerActivity, known, extra],
  );

  const balance = amm.usdc(snap?.user?.balance ?? 0n);
  const inPositions = rows.reduce((s, r) => s + Math.max(0, r.view.equity), 0);
  const realized = amm.usdc(snap?.user?.realized_pnl ?? 0n);

  const act = async (row: PositionRow, kind: "close" | "claim") => {
    if (!wallet || !snap || row.demo) return;
    setBusyKey(row.key);
    setMessage(null);
    const live = lives[row.position.marketId];
    const data = chainPositions.find((p) => String(p.market_id) === row.position.marketId && (p.side === 0 ? "yes" : "no") === row.position.side);
    const result: TradeResult =
      kind === "claim"
        ? await claimPosition({ wallet, snap, marketId: row.position.marketId })
        : live && data
          ? await closePosition({ wallet, snap, live, position: data })
          : { ok: false, error: "The pool is still loading. Try again in a moment." };
    setBusyKey(null);
    void reload();
    if (!result.ok) {
      setMessage({ text: result.error, tone: "error", tx: result.tx });
      return;
    }
    const amount = kind === "claim" ? (row.claimable ?? 0) : Math.max(0, row.view.equity);
    setMessage({ text: `${kind === "claim" ? "Claimed" : "Closed for about"} ${formatUsd(amount)}.`, tone: "ok", tx: result.tx });
  };

  return (
    <div className="space-y-4">
      {mounted && !connected && (
        <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-base font-bold text-fg">Wallet not connected</h2>
            <p className="mt-0.5 text-sm text-muted">
              {demo ? "This is a demo portfolio. Connect a wallet to see your own positions on testnet." : "Connect a wallet to see your balance and positions on testnet."}
            </p>
          </div>
          <WalletButton className="shrink-0 self-start sm:self-auto" />
        </Panel>
      )}

      <Panel as="section" aria-labelledby="balance-title" className="p-4 sm:p-5">
        <h1 id="balance-title" className="text-sm font-semibold text-fg">
          Portfolio
        </h1>
        <dl className="mt-2 grid grid-cols-1 divide-y divide-line/10 xs:grid-cols-3 xs:divide-x xs:divide-y-0">
          <BalanceStat label="Balance" value={balance} />
          <BalanceStat label="In positions" value={inPositions} />
          <BalanceStat label="Realized PnL" value={realized} signed tone={realized >= 0 ? "text-up" : "text-down"} />
        </dl>
        {readError && <p className="mt-2 text-xs text-down">{readError}</p>}
      </Panel>

      {connected && snap && (ready ? <FundsPanel snap={snap} wallet={wallet} onDone={() => void reload()} /> : (
        <Panel className="p-4 sm:p-5">
          <EnableTrading key={snap.owner} snap={snap} wallet={wallet} onDone={() => void reload()} />
        </Panel>
      ))}

      <Panel as="section" aria-labelledby="positions-title" className="overflow-hidden">
        <PanelHeader id="positions-title" title="Positions">
          <span className="num text-xs text-haze">{rows.length} open</span>
        </PanelHeader>
        <div aria-live="polite" className={cn("space-y-1 px-5 pt-3", !message && "sr-only")}>
          {message && <p className={cn("text-sm", message.tone === "error" ? "text-down" : "text-online")}>{message.text}</p>}
          {message?.tx && <TxLink tx={message.tx} />}
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-lg font-semibold text-fg">{connected && !snap ? "Reading your account" : "No open positions"}</p>
            <p className="mt-1 text-sm text-muted">Pick a market and take a side. Positions show up here with their health.</p>
            <Link href="/markets" className="mt-4 inline-flex h-10 items-center rounded bg-acc px-4 text-sm font-bold text-acc-ink hover:bg-acc-hover">
              Browse markets
            </Link>
          </div>
        ) : (
          <PositionsTable rows={rows} busyKey={busyKey} onClose={(r) => act(r, "close")} onClaim={(r) => act(r, "claim")} />
        )}
      </Panel>

      <Panel as="section" aria-labelledby="history-title" className="overflow-hidden">
        <PanelHeader id="history-title" title="History" />
        {history.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Closed and liquidated positions appear here.</p>
        ) : (
          <ul className="divide-y divide-line/[0.07]">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <CategoryThumb category={h.category} className="size-9" />
                <div className="min-w-0 flex-1">
                  <Link href={`/markets/${h.marketId}`} className="line-clamp-1 text-sm font-semibold text-fg hover:underline">
                    {h.question}
                  </Link>
                  <p className="mt-0.5 text-xs">
                    <span className={cn("font-semibold", h.kind === "liquidation" ? "text-down" : h.kind === "claim" ? "text-acc" : "text-muted")}>
                      {h.kind === "liquidation" ? "Liquidated" : h.kind === "claim" ? "Claimed" : "Closed"}
                    </span>
                    <span className="num text-haze">
                      {" "}
                      {formatLeverage(h.leverage)} {h.side === "yes" ? "Yes" : "No"}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {h.pnl !== null ? (
                    <p className={cn("num text-sm", h.pnl >= 0 ? "text-up" : "text-down")}>{formatUsdSigned(h.pnl)}</p>
                  ) : (
                    <p className="num text-sm text-fg/85">{h.kind === "liquidation" ? formatUsd(h.proceeds) : `+${formatUsd(h.proceeds)}`}</p>
                  )}
                  <p className="num text-[11px] text-haze">{formatTimeAgo(h.t, now)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
