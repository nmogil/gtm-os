import { describe, it, expect, beforeEach } from "vitest";
import {
  checkIdempotencyKey,
  setIdempotencyKey,
  clearIdempotencyCache,
  cleanupExpiredKeys
} from "../../convex/lib/enrollmentIdempotency";

describe("Enrollment Idempotency", () => {
  beforeEach(() => {
    clearIdempotencyCache();
  });

  it("returns null for non-existent key", () => {
    const result = checkIdempotencyKey("nonexistent-key");
    expect(result).toBeNull();
  });

  it("returns enrollment ID for existing key", () => {
    setIdempotencyKey("test-key", "enr_123");
    const result = checkIdempotencyKey("test-key");
    expect(result).toBe("enr_123");
  });

  it("stores and retrieves multiple keys", () => {
    setIdempotencyKey("key1", "enr_111");
    setIdempotencyKey("key2", "enr_222");
    setIdempotencyKey("key3", "enr_333");

    expect(checkIdempotencyKey("key1")).toBe("enr_111");
    expect(checkIdempotencyKey("key2")).toBe("enr_222");
    expect(checkIdempotencyKey("key3")).toBe("enr_333");
  });

  it("overwrites existing key with new value", () => {
    setIdempotencyKey("test-key", "enr_old");
    setIdempotencyKey("test-key", "enr_new");

    const result = checkIdempotencyKey("test-key");
    expect(result).toBe("enr_new");
  });

  it("clears cache correctly", () => {
    setIdempotencyKey("key1", "enr_111");
    setIdempotencyKey("key2", "enr_222");

    clearIdempotencyCache();

    expect(checkIdempotencyKey("key1")).toBeNull();
    expect(checkIdempotencyKey("key2")).toBeNull();
  });

  it("cleanup function exists", () => {
    // Just verify the function exists and can be called
    expect(cleanupExpiredKeys).toBeDefined();
    cleanupExpiredKeys();
  });
});
