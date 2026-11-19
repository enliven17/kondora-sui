import assert from "node:assert/strict";
import test from "node:test";
import { afterBuy, buyShares, ceilDiv, maxLeverageBps, priceOf, quoteOpen, sellValue, sqrt, type PoolState } from "../lib/kondora/math";
import { AccountBCS, MarketBCS, RegistryBCS } from "../lib/sui/schema";
import { PACKAGE_ID } from "../lib/sui/config";
import { newTransaction, target } from "../lib/sui/transactions";
import fs from "node:fs";

const pool: PoolState = { yes: 500_000_000n, no: 500_000_000n, feeBps: 50, mmBps: 500 };
test("integer square root bounds include large u128 values", () => {
  for (const n of [0n, 1n, 2n, 3n, 4n, 10n, 10n ** 25n, (1n << 127n) - 1n]) {
    const r = sqrt(n); assert(r * r <= n); assert((r + 1n) * (r + 1n) > n);
  }
});
test("rounding cannot extract money by buying and immediately selling", () => {
  let seed = 1234567;
  for (let i = 0; i < 2000; i++) {
    seed = (seed * 48271) % 2147483647;
    const side = (i % 2) as 0 | 1;
    const p = { ...pool, yes: BigInt(100000 + seed), no: BigInt(100000 + ((seed * 17) % 2147483647)) };
    const cost = BigInt(1 + seed % 100000000), shares = buyShares(p, side, cost), after = afterBuy(p, side, cost, shares);
    assert(after.yes * after.no >= p.yes * p.no);
    assert(sellValue(after, side, shares) <= cost);
    assert(sellValue(after, side, shares) <= shares);
    assert(priceOf(after, side) >= priceOf(p, side));
  }
});
test("leverage and reserve limits reject excess exposure", () => {
  assert.equal(maxLeverageBps(50000, 3600, 86400, .5, 3600), 10000);
  assert.equal(maxLeverageBps(50000, 172800, 86400, .5, 3600), 50000);
  assert.equal(maxLeverageBps(50000, 172800, 86400, .01, 3600), 10800);
  assert.equal(quoteOpen(pool, 0, 1000000, 50001), null);
  assert.equal(quoteOpen(pool, 0, Number.NaN, 10000), null);
  assert.equal(quoteOpen({ ...pool, vault: 1n, liabilityYes: 1n }, 0, 1000000, 10000)!.reserved, false);
  assert.equal(quoteOpen({ ...pool, seed: 100n, debt: 50n }, 0, 1000000, 20000)!.reserved, false);
});
test("opening fees and debt use exact base units", () => {
  const q = quoteOpen(pool, 0, 10000000, 20000)!;
  assert.equal(q.notional, 20000000); assert.equal(q.debt, 10000000); assert.equal(q.fee, 100000);
  assert.equal(ceilDiv(10001n, 10000n), 2n);
});
test("BCS codecs reject truncated untrusted object contents", () => {
  for (const codec of [AccountBCS, MarketBCS, RegistryBCS]) assert.throws(() => codec.parse(new Uint8Array(2)));
});
test("transaction builders target only the configured Sui package", () => {
  const tx = newTransaction();
  tx.moveCall({ target: target("withdraw"), arguments: [tx.object("0x1"), tx.pure.u64(1)] });
  const data = tx.getData();
  const call = data.commands[0].MoveCall!;
  assert.equal(call.package, PACKAGE_ID); assert.equal(call.module, "market"); assert.equal(call.function, "withdraw");
});
test("all Convex writes and signer actions stay internal", () => {
  for (const file of fs.readdirSync("convex").filter((name) => name.endsWith(".ts"))) {
    const source = fs.readFileSync(`convex/${file}`, "utf8");
    assert(!/\b(?:mutation|action)\s*\(/.test(source), `Public write in ${file}`);
  }
});
