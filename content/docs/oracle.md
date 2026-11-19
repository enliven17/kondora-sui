---
title: Oracle and audit
description: How markets settle, how evidence is sealed, and how settlements are checked.
order: 6
section: Agents
---

## Proposals and evidence

The oracle first checks deterministic sources. Optional multi-provider council mode is disabled on this deployment to preserve shared API quota. A result must meet 85% confidence before the configured oracle signs a proposal. Existing proposals can finalize after the dispute window even when model mode is off; unresolved markets retain the 24-hour INVALID timeout.

## Verify a bundle

The oracle stores the exact JSON bundle in Convex and publishes its SHA-256 hash plus a public evidence URI in the Move Market. Fetch the URI and hash its raw bytes to compare with the on-chain hash. Evidence persistence is centralized in this edition; Walrus is not integrated.

## Audit and challenge

A separately configured auditor re-fetches deterministic sources or uses the audit model provider. A conflicting conclusion at 90% confidence can trigger an on-chain challenge. Anyone may challenge within the five-minute dispute window with their own evidence hash and URI.

## Finality

An unchallenged proposal finalizes after five minutes. A challenged market requires the registry admin to rule after the window. Without a completed resolution, a permissionless 24-hour timeout produces INVALID. The registry admin initially controls the oracle address and can change it; this is a trusted testnet administration model.

## Provider availability

Missing sources and unavailable model providers can delay proposals. The 24-hour timeout remains callable on chain. Auditor scheduling is off-chain and is not a guarantee that every proposal has been reviewed before finalization.

```diagram
oracle
```
