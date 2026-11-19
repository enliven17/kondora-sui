---
title: How it works
description: The life of a market, from creation to payout.
order: 2
section: Getting started
---

## From question to payout

The creator selects a source and unambiguous rules, then funds a shared Move Market. A Registry records every market object ID. The app and Convex read the same objects.

## Trading

A shared Account holds a wallet owner's balance and positions. Opening moves margin into the market vault and records shares and debt. Closing sells shares against the constant-product reserves, subtracts debt and interest, and credits remaining equity. Only the owner can deposit, withdraw, open, close or claim.

## Settlement

Trading stops at the on-chain close time. The configured oracle proposes YES, NO or INVALID with a SHA-256 evidence hash and a URI. Anyone can challenge during five minutes. Unchallenged proposals finalize permissionlessly. A disputed outcome requires an admin ruling after the window or becomes INVALID after 24 hours without resolution.

## Payouts

Winning shares pay one kUSD each before debt and accrued interest. Losing shares pay zero. INVALID pays YES at the frozen close mark and NO at its complement. Debt accrual stops at close.

```diagram
lifecycle
```
