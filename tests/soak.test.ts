import test from "node:test";
import assert from "node:assert/strict";
import { selectSoakMarkets, soakAssignment, checkMarketAccounting } from "../scripts/soak-model";
test("default soak selects existing public open markets and excludes test pools",()=>{
 const market=(id:string,tags:string[]=[],state=0,close_ms="200000")=>({id,state,close_ms,resolution:JSON.stringify({tags})});
 const rows=[market("b"),market("a"),market("test",["soak"]),market("smoke",["smoke"]),market("resolved",[],4),market("closing",[],0,"60000")];
 assert.deepEqual(selectSoakMarkets(rows,0).map(m=>m.id),["a","b"]);
 assert.deepEqual(selectSoakMarkets(rows,0,["test"]).map(m=>m.id),["test"]);
 assert.equal(selectSoakMarkets(rows,0,[],1).length,1);
});
test("200 wallets spread evenly, use both sides per pool and rotate after closing",()=>{
 const counts=Array.from({length:11},()=>({yes:0,no:0}));
 for(let i=0;i<200;i++){
  const a=soakAssignment(i,0,11);counts[a.marketIndex][a.side===0?"yes":"no"]++;
  assert.equal(soakAssignment(i,2,11).marketIndex,(a.marketIndex+1)%11);
 }
 assert(counts.every(c=>c.yes>0&&c.no>0));
 assert(Math.max(...counts.map(c=>c.yes+c.no))-Math.min(...counts.map(c=>c.yes+c.no))<=1);
});
test("public pool checks allow other traders while rejecting missing reserves",()=>{
 const market={id:"pool",vault:"1000",liability_yes:"200",liability_no:"300",debt:"100"};
 const own={yes:20n,no:30n,debt:10n};
 assert.doesNotThrow(()=>checkMarketAccounting(market,own,false));
 assert.throws(()=>checkMarketAccounting(market,own,true));
 assert.throws(()=>checkMarketAccounting({...market,vault:"499"},own,false));
 assert.throws(()=>checkMarketAccounting(market,{...own,yes:201n},false));
});
