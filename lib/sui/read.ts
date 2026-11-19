import { bcs } from "@mysten/sui/bcs";
import { ObjectError } from "@mysten/sui/client";
import type { MarketAccount } from "../kondora";
import { sui } from "./client";
import { COIN_TYPE, PACKAGE_ID, REGISTRY_ID, SUI_CONFIGURED } from "./config";
import { AccountBCS, MarketBCS, RegistryBCS, type SuiMarket } from "./schema";

export async function readRegistry() {
  const { object } = await sui.getObject({ objectId: REGISTRY_ID, include: { content: true } });
  if (object.type !== `${PACKAGE_ID}::market::Registry`) throw new Error("Unexpected registry type");
  return RegistryBCS.parse(object.content);
}
export async function readSuiMarket(id: string): Promise<SuiMarket> {
  const { object } = await sui.getObject({ objectId: id, include: { content: true } });
  if (object.type !== `${PACKAGE_ID}::market::Market`) throw new Error("Unexpected market type");
  return MarketBCS.parse(object.content);
}
export async function readAllMarkets(): Promise<SuiMarket[]> {
  if (!SUI_CONFIGURED) return [];
  const registry = await readRegistry();
  const result: SuiMarket[] = [];
  for (let i = 0; i < registry.markets.length; i += 50) {
    const { objects } = await sui.getObjects({ objectIds: registry.markets.slice(i, i + 50), include: { content: true } });
    for (const object of objects) {
      if (object instanceof Error) throw object;
      if (object.type !== `${PACKAGE_ID}::market::Market`) throw new Error("Unexpected market type");
      result.push(MarketBCS.parse(object.content));
    }
  }
  return result;
}
export async function readTradingAccount(owner: string) {
  const registry = await readRegistry();
  if (BigInt(registry.accounts.size) === 0n) return null;
  try {
    const { dynamicField } = await sui.getDynamicField({ parentId: registry.accounts.id,
      name: { type: "address", bcs: bcs.Address.serialize(owner).toBytes() } });
    const id = bcs.Address.parse(dynamicField.value.bcs);
    const { object } = await sui.getObject({ objectId: id, include: { content: true } });
    if (object.type !== `${PACKAGE_ID}::market::Account`) throw new Error("Unexpected account type");
    const account = AccountBCS.parse(object.content);
    if (account.owner !== owner) throw new Error("Account owner mismatch");
    return account;
  } catch (error) {
    if (error instanceof ObjectError && error.reason === "notFound") return null;
    throw error;
  }
}
export function toMarketAccount(m: SuiMarket): MarketAccount {
  return {
    id: m.id, state: m.state, outcome: m.outcome, final_price_yes: Number(m.final_price_bps) / 10000,
    open_time: BigInt(m.open_ms) / 1000n, close_time: BigInt(m.close_ms) / 1000n, volume: BigInt(m.volume),
    reserve_yes: BigInt(m.reserve_yes), reserve_no: BigInt(m.reserve_no), vault: BigInt(m.vault),
    seed: BigInt(m.seed), debt: BigInt(m.debt), liability_yes: BigInt(m.liability_yes), liability_no: BigInt(m.liability_no),
    params: { fee_bps: 50, mm_bps: 500, max_lev_bps: 50000, tau0: 86400,
      reduce_only_secs: 3600, borrow_bps_per_hour: 2, max_price_bps: 9900, min_trade: 100000n },
  };
}
export async function walletBalances(owner: string) {
  const [kusd, gas] = await Promise.all([
    sui.getBalance({ owner, coinType: COIN_TYPE }), sui.getBalance({ owner }),
  ]);
  return { kusd: BigInt(kusd.balance.balance), gas: BigInt(gas.balance.balance) };
}
