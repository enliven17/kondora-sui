---
title: Markets
description: Where markets come from and how the creator agent chooses them.
order: 5
section: Agents
---

## Where questions come from

The Convex creator runs every six hours. Normal mode creates sourced SUI, BTC and ETH price markets with no model calls, at most one per run and only while fewer than six public markets are open. Existing markets retain their published rules. Optional model mode can use the broader source adapters. Only the registry admin can publish markets.

## On-chain metadata

Each market stores its question, summary, category, rules, close time and resolution specification. The resolution JSON also carries source attribution and a deduplication key. Convex indexes this metadata; live pricing comes from chain state.

## Initial liquidity

The testnet creator mints freely available kUSD and seeds new public markets with 5,000 kUSD by default. The registry admin can permanently add house liquidity to an open market through the compatible v2 package. Both reserves scale together to preserve the current probability, while existing shares and debt remain unchanged. Added liquidity increases the funded seed and borrowing capacity. There are no redeemable LP tokens or house withdrawals. This is test liquidity, not real dollars.

## Categories and availability

The original eight categories remain in the interface. Available markets depend on functioning upstream sources and configured provider keys. Empty categories remain empty rather than showing fabricated activity.
