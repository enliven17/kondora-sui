export * as amm from "./math";
export const STATE = { OPEN: 0, CLOSED: 1, PROPOSED: 2, DISPUTED: 3, RESOLVED: 4 } as const;
export const OUTCOME = { YES: 0, NO: 1, INVALID: 2 } as const;
export interface PositionData {
  market_id: string; side: number; shares: bigint; margin: bigint; debt: bigint;
  accrued: bigint; opened_at: bigint; last_accrual: bigint;
}
export interface UserAccountData { balance: bigint; positions: PositionData[]; realized_pnl: bigint }
export const activePositions = (account: UserAccountData) => account.positions.filter((p) => p.shares > 0n);
export interface MarketAccount {
  id: string; state: number; outcome: number; final_price_yes: number;
  open_time: bigint; close_time: bigint; volume: bigint;
  reserve_yes: bigint; reserve_no: bigint; vault: bigint; seed: bigint; debt: bigint;
  liability_yes: bigint; liability_no: bigint;
  params: {
    fee_bps: number; mm_bps: number; max_lev_bps: number; tau0: number;
    reduce_only_secs: number; borrow_bps_per_hour: number; max_price_bps: number; min_trade: bigint;
  };
}
