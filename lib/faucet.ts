export const FAUCET_AMOUNT = 100;
export const FAUCET_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export function faucetAddress(value: string): string {
  if (!/^0x[0-9a-f]{64}$/i.test(value) || /^0x0{64}$/i.test(value)) throw new Error("Enter a valid Sui wallet address.");
  return value.toLowerCase();
}
export function faucetEligibility(lastClaimedAt: number | null, now: number, welcomeOnly: boolean) {
  if (lastClaimedAt === null) return { eligible: true, nextClaimAt: 0 };
  const nextClaimAt = lastClaimedAt + FAUCET_COOLDOWN_MS;
  return { eligible: !welcomeOnly && now >= nextClaimAt, nextClaimAt };
}
export type FaucetResult = { state: "sent" | "cooldown" | "retry" | "error"; nextClaimAt?: number; digest?: string; message?: string };
