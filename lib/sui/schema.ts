import { bcs } from "@mysten/sui/bcs";
const Table = bcs.struct("Table", { id: bcs.Address, size: bcs.u64() });
export const RegistryBCS = bcs.struct("Registry", {
  id: bcs.Address, admin: bcs.Address, oracle: bcs.Address,
  markets: bcs.vector(bcs.Address), accounts: Table,
});
export const PositionBCS = bcs.struct("Position", {
  market_id: bcs.Address, side: bcs.u8(), shares: bcs.u64(), margin: bcs.u64(),
  debt: bcs.u64(), accrued: bcs.u64(), opened_at: bcs.u64(), last_accrual: bcs.u64(),
});
export const AccountBCS = bcs.struct("Account", {
  id: bcs.Address, owner: bcs.Address, balance: bcs.u64(), positions: bcs.vector(PositionBCS),
  realized_profit: bcs.u64(), realized_loss: bcs.u64(),
});
export const MarketBCS = bcs.struct("Market", {
  id: bcs.Address, registry: bcs.Address, question: bcs.string(), summary: bcs.string(),
  category: bcs.string(), resolution: bcs.string(), rules: bcs.vector(bcs.string()),
  open_ms: bcs.u64(), close_ms: bcs.u64(), state: bcs.u8(), outcome: bcs.u8(),
  reserve_yes: bcs.u64(), reserve_no: bcs.u64(), liability_yes: bcs.u64(), liability_no: bcs.u64(),
  debt: bcs.u64(), seed: bcs.u64(), vault: bcs.u64(), volume: bcs.u64(), trades: bcs.u64(),
  proposed_ms: bcs.u64(), final_price_bps: bcs.u64(),
  evidence_hash: bcs.vector(bcs.u8()), evidence_uri: bcs.string(),
});
export type SuiMarket = ReturnType<typeof MarketBCS.parse>;
export type SuiAccount = ReturnType<typeof AccountBCS.parse>;
export const TradeEventBCS = bcs.struct("TradeEvent", {
  market_id: bcs.Address, owner: bcs.Address, side: bcs.u8(), kind: bcs.u8(),
  margin: bcs.u64(), leverage_bps: bcs.u64(), shares: bcs.u64(), price_bps: bcs.u64(), timestamp_ms: bcs.u64(),
});
export const ResolutionEventBCS = bcs.struct("ResolutionEvent", {
  market_id: bcs.Address, actor: bcs.Address, kind: bcs.u8(), outcome: bcs.u8(),
  evidence_hash: bcs.vector(bcs.u8()), evidence_uri: bcs.string(), timestamp_ms: bcs.u64(),
});
