/// Fully reserved binary markets. All money uses integer six-decimal kUSD.
module kondora::market;

use std::string::{Self, String};
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::table::{Self, Table};
use kondora::kusd::KUSD;

const EOwner: u64 = 0;
const EAmount: u64 = 1;
const EState: u64 = 2;
const ETime: u64 = 3;
const ELeverage: u64 = 4;
const ESlippage: u64 = 5;
const EReserve: u64 = 6;
const EEvidence: u64 = 7;
const EPosition: u64 = 8;
const EHealth: u64 = 9;
const EMetadata: u64 = 10;
const BPS: u64 = 10_000;
const FEE_BPS: u64 = 50;
const INTEREST_BPS_HOUR: u64 = 2;
const DISPUTE_MS: u64 = 300_000;
const TIMEOUT_MS: u64 = 86_400_000;
const MAX_AMOUNT: u64 = 1_000_000_000_000;

public struct Registry has key {
    id: UID,
    admin: address,
    oracle: address,
    markets: vector<ID>,
    accounts: Table<address, ID>,
}

public struct Account has key {
    id: UID,
    owner: address,
    balance: Balance<KUSD>,
    positions: vector<Position>,
    realized_profit: u64,
    realized_loss: u64,
}

public struct Position has store, drop, copy {
    market_id: ID,
    side: u8,
    shares: u64,
    margin: u64,
    debt: u64,
    accrued: u64,
    opened_at: u64,
    last_accrual: u64,
}

public struct Market has key {
    id: UID,
    registry: ID,
    question: String,
    summary: String,
    category: String,
    resolution: String,
    rules: vector<String>,
    open_ms: u64,
    close_ms: u64,
    state: u8,
    outcome: u8,
    reserve_yes: u64,
    reserve_no: u64,
    liability_yes: u64,
    liability_no: u64,
    debt: u64,
    seed: u64,
    vault: Balance<KUSD>,
    volume: u64,
    trades: u64,
    proposed_ms: u64,
    final_price_bps: u64,
    evidence_hash: vector<u8>,
    evidence_uri: String,
}

public struct TradeEvent has copy, drop {
    market_id: ID, owner: address, side: u8, kind: u8,
    margin: u64, leverage_bps: u64, shares: u64,
    price_bps: u64, timestamp_ms: u64,
}
public struct ResolutionEvent has copy, drop {
    market_id: ID, actor: address, kind: u8, outcome: u8,
    evidence_hash: vector<u8>, evidence_uri: String, timestamp_ms: u64,
}
public struct LiquidityEvent has copy, drop {
    market_id: ID, amount: u64, seed: u64, price_bps: u64,
}

fun init(ctx: &mut TxContext) {
    transfer::share_object(Registry {
        id: object::new(ctx), admin: ctx.sender(), oracle: ctx.sender(),
        markets: vector[], accounts: table::new(ctx),
    });
}

public fun set_oracle(registry: &mut Registry, oracle: address, ctx: &TxContext) {
    assert!(registry.admin == ctx.sender(), EOwner);
    registry.oracle = oracle;
}

public fun create_account(registry: &mut Registry, ctx: &mut TxContext) {
    let owner = ctx.sender();
    assert!(!registry.accounts.contains(owner), EState);
    let account = Account {
        id: object::new(ctx), owner, balance: balance::zero(), positions: vector[],
        realized_profit: 0, realized_loss: 0,
    };
    registry.accounts.add(owner, object::id(&account));
    transfer::share_object(account);
}

public fun deposit(account: &mut Account, funds: Coin<KUSD>, ctx: &TxContext) {
    assert_owner(account, ctx);
    account.balance.join(funds.into_balance());
}

public fun withdraw(account: &mut Account, amount: u64, ctx: &mut TxContext) {
    assert_owner(account, ctx);
    assert!(amount > 0 && amount <= account.balance.value(), EAmount);
    transfer::public_transfer(coin::from_balance(account.balance.split(amount), ctx), account.owner);
}

