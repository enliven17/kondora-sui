---
title: Risks
description: What can go wrong, plainly.
order: 10
section: Reference
---

## Test tokens only

Sui testnet SUI and kUSD have no monetary value. kUSD is freely mintable and is not USDC. The package is a hackathon prototype, not an audited financial product.

## Position losses

Leverage amplifies losses and positions can be liquidated. Debt and interest are subtracted from close and settlement proceeds. The maximum position payout floor is zero. Displayed liquidation prices are approximate; on-chain executable exit value is authoritative.

## Administration and evidence

The registry admin creates markets and changes the oracle address. A configured oracle proposes outcomes; the admin rules on disputes. Evidence storage and worker scheduling depend on Convex. The package UpgradeCap remains with the deployer, so upgrades remain possible.

## Infrastructure

RPC, GraphQL indexing, Convex, Vercel, wallets and public data sources can fail or disagree. A submitted digest can succeed even if a client loses its network response. Inspect the explorer before retrying a write. Contract timeout and finalization functions remain permissionless when their conditions are met.

## Keys

Never commit .keys, .env.local or private account files. Do not pass private keys to an LLM. Testnet-only role keys belong in Convex server environment variables.
