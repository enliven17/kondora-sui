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
