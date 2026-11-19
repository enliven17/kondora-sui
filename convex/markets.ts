// Public market queries (shape matches lib/types.ts) and internal writes used
// by the agent actions.

import { v } from "convex/values";
import { internalMutation, internalQuery, MutationCtx, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { marketStatus } from "./schema";

const DAY = 86_400;
export const VOLUME_DAYS_FROM = "volumeDaysFrom";

/** Notional a trade adds to the daily volume: opens count at their leverage, closes and liquidations at their amount. */
export const tradeNotional = (t: Pick<Doc<"trades">, "kind" | "amount" | "leverage">) => (t.kind === "open" ? t.amount * Math.max(1, t.leverage) : t.amount);

/** Adds one trade to its UTC day bucket (volumeDays). */
export async function bumpDay(ctx: MutationCtx, t: Pick<Doc<"trades">, "kind" | "amount" | "leverage" | "t">) {
  const day = Math.floor(t.t / DAY) * DAY;
  const row = await ctx.db.query("volumeDays").withIndex("by_day", (q) => q.eq("day", day)).first();
  const add = tradeNotional(t);
  if (row) await ctx.db.patch(row._id, { volume: row.volume + add, trades: row.trades + 1 });
  else await ctx.db.insert("volumeDays", { day, volume: add, trades: 1 });
}

/** Day buckets are kept live once the backfill has started (stats.ts); before that the backfill owns them. */
const liveDays = async (ctx: MutationCtx) => !!(await ctx.db.query("cursors").withIndex("by_name", (q) => q.eq("name", VOLUME_DAYS_FROM)).first());

const nowSec = () => Math.floor(Date.now() / 1000);
const uiState = (s: Doc<"markets">["status"]) => (s === "pending" || s === "failed" ? "open" : s);

async function sparkline(ctx: QueryCtx, m: Doc<"markets">, points = 24) {
  const from = nowSec() - DAY;
  const ticks = await ctx.db
    .query("ticks")
    .withIndex("by_market_t", (q) => q.eq("marketId", m._id).gte("t", from))
    .order("desc")
    .take(600);
  ticks.reverse();
  if (!ticks.length) return [{ t: m.openTime, p: m.initialPriceYes, v: 0 }, { t: nowSec(), p: m.priceYes, v: 0 }];
  const step = Math.max(1, Math.floor(ticks.length / points));
  return ticks.filter((_, i) => i % step === 0 || i === ticks.length - 1).map(({ t, p, v }) => ({ t, p, v }));
}

function toUi(m: Doc<"markets">, history: { t: number; p: number; v: number }[]) {
  const first = history.find((h) => h.t >= nowSec() - DAY) ?? history[0];
  return {
    id: String(m.chainId ?? m._id),
    question: m.question,
    category: m.category,
    summary: m.summary,
    openTime: m.openTime,
    closeTime: m.closeTime,
    state: uiState(m.status),
    outcome: m.outcome,
    yesPrice: m.priceYes,
    change24h: first ? m.priceYes - first.p : 0,
    volume: m.volume,
    liquidity: m.liquidity,
    traders: m.traders,
    resolution: { name: m.sourceName, url: m.sourceUrl, field: describeField(m.resolution) },
    rules: m.rules,
    history,
    tags: m.tags,
  };
}

function describeField(r: { kind?: string; symbol?: string; teamName?: string } | undefined): string {
  switch (r?.kind) {
    case "price":
      return `${r.symbol}/USD price at settlement`;
    case "espn":
      return `Final result, ${r.teamName}`;
    case "polymarket":
      return "Polymarket UMA final outcome";
    default:
      return "Council verdict from public reporting";
  }
}

async function byPublicId(ctx: QueryCtx, id: string): Promise<Doc<"markets"> | null> {
  if (/^0x[0-9a-f]{64}$/i.test(id)) {
    return ctx.db.query("markets").withIndex("by_chain", (q) => q.eq("chainId", id)).first();
  }
  const norm = ctx.db.normalizeId("markets", id);
  return norm ? ctx.db.get(norm) : null;
}

export const list = query({
  args: {
    category: v.optional(v.string()),
    state: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { category, state, limit }) => {
    const statuses: Doc<"markets">["status"][] = state ? [state as Doc<"markets">["status"]] : ["open", "closed", "proposed", "disputed", "resolved"];
    const rows: Doc<"markets">[] = [];
    for (const s of statuses) {
      const q = category
        ? ctx.db.query("markets").withIndex("by_category_status", (i) => i.eq("category", category).eq("status", s))
        : ctx.db.query("markets").withIndex("by_status", (i) => i.eq("status", s));
      rows.push(...(await q.order("desc").take(s === "open" ? 300 : 60)));
    }
    const sel = rows.filter((m) => m.chainId !== undefined).slice(0, limit ?? 400);
    return Promise.all(sel.map(async (m) => toUi(m, await sparkline(ctx, m))));
  },
});

export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const m = await byPublicId(ctx, id);
    if (!m) return null;
    // Bounded reads: the latest ticks, trail and verdicts only.
    const ticks = (await ctx.db.query("ticks").withIndex("by_market_t", (q) => q.eq("marketId", m._id)).order("desc").take(600)).reverse();
    const history = ticks.length ? ticks.map(({ t, p, v }) => ({ t, p, v })) : [{ t: m.openTime, p: m.initialPriceYes, v: 0 }];
    const trail = (await ctx.db.query("trail").withIndex("by_market", (q) => q.eq("marketId", m._id)).order("desc").take(50)).reverse();
    const verdicts = (await ctx.db.query("verdicts").withIndex("by_market", (q) => q.eq("marketId", m._id)).order("desc").take(20)).reverse();
    return {
      ...toUi(m, history),
      chainId: m.chainId,
      delegated: m.delegated,
      evidenceHash: m.evidenceHash,
      oracleTrail: trail.map((e) => ({ t: e.t, kind: e.kind, actor: e.actor, agent: e.agent, note: e.note, evidenceHash: e.evidenceHash, sig: e.sig })),
      verdicts: verdicts.map((x) => ({
        role: x.role,
        method: x.method,
        verdict: x.verdict,
        confidence: x.confidence,
        reasoning: x.reasoning,
        evidence: x.evidence,
        evidenceHash: x.evidenceHash,
        panel: x.panel,
        t: x.t,
      })),
    };
  },
});

