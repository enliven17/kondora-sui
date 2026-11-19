/// Valueless, freely mintable TESTNET collateral. This is not Circle USDC.
module kondora::kusd;

use sui::coin::{Self, TreasuryCap};
use sui::coin_registry;

public struct KUSD has drop {}
public struct Faucet has key { id: UID, treasury: TreasuryCap<KUSD> }

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
