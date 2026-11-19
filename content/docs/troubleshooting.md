---
title: Troubleshooting
description: Resolve common wallet, funding, quote, and settlement issues.
order: 11
section: Reference
---

## Wallet not detected

Use a Sui Wallet Standard wallet and reload after installation. The application is pinned to testnet. A Solana wallet connection cannot authorize Sui transactions.

## No test funds

Connect a wallet to receive the first 100 kUSD automatically. Portfolio shows the daily faucet and its 24-hour countdown. If a transfer could not be confirmed, retry there; the on-chain cooldown prevents duplicate payments. Faucet claims are sponsored, but deposits and trades need testnet SUI from the Sui faucet. Circle USDC and similarly named coins are not accepted by this package.

## Setup needs two approvals

A newly shared Account becomes usable in the next transaction. First create it, then approve the deposit. If setup is interrupted after account creation, reconnect and deposit again.

## Quote or reserve rejection

Refresh the market and lower amount or leverage. The contract checks minimum shares, current time/price leverage caps, executable position health, seed borrowing capacity and full outcome reserves.

## Pending or failed transaction

Check the SuiVision link. A lost RPC response does not establish that a transaction failed. The CLI retries identical signed bytes for transient transport failures; it does not blindly create a second economic action.

## Settlement waits

Trading ends at the contract deadline. A proposal waits five minutes for disputes. A disputed market awaits an admin ruling or the 24-hour timeout. Claims become available only after state RESOLVED.