export const activity = query({
  args: { marketId: v.optional(v.string()), owner: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { marketId, owner, limit }) => {
    const n = Math.min(limit ?? 40, 200);
    let rows: Doc<"trades">[];
    if (marketId) {
      const m = await byPublicId(ctx, marketId);
      if (!m) return [];
      rows = await ctx.db.query("trades").withIndex("by_market_t", (q) => q.eq("marketId", m._id)).order("desc").take(n);
    } else if (owner) {
      rows = await ctx.db.query("trades").withIndex("by_owner_t", (q) => q.eq("owner", owner)).order("desc").take(n);
    } else {
      rows = await ctx.db.query("trades").withIndex("by_t").order("desc").take(n);
    }
    return rows.map((r) => ({
      id: r._id,
      marketId: String(r.chainId),
      kind: r.kind,
      side: r.side,
      leverage: r.leverage,
      amount: r.amount,
      price: r.side === "yes" ? r.priceYes : 1 - r.priceYes,
      t: r.t,
      trader: `${r.owner.slice(0, 4)}..${r.owner.slice(-4)}`,
      owner: r.owner,
      sig: r.sig,
    }));
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const open = await ctx.db.query("markets").withIndex("by_status", (q) => q.eq("status", "open")).collect();
    const resolved = await ctx.db.query("markets").withIndex("by_status", (q) => q.eq("status", "resolved")).take(500);
    const live = open.filter((m) => m.chainId !== undefined);
    return {
      openMarkets: live.length,
      resolvedMarkets: resolved.length,
      volume: [...live, ...resolved].reduce((a, m) => a + m.volume, 0),
      liquidity: live.reduce((a, m) => a + m.liquidity, 0),
      byCategory: live.reduce<Record<string, number>>((a, m) => ((a[m.category] = (a[m.category] ?? 0) + 1), a), {}),
    };
  },
});

