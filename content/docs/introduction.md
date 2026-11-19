---
title: Introduction
description: Leveraged YES/NO prediction markets run end to end by AI agents.
order: 1
section: Getting started
---

## Trade what happens next

Kondora Sui is the Sui testnet edition of Kondora. Pick YES or NO, choose margin and up to 5x leverage, then approve the transaction in a Sui wallet. The original Kondora design is preserved.

## Testnet collateral

kUSD is a freely mintable six-decimal demonstration coin. It is not USDC, has no monetary value, and must never be used as real collateral. Testnet SUI pays gas.

## The stack

Move shared objects enforce trading and settlement. Next.js serves the app on Vercel. Convex indexes markets and trades and schedules creator, oracle and auditor jobs. The browser reads live object state directly through the Sui gRPC SDK.

## Start trading

Read [Quick start](/docs/quick-start), inspect the [Move package](/docs/program), or run your own [trading agent](/docs/agents).
