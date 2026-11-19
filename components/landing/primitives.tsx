"use client";

import { AnimatePresence, motion } from "motion/react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 7000;
const EASE = [0.23, 1, 0.32, 1] as const;

interface Tab {
  title: string;
  body: string;
  art: string;
  visual: (props: { play: boolean }) => ReactNode;
}

/* ── Shared bits ─────────────────────────────────────────────────────── */

function Card({ eyebrow, title, aside, children, className }: { eyebrow: string; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative w-full max-w-[30rem] rounded-xl bg-cocoa p-5 text-fg shadow-[0_40px_80px_-30px_rgb(var(--plum)/0.6)] sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-micro uppercase text-muted">{eyebrow}</p>
          <p className="mt-1.5 text-lg font-bold leading-tight tracking-[-0.02em] sm:text-xl">{title}</p>
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Tag({ tone, children }: { tone: "up" | "down" | "acc"; children: ReactNode }) {
  const cls = { up: "bg-up/15 text-up", down: "bg-down/15 text-down", acc: "bg-acc text-acc-ink" }[tone];
  return <span className={cn("shrink-0 rounded-sm px-2 py-1 text-xs font-bold", cls)}>{children}</span>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "acc" }) {
  return (
    <div>
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cn("num mt-0.5 text-[15px]", tone === "up" && "text-up", tone === "down" && "text-down", tone === "acc" && "text-acc")}>{value}</p>
    </div>
  );
}

/* ── 1. pm-AMM: the real curve ───────────────────────────────────────── */

const cdf = (z: number) => {
  // Abramowitz-Stegun erf, plenty for a drawing.
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
};
const W = 320;
const H = 150;
const curve = Array.from({ length: 61 }, (_, i) => {
  const z = -3 + (i / 60) * 6;
  return [(i / 60) * W, H - cdf(z) * H] as const;
});
const curvePath = curve.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

function AmmVisual({ play }: { play: boolean }) {
  // The trade walks z from 0.30 (62%) to 0.95 (83%) and back.
  const zs = [0.31, 0.55, 0.8, 0.95, 0.31];
  const xs = zs.map((z) => ((z + 3) / 6) * W);
  const ys = zs.map((z) => H - cdf(z) * H);
  return (
    <Card eyebrow="Live quote" title="Fed cuts in March" aside={<Tag tone="up">YES 62¢</Tag>}>
      <svg viewBox={`-6 -6 ${W + 12} ${H + 20}`} className="w-full" role="img" aria-label="pm-AMM price curve">
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1={0} x2={W} y1={H - p * H} y2={H - p * H} stroke="rgb(var(--line) / 0.07)" />
        ))}
        <path d={`${curvePath} L${W} ${H} L0 ${H} Z`} fill="rgb(var(--petal) / 0.08)" />
        <motion.path
          d={curvePath}
          fill="none"
          stroke="rgb(var(--petal))"
          strokeWidth={2.5}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: EASE }}
        />
        <motion.line
          x1={xs[0]}
          x2={xs[0]}
          y1={H}
          y2={ys[0]}
          stroke="rgb(var(--acc) / 0.5)"
          strokeDasharray="3 4"
          animate={play ? { x1: xs, x2: xs, y2: ys } : undefined}
          transition={{ duration: 5, times: [0, 0.25, 0.5, 0.75, 1], ease: "easeInOut", repeat: Infinity }}
        />
        <motion.rect
          width={12}
          height={12}
          rx={3}
          fill="rgb(var(--acc))"
          x={xs[0] - 6}
          y={ys[0] - 6}
          animate={play ? { x: xs.map((x) => x - 6), y: ys.map((y) => y - 6) } : undefined}
          transition={{ duration: 5, times: [0, 0.25, 0.5, 0.75, 1], ease: "easeInOut", repeat: Infinity }}
        />
        <text x={0} y={H + 14} className="fill-muted text-[10px]">NO wins</text>
        <text x={W} y={H + 14} textAnchor="end" className="fill-muted text-[10px]">YES wins</text>
      </svg>
      <div className="mt-4 flex h-2 overflow-hidden rounded-sm">
        <motion.div className="bg-up" initial={{ width: "50%" }} animate={{ width: "62%" }} transition={{ duration: 1, ease: EASE }} />
        <div className="flex-1 bg-down" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Buy $500" value="+0.8¢" tone="acc" />
        <Stat label="Pool cash" value="$64,000" />
        <Stat label="Fee" value="0.5%" />
      </div>
    </Card>
  );
}

