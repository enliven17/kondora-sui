# Validation

Validated on 2026-11-19 against the package in `deployments/testnet.json`.

- Nineteen Move unit tests passed, including ownership rejection, oracle authority,
  slippage rejection, reserve limits, interest, partial close, disputes and claims.
  Liquidity tests cover preserved prices and claims, wrong admin, wrong registry,
  and rejection after the close. The compatible v2 upgrade passed an on-chain
  simulation before being signed and executed.
- Thirteen TypeScript tests passed, including 2,000 varied buy/sell rounding checks,
  BCS rejection, leverage/reserve caps, configured-package transaction targets
  address/cooldown validation and internal-only trading/admin writes. The sole
  public write action is the bounded daily test-token faucet. Soak tests cover
  balanced allocation of 200 wallets over 11 pools, rotation, public-market
  selection and reserve checks that allow unrelated traders.
- Faucet Move tests verify exact 100-kUSD supply, the 24-hour boundary, duplicate
  and repeated welcome rejection, sponsor authorization and daily budget limits.
  Real testnet delivery to a wallet with zero SUI succeeded; reconnect, manual
  repeat and concurrent duplicate requests left its balance at exactly 100 kUSD.
  Receipts are in `deployments/daily-faucet-smoke-testnet.json`.
- Production Portfolio was tested with a Wallet Standard QA wallet. Connecting
  automatically delivered 100 kUSD, with zero recipient SUI and zero signing
  requests. The wallet balance refreshed, the claim button showed its countdown,
  and disconnect/reconnect left the balance unchanged. The mobile layout was
  visually inspected. See `deployments/daily-faucet-browser-testnet.json`.
- Typecheck, ESLint, dependency audit and the Next.js production build passed.
- Real testnet smoke completed through proposal, five-minute dispute window,
  finalization and claim. Public digests are in `deployments/smoke-testnet.json`.
- The successful short resumed soak exercised two wallets and ten accounting
  checks with no execution/invariant failures. It needed seven transport retries.
  Long-duration soaking remains a user-run operation; see `docs/SOAK.md`.
- A real public-market soak used three wallets over three existing markets for
  four rounds: six opens, six closes, 22 total transactions and 78 accounting
  checks, with zero failures or transport retries. Each wallet rotated to another
  pool, and cleanup left all three trading accounts empty with no positions.
  Public digests are in `deployments/soak-multimarket-testnet.json`.
- All 200 prepared wallets were checked against their local keys and on-chain
  accounts, gas and kUSD balances. At preparation they held 20,000 kUSD in accounts
  and 180,000 kUSD outside accounts. The dedicated pool received 10,000 kUSD
  liquidity. A later single-market session completed five rounds but failed on
  DNS during cleanup; no clean long 200-wallet run is claimed. Public preparation
  receipts are historical; resume checks current balances and recovers positions.
- The Sui wallet selection dialog and live market list were inspected in the
  browser. Browser signing with a user wallet was not automated; CLI signatures
  were used for the recorded chain tests.
- Social exports were rendered from their original HTML, font and artwork with
  Sui copy, then visually inspected. Main app and marketing CSS are unchanged.
- The original `kondora` directory remained clean at commit `1a86a5c`.

## Security review

The OWASP review checked shared-account authorization, public/backend write
boundaries, input limits, secret isolation, dependency audit and response headers.
Trading/admin signer actions and storage mutations are internal Convex functions.
The anonymous faucet action accepts only a recipient and welcome flag, with a
fixed on-chain amount, sponsor check, per-address cooldown, overall daily cap,
request throttling and signer lock. It cannot sign arbitrary user transactions.
Browser code
receives only public deployment IDs and URLs. Private local files and soak output
are excluded from Git and Vercel uploads.

The package remains a testnet prototype with a trusted admin/oracle model and an
upgrade authority. This review is not an independent smart-contract audit.
