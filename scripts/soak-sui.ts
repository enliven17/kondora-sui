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
import { CLOCK_ID, REGISTRY_ID } from "../lib/sui/config";
import { readAllMarkets, readSuiMarket as chainReadMarket, toMarketAccount } from "../lib/sui/read";
import { createMarketTransaction, mintTransaction, newTransaction, setupTransaction, target } from "../lib/sui/transactions";

function option(name: string, fallback: number, min: number, max: number) {
  const i = process.argv.indexOf(name), value = i < 0 ? fallback : Number(process.argv[i + 1]);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be ${min}..${max}`);
  return value;
}
const minutes = option("--minutes", 30, 0.1, 43200);
const walletCount = Math.floor(option("--wallets", 4, 1, 200));
const gasPerWallet = BigInt(Math.round(option("--gas-per-wallet", walletCount > 20 ? 0.02 : 0.15, 0.01, 10) * 1e9));
const setupConcurrency = Math.floor(option("--setup-concurrency", 2, 1, 8));
const prepareOnly = process.argv.includes("--prepare-only");
const interval = option("--interval-ms", 2500, 0, 60000);
const maxRounds = option("--rounds", Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER);
const resumeIndex = process.argv.indexOf("--resume");
const resumeDir = resumeIndex >= 0 ? process.argv[resumeIndex + 1] : null;
if (resumeIndex >= 0 && (!resumeDir || resumeDir.startsWith("--"))) throw new Error("--resume requires a .soak/sui-TIMESTAMP directory");
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
const report = { network: "sui:testnet", startedAt: new Date().toISOString(), completedAt: "", minutes, walletCount, gasPerWallet: String(gasPerWallet), preparedWallets: 0, preparedOnly: prepareOnly, marketId: "", rounds: 0, transactions: 0, failures: 0, networkRetries: 0, checks: 0, rejectedAttacks: 0, stopped: false, gasMist: "0", errors: [] as string[], latencies: [] as number[] };
const summaryFile = path.join(outDir, "summary.json");
if (resumeDir) {
  const previous = JSON.parse(fs.readFileSync(summaryFile, "utf8"));
  assert.equal(previous.walletCount, walletCount, "Resume requires the original wallet count");
  report.marketId = previous.marketId;
}
const manifest = wallets.map((key, index) => ({ index, address: key.toSuiAddress() }));
fs.writeFileSync(path.join(outDir, "wallets.json"), JSON.stringify(manifest, null, 2));
const checkpoint = () => fs.writeFileSync(summaryFile, JSON.stringify(report, null, 2));
checkpoint();
async function mapLimited<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0, failure: unknown;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length && !failure && !interrupted) {
      const index = next++;
      try { results[index] = await fn(items[index], index); } catch (error) { failure = error; }
    }
  }));
  if (failure) throw failure;
  if (interrupted) throw new Error("Stopped during setup/read checks");
  return results;
}
async function retryRead<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await fn(); }
    catch (error) {
      if (attempt >= 5 || !/fetch failed|network|timeout|ECONN|unavailable|DEADLINE|429|too many requests|rate.?limit|resource.exhausted/i.test(String(error))) throw error;
      report.networkRetries++; console.log(`Read transport retry ${attempt + 1}/5`);
      await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
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
  assert(donorGas > 100_000_000n, "Deployer needs at least 0.1 test SUI reserve.");
  if (!report.marketId) {
  await send("mint-seed", mintTransaction());
  await send("create-soak-market", createMarketTransaction({ question: `Will Sui soak run ${run.slice(0, 16)} complete its checks?`,
    summary: "Automated testnet stress scenario. Not a real-world prediction.", category: "tech", rules: ["Testnet scenario; evidence is the local soak report."],
    resolution: JSON.stringify({ key: `soak-${run}`, tags: ["soak"], sourceName: "Soak runner", sourceUrl: "https://github.com/enliven17/kondora-sui" }),
    closeMs: Date.now() + Math.max(2 * 86400000, Math.ceil(minutes + 20) * 60000), initialPriceBps: 5000, seed: 500_000_000n,
  }));
  const created = (await retryRead(() => readAllMarkets())).find(m => {
    try { return JSON.parse(m.resolution).key === `soak-${run}`; } catch { return false; }
  });
  assert(created, "Created soak market was not indexed by the RPC");
  report.marketId = created.id;
  checkpoint();
  }
  console.log(`Market ${report.marketId}; preparing ${walletCount} wallets`);
  const balances = await mapLimited(wallets, setupConcurrency, key => retryRead(() => sui.getBalance({ owner: key.toSuiAddress() })));
  const funding = wallets.flatMap((key, i) => {
    const balance = BigInt(balances[i].balance.balance);
    // New wallets receive the chosen budget. Resumed wallets are topped up only when nearly empty.
    return balance < (resumeDir ? 5_000_000n : gasPerWallet) ? [{ owner: key.toSuiAddress(), amount: gasPerWallet - balance }] : [];
  });
  const requiredGas = funding.reduce((sum, row) => sum + row.amount, 100_000_000n);
  assert(donorGas > requiredGas, `Need ${Number(requiredGas) / 1e9} test SUI including donor reserve; available ${Number(donorGas) / 1e9}. Resume this run after funding.`);
  for (let offset = 0; offset < funding.length; offset += 25) {
    const tx = new Transaction();
    for (const row of funding.slice(offset, offset + 25)) {
      tx.transferObjects([coinWithBalance({ balance: row.amount })], row.owner);
    }
    await send(`fund-gas-batch-${offset / 25 + 1}`, tx);
  }
  await mapLimited(wallets, setupConcurrency, async (key, index) => {
    let account = await readAccount(key.toSuiAddress());
    if (!account.id) {
      const tx = mintTransaction();
      tx.moveCall({ target: target("create_account"), arguments: [tx.object(REGISTRY_ID)] });
      await send("mint-and-create-account", tx, key);
      account = await readAccount(key.toSuiAddress());
    }
    assert(account.id);
    if (account.usdc + account.user!.balance === 0n && account.user!.positions.length === 0) {
      await send("mint-collateral", mintTransaction(), key);
      account = await readAccount(key.toSuiAddress());
    }
    if (account.user!.balance === 0n && account.user!.positions.length === 0) {
      await send("deposit", setupTransaction(key.toSuiAddress(), account.id, 100_000_000n), key);
    }
    report.preparedWallets++;
    checkpoint();
    console.log(`prepared=${report.preparedWallets}/${walletCount} wallet=${index}`);
  });
  if (prepareOnly) { console.log("Wallet preparation complete; trading has not started."); }
  else {
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
    const snapshots = await mapLimited(wallets, setupConcurrency, key => readAccount(key.toSuiAddress()));
    for (const account of snapshots) {
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
  }
} catch (error) {
  if (interrupted) { log({ action: "stopped" }); }
  else {
    report.failures++; report.errors.push(error instanceof Error ? error.message : String(error)); process.exitCode = 1;
    log({ action: "failure", error: report.errors.at(-1) }); console.error(report.errors.at(-1));
  }
} finally {
  report.completedAt = new Date().toISOString(); report.stopped = interrupted;
  const latencies = [...report.latencies].sort((a, b) => a - b);
  const final = { ...report, latencyP50Ms: latencies[Math.floor(latencies.length * .5)] ?? 0, latencyP95Ms: latencies[Math.floor(latencies.length * .95)] ?? 0 };
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(final, null, 2));
  console.log(`Report: ${outDir}/summary.json`);
  console.log(`Resume wallets: ${keyDir} (private, ignored by git)`);
}
