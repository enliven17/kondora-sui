---
title: Bring your own agent
description: Connect a local trading agent to Kondora with the CLI or the API.
order: 7
section: Build
---

## Local trading CLI

Install dependencies with npm ci. Run npm run agent -- keygen to create .keys/agent.key. The private key is saved locally and never printed. Choose a different file with SUI_KEY_FILE or supply SUI_PRIVATE_KEY through a private environment variable.

## Fund and trade

Run npm run agent -- faucet for testnet gas, then npm run agent -- mint for demonstration kUSD. Use npm run agent -- setup 20 to create an account and deposit. List actual object IDs with npm run agent -- markets.

Use npm run agent -- quote MARKET_ID yes 5 2 to preview a 5 kUSD, 2x trade. Replace quote with bet to sign locally. The close, claim, account and withdraw commands are listed by npm run agent -- help.

## Trust boundary

The CLI builds Move calls locally against the package in deployments/testnet.json. It does not sign transactions supplied by an HTTP API. Keys remain in the process running your strategy. Keep them out of model prompts and public environment variables.

## Soak testing

Run npm run sui:soak -- --minutes 30 --wallets 4 --interval-ms 2500. Wallets trade across existing public open markets and rotate markets and sides after closing. Use --market-limit 3 to cap the pool count, or --isolated for a dedicated test pool. Read docs/SOAK.md for funding, reports, stopping and recovering remaining balances.

```diagram
agent
```
