import { SuiGrpcClient } from "@mysten/sui/grpc";
import { NETWORK, SUI_RPC } from "./config";
export const sui = new SuiGrpcClient({
  network: NETWORK, baseUrl: SUI_RPC, timeout: 30000,
  fetch: async (input, init) => {
    const method = String(input).split("/").at(-1) ?? "";
    const read = /^(Get|List|Simulate|Resolve)/.test(method);
    for (let attempt = 0; ; attempt++) {
      try { return await fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) }); }
      catch (error) {
        if (!read || attempt >= 2 || init?.signal?.aborted) {
          const cause = error instanceof Error ? (error.cause as { code?: string } | undefined)?.code : undefined;
          throw new Error(`Sui RPC ${method}: ${String(error)}${cause ? ` (${cause})` : ""}`, { cause: error });
        }
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  },
});
