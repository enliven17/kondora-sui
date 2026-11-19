// Wallet modal base styles first so the Kondora overrides in app.css win.

import "./app.css";

import type { ReactNode } from "react";

import { AppBackdrop } from "@/components/app/app-backdrop";
import { AppProviders } from "@/components/app/app-providers";
import { AppHeader } from "@/components/app/app-header";
import { StatsRibbon } from "@/components/app/stats-ribbon";
import { StatusBar } from "@/components/app/status-bar";
import { getSearchIndex, getStats } from "@/lib/data";
import { PreconnectConvex } from "@/lib/preconnect";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [stats, searchItems] = await Promise.all([getStats(), getSearchIndex()]);

  return (
    <AppProviders>
      <PreconnectConvex />
      <AppBackdrop />
      <AppHeader searchItems={searchItems} />
      <StatsRibbon stats={stats} />
      <main id="main" data-app-shell className="mx-auto w-full max-w-[100rem] px-3 pb-[calc(var(--app-status-h)+2rem)] pt-4 sm:px-5 sm:pt-6">
        {children}
      </main>
      <StatusBar />
    </AppProviders>
  );
}