export const agents = query({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db.query("agentStats").collect();
    const external = await ctx.db.query("apiAgents").order("desc").take(100);
    return {
      protocol: stats.map((s) => ({
        agent: s.agent,
        role: s.role,
        runs: s.runs,
        successRate: s.runs ? s.ok / s.runs : 0,
        lastRunAt: s.lastRunAt,
        lastNote: s.lastNote,
        avgLoss: s.reports ? s.lossSum / s.reports : null,
        reports: s.reports,
      })),
      external: external.map((a) => ({ pubkey: a.pubkey, name: a.name, url: a.url, lastSeenAt: a.lastSeenAt, requests: a.requests })),
    };
  },
});

// ── Internal ─────────────────────────────────────────────────────────────

export const keysAndCounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("markets").collect();
    const openByCategory: Record<string, number> = {};
    for (const m of all) if (m.status === "open" || m.status === "pending") openByCategory[m.category] = (openByCategory[m.category] ?? 0) + 1;
    return { keys: all.map((m) => m.key), openByCategory };
  },
});

export const byStatus = internalQuery({
  args: { status: marketStatus, before: v.optional(v.number()) },
  handler: async (ctx, { status, before }) => {
    const q = ctx.db.query("markets").withIndex("by_status_close", (i) => (before === undefined ? i.eq("status", status) : i.eq("status", status).lte("closeTime", before)));
    return q.take(500);
  },
});

export const getById = internalQuery({ args: { id: v.id("markets") }, handler: (ctx, { id }) => ctx.db.get(id) });
export const getByChain = internalQuery({
  args: { chainId: v.string() },
  handler: (ctx, { chainId }) => ctx.db.query("markets").withIndex("by_chain", (q) => q.eq("chainId", chainId)).first(),
});

export const insertPending = internalMutation({
  args: {
    key: v.string(),
    question: v.string(),
    summary: v.string(),
    category: v.string(),
    rules: v.array(v.string()),
    resolution: v.any(),
    sourceName: v.string(),
    sourceUrl: v.string(),
    tags: v.array(v.string()),
    closeTime: v.number(),
    priceYes: v.number(),
  },
  handler: async (ctx, a) => {
    const dup = await ctx.db.query("markets").withIndex("by_key", (q) => q.eq("key", a.key)).first();
    if (dup) return null;
    return ctx.db.insert("markets", {
      ...a,
      status: "pending",
      openTime: nowSec(),
      initialPriceYes: a.priceYes,
      volume: 0,
      liquidity: 0,
      trades: 0,
      traders: 0,
      delegated: false,
      swept: false,
      updatedAt: Date.now(),
    });
  },
});

export const patch = internalMutation({
  args: { id: v.id("markets"), fields: v.any() },
  handler: async (ctx, { id, fields }) => {
    await ctx.db.patch(id, { ...(fields as Partial<Doc<"markets">>), updatedAt: Date.now() });
  },
});

export const addTrail = internalMutation({
  args: {
    marketId: v.id("markets"),
    kind: v.string(),
    actor: v.string(),
    agent: v.string(),
    note: v.string(),
    evidenceHash: v.optional(v.string()),
    sig: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    await ctx.db.insert("trail", { ...(a as Omit<Doc<"trail">, "_id" | "_creationTime" | "t">), t: nowSec() });
  },
});

