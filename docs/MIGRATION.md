# Sui testnet fork

This repository preserves the history of [Kondora](https://github.com/enliven17/kondora).
The original repository and working directory remain independent.

The Sui edition replaces the Anchor program, MagicBlock delegation, Solana wallet
adapters and Convex chain writers with Move shared markets, owned trading accounts,
Sui wallet transactions and direct Sui reads. Test collateral is a six-decimal
demonstration coin, explicitly named kUSD; it is not Circle USDC.

The Move package implements binary constant-product markets with bounded leverage,
fully reserved outcome liabilities, an evidence-backed oracle proposal, a dispute
window and claims. The original floating-point Solana curve is not reused on chain.

Deployment receipts, validation results and the submission guide are added as each
stage is completed. No production keys or original environment files are copied.