public fun create_market(
    registry: &mut Registry, question: String, summary: String, category: String,
    resolution: String, rules: vector<String>, close_ms: u64,
    initial_price_bps: u64, funds: Coin<KUSD>, clock: &Clock, ctx: &mut TxContext,
) {
    assert!(registry.admin == ctx.sender(), EOwner);
    let now = clock.timestamp_ms();
    assert!(close_ms > now + 60_000 && close_ms <= now + 45 * TIMEOUT_MS, ETime);
    assert!(question.length() >= 12 && question.length() <= 200, EMetadata);
    assert!(summary.length() <= 500 && category.length() <= 20 && resolution.length() <= 4096, EMetadata);
    assert!(rules.length() <= 10, EMetadata);
    rules.do_ref!(|rule| assert!(rule.length() <= 1000, EMetadata));
    assert!(initial_price_bps >= 500 && initial_price_bps <= 9500, EAmount);
    let seed = funds.value();
    assert!(seed >= 100_000_000 && seed <= MAX_AMOUNT, EAmount);
    assert!(registry.markets.length() < 500, EMetadata);
    let market = Market {
        id: object::new(ctx), registry: object::id(registry),
        question, summary, category, resolution, rules,
        open_ms: now, close_ms, state: 0, outcome: 2,
        reserve_yes: mul_div(seed, BPS - initial_price_bps, BPS),
        reserve_no: mul_div(seed, initial_price_bps, BPS),
        liability_yes: 0, liability_no: 0, debt: 0, seed,
        vault: funds.into_balance(), volume: 0, trades: 0, proposed_ms: 0,
        final_price_bps: initial_price_bps, evidence_hash: vector[],
        evidence_uri: string::utf8(b""),
    };
    registry.markets.push_back(object::id(&market));
    transfer::share_object(market);
}

/// Permanent house liquidity; no LP redemption or change to existing claims.
/// Scale both virtual reserves equally so the current price is preserved.
public fun add_liquidity(
    registry: &Registry, market: &mut Market, funds: Coin<KUSD>, clock: &Clock, ctx: &TxContext,
) {
    assert!(registry.admin == ctx.sender() && market.registry == object::id(registry), EOwner);
    assert!(market.state == 0 && clock.timestamp_ms() < market.close_ms, EState);
    let amount = funds.value();
    assert!(amount > 0 && amount <= MAX_AMOUNT - market.seed, EAmount);
    let seed = market.seed + amount;
    let yes = mul_div(market.reserve_yes, seed, market.seed);
    let no = mul_div(market.reserve_no, seed, market.seed);
    assert!(yes > 0 && no > 0 && yes + no <= MAX_AMOUNT * 10, EAmount);
    market.reserve_yes = yes;
    market.reserve_no = no;
    market.seed = seed;
    market.vault.join(funds.into_balance());
    assert_reserves(market);
    event::emit(LiquidityEvent { market_id: object::id(market), amount, seed, price_bps: price_bps(market) });
}

public fun open_position(
    account: &mut Account, market: &mut Market, side: u8, margin: u64,
    leverage_bps: u64, min_shares: u64, clock: &Clock, ctx: &TxContext,
) {
    assert_owner(account, ctx);
    let now = clock.timestamp_ms();
    assert!(market.state == 0 && now < market.close_ms, EState);
    assert!(side <= 1 && margin >= 100_000 && margin <= MAX_AMOUNT / 5, EAmount);
    assert!(leverage_bps >= BPS && leverage_bps <= leverage_cap(market, now), ELeverage);
    let notional = mul_div(margin, leverage_bps, BPS);
    let fee = mul_div(notional, FEE_BPS, BPS);
    let cost = notional - fee;
    let debt = notional - margin;
    let shares = buy_shares(market.reserve_yes, market.reserve_no, side, cost);
    assert!(shares >= min_shares && shares > 0 && min_shares > 0, ESlippage);
    let (yes, no) = if (side == 0) (market.reserve_yes + cost - shares, market.reserve_no + cost)
        else (market.reserve_yes + cost, market.reserve_no + cost - shares);
    assert!(yes + no <= MAX_AMOUNT * 10, EAmount);
    let mark = if (side == 0) mul_div(no, BPS, yes + no) else mul_div(yes, BPS, yes + no);
    assert!(mark <= 9900, EReserve);
    assert!(market.debt + debt <= market.seed / 2, EReserve);
    let mut index = find_position(account, object::id(market), side);
    if (index == account.positions.length()) {
        account.positions.push_back(Position {
            market_id: object::id(market), side, shares: 0, margin: 0, debt: 0,
            accrued: 0, opened_at: now, last_accrual: now,
        });
        index = account.positions.length() - 1;
    };
    let p = &mut account.positions[index];
    accrue(p, now);
    p.shares = p.shares + shares;
    p.margin = p.margin + margin;
    p.debt = p.debt + debt;
    let exit = sell_value(yes, no, side, p.shares);
    assert!(p.debt == 0 || (exit as u128) * 9500 > ((p.debt as u128) + (p.accrued as u128)) * (BPS as u128), EHealth);
    market.reserve_yes = yes;
    market.reserve_no = no;
    if (side == 0) market.liability_yes = market.liability_yes + shares
        else market.liability_no = market.liability_no + shares;
    market.debt = market.debt + debt;
    market.vault.join(account.balance.split(margin));
    assert_reserves(market);
    market.volume = market.volume + notional;
    market.trades = market.trades + 1;
    event::emit(TradeEvent {
        market_id: object::id(market), owner: account.owner, side, kind: 0,
        margin, leverage_bps, shares, price_bps: price_bps(market), timestamp_ms: now,
    });
}

