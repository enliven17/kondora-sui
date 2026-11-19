import type { UserAccountData } from "./kondora";
import { requireDeployment } from "./sui/config";
import { readTradingAccount, walletBalances } from "./sui/read";
export interface AccountSnapshot {
  owner: string; id: string | null; exists: boolean; delegated: boolean;
  user: UserAccountData | null; usdc: bigint; lamports: number; session: null; at: number;
}
export async function readAccount(owner: string): Promise<AccountSnapshot> {
  requireDeployment();
  const [a, balances] = await Promise.all([readTradingAccount(owner), walletBalances(owner)]);
  return {
    owner, id: a?.id ?? null, exists: Boolean(a), delegated: Boolean(a),
    user: a ? {
      balance: BigInt(a.balance), realized_pnl: BigInt(a.realized_profit) - BigInt(a.realized_loss),
      positions: a.positions.map((p) => ({ ...p, shares: BigInt(p.shares), margin: BigInt(p.margin), debt: BigInt(p.debt),
        accrued: BigInt(p.accrued), opened_at: BigInt(p.opened_at) / 1000n, last_accrual: BigInt(p.last_accrual) / 1000n })),
    } : null,
    usdc: balances.kusd, lamports: Number(balances.gas), session: null, at: Date.now() / 1000,
  };
}
