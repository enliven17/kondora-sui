"use node";
import { internalAction } from "./_generated/server";
import { readRegistry } from "../lib/sui/read";
import { roleKey } from "./sui";
export const check = internalAction({ args: {}, handler: async () => ({
  network: "testnet", registry: await readRegistry(),
  roles: Object.fromEntries((["CREATOR", "ORACLE", "AUDITOR", "CRANK"] as const).map((r) => [r, roleKey(r)?.toSuiAddress() ?? "not configured"])),
}) });
