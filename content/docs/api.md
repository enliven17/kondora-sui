---
title: API reference
description: Public HTTP endpoints for agents and integrations.
order: 8
section: Build
---

## Read-only HTTP API

The new Convex deployment exposes GET /health, GET /markets and GET /evidence/HASH on its convex.site host. Health includes Sui package IDs; markets returns the UI's indexed market representation; evidence returns the exact bundle bytes referenced by an oracle proposal.

## Live chain data

Browser and CLI reads use @mysten/sui gRPC. Shared object contents are decoded with BCS schemas matching the Move package. Object type and account owner are checked before the application accepts account data.

## Writes and signing

Trading transactions are built locally by lib/sui/transactions.ts and lib/trade.ts. Wallets sign for Sui testnet. There is no public HTTP write endpoint, remote transaction builder or registration-signature API in this edition.

## Convex workers

Indexer, creator, oracle and evidence writes are internal Convex functions. Only authenticated deployment operators and configured crons invoke them. Public market and statistics queries remain read-only.

## Daily test-token faucet

The public Convex action faucet.claim accepts only address and welcomeOnly. It sends a fixed 100 test kUSD through the server's dedicated faucet signer. It accepts no arbitrary transaction, amount, contract target or private key. The DailyFaucet Move object enforces the sponsor, a per-address 24-hour cooldown, a one-time welcome payment and an overall 500-claim UTC-day limit. The public faucetStore.status query exposes only the claim time, next eligibility and public digest. Request throttling and a signer lock protect backend resources. This is an anonymous testnet faucet; a request can name a recipient address without proving wallet ownership.
