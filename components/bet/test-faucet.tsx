"use client";
import { useEffect, useRef } from "react";
import type { TradeWallet } from "@/lib/trade";
import { transactionUrl } from "@/lib/sui/config";
import { useNow } from "@/hooks/use-now";
import { useTestFaucet } from "@/components/app/faucet-provider";
function countdown(ms:number){const seconds=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(seconds/3600).toString().padStart(2,"0")}:${Math.floor(seconds/60%60).toString().padStart(2,"0")}:${(seconds%60).toString().padStart(2,"0")}`;}
export function TestFaucet({wallet,onDone,standalone=false}:{wallet:TradeWallet|null;onDone:()=>void;standalone?:boolean}){
  const faucet=useTestFaucet();
  const now=useNow(1000);
  const refreshed=useRef<string|null>(null);
  const remaining=now===null?0:Math.max(0,faucet.nextClaimAt-now*1000);
  const waiting=faucet.nextClaimAt>0&&(now===null||remaining>0);
  useEffect(()=>{
    if(faucet.result?.state==="sent"&&faucet.digest&&refreshed.current!==faucet.digest){refreshed.current=faucet.digest;onDone();}
  },[faucet.result,faucet.digest,onDone]);
  return <section className={standalone?undefined:"mt-3 border-t border-line/10 pt-3"} aria-label="Daily kUSD faucet">
    <h3 className="text-sm font-bold text-fg">Daily kUSD faucet</h3>
    <p className="mt-1 text-xs leading-relaxed text-muted">Your first 100 kUSD arrives automatically when you connect. Get another 100 every 24 hours. No wallet approval or SUI gas needed to claim.</p>
    <button type="button" disabled={!wallet||!faucet.available||faucet.pending||waiting} onClick={()=>{void faucet.claim();}} className="mt-3 h-10 w-full rounded bg-acc px-4 text-sm font-bold text-acc-ink hover:bg-acc-hover disabled:cursor-not-allowed disabled:opacity-50">
      {!wallet?"Connect wallet to claim":faucet.pending?"Sending 100 kUSD…":waiting?`Next claim in ${countdown(remaining)}`:"Claim 100 kUSD"}
    </button>
    <div aria-live="polite">
      {faucet.result?.state==="sent"&&<p className="mt-2 text-xs text-online">100 kUSD sent to your wallet.</p>}
      {(faucet.result?.state==="error"||faucet.result?.state==="retry")&&<p role="alert" className="mt-2 text-xs text-down">{faucet.result.message}</p>}
      {faucet.digest&&<a href={transactionUrl(faucet.digest)} target="_blank" rel="noopener noreferrer" className="mt-2 block text-[11px] text-haze underline">View faucet transaction</a>}
    </div>
    <p className="mt-2 text-[11px] text-haze">Testnet only. kUSD has no monetary value.</p>
  </section>;
}
