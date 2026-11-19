---
title: Trading
description: Prices, shares, fees and how a trade executes.
order: 3
section: Trading
---

## Binary prices

YES and NO prices sum to one. The Sui edition uses a constant-product complete-set market maker with integer reserves. YES price is the NO reserve divided by the sum of both reserves.

## Shares and price impact

An opening buy adds its net notional to both virtual reserves, then removes shares from the selected side while preserving or increasing the reserve product. Larger orders move the price more. Quotes use the same integer rounding as Move; execution remains authoritative.

## Fees

Opening fee is 0.5% of notional. Borrow interest is 0.02% per hour, rounded up in base units. This Sui edition charges no separate close fee or liquidation penalty. Network gas is paid in testnet SUI for each transaction.

## Slippage

The app sets minimum shares on opens and minimum proceeds on closes. A moved quote can abort safely. Do not automatically resubmit an uncertain transaction with a new signature: check its digest first.

## Funding

kUSD deposits credit the shared trading account. Unused balance can be withdrawn at any time. Margin inside an open position must first be closed or claimed.
