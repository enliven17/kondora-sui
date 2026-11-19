# Sui testnet soak

Run from this fork, never from the original Solana directory. Only testnet SUI
and freely mintable kUSD are used.

## Funding

The default donor is `.keys/sui-deployer.key`; alternatively set
`SUI_PRIVATE_KEY` in your private shell. Up to 20 wallets default to **0.15 test
SUI each**. Larger runs, up to 200 wallets, default to **0.02 SUI each**, plus
at least 0.1 SUI donor reserve. A fresh 200-wallet preparation needs approximately
**4.1 test SUI**; keep additional donor gas for setup transactions and later top-ups.
Override with `--gas-per-wallet 0.05` for longer runs. The runner checks available
balance before transfers. A 0.02 SUI allocation is a starting budget, not a promise
of gas for any duration. Get testnet SUI from the official faucet.

By default the runner trades existing public open markets. It excludes smoke/soak
test pools and markets closing within a minute. Wallets are spread evenly across
eligible markets, with both YES and NO represented when enough wallets are used.
After closing, each wallet rotates to another market and switches side. Eligible
markets are refreshed each round. No extra market or model call is created.

Generated keys stay under `.keys/`. Setup mints kUSD and deposits 100 kUSD per
wallet. It never reads original Solana keys. Use `--market-limit 3` to restrict
the number of existing markets, or `--markets ID1,ID2` to select open object IDs.
The default limit is 50 markets.

For a separate, single-pool conservation scenario use `--isolated`. This opt-in
mode creates a dedicated test market with 500 kUSD seed for small runs and
10,000 kUSD above 20 wallets. Override with `--seed-kusd`. Its conservation
baseline includes the actual vault balance when the session starts.

## Commands

```sh
# Quick pass across three existing markets, including rotation and closing
npm run sui:soak -- --minutes 5 --wallets 3 --gas-per-wallet 0.02 --market-limit 3 --rounds 4 --interval-ms 0

# Thirty-minute run
npm run sui:soak -- --minutes 30 --wallets 4 --interval-ms 2500

# Six-hour run
npm run sui:soak -- --minutes 360 --wallets 8 --interval-ms 5000

# Prepare 200 funded wallets and trading accounts without starting a long soak
npm run sui:soak -- --wallets 200 --prepare-only

# Use the existing prepared set (replace TIMESTAMP with the printed directory)
npm run sui:soak -- --wallets 200 --minutes 30 --resume .soak/sui-TIMESTAMP

# Optional dedicated single-market scenario
npm run sui:soak -- --isolated --wallets 2 --minutes 5 --rounds 2
```

Gas funding uses batches of 25 recipients. Setup uses two workers by default
(`--setup-concurrency 1..8`), combines minting and account creation in one signed
transaction, and deposits in a following transaction. Every prepared account
receives 100 test kUSD; the remaining 900 kUSD stays in its wallet. Setup is
resumable even when interrupted partway through funding or account creation.

The duration starts after setup. Trading writes remain sequential so the runner
can account for each signed transaction before proceeding. Read checks use
bounded concurrency. Increasing wallet count exercises more accounts; it is
not a throughput benchmark. Leverage respects the contract's current time and
price cap. A round can take longer than the requested duration with 200 wallets;
the timer is checked between complete rounds.

## What is checked

Each round checks:

1. Wallet kUSD plus account balances match the starting cash adjusted by actual
   signed trade events: opening margins leave accounts, closing/claim payouts enter.
2. Each watched market's YES liability covers the cohort's YES shares.
3. Each watched market's NO liability covers the cohort's NO shares.
4. Each watched market's debt counter covers the cohort's position debt.
5. Every watched vault covers its full combined YES and NO liabilities, including
   other traders' positions.

Every fifth round simulates an unauthorized withdrawal and requires rejection.
Transactions, latency and net gas are recorded. Any invariant or execution failure
sets a failing exit code. Read failures are retried with deadlines. Uncertain
submissions retry identical signed bytes, preserving transaction identity.

Public-market checks allow other users to trade the same pools. Keep the generated
soak wallets exclusive to this runner: external wallet transfers or liquidations
of cohort positions can change cash outside its signed-event ledger and stop it.
In `--isolated` mode, liability and debt checks require exact equality, and wallet
cash plus the dedicated vault must equal starting collateral. Keep that pool free
of external trades and liquidity additions during a session.

## Reports and recovery

`.soak/sui-TIMESTAMP/events.jsonl` records actions and public digests.
`summary.json` records selected `marketIds`, per-market `marketActivity` (opens,
closes, claims and opening notional), rounds, failures, accounting checks, gas and
latency percentiles. Console output includes market IDs and per-market counters.
`wallets.json` lists public addresses, with no secrets. Progress is
saved after every prepared wallet. Private keys are saved separately in
`.keys/soak-TIMESTAMP/`.
Both directories are ignored by Git and Vercel uploads.

After a transport interruption, resume the same test with the same wallet count:

```sh
npm run sui:soak -- --minutes 30 --wallets 4 --resume .soak/sui-TIMESTAMP
```

The resumed session appends to the event log and writes a fresh session summary;
earlier errors remain in the event log. A process lock prevents two new runners
from using the same wallet set. Stop any older Sui runner before resuming.
Ctrl+C during trading requests cleanup after the current trading transaction;
setup/read workers finish their active operations before stopping.
Resuming reuses keys and accounts, avoids minting again when collateral already
exists, and tops up gas only when a wallet has less than 0.005 SUI. Where trading
is still open, the runner closes remaining positions across all markets, including
the old dedicated pool when resuming an older run. Resolved positions are claimed;
closed unresolved ones wait for settlement. Cleanup withdraws the available
trading balance to each generated wallet.

If cleanup is interrupted, use the saved key with the CLI:

```powershell
$env:SUI_KEY_FILE = '.keys/soak-TIMESTAMP/0.key'
npm run agent -- account
npm run agent -- close MARKET_ID yes
npm run agent -- withdraw 10
```

If trading has ended, wait for resolution and use `claim`. The smoke test's
`--settlement` mode separately verifies proposal, the real five-minute dispute
window, finalization and claim. An interrupted settlement smoke can resume with
`npm run sui:smoke -- --resume` using its saved evidence bundle.

## Prepared 200-wallet set

The set `.soak/sui-2026-11-19T11-48-43-207Z` was prepared on 2026-11-19.
All 200 private keys match unique public addresses. On-chain verification found
200 accounts holding 100 kUSD each, 900 kUSD in each wallet and at least
0.012792765 SUI gas after setup. Each wallet initially received 0.02 SUI.
The original dedicated market received a 10,000 kUSD seed. The public preparation
receipt is `deployments/soak-wallets-testnet.json`. These are preparation-time
balances. A later single-market session completed five rounds but failed during
cleanup with a DNS transport error; it is not a clean 200-wallet soak result.
Resume recovers remaining open positions and rechecks current balances and gas.

Run the same wallet set across existing public markets. Keys and accounts are
reused; low-gas wallets may require top-ups from the donor:

```sh
npm run sui:soak -- --wallets 200 --minutes 30 --resume .soak/sui-2026-11-19T11-48-43-207Z
```

Keep the private key directory on this machine. The manifest and reports contain
public data only; neither local keys nor run output are pushed to GitHub.
