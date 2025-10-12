import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, generateTestEmail } from "../helpers/api";
import { mockJourneyPayload } from "../helpers/fixtures";

describe("Test Mode", () => {
  let journeyId: string;

  beforeAll(async () => {
    // Create a journey for testing
    const { response, data } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify(mockJourneyPayload)
    });

    if (response.status !== 200 || !data.journey_id) {
      throw new Error(`Failed to create journey in beforeAll: ${response.status} - ${JSON.stringify(data)}`);
    }

    journeyId = data.journey_id;
  });

  it("creates enrollment with test_mode enabled", async () => {
    const email = generateTestEmail();
    const { response, data } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: {
          email,
          data: { name: "Test Mode User" }
        },
        options: {
          test_mode: true
        }
      })
    });

    expect(response.status).toBe(200);
    expect(data.enrollment_id).toBeDefined();
    expect(data.status).toBe("active");
  });

  it("accepts test_mode with other options", async () => {
    const email = generateTestEmail();
    const { response, data } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: {
          email,
          data: { name: "Test Mode With Options" }
        },
        options: {
          test_mode: true,
          reply_to: "test@example.com",
          tags: { environment: "test" }
        }
      })
    });

    expect(response.status).toBe(200);
    expect(data.enrollment_id).toBeDefined();
  });

  it("handles test_mode false", async () => {
    const email = generateTestEmail();
    const { response, data } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: {
          email,
          data: { name: "Production Mode" }
        },
        options: {
          test_mode: false
        }
      })
    });

    if (response.status !== 200) {
      console.log("Error response:", response.status, JSON.stringify(data));
    }

    expect(response.status).toBe(200);
    expect(data.enrollment_id).toBeDefined();
  });

  it("defaults to production mode when test_mode not specified", async () => {
    const email = generateTestEmail();
    const { response, data } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: {
          email,
          data: { name: "Default Mode" }
        }
      })
    });

    expect(response.status).toBe(200);
    expect(data.enrollment_id).toBeDefined();
  });

  it("test_mode enrollment has same structure as production", async () => {
    const testEmail = generateTestEmail();
    const prodEmail = generateTestEmail();

    const { data: testData } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: { email: testEmail, data: { name: "Test User" } },
        options: { test_mode: true }
      })
    });

    const { data: prodData } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: { email: prodEmail, data: { name: "Prod User" } },
        options: { test_mode: false }
      })
    });

    // Both should have same response structure
    expect(Object.keys(testData).sort()).toEqual(Object.keys(prodData).sort());
  });
});
