import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { sui } from "../lib/sui/client";
import { REGISTRY_ID } from "../lib/sui/config";
import { localWallet, execute } from "./wallet";
import upgrade from "../deployments/daily-faucet-package-testnet.json";
const keyFile = ".keys/sui-faucet.key";
const key = fs.existsSync(keyFile) ? Ed25519Keypair.fromSecretKey(fs.readFileSync(keyFile, "utf8").trim()) : Ed25519Keypair.generate();
if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, key.getSecretKey(), { mode: 0o600 });
const receiptFile = "deployments/daily-faucet-testnet.json";
let receipt: {packageId:string; dailyFaucetId:string; sponsor:string; createDigest:string; amountKusd:number; cooldownHours:number; configuredAt:string};
if (fs.existsSync(receiptFile)) receipt = JSON.parse(fs.readFileSync(receiptFile, "utf8"));
else {
  const tx = new Transaction();
  tx.moveCall({ target: `${upgrade.packageId}::market::create_daily_faucet`, arguments: [tx.object(REGISTRY_ID), tx.pure.address(key.toSuiAddress())] });
  const result = await execute(tx, localWallet());
  const daily = Object.entries(result.objectTypes).find(([,type])=> type === `${upgrade.packageId}::kusd::DailyFaucet`);
  if (!daily) throw new Error("Missing created daily faucet object");
  receipt = {packageId:upgrade.packageId,dailyFaucetId:daily[0],sponsor:key.toSuiAddress(),createDigest:result.digest,amountKusd:100,cooldownHours:24,configuredAt:new Date().toISOString()};
  fs.writeFileSync(receiptFile, JSON.stringify(receipt,null,2)+"\n");
}
const gas = BigInt((await sui.getBalance({owner:key.toSuiAddress()})).balance.balance);
if (gas < 50_000_000n) {
  const tx = new Transaction(); tx.transferObjects([coinWithBalance({balance:300_000_000n})], key.toSuiAddress());
  console.log(`Faucet gas funded: ${(await execute(tx,localWallet())).digest}`);
}
const values = { SUI_FAUCET_SECRET:key.getSecretKey(),SUI_DAILY_FAUCET_ID:receipt.dailyFaucetId,SUI_DAILY_FAUCET_PACKAGE_ID:receipt.packageId };
const envFile=".keys/convex-faucet.env";
fs.writeFileSync(envFile,Object.entries(values).map(([name,value])=>`${name}=${JSON.stringify(value)}`).join("\n")+"\n",{mode:0o600});
execFileSync(process.execPath,[path.resolve("node_modules/convex/bin/main.js"),"env","set","--from-file",envFile,"--force","--deployment","production"],{stdio:["ignore","pipe","pipe"]});
console.log(JSON.stringify(receipt,null,2));
console.log("Configured faucet sponsor and IDs; secret values were not printed.");