/* ── 2. Leverage: meter + stacked notional ───────────────────────────── */

function LeverageVisual({ play }: { play: boolean }) {
  const steps = [1, 2, 3, 4, 5];
  return (
    <Card eyebrow="Open position" title="BTC above $70,000" aside={<Tag tone="up">YES 3x</Tag>}>
      <div className="flex items-end gap-1.5" aria-label="Leverage 3x of 5x">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div className="flex h-16 items-end overflow-hidden rounded-sm bg-panel-deep">
              <motion.div
                className={cn("w-full", s <= 3 ? "bg-acc" : "bg-fg/10")}
                initial={{ height: "8%" }}
                animate={{ height: s <= 3 ? `${30 + s * 22}%` : `${18 + s * 6}%` }}
                transition={{ duration: 0.6, delay: play ? i * 0.12 : 0, ease: EASE }}
              />
            </div>
            <p className={cn("num mt-1.5 text-center text-xs", s === 3 ? "text-acc" : "text-muted")}>{s}x</p>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <div className="flex justify-between text-[11px] text-muted">
          <span>Your margin $100</span>
          <span>Borrowed $200</span>
        </div>
        <div className="mt-1.5 flex h-3 overflow-hidden rounded-sm">
          <motion.div className="bg-petal" initial={{ width: 0 }} animate={{ width: "33.3%" }} transition={{ duration: 0.7, ease: EASE }} />
          <motion.div className="bg-petal/30" initial={{ width: 0 }} animate={{ width: "66.7%" }} transition={{ duration: 0.7, delay: 0.2, ease: EASE }} />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line/10 pt-4">
        <Stat label="Notional" value="$300" />
        <Stat label="Liquidation" value="0.31" tone="acc" />
        <Stat label="Payout if YES" value="$464" tone="up" />
      </div>
    </Card>
  );
}

/* ── 3. Mark vs spot: a wick that does not liquidate ─────────────────── */

const spot = [0.46, 0.47, 0.45, 0.46, 0.44, 0.45, 0.43, 0.27, 0.42, 0.44, 0.45, 0.46, 0.45, 0.47];
const markLine = spot.map((_, i) => {
  // 5 minute EMA of the spot series
  let m = spot[0] as number;
  for (let j = 1; j <= i; j++) m += 0.35 * ((spot[j] as number) - m);
  return m;
});
const toPath = (s: number[]) =>
  s.map((p, i) => `${i ? "L" : "M"}${((i / (s.length - 1)) * W).toFixed(1)} ${(H - ((p - 0.2) / 0.32) * H).toFixed(1)}`).join(" ");
const LIQ_Y = H - ((0.31 - 0.2) / 0.32) * H;

function MarkVisual({ play }: { play: boolean }) {
  return (
    <Card eyebrow="Position health" title="SUI above $5 this week" aside={<Tag tone="down">NO 2x</Tag>}>
      <svg viewBox={`-6 -6 ${W + 12} ${H + 12}`} className="w-full" role="img" aria-label="Spot price wicks below the liquidation line while the mark stays above">
        <line x1={0} x2={W} y1={LIQ_Y} y2={LIQ_Y} stroke="rgb(var(--acc))" strokeDasharray="5 5" strokeWidth={1.5} />
        <text x={W} y={LIQ_Y - 6} textAnchor="end" className="fill-acc text-[10px]">liquidation 0.31</text>
        <motion.path
          d={toPath(spot)}
          fill="none"
          stroke="rgb(var(--fg) / 0.35)"
          strokeWidth={1.5}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: play ? 1 : 1 }}
          transition={{ duration: 1.8, ease: "linear" }}
        />
        <motion.path
          d={toPath(markLine)}
          fill="none"
          stroke="rgb(var(--up))"
          strokeWidth={2.5}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, delay: 0.2, ease: "linear" }}
        />
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5 bg-fg/40" aria-hidden /> Spot, one wick to 0.27
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5 bg-up" aria-hidden /> Mark, 5 min average
        </span>
      </div>
      <motion.div
        className="mt-4 flex items-center justify-between rounded bg-up/10 px-3 py-2.5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.4, ease: EASE }}
      >
        <span className="text-sm font-bold text-up">Still open</span>
        <span className="num text-sm text-fg/80">Mark 0.43, 39% above liquidation</span>
      </motion.div>
    </Card>
  );
}

