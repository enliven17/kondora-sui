import { amm, type MarketAccount } from "./kondora";
import { transactionUrl } from "./sui/config";
export type Layer = "sui";
export const explorerTx = (signature: string) => transactionUrl(signature);
export function poolOf(m: MarketAccount): amm.PoolState {
  return { yes: m.reserve_yes, no: m.reserve_no, feeBps: m.params.fee_bps, mmBps: m.params.mm_bps,
    vault: m.vault, seed: m.seed, debt: m.debt, liabilityYes: m.liability_yes, liabilityNo: m.liability_no };
}
