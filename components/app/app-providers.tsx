"use client";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { MotionProvider } from "@/app/providers";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { dAppKit, WalletModal } from "./wallet-runtime";
import { FaucetProvider } from "./faucet-provider";
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;
export function AppProviders({ children }: { children: ReactNode }) {
  const body=<MotionProvider><SmoothScroll />{children}</MotionProvider>;
  const content = <DAppKitProvider dAppKit={dAppKit}><WalletModal>{convex ? <FaucetProvider>{body}</FaucetProvider> : body}</WalletModal></DAppKitProvider>;
  return convex ? <ConvexProvider client={convex}>{content}</ConvexProvider> : content;
}