/* ── 4. Evidence bundle sealing ──────────────────────────────────────── */

const HASH = "9f3c1a7d52e8b0c4f61a29de83b7c5041e6f9a2d7c38b51e04b";

function EvidenceVisual({ play }: { play: boolean }) {
  const sources = ["ESPN final score", "Premier League match report", "Council panel, 5 of 5 agree"];
  // Each tab remounts (keyed), so the initial state is the reset.
  const [chars, setChars] = useState(play ? 0 : HASH.length);
  useEffect(() => {
    if (!play) return;
    const id = window.setInterval(() => setChars((c) => (c >= HASH.length ? c : c + 2)), 40);
    return () => window.clearInterval(id);
  }, [play]);
  return (
    <Card eyebrow="Proposal" title="Arsenal beat Chelsea" aside={<Tag tone="up">YES 97%</Tag>}>
      <ul className="space-y-2">
        {sources.map((s, i) => (
          <motion.li
            key={s}
            className="flex items-center justify-between rounded bg-panel-deep px-3 py-2.5 text-sm"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.25, duration: 0.4, ease: EASE }}
          >
            <span className="text-fg/90">{s}</span>
            <svg viewBox="0 0 16 16" className="size-4 text-up" aria-label="verified">
              <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.li>
        ))}
      </ul>
      <div className="mt-4 rounded bg-ink/60 px-3 py-2.5">
        <p className="text-[11px] text-muted">sha256 on-chain</p>
        <p className="mt-1 break-all font-mono text-[12px] leading-relaxed text-acc">
          {HASH.slice(0, chars)}
          <span className="text-fg/20">{HASH.slice(chars).replace(/./g, "0")}</span>
        </p>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-[11px] text-muted">
          <span>Dispute window</span>
          <span className="num text-fg/80">3m left</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-panel-deep">
          <motion.div className="h-full bg-acc" initial={{ width: "100%" }} animate={{ width: "20%" }} transition={{ duration: 6, ease: "linear" }} />
        </div>
      </div>
    </Card>
  );
}

/* ── 5. Agent terminal ───────────────────────────────────────────────── */

const TERMINAL: { kind: "cmd" | "out"; text: string }[] = [
  { kind: "cmd", text: "npm run agent -- quote 0x… yes 5 2" },
  { kind: "out", text: "shares 17.9   avg 0.556   liq 0.29" },
  { kind: "cmd", text: "npm run agent -- bet 0x… yes 5 2" },
  { kind: "out", text: "confirmed on Sui   tx 4hQe..9xTr" },
  { kind: "cmd", text: "npm run agent -- account" },
  { kind: "out", text: "read your on-chain balance and positions" },
];

function AgentVisual({ play }: { play: boolean }) {
  const [shown, setShown] = useState(play ? 0 : TERMINAL.length);
  useEffect(() => {
    if (!play) return;
    const id = window.setInterval(() => setShown((n) => (n >= TERMINAL.length ? n : n + 1)), 650);
    return () => window.clearInterval(id);
  }, [play]);
  return (
    <Card eyebrow="kondora-agent" title="Your model, your keys" aside={<Tag tone="acc">Local Sui signer</Tag>} className="bg-ink">
      <div className="min-h-[11.5rem] rounded bg-panel-deep p-4 font-mono text-[12px] leading-[1.9]">
        {TERMINAL.slice(0, shown).map((l, i) => (
          <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className={l.kind === "cmd" ? "text-fg" : "text-up"}>
            {l.kind === "cmd" ? <span className="text-acc">$ </span> : "  "}
            {l.text}
          </motion.p>
        ))}
        {shown < TERMINAL.length && <span className="inline-block h-3.5 w-2 translate-y-0.5 animate-pulse bg-fg/70" aria-hidden />}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Signs" value="Locally" />
        <Stat label="Caps" value="Same as you" />
        <Stat label="Board" value="Ranked" tone="acc" />
      </div>
    </Card>
  );
}

