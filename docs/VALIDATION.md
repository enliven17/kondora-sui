# Validation

Validated on 2026-11-19 against the package in `deployments/testnet.json`.

- Fourteen Move unit tests passed, including ownership rejection, oracle authority,
  slippage rejection, reserve limits, interest, partial close, disputes and claims.
  Liquidity tests cover preserved prices and claims, wrong admin, wrong registry,
  and rejection after the close. The compatible v2 upgrade passed an on-chain
  simulation before being signed and executed.
- Seven TypeScript tests passed, including 2,000 varied buy/sell rounding checks,
  BCS rejection, leverage/reserve caps, configured-package transaction targets
  and the absence of public Convex write functions.
- Typecheck, ESLint, dependency audit and the Next.js production build passed.
- Real testnet smoke completed through proposal, five-minute dispute window,
  finalization and claim. Public digests are in `deployments/smoke-testnet.json`.
- The successful short resumed soak exercised two wallets and ten accounting
  checks with no execution/invariant failures. It needed seven transport retries.
  Long-duration soaking remains a user-run operation; see `docs/SOAK.md`.
- All 200 prepared wallets were checked against their local keys and on-chain
  accounts, gas and kUSD balances. They hold 20,000 kUSD in accounts and 180,000
  kUSD outside accounts. The dedicated pool has 10,000 kUSD liquidity. Public
  receipts record preparation and funding; no long 200-wallet run is claimed.
- The Sui wallet selection dialog and live market list were inspected in the
  browser. Browser signing with a user wallet was not automated; CLI signatures
  were used for the recorded chain tests.
- Social exports were rendered from their original HTML, font and artwork with
  Sui copy, then visually inspected. Main app and marketing CSS are unchanged.
- The original `kondora` directory remained clean at commit `1a86a5c`.

## Security review

The OWASP review checked shared-account authorization, public/backend write
boundaries, input limits, secret isolation, dependency audit and response headers.
Signer actions and storage mutations are internal Convex functions. Browser code
receives only public deployment IDs and URLs. Private local files and soak output
are excluded from Git and Vercel uploads.

The package remains a testnet prototype with a trusted admin/oracle model and an
upgrade authority. This review is not an independent smart-contract audit.
