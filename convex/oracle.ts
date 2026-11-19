"use node";
import { createHash } from "node:crypto";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { resolveMarket, PROPOSE_CONFIDENCE } from "../agents/oracle";
import { auditProposal } from "../agents/audit";
import type { ResolutionSpec } from "../agents/types";
import { readAllMarkets } from "../lib/sui/read";
import { resolutionTransaction } from "../lib/sui/transactions";
import { roleKey, send } from "./sui";
export const run = internalAction({ args: {}, handler: async (ctx) => {
  const oracle = roleKey("ORACLE"), crank = roleKey("CRANK") ?? oracle, auditor = roleKey("AUDITOR");
  if (!crank || process.env.KONDORA_BACKEND_OFF === "1") return { skipped: true };
  if (!await ctx.runMutation(internal.markets.acquireLock, { name: "sui-oracle", ttlMs: 110000 })) return { skipped: true };
  let proposed = 0, finalized = 0;
  try {
    const markets = await readAllMarkets();
    for (const m of markets) {
      const now = Date.now(), start = Number(m.proposed_ms) || Number(m.close_ms);
      if (m.state === 4 || now < Number(m.close_ms)) continue;
      if (now >= start + 86400000) { await send(resolutionTransaction("timeout", m.id), crank); finalized++; continue; }
      let metadata: { spec?: ResolutionSpec };
      try { metadata = JSON.parse(m.resolution); } catch { continue; }
      if (m.state === 2) {
        if (now >= Number(m.proposed_ms) + 300000) { await send(resolutionTransaction("finalize", m.id), crank); finalized++; continue; }
        if (!auditor || !metadata.spec) continue;
        const row = await ctx.runQuery(internal.markets.getByChain, { chainId: m.id });
        if (!row || await ctx.runQuery(internal.markets.lastVerdict, { marketId: row._id, role: "audit" })) continue;
        const audit = await auditProposal({ marketKey: m.id, question: m.question, rules: m.rules, resolution: metadata.spec, closeTime: Number(m.close_ms) / 1000 }, (["yes", "no", "invalid"] as const)[m.outcome]);
        const bundle = JSON.stringify({ marketId: m.id, audit });
        const hash = createHash("sha256").update(bundle).digest();
        await ctx.runMutation(internal.evidence.put, { hash: hash.toString("hex"), bundle });
        await ctx.runMutation(internal.markets.addVerdict, { marketId: row._id, role: "audit", method: audit.method, verdict: audit.verdict, confidence: audit.confidence, reasoning: audit.reasoning, evidence: [], evidenceHash: hash.toString("hex") });
        if (audit.challenge) await send(resolutionTransaction("challenge", m.id, 2, [...hash], `${process.env.CONVEX_SITE_URL}/evidence/${hash.toString("hex")}`), auditor);
        await ctx.runMutation(internal.markets.agentRun, { agent: "Auditor", role: "auditor", ok: true, note: audit.challenge ? "Challenged proposal" : "Proposal reviewed" });
        continue;
      }
      if (m.state !== 0 || !oracle) continue;
      if (!metadata.spec) continue;
      const result = await resolveMarket({ marketKey: m.id, question: m.question, rules: m.rules, resolution: metadata.spec, closeTime: Number(m.close_ms) / 1000 });
      if (result.verdict === "pending" || result.confidence < PROPOSE_CONFIDENCE) continue;
      const evidence = JSON.stringify({ marketId: m.id, result });
      const hash = createHash("sha256").update(evidence).digest();
      const row = await ctx.runQuery(internal.markets.getByChain, { chainId: m.id });
      if (!row) continue;
      await ctx.runMutation(internal.evidence.put, { hash: hash.toString("hex"), bundle: evidence });
      await ctx.runMutation(internal.markets.addVerdict, { marketId: row._id, role: "oracle", method: result.method,
        verdict: result.verdict, confidence: result.confidence, reasoning: result.reasoning, evidence: result.evidence,
        evidenceHash: hash.toString("hex"), ...(result.panel ? { panel: result.panel } : {}),
      });
      // The complete bundle is available in the public market verdict record.
      const uri = `${process.env.CONVEX_SITE_URL}/evidence/${hash.toString("hex")}`;
      await send(resolutionTransaction("propose", m.id, ["yes", "no", "invalid"].indexOf(result.verdict), [...hash], uri), oracle);
      proposed++;
    }
    await ctx.runMutation(internal.markets.agentRun, { agent: "Oracle", role: "oracle", ok: true, note: `${proposed} proposed, ${finalized} finalized` });
    await ctx.runAction(internal.indexer.run, {});
    return { proposed, finalized };
  } finally { await ctx.runMutation(internal.markets.releaseLock, { name: "sui-oracle" }); }
} });
