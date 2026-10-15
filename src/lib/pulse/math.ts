/** Stake choices. Points only — never money. 1M markets stop at 100. */
export const STAKES = [10, 50, 100, 500, 1000] as const;
export type Stake = (typeof STAKES)[number];

export type LengthMin = 1 | 5 | 15;
export const LENGTHS: LengthMin[] = [1, 5, 15];

export const WINDOW_MS = 15 * 60 * 1000;
/** A price older than this pauses calls (client UI, demo and server all use it). */
export const STALE_PRICE_MS = 3_000;

export const LOCK_LEAD_MS = 60 * 1000;

/** Lock lead per market length: calls close this long before the market closes.
 * 1M takes calls for 45s, 5M for 4m, 15M for 12m. The next market opens the instant one closes. */
export function lockLeadMs(length: LengthMin): number {
  return length === 1 ? 15_000 : length === 5 ? 60_000 : 180_000;
}

export type Side = "up" | "down";

export function stakesFor(length: LengthMin): readonly number[] {
  return length === 1 ? [10, 50, 100] : STAKES;
}

/** Round a price to cents. Draw compares these. */
export function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Estimated return if this side is right and pools stay as they are.
 * stake + floor((stake / sidePool) * otherPool). No fee.
 * sidePool already includes this stake.
 */
export function estimateReturn(stake: number, sidePool: number, otherPool: number): number {
  if (stake <= 0 || sidePool <= 0) return Math.max(0, stake);
  const profit = Math.floor((stake / sidePool) * otherPool);
  return stake + profit;
}

export function shareOfPool(stake: number, sidePool: number): number {
  if (sidePool <= 0) return 0;
  return (stake / sidePool) * 100;
}

export function windowBounds(now: number, length: LengthMin = 15): {
  opens: number;
  locks: number;
  closes: number;
  length: LengthMin;
} {
  const span = length * 60 * 1000;
  const lead = lockLeadMs(length);
  const opens = Math.floor(now / span) * span;
  return { opens, locks: opens + span - lead, closes: opens + span, length };
}