public fun close_position(
    account: &mut Account, market: &mut Market, side: u8,
    fraction_bps: u64, min_out: u64, clock: &Clock, ctx: &TxContext,
) {
    assert_owner(account, ctx);
    assert!(market.state == 0 && clock.timestamp_ms() < market.close_ms, EState);
    assert!(fraction_bps > 0 && fraction_bps <= BPS, EAmount);
    let index = find_position(account, object::id(market), side);
    assert!(index < account.positions.length(), EPosition);
    close_internal(account, market, index, fraction_bps, min_out, false, clock.timestamp_ms());
}

/// Accounts are shared, but only liquidation may mutate one without its owner.
public fun liquidate(account: &mut Account, market: &mut Market, side: u8, clock: &Clock) {
    assert!(market.state == 0 && clock.timestamp_ms() < market.close_ms, EState);
    let index = find_position(account, object::id(market), side);
    assert!(index < account.positions.length(), EPosition);
    let p = &mut account.positions[index];
    accrue(p, clock.timestamp_ms());
    let value = sell_value(market.reserve_yes, market.reserve_no, side, p.shares);
    assert!(p.debt > 0 && (value as u128) * 9500 <= ((p.debt as u128) + (p.accrued as u128)) * (BPS as u128), EHealth);
    close_internal(account, market, index, BPS, 0, true, clock.timestamp_ms());
}

fun close_internal(account: &mut Account, market: &mut Market, index: u64, fraction: u64, min_out: u64, liquidation: bool, now: u64) {
    let p = &mut account.positions[index];
    accrue(p, now);
    let shares = mul_div(p.shares, fraction, BPS);
    assert!(shares > 0, EAmount);
    let debt = ceil_div((p.debt as u128) * (fraction as u128), (BPS as u128)) as u64;
    let interest = ceil_div((p.accrued as u128) * (fraction as u128), (BPS as u128)) as u64;
    let margin = mul_div(p.margin, fraction, BPS);
    let gross = sell_value(market.reserve_yes, market.reserve_no, p.side, shares);
    let payout = if (gross > debt + interest) gross - debt - interest else 0;
    assert!(payout >= min_out, ESlippage);
    if (p.side == 0) {
        market.reserve_yes = market.reserve_yes + shares - gross;
        market.reserve_no = market.reserve_no - gross;
        market.liability_yes = market.liability_yes - shares;
    } else {
        market.reserve_no = market.reserve_no + shares - gross;
        market.reserve_yes = market.reserve_yes - gross;
        market.liability_no = market.liability_no - shares;
    };
    p.shares = p.shares - shares;
    p.margin = p.margin - margin;
    p.debt = p.debt - debt;
    p.accrued = p.accrued - interest;
    market.debt = market.debt - debt;
    let side = p.side;
    if (p.shares == 0) { account.positions.remove(index); };
    credit(account, market, payout, margin);
    assert_reserves(market);
    market.trades = market.trades + 1;
    event::emit(TradeEvent {
        market_id: object::id(market), owner: account.owner, side,
        kind: if (liquidation) 2 else 1, margin: payout, leverage_bps: BPS,
        shares, price_bps: price_bps(market), timestamp_ms: now,
    });
}

