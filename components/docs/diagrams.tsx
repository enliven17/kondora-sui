"use client";

import { useId, useState, type ReactNode } from "react";

import styles from "./diagrams.module.css";

type IconName = "spark" | "trade" | "clock" | "lock" | "oracle" | "shield" | "wallet" | "layers" | "key" | "code";
const ICONS: Record<IconName, string> = {
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  trade: "M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4",
  clock: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3",
  oracle: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
  wallet: "M4 6h15v14H4V6Zm0 0 13-3v3m-2 5h6v5h-6v-5Z",
  layers: "m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5",
  key: "M14 7a5 5 0 1 1-9 3 5 5 0 0 1 9-3Zm-1 4 8 8m-3-3 2-2m-5-1 2-2",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18",
};

function Icon({ name, x = 0, y = 0, size = 20 }: { name: IconName; x?: number; y?: number; size?: number }) {
  return <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>;
}

function Frame({ number, label, subtitle, caption, children, controls, legend, pannable = true }: { number: string; label: string; subtitle: string; caption: string; children: ReactNode; controls?: ReactNode; legend?: ReactNode; pannable?: boolean }) {
  return (
    <figure className={styles.frame} aria-label={label}>
      <div className={styles.header}>
        <div><span className={styles.eyebrow}>KONDORA / {number}</span><div className={styles.title}>{label}</div><p className={styles.subtitle}>{subtitle}</p></div>
        <span className={styles.interactive}><i />Explore</span>
      </div>
      {pannable && <div className={styles.panHint}>Swipe or scroll horizontally to explore the full diagram <span aria-hidden>↔</span></div>}
      <div className={styles.canvas} tabIndex={pannable ? 0 : undefined} role="region" aria-label={`${label} diagram${pannable ? ", scroll horizontally on small screens" : ""}`} data-lenis-prevent>{children}</div>
      {legend && <div className={styles.legend}>{legend}</div>}
      {controls && <div className={styles.controls}>{controls}</div>}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function Scene({ children, height = 400, compact = false }: { children: ReactNode; height?: number; compact?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={`${styles.scene} ${compact ? styles.chartScene : ""}`} viewBox={`0 0 720 ${height}`} role="group" aria-label="Interactive protocol schematic">
      <defs>
        <pattern id={`${id}-grid`} width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="rgb(var(--petal) / .14)" /></pattern>
        <linearGradient id={`${id}-wash`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="rgb(var(--petal))" stopOpacity=".07" /><stop offset="1" stopColor="rgb(var(--petal))" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="720" height={height} fill={`url(#${id}-grid)`} />
      <rect width="720" height={height} fill={`url(#${id}-wash)`} />
      {children}
    </svg>
  );
}

function Wire({ d, active = true, tone = "pink", label, x, y }: { d: string; active?: boolean; tone?: "pink" | "green" | "gold"; label?: string; x?: number; y?: number }) {
  return <g className={styles[tone]}><path d={d} className={styles.wireBase} /><path d={d} className={`${styles.wire} ${active ? styles.flowing : ""}`} />{label && <text x={x} y={y} className={styles.wireLabel} textAnchor="middle">{label}</text>}</g>;
}

function Node({ x, y, width = 144, height = 112, title, overline, lines, icon, active = false, onClick }: { x: number; y: number; width?: number; height?: number; title: string; overline: string; lines: string[]; icon: IconName; active?: boolean; onClick?: () => void }) {
  return (
    <g transform={`translate(${x} ${y})`} className={`${styles.node} ${active ? styles.activeNode : ""}`} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} aria-label={onClick ? `${overline}: ${title}` : undefined} aria-pressed={onClick ? active : undefined} onClick={onClick} onKeyDown={onClick ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick(); } } : undefined}>
      {active && <rect x="-4" y="-4" width={width + 8} height={height + 8} rx="15" className={styles.nodeHalo} />}
      <rect width={width} height={height} rx="11" className={styles.nodeBody} />
      <rect x="12" y="12" width="28" height="28" rx="7" className={styles.iconTile} />
      <Icon name={icon} x={18} y={18} size={16} />
      <text x="49" y="30" className={styles.nodeOverline}>{overline}</text>
      <circle cx={width - 14} cy="16" r="2.5" className={active ? styles.statusOn : styles.statusOff} />
      <text x="14" y="62" className={styles.nodeTitle}>{title}</text>
      {lines.map((line, index) => <text key={line} x="14" y={83 + index * 15} className={styles.nodeDescription}>{line}</text>)}
    </g>
  );
}

