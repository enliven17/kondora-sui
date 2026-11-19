"use client";

import { useWalletModal } from "@/components/app/wallet-runtime";
import { AnimatePresence } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import { OutcomeLabel } from "@/components/markets/outcome-label";
import { CountUp } from "@/components/ui/count-up";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { useFeedback } from "@/hooks/use-feedback";
import { useKondoraAccount } from "@/hooks/use-kondora-account";
import { useLiveMarket } from "@/hooks/use-live-market";
import { useNow } from "@/hooks/use-now";
import { formatCents, formatLeverage, formatNumber, formatPct, formatUsd, formatUsdSigned } from "@/lib/format";
import { amm } from "@/lib/kondora";
import { type CapParams, type CapReason, leverageCap, maxFeasibleLeverage, maxFeasibleMargin, PROTOCOL, quoteBet, sidePrice } from "@/lib/leverage";
import type { TxLink as TxLinkData } from "@/lib/trade";
import { placeBet } from "@/lib/trade-lazy";
import type { Market, Side } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BetConfirmation, type ConfirmedBet } from "./bet-confirmation";
import { EnableTrading } from "./enable-trading";
import { LeverageSlider } from "./leverage-slider";
import { TxLink } from "./tx-link";

export const SIDE_EVENT = "kondora:side";

const PRESETS = [1, 5, 10, 25] as const;
const DEFAULT_MIN_TRADE = 0.1;

const CAP_NOTES: Record<CapReason, string> = {
  max: "",
  time: "Leverage tapers in the last 24 hours.",
  price: "Leverage tightens near 0¢ and 100¢.",
  "reduce-only": "Only 1x opens in the final hour.",
};

export interface BetPanelProps {
  market: Market;
  initialSide?: Side;
  initialAmount?: number;
  /** Clock for the first render so server and client agree on the cap. */
  serverNow: number;
}

function blockReason(margin: number, minTrade: number, overBalance: boolean, priceLimitHit: boolean, unhealthy = false): string | null {
  if (!(margin > 0)) return "Enter an amount";
  if (margin < minTrade) return `Minimum ${minTrade} kUSD`;
  if (overBalance) return "Above your balance";
  if (priceLimitHit) return "Too large for this pool";
  if (unhealthy) return "Too large at this leverage, lower the amount or leverage";
  return null;
}

