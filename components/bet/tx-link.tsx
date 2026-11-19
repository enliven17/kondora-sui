import { shortHash } from "@/lib/format";
import type { TxLink as TxLinkData } from "@/lib/trade";
import { cn } from "@/lib/utils";

/** Explorer link for a signature. ER transactions open the explorer on the rollup RPC. */
export function TxLink({ tx, className }: { tx: TxLinkData; className?: string }) {
  return (
    <a
      href={tx.explorer}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("font-mono text-[11px] text-haze underline decoration-line/20 underline-offset-4 hover:text-fg", className)}
    >
      {"Sui"} tx {shortHash(tx.signature, 5)}
    </a>
  );
}
