# Sui deployment

## Live services

| Service | Address |
| --- | --- |
| Website | https://kondora-sui.vercel.app |
| Canonical custom domain | https://sui.kondora.xyz |
| Convex backend | https://astute-toad-61.eu-west-1.convex.cloud |
| Convex HTTP | https://astute-toad-61.eu-west-1.convex.site |
| GitHub | https://github.com/enliven17/kondora-sui |

The Vercel project is `cankats-projects/kondora-sui`; the Convex project is
`kiro2:kondora-sui` with its own production deployment. Neither shares the
original project's deployment or data. GitHub is connected to the new Vercel
project. Production frontend changes deploy from this repository.

## Domain

`sui.kondora.xyz` is attached to the Sui Vercel project. The domain has no working
DNS yet. After buying `kondora.xyz`, add this record at its DNS provider:

| Type | Name | Target |
| --- | --- | --- |
| CNAME | `sui` | `cname.vercel-dns.com` |

This target was returned by the Vercel domain configuration API on 2026-11-19.
Do not change the apex or `www` records to connect this Sui project. Use the
working Vercel URL until DNS propagation and certificate provisioning complete.

## Frontend variables

`NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` point to this fork's
backend. Package IDs default to the public `deployments/testnet.json` receipt.
Set `NEXT_PUBLIC_SUI_RPC` only to a compatible Sui testnet gRPC endpoint.

`vercel.json` selects Next.js and `npm ci`/`npm run build`. `.vercelignore`
excludes private keys, local environment files, soak output and Move build output.

## Contracts and agents

`deployments/testnet.json` records the package and publication transaction.
`deployments/agents-testnet.json` records public creator/oracle/auditor addresses.
The creator uses the isolated Sui deployer; oracle and auditor use separate newly
generated testnet keys. Crank finalization uses the oracle's testnet key.

Provider settings were copied read-only from the owner's existing Convex
deployment. Original Solana wallet keys and environment files were not copied.
Role keys and provider credentials exist only in local ignored files and the
new Convex server environment; they are never public frontend variables.

Crons index Sui every minute, check proposals/finalization every two minutes,
and run the creator every six hours. Creation stops at six open public markets,
with at most one new market per run. Normal mode uses SUI/BTC/ETH price feeds
with model calls disabled to preserve the shared API quota. Wallet addresses
and server budget settings are in [FUNDING.md](FUNDING.md). For manual operations:

```sh
npx convex deploy --typecheck enable
npx convex run --deployment production indexer:run
npx convex run --deployment production oracle:run
npx convex run --deployment production creator:run
npx convex run --deployment production health:check
```

The public HTTP API is read-only. Public evidence bundles are served at
`/evidence/SHA256` on the Convex HTTP host. Contract writes remain signed Sui
transactions and all backend writes are internal Convex functions.

## Verification receipts

`deployments/upgrade-testnet.json` records the compatible v2 upgrade adding
admin-only permanent liquidity top-ups. Existing registry, faucet, account,
market IDs and kUSD type origins are unchanged. Regular trading continues
against the original package; the admin liquidity script calls the v2 package.
`deployments/liquidity-testnet.json` records the actual funding transactions.

`deployments/smoke-testnet.json` records real mint, funding, trading, withdrawal,
proposal, finalization and claim transactions. The proposal waits the actual
five-minute dispute period. A simulated stranger withdrawal is required to fail.

`deployments/soak-testnet.json` is the successful short resumed soak session:
two wallets, two rounds, ten accounting checks, one rejected unauthorized
withdrawal and no execution/invariant failures. Seven transport retries were
needed. This is a functional validation, not a completed long-duration soak or
a throughput result. Earlier interruptions remain in local `.soak/` logs.

The fourteen Move unit tests, seven TypeScript tests, typecheck, lint and production
build are the reproducible local checks. The package has not received an
independent security audit.
