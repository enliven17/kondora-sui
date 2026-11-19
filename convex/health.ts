"use node";
import { internalAction } from "./_generated/server";
import { readRegistry } from "../lib/sui/read";
import { roleKey } from "./sui";
export const check = internalAction({ args: {}, handler: async () => ({
  network: "testnet", registry: await readRegistry(),
  llmEnabled: process.env.SUI_ENABLE_LLM === "1",
  maxOpenMarkets: Number(process.env.SUI_MAX_OPEN_MARKETS) || 6,
  maxNewMarketsPerRun: Number(process.env.SUI_MAX_NEW_MARKETS) || 1,
  marketSeedKusd: Number(process.env.SUI_MARKET_SEED_KUSD) || 5000,
  dailyFaucet: { id: process.env.SUI_DAILY_FAUCET_ID ?? null, sponsor: roleKey("FAUCET")?.toSuiAddress() ?? null, amountKusd: 100, cooldownHours: 24 },
  roles: Object.fromEntries((["CREATOR", "ORACLE", "AUDITOR", "CRANK"] as const).map((r) => [r, roleKey(r)?.toSuiAddress() ?? "not configured"])),
}) });
