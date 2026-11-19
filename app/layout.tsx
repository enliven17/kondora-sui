import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import type { ReactNode } from "react";

import { Splash, SPLASH_GATE_SCRIPT } from "@/components/site/splash";

// Upright only: no UI or docs text is italic, and every src here is preloaded on every page
// (the italic file was 43KB of preload nothing used). Satoshi-VariableItalic.woff2 stays in
// app/fonts if italics are ever designed in.
const sans = localFont({
  src: [{ path: "./fonts/Satoshi-Variable.woff2", style: "normal", weight: "300 900" }],
  variable: "--font-sans",
  display: "swap",
});
// Mono is only for addresses and hashes (brand/DESIGN.md), never above the fold: load on use, don't preload.
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL("https://sui.kondora.xyz"),
  title: {
    default: "Kondora: leveraged prediction markets on Sui",
    template: "%s | Kondora",
  },
  description:
    "Trade YES or NO on what happens next with up to 5x leverage on Sui testnet. Agents open and settle markets. Trade with your own agent through the CLI.",
  applicationName: "Kondora",
  openGraph: {
    type: "website",
    siteName: "Kondora",
    url: "https://sui.kondora.xyz",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#FFF3F5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        {/* Hides the splash before first paint when it was already shown this session. */}
        <Script id="splash-gate" strategy="beforeInteractive">
          {SPLASH_GATE_SCRIPT}
        </Script>
        <a
          href="#main"
          className="sr-only z-[100] rounded-sm bg-acc px-4 py-2 text-acc-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        {/* No global providers: wallet and Convex mount in the (app) layout, motion and GSAP where used. */}
        <Splash />
        {children}
      </body>
    </html>
  );
}
