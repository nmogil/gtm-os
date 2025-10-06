import { APIError } from "./errors";

// Simple in-memory cache for idempotency keys (24 hour TTL)
const idempotencyCache = new Map<string, {
  enrollmentId: string;
  timestamp: number;
}>();

const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function checkIdempotencyKey(key: string): string | null {
  const cached = idempotencyCache.get(key);

  if (cached) {
    // Check if expired
    if (Date.now() - cached.timestamp > IDEMPOTENCY_TTL) {
      idempotencyCache.delete(key);
      return null;
    }
    return cached.enrollmentId;
  }

  return null;
}

export function setIdempotencyKey(key: string, enrollmentId: string) {
  idempotencyCache.set(key, {
    enrollmentId,
    timestamp: Date.now()
  });
}

export function cleanupExpiredKeys() {
  const now = Date.now();
  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.timestamp > IDEMPOTENCY_TTL) {
      idempotencyCache.delete(key);
    }
  }
}

// Test helper to clear cache between tests
export function clearIdempotencyCache() {
  idempotencyCache.clear();
}
