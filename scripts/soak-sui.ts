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
import { CLOCK_ID, PACKAGE_ID, REGISTRY_ID } from "../lib/sui/config";
import { TradeEventBCS } from "../lib/sui/schema";
import { checkMarketAccounting, selectSoakMarkets, soakAssignment } from "./soak-model";
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
const isolated = process.argv.includes("--isolated");
const marketLimit = Math.floor(option("--market-limit", 50, 1, 50));
const marketIndex = process.argv.indexOf("--markets");
const explicitMarkets = marketIndex < 0 ? [] : [...new Set((process.argv[marketIndex + 1] ?? "").toLowerCase().split(","))];
if (explicitMarkets.some(id => !/^0x[0-9a-f]{64}$/i.test(id))) throw new Error("--markets requires comma-separated Sui object IDs");
if (isolated && explicitMarkets.length) throw new Error("Choose --isolated or --markets");
const seed = BigInt(Math.round(option("--seed-kusd", walletCount > 20 ? 10000 : 500, 100, 50000) * 1e6));
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
type MarketActivity = { opens: number; closes: number; claims: number; notionalKusd: number };
const report = { network: "sui:testnet", startedAt: new Date().toISOString(), completedAt: "", minutes, walletCount, mode: isolated ? "isolated" : "public-markets", gasPerWallet: String(gasPerWallet), preparedWallets: 0, preparedOnly: prepareOnly, marketId: "", isolatedMarketId: "", marketIds: [] as string[], marketActivity: {} as Record<string,MarketActivity>, expectedWalletKusd: "", rounds: 0, transactions: 0, failures: 0, networkRetries: 0, checks: 0, rejectedAttacks: 0, stopped: false, gasMist: "0", errors: [] as string[], latencies: [] as number[] };
const summaryFile = path.join(outDir, "summary.json");
if (resumeDir) {
  const previous = JSON.parse(fs.readFileSync(summaryFile, "utf8"));
  assert.equal(previous.walletCount, walletCount, "Resume requires the original wallet count");
  report.marketId = previous.marketId;
  report.isolatedMarketId = previous.isolatedMarketId ?? (previous.marketIds ? "" : previous.marketId);
}
const manifest = wallets.map((key, index) => ({ index, address: key.toSuiAddress() }));
fs.writeFileSync(path.join(outDir, "wallets.json"), JSON.stringify(manifest, null, 2));
const checkpoint = () => fs.writeFileSync(summaryFile, JSON.stringify(report, null, 2));
const lockFile = path.join(outDir, "runner.lock");
if (fs.existsSync(lockFile)) {
  const pid = Number(fs.readFileSync(lockFile,"utf8"));
  let alive = false; try { process.kill(pid,0); alive = true; } catch { /* stale process */ }
  if (alive) throw new Error(`This wallet set is already in use by PID ${pid}. Stop that Sui runner before resuming.`);
  fs.unlinkSync(lockFile);
}
fs.writeFileSync(lockFile,String(process.pid),{flag:"wx"});
checkpoint();
const walletOwners = new Set(wallets.map(key=>key.toSuiAddress()));
let expectedWalletCash: bigint | null = null;
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
      if (attempt >= 5 || !/fetch failed|network|timeout|ECONN|ENOTFOUND|EAI_AGAIN|unavailable|DEADLINE|429|too many requests|rate.?limit|resource.exhausted/i.test(String(error))) throw error;
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
  const events = (result.events ?? []).filter(e=>e.eventType===`${PACKAGE_ID}::market::TradeEvent`).map(e=>TradeEventBCS.parse(e.bcs));
  for (const e of events) {
    if (expectedWalletCash !== null && walletOwners.has(e.owner)) expectedWalletCash += e.kind === 0 ? -BigInt(e.margin) : BigInt(e.margin);
    const activity = report.marketActivity[e.market_id] ??= {opens:0,closes:0,claims:0,notionalKusd:0};
    if(e.kind===0){activity.opens++;activity.notionalKusd+=Number(e.margin)*Number(e.leverage_bps)/10000/1e6;}
    else if(e.kind===3)activity.claims++;else activity.closes++;
  }
  const marketIds = [...new Set(events.map(e=>e.market_id))];
  if(expectedWalletCash!==null)report.expectedWalletKusd=String(expectedWalletCash);
  log({ action, owner: key.toSuiAddress(), marketIds, digest: result.digest, latencyMs });
  console.log(`${action}${marketIds.length?` [${marketIds.map(id=>id.slice(0,10)).join(",")}]`:""}: ${result.digest} (${latencyMs}ms)`);
}
try {
  const donorGas = BigInt((await retryRead(() => sui.getBalance({ owner: donor.toSuiAddress() }))).balance.balance);
  assert(donorGas > 100_000_000n, "Deployer needs at least 0.1 test SUI reserve.");
  if (isolated && !report.isolatedMarketId) {
  await send("mint-seed", mintTransaction(Number((seed + 999_999_999n) / 1_000_000_000n)));
  await send("create-soak-market", createMarketTransaction({ question: `Will Sui soak run ${run.slice(0, 16)} complete its checks?`,
    summary: "Automated testnet stress scenario. Not a real-world prediction.", category: "tech", rules: ["Testnet scenario; evidence is the local soak report."],
    resolution: JSON.stringify({ key: `soak-${run}`, tags: ["soak"], sourceName: "Soak runner", sourceUrl: "https://github.com/enliven17/kondora-sui" }),
    closeMs: Date.now() + Math.max(2 * 86400000, Math.ceil(minutes + 20) * 60000), initialPriceBps: 5000, seed,
  }));
  const created = (await retryRead(() => readAllMarkets())).find(m => {
    try { return JSON.parse(m.resolution).key === `soak-${run}`; } catch { return false; }
  });
  assert(created, "Created soak market was not indexed by the RPC");
  report.marketId = created.id;
  report.isolatedMarketId = created.id;
  checkpoint();
  }
  const chooseMarkets = async () => {
    const all = await retryRead(()=>readAllMarkets());
    const selected = selectSoakMarkets(all,Date.now(),isolated?[report.isolatedMarketId]:explicitMarkets,marketLimit);
    assert(selected.length,"No open markets available for this soak. Pick open object IDs with --markets or use --isolated.");
    report.marketIds=selected.map(m=>m.id);report.marketId=report.marketIds[0];
    return selected;
  };
  const selected = await chooseMarkets();
  console.log(`Selected ${selected.length} ${isolated?"isolated":"existing"} markets; preparing ${walletCount} wallets`);
  for(const market of selected)console.log(`  ${market.id} ${market.question}`);
  checkpoint();
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
  const accountSnapshots = () => mapLimited(wallets,setupConcurrency,key=>readAccount(key.toSuiAddress()));
  const cashOf = (snapshots: Awaited<ReturnType<typeof accountSnapshots>>) => snapshots.reduce((sum,a)=>sum+a.usdc+(a.user?.balance??0n),0n);
  const initialSnapshots = await accountSnapshots();
  expectedWalletCash = cashOf(initialSnapshots);
  report.expectedWalletKusd = String(expectedWalletCash);
  if(isolated)assert(initialSnapshots.every(a=>a.user!.positions.every(p=>p.market_id===report.isolatedMarketId)),"Isolated mode requires wallets without positions in other markets. Resume without --isolated to recover them.");
  const isolatedBaseline = isolated ? expectedWalletCash + BigInt((await readSuiMarket(report.isolatedMarketId)).vault) : null;
  const verifyAccounting = async () => {
    let snapshots = await accountSnapshots();
    for(let attempt=0;cashOf(snapshots)!==expectedWalletCash&&attempt<3;attempt++){
      await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));snapshots=await accountSnapshots();
    }
    assert.equal(cashOf(snapshots),expectedWalletCash,"Wallet cash differs from signed transaction events; check for another runner or external wallet transfers");
    report.checks++;
    const ownByMarket = new Map<string,{yes:bigint;no:bigint;debt:bigint}>();
    for(const account of snapshots)for(const p of account.user!.positions){
      const own=ownByMarket.get(p.market_id)??{yes:0n,no:0n,debt:0n};
      if(p.side===0)own.yes+=p.shares;else own.no+=p.shares;own.debt+=p.debt;ownByMarket.set(p.market_id,own);
    }
    const markets=await retryRead(()=>readAllMarkets());
    const watched=new Set([...report.marketIds,...Object.keys(report.marketActivity),...ownByMarket.keys()]);
    for(const id of watched){
      const market=markets.find(m=>m.id===id);assert(market,`Missing market ${id}`);
      checkMarketAccounting(market,ownByMarket.get(id)??{yes:0n,no:0n,debt:0n},isolated&&id===report.isolatedMarketId);
      report.checks+=4;
    }
    if(isolated){
      const market=markets.find(m=>m.id===report.isolatedMarketId)!;
      assert.equal(cashOf(snapshots)+BigInt(market.vault),isolatedBaseline,"Isolated collateral conservation failed");report.checks++;
    }
  };
  await verifyAccounting();
  while (!interrupted && Date.now() < deadline && report.rounds < maxRounds) {
    const liveCandidates = await chooseMarkets();
    for (const [index, key] of wallets.entries()) {
      if (interrupted) break;
      const snap = await readAccount(key.toSuiAddress());
      assert(snap.id && snap.user);
      let unwound = false;
      for (const id of new Set(snap.user.positions.map(p=>p.market_id))) {
        const market = await readSuiMarket(id);
        if(market.state===4){
          const tx=newTransaction();tx.moveCall({target:target("claim"),arguments:[tx.object(snap.id),tx.object(id),tx.object(CLOCK_ID)]});
          await send("claim",tx,key);unwound=true;continue;
        }
        if(market.state!==0||Number(market.close_ms)<=Date.now()){log({action:"awaiting-settlement",owner:key.toSuiAddress(),marketId:id});continue;}
        for(const p of snap.user.positions.filter(p=>p.market_id===id)){
          const tx = newTransaction();
          tx.moveCall({ target: target("close_position"), arguments: [tx.object(snap.id), tx.object(id), tx.pure.u8(p.side), tx.pure.u64(10000), tx.pure.u64(0), tx.object(CLOCK_ID)] });
          await send("close", tx, key);unwound=true;
        }
      }
      if(unwound)continue;
      const assignment = soakAssignment(index,report.rounds,liveCandidates.length);
      for(let offset=0;offset<liveCandidates.length;offset++){
        const selected=liveCandidates[(assignment.marketIndex+offset)%liveCandidates.length];
        if(snap.user.positions.some(p=>p.market_id===selected.id))continue;
        const current=await readSuiMarket(selected.id);
        if(current.state!==0||Number(current.close_ms)<=Date.now()+60000)continue;
        const market = toMarketAccount(current);
        const pool = poolOf(market), side = assignment.side;
        const margin = 250000;
        if(snap.user.balance<BigInt(margin)){log({action:"insufficient-margin",owner:key.toSuiAddress()});break;}
        const cap = amm.maxLeverageBps(50000, Number(market.close_time) - Date.now() / 1000, 86400, amm.priceOf(pool, 0), 3600);
        const lev = Math.min(assignment.leverageBps, cap);
        const q = amm.quoteOpen(pool, side, margin, lev);
        if (!q?.reserved || amm.isLiquidatable(q.after, side, q.shares, q.debt)) { log({ action: "risk-skip", marketId:selected.id, side, lev }); continue; }
        const tx = newTransaction();
        tx.moveCall({ target: target("open_position"), arguments: [tx.object(snap.id), tx.object(selected.id), tx.pure.u8(side), tx.pure.u64(margin), tx.pure.u64(lev), tx.pure.u64(BigInt(q.shares) * 9900n / 10000n), tx.object(CLOCK_ID)] });
        await send("open", tx, key);
        break;
      }
    }
    if (interrupted) break;
    await verifyAccounting();
    if (report.rounds % 5 === 0) {
      const victim = await readAccount(wallets[0].toSuiAddress());
      const tx = newTransaction(); tx.setSender(donor.toSuiAddress());
      tx.moveCall({ target: target("withdraw"), arguments: [tx.object(victim.id!), tx.pure.u64(1)] });
      const attack = await sui.simulateTransaction({ transaction: tx });
      assert(attack.FailedTransaction, "Unauthorized withdrawal succeeded"); report.rejectedAttacks++;
    }
    report.rounds++;
    console.log(`round=${report.rounds} marketsTraded=${Object.keys(report.marketActivity).length} tx=${report.transactions} checks=${report.checks} failures=${report.failures}`);
    for(const [id,a] of Object.entries(report.marketActivity))console.log(`  ${id} opens=${a.opens} closes=${a.closes} claims=${a.claims}`);
    fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(report, null, 2));
    if (interval) await new Promise((resolve) => setTimeout(resolve, interval));
  }
  // Finish with user funds in their own generated wallets when market time permits.
  for (const key of wallets) {
    let snap = await readAccount(key.toSuiAddress());
    for(const id of new Set(snap.user!.positions.map(p=>p.market_id))){
      const market = await readSuiMarket(id);
      if(market.state===4){
        const tx=newTransaction();tx.moveCall({target:target("claim"),arguments:[tx.object(snap.id!),tx.object(id),tx.object(CLOCK_ID)]});
        await send("cleanup-claim",tx,key);continue;
      }
      if (Number(market.close_ms) <= Date.now() || market.state !== 0) continue;
      for (const p of snap.user!.positions.filter((p) => p.market_id === id)) {
        const tx = newTransaction(); tx.moveCall({ target: target("close_position"), arguments: [tx.object(snap.id!), tx.object(id), tx.pure.u8(p.side), tx.pure.u64(10000), tx.pure.u64(0), tx.object(CLOCK_ID)] });
        await send("cleanup-close", tx, key);
      }
    }
    snap = await readAccount(key.toSuiAddress());
    if (snap.user!.balance > 0n) {
      const tx = newTransaction(); tx.moveCall({ target: target("withdraw"), arguments: [tx.object(snap.id!), tx.pure.u64(snap.user!.balance)] });
      await send("cleanup-withdraw", tx, key);
    }
  }
  if(!interrupted)await verifyAccounting();
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
  fs.unlinkSync(lockFile);
}
