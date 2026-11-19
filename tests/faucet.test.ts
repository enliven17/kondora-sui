import assert from "node:assert/strict";
import test from "node:test";
import { faucetAddress, faucetEligibility, FAUCET_COOLDOWN_MS } from "../lib/faucet";
test("daily eligibility includes the exact 24-hour boundary",()=>{
  const last=1_000_000;
  assert(faucetEligibility(null,last,true).eligible);
  assert(!faucetEligibility(last,last+FAUCET_COOLDOWN_MS-1,false).eligible);
  assert(faucetEligibility(last,last+FAUCET_COOLDOWN_MS,false).eligible);
  assert.equal(faucetEligibility(last,last,false).nextClaimAt,last+FAUCET_COOLDOWN_MS);
});
test("welcome is one-time even after the daily cooldown",()=>{
  assert(!faucetEligibility(0,FAUCET_COOLDOWN_MS*10,true).eligible);
});
test("recipient validation rejects zero, short and malformed addresses",()=>{
  for(const value of ["0x123","0x"+"0".repeat(64),"0x"+"g".repeat(64),"https://example.com","0x"+"a".repeat(65)])assert.throws(()=>faucetAddress(value));
  assert.equal(faucetAddress("0x"+"A".repeat(64)),"0x"+"a".repeat(64));
});