const TABS: Tab[] = [
  {
    title: "pm-AMM pricing",
    body: "Prices come from a curve built for outcomes that end at 0 or 1. Liquidity stays even across the range, so a trade at 0.90 costs what it should.",
    art: "/art/feature-split.webp",
    visual: AmmVisual,
  },
  {
    title: "Leverage up to 5x",
    body: "Your margin plus a loan from the market's lending pool. The cap tightens as the close gets near and as the price gets lopsided.",
    art: "/art/feature-lever.webp",
    visual: LeverageVisual,
  },
  {
    title: "Mark-price liquidations",
    body: "Health reads a five minute average of the pool price, not the last trade. One wick cannot take you out, and nobody can farm your liquidation.",
    art: "/art/cat/macro.webp",
    visual: MarkVisual,
  },
  {
    title: "Sealed evidence",
    body: "Each outcome ships with the sha256 of its evidence bundle: sources, fetch times, excerpts and panel reports. The hash lives on-chain next to the result.",
    art: "/art/feature-council.webp",
    visual: EvidenceVisual,
  },
  {
    title: "Bring your own agent",
    body: "Your agent builds Sui transactions and signs locally. It trades under the same caps and fees, while public endpoints provide read-only market data.",
    art: "/art/cat/tech.webp",
    visual: AgentVisual,
  },
];

/** Five primitives as vertical tabs, each with its own live visual. Autoplays; pauses on hover, focus or reduced motion. */
export function Primitives() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    const io = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.35 });
    if (rootRef.current) io.observe(rootRef.current);
    return () => {
      media.removeEventListener("change", sync);
      io.disconnect();
    };
  }, []);

  const autoplay = visible && !reduced;
  const running = autoplay && !paused;

  const select = (i: number, focus = false) => {
    const next = (i + TABS.length) % TABS.length;
    setActive(next);
    if (focus) tabRefs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, number> = { ArrowDown: active + 1, ArrowRight: active + 1, ArrowUp: active - 1, ArrowLeft: active - 1, Home: 0, End: TABS.length - 1 };
    if (e.key in keys) {
      e.preventDefault();
      select(keys[e.key] as number, true);
    }
  };

  const tab = TABS[active] as Tab;
  const Visual = tab.visual;

  return (
    <section ref={rootRef} aria-labelledby={`${id}-title`} className="page-x mx-auto max-w-[72rem] pb-24 sm:pb-32">
      <h2 id={`${id}-title`} className="text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.035em] text-cocoa">
        What runs under every trade
      </h2>

      <div
        className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-8"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <div role="tablist" aria-orientation="vertical" aria-label="Primitives" className="flex flex-col">
          {TABS.map((t, i) => {
            const selected = i === active;
            return (
              <div key={t.title} className="border-b border-cocoa/10">
                <button
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  role="tab"
                  id={`${id}-tab-${i}`}
                  aria-selected={selected}
                  aria-controls={`${id}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(i)}
                  onKeyDown={onKeyDown}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-sm px-2 py-4 text-left text-lg tracking-[-0.01em] transition-colors sm:text-xl",
                    selected ? "text-cocoa" : "text-mauve/80 hover:text-cocoa",
                  )}
                >
                  <span className={cn("num text-xs transition-colors", selected ? "text-petal-hot" : "text-mauve/50")}>0{i + 1}</span>
                  {t.title}
                </button>
                {selected && (
                  <div className="px-2 pb-4">
                    <p className="text-sm leading-relaxed text-mauve">{t.body}</p>
                    <div className="mt-4 h-px w-full bg-cocoa/10" aria-hidden>
                      {autoplay && (
                        <div
                          key={active}
                          className="site-progress h-px w-full bg-cocoa"
                          style={{ animationDuration: `${AUTOPLAY_MS}ms`, animationPlayState: running ? "running" : "paused" }}
                          onAnimationEnd={() => select(active + 1)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-tab-${active}`}
          className="relative grid min-h-[26rem] place-items-center overflow-hidden rounded-xl bg-blush px-4 py-12 sm:min-h-[32rem] sm:px-10"
        >
          <AnimatePresence initial={false}>
            <motion.img
              key={tab.art}
              src={tab.art}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 w-[22rem] max-w-none sm:-right-10 sm:-top-10 sm:w-[26rem]"
              style={{ maskImage: "radial-gradient(closest-side, black 45%, transparent 100%)", WebkitMaskImage: "radial-gradient(closest-side, black 45%, transparent 100%)" }}
              initial={{ opacity: 0, scale: 1.06, rotate: -4 }}
              animate={{ opacity: 0.55, scale: 1, rotate: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: EASE }}
            />
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              className="relative flex w-full justify-center"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <Visual play={!reduced} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
