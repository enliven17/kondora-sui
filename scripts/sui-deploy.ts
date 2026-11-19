import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { requestSuiFromFaucetV3, getFaucetHost } from "@mysten/sui/faucet";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";

const root = process.cwd();
const keys = path.join(root, ".keys");
fs.mkdirSync(keys, { recursive: true });
const walletPath = path.join(keys, "sui-deployer.key");
const wallet = fs.existsSync(walletPath) ? Ed25519Keypair.fromSecretKey(fs.readFileSync(walletPath, "utf8").trim()) : Ed25519Keypair.generate();
if (!fs.existsSync(walletPath)) fs.writeFileSync(walletPath, wallet.getSecretKey(), { mode: 0o600 });
const client = new SuiGrpcClient({ network: "testnet", baseUrl: "https://fullnode.testnet.sui.io:443" });
const address = wallet.toSuiAddress();
console.log(`Isolated testnet deployer: ${address}`);
const { balance } = await client.getBalance({ owner: address });
if (BigInt(balance.balance) < 200_000_000n) {
  await requestSuiFromFaucetV3({ host: getFaucetHost("testnet"), recipient: address });
  console.log("Testnet faucet requested");
}
const existing = JSON.parse(fs.readFileSync("deployments/testnet.json", "utf8"));
if (existing.packageId && !process.argv.includes("--republish")) {
  console.log(`Existing package: ${existing.packageId}. Use --republish only for an intentional new package.`);
  process.exit(0);
}
// CLI 1.x's bytecode-dump path still requires the retired JSON-RPC transport.
// Build offline, then publish the compiler's exact modules through SDK gRPC.
execFileSync(process.platform === "win32" ? "sui.exe" : "sui", ["move", "build", "--path", "move/kondora"], { cwd: root, stdio: "inherit" });
const modulesDir = path.join(root, "move/kondora/build/kondora/bytecode_modules");
const built = { modules: fs.readdirSync(modulesDir).filter((f) => f.endsWith(".mv")).sort().map((f) => fs.readFileSync(path.join(modulesDir, f)).toString("base64")), dependencies: ["0x1", "0x2"] };
const tx = new Transaction();
const [cap] = tx.publish({ modules: built.modules, dependencies: built.dependencies });
tx.transferObjects([cap], address);
const result = await client.signAndExecuteTransaction({ signer: wallet, transaction: tx, include: { effects: true, objectTypes: true } });
if (result.FailedTransaction) throw new Error(result.FailedTransaction.status.error?.message ?? "Publish failed");
await client.waitForTransaction({ digest: result.Transaction.digest });
const types = Object.entries(result.Transaction.objectTypes);
const registry = types.find(([, type]) => type.endsWith("::market::Registry"));
const faucet = types.find(([, type]) => type.endsWith("::kusd::Faucet"));
if (!registry || !faucet) throw new Error(`Missing deployment objects in ${result.Transaction.digest}`);
const record = {
  network: "testnet", packageId: registry[1].split("::")[0], registryId: registry[0], faucetId: faucet[0],
  deployer: address, publishDigest: result.Transaction.digest, deployedAt: new Date().toISOString(),
};
fs.writeFileSync("deployments/testnet.json", JSON.stringify(record, null, 2) + "\n");
console.log(JSON.stringify(record, null, 2));
