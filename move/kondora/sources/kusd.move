/// Valueless, freely mintable TESTNET collateral. This is not Circle USDC.
module kondora::kusd;

use sui::coin::{Self, TreasuryCap};
use sui::coin_registry;
use sui::table::{Self, Table};
use sui::clock::Clock;
use sui::event;

public struct KUSD has drop {}
public struct Faucet has key { id: UID, treasury: TreasuryCap<KUSD> }
public struct DailyFaucet has key {
    id: UID, sponsor: address, claimed: Table<address, u64>, day: u64, count: u64,
}
public struct DailyClaim has copy, drop { recipient: address, amount: u64, claimed_ms: u64, next_ms: u64 }
const DAY_MS: u64 = 86_400_000;
const EOwner: u64 = 0;
const ECooldown: u64 = 1;
const EBudget: u64 = 2;

public(package) fun create_daily_faucet(sponsor: address, ctx: &mut TxContext) {
    transfer::share_object(DailyFaucet { id: object::new(ctx), sponsor, claimed: table::new(ctx), day: 0, count: 0 });
}

public fun claim_daily(daily: &mut DailyFaucet, faucet: &mut Faucet, recipient: address, welcome_only: bool, clock: &Clock, ctx: &mut TxContext) {
    assert!(daily.sponsor == ctx.sender(), EOwner);
    let now = clock.timestamp_ms();
    if (daily.claimed.contains(recipient)) {
        assert!(!welcome_only && now >= *daily.claimed.borrow(recipient) + DAY_MS, ECooldown);
        *daily.claimed.borrow_mut(recipient) = now;
    } else { daily.claimed.add(recipient, now); };
    let day = now / DAY_MS;
    if (day != daily.day) { daily.day = day; daily.count = 0; };
    assert!(daily.count < 500, EBudget);
    daily.count = daily.count + 1;
    coin::mint_and_transfer(&mut faucet.treasury, 100_000_000, recipient, ctx);
    event::emit(DailyClaim { recipient, amount: 100_000_000, claimed_ms: now, next_ms: now + DAY_MS });
}

#[test_only]
fun daily_test_setup(ctx: &mut TxContext): (DailyFaucet, Faucet, Clock) {
    let treasury = coin::create_treasury_cap_for_testing<KUSD>(ctx);
    (DailyFaucet { id: object::new(ctx), sponsor: ctx.sender(), claimed: table::new(ctx), day: 0, count: 0 },
        Faucet { id: object::new(ctx), treasury }, sui::clock::create_for_testing(ctx))
}
#[test_only]
fun daily_test_cleanup(daily: DailyFaucet, faucet: Faucet, clock: Clock) {
    transfer::share_object(daily); transfer::share_object(faucet); sui::clock::destroy_for_testing(clock);
}
#[test]
fun first_claim_and_exact_24h_boundary() {
    let mut ctx = sui::tx_context::dummy();
    let (mut d, mut f, mut c) = daily_test_setup(&mut ctx);
    claim_daily(&mut d, &mut f, @0x123, true, &c, &mut ctx);
    assert!(f.treasury.total_supply() == 100_000_000);
    c.increment_for_testing(DAY_MS);
    claim_daily(&mut d, &mut f, @0x123, false, &c, &mut ctx);
    assert!(f.treasury.total_supply() == 200_000_000 && *d.claimed.borrow(@0x123) == DAY_MS);
    daily_test_cleanup(d, f, c);
}
#[test, expected_failure(abort_code = ECooldown)]
fun duplicate_claim_is_rejected() {
    let mut ctx = sui::tx_context::dummy();
    let (mut d, mut f, c) = daily_test_setup(&mut ctx);
    claim_daily(&mut d, &mut f, @0x123, true, &c, &mut ctx);
    claim_daily(&mut d, &mut f, @0x123, false, &c, &mut ctx);
    daily_test_cleanup(d, f, c);
}
#[test, expected_failure(abort_code = ECooldown)]
fun reconnect_does_not_repeat_welcome_after_24h() {
    let mut ctx = sui::tx_context::dummy();
    let (mut d, mut f, mut c) = daily_test_setup(&mut ctx);
    claim_daily(&mut d, &mut f, @0x123, true, &c, &mut ctx);
    c.increment_for_testing(DAY_MS);
    claim_daily(&mut d, &mut f, @0x123, true, &c, &mut ctx);
    daily_test_cleanup(d, f, c);
}
#[test, expected_failure(abort_code = EOwner)]
fun only_faucet_sponsor_can_mint() {
    let mut ctx = sui::tx_context::dummy();
    let (mut d, mut f, c) = daily_test_setup(&mut ctx);
    d.sponsor = @0x456;
    claim_daily(&mut d, &mut f, @0x123, false, &c, &mut ctx);
    daily_test_cleanup(d, f, c);
}
#[test, expected_failure(abort_code = EBudget)]
fun daily_sponsor_budget_is_bounded() {
    let mut ctx = sui::tx_context::dummy();
    let (mut d, mut f, c) = daily_test_setup(&mut ctx);
    d.count = 500;
    claim_daily(&mut d, &mut f, @0x123, false, &c, &mut ctx);
    daily_test_cleanup(d, f, c);
}

fun init(witness: KUSD, ctx: &mut TxContext) {
    let (currency, treasury) = coin_registry::new_currency_with_otw(
        witness, 6, b"kUSD".to_string(), b"Kondora Test Dollar".to_string(),
        b"Freely mintable Sui testnet demo collateral. No monetary value.".to_string(),
        b"https://sui.kondora.xyz/icon.svg".to_string(), ctx,
    );
    transfer::public_transfer(coin_registry::finalize(currency, ctx), ctx.sender());
    transfer::share_object(Faucet { id: object::new(ctx), treasury });
}

public fun mint(faucet: &mut Faucet, ctx: &mut TxContext) {
    coin::mint_and_transfer(&mut faucet.treasury, 1_000_000_000, ctx.sender(), ctx);
}
