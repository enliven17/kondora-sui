import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { sui } from "../lib/sui/client";
import { REGISTRY_ID } from "../lib/sui/config";
import { newTransaction, target } from "../lib/sui/transactions";
import { localWallet, execute } from "./wallet";

const creator = localWallet();
const role = (name: string) => {
  const file = `.keys/sui-${name}.key`;
  if (fs.existsSync(file)) return Ed25519Keypair.fromSecretKey(fs.readFileSync(file, "utf8").trim());
  const key = Ed25519Keypair.generate(); fs.writeFileSync(file, key.getSecretKey(), { mode: 0o600 }); return key;
};
const oracle = role("oracle"), auditor = role("auditor");
for (const key of [oracle, auditor]) {
  const gas = BigInt((await sui.getBalance({ owner: key.toSuiAddress() })).balance.balance);
  if (gas < 50_000_000n) {
    const tx = new Transaction(); tx.transferObjects([coinWithBalance({ balance: 150_000_000n })], key.toSuiAddress());
    console.log(`Funded Sui role: ${(await execute(tx, creator)).digest}`);
  }
}
const tx = newTransaction(); tx.moveCall({ target: target("set_oracle"), arguments: [tx.object(REGISTRY_ID), tx.pure.address(oracle.toSuiAddress())] });
console.log(`Oracle configured: ${(await execute(tx, creator)).digest}`);
const cli = path.resolve("node_modules/convex/bin/main.js");
const values: Record<string, string> = {
  SUI_CREATOR_SECRET: creator.getSecretKey(), SUI_ORACLE_SECRET: oracle.getSecretKey(),
  SUI_AUDITOR_SECRET: auditor.getSecretKey(), SUI_CRANK_SECRET: oracle.getSecretKey(),
};
const sourceIndex = process.argv.indexOf("--provider-env-file");
if (sourceIndex >= 0) {
  // Read only provider settings from the original deployment; never copy chain keys.
  const output = execFileSync(process.execPath, [cli, "env", "list", "--include-values", "--env-file", process.argv[sourceIndex + 1], "--prod"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && /^(?:(?:CREATOR|ORACLE|AUDIT|COUNCIL)_)?(?:GEMINI_|GROQ_|TOKEN_HARBOR_|PANDASCORE_)/.test(match[1])) {
      const raw = match[2]; values[match[1]] = raw.startsWith('"') ? JSON.parse(raw) : raw;
    }
  }
}
const file = ".keys/convex-sui.env";
fs.writeFileSync(file, Object.entries(values).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join("\n") + "\n", { mode: 0o600 });
execFileSync(process.execPath, [cli, "env", "set", "--from-file", file, "--force", "--deployment", "production"], { stdio: ["ignore", "pipe", "pipe"] });
console.log(`Configured ${Object.keys(values).length} server variables; secret values were not printed.`);
fs.writeFileSync("deployments/agents-testnet.json", JSON.stringify({ creator: creator.toSuiAddress(), oracle: oracle.toSuiAddress(), auditor: auditor.toSuiAddress(), crank: oracle.toSuiAddress(), providerVariables: Object.keys(values).filter((x) => !x.startsWith("SUI_")), configuredAt: new Date().toISOString() }, null, 2) + "\n");
