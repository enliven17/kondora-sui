"use client";
import { createDAppKit, useCurrentAccount, useDAppKit, useWalletConnection, useWallets } from "@mysten/dapp-kit-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import type { TradeWallet } from "@/lib/trade";
import { sui } from "@/lib/sui/client";

export const dAppKit = createDAppKit({ networks: ["testnet"], createClient: () => sui });
declare module "@mysten/dapp-kit-react" { interface Register { dAppKit: typeof dAppKit } }

const ModalContext = createContext({ visible: false, setVisible: (open: boolean) => { void open; } });
export const useWalletModal = () => useContext(ModalContext);
export function useSuiWallet() {
  const account = useCurrentAccount();
  const kit = useDAppKit();
  const connection = useWalletConnection();
  const execute = useCallback(async (transaction: Parameters<typeof kit.signAndExecuteTransaction>[0]["transaction"]) => {
    const result = await kit.signAndExecuteTransaction({ transaction, network: "testnet" });
    if (result.FailedTransaction) throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
    return result.Transaction.digest;
  }, [kit]);
  const trader = useMemo<TradeWallet | null>(() => account ? { address: account.address, execute } : null, [account, execute]);
  return { publicKey: account?.address ?? null, connecting: connection.isConnecting, trader,
    wallet: connection.wallet ? { adapter: { icon: connection.wallet.icon } } : null,
    disconnect: () => kit.disconnectWallet() };
}
export function WalletModal({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wallets = useWallets();
  const kit = useDAppKit();
  useEffect(() => {
    if (!visible) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setVisible(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [visible]);
  return <ModalContext.Provider value={{ visible, setVisible }}>
    {children}
    {visible && <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 px-5 backdrop-blur-sm" onClick={() => setVisible(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="sui-wallet-title" className="w-full max-w-sm rounded-xl border border-line/15 bg-cocoa p-6 text-fg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 id="sui-wallet-title" className="text-xl font-bold">Connect a Sui wallet</h2><button autoFocus type="button" aria-label="Close wallet dialog" onClick={() => setVisible(false)} className="p-2 text-muted">✕</button></div>
        <p className="mt-2 text-sm text-muted">Sui testnet · Test tokens have no monetary value.</p>
        <div className="mt-5 space-y-2">{wallets.map((wallet) => <button key={wallet.name} type="button" disabled={busy} className="flex w-full items-center gap-3 rounded-lg bg-fg/5 p-3 text-left font-semibold hover:bg-fg/10 disabled:opacity-50" onClick={async () => {
          setBusy(true); setError(null);
          try { await kit.connectWallet({ wallet }); setVisible(false); } catch (e) { setError(e instanceof Error ? e.message : "Connection failed"); } finally { setBusy(false); }
        }}><Image src={wallet.icon} alt="" width={28} height={28} />{wallet.name}</button>)}</div>
        {!wallets.length && <p className="mt-4 text-sm text-muted">Install a Sui wallet such as <a href="https://slush.app" target="_blank" rel="noopener noreferrer" className="text-acc underline">Slush</a>, then reload this page.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-down">{error}</p>}
      </section>
    </div>}
  </ModalContext.Provider>;
}
