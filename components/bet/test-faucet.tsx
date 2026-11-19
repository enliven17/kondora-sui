"use client";
import { useState } from "react";
import type { TradeWallet } from "@/lib/trade";
import { mintTestCollateral } from "@/lib/trade";
import { TxLink } from "./tx-link";
import type { TradeResult } from "@/lib/trade";
export function TestFaucet({ wallet, onDone }: { wallet: TradeWallet | null; onDone: () => void }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);
  return <div className="mt-3 border-t border-line/10 pt-3">
    <button type="button" disabled={!wallet || pending} className="text-xs font-semibold text-acc underline underline-offset-4 disabled:opacity-50" onClick={async () => {
      if (!wallet) return; setPending(true); setResult(null);
      const next = await mintTestCollateral(wallet); setResult(next); setPending(false); onDone();
    }}>{pending ? "Approve faucet in wallet" : "Mint 1,000 free test kUSD"}</button>
    <p className="mt-1 text-[11px] text-haze">Testnet only. kUSD has no monetary value.</p>
    {result && (result.ok ? <TxLink tx={result.tx} /> : <p role="alert" className="mt-1 text-xs text-down">{result.error}</p>)}
  </div>;
}
