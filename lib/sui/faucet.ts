import { bcs } from "@mysten/sui/bcs";
import { ObjectError } from "@mysten/sui/client";
import { sui } from "./client";
import { CLOCK_ID, FAUCET_ID } from "./config";
import { newTransaction } from "./transactions";
export const DailyFaucetBCS = bcs.struct("DailyFaucet", { id: bcs.Address, sponsor: bcs.Address,
  claimed: bcs.struct("Table", { id: bcs.Address, size: bcs.u64() }), day: bcs.u64(), count: bcs.u64() });
export async function dailyFaucetState() {
  const objectId = process.env.SUI_DAILY_FAUCET_ID, packageId = process.env.SUI_DAILY_FAUCET_PACKAGE_ID;
  if (!objectId || !packageId) throw new Error("Daily faucet is not configured");
  const { object } = await sui.getObject({ objectId, include: { content: true } });
  if (object.type !== `${packageId}::kusd::DailyFaucet`) throw new Error("Unexpected daily faucet type");
  return DailyFaucetBCS.parse(object.content);
}
export async function lastDailyClaim(tableId: string, address: string): Promise<number | null> {
  try {
    const { dynamicField } = await sui.getDynamicField({ parentId: tableId, name: { type: "address", bcs: bcs.Address.serialize(address).toBytes() } });
    return Number(bcs.u64().parse(dynamicField.value.bcs));
  } catch (error) { if (error instanceof ObjectError && error.reason === "notFound") return null; throw error; }
}
export function dailyClaimTransaction(address: string, welcomeOnly: boolean) {
  const packageId = process.env.SUI_DAILY_FAUCET_PACKAGE_ID, objectId = process.env.SUI_DAILY_FAUCET_ID;
  if (!packageId || !objectId) throw new Error("Daily faucet is not configured");
  const tx = newTransaction();
  tx.moveCall({ target: `${packageId}::kusd::claim_daily`, arguments: [tx.object(objectId), tx.object(FAUCET_ID), tx.pure.address(address), tx.pure.bool(welcomeOnly), tx.object(CLOCK_ID)] });
  return tx;
}
