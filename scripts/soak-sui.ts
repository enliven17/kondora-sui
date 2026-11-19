import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { localWallet, execute } from "./wallet";
import { readAccount as chainReadAccount } from "../lib/account";
import { poolOf } from "../lib/chain";
import { amm } from "../lib/kondora";
import { sui } from "../lib/sui/client";
import { CLOCK_ID } from "../lib/sui/config";
import { readAllMarkets, readSuiMarket as chainReadMarket, toMarketAccount } from "../lib/sui/read";
import { createMarketTransaction, mintTransaction, newTransaction, setupTransaction, target } from "../lib/sui/transactions";

function option(name: string, fallback: number, min: number, max: number) {
  const i = process.argv.indexOf(name), value = i < 0 ? fallback : Number(process.argv[i + 1]);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be ${min}..${max}`);
  return value;
}
const minutes = option("--minutes", 30, 0.1, 43200);
const walletCount = Math.floor(option("--wallets", 4, 1, 20));
const interval = option("--interval-ms", 2500, 0, 60000);
const maxRounds = option("--rounds", Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER);
const resumeIndex = process.argv.indexOf("--resume");
const resumeDir = resumeIndex >= 0 ? process.argv[resumeIndex + 1] : null;
const run = resumeDir ? path.basename(resumeDir).replace(/^sui-/, "") : new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(".soak", `sui-${run}`), keyDir = path.join(".keys", `soak-${run}`);
fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(keyDir, { recursive: true });
const logFile = path.join(outDir, "events.jsonl");
const donor = localWallet();
const wallets = Array.from({ length: walletCount }, (_, i) => {
  const file = path.join(keyDir, `${i}.key`);
  if (resumeDir) return Ed25519Keypair.fromSecretKey(fs.readFileSync(file, "utf8").trim());
  const key = Ed25519Keypair.generate(); fs.writeFileSync(file, key.getSecretKey(), { mode: 0o600 }); return key;
});
const report = { network: "sui:testnet", startedAt: new Date().toISOString(), completedAt: "", minutes, walletCount, marketId: "", rounds: 0, transactions: 0, failures: 0, networkRetries: 0, checks: 0, rejectedAttacks: 0, stopped: false, gasMist: "0", errors: [] as string[], latencies: [] as number[] };
async function retryRead<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await fn(); }
    catch (error) {
      if (attempt >= 5 || !/fetch failed|network|timeout|ECONN|unavailable|DEADLINE/i.test(String(error))) throw error;
      report.networkRetries++; console.log(`Read transport retry ${attempt + 1}/5`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
const readAccount = (owner: string) => retryRead(() => chainReadAccount(owner));
const readSuiMarket = (id: string) => retryRead(() => chainReadMarket(id));
let interrupted = false;
process.on("SIGINT", () => { interrupted = true; }); process.on("SIGTERM", () => { interrupted = true; });
function log(event: Record<string, unknown>) { fs.appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n"); }
async function send(action: string, tx: Transaction, key = donor) {
  const started = performance.now();
  const result = await execute(tx, key);
  const latencyMs = Math.round(performance.now() - started);
  report.transactions++; report.latencies.push(latencyMs);
  const gas = result.effects?.gasUsed;
  if (gas) report.gasMist = String(BigInt(report.gasMist) + BigInt(gas.computationCost) + BigInt(gas.storageCost) - BigInt(gas.storageRebate));
  log({ action, owner: key.toSuiAddress(), digest: result.digest, latencyMs });
  console.log(`${action}: ${result.digest} (${latencyMs}ms)`);
}
try {
  const donorGas = BigInt((await retryRead(() => sui.getBalance({ owner: donor.toSuiAddress() }))).balance.balance);
  assert(donorGas > (resumeDir ? 50000000n : BigInt(walletCount) * 150_000_000n + 100_000_000n), "Deployer needs 0.15 test SUI per wallet plus 0.1 SUI. Use the Sui faucet first.");
  if (!resumeDir) {
  await send("mint-seed", mintTransaction());
  await send("create-soak-market", createMarketTransaction({ question: `Will Sui soak run ${run.slice(0, 16)} complete its checks?`,
    summary: "Automated testnet stress scenario. Not a real-world prediction.", category: "tech", rules: ["Testnet scenario; evidence is the local soak report."],
    resolution: JSON.stringify({ key: `soak-${run}`, tags: ["soak"], sourceName: "Soak runner", sourceUrl: "https://github.com/enliven17/kondora-sui" }),
    closeMs: Date.now() + Math.max(2 * 86400000, Math.ceil(minutes + 20) * 60000), initialPriceBps: 5000, seed: 500_000_000n,
  }));
  report.marketId = (await readAllMarkets()).at(-1)!.id;
  } else {
    report.marketId = JSON.parse(fs.readFileSync(path.join(outDir, "summary.json"), "utf8")).marketId;
    console.log(`Resuming market ${report.marketId}`);
  }
  for (const key of wallets) {
    const previous = resumeDir ? await readAccount(key.toSuiAddress()) : null;
    if (previous?.id && (previous.user!.balance > 0n || previous.user!.positions.length > 0)) continue;
    if (!resumeDir) {
    const tx = new Transaction(); tx.transferObjects([coinWithBalance({ balance: 150_000_000n })], key.toSuiAddress());
    await send("fund-gas", tx);
    await send("mint-collateral", mintTransaction(), key);
    await send("create-account", setupTransaction(key.toSuiAddress(), null, 0n), key);
    }
    const account = await readAccount(key.toSuiAddress());
    assert(account.id);
    await send("deposit", setupTransaction(key.toSuiAddress(), account.id, 100_000_000n), key);
  }
  const deadline = Date.now() + minutes * 60000;
  const baseline = 500_000_000n + BigInt(walletCount) * 1_000_000_000n;
  while (!interrupted && Date.now() < deadline && report.rounds < maxRounds) {
    for (const [index, key] of wallets.entries()) {
      if (interrupted) break;
      const snap = await readAccount(key.toSuiAddress());
      assert(snap.id && snap.user);
      const positions = snap.user.positions.filter((p) => p.market_id === report.marketId);
      if (positions.length) {
        for (const p of positions) {
          const tx = newTransaction();
          tx.moveCall({ target: target("close_position"), arguments: [tx.object(snap.id), tx.object(report.marketId), tx.pure.u8(p.side), tx.pure.u64(10000), tx.pure.u64(0), tx.object(CLOCK_ID)] });
          await send("close", tx, key);
        }
      } else {
        const market = toMarketAccount(await readSuiMarket(report.marketId));
        const pool = poolOf(market), side = ((report.rounds + index) % 2) as amm.Side;
        const margin = 250000;
        const cap = amm.maxLeverageBps(50000, Number(market.close_time) - Date.now() / 1000, 86400, amm.priceOf(pool, 0), 3600);
        const lev = Math.min(10000 + ((report.rounds + index) % 3) * 10000, cap);
        const q = amm.quoteOpen(pool, side, margin, lev);
        if (!q?.reserved || amm.isLiquidatable(q.after, side, q.shares, q.debt)) { log({ action: "risk-skip", side, lev }); continue; }
        const tx = newTransaction();
        tx.moveCall({ target: target("open_position"), arguments: [tx.object(snap.id), tx.object(report.marketId), tx.pure.u8(side), tx.pure.u64(margin), tx.pure.u64(lev), tx.pure.u64(BigInt(q.shares) * 9900n / 10000n), tx.object(CLOCK_ID)] });
        await send("open", tx, key);
      }
    }
    const market = await readSuiMarket(report.marketId);
    let total = BigInt(market.vault), yes = 0n, no = 0n, debt = 0n;
    for (const key of wallets) {
      const account = await readAccount(key.toSuiAddress());
      total += account.usdc + (account.user?.balance ?? 0n);
      for (const p of account.user!.positions.filter((p) => p.market_id === report.marketId)) { if (p.side === 0) yes += p.shares; else no += p.shares; debt += p.debt; }
    }
    assert.equal(total, baseline, "Collateral conservation failed");
    assert.equal(yes, BigInt(market.liability_yes), "YES shares differ from liabilities");
    assert.equal(no, BigInt(market.liability_no), "NO shares differ from liabilities");
    assert.equal(debt, BigInt(market.debt), "Position debt differs from market debt");
    assert(BigInt(market.vault) >= yes + no, "Outcome claims are under-reserved");
    report.checks += 5;
    if (report.rounds % 5 === 0) {
      const victim = await readAccount(wallets[0].toSuiAddress());
      const tx = newTransaction(); tx.setSender(donor.toSuiAddress());
      tx.moveCall({ target: target("withdraw"), arguments: [tx.object(victim.id!), tx.pure.u64(1)] });
      const attack = await sui.simulateTransaction({ transaction: tx });
      assert(attack.FailedTransaction, "Unauthorized withdrawal succeeded"); report.rejectedAttacks++;
    }
    report.rounds++;
    console.log(`round=${report.rounds} tx=${report.transactions} checks=${report.checks} failures=${report.failures}`);
    fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(report, null, 2));
    if (interval) await new Promise((resolve) => setTimeout(resolve, interval));
  }
  // Finish with user funds in their own generated wallets when market time permits.
  for (const key of wallets) {
    let snap = await readAccount(key.toSuiAddress());
    const market = await readSuiMarket(report.marketId);
    if (Number(market.close_ms) <= Date.now() || market.state !== 0) continue;
    for (const p of snap.user!.positions.filter((p) => p.market_id === report.marketId)) {
      const tx = newTransaction(); tx.moveCall({ target: target("close_position"), arguments: [tx.object(snap.id!), tx.object(report.marketId), tx.pure.u8(p.side), tx.pure.u64(10000), tx.pure.u64(0), tx.object(CLOCK_ID)] });
      await send("cleanup-close", tx, key);
    }
    snap = await readAccount(key.toSuiAddress());
    if (snap.user!.balance > 0n) {
      const tx = newTransaction(); tx.moveCall({ target: target("withdraw"), arguments: [tx.object(snap.id!), tx.pure.u64(snap.user!.balance)] });
      await send("cleanup-withdraw", tx, key);
    }
  }
} catch (error) {
  report.failures++; report.errors.push(error instanceof Error ? error.message : String(error)); process.exitCode = 1;
  log({ action: "failure", error: report.errors.at(-1) }); console.error(report.errors.at(-1));
} finally {
  report.completedAt = new Date().toISOString(); report.stopped = interrupted;
  const latencies = [...report.latencies].sort((a, b) => a - b);
  const final = { ...report, latencyP50Ms: latencies[Math.floor(latencies.length * .5)] ?? 0, latencyP95Ms: latencies[Math.floor(latencies.length * .95)] ?? 0 };
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(final, null, 2));
  console.log(`Report: ${outDir}/summary.json`);
  console.log(`Resume wallets: ${keyDir} (private, ignored by git)`);
}
