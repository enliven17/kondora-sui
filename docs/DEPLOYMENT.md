# Sui deployment

## Live services

| Service | Address |
| --- | --- |
| Website / canonical domain | https://sui.kondora.xyz |
| Vercel fallback | https://kondora-sui.vercel.app |
| Convex backend | https://astute-toad-61.eu-west-1.convex.cloud |
| Convex HTTP | https://astute-toad-61.eu-west-1.convex.site |
| GitHub | https://github.com/enliven17/kondora-sui |

The Vercel project is `cankats-projects/kondora-sui`; the Convex project is
`kiro2:kondora-sui` with its own production deployment. Neither shares the
original project's deployment or data. GitHub is connected to the new Vercel
project. Production frontend changes deploy from this repository.

## Domain

The purchased domain uses Hostinger DNS. Vercel assignments are:

| Domain | Vercel project | Behavior |
| --- | --- | --- |
| `kondora.xyz` | `cankats-projects/kondora` | Solana production |
| `www.kondora.xyz` | `cankats-projects/kondora` | 308 redirect to `kondora.xyz` |
| `sui.kondora.xyz` | `cankats-projects/kondora-sui` | Sui production |

The following existing Hostinger records were checked on 2026-11-19 against
Vercel's domain configuration API and the authoritative DNS server:

| Type | Name | Target | TTL |
| --- | --- | --- | --- |
| A | `@` | `216.198.79.1` | 60 |
| CNAME | `www` | `a5588bac4b1a80cb.vercel-dns-017.com` | 300 |
| CNAME | `sui` | `ddb0338423d529de.vercel-dns-017.com` | 14400 |

The authoritative nameservers are `horizon.dns-parking.com` and
`orbit.dns-parking.com`. At setup, the newly registered domain was still absent
from the public `.xyz` delegation. Use the Vercel fallback URLs until registry
publication, DNS propagation and HTTPS certificate provisioning complete.

Both apps generate their default Open Graph and Twitter images at the root
`/opengraph-image` and `/twitter-image` routes. This covers the landing page,
Markets and Portfolio. Documentation keeps its individual share cards. Sui
cards display `sui.kondora.xyz`; Solana cards display `kondora.xyz`.

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
transactions. Trading/admin backend writes are internal Convex functions. The
bounded daily faucet is the sole public Convex write action, separate from the
read-only HTTP endpoints.

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

The nineteen Move unit tests, thirteen TypeScript tests, typecheck, lint and production
build are the reproducible local checks. The package has not received an
independent security audit.

## Sponsored daily faucet

The compatible v3 package and daily object are recorded in
`deployments/daily-faucet-package-testnet.json` and
`deployments/daily-faucet-testnet.json`. The dedicated faucet signer was funded
with 0.3 testnet SUI and is stored in `.keys/sui-faucet.key` locally and
`SUI_FAUCET_SECRET` on Convex. `SUI_DAILY_FAUCET_ID` and
`SUI_DAILY_FAUCET_PACKAGE_ID` select this instance. They never replace the
original trading package, registry or collateral type origins.

For a new deployment, upgrade from the latest receipt with `sui:upgrade`, then
run `npx tsx scripts/sui-faucet-setup.ts` and deploy Convex. The setup is
idempotent once its receipt exists. Monitor the sponsor's testnet gas; users do
not pay gas for faucet claims, but still pay for deposits and trading.
