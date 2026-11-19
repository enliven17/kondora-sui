const errors = ["This wallet cannot do that.", "Invalid amount or insufficient balance.", "This market is no longer accepting that action.",
  "The settlement window is still open.", "Lower the leverage to the current market cap.", "The price moved. Refresh and try again.",
  "The pool has reached its reserve limit. Try a smaller amount.", "Evidence must include a SHA-256 hash and a source URI.",
  "No position was found.", "Use a smaller amount or less leverage.", "The market metadata exceeds a limit."];
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/reject|denied|cancel/i.test(message)) return "Transaction cancelled in your wallet.";
  if (/gas|insufficient.*sui/i.test(message)) return "Add testnet SUI for network fees.";
  const code = message.match(/(?:MoveAbort.*?,\s*|abort code[:\s]*)(\d+)\)?/i)?.[1];
  return code && errors[Number(code)] ? errors[Number(code)] : message.slice(0, 240);
}