function Detail({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <div className={styles.detail} aria-live="polite"><span className={styles.detailNumber}>{number}</span><div><strong>{title}</strong><p>{children}</p></div></div>;
}

function Choices({ labels, value, onChange }: { labels: string[]; value: number; onChange: (value: number) => void }) {
  return <div className={styles.choices} role="group" aria-label="Diagram view">{labels.map((label, index) => <button type="button" key={label} aria-pressed={value === index} onClick={() => onChange(index)}>{label}</button>)}</div>;
}

const STEPS: { title: string; icon: IconName; lines: string[]; detail: string }[] = [
  { title: "Create", icon: "spark", lines: ["Question + rules", "House funds liquidity"], detail: "The creator agent selects a sourced question, commits its rules on-chain, and funds the pool with House liquidity." },
  { title: "Trade", icon: "trade", lines: ["YES / NO positions", "1× to the live cap"], detail: "Deposited kUSD and optional borrowing buy outcome shares in a shared Move market. Each trade requires a wallet approval." },
  { title: "Risk cap", icon: "clock", lines: ["Final hour: 1× opens", "Full outcome reserves"], detail: "The time and price caps tighten new borrowing. Existing debt remains attached to the position until close or claim." },
  { title: "Close", icon: "lock", lines: ["Freeze final mark", "Freeze the pool mark"], detail: "Trading stops and the final executable exit value is frozen. The shared market proceeds to oracle resolution." },
  { title: "Propose", icon: "oracle", lines: ["YES / NO / INVALID", "Seal evidence hash"], detail: "The oracle derives the outcome from named sources and submits it with a SHA-256 commitment to the evidence bundle." },
  { title: "Audit", icon: "shield", lines: ["five-minute window", "Independent review"], detail: "An auditor re-derives the answer blind. A challenge requires an admin ruling or the 24-hour INVALID timeout." },
  { title: "Claim", icon: "wallet", lines: ["Finalize the outcome", "Credit your balance"], detail: "Finalized winning shares pay 1 kUSD. INVALID pays YES at the final mark and NO at its complement. Claims credit your trading balance." },
];

function Lifecycle() {
  const [step, setStep] = useState(1);
  const positions = [[24, 68], [202, 68], [380, 68], [558, 68], [558, 250], [380, 250], [202, 250]];
  const paths = ["M162 124H202m-6-4 6 4-6 4", "M340 124H380m-6-4 6 4-6 4", "M518 124H558m-6-4 6 4-6 4", "M627 180V250m-4-6 4 6 4-6", "M558 306H518m6-4-6 4 6 4", "M380 306H340m6-4-6 4 6 4"];
  return (
    <Frame number="01" label="The life of a market" subtitle="One question. Sui shared objects. Seven connected stages." caption="Select a stage to inspect it. Debt and interest are subtracted from close and claim proceeds." controls={<><Choices labels={STEPS.map((s, index) => `${index + 1}. ${s.title}`)} value={step} onChange={setStep} /><Detail number={`0${step + 1}`} title={STEPS[step]!.title}>{STEPS[step]!.detail}</Detail></>}>
      <Scene height={400}>
        <text x="24" y="30" className={styles.laneLabel}>01—04 / TRADING & EXECUTION</text><text x="202" y="224" className={styles.laneLabel}>05—07 / RESOLUTION & PAYOUT</text>
        {paths.map((path, index) => <Wire key={path} d={path} active={index < step} tone={index < step ? "gold" : "pink"} />)}
        {STEPS.map((item, index) => <Node key={item.title} x={positions[index]![0]!} y={positions[index]![1]!} width={138} title={item.title} overline={`STEP 0${index + 1}`} lines={item.lines} icon={item.icon} active={step === index} onClick={() => setStep(index)} />)}
        <circle cx="91" cy="296" r="36" className={styles.sealRing} /><circle cx="91" cy="296" r="27" className={styles.sealInner} /><text x="91" y="302" textAnchor="middle" className={styles.sealValue}>5×</text><text x="91" y="352" textAnchor="middle" className={styles.microLabel}>MAXIMUM LEVERAGE</text>
      </Scene>
    </Frame>
  );
}

function Rollup() {
  const [step, setStep] = useState(1);
  const details = ["kUSD enters the Sui vault and credits the trader's internal account. Funding requires an owner signature and testnet SUI.", "The owner-controlled shared Account stores available kUSD and positions. Owner checks protect every funding and trading action.", "Trades execute against a shared constant-product pool with wallet signatures. Network gas and opening fees apply.", "Trading stops at the deadline. Oracle proposals, disputes, finalization and claims all execute on Sui."];
  return (
    <Frame number="02" label="One protocol. Shared objects." subtitle="Follow wallet authorization through Sui Move objects." caption="Sui Move enforces ownership, full reserves, trading and settlement." controls={<><Choices labels={["01 Deposit", "02 Account", "03 Trade", "04 Settle"]} value={step} onChange={setStep} /><Detail number={`0${step + 1}`} title={["Fund on Sui", "Shared account", "Trade on Sui", "Settle on Sui"][step]!}>{details[step]}</Detail></>}>
      <Scene height={474}>
        <rect x="24" y="24" width="672" height="178" rx="16" className={styles.layerBase} /><text x="42" y="52" className={styles.laneLabel}>SUI / TESTNET</text><text x="676" y="52" textAnchor="end" className={styles.microLabel}>CUSTODY + SETTLEMENT</text>
        <Node x={42} y={72} width={188} title="kUSD vault" overline="COLLATERAL" lines={["Deposits · withdrawals", "Owner-authorized funding"]} icon="wallet" active={step === 0} />
        <Node x={266} y={72} width={188} title="Market account" overline="ON-CHAIN STATE" lines={["Question · rules · final mark", "Committed account state"]} icon="layers" active={step === 3} />
        <Node x={490} y={72} width={188} title="Resolution" overline="ORACLE + AUDIT" lines={["Evidence hash · outcome", "Finalization and payouts"]} icon="shield" active={step === 3} />
        <Wire d="M136 202V270m-5-7 5 7 5-7" active={step === 1} tone="gold" /><Wire d="M360 202V270m-5-7 5 7 5-7" active={step === 1} tone="gold" /><Wire d="M584 270V202m-5 7 5-7 5 7" active={step === 3} tone="green" />
        <text x="171" y="236" className={styles.wireLabel}>DEPOSIT ↓</text><text x="417" y="236" className={styles.wireLabel}>↑ CLAIM + WITHDRAW</text>
        <rect x="24" y="270" width="672" height="180" rx="16" className={styles.layerRollup} /><text x="42" y="298" className={styles.laneLabel}>SUI MOVE / SHARED OBJECTS</text><text x="676" y="298" textAnchor="end" className={styles.microLabel}>WALLET-SIGNED EXECUTION</text>
        <Node x={42} y={318} width={188} title="Trading account" overline="OWNER-CHECKED ACCOUNT" lines={["Balance · positions · debt", "Sui shared account state"]} icon="wallet" active={step === 1} />
        <Node x={266} y={318} width={188} title="Binary AMM pool" overline="EXECUTION ENGINE" lines={["Open · close · liquidate", "Live quotes and risk limits"]} icon="trade" active={step === 2} />
        <Node x={490} y={318} width={188} title="Wallet signer" overline="TRANSACTION AUTHORITY" lines={["Approve each transaction", "Owner check on withdrawals"]} icon="key" active={step === 2} />
        <Wire d="M230 374H266m-6-4 6 4-6 4" active={step === 2} tone="green" /><Wire d="M490 374H454m6-4-6 4 6 4" active={step === 2} tone="green" />
      </Scene>
    </Frame>
  );
}

function cdf(z: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
const curveX = (z: number) => 64 + ((z + 3) / 6) * 592;
const curveY = (p: number) => 282 - p * 228;
const CURVE = Array.from({ length: 121 }, (_, i) => `${i ? "L" : "M"}${curveX(-3 + i / 20).toFixed(2)} ${curveY(cdf(-3 + i / 20)).toFixed(2)}`).join(" ");

function Amm() {
  const [z, setZ] = useState(0.8);
  const price = cdf(z);
  const x = curveX(z);
  const y = curveY(price);
  return (
    <Frame pannable={false} number="03" label="A market expressed as a curve" subtitle="Move the pool state. Watch the two outcome prices rebalance." caption="Illustrative reserve-ratio state, not a live quote. Actual orders include fees and price impact, and are subject to pool limits." legend={<><span><i className={styles.pinkSwatch} />YES price · p(r)</span><span><i className={styles.goldSwatch} />Selected pool state</span><span>YES + NO = 1.00</span></>} controls={<><div className={styles.readouts}><div><span>YES PRICE</span><strong>{(price * 100).toFixed(1)}<small>¢</small></strong></div><div><span>NO PRICE</span><strong>{((1 - price) * 100).toFixed(1)}<small>¢</small></strong></div><div><span>POOL STATE</span><strong>{z > 0 ? "+" : ""}{z.toFixed(1)}<small> z</small></strong></div></div><label className={styles.sliderLabel}>Move pool state<input type="range" min="-2.5" max="2.5" step="0.1" value={z} onChange={(event) => setZ(Number(event.target.value))} /><span>Buy NO ← <b>z = {z.toFixed(1)}</b> → Buy YES</span></label></>}>
      <Scene height={350} compact>
        {[0, 0.25, 0.5, 0.75, 1].map((p) => <g key={p}><line x1="64" x2="656" y1={curveY(p)} y2={curveY(p)} className={styles.gridLine} /><text x="49" y={curveY(p) + 4} textAnchor="end" className={styles.axisText}>{(p * 100).toFixed(0)}¢</text></g>)}
        {[-2, -1, 0, 1, 2].map((state) => <g key={state}><line x1={curveX(state)} x2={curveX(state)} y1="54" y2="282" className={styles.gridLine} /><text x={curveX(state)} y="306" textAnchor="middle" className={styles.axisText}>{state > 0 ? "+" : ""}{state}</text></g>)}
        <path d={`${CURVE}L656 282H64Z`} className={styles.curveArea} /><path d={CURVE} className={styles.priceCurveGlow} /><path d={CURVE} className={styles.priceCurve} />
        <line x1={x} x2={x} y1={y} y2="282" className={styles.crosshair} /><line x1="64" x2={x} y1={y} y2={y} className={styles.crosshair} />
        <circle cx="360" cy="168" r="4" className={styles.ghostPoint} /><text x="345" y="191" textAnchor="end" className={styles.axisText}>50 / 50</text>
        <circle cx={x} cy={y} r="15" className={styles.pointHalo} /><circle cx={x} cy={y} r="5" className={styles.chartPoint} />
        <g className={styles.priceBadgeGroup} transform={`translate(${Math.min(566, Math.max(80, x - 44))} ${y < 94 ? y + 20 : y - 42})`}><rect width="88" height="29" rx="5" className={styles.priceBadge} /><text x="44" y="20" textAnchor="middle" className={styles.priceBadgeText}>{(price * 100).toFixed(1)}¢ YES</text></g>
        <text x="64" y="333" className={styles.microLabel}>NO MORE LIKELY</text><text x="656" y="333" textAnchor="end" className={styles.microLabel}>YES MORE LIKELY</text><text x="360" y="333" textAnchor="middle" className={styles.microLabel}>POOL STATE z</text>
      </Scene>
    </Frame>
  );
}

const WICK = [0.46, 0.47, 0.45, 0.46, 0.44, 0.45, 0.43, 0.27, 0.42, 0.44, 0.45, 0.46, 0.45, 0.47];
const TREND = [0.46, 0.46, 0.45, 0.44, 0.41, 0.38, 0.34, 0.3, 0.27, 0.26, 0.25, 0.24, 0.24, 0.24];
const markOf = (prices: number[]) => prices.reduce<number[]>((marks, price) => [...marks, marks.length ? marks[marks.length - 1]! + 0.35 * (price - marks[marks.length - 1]!) : price], []);
const riskY = (price: number) => 282 - ((price - 0.2) / 0.35) * 212;
const riskX = (index: number) => 64 + (index / 13) * 592;
const riskLine = (prices: number[]) => prices.map((price, index) => `${index ? "L" : "M"}${riskX(index).toFixed(2)} ${riskY(price).toFixed(2)}`).join(" ");

function Leverage() {
  const [leverage, setLeverage] = useState(3);
  const [scenario, setScenario] = useState(0);
  const prices = scenario ? TREND : WICK;
  const marks = markOf(prices);
  const debt = 100 * (leverage - 1);
  const shares = (100 * leverage * 0.995) / 0.45;
  const threshold = debt / (shares * 0.95);
  const unhealthy = leverage > 1 && marks.some((mark) => mark <= threshold);
  return (
    <Frame pannable={false} number="04" label="The anatomy of leverage" subtitle="Separate your capital, borrowed exposure, and the price that decides health." caption="Illustrative samples only; Move checks executable exit value. Assumes a 0.45 average fill and a 0.5% opening fee, excluding interest. Live leverage caps can be lower." legend={<><span><i className={styles.greySwatch} />Spot price</span><span><i className={styles.greenSwatch} />Exit-value estimate</span><span><i className={styles.goldSwatch} />Liquidation threshold</span></>} controls={<><Choices labels={["Brief price wick", "Sustained decline"]} value={scenario} onChange={setScenario} /><div className={styles.readouts}><div><span>YOUR MARGIN</span><strong>100<small> kUSD</small></strong></div><div><span>BORROWED</span><strong>{debt}<small> kUSD</small></strong></div><div><span>LIQUIDATION</span><strong>{leverage === 1 ? "None" : `${(threshold * 100).toFixed(1)}¢`}</strong></div></div><label className={styles.sliderLabel}>Illustrative leverage<input type="range" min="1" max="5" step="0.5" value={leverage} onChange={(event) => setLeverage(Number(event.target.value))} /><span>1× <b>{leverage.toFixed(1)}× exposure</b> 5×</span></label><div className={`${styles.health} ${unhealthy ? styles.unhealthy : ""}`} aria-live="polite"><i />{leverage === 1 ? "Fully paid shares. No debt-driven liquidation." : unhealthy ? "Exit value crosses maintenance margin in this scenario." : "Exit value stays above the liquidation threshold in this scenario."}</div></>}>
      <Scene height={354} compact>
        <text x="64" y="25" className={styles.microLabel}>CAPITAL COMPOSITION</text><text x="656" y="25" textAnchor="end" className={styles.microLabel}>{100 * leverage} kUSD NOTIONAL</text><rect x="64" y="36" width="592" height="9" rx="3" className={styles.fundingTrack} /><rect x="64" y="36" width={592 / leverage} height="9" rx="3" className={styles.fundingMargin} />
        {leverage > 1 && <rect x={64 + 592 / leverage} y="36" width={592 - 592 / leverage} height="9" rx="3" className={styles.fundingDebt} />}
        {[0.2, 0.3, 0.4, 0.5].map((p) => <g key={p}><line x1="64" x2="656" y1={riskY(p)} y2={riskY(p)} className={styles.gridLine} /><text x="49" y={riskY(p) + 4} textAnchor="end" className={styles.axisText}>{(p * 100).toFixed(0)}¢</text></g>)}
        {threshold >= 0.2 && <><rect x="64" y={riskY(threshold)} width="592" height={282 - riskY(threshold)} className={styles.riskZone} /><line x1="64" x2="656" y1={riskY(threshold)} y2={riskY(threshold)} className={styles.threshold} /><text x="650" y={riskY(threshold) + 18} textAnchor="end" className={styles.thresholdText}>LIQUIDATION · {(threshold * 100).toFixed(1)}¢</text></>}
        <path d={riskLine(prices)} className={styles.spotLine} /><path d={riskLine(marks)} className={styles.markGlow} /><path d={riskLine(marks)} className={styles.markLine} />
        <circle cx="656" cy={riskY(marks[13]!)} r="5" className={styles.markPoint} /><text x="64" y="316" className={styles.microLabel}>EARLIER</text><text x="656" y="316" textAnchor="end" className={styles.microLabel}>LATER →</text>
        <text x="360" y="342" textAnchor="middle" className={styles.axisText}>Equity = shares × mark − debt − interest</text>
      </Scene>
    </Frame>
  );
}

function Oracle() {
  const [path, setPath] = useState(0);
  const details = ["The auditor does not challenge. After the five-minute window, the proposal can be finalized and payouts become claimable.", "The auditor independently disagrees with high confidence and challenges on-chain. An arbiter runs a fresh resolution before an outcome is ruled.", "If the arbiter and auditor still disagree after 24 hours, the market resolves INVALID: YES pays the frozen final mark; NO pays its complement."];
  return (
    <Frame number="05" label="Evidence, with checks and balances" subtitle="Trace the proposal, independent audit, and alternative settlement paths." caption="Named deterministic feeds take priority. The council handles questions without a settling feed; every proposal carries an evidence commitment." controls={<><Choices labels={["No challenge", "Auditor challenges", "Dispute times out"]} value={path} onChange={setPath} /><Detail number={path === 0 ? "✓" : path === 1 ? "!" : "∅"} title={["Finalize the proposal", "Independent arbiter review", "Resolve INVALID"][path]!}>{details[path]}</Detail></>}>
      <Scene height={490}>
        <Node x={24} y={40} width={184} title="Deterministic feeds" overline="FIRST CHOICE" lines={["Prices · scores · final UMA", "Read the named source"]} icon="layers" />
        <Node x={512} y={40} width={184} title="Model council" overline="FALLBACK" lines={["Sequential reports", "Seeded reference selection"]} icon="spark" />
        <Wire d="M208 96H268m-6-4 6 4-6 4" /><Wire d="M512 96H452m6-4-6 4 6 4" />
        <rect x="268" y="60" width="184" height="76" rx="10" className={styles.evidence} /><text x="360" y="86" textAnchor="middle" className={styles.microLabel}>SEALED EVIDENCE</text><text x="360" y="111" textAnchor="middle" className={styles.hashText}>SHA-256 · 9f3c…04b</text>
        <Wire d="M360 136V192m-5-7 5 7 5-7" tone="gold" />
        <Node x={268} y={192} width={184} title="Oracle proposal" overline="ON-CHAIN COMMIT" lines={["YES / NO / INVALID", "Outcome + evidence hash"]} icon="oracle" active />
        <rect x="24" y="212" width="184" height="66" rx="10" className={styles.timerPlate} /><Icon name="clock" x={40} y={232} size={24} /><text x="76" y="237" className={styles.nodeTitle}>five minutes</text><text x="76" y="256" className={styles.nodeDescription}>Dispute window</text>
        <Wire d="M360 304V368m-5-7 5 7 5-7" active={path === 0} tone={path === 0 ? "green" : "pink"} />
        <Wire d="M208 424H268m-6-4 6 4-6 4" active={path === 0} tone="green" />
        <Wire d="M116 368V316Q116 280 152 280H268m-6-4 6 4-6 4" active={path > 0} tone="gold" />
        <Wire d="M452 248H604V368m-5-7 5 7 5-7" active={path > 0} tone="gold" label="CHALLENGE" x={558} y={323} />
        <Wire d="M512 424H452m6-4-6 4 6 4" active={path > 0} tone="gold" />
        <Node x={24} y={368} width={184} title="Blind auditor" overline="INDEPENDENT MODEL" lines={["Re-derive from evidence", "Does not see the proposal"]} icon="shield" active={path > 0} />
        <Node x={268} y={368} width={184} title={path === 0 ? "Finalize → claim" : path === 1 ? "Await a ruling" : "INVALID payout"} overline={path === 0 ? "UNCHALLENGED" : path === 1 ? "DISPUTED" : "24-HOUR TIMEOUT"} lines={path === 0 ? ["Winning shares: 1 kUSD", "Credit the trading balance"] : path === 1 ? ["Fresh resolution decides", "Claims wait for an outcome"] : ["YES: frozen final mark", "NO: 1 − final mark"]} icon={path === 1 ? "clock" : "wallet"} active={path !== 1} />
        <Node x={512} y={368} width={184} title="Arbiter review" overline="IF CHALLENGED" lines={["Fresh, independent pass", "Rule or time out to INVALID"]} icon="oracle" active={path > 0} />
      </Scene>
    </Frame>
  );
}

function Agent() {
  const [step, setStep] = useState(0);
  const descriptions = ["Read markets and request a quote, then ask the API to build an unsigned transaction for the intended action.", "Decode the returned transaction. Check the program, accounts, side, margin, leverage, and minimum output before signing.", "Your locally stored key signs the validated transaction. Neither the API nor the model endpoint needs your Sui private key.", "Submit the signed transaction to the RPC returned by the API. Confirm the signature and refresh account state before retrying."];
  return (
    <Frame number="06" label="Your strategy. Your signature." subtitle="A transaction crosses systems. Your private key does not." caption="The API builds, your agent validates and signs, and the returned RPC executes. Setup uses Sui; trading uses shared Move objects." controls={<><Choices labels={["01 Request", "02 Validate", "03 Sign", "04 Submit"]} value={step} onChange={setStep} /><Detail number={`0${step + 1}`} title={["Request a quote and transaction", "Verify the transaction intent", "Sign inside your trust boundary", "Submit and confirm"][step]!}>{descriptions[step]}</Detail></>}>
      <Scene height={420}>
        <rect x="24" y="50" width="248" height="332" rx="15" className={styles.localZone} /><text x="40" y="77" className={styles.laneLabel}>YOUR MACHINE</text><Icon name="lock" x={236} y={61} size={18} />
        <rect x="310" y="50" width="180" height="332" rx="15" className={styles.remoteZone} /><text x="326" y="77" className={styles.laneLabel}>KONDORA API</text>
        <rect x="528" y="50" width="168" height="332" rx="15" className={styles.remoteZone} /><text x="544" y="77" className={styles.laneLabel}>EXECUTION</text>
        <Node x={42} y={112} width={212} title="Your trading agent" overline="MODEL + STRATEGY" lines={["Market data → trading decision", "Locally enforced risk limits"]} icon="spark" active={step === 0} />
        <Node x={42} y={254} width={212} title="Local signer" overline="PRIVATE KEY STAYS HERE" lines={["Validate intent → sign locally", "Never sent to the API"]} icon="key" active={step === 1 || step === 2} />
        <Node x={328} y={112} width={144} title="Tx builder" overline="UNSIGNED" lines={["/markets · /quote", "/tx → payload"]} icon="code" active={step === 0 || step === 1} />
        <Node x={546} y={112} width={132} title="Validator" overline="RPC" lines={["Sui testnet", "shared Move objects"]} icon="layers" active={step === 3} />
        <Wire d="M254 144H328m-6-4 6 4-6 4" active={step === 0} tone="pink" /><text x="291" y="133" textAnchor="middle" className={styles.tinyLabel}>REQUEST</text>
        <Wire d="M328 193H291V272H254m6-4-6 4 6 4" active={step === 1} tone="gold" />
        <Wire d="M254 326H612V224m-5 7 5-7 5 7" active={step === 2 || step === 3} tone="green" /><text x="432" y="313" textAnchor="middle" className={styles.wireLabel}>SIGNED TRANSACTION →</text>
        <rect x="328" y="250" width="144" height="31" rx="5" className={styles.evidence} /><text x="400" y="270" textAnchor="middle" className={styles.tinyLabel}>NO PRIVATE KEYS</text>
        <text x="612" y="358" textAnchor="middle" className={styles.microLabel}>VERIFY CONFIRMATION</text>
        <text x="360" y="408" textAnchor="middle" className={styles.microLabel}>READ → BUILD → VALIDATE → SIGN → EXECUTE</text>
      </Scene>
    </Frame>
  );
}

const DIAGRAMS: Record<string, () => ReactNode> = { lifecycle: Lifecycle, rollup: Rollup, amm: Amm, leverage: Leverage, oracle: Oracle, agent: Agent };

export function Diagram({ name }: { name: string }) {
  const Component = DIAGRAMS[name.trim()];
  return Component ? <Component /> : null;
}