public fun propose(
    registry: &Registry, market: &mut Market, outcome: u8,
    evidence_hash: vector<u8>, evidence_uri: String, clock: &Clock, ctx: &TxContext,
) {
    assert!(object::id(registry) == market.registry && registry.oracle == ctx.sender(), EOwner);
    assert!(market.state == 0 && clock.timestamp_ms() >= market.close_ms, EState);
    assert_evidence(outcome, &evidence_hash, &evidence_uri);
    market.final_price_bps = price_bps(market);
    market.state = 2;
    market.outcome = outcome;
    market.proposed_ms = clock.timestamp_ms();
    market.evidence_hash = evidence_hash;
    market.evidence_uri = evidence_uri;
    resolution_event(market, 0, clock.timestamp_ms(), ctx.sender());
}

public fun challenge(market: &mut Market, evidence_hash: vector<u8>, evidence_uri: String, clock: &Clock, ctx: &TxContext) {
    assert!(market.state == 2 && clock.timestamp_ms() < market.proposed_ms + DISPUTE_MS, EState);
    assert_evidence(2, &evidence_hash, &evidence_uri);
    market.state = 3;
    // Keep the proposal evidence on the object; challenge evidence is preserved in an event.
    event::emit(ResolutionEvent {
        market_id: object::id(market), actor: ctx.sender(), kind: 1, outcome: market.outcome,
        evidence_hash, evidence_uri, timestamp_ms: clock.timestamp_ms(),
    });
}

public fun finalize(market: &mut Market, clock: &Clock, ctx: &TxContext) {
    assert!(market.state == 2 && clock.timestamp_ms() >= market.proposed_ms + DISPUTE_MS, EState);
    market.state = 4;
    resolution_event(market, 2, clock.timestamp_ms(), ctx.sender());
}

public fun rule(
    registry: &Registry, market: &mut Market, outcome: u8, evidence_hash: vector<u8>,
    evidence_uri: String, clock: &Clock, ctx: &TxContext,
) {
    assert!(registry.admin == ctx.sender() && object::id(registry) == market.registry, EOwner);
    assert!(market.state == 3 && clock.timestamp_ms() >= market.proposed_ms + DISPUTE_MS, EState);
    assert_evidence(outcome, &evidence_hash, &evidence_uri);
    market.outcome = outcome;
    market.evidence_hash = evidence_hash;
    market.evidence_uri = evidence_uri;
    market.state = 4;
    resolution_event(market, 3, clock.timestamp_ms(), ctx.sender());
}

public fun timeout(market: &mut Market, clock: &Clock, ctx: &TxContext) {
    assert!(market.state != 4, EState);
    let start = if (market.proposed_ms > 0) market.proposed_ms else market.close_ms;
    assert!(clock.timestamp_ms() >= start + TIMEOUT_MS, ETime);
    if (market.state == 0) market.final_price_bps = price_bps(market);
    market.outcome = 2;
    market.state = 4;
    resolution_event(market, 4, clock.timestamp_ms(), ctx.sender());
}

public fun claim(account: &mut Account, market: &mut Market, clock: &Clock, ctx: &TxContext) {
    assert_owner(account, ctx);
    assert!(market.state == 4, EState);
    let mut i = account.positions.length();
    let mut found = false;
    while (i > 0) {
        i = i - 1;
        if (account.positions[i].market_id != object::id(market)) continue;
        found = true;
        let mut p = account.positions.remove(i);
        // Borrow accrual stops at close, never at the later time a user claims.
        accrue(&mut p, market.close_ms);
        let mark = if (market.outcome == 2) {
            if (p.side == 0) market.final_price_bps else BPS - market.final_price_bps
        } else if (p.side == market.outcome) BPS else 0;
        let gross = mul_div(p.shares, mark, BPS);
        let payout = if (gross > p.debt + p.accrued) gross - p.debt - p.accrued else 0;
        market.debt = market.debt - p.debt;
        if (p.side == 0) market.liability_yes = market.liability_yes - p.shares
            else market.liability_no = market.liability_no - p.shares;
        credit(account, market, payout, p.margin);
        event::emit(TradeEvent {
            market_id: object::id(market), owner: account.owner, side: p.side, kind: 3,
            margin: payout, leverage_bps: BPS, shares: p.shares,
            price_bps: market.final_price_bps, timestamp_ms: clock.timestamp_ms(),
        });
    };
    assert!(found, EPosition);
}

