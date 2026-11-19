// Same API as lib/trade.ts and lib/account.ts, loaded on first call. Sui trading code
// and transaction builders are only needed once a wallet acts,
// so it stays out of the market and portfolio first-load JS. Types still come from the real modules.

import type * as Account from "./account";
import type * as Trade from "./trade";

const trade = () => import("./trade");
const account = () => import("./account");

export const placeBet: typeof Trade.placeBet = async (...args) => (await trade()).placeBet(...args);
export const enableTrading: typeof Trade.enableTrading = async (...args) => (await trade()).enableTrading(...args);
export const withdraw: typeof Trade.withdraw = async (...args) => (await trade()).withdraw(...args);
export const claimPosition: typeof Trade.claimPosition = async (...args) => (await trade()).claimPosition(...args);
export const closePosition: typeof Trade.closePosition = async (...args) => (await trade()).closePosition(...args);
export const readAccount: typeof Account.readAccount = async (...args) => (await account()).readAccount(...args);

/** Warm both chunks once a wallet is connected, so the first trade doesn't wait on the network. */
export function preloadTrading(): void {
  void trade().catch(() => undefined);
  void account().catch(() => undefined);
}
