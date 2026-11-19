---
title: Glossary
description: A plain-language reference for the terms used across Kondora.
order: 12
section: Reference
---

## Account

A shared Move object holding an owner's available kUSD and positions. Every owner action verifies the transaction sender.

## Market and registry

A Market is a shared pool and its immutable question/rules plus mutable trading and settlement state. The Registry records market IDs and account lookup entries.

## Margin, notional and debt

Margin is the trader's contribution. Notional is margin multiplied by leverage. Debt is the difference and accrues hourly interest until close.

## Reserves and liabilities

Virtual YES/NO reserves determine the constant-product execution price. Liabilities are outstanding outcome shares. Vault cash must cover both sides' combined shares.

## kUSD and SUI

kUSD is the six-decimal valueless demonstration collateral. Testnet SUI pays gas. A digest identifies a transaction; an object ID identifies persistent Move state.

## Proposal, dispute and INVALID

A proposal includes an outcome and evidence hash. The five-minute dispute window allows challenges. INVALID pays the frozen YES mark and its NO complement instead of a binary winner.
