---
title: Troubleshooting
description: Resolve common wallet, funding, quote, and settlement issues.
order: 11
section: Reference
---

## Wallet not detected

Use a Sui Wallet Standard wallet and reload after installation. The application is pinned to testnet. A Solana wallet connection cannot authorize Sui transactions.

## No test funds

Use the Sui faucet for testnet SUI and the in-app Mint 1,000 free test kUSD button for collateral. Circle USDC and similarly named coins are not accepted by this package.

## Setup needs two approvals

A newly shared Account becomes usable in the next transaction. First create it, then approve the deposit. If setup is interrupted after account creation, reconnect and deposit again.

## Quote or reserve rejection

Refresh the market and lower amount or leverage. The contract checks minimum shares, current time/price leverage caps, executable position health, seed borrowing capacity and full outcome reserves.

## Pending or failed transaction

Check the SuiVision link. A lost RPC response does not establish that a transaction failed. The CLI retries identical signed bytes for transient transport failures; it does not blindly create a second economic action.

## Settlement waits

Trading ends at the contract deadline. A proposal waits five minutes for disputes. A disputed market awaits an admin ruling or the 24-hour timeout. Claims become available only after state RESOLVED.