export function BetPanel({ market, initialSide = "yes", initialAmount = 5, serverNow }: BetPanelProps) {
  const [side, setSide] = useState<Side>(initialSide);
  const [amountText, setAmountText] = useState(String(initialAmount));
  const [leverage, setLeverage] = useState(2);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedBet | null>(null);
  const [errorTx, setErrorTx] = useState<TxLinkData | null>(null);

  const account = useKondoraAccount();
  const { snap, wallet, ready, reload, connected } = account;
  const live = useLiveMarket(market.id);
  // Mock markets (local dev without Convex) have slugs, not on-chain ids.
  const onChain = /^0x[0-9a-f]{64}$/i.test(market.id);
  const { setVisible } = useWalletModal();
  const { sound, setSound, success } = useFeedback();
  const now = useNow(15_000) ?? serverNow;
  const amountId = useId();

  useEffect(() => {
    const onSide = (e: Event) => {
      const next = (e as CustomEvent<Side>).detail;
      if (next === "yes" || next === "no") setSide(next);
    };
    window.addEventListener(SIDE_EVENT, onSide);
    return () => window.removeEventListener(SIDE_EVENT, onSide);
  }, []);

  // Live on-chain state wins over the indexed snapshot whenever it is available.
  const params = live?.account.params;
  const yesPrice = live?.priceYes ?? market.yesPrice;
  const view = useMemo(() => ({ yesPrice, liquidity: market.liquidity }), [yesPrice, market.liquidity]);
  const capParams = useMemo<CapParams | undefined>(
    () => (params ? { maxLevBps: params.max_lev_bps, tau0: Number(params.tau0), reduceOnlySecs: Number(params.reduce_only_secs) } : undefined),
    [params],
  );
  const { cap, reason } = useMemo(() => leverageCap(yesPrice, market.closeTime, now, capParams), [yesPrice, market.closeTime, now, capParams]);
  const margin = Number.parseFloat(amountText) || 0;
  // What this pool can actually fill: the slider never goes past it, so the
  // panel never shows an empty quote for an impossible size.
  const quoteArgs = useMemo(
    () => [view, side, live?.pool, params ? params.max_price_bps / amm.BPS : undefined, live?.floorL] as const,
    [view, side, live?.pool, params, live?.floorL],
  );
  const feasible = useMemo(() => maxFeasibleLeverage([...quoteArgs], margin, cap), [quoteArgs, margin, cap]);
  const tooLarge = margin > 0 && feasible === 0;
  const sizeCap = tooLarge ? 1 : Math.min(cap, feasible);
  const lev = Math.min(leverage, sizeCap);
  const maxAtLev = useMemo(
    () => maxFeasibleMargin([...quoteArgs], tooLarge ? 1 : lev, Math.max(margin, 10_000)),
    [quoteArgs, lev, tooLarge, margin],
  );
  const quote = useMemo(
    () => quoteBet(view, side, margin, lev, live?.pool, params ? params.max_price_bps / amm.BPS : undefined, live?.floorL),
    [view, side, margin, lev, live?.pool, params, live?.floorL],
  );
  const price = sidePrice(view, side);
  const feeRate = params ? params.fee_bps / amm.BPS : PROTOCOL.feeRate;
  const minTrade = params ? amm.usdc(params.min_trade) : DEFAULT_MIN_TRADE;
  const balance = ready && snap?.user ? amm.usdc(snap.user.balance) : null;
  const overBalance = balance !== null && margin > balance;
  const chainState = live?.account.state;
  const closed = market.state !== "open" || now >= market.closeTime || (chainState !== undefined && chainState !== 0);
  const blocked = tooLarge
    ? `Too large for this pool, max ${formatUsd(maxAtLev)} at 1x`
    : blockReason(margin, minTrade, overBalance, quote.priceLimitHit, quote.unhealthy);
  const sizeNote =
    tooLarge
      ? `This pool can take up to ${formatUsd(maxAtLev)} right now.`
      : feasible < cap && margin > 0
        ? `Max ${feasible.toFixed(1)}x for ${formatUsd(margin)} in this pool. Lower the amount for more leverage.`
        : CAP_NOTES[reason];
  const dismiss = useCallback(() => setConfirmed(null), []);

  if (closed) {
    return (
      <Panel as="section" aria-labelledby="bet-title" className="p-5">
        <h2 id="bet-title" className="text-xl font-bold tracking-tight text-fg">
          Trading closed
        </h2>
        <div className="mt-2">
          <OutcomeLabel market={market.state === "open" ? { ...market, state: "closed" } : market} />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This market no longer takes bets. The oracle and audit trail shows how it settles.
        </p>
      </Panel>
    );
  }

  const submit = async () => {
    if (blocked || pending || !wallet || !snap || !live) return;
    setPending(true);
    setError(null);
    setErrorTx(null);
    const result = await placeBet({ wallet, snap, live, side, margin, leverage: lev });
    setPending(false);
    void reload();
    if (!result.ok) {
      setError(result.error);
      setErrorTx(result.tx ?? null);
      return;
    }
    success();
    setConfirmed({
      side,
      leverage: lev,
      margin,
      shares: result.shares ?? quote.shares,
      payout: quote.payoutIfWin,
      liqPrice: quote.liqPrice,
      signature: result.tx.signature,
      explorer: result.tx.explorer,
    });
  };

  const yes = side === "yes";
  const sideWord = yes ? "YES" : "NO";

  return (
    <Panel as="section" aria-labelledby="bet-title" className="relative overflow-hidden">
      <PanelHeader id="bet-title" title="Place a bet">
        <button
          type="button"
          aria-pressed={sound}
          onClick={() => setSound(!sound)}
          className="rounded-sm px-2 py-1 text-xs text-muted transition-colors hover:bg-fg/5 hover:text-fg"
        >
          Sound {sound ? "on" : "off"}
        </button>
      </PanelHeader>

      <div className="space-y-4 p-4 sm:p-5">
        <div role="radiogroup" aria-label="Side" className="grid grid-cols-2 gap-1 rounded bg-panel-deep p-1">
          {(["yes", "no"] as const).map((s) => {
            const active = side === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSide(s)}
                className={cn(
                  "flex h-11 items-center justify-between rounded-sm px-3 text-sm font-bold transition-[background-color,color] duration-200",
                  active ? (s === "yes" ? "bg-up text-ink" : "bg-down text-fg") : "text-muted hover:bg-fg/5 hover:text-fg",
                )}
              >
                <span>{s === "yes" ? "Yes" : "No"}</span>
                <span className="num">{formatCents(sidePrice(view, s))}</span>
              </button>
            );
          })}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={amountId} className="app-label">
              Amount
            </label>
            {balance !== null && (
              <span className="text-xs text-haze">
                Balance <span className="num text-muted">{formatNumber(balance)}</span> kUSD
              </span>
            )}
          </div>
          <div
            className={cn(
              "mt-2 flex items-center rounded border bg-panel-deep transition-colors focus-within:border-line/30",
              overBalance ? "border-down/70" : "border-line/10",
            )}
          >
            <input
              id={amountId}
              inputMode="decimal"
              type="number"
              min={0}
              step="1"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className="num h-12 w-full min-w-0 bg-transparent px-3 text-xl text-fg focus:outline-none"
              aria-describedby={overBalance ? `${amountId}-err` : undefined}
              aria-invalid={overBalance || undefined}
            />
            <span className="pr-3 text-sm font-medium text-haze">kUSD</span>
          </div>
          {overBalance && (
            <p id={`${amountId}-err`} className="mt-1 text-xs text-down">
              Above your balance.
            </p>
          )}
          <div className="mt-2 grid grid-cols-5 gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmountText(String(p))}
                aria-pressed={margin === p}
                className={cn(
                  "num h-8 rounded-sm text-xs transition-colors",
                  margin === p ? "bg-acc text-acc-ink" : "bg-fg/5 text-muted hover:bg-fg/10 hover:text-fg",
                )}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                // Max = the largest size this pool fills at the current leverage, capped by your balance.
                const poolMax = maxFeasibleMargin([...quoteArgs], lev, balance ?? 10_000);
                setAmountText(String(Math.floor(Math.min(poolMax, balance ?? poolMax) * 100) / 100));
              }}
              aria-pressed={false}
              className={cn(
                "h-8 rounded-sm text-xs font-semibold transition-colors disabled:opacity-40",
                "bg-fg/5 text-muted hover:bg-fg/10 hover:text-fg",
              )}
            >
              Max
            </button>
          </div>
        </div>

        <LeverageSlider value={lev} onChange={setLeverage} cap={sizeCap} disabled={reason === "reduce-only" || tooLarge} note={sizeNote} />

        <div className="rounded-lg bg-panel-deep/80 p-4">
          <div className="flex items-end justify-between gap-3" aria-live="polite">
            <div className="min-w-0">
              <div className="text-xs text-haze">Payout if {sideWord} wins</div>
              <CountUp value={quote.payoutIfWin} format={formatUsd} className={cn("num block truncate text-[2rem] leading-tight", yes ? "text-up" : "text-down")} />
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-haze">Profit</div>
              <div className="num text-sm text-fg">
                {formatUsdSigned(quote.profitIfWin)}{" "}
                <span className="text-haze">{margin > 0 ? formatPct(quote.profitIfWin / margin, true) : ""}</span>
              </div>
            </div>
          </div>
          <dl className="mt-3 space-y-1.5 border-t border-line/10 pt-3 text-sm">
            <Row label="Avg price" value={formatCents(quote.avgPrice)} />
            <Row label="Shares" value={formatNumber(quote.shares)} />
            <Row label="Position size" value={formatUsd(quote.notional)} />
            <Row label="Borrowed" value={formatUsd(quote.debt)} />
            <Row label={`Fee ${formatPct(feeRate)}`} value={formatUsd(quote.fee)} />
            <Row label="Price after" value={formatCents(quote.priceAfter)} />
            <Row
              label="Liquidation price"
              value={quote.liqPrice === null ? "None at 1x" : `${sideWord} ${formatCents(quote.liqPrice)}`}
              tone={quote.liqPrice === null ? undefined : "text-acc"}
            />
          </dl>
          {quote.liqPrice !== null && (
            <p className="mt-3 text-xs leading-relaxed text-haze">
              If {sideWord} falls from {formatCents(price)} to {formatCents(quote.liqPrice)}, the position closes and the margin is
              lost. Borrow fee accrues hourly.
            </p>
          )}
        </div>

        <div aria-live="polite" className="space-y-1">
          {error && (
            <p role="alert" className="text-xs text-down">
              {error}
            </p>
          )}
          {errorTx && <TxLink tx={errorTx} />}
        </div>

        {!connected ? (
          <>
            <button
              type="button"
              onClick={() => setVisible(true)}
              className="flex h-14 w-full items-center justify-center rounded bg-plum text-base font-bold text-fg transition-[background-color,transform] hover:bg-cocoa active:scale-[0.98]"
            >
              Connect wallet to bet
            </button>
            <p className="text-center text-[11px] text-haze">Bets settle in kUSD on Sui testnet.</p>
          </>
        ) : !snap ? (
          <button type="button" disabled className="flex h-14 w-full items-center justify-center rounded bg-fg/10 text-base font-bold text-muted">
            {account.error ?? "Reading your account"}
          </button>
        ) : !ready ? (
          <EnableTrading key={snap.owner} snap={snap} wallet={wallet} onDone={() => void reload()} />
        ) : (
          <>
            <button
              type="button"
              onClick={submit}
              disabled={Boolean(blocked) || pending || !live}
              className={cn(
                "group/bet relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded text-base font-bold",
                "transition-[transform,box-shadow,background-color] duration-150 ease-enter active:translate-y-px active:scale-[0.97]",
                "disabled:cursor-not-allowed disabled:bg-fg/10 disabled:text-muted disabled:shadow-none",
                yes
                  ? "bg-up text-ink shadow-[0_12px_32px_-12px_rgb(var(--up)/0.7)] hover:bg-up/90"
                  : "bg-down text-fg shadow-[0_12px_32px_-12px_rgb(var(--down)/0.7)] hover:bg-down/90",
              )}
            >
              {pending ? (
                "Approve in your wallet"
              ) : !live ? (
                onChain ? "Loading pool" : "Demo market"
              ) : blocked ? (
                blocked
              ) : (
                <>
                  Buy {sideWord} <span className="num opacity-80">{formatLeverage(lev)}</span>
                </>
              )}
            </button>
            {balance !== null && balance < minTrade ? (
              <p className="text-center text-[11px] text-haze">
                Your trading balance is empty.{" "}
                <Link href="/portfolio" className="font-semibold text-acc underline decoration-acc/30 underline-offset-4">
                  Add funds
                </Link>
              </p>
            ) : (
              <p className="text-center text-[11px] text-haze">Approve each bet in your Sui wallet.</p>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {confirmed && <BetConfirmation key={confirmed.signature} bet={confirmed} question={market.question} onDone={dismiss} />}
      </AnimatePresence>
    </Panel>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("num", tone ?? "text-fg")}>{value}</dd>
    </div>
  );
}
