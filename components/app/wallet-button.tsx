"use client";

import { useSuiWallet as useWallet, useWalletModal } from "./wallet-runtime";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

import { loadWallet } from "./wallet-loader";

/** Warm the wallet chunk the moment a click looks likely; the click itself opens the modal. */
const warmWallet = () => void loadWallet().catch(() => undefined);

const noopSubscribe = () => () => {};

function shorten(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={cn("size-4", className)} fill="none">
      <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5V7" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="6.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="12.5" y="10" width="2.5" height="2.5" rx="0.5" fill="currentColor" />
    </svg>
  );
}

const base =
  "inline-flex h-10 select-none items-center justify-center gap-2 rounded px-3.5 text-sm font-semibold transition-[background-color,transform] duration-200 ease-enter active:scale-[0.98] disabled:opacity-50";

const tones = {
  plum: "bg-plum text-fg hover:bg-cocoa border border-line/10",
  accent: "bg-acc text-acc-ink hover:bg-acc-hover",
} as const;

export interface WalletButtonProps {
  className?: string;
  tone?: keyof typeof tones;
  /** Label when disconnected. */
  label?: string;
  /** Shorter label below the sm breakpoint. */
  shortLabel?: string;
}

/** Connect button for the app. Opens the wallet-adapter modal; connected state shows a small menu. */
export function WalletButton({ className, tone = "plum", label = "Connect wallet", shortLabel }: WalletButtonProps) {
  const { publicKey, connecting, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Wallet state only exists in the browser; render the neutral label on the server.
  if (!mounted || !publicKey) {
    const busy = mounted && connecting;
    return (
      <button
        type="button"
        className={cn(base, tones[tone], className)}
        onPointerEnter={warmWallet}
        onFocus={warmWallet}
        onClick={() => setVisible(true)}
        disabled={busy}
      >
        <WalletIcon />
        {busy ? (
          "Connecting"
        ) : shortLabel ? (
          <>
            <span className="sr-only xs:hidden">{label}</span>
            <span className="hidden xs:inline sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </button>
    );
  }

  const address = publicKey;
  const item = "w-full rounded-sm px-3 py-2 text-left text-sm text-fg/85 transition-colors hover:bg-fg/5 hover:text-fg";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(base, tones[tone], "font-mono text-[13px] font-medium", className)}
      >
        {wallet?.adapter.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wallet.adapter.icon} alt="" width={16} height={16} className="size-4" />
        ) : (
          <WalletIcon />
        )}
        {shorten(address)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-line/10 bg-panel/95 p-1 shadow-2xl backdrop-blur-xl">
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => {
              void navigator.clipboard?.writeText(address);
              setOpen(false);
            }}
          >
            Copy address
          </button>
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              setVisible(true);
            }}
          >
            Change wallet
          </button>
          <button
            role="menuitem"
            type="button"
            className={cn(item, "text-down hover:text-down")}
            onClick={() => {
              setOpen(false);
              void disconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
