import fs from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import deployment from "../deployments/testnet.json";
import { sui } from "../lib/sui/client";
import { localWallet, execute } from "./wallet";

const argument = (name: string, fallback: string) => { const i = process.argv.indexOf(name); if (i >= 0 && (!process.argv[i + 1] || process.argv[i + 1].startsWith("--"))) throw new Error(`${name} needs a path`); return i < 0 ? fallback : process.argv[i + 1]; };
const receiptFile = argument("--receipt", "deployments/upgrade-testnet.json");
const baseFile = argument("--base-receipt", "deployments/testnet.json");
const previousPackageId: string = JSON.parse(fs.readFileSync(baseFile, "utf8")).packageId;
if (fs.existsSync(receiptFile)) {
  console.log(`Upgrade already recorded: ${JSON.parse(fs.readFileSync(receiptFile, "utf8")).packageId}`);
  process.exit(0);
}
const key = localWallet();
assert.equal(key.toSuiAddress(), deployment.deployer, "Use this fork's deployer");
const Cap = bcs.struct("UpgradeCap", { id: bcs.Address, package: bcs.Address, version: bcs.u64(), policy: bcs.u8() });
const { objects } = await sui.listOwnedObjects({ owner: key.toSuiAddress(), type: "0x2::package::UpgradeCap", include: { content: true }, limit: 50 });
const cap = objects.map(o => Cap.parse(o.content)).find(c => c.package === previousPackageId);
assert(cap, "No upgrade capability for the existing package");
const output = execFileSync(process.platform === "win32" ? "sui.exe" : "sui", ["move", "build", "--path", "move/kondora", "--dump-bytecode-as-base64", "--ignore-chain"], { encoding: "utf8", maxBuffer: 8_000_000 });
const built = JSON.parse(output.slice(output.indexOf("{"))) as { modules: string[]; dependencies: string[]; digest: number[] };
assert(built.modules.length === 2 && built.digest.length === 32);
const tx = new Transaction(); tx.setSender(key.toSuiAddress());
const ticket = tx.moveCall({ target: "0x2::package::authorize_upgrade", arguments: [tx.object(cap.id), tx.pure.u8(cap.policy), tx.pure.vector("u8", built.digest)] });
const upgrade = tx.upgrade({ modules: built.modules, dependencies: built.dependencies, package: previousPackageId, ticket });
tx.moveCall({ target: "0x2::package::commit_upgrade", arguments: [tx.object(cap.id), upgrade] });
const simulation = await sui.simulateTransaction({ transaction: tx });
if (simulation.FailedTransaction) throw new Error(`Upgrade compatibility simulation failed: ${simulation.FailedTransaction.status.error?.message}`);
console.log("Compatible upgrade simulation passed");
const result = await execute(tx, key);
const { object } = await sui.getObject({ objectId: cap.id, include: { content: true } });
const updated = Cap.parse(object.content);
assert.notEqual(updated.package, previousPackageId);
const receipt = { network: "testnet", basePackageId: previousPackageId, packageId: updated.package, upgradeCapId: cap.id, version: updated.version,
  digest: result.digest, bytecodeDigest: built.digest, upgradedAt: new Date().toISOString(), registryId: deployment.registryId, faucetId: deployment.faucetId };
fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt, null, 2));
