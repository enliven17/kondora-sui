import fs from "node:fs";
import path from "node:path";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getFaucetHost, requestSuiFromFaucetV3 } from "@mysten/sui/faucet";
import { readAccount } from "../lib/account";
import { poolOf } from "../lib/chain";
import { amm } from "../lib/kondora";
import { readAllMarkets, readSuiMarket, toMarketAccount } from "../lib/sui/read";
import { sui } from "../lib/sui/client";
import { transactionUrl } from "../lib/sui/config";
import { mintTransaction } from "../lib/sui/transactions";
import { claimPosition, closePosition, enableTrading, placeBet, withdraw, type TradeWallet } from "../lib/trade";
import { execute } from "../scripts/wallet";

const [command = "help", ...args] = process.argv.slice(2);
const keyFile = process.env.SUI_KEY_FILE || ".keys/agent.key";
if (command === "keygen") {
  if (fs.existsSync(keyFile)) throw new Error(`Key already exists at ${keyFile}`);
  const key = Ed25519Keypair.generate();
  fs.mkdirSync(path.dirname(keyFile), { recursive: true }); fs.writeFileSync(keyFile, key.getSecretKey(), { mode: 0o600 });
  console.log(`Saved ${keyFile}\nAddress: ${key.toSuiAddress()}`); process.exit(0);
}
if (command === "markets") { console.table((await readAllMarkets()).map((m) => ({ id: m.id, question: m.question, state: m.state, close: new Date(Number(m.close_ms)).toISOString() }))); process.exit(0); }
if (command === "help") {
  console.log("npm run agent -- keygen|faucet|mint|account|markets|setup <kUSD>|quote <marketId> <yes|no> <margin> [leverage]|bet <marketId> <yes|no> <margin> [leverage]|close <marketId> <yes|no>|claim <marketId>|withdraw <kUSD>\nSui testnet only. Set SUI_KEY_FILE or SUI_PRIVATE_KEY to use another local wallet."); process.exit(0);
}
const key = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY || fs.readFileSync(keyFile, "utf8").trim());
const owner = key.toSuiAddress();
const wallet: TradeWallet = { address: owner, execute: async (tx) => (await execute(tx, key)).digest };
if (command === "faucet") { console.log(await requestSuiFromFaucetV3({ host: getFaucetHost("testnet"), recipient: owner })); process.exit(0); }
if (command === "mint") { console.log(transactionUrl((await execute(mintTransaction(), key)).digest)); process.exit(0); }
const snap = await readAccount(owner);
if (command === "account") { console.log(JSON.stringify(snap, (_, value) => typeof value === "bigint" ? value.toString() : value, 2)); process.exit(0); }
let result;
if (command === "setup") result = await enableTrading({ wallet, snap, deposit: Number(args[0] ?? 20) });
else if (command === "withdraw") result = await withdraw({ wallet, snap, amount: Number(args[0]) });
else if (command === "claim") result = await claimPosition({ wallet, snap, marketId: args[0] });
else if (["bet", "quote", "close"].includes(command)) {
  const [id, sideText, marginText = "5", leverageText = "1"] = args;
  if (!["yes", "no"].includes(sideText)) throw new Error("Side must be yes or no");
  const side = sideText as "yes" | "no", margin = Number(marginText), leverage = Number(leverageText);
  const account = toMarketAccount(await readSuiMarket(id));
  const pool = poolOf(account), live = { account, pool, delegated: true, priceYes: amm.priceOf(pool, 0), floorL: 0, at: Date.now() / 1000 };
  if (command === "quote") { console.log(JSON.stringify(amm.quoteOpen(pool, side === "yes" ? 0 : 1, amm.micro(margin), Math.round(leverage * 10000)), (_, value) => typeof value === "bigint" ? value.toString() : value, 2)); process.exit(0); }
  if (command === "bet") result = await placeBet({ wallet, snap, live, side, margin, leverage });
  else {
    const position = snap.user?.positions.find((p) => p.market_id === id && p.side === (side === "yes" ? 0 : 1));
    if (!position) throw new Error("No position on this side");
    result = await closePosition({ wallet, snap, live, position });
  }
} else throw new Error("Unknown command. Run npm run agent -- help");
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
void sui;