export const addVerdict = internalMutation({
  args: {
    marketId: v.id("markets"),
    role: v.union(v.literal("oracle"), v.literal("audit"), v.literal("arbiter")),
    method: v.string(),
    verdict: v.string(),
    confidence: v.number(),
    reasoning: v.string(),
    evidence: v.any(),
    evidenceHash: v.string(),
    panel: v.optional(v.any()),
    scores: v.optional(v.any()),
  },
  handler: async (ctx, a) => {
    await ctx.db.insert("verdicts", { ...a, t: nowSec() });
    for (const s of (a.scores as { agent: string; loss: number }[] | undefined) ?? []) {
      const row = await ctx.db.query("agentStats").withIndex("by_agent", (q) => q.eq("agent", s.agent)).first();
      if (row) await ctx.db.patch(row._id, { lossSum: row.lossSum + s.loss, reports: row.reports + 1 });
      else await ctx.db.insert("agentStats", { agent: s.agent, role: "council", runs: 0, ok: 0, lastRunAt: 0, lastNote: "", lossSum: s.loss, reports: 1 });
    }
  },
});

export const lastVerdict = internalQuery({
  args: { marketId: v.id("markets"), role: v.string() },
  handler: async (ctx, { marketId, role }) => {
    const rows = await ctx.db.query("verdicts").withIndex("by_market", (q) => q.eq("marketId", marketId)).order("desc").collect();
    return rows.find((r) => r.role === role) ?? null;
  },
});

export const recordSync = internalMutation({
  args: {
    id: v.id("markets"),
    priceYes: v.number(),
    volume: v.number(),
    liquidity: v.number(),
    trades: v.number(),
    tick: v.boolean(),
    tickVolume: v.number(),
  },
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, { priceYes: a.priceYes, volume: a.volume, liquidity: a.liquidity, trades: a.trades, updatedAt: Date.now() });
    if (a.tick) await ctx.db.insert("ticks", { marketId: a.id, t: nowSec(), p: a.priceYes, v: a.tickVolume });
  },
});

export const lastTick = internalQuery({
  args: { id: v.id("markets") },
  handler: (ctx, { id }) => ctx.db.query("ticks").withIndex("by_market_t", (q) => q.eq("marketId", id)).order("desc").first(),
});

export const insertTrades = internalMutation({
  args: { rows: v.array(v.any()) },
  handler: async (ctx, { rows }) => {
    let added = 0;
    const live = await liveDays(ctx);
    for (const r of rows as Omit<Doc<"trades">, "_id" | "_creationTime">[]) {
      const key = `${r.sig}:${r.owner}:${r.kind}:${r.side}`;
      const dupes = await ctx.db.query("trades").withIndex("by_sig", (q) => q.eq("sig", r.sig)).collect();
      if (dupes.some((d) => `${d.sig}:${d.owner}:${d.kind}:${d.side}` === key)) continue;
      await ctx.db.insert("trades", r);
      added++;
      if (live) await bumpDay(ctx, r);
      const m = await ctx.db.get(r.marketId as Id<"markets">);
      if (m) {
        const prior = await ctx.db
          .query("trades")
          .withIndex("by_owner_t", (q) => q.eq("owner", r.owner))
          .filter((q) => q.eq(q.field("marketId"), r.marketId))
          .take(2);
        if (prior.length === 1) await ctx.db.patch(m._id, { traders: m.traders + 1 });
      }
    }
    return added;
  },
});

export const agentRun = internalMutation({
  args: { agent: v.string(), role: v.string(), ok: v.boolean(), note: v.string() },
  handler: async (ctx, { agent, role, ok, note }) => {
    const row = await ctx.db.query("agentStats").withIndex("by_agent", (q) => q.eq("agent", agent)).first();
    const patch = { lastRunAt: nowSec(), lastNote: note.slice(0, 300) };
    if (row) await ctx.db.patch(row._id, { ...patch, runs: row.runs + 1, ok: row.ok + (ok ? 1 : 0), role });
    else await ctx.db.insert("agentStats", { agent, role, runs: 1, ok: ok ? 1 : 0, lossSum: 0, reports: 0, ...patch });
  },
});

