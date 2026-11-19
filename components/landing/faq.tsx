"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

const FAQ = [
  {
    q: "Who creates markets?",
    a: "Only the creator agent. It runs every three hours, pulls candidates from sources that can settle them (price feeds, league schedules, liquid Polymarket questions, fresh headlines), drops anything vague or harmful, writes the rules and sets the opening price.",
  },
  {
    q: "How is a market settled?",
    a: "The oracle agent reads deterministic feeds first: CoinGecko and Binance for prices, ESPN for sports, PandaScore for esports. Questions without a feed go to a council of five models from different providers. Every proposal carries a sealed evidence hash and waits out a five minute dispute window.",
  },
  {
    q: "What happens at the close if I use leverage?",
    a: "Leverage drops to 1x for new positions in the final hour. Existing positions can be closed before the deadline or claimed after settlement. Debt and interest are subtracted from proceeds; a losing leveraged position can lose all its margin.",
  },
  {
    q: "What is INVALID?",
    a: "The outcome for a market that cannot be settled cleanly: the feeds disagree, the question has no clear answer after its grace period, or a dispute stays open for 24 hours. INVALID pays YES shares at the final mark and NO shares at one minus the final mark.",
  },
  {
    q: "Can the oracle be wrong?",
    a: "It can, which is why it is checked. The oracle only proposes at 85% confidence or more. An auditor on a different model provider re-derives the outcome without seeing the proposal and challenges on-chain if it disagrees. The registry admin can rule on a dispute, or a timeout makes the market INVALID.",
  },
  {
    q: "What are the fees?",
    a: "An opening fee of 0.5% of notional and 0.02% per hour on borrowed amounts. There is no separate close fee or liquidation penalty in this Sui edition. Every wallet transaction also uses testnet SUI for gas.",
  },
  {
    q: "Can I use my own agent?",
    a: "Yes. Use the trading CLI in the repository. It builds Sui transactions and signs locally with your own key, under the same caps and fees as everyone else. The public HTTP API provides read-only data.",
  },
  {
    q: "Is this real money?",
    a: "Not yet. Kondora runs on Sui testnet with freely mintable test kUSD from the in-app faucet. Treat every number here as practice.",
  },
] as const;

function Row({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <div className="rounded bg-cocoa text-fg">
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-6 rounded px-5 py-5 text-left text-[15px] font-medium sm:px-6 sm:text-base"
        >
          {q}
          <svg
            viewBox="0 0 20 20"
            aria-hidden
            className={cn("size-5 shrink-0 text-acc transition-transform duration-300 ease-enter", open && "rotate-45")}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M10 3v14M3 10h14" />
          </svg>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-a`}
            role="region"
            aria-labelledby={`${id}-q`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-6 text-sm leading-relaxed text-muted sm:px-6 sm:text-[15px]">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section aria-labelledby="faq-title" className="page-x mx-auto grid max-w-[72rem] gap-10 pb-24 sm:pb-32 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
      <div>
        <h2 id="faq-title" className="text-[clamp(2.25rem,5.5vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.035em] text-cocoa">
          Your questions answered
        </h2>
        <p className="mt-4 text-sm text-mauve">The ones we hear most. The docs go deeper.</p>
      </div>
      <div className="space-y-2.5">
        {FAQ.map((item, i) => (
          <Row key={item.q} q={item.q} a={item.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
        ))}
      </div>
    </section>
  );
}
