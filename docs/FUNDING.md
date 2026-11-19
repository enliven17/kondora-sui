# Sui testnet wallets

These are new wallets created for this fork. **Send only Sui testnet SUI.**
They are unrelated to the original Solana wallets. kUSD collateral is minted for
free by the testnet faucet; it does not need to be bought or sent manually.

| Role | Testnet address |
| --- | --- |
| Creator / deployer | `0xd99e726620eece55420d867cb312a8c6beec92825dec9ed1bf9eb9802d2b6fe3` |
| Oracle / crank | `0x091627e9a72f7f4c96e46fd30bf1e88b0c4f635c6112f840c677e4ac11f78619` |
| Auditor | `0xa8be7faf34749de75e5f22a4637b787cb51b6e5549cf34dbfce881f9c9f39320` |
| Daily faucet sponsor | `0x22c0699cac4c2c2231b758074d633a4ab1724dc4cc5dc60f84f4ee33a89f9c0d` |

Use https://faucet.sui.io/?network=testnet or an already funded testnet wallet.
The official [automation guide](https://faucet.sui.io/how-to-use/) supports direct
V3 proof-of-work requests. The CLI already uses `requestSuiFromFaucetV3` from the
Sui SDK; V2 is not used for the public faucet. For the creator, run:

```powershell
$env:SUI_KEY_FILE = '.keys/sui-deployer.key'
npm run agent -- faucet
Remove-Item Env:SUI_KEY_FILE
```

Faucet proof computation can take time or expire; it is not guaranteed funding.
Initial gas was supplied for deployment and validation. Keep the creator funded
for new markets and soak wallet funding, the oracle for proposals/finalization,
and the auditor for challenges. The deployer's UpgradeCap remains local.
The daily faucet sponsor pays the gas for welcome and daily 100-kUSD grants.
It was initially funded with 0.3 testnet SUI and can be topped up separately.

Keys are saved in `.keys/sui-deployer.key`, `.keys/sui-oracle.key` and
`.keys/sui-auditor.key`, and the applicable signer keys are set only in this
fork's Convex server environment. Never share or commit these files.
The additional daily faucet key is `.keys/sui-faucet.key`.

## Shared API budget

The Sui deployment defaults to six open public markets, at most one new market
per creator run, and a six-hour creator interval. It uses deterministic SUI,
BTC and ETH price questions with **LLM calls disabled**. Consequently it does
not consume the shared Gemini/Groq/Token Harbor model quota in normal mode.

Existing on-chain markets settle according to their published rules; they are
not cancelled or rewritten to satisfy the new creation cap. No new market is
created while the open count is at or above six. Test-tagged smoke/soak pools
do not consume the public creation budget.

Server settings: `SUI_MAX_OPEN_MARKETS=6`, `SUI_MAX_NEW_MARKETS=1`,
`SUI_ENABLE_LLM=0`. Optional council/model mode requires explicitly changing the
last value to `1`. If legacy council markets are present while model mode is
off, their permissionless 24-hour INVALID timeout remains available.

## Market liquidity

The compatible v2 package adds admin-only permanent house liquidity to open
markets. It preserves the existing object IDs, collateral type, shares and debt,
and scales both reserves proportionally. Public markets now have a 5,000 kUSD
seed and the prepared 200-wallet soak pool has 10,000 kUSD. The 12 top-up
transactions added 59,000 valueless kUSD in total; receipts are in
`deployments/liquidity-testnet.json`. No extra markets were opened.

Future creator runs use `SUI_MARKET_SEED_KUSD=5000`. To idempotently top up existing
open markets to those targets, use:

```sh
npm run sui:liquidity -- --soak-dir .soak/sui-2026-11-19T11-48-43-207Z
```
