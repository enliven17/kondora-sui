"use node";
import { internalAction } from "./_generated/server";
import { readRegistry } from "../lib/sui/read";
import { roleKey } from "./sui";
export const check = internalAction({ args: {}, handler: async () => ({
  network: "testnet", registry: await readRegistry(),
  llmEnabled: process.env.SUI_ENABLE_LLM === "1",
  maxOpenMarkets: Number(process.env.SUI_MAX_OPEN_MARKETS) || 6,
  maxNewMarketsPerRun: Number(process.env.SUI_MAX_NEW_MARKETS) || 1,
  roles: Object.fromEntries((["CREATOR", "ORACLE", "AUDITOR", "CRANK"] as const).map((r) => [r, roleKey(r)?.toSuiAddress() ?? "not configured"])),
}) });