fun assert_owner(account: &Account, ctx: &TxContext) { assert!(account.owner == ctx.sender(), EOwner); }
fun assert_evidence(outcome: u8, hash: &vector<u8>, uri: &String) {
    assert!(outcome <= 2 && hash.length() == 32 && uri.length() > 0 && uri.length() <= 512, EEvidence);
}
fun assert_reserves(market: &Market) {
    assert!(market.vault.value() >= market.liability_yes + market.liability_no, EReserve);
}
fun credit(account: &mut Account, market: &mut Market, payout: u64, margin: u64) {
    account.balance.join(market.vault.split(payout));
    if (payout >= margin) account.realized_profit = account.realized_profit + payout - margin
        else account.realized_loss = account.realized_loss + margin - payout;
}
fun resolution_event(market: &Market, kind: u8, now: u64, actor: address) {
    event::emit(ResolutionEvent {
        market_id: object::id(market), actor, kind, outcome: market.outcome,
        evidence_hash: market.evidence_hash, evidence_uri: market.evidence_uri, timestamp_ms: now,
    });
}
fun find_position(account: &Account, market_id: ID, side: u8): u64 {
    let mut i = 0;
    while (i < account.positions.length()) {
        let p = &account.positions[i];
        if (p.market_id == market_id && p.side == side) return i;
        i = i + 1;
    };
    i
}
fun accrue(p: &mut Position, now: u64) {
    if (now > p.last_accrual) {
        p.accrued = p.accrued + (ceil_div(
            (p.debt as u128) * (INTEREST_BPS_HOUR as u128) * ((now - p.last_accrual) as u128),
            (BPS as u128) * 3_600_000,
        ) as u64);
        p.last_accrual = now;
    };
}
public fun price_bps(market: &Market): u64 { mul_div(market.reserve_no, BPS, market.reserve_yes + market.reserve_no) }
public fun leverage_cap(market: &Market, now: u64): u64 {
    if (now >= market.close_ms || market.close_ms - now <= 3_600_000) return BPS;
    let tau = market.close_ms - now;
    let time_cap = BPS + mul_div(40_000, tau.min(TIMEOUT_MS), TIMEOUT_MS);
    let price = price_bps(market);
    time_cap.min(BPS + 8 * price.min(BPS - price)).min(50_000)
}
public fun buy_shares(yes: u64, no: u64, side: u8, cost: u64): u64 {
    assert!(yes > 0 && no > 0 && side <= 1 && cost <= MAX_AMOUNT, EAmount);
    let k = (yes as u128) * (no as u128);
    if (side == 0) yes + cost - (ceil_div(k, ((no + cost) as u128)) as u64)
        else no + cost - (ceil_div(k, ((yes + cost) as u128)) as u64)
}
public fun sell_value(yes: u64, no: u64, side: u8, shares: u64): u64 {
    assert!(side <= 1, EAmount);
    let sum = (yes as u128) + (no as u128) + (shares as u128);
    let opposite = if (side == 0) no else yes;
    let disc = sum * sum - 4 * (opposite as u128) * (shares as u128);
    let root = sqrt(disc);
    let ceil_root = if (root * root == disc) root else root + 1;
    ((sum - ceil_root) / 2) as u64
}
fun sqrt(n: u128): u128 {
    if (n < 2) return n;
    let mut x = n;
    let mut y = (x + 1) / 2;
    while (y < x) { x = y; y = (x + n / x) / 2; };
    x
}
fun ceil_div(a: u128, b: u128): u128 { (a + b - 1) / b }
fun mul_div(a: u64, b: u64, c: u64): u64 { (((a as u128) * (b as u128)) / (c as u128)) as u64 }

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) { init(ctx); }

