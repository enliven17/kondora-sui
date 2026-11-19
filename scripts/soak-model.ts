import assert from "node:assert/strict";
type SelectableMarket = { id: string; state: number; close_ms: string; resolution: string };
export function selectSoakMarkets<T extends SelectableMarket>(markets: T[], now: number, explicit: string[] = [], limit = 50): T[] {
  const requested = new Set(explicit);
  return markets.filter(m => {
    if (m.state !== 0 || Number(m.close_ms) <= now + 60000) return false;
    if (requested.size) return requested.has(m.id);
    try { return !JSON.parse(m.resolution).tags?.some((tag: string) => ["soak", "smoke"].includes(tag)); }
    catch { return false; }
  }).sort((a,b) => a.id.localeCompare(b.id)).slice(0,limit);
}
export function soakAssignment(walletIndex: number, round: number, marketCount: number) {
  assert(marketCount > 0, "No open markets available");
  const cycle = Math.floor(round / 2);
  return { marketIndex: (walletIndex + cycle) % marketCount,
    side: ((Math.floor(walletIndex / marketCount) + cycle) % 2) as 0 | 1,
    leverageBps: 10000 + ((walletIndex + cycle) % 3) * 10000 };
}
export function checkMarketAccounting(market: {id:string; vault:string; liability_yes:string; liability_no:string; debt:string}, own: {yes:bigint; no:bigint; debt:bigint}, isolated: boolean) {
  const yes=BigInt(market.liability_yes),no=BigInt(market.liability_no),debt=BigInt(market.debt);
  if(isolated){assert.equal(own.yes,yes,`${market.id}: YES liability mismatch`);assert.equal(own.no,no,`${market.id}: NO liability mismatch`);assert.equal(own.debt,debt,`${market.id}: debt mismatch`);}
  else {assert(yes>=own.yes,`${market.id}: YES liability below cohort shares`);assert(no>=own.no,`${market.id}: NO liability below cohort shares`);assert(debt>=own.debt,`${market.id}: debt below cohort debt`);}
  assert(BigInt(market.vault)>=yes+no,`${market.id}: outcome claims are under-reserved`);
}
