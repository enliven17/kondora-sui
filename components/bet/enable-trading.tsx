"use client";

const LAMPORTS_PER_SOL = 1_000_000_000;
import { useId, useState } from "react";

import { useFeedback } from "@/hooks/use-feedback";
import type { AccountSnapshot } from "@/lib/account";
import { formatNumber } from "@/lib/format";
import { amm } from "@/lib/kondora";
import type { TradeWallet, TxLink as TxLinkData } from "@/lib/trade";
import { enableTrading } from "@/lib/trade-lazy";
import { cn } from "@/lib/utils";
import { TxLink } from "./tx-link";
import { TestFaucet } from "./test-faucet";

export const kUSD_FAUCET = "https://sui.kondora.xyz/portfolio";
export const SOL_FAUCET = "https://faucet.sui.io/?network=testnet";
/** Rent for the account, session token and delegation buffers, plus the session top-up. */
const MIN_SOL = 0.01;

export function FaucetLinks({ usdc, sol, className }: { usdc: boolean; sol: boolean; className?: string }) {
  if (!usdc && !sol) return null;
  const link = "font-semibold text-acc underline decoration-acc/30 underline-offset-4 hover:decoration-acc";
  return (
    <p className={cn("text-xs leading-relaxed text-muted", className)}>
      {sol && (
        <>
          Your wallet needs testnet SUI for fees.{" "}
          <a href={SOL_FAUCET} target="_blank" rel="noopener noreferrer" className={link}>
            Get testnet SUI
          </a>
          {usdc ? " " : ""}
        </>
      )}
      {usdc && (
        <>
          You need testnet kUSD to bet.{" "}
          <a href={kUSD_FAUCET} target="_blank" rel="noopener noreferrer" className={link}>
            Open the kUSD faucet
          </a>{" "}
          Mint free kUSD below.
        </>
      )}
    </p>
  );
}

function Step({ label, done, note }: { label: string; done: boolean; note: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("text-right", done ? "text-online" : "text-fg/85")}>{done ? "Done" : note}</dd>
    </div>
  );
}

/**
 * The step before the first bet: create the account, deposit, make a session key and
 * move the account into the rollup. One wallet approval.
 */
export function EnableTrading({ snap, wallet, onDone }: { snap: AccountSnapshot; wallet: TradeWallet | null; onDone: () => void }) {
  const walletUsdc = amm.usdc(snap.usdc);
  const balance = amm.usdc(snap.user?.balance ?? 0n);
  const [amountText, setAmountText] = useState(() => String(Math.floor(Math.min(walletUsdc, 25) * 100) / 100));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<TxLinkData | null>(null);
  const { success } = useFeedback();
  const inputId = useId();

  const sol = snap.lamports / LAMPORTS_PER_SOL;
  const amount = Number.parseFloat(amountText) || 0;
  const needsSol = sol < MIN_SOL;
  const needsUsdc = walletUsdc <= 0 && balance <= 0;
  const overWallet = amount > walletUsdc;
  const blocked = needsSol ? "Get testnet SUI first" : overWallet ? "Above your wallet kUSD" : amount <= 0 && balance <= 0 ? "Enter a deposit" : null;

  const submit = async () => {
    if (!wallet || blocked || pending) return;
    setPending(true);
    setError(null);
    setTx(null);
    const result = await enableTrading({ wallet, snap, deposit: amount });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setTx(result.tx ?? null);
      onDone();
      return;
    }
    success();
    setTx(result.tx);
    onDone();
  };

  return (
    <section aria-labelledby="enable-title" className="rounded-lg border border-acc/25 bg-panel-deep/80 p-4">
      <h3 id="enable-title" className="text-base font-bold text-fg">
        Enable trading
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Create a Sui trading account and deposit test kUSD. Your wallet approves each transaction.
      </p>

      <dl className="mt-3 space-y-1.5 border-t border-line/10 pt-3 text-sm">
        <Step label="Account" done={snap.exists} note="Create" />
        
        <Step label="Trading mode" done={snap.exists} note="Sui shared account" />
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">Wallet</dt>
          <dd className="num text-fg/85">
            {formatNumber(walletUsdc)} kUSD, {sol.toFixed(3)} SOL
          </dd>
        </div>
      </dl>

      <label htmlFor={inputId} className="app-label mt-4 block">
        Deposit
      </label>
      <div
        className={cn(
          "mt-2 flex items-center rounded border bg-panel transition-colors focus-within:border-line/30",
          overWallet ? "border-down/70" : "border-line/10",
        )}
      >
        <input
          id={inputId}
          inputMode="decimal"
          type="number"
          min={0}
          step="1"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          aria-invalid={overWallet || undefined}
          className="num h-11 w-full min-w-0 bg-transparent px-3 text-lg text-fg focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setAmountText(String(walletUsdc))}
          className="mr-2 h-7 rounded-sm bg-fg/5 px-2 text-xs font-semibold text-muted hover:bg-fg/10 hover:text-fg"
        >
          Max
        </button>
        <span className="pr-3 text-sm font-medium text-haze">kUSD</span>
      </div>
      {balance > 0 && <p className="mt-1 text-xs text-haze">Already in your account: {formatNumber(balance)} kUSD.</p>}

      <FaucetLinks usdc={needsUsdc} sol={needsSol} className="mt-3" />
      <TestFaucet wallet={wallet} onDone={onDone} />

      <button
        type="button"
        onClick={submit}
        disabled={!wallet || Boolean(blocked) || pending}
        className="mt-4 flex h-12 w-full items-center justify-center rounded bg-acc text-sm font-bold text-acc-ink transition-[background-color,transform] hover:bg-acc-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-fg/10 disabled:text-muted"
      >
        {pending ? "Approve in your wallet" : (blocked ?? "Enable trading")}
      </button>

      <div aria-live="polite" className="mt-2 space-y-1">
        {error && (
          <p role="alert" className="text-xs text-down">
            {error}
          </p>
        )}
        {tx && <TxLink tx={tx} />}
      </div>
    </section>
  );
}
