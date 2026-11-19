"use client";
import { useAction, useQuery } from "convex/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/convex";
import type { FaucetResult } from "@/lib/faucet";
import { useSuiWallet } from "./wallet-runtime";
type FaucetContextValue = { available: boolean; address: string | null; pending: boolean; result: FaucetResult | null;
  nextClaimAt: number; claimedAt: number | null; digest?: string; claim: () => Promise<void> };
const defaultValue: FaucetContextValue = {available:false,address:null,pending:false,result:null,nextClaimAt:0,claimedAt:null,claim:async()=>{}};
const FaucetContext = createContext<FaucetContextValue>(defaultValue);
export const useTestFaucet = () => useContext(FaucetContext);
export function FaucetProvider({children}:{children:ReactNode}) {
  const { publicKey }=useSuiWallet();
  const request=useAction(api.faucet.claim);
  const status=useQuery(api.faucetStore.status,publicKey?{address:publicKey}:"skip");
  const [state,setState]=useState<{address:string|null;pending:boolean;result:FaucetResult|null}>({address:null,pending:false,result:null});
  const busy=useRef(false);
  const addressRef=useRef(publicKey);
  useEffect(()=>{addressRef.current=publicKey;},[publicKey]);
  const deliver=useCallback(async(address:string,welcomeOnly:boolean)=>{
    if(busy.current)return;
    busy.current=true;
    setState({address,pending:true,result:null});
    try {
      let result:FaucetResult={state:"retry"};
      for(let attempt=0;attempt<4;attempt++) {
        if(addressRef.current!==address)return;
        result=await request({address,welcomeOnly});
        if(result.state!=="retry")break;
        if(attempt<3)await new Promise(resolve=>setTimeout(resolve,8000));
      }
      if(addressRef.current===address){
        setState({address,pending:false,result});
        if(result.state==="sent"||result.state==="cooldown")window.dispatchEvent(new Event("kondora:refresh"));
      }
    } catch {
      if(addressRef.current===address)setState({address,pending:false,result:{state:"error",message:"Faucet unavailable. Please try again."}});
    } finally {busy.current=false;}
  },[request]);
  useEffect(()=>{
    if(!publicKey||status!==null)return;
    let cancelled=false;
    const start=async()=>{
      while(busy.current&&!cancelled&&addressRef.current===publicKey)await new Promise(resolve=>setTimeout(resolve,200));
      if(!cancelled&&addressRef.current===publicKey)await deliver(publicKey,true);
    };
    const timer=setTimeout(()=>{void start();},200);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[publicKey,status,deliver]);
  const visible=state.address===publicKey?state:null;
  return <FaucetContext.Provider value={{available:true,address:publicKey,pending:visible?.pending??false,result:visible?.result??null,
    nextClaimAt:Math.max(status?.nextClaimAt??0,visible?.result?.nextClaimAt??0),claimedAt:status?.claimedAt??null,digest:visible?.result?.digest??status?.digest,
    claim:async()=>{if(publicKey)await deliver(publicKey,false);}}}>{children}</FaucetContext.Provider>;
}
