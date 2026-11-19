"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { faucetAddress, faucetEligibility, type FaucetResult } from "../lib/faucet";
import { dailyFaucetState, lastDailyClaim, dailyClaimTransaction } from "../lib/sui/faucet";
import { roleKey, send } from "./sui";

// Anonymous test-token distribution only: callers cannot choose the amount,
// signer, target, transaction bytes or cooldown. No access to trading accounts.
export const claim = action({ args: { address: v.string(), welcomeOnly: v.boolean() }, handler: async (ctx, a): Promise<FaucetResult> => {
  const address = faucetAddress(a.address);
  if (process.env.KONDORA_BACKEND_OFF === "1") return { state: "error", message: "Faucet temporarily unavailable." };
  if (!await ctx.runMutation(internal.faucetStore.budget, {})) return { state: "retry", message: "Faucet is busy. Try again shortly." };
  if (!await ctx.runMutation(internal.markets.acquireLock, { name: "sui-daily-faucet", ttlMs: 120000 })) return { state: "retry", message: "Another claim is being sent. Try again shortly." };
  try {
    const key = roleKey("FAUCET");
    if (!key) throw new Error("Faucet sponsor is not configured");
    const daily = await dailyFaucetState();
    if (daily.sponsor !== key.toSuiAddress()) throw new Error("Faucet sponsor mismatch");
    const last = await lastDailyClaim(daily.claimed.id, address);
    const eligibility = faucetEligibility(last, Date.now(), a.welcomeOnly);
    if (!eligibility.eligible) {
      await ctx.runMutation(internal.faucetStore.record, { address, claimedAt: last! });
      return { state: "cooldown", nextClaimAt: eligibility.nextClaimAt };
    }
    const result = await send(dailyClaimTransaction(address, a.welcomeOnly), key);
    const claimedAt = await lastDailyClaim(daily.claimed.id, address);
    if (claimedAt === null) throw new Error("Claim confirmation is still pending");
    await ctx.runMutation(internal.faucetStore.record, { address, claimedAt, digest: result.digest });
    return { state: "sent", nextClaimAt: faucetEligibility(claimedAt, Date.now(), false).nextClaimAt, digest: result.digest };
  } catch (error) {
    console.error("Daily faucet delivery", error instanceof Error ? error.message : "Delivery failed");
    return { state: "retry", message: "Could not confirm the faucet transfer yet. Please try again shortly." };
  } finally { await ctx.runMutation(internal.markets.releaseLock, { name: "sui-daily-faucet" }); }
} });
