"use client";

const LAMPORTS_PER_SOL = 1_000_000_000;
import { useId, useState } from "react";

import { FaucetLinks } from "@/components/bet/enable-trading";
import { TxLink } from "@/components/bet/tx-link";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { AccountSnapshot } from "@/lib/account";
import { formatNumber } from "@/lib/format";
import { amm } from "@/lib/kondora";
import type { TradeResult, TradeWallet, TxLink as TxLinkData } from "@/lib/trade";
import { enableTrading, withdraw } from "@/lib/trade-lazy";
import { cn } from "@/lib/utils";

type Busy = "deposit" | "withdraw" | null;

/** Move kUSD between the wallet and the trading account. */
export function FundsPanel({ snap, wallet, onDone }: { snap: AccountSnapshot; wallet: TradeWallet | null; onDone: () => void }) {
  const [amountText, setAmountText] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error"; tx?: TxLinkData } | null>(null);
  const inputId = useId();

  const walletUsdc = amm.usdc(snap.usdc);
  const balance = amm.usdc(snap.user?.balance ?? 0n);
  const amount = Number.parseFloat(amountText) || 0;
  const sol = snap.lamports / LAMPORTS_PER_SOL;

  const run = async (kind: Exclude<Busy, null>) => {
    if (!wallet || busy || amount <= 0) return;
    setBusy(kind);
    setMessage(null);
    const result: TradeResult =
      kind === "deposit" ? await enableTrading({ wallet, snap, deposit: amount }) : await withdraw({ wallet, snap, amount });
    setBusy(null);
    onDone();
    if (!result.ok) {
      setMessage({ text: result.error, tone: "error", tx: result.tx });
      return;
    }
    setAmountText("");
    setMessage({ text: kind === "deposit" ? `Deposited ${formatNumber(amount)} kUSD.` : `Withdrew ${formatNumber(amount)} kUSD to your wallet.`, tone: "ok", tx: result.tx });
  };

  const button = "h-11 rounded px-4 text-sm font-bold transition-[background-color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <Panel as="section" aria-labelledby="funds-title" className="overflow-hidden">
      <PanelHeader id="funds-title" title="Funds" />
      <div className="space-y-3 p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-haze">Wallet</dt>
            <dd className="num mt-0.5 text-fg">{formatNumber(walletUsdc)} kUSD</dd>
          </div>
          <div>
            <dt className="text-xs text-haze">Trading account</dt>
            <dd className="num mt-0.5 text-fg">{formatNumber(balance)} kUSD</dd>
          </div>
        </dl>

        <label htmlFor={inputId} className="app-label block">
          Amount
        </label>
        <div className="flex items-center rounded border border-line/10 bg-panel-deep focus-within:border-line/30">
          <input
            id={inputId}
            inputMode="decimal"
            type="number"
            min={0}
            step="1"
            placeholder="0"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            className="num h-11 w-full min-w-0 bg-transparent px-3 text-lg text-fg placeholder:text-haze focus:outline-none"
          />
          <span className="pr-3 text-sm font-medium text-haze">kUSD</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => run("deposit")}
            disabled={!wallet || Boolean(busy) || amount <= 0 || amount > walletUsdc}
            className={cn(button, "bg-acc text-acc-ink hover:bg-acc-hover")}
          >
            {busy === "deposit" ? "Approve in wallet" : amount > walletUsdc ? "Above wallet" : "Deposit"}
          </button>
          <button
            type="button"
            onClick={() => run("withdraw")}
            disabled={!wallet || Boolean(busy) || amount <= 0 || amount > balance}
            className={cn(button, "bg-fg/10 text-fg hover:bg-fg/15")}
          >
            {busy === "withdraw" ? "Approve in wallet" : amount > balance ? "Above balance" : "Withdraw"}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-haze">
          Deposits and withdrawals execute directly on Sui testnet with a wallet approval.
        </p>
        <FaucetLinks usdc={walletUsdc <= 0} sol={sol < 0.01} />
        <div aria-live="polite" className="space-y-1">
          {message && (
            <p role={message.tone === "error" ? "alert" : undefined} className={cn("text-xs", message.tone === "error" ? "text-down" : "text-online")}>
              {message.text}
            </p>
          )}
          {message?.tx && <TxLink tx={message.tx} />}
        </div>
      </div>
    </Panel>
  );
}
