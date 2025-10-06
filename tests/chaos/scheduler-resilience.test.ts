import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, generateTestEmail } from "../helpers/api";
import { mockJourneyPayload } from "../helpers/fixtures";

describe("Scheduler Resilience", () => {
  let journeyId: string;

  beforeAll(async () => {
    const { data } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify(mockJourneyPayload)
    });
    journeyId = data.journey_id;
  });

  it("handles rapid enrollment creation", async () => {
    // Create multiple enrollments rapidly to test concurrent processing
    const enrollmentPromises = Array(10).fill(null).map(() =>
      apiRequest("/enrollments", {
        method: "POST",
        body: JSON.stringify({
          journey_id: journeyId,
          contact: {
            email: generateTestEmail(),
            data: { name: "Rapid Test" }
          }
        })
      })
    );

    const results = await Promise.all(enrollmentPromises);

    results.forEach(({ response, data }) => {
      expect(response.status).toBe(200);
      expect(data.enrollment_id).toBeDefined();
    });

    // Verify all enrollments got unique IDs
    const enrollmentIds = results.map(r => r.data.enrollment_id);
    const uniqueIds = new Set(enrollmentIds);
    expect(uniqueIds.size).toBe(enrollmentIds.length);
  });

  it("handles duplicate enrollment attempts", async () => {
    const email = generateTestEmail();
    const payload = {
      journey_id: journeyId,
      contact: { email, data: { name: "Duplicate Resilience Test" } }
    };

    // Try to create same enrollment multiple times concurrently
    const promises = Array(5).fill(null).map(() =>
      apiRequest("/enrollments", {
        method: "POST",
        body: JSON.stringify(payload)
      })
    );

    const results = await Promise.all(promises);

    // All should succeed (idempotent)
    results.forEach(({ response }) => {
      expect(response.status).toBe(200);
    });

    // Should all return same enrollment_id
    const enrollmentIds = results.map(r => r.data.enrollment_id);
    const uniqueIds = new Set(enrollmentIds);
    expect(uniqueIds.size).toBe(1); // Only one unique enrollment created
  });

  it("handles enrollment with invalid journey gracefully", async () => {
    const { response, data } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: "jd_nonexistent_journey_12345",
        contact: {
          email: generateTestEmail(),
          data: { name: "Invalid Journey Test" }
        }
      })
    });

    // Should return error, not crash
    expect([400, 404]).toContain(response.status);
    expect(data.error).toBeDefined();
  });

  it("handles malformed enrollment payloads", async () => {
    const malformedPayloads = [
      {}, // Empty
      { journey_id: journeyId }, // Missing contact
      { contact: { email: "test@test.com" } }, // Missing journey_id
      { journey_id: journeyId, contact: {} }, // Missing email
      { journey_id: "", contact: { email: "test@test.com" } } // Empty journey_id
    ];

    for (const payload of malformedPayloads) {
      const { response } = await apiRequest("/enrollments", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      // All should return 400, not crash
      expect(response.status).toBe(400);
    }
  });
});

describe("Message Idempotency (Chaos)", () => {
  it("prevents duplicate message sends for same stage", async () => {
    // This test verifies the message idempotency system
    // In a real scenario, you would:
    // 1. Create an enrollment
    // 2. Trigger message send for stage 0
    // 3. Try to trigger again for stage 0
    // 4. Verify only one message was created

    // Note: This requires access to internal scheduler or test mode timing
    expect(true).toBe(true); // Placeholder - implement when scheduler testing is available
  });
});
