import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const marketStatus = v.union(
  v.literal("pending"),
  v.literal("open"),
  v.literal("closed"),
  v.literal("proposed"),
  v.literal("disputed"),
  v.literal("resolved"),
  v.literal("failed"),
);

export default defineSchema({
  faucetClaims: defineTable({ address: v.string(), claimedAt: v.number(), nextClaimAt: v.number(), digest: v.optional(v.string()) }).index("by_address", ["address"]),
  evidence: defineTable({ hash: v.string(), bundle: v.string(), t: v.number() }).index("by_hash", ["hash"]),
  markets: defineTable({
    key: v.string(),
    chainId: v.optional(v.string()),
    status: marketStatus,
    question: v.string(),
    summary: v.string(),
    category: v.string(),
    rules: v.array(v.string()),
    resolution: v.any(),
    sourceName: v.string(),
    sourceUrl: v.string(),
    tags: v.array(v.string()),
    openTime: v.number(),
    closeTime: v.number(),
    initialPriceYes: v.number(),
    priceYes: v.number(),
    volume: v.number(),
    liquidity: v.number(),
    trades: v.number(),
    traders: v.number(),
    delegated: v.boolean(),
    swept: v.boolean(),
    outcome: v.optional(v.string()),
    evidenceHash: v.optional(v.string()),
    proposedAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_chain", ["chainId"])
    .index("by_status", ["status"])
    .index("by_status_close", ["status", "closeTime"])
    .index("by_category_status", ["category", "status"]),

  ticks: defineTable({ marketId: v.id("markets"), t: v.number(), p: v.number(), v: v.number() }).index("by_market_t", ["marketId", "t"]),

  trades: defineTable({
    marketId: v.id("markets"),
    chainId: v.string(),
    owner: v.string(),
    side: v.union(v.literal("yes"), v.literal("no")),
    kind: v.union(v.literal("open"), v.literal("close"), v.literal("liquidation")),
    leverage: v.number(),
    amount: v.number(),
    shares: v.number(),
    priceYes: v.number(),
    t: v.number(),
    sig: v.string(),
  })
    .index("by_market_t", ["marketId", "t"])
    .index("by_owner_t", ["owner", "t"])
    .index("by_t", ["t"])
    .index("by_sig", ["sig"]),

  trail: defineTable({
    marketId: v.id("markets"),
    t: v.number(),
    kind: v.union(v.literal("created"), v.literal("proposed"), v.literal("challenged"), v.literal("finalized"), v.literal("ruled"), v.literal("audited"), v.literal("closed")),
    actor: v.union(v.literal("creator"), v.literal("oracle"), v.literal("auditor"), v.literal("admin"), v.literal("crank")),
    agent: v.string(),
    note: v.string(),
    evidenceHash: v.optional(v.string()),
    sig: v.optional(v.string()),
  }).index("by_market", ["marketId", "t"]),

  verdicts: defineTable({
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
    t: v.number(),
  }).index("by_market", ["marketId", "t"]),

  agentStats: defineTable({
    agent: v.string(),
    role: v.string(),
    runs: v.number(),
    ok: v.number(),
    lastRunAt: v.number(),
    lastNote: v.string(),
    lossSum: v.number(),
    reports: v.number(),
  }).index("by_agent", ["agent"]),

  apiAgents: defineTable({
    pubkey: v.string(),
    name: v.string(),
    url: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.number(),
    requests: v.number(),
  }).index("by_pubkey", ["pubkey"]),

  nonces: defineTable({ pubkey: v.string(), nonce: v.string(), t: v.number() }).index("by_pubkey_nonce", ["pubkey", "nonce"]).index("by_t", ["t"]),

  rateLimits: defineTable({ key: v.string(), windowStart: v.number(), count: v.number() }).index("by_key", ["key"]).index("by_window", ["windowStart"]),

  locks: defineTable({ name: v.string(), until: v.number() }).index("by_name", ["name"]),
  cursors: defineTable({ name: v.string(), value: v.string() }).index("by_name", ["name"]),

  /** Traded notional per UTC day (unix seconds of the day start), kept as trades are indexed. */
  volumeDays: defineTable({ day: v.number(), volume: v.number(), trades: v.number() }).index("by_day", ["day"]),
});
