---
title: Leverage
description: Margin, borrowing, caps, liquidation and the pre-close wind-down.
order: 4
section: Trading
---

## Margin and borrowing

Notional equals margin times leverage. Debt is notional minus margin. Leverage can reach 5x, subject to time, price, pool reserves and the existing position's health.

## Risk limits

The cap decreases through the final 24 hours and reaches 1x in the final hour. It also tightens near prices of zero and one. Total outstanding debt cannot exceed half the market's initial seed.

## Full outcome reserves

After every opening, vault cash must cover the sum of outstanding YES and NO shares. This conservative requirement also covers INVALID and preserves claims regardless of losses on borrowed exposure. Orders that cannot satisfy it abort.

## Liquidation

Anyone can liquidate an unhealthy position using its shared Account and Market objects. The check uses executable pool exit value: liquidation is allowed when 95% of that value is no greater than debt plus interest. The app's displayed liquidation price is an approximation.

## Close and settlement

Leveraged positions may remain until settlement in this Sui edition. Claims subtract principal and interest, and payouts never go below zero. There is no automatic pre-close debt sweep. Borrow interest stops at the market's close time.

```diagram
leverage
```