export const acquireLock = internalMutation({
  args: { name: v.string(), ttlMs: v.number() },
  handler: async (ctx, { name, ttlMs }) => {
    const row = await ctx.db.query("locks").withIndex("by_name", (q) => q.eq("name", name)).first();
    const now = Date.now();
    if (row && row.until > now) return false;
    if (row) await ctx.db.patch(row._id, { until: now + ttlMs });
    else await ctx.db.insert("locks", { name, until: now + ttlMs });
    return true;
  },
});

export const releaseLock = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const row = await ctx.db.query("locks").withIndex("by_name", (q) => q.eq("name", name)).first();
    if (row) await ctx.db.patch(row._id, { until: 0 });
  },
});

export const getCursor = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, { name }) => (await ctx.db.query("cursors").withIndex("by_name", (q) => q.eq("name", name)).first())?.value ?? null,
});

export const setCursor = internalMutation({
  args: { name: v.string(), value: v.string() },
  handler: async (ctx, { name, value }) => {
    const row = await ctx.db.query("cursors").withIndex("by_name", (q) => q.eq("name", name)).first();
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("cursors", { name, value });
  },
});

/** Everything the indexer needs in one read. */
export const syncState = internalQuery({
  args: {},
  handler: async (ctx) => {
    const out = [];
    for (const status of ["open", "closed"] as const) {
      for (const m of await ctx.db.query("markets").withIndex("by_status", (q) => q.eq("status", status)).take(300)) {
        if (m.chainId === undefined) continue;
        const last = await ctx.db.query("ticks").withIndex("by_market_t", (q) => q.eq("marketId", m._id)).order("desc").first();
        out.push({ id: m._id, chainId: m.chainId, trades: m.trades, volume: m.volume, lastP: last?.p ?? m.priceYes, lastT: last?.t ?? 0 });
      }
    }
    return out;
  },
});

export const recordSyncBatch = internalMutation({
  args: {
    rows: v.array(
      v.object({
        id: v.id("markets"),
        priceYes: v.number(),
        volume: v.number(),
        liquidity: v.number(),
        trades: v.number(),
        tick: v.boolean(),
        tickVolume: v.number(),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    const t = nowSec();
    for (const r of rows) {
      await ctx.db.patch(r.id, { priceYes: r.priceYes, volume: r.volume, liquidity: r.liquidity, trades: r.trades, updatedAt: Date.now() });
      if (r.tick) await ctx.db.insert("ticks", { marketId: r.id, t, p: r.priceYes, v: r.tickVolume });
    }
  },
});

export const insertTradesAndCursor = internalMutation({
  args: { rows: v.array(v.any()), cursorName: v.string(), cursor: v.string() },
  handler: async (ctx, { rows, cursorName, cursor }) => {
    let added = 0;
    const live = await liveDays(ctx);
    for (const r of rows as Omit<Doc<"trades">, "_id" | "_creationTime">[]) {
      const dupes = await ctx.db.query("trades").withIndex("by_sig", (q) => q.eq("sig", r.sig)).collect();
      if (dupes.some((d) => d.owner === r.owner && d.kind === r.kind && d.side === r.side)) continue;
      const first = !(await ctx.db
        .query("trades")
        .withIndex("by_owner_t", (q) => q.eq("owner", r.owner))
        .filter((q) => q.eq(q.field("marketId"), r.marketId))
        .first());
      await ctx.db.insert("trades", r);
      added++;
      if (live) await bumpDay(ctx, r);
      if (first) {
        const m = await ctx.db.get(r.marketId as Id<"markets">);
        if (m) await ctx.db.patch(m._id, { traders: m.traders + 1 });
      }
    }
    if (cursor) {
      const row = await ctx.db.query("cursors").withIndex("by_name", (q) => q.eq("name", cursorName)).first();
      if (row) await ctx.db.patch(row._id, { value: cursor });
      else await ctx.db.insert("cursors", { name: cursorName, value: cursor });
    }
    return added;
  },
});
