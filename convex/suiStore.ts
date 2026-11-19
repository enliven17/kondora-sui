import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
export const upsertMarket = internalMutation({ args: { fields: v.any() }, handler: async (ctx, { fields }) => {
  const f = fields as Omit<Doc<"markets">, "_id" | "_creationTime">;
  const old = await ctx.db.query("markets").withIndex("by_chain", (q) => q.eq("chainId", f.chainId)).first();
  const id = old?._id ?? await ctx.db.insert("markets", f);
  if (old) await ctx.db.patch(id, { ...f, initialPriceYes: old.initialPriceYes, traders: old.traders });
  if (!old || old.priceYes !== f.priceYes || old.volume !== f.volume) await ctx.db.insert("ticks", { marketId: id, t: Math.floor(Date.now() / 1000), p: f.priceYes, v: Math.max(0, f.volume - (old?.volume ?? 0)) });
  if (!old) await ctx.db.insert("trail", { marketId: id, t: f.openTime, kind: "created", actor: "creator", agent: "Sui Creator", note: "Shared Move market published on Sui testnet." });
  if (old && old.status !== f.status && ["proposed", "disputed", "resolved"].includes(f.status)) await ctx.db.insert("trail", {
    marketId: id, t: Math.floor(Date.now() / 1000), kind: f.status === "proposed" ? "proposed" : f.status === "disputed" ? "challenged" : "finalized",
    actor: f.status === "resolved" ? "crank" : "oracle", agent: "Sui Oracle", note: `On-chain state: ${f.status}.`, evidenceHash: f.evidenceHash,
  });
  return id;
} });
