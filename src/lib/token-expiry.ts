export type TokenExpiryStatus = 'ok' | 'warning' | 'expired';

export interface TokenExpiryInfo {
  status: TokenExpiryStatus;
  /** Human-readable label, e.g. "expires in 3h 12m" or "expired" */
  label: string;
}

/** Remaining time below which expiry is treated as a warning (15 minutes). */
export const EXPIRY_WARNING_THRESHOLD_MS = 15 * 60 * 1000;

/**
 * Derive a relative expiry label and status from an ISO expiration timestamp.
 * Returns null if the timestamp can't be parsed.
 */
export function getTokenExpiryInfo(expiresAt: string, now: number): TokenExpiryInfo | null {
  const expiresAtMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) return null;

  const remainingMs = expiresAtMs - now;
  if (remainingMs <= 0) {
    return { status: 'expired', label: 'expired' };
  }

  return {
    status: remainingMs < EXPIRY_WARNING_THRESHOLD_MS ? 'warning' : 'ok',
    label: `expires in ${formatRemaining(remainingMs)}`,
  };
}

function formatRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return '<1m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
