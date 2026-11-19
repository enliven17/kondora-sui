import { poolOf } from "./chain";
import { amm, type MarketAccount } from "./kondora";
import { readSuiMarket, toMarketAccount } from "./sui/read";
import type { PricePoint } from "./types";
export interface LiveMarket { account: MarketAccount; delegated: boolean; priceYes: number; pool: amm.PoolState; floorL: number; at: number }
type Listener = (state: LiveMarket) => void;
const entries = new Map<string, { last: LiveMarket | null; listeners: Set<Listener>; stop: () => void }>();
export function subscribeMarket(id: string, onState: Listener): () => void {
  if (!/^0x[0-9a-f]{64}$/i.test(id)) return () => {};
  let entry = entries.get(id);
  if (!entry) {
    const fresh = { last: null as LiveMarket | null, listeners: new Set<Listener>(), stop: () => {} };
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (document.visibilityState !== "hidden") {
          const account = toMarketAccount(await readSuiMarket(id));
          if (stopped) return;
          const pool = poolOf(account);
          fresh.last = { account, pool, delegated: true, priceYes: amm.priceOf(pool, 0), floorL: 0, at: Date.now() / 1000 };
          fresh.listeners.forEach((listener) => listener(fresh.last!));
        }
      } catch { /* Preserve the last known state; the next poll retries. */ }
      if (!stopped) timer = setTimeout(poll, 5000);
    };
    const refresh = () => { clearTimeout(timer); void poll(); };
    window.addEventListener("kondora:refresh", refresh);
    fresh.stop = () => { stopped = true; clearTimeout(timer); window.removeEventListener("kondora:refresh", refresh); };
    entries.set(id, fresh); entry = fresh; void poll();
  }
  entry.listeners.add(onState);
  if (entry.last) onState(entry.last);
  const current = entry;
  return () => { current.listeners.delete(onState); if (!current.listeners.size) { current.stop(); entries.delete(id); } };
}
export const peekMarket = (id: string) => entries.get(id)?.last ?? null;
export function subscribePrice(id: string, last: PricePoint, onTick: (point: PricePoint) => void) {
  let price = last.p, volume: bigint | null = null;
  return subscribeMarket(id, (s) => {
    const delta = volume === null ? 0 : Number(s.account.volume - volume) / 1e6;
    volume = s.account.volume;
    if (Math.abs(price - s.priceYes) < 1e-6 && delta <= 0) return;
    price = s.priceYes;
    onTick({ t: Math.floor(s.at), p: price, v: Math.max(0, delta) });
  });
}
