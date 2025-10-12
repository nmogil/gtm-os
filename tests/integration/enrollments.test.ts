import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, generateTestEmail, generateIdempotencyKey, CONVEX_SITE_URL } from "../helpers/api";
import { mockJourneyPayload } from "../helpers/fixtures";

describe("POST /enrollments", () => {
  let journeyId: string;

  beforeAll(async () => {
    // Create a journey for testing enrollments
    const { response, data } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify(mockJourneyPayload)
    });

    if (response.status !== 200 || !data.journey_id) {
      throw new Error(`Failed to create journey in beforeAll: ${response.status} - ${JSON.stringify(data)}`);
    }

    journeyId = data.journey_id;
  });

  it("creates enrollment with contact data", async () => {
    const email = generateTestEmail();
    const { response, data } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: {
          email,
          data: {
            name: "Test User",
            company: "Test Company"
          }
        }
      })
    });

    expect(response.status).toBe(200);
    expect(data.enrollment_id).toBeDefined();
    expect(data.enrollment_id).toMatch(/^j[a-z0-9]+$/);
    expect(data.status).toBe("active");
    expect(data.contact_email).toBe(email);
  });

  it("prevents duplicate enrollments (natural idempotency)", async () => {
    const email = generateTestEmail();
    const payload = {
      journey_id: journeyId,
      contact: {
        email,
        data: { name: "Duplicate Test" }
      }
    };

    // First enrollment
    const { data: data1 } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    // Duplicate enrollment with same email
    const { data: data2 } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    expect(data2.existing).toBe(true);
    expect(data2.enrollment_id).toBe(data1.enrollment_id);
  });

  it("respects idempotency key header", async () => {
    const idempotencyKey = generateIdempotencyKey();
    const payload = {
      journey_id: journeyId,
      contact: {
        email: generateTestEmail(),
        data: { name: "Idempotent Test" }
      }
    };

    // First request with idempotency key
    const { data: data1 } = await apiRequest("/enrollments", {
      method: "POST",
      headers: { "X-Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload)
    });

    // Duplicate request with same idempotency key
    const { data: data2 } = await apiRequest("/enrollments", {
      method: "POST",
      headers: { "X-Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload)
    });

    expect(data2.enrollment_id).toBe(data1.enrollment_id);
    expect(data2.existing).toBe(true);
  });

  it("allows different contacts in same journey", async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();

    const { data: data1 } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: { email: email1, data: { name: "User 1" } }
      })
    });

    const { data: data2 } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: { email: email2, data: { name: "User 2" } }
      })
    });

    expect(data1.enrollment_id).not.toBe(data2.enrollment_id);
    expect(data1.contact_email).toBe(email1);
    expect(data2.contact_email).toBe(email2);
  });

  it("accepts custom fields in contact data", async () => {
    const { response, data } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: {
          email: generateTestEmail(),
          data: {
            name: "Custom User",
            company: "Custom Co",
            role: "CEO",
            industry: "SaaS",
            custom_field: "custom_value"
          }
        }
      })
    });

    expect(response.status).toBe(200);
    expect(data.enrollment_id).toBeDefined();
  });

  it("accepts enrollment options", async () => {
    const { response, data } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: {
          email: generateTestEmail(),
          data: { name: "Options Test" }
        },
        options: {
          test_mode: true,
          reply_to: "custom@example.com",
          tags: { source: "test", campaign: "q4" },
          headers: { "X-Custom": "value" }
        }
      })
    });

    expect(response.status).toBe(200);
    expect(data.enrollment_id).toBeDefined();
  });

  it("requires authentication", async () => {
    const response = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        journey_id: journeyId,
        contact: { email: "test@example.com" }
      })
    });

    expect(response.status).toBe(401);
  });

  it("validates journey_id is required", async () => {
    const { response } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        contact: { email: "test@example.com" }
      })
    });

    expect(response.status).toBe(400);
  });

  it("validates contact email is required", async () => {
    const { response } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: { data: { name: "No Email" } }
      })
    });

    expect(response.status).toBe(400);
  });

  it("handles invalid journey_id", async () => {
    const { response } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: "jd_nonexistent",
        contact: { email: generateTestEmail() }
      })
    });

    // Should return error (400 or 404)
    expect([400, 404]).toContain(response.status);
  });
});
