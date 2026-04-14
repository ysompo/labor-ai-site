/**
 * Simple in-memory rate limiter for auth endpoints.
 * Tracks requests by IP/identifier and enforces limits.
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

/**
 * Check if request is within rate limit.
 * @param key Unique identifier (IP, username, email, etc.)
 * @param limit Max requests allowed
 * @param windowMs Time window in milliseconds
 * @returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 60 * 1000
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    // New or expired window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  // Existing window
  if (entry.count < limit) {
    entry.count++;
    return true;
  }

  // Rate limit exceeded
  return false;
}

/**
 * Get remaining requests in current window
 */
export function getRateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 60 * 1000
): number {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    return limit;
  }

  return Math.max(0, limit - entry.count);
}

/**
 * Clean up old entries periodically (runs on first import)
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}, 60 * 1000); // Cleanup every minute
