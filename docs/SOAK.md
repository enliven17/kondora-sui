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

The runner creates a dedicated market, saves generated keys under `.keys/`, mints
kUSD and deposits 100 kUSD per wallet. It never reads original Solana keys.

## Commands

```sh
# Quick functional pass
npm run sui:soak -- --minutes 5 --wallets 2 --rounds 2 --interval-ms 0

# Thirty-minute run
npm run sui:soak -- --minutes 30 --wallets 4 --interval-ms 2500

# Six-hour run
npm run sui:soak -- --minutes 360 --wallets 8 --interval-ms 5000

# Prepare 200 funded wallets and trading accounts without starting a long soak
npm run sui:soak -- --wallets 200 --prepare-only

# Use the existing prepared set (replace TIMESTAMP with the printed directory)
npm run sui:soak -- --wallets 200 --minutes 30 --resume .soak/sui-TIMESTAMP
```

Gas funding uses batches of 25 recipients. Setup uses two workers by default
(`--setup-concurrency 1..8`), combines minting and account creation in one signed
transaction, and deposits in a following transaction. Every prepared account
receives 100 test kUSD; the remaining 900 kUSD stays in its wallet. Setup is
resumable even when interrupted partway through funding or account creation.

The duration starts after setup. Trading writes remain sequential to make
shared-market effects and conservation checks deterministic. Read checks use
bounded concurrency. Increasing wallet count exercises more accounts; it is
not a throughput benchmark. Leverage respects the contract's current time and
price cap. A round can take longer than the requested duration with 200 wallets;
the timer is checked between complete rounds.

## What is checked

Each round checks:

1. Wallet kUSD plus account balances plus market vault equals starting collateral.
2. Outstanding YES shares equal the market YES liability.
3. Outstanding NO shares equal the market NO liability.
4. Position debt sums to the market's debt counter.
5. Vault cash covers combined outcome liabilities.

Every fifth round simulates an unauthorized withdrawal and requires rejection.
Transactions, latency and net gas are recorded. Any invariant or execution failure
sets a failing exit code. Read failures are retried with deadlines. Uncertain
submissions retry identical signed bytes, preserving transaction identity.

Keep the test market isolated from manual trades while checking exact conservation.
The market is public; external trades in that specific pool alter the expected
per-wallet accounting and correctly interrupt this isolated scenario.

## Reports and recovery

`.soak/sui-TIMESTAMP/events.jsonl` records actions and public digests.
`summary.json` records rounds, failures, conservation checks, gas and latency
percentiles. `wallets.json` lists public addresses, with no secrets. Progress is
saved after every prepared wallet. Private keys are saved separately in
`.keys/soak-TIMESTAMP/`.
Both directories are ignored by Git and Vercel uploads.

After a transport interruption, resume the same test with the same wallet count:

```sh
npm run sui:soak -- --minutes 30 --wallets 4 --resume .soak/sui-TIMESTAMP
```

The resumed session appends to the event log and writes a fresh session summary;
earlier errors remain in the event log. Ctrl+C requests a graceful stop after the
current trading transaction (setup workers finish their active operations first).
Resuming reuses keys and accounts, avoids minting again when collateral already
exists, and tops up gas only when a wallet has less than 0.005 SUI. Where trading
is still open, cleanup closes remaining test
positions and withdraws the available trading balance to each generated wallet.

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
