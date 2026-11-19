---
title: Program
description: Move objects, transactions, ownership and settlement.
order: 9
section: Build
---

## Move package

The source lives in move/kondora. Deployment object IDs and the publication digest are recorded in deployments/testnet.json. The package has two modules: kusd for the valueless test coin and market for trading and resolution.

## Object model

| Object | Purpose |
| --- | --- |
| Registry | Admin, oracle, market IDs and address-to-account table |
| Account | Owner, kUSD balance, positions and realized profit/loss |
| Market | Metadata, reserves, liabilities, vault, debt and resolution state |
| Faucet | Shared TreasuryCap for freely mintable test collateral |
| DailyFaucet | Dedicated sponsor and per-address claim timestamps for 100-kUSD daily grants |

## Trading functions

create_account, deposit, withdraw, create_market, open_position, close_position, liquidate and claim are public Move functions. The module checks account ownership and registry authority. Liquidation is permissionless only when the position fails the maintenance check.

## Resolution functions

propose requires the configured oracle. challenge is open during the dispute window. finalize and timeout are permissionless with clock constraints. rule and set_oracle require the registry admin. There is no arbitrary admin withdrawal function.

## Validation

The compatible v3 upgrade adds claim_daily without replacing existing accounts,
markets or the kUSD coin type. The registry admin creates the DailyFaucet for a
dedicated sponsor. Only that signer can pay the first 100 kUSD and repeat daily
claims. Backend keys never enter the browser. The original developer mint remains
available for CLI/soak funding; the 24-hour rule applies to this deployed daily
faucet, rather than imposing a global supply restriction on valueless kUSD.

Run npm run move:test and npm test. Run npm run sui:smoke -- --settlement for real testnet lifecycle receipts. The SDK uses gRPC; the old public JSON-RPC interface is not required.

```diagram
rollup
```
