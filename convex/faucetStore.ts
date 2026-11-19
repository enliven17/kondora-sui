import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { faucetAddress, FAUCET_COOLDOWN_MS } from "../lib/faucet";
export const status = query({ args: { address: v.string() }, handler: async (ctx, { address }) => {
  const row = await ctx.db.query("faucetClaims").withIndex("by_address", q => q.eq("address", faucetAddress(address))).unique();
  return row ? { claimedAt: row.claimedAt, nextClaimAt: row.nextClaimAt, digest: row.digest } : null;
} });
export const record = internalMutation({ args: { address: v.string(), claimedAt: v.number(), digest: v.optional(v.string()) }, handler: async (ctx, a) => {
  const old = await ctx.db.query("faucetClaims").withIndex("by_address", q => q.eq("address", a.address)).unique();
  const fields = { ...a, digest: a.digest ?? (old?.claimedAt === a.claimedAt ? old.digest : undefined), nextClaimAt: a.claimedAt + FAUCET_COOLDOWN_MS };
  if (old) { if (a.claimedAt >= old.claimedAt) await ctx.db.patch(old._id, fields); }
  else await ctx.db.insert("faucetClaims", fields);
} });
export const budget = internalMutation({ args: {}, handler: async ctx => {
  const key = "daily-faucet-requests", now = Date.now(), windowStart = Math.floor(now / 60000) * 60000;
  const row = await ctx.db.query("rateLimits").withIndex("by_key", q => q.eq("key", key)).unique();
  if (row?.windowStart === windowStart && row.count >= 30) return false;
  if (row) await ctx.db.patch(row._id, { windowStart, count: row.windowStart === windowStart ? row.count + 1 : 1 });
  else await ctx.db.insert("rateLimits", { key, windowStart, count: 1 });
  return true;
} });
