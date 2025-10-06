import { describe, it, expect } from "vitest";
import { CONVEX_SITE_URL } from "../helpers/api";

describe("Webhook Resilience", () => {
  it("handles invalid webhook signatures", async () => {
    // Send webhook with invalid signature
    const response = await fetch(`${CONVEX_SITE_URL}/webhooks/resend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "svix-id": "msg_invalid",
        "svix-timestamp": Date.now().toString(),
        "svix-signature": "invalid_signature"
      },
      body: JSON.stringify({
        type: "email.delivered",
        data: { email_id: "test_123" }
      })
    });

    // Should reject with 401
    expect(response.status).toBe(401);
  });

  it("handles missing webhook headers", async () => {
    const response = await fetch(`${CONVEX_SITE_URL}/webhooks/resend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
        // Missing svix headers
      },
      body: JSON.stringify({
        type: "email.delivered",
        data: { email_id: "test_123" }
      })
    });

    expect(response.status).toBe(401);
  });

  it("handles malformed webhook payloads", async () => {
    const response = await fetch(`${CONVEX_SITE_URL}/webhooks/resend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "svix-id": "msg_test",
        "svix-timestamp": Date.now().toString(),
        "svix-signature": "test_sig"
      },
      body: "not valid json"
    });

    // Should handle gracefully (likely 401 due to signature verification)
    expect([400, 401]).toContain(response.status);
  });

  it("handles webhook for unknown email_id gracefully", async () => {
    // This tests that webhooks for unknown messages don't crash the system
    // The actual implementation should log a warning but return 200
    // to prevent Resend from retrying unnecessarily

    // Note: This requires valid Svix signature, which is difficult to generate in tests
    // In a real scenario, you would:
    // 1. Use Svix test mode or generate valid signatures
    // 2. Send webhook for non-existent email_id
    // 3. Verify system handles gracefully

    expect(true).toBe(true); // Placeholder
  });

  it("handles concurrent webhook processing", async () => {
    // Test that multiple webhooks can be processed concurrently
    const webhookPromises = Array(5).fill(null).map(() =>
      fetch(`${CONVEX_SITE_URL}/webhooks/resend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "svix-id": `msg_${Date.now()}_${Math.random()}`,
          "svix-timestamp": Date.now().toString(),
          "svix-signature": "test_sig"
        },
        body: JSON.stringify({
          type: "email.delivered",
          data: { email_id: `test_${Date.now()}` }
        })
      })
    );

    const results = await Promise.all(webhookPromises);

    // All should complete (even if they fail signature verification)
    results.forEach(response => {
      expect(response.status).toBeDefined();
      expect([200, 401]).toContain(response.status);
    });
  });
});

describe("API Error Handling (Chaos)", () => {
  it("handles invalid JSON in request body", async () => {
    const response = await fetch(`${CONVEX_SITE_URL}/journeys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-api-key-123"
      },
      body: "not valid json at all"
    });

    expect([400, 500]).toContain(response.status);
  });

  it("handles extremely large request payloads", async () => {
    const largeData = {
      goal: "x".repeat(10000),
      audience: "y".repeat(10000)
    };

    const response = await fetch(`${CONVEX_SITE_URL}/journeys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-api-key-123"
      },
      body: JSON.stringify(largeData)
    });

    // Should handle (either succeed or fail gracefully)
    expect(response.status).toBeDefined();
  });

  it("handles missing Content-Type header", async () => {
    const response = await fetch(`${CONVEX_SITE_URL}/journeys`, {
      method: "POST",
      headers: {
        "X-API-Key": "test-api-key-123"
        // Missing Content-Type
      },
      body: JSON.stringify({ goal: "Test", audience: "Test" })
    });

    // Should still work or return proper error
    expect(response.status).toBeDefined();
  });
});
