import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
export const put = internalMutation({ args: { hash: v.string(), bundle: v.string() }, handler: async (ctx, { hash, bundle }) => {
  if (!/^[a-f0-9]{64}$/.test(hash) || bundle.length > 100000) throw new Error("Invalid evidence bundle");
  const old = await ctx.db.query("evidence").withIndex("by_hash", (q) => q.eq("hash", hash)).first();
  if (old && old.bundle !== bundle) throw new Error("Evidence hash conflict");
  if (!old) await ctx.db.insert("evidence", { hash, bundle, t: Date.now() });
} });
export const get = query({ args: { hash: v.string() }, handler: async (ctx, { hash }) => {
  if (!/^[a-f0-9]{64}$/.test(hash)) return null;
  return (await ctx.db.query("evidence").withIndex("by_hash", (q) => q.eq("hash", hash)).first())?.bundle ?? null;
} });
