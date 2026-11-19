---
title: Markets
description: Where markets come from and how the creator agent chooses them.
order: 5
section: Agents
---

## Where questions come from

The Convex creator runs every three hours. It collects candidates from public price, sports, esports and news sources and can use configured model providers to review wording. Only the registry admin can publish markets.

## On-chain metadata

Each market stores its question, summary, category, rules, close time and resolution specification. The resolution JSON also carries source attribution and a deduplication key. Convex indexes this metadata; live pricing comes from chain state.

## Initial liquidity

The testnet creator mints freely available kUSD and funds each market with a demonstration seed. Initial price and reserve allocation are fixed when the market is created. This is test liquidity, not real dollars.

## Categories and availability

The original eight categories remain in the interface. Available markets depend on functioning upstream sources and configured provider keys. Empty categories remain empty rather than showing fabricated activity.
