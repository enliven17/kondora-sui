# CLAY Hackathon submission

Official checklist: https://hackathon.lofitheyeti.com/

## Project identity

**Title:** Kondora Sui

**Description:** Kondora is an agent-driven prediction market on Sui testnet.
Traders choose YES or NO with up to 5x bounded leverage. Shared Move objects
enforce owner-controlled balances, constant-product execution and full outcome
reserves. Creator, oracle and auditor agents run through Convex, with evidence
hashes committed on chain and a public dispute window before claims.

**Repository:** https://github.com/enliven17/kondora-sui

**Logo:** `brand/social/avatar-plum.png` (1024 × 1024 PNG)

**Website:** https://sui.kondora.xyz (custom domain; see deployment notes for DNS)

**Package:** See `deployments/testnet.json` for the exact package, registry, faucet
and publish digest. `deployments/smoke-testnet.json` provides lifecycle receipts.

The GitHub repository description is intentionally blank. The text above is for
the hackathon's required project-description field.

## Three-to-five-minute demo outline

1. **0:00–0:30:** Introduce the problem and show the preserved Kondora interface.
2. **0:30–1:15:** Browse actual Sui testnet markets, probabilities and source rules.
3. **1:15–2:00:** Connect a Sui wallet, mint valueless kUSD, deposit and place a bet.
4. **2:00–2:45:** Show the position, live chain state, closing and withdrawal.
5. **2:45–3:30:** Show the Move package and smoke receipts for evidence proposal,
   finalization and claim; explain the five-minute challenge window.
6. **3:30–4:00:** Show the soak report, documentation and agent CLI.

A demo video is required by the organizer, with a YouTube link preferred. The
team lead name, email, contact handle and final video URL are submission inputs
the project owner supplies. This repository does not submit the application.

## Scope and provenance

This is a migration of the owner's existing Solana project, with its history
preserved. The Sui work adds a new Move implementation, current Sui SDK/wallet
support, separate hosting/backend deployments, real testnet lifecycle validation
and a Sui soak runner. Describe that provenance accurately in the submission.

Walrus and DeepBook are ecosystem components listed by the organizer, but this
project does not claim integrations it has not implemented. No judging deadline,
prize or eligibility guarantee is inferred from the public checklist.
