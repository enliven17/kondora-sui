# Sui testnet soak

Run from this fork, never from the original Solana directory. Only testnet SUI
and freely mintable kUSD are used.

## Funding

The default donor is `.keys/sui-deployer.key`; alternatively set
`SUI_PRIVATE_KEY` in your private shell. Budget **0.15 test SUI per generated
wallet plus 0.1 SUI for the donor**. The runner checks the available balance and
stops if funding is insufficient. Get testnet SUI from the official faucet.

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
```

The duration starts after setup. Writes are sequential to make shared-object
effects and conservation checks deterministic. Increasing wallet count exercises
more accounts; it is not a throughput benchmark. Leverage respects the contract's
current time and price cap.

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
percentiles. Private keys are saved separately in `.keys/soak-TIMESTAMP/`.
Both directories are ignored by Git and Vercel uploads.

After a transport interruption, resume the same test with the same wallet count:

```sh
npm run sui:soak -- --minutes 30 --wallets 4 --resume .soak/sui-TIMESTAMP
```

The resumed session appends to the event log and writes a fresh session summary;
earlier errors remain in the event log. Ctrl+C requests a graceful stop after the
current transaction. Where trading is still open, cleanup closes remaining test
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
