import deployment from "../../deployments/testnet.json";
export const NETWORK = "testnet" as const;
export const SUI_RPC = process.env.NEXT_PUBLIC_SUI_RPC || "https://fullnode.testnet.sui.io:443";
export const PACKAGE_ID = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID || deployment.packageId;
export const REGISTRY_ID = process.env.NEXT_PUBLIC_SUI_REGISTRY_ID || deployment.registryId;
export const FAUCET_ID = process.env.NEXT_PUBLIC_SUI_FAUCET_ID || deployment.faucetId;
export const COIN_TYPE = `${PACKAGE_ID}::kusd::KUSD`;
export const CLOCK_ID = "0x6";
export const SUI_CONFIGURED = Boolean(PACKAGE_ID && REGISTRY_ID && FAUCET_ID);
export const objectUrl = (id: string) => `https://testnet.suivision.xyz/object/${id}`;
export const transactionUrl = (digest: string) => `https://testnet.suivision.xyz/txblock/${digest}`;
export function requireDeployment() {
  if (!SUI_CONFIGURED) throw new Error("Publish the Move package with npm run sui:deploy first.");
}
