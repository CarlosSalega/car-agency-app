/**
 * Simple in-memory rate limiter for login attempts
 * Limits: 5 attempts per IP every 15 minutes
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Check if an IP has exceeded the rate limit
 * @param identifier - Usually the IP address
 * @returns true if rate limit exceeded, false otherwise
 */
export function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + WINDOW_MS });
    return false;
  }

  if (now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + WINDOW_MS });
    return false;
  }

  entry.count++;

  if (entry.count > MAX_ATTEMPTS) {
    return true;
  }

  return false;
}

/**
 * Get remaining attempts for an identifier
 * @param identifier - Usually the IP address
 * @returns number of remaining attempts
 */
export function getRemainingAttempts(identifier: string): number {
  const entry = rateLimitMap.get(identifier);

  if (!entry) {
    return MAX_ATTEMPTS;
  }

  const now = Date.now();
  if (now > entry.resetTime) {
    return MAX_ATTEMPTS;
  }

  return Math.max(0, MAX_ATTEMPTS - entry.count);
}

/**
 * Get time until reset in seconds
 * @param identifier - Usually the IP address
 * @returns seconds until reset, or 0 if no limit active
 */
export function getTimeUntilReset(identifier: string): number {
  const entry = rateLimitMap.get(identifier);

  if (!entry) {
    return 0;
  }

  const now = Date.now();
  if (now > entry.resetTime) {
    return 0;
  }

  return Math.ceil((entry.resetTime - now) / 1000);
}

/**
 * Reset rate limit for an identifier (useful for testing or manual reset)
 * @param identifier - Usually the IP address
 */
export function resetRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier);
}

/**
 * Clean up expired entries (call periodically to prevent memory leaks)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();

  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

if (typeof setInterval !== "undefined") {
  setInterval(cleanupExpiredEntries, 30 * 60 * 1000);
}
