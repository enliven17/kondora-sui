"use client";
import { useCallback, useEffect, useState } from "react";
import { useSuiWallet } from "@/components/app/wallet-runtime";
import type { AccountSnapshot } from "@/lib/account";
import { readAccount } from "@/lib/trade-lazy";

export function useKondoraAccount() {
  const { publicKey, trader } = useSuiWallet();
  const [state, setState] = useState<{ snap: AccountSnapshot | null; loading: boolean; error: string | null }>({ snap: null, loading: false, error: null });
  const reload = useCallback(async () => {
    if (!publicKey) return;
    try {
      const snap = await readAccount(publicKey);
      setState({ snap, loading: false, error: null });
    } catch { setState((old) => ({ ...old, loading: false, error: "Could not read your Sui account. Retrying." })); }
  }, [publicKey]);
  useEffect(() => {
    if (!publicKey) return;
    let active = true;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const snap = await readAccount(publicKey);
        if (active) setState({ snap, loading: false, error: null });
      } catch { if (active) setState((old) => ({ ...old, loading: false, error: "Could not read your Sui account. Retrying." })); }
    };
    void refresh();
    const timer = setInterval(refresh, 5000);
    window.addEventListener("kondora:refresh", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("kondora:refresh", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [publicKey]);
  const snap = state.snap?.owner === publicKey ? state.snap : null;
  return { snap, wallet: trader, ready: Boolean(snap?.exists), connected: Boolean(publicKey), reload,
    loading: Boolean(publicKey && !snap && !state.error), error: publicKey ? state.error : null };
}