#[test_only]
fun test_setup(ctx: &mut TxContext): (Registry, Account, Market, Clock) {
    let registry = Registry { id: object::new(ctx), admin: ctx.sender(), oracle: ctx.sender(), markets: vector[], accounts: table::new(ctx) };
    let account = Account {
        id: object::new(ctx), owner: ctx.sender(), balance: coin::mint_for_testing<KUSD>(1_000_000_000, ctx).into_balance(),
        positions: vector[], realized_profit: 0, realized_loss: 0,
    };
    let market = Market {
        id: object::new(ctx), registry: object::id(&registry),
        question: b"Will the test pass?".to_string(), summary: b"Test".to_string(), category: b"tech".to_string(),
        resolution: b"{}".to_string(), rules: vector[], open_ms: 0, close_ms: 2 * TIMEOUT_MS,
        state: 0, outcome: 2, reserve_yes: 500_000_000, reserve_no: 500_000_000,
        liability_yes: 0, liability_no: 0, debt: 0, seed: 1_000_000_000,
        vault: coin::mint_for_testing<KUSD>(1_000_000_000, ctx).into_balance(), volume: 0, trades: 0,
        proposed_ms: 0, final_price_bps: 5000, evidence_hash: vector[], evidence_uri: b"".to_string(),
    };
    (registry, account, market, sui::clock::create_for_testing(ctx))
}
#[test_only]
fun test_cleanup(registry: Registry, account: Account, market: Market, clock: Clock) {
    transfer::share_object(registry); transfer::share_object(account); transfer::share_object(market);
    sui::clock::destroy_for_testing(clock);
}
#[test]
fun round_trip_and_interest() {
    let mut ctx = sui::tx_context::dummy();
    let (r, mut a, mut m, mut c) = test_setup(&mut ctx);
    open_position(&mut a, &mut m, 0, 10_000_000, 20_000, 1, &c, &ctx);
    assert!(a.positions[0].debt == 10_000_000);
    assert!(a.balance.value() == 990_000_000);
    c.increment_for_testing(3_600_000);
    close_position(&mut a, &mut m, 0, BPS, 9_800_000, &c, &ctx);
    assert!(a.positions.is_empty() && m.debt == 0 && m.liability_yes == 0);
    assert!(a.balance.value() < 1_000_000_000 && a.balance.value() >= 999_800_000);
    test_cleanup(r, a, m, c);
}
#[test]
fun liquidity_preserves_prices_and_existing_claims() {
    let mut ctx = sui::tx_context::dummy();
    let (r, mut a, mut m, c) = test_setup(&mut ctx);
    open_position(&mut a, &mut m, 0, 10_000_000, 20_000, 1, &c, &ctx);
    let price = price_bps(&m);
    let yes = m.liability_yes;
    let debt = m.debt;
    let shares = a.positions[0].shares;
    let vault = m.vault.value();
    add_liquidity(&r, &mut m, coin::mint_for_testing<KUSD>(4_000_000_000, &mut ctx), &c, &ctx);
    assert!(price_bps(&m) == price && m.seed == 5_000_000_000);
    assert!(m.vault.value() == vault + 4_000_000_000);
    assert!(m.liability_yes == yes && m.debt == debt && a.positions[0].shares == shares);
    close_position(&mut a, &mut m, 0, BPS, 1, &c, &ctx);
    assert!(a.positions.is_empty() && m.debt == 0 && m.liability_yes == 0);
    test_cleanup(r, a, m, c);
}
#[test, expected_failure(abort_code = EOwner)]
fun unauthorized_liquidity_fails() {
    let mut ctx = sui::tx_context::dummy();
    let (mut r, a, mut m, c) = test_setup(&mut ctx);
    r.admin = @0x123;
    add_liquidity(&r, &mut m, coin::mint_for_testing<KUSD>(1_000_000, &mut ctx), &c, &ctx);
    test_cleanup(r, a, m, c);
}
#[test, expected_failure(abort_code = EState)]
fun closed_market_liquidity_fails() {
    let mut ctx = sui::tx_context::dummy();
    let (r, a, mut m, mut c) = test_setup(&mut ctx);
    c.increment_for_testing(2 * TIMEOUT_MS);
    add_liquidity(&r, &mut m, coin::mint_for_testing<KUSD>(1_000_000, &mut ctx), &c, &ctx);
    test_cleanup(r, a, m, c);
}
#[test, expected_failure(abort_code = EOwner)]
fun mismatched_registry_liquidity_fails() {
    let mut ctx = sui::tx_context::dummy();
    let (r, a, mut m, c) = test_setup(&mut ctx);
    m.registry = object::id_from_address(@0x123);
    add_liquidity(&r, &mut m, coin::mint_for_testing<KUSD>(1_000_000, &mut ctx), &c, &ctx);
    test_cleanup(r, a, m, c);
}
#[test]
fun partial_close_then_claim() {
    let mut ctx = sui::tx_context::dummy();
    let (r, mut a, mut m, mut c) = test_setup(&mut ctx);
    open_position(&mut a, &mut m, 0, 10_000_000, BPS, 1, &c, &ctx);
    close_position(&mut a, &mut m, 0, 5000, 1, &c, &ctx);
    assert!(a.positions.length() == 1 && a.positions[0].shares > 0);
    c.increment_for_testing(2 * TIMEOUT_MS);
    propose(&r, &mut m, 0, b"01234567890123456789012345678901", b"https://example.com/evidence".to_string(), &c, &ctx);
    c.increment_for_testing(DISPUTE_MS);
    finalize(&mut m, &c, &ctx);
    claim(&mut a, &mut m, &c, &ctx);
    assert!(a.positions.is_empty() && m.liability_yes == 0);
    test_cleanup(r, a, m, c);
}
#[test]
fun challenged_market_requires_ruling() {
    let mut ctx = sui::tx_context::dummy();
    let (r, a, mut m, mut c) = test_setup(&mut ctx);
    c.increment_for_testing(2 * TIMEOUT_MS);
    propose(&r, &mut m, 0, b"01234567890123456789012345678901", b"evidence".to_string(), &c, &ctx);
    challenge(&mut m, b"01234567890123456789012345678901", b"counter-evidence".to_string(), &c, &ctx);
    c.increment_for_testing(DISPUTE_MS);
    rule(&r, &mut m, 1, b"01234567890123456789012345678901", b"ruling".to_string(), &c, &ctx);
    assert!(m.state == 4 && m.outcome == 1);
    test_cleanup(r, a, m, c);
}
#[test]
fun invalid_timeout_pays_complementary_marks() {
    let mut ctx = sui::tx_context::dummy();
    let (r, mut a, mut m, mut c) = test_setup(&mut ctx);
    open_position(&mut a, &mut m, 0, 5_000_000, BPS, 1, &c, &ctx);
    open_position(&mut a, &mut m, 1, 5_000_000, BPS, 1, &c, &ctx);
    c.increment_for_testing(3 * TIMEOUT_MS);
    timeout(&mut m, &c, &ctx);
    assert!(m.state == 4 && m.outcome == 2);
    claim(&mut a, &mut m, &c, &ctx);
    assert!(a.positions.is_empty() && m.liability_yes + m.liability_no == 0);
    test_cleanup(r, a, m, c);
}
#[test, expected_failure(abort_code = EOwner)]
fun unauthorized_withdraw_fails() {
    let mut ctx = sui::tx_context::dummy();
    let (r, mut a, m, c) = test_setup(&mut ctx);
    a.owner = @0x123;
    withdraw(&mut a, 1, &mut ctx);
    test_cleanup(r, a, m, c);
}
#[test, expected_failure(abort_code = ESlippage)]
fun substituted_quote_fails() {
    let mut ctx = sui::tx_context::dummy();
    let (r, mut a, mut m, c) = test_setup(&mut ctx);
    open_position(&mut a, &mut m, 0, 10_000_000, BPS, 999_000_000, &c, &ctx);
    test_cleanup(r, a, m, c);
}
#[test, expected_failure(abort_code = EReserve)]
fun insufficient_outcome_reserves_fail() {
    let mut ctx = sui::tx_context::dummy();
    let (r, mut a, mut m, c) = test_setup(&mut ctx);
    m.liability_no = 1_000_000_000;
    open_position(&mut a, &mut m, 0, 10_000_000, BPS, 1, &c, &ctx);
    test_cleanup(r, a, m, c);
}
#[test, expected_failure(abort_code = EState)]
fun premature_finalization_fails() {
    let mut ctx = sui::tx_context::dummy();
    let (r, a, mut m, mut c) = test_setup(&mut ctx);
    c.increment_for_testing(2 * TIMEOUT_MS);
    propose(&r, &mut m, 0, b"01234567890123456789012345678901", b"evidence".to_string(), &c, &ctx);
    finalize(&mut m, &c, &ctx);
    test_cleanup(r, a, m, c);
}
#[test, expected_failure(abort_code = ELeverage)]
fun leverage_tapers_to_one_at_close() {
    let mut ctx = sui::tx_context::dummy();
    let (r, mut a, mut m, mut c) = test_setup(&mut ctx);
    c.increment_for_testing(2 * TIMEOUT_MS - 1000);
    open_position(&mut a, &mut m, 0, 10_000_000, 20_000, 1, &c, &ctx);
    test_cleanup(r, a, m, c);
}
#[test, expected_failure(abort_code = EOwner)]
fun unauthorized_oracle_fails() {
    let mut ctx = sui::tx_context::dummy();
    let (mut r, a, mut m, mut c) = test_setup(&mut ctx);
    r.oracle = @0x123;
    c.increment_for_testing(2 * TIMEOUT_MS);
    propose(&r, &mut m, 0, b"01234567890123456789012345678901", b"evidence".to_string(), &c, &ctx);
    test_cleanup(r, a, m, c);
}
