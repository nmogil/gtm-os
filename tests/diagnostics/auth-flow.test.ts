import { describe, it, expect } from "vitest";
import { apiRequest, generateTestEmail, CONVEX_SITE_URL, API_KEY } from "../helpers/api";
import { mockJourneyPayload } from "../helpers/fixtures";

/**
 * Diagnostic tests to identify the root cause of 401 errors
 */
describe("Authentication & API Flow Diagnostics", () => {
  it("validates API key is configured correctly", () => {
    expect(API_KEY).toBeDefined();
    expect(API_KEY).toBe("test-api-key-123");
    expect(CONVEX_SITE_URL).toBeDefined();
    console.log("Using API URL:", CONVEX_SITE_URL);
    console.log("Using API Key:", API_KEY);
  });

  it("validates health endpoint responds successfully", async () => {
    const { response, data } = await apiRequest("/health", {
      method: "GET"
    });

    console.log("Health check status:", response.status);
    console.log("Health check data:", JSON.stringify(data, null, 2));

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
  });

  it("validates journey creation with detailed error logging", async () => {
    const { response, data } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify(mockJourneyPayload)
    });

    console.log("Journey creation status:", response.status);
    console.log("Journey creation data:", JSON.stringify(data, null, 2));

    if (response.status !== 200) {
      console.error("Journey creation failed!");
      console.error("Response headers:", Object.fromEntries(response.headers.entries()));
    }

    expect(response.status).toBe(200);
    expect(data.journey_id).toBeDefined();
  });

  it("validates single enrollment with detailed error logging", async () => {
    // First create a journey
    const { data: journeyData } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify(mockJourneyPayload)
    });

    const email = generateTestEmail();
    const payload = {
      journey_id: journeyData.journey_id,
      contact: {
        email,
        data: { name: "Diagnostic Test User" }
      }
    };

    console.log("Enrollment payload:", JSON.stringify(payload, null, 2));

    const { response, data } = await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    console.log("Enrollment status:", response.status);
    console.log("Enrollment data:", JSON.stringify(data, null, 2));

    if (response.status !== 200) {
      console.error("Enrollment failed!");
      console.error("Response headers:", Object.fromEntries(response.headers.entries()));
      console.error("Error details:", data);
    }

    expect(response.status).toBe(200);
    expect(data.enrollment_id).toBeDefined();
  });

  it("tests sequential enrollments (no parallelization)", async () => {
    // Create journey once
    const { data: journeyData } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify(mockJourneyPayload)
    });

    const results = [];

    // Run 5 enrollments sequentially with delays
    for (let i = 0; i < 5; i++) {
      const email = generateTestEmail();
      const { response, data } = await apiRequest("/enrollments", {
        method: "POST",
        body: JSON.stringify({
          journey_id: journeyData.journey_id,
          contact: {
            email,
            data: { name: `Sequential Test ${i}` }
          }
        })
      });

      console.log(`Enrollment ${i + 1}/5: status=${response.status}, id=${data.enrollment_id || 'FAILED'}`);

      results.push({
        index: i,
        status: response.status,
        success: response.status === 200,
        data
      });

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const failures = results.filter(r => !r.success);
    console.log(`Sequential test: ${results.length - failures.length}/5 succeeded`);

    if (failures.length > 0) {
      console.error("Failed enrollments:", failures);
    }

    expect(failures.length).toBe(0);
  });

  it("tests parallel enrollments (same as actual tests)", async () => {
    // Create journey once
    const { data: journeyData } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify(mockJourneyPayload)
    });

    // Run 5 enrollments in parallel
    const promises = Array(5).fill(null).map((_, i) =>
      apiRequest("/enrollments", {
        method: "POST",
        body: JSON.stringify({
          journey_id: journeyData.journey_id,
          contact: {
            email: generateTestEmail(),
            data: { name: `Parallel Test ${i}` }
          }
        })
      })
    );

    const results = await Promise.all(promises);

    results.forEach((result, i) => {
      console.log(`Parallel enrollment ${i + 1}/5: status=${result.response.status}, id=${result.data.enrollment_id || 'FAILED'}`);
    });

    const failures = results.filter(r => r.response.status !== 200);
    console.log(`Parallel test: ${results.length - failures.length}/5 succeeded`);

    if (failures.length > 0) {
      console.error("Failed parallel enrollments:", failures.map(f => ({
        status: f.response.status,
        error: f.data
      })));
    }

    // Don't fail the test, just report
    console.log(`Parallel failure rate: ${failures.length}/5 (${(failures.length / 5 * 100).toFixed(1)}%)`);
  });

  it("validates test_mode parameter handling", async () => {
    const { data: journeyData } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify(mockJourneyPayload)
    });

    const testCases = [
      { test_mode: true, label: "test_mode: true" },
      { test_mode: false, label: "test_mode: false" },
      { label: "no test_mode specified" }
    ];

    for (const testCase of testCases) {
      const email = generateTestEmail();
      const payload: any = {
        journey_id: journeyData.journey_id,
        contact: {
          email,
          data: { name: `Mode Test` }
        }
      };

      if ('test_mode' in testCase) {
        payload.options = { test_mode: testCase.test_mode };
      }

      const { response, data } = await apiRequest("/enrollments", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      console.log(`${testCase.label}: status=${response.status}, test_mode=${data.test_mode}`);

      if (response.status !== 200) {
        console.error(`FAILED: ${testCase.label}`, data);
      }

      expect(response.status).toBe(200);

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });
});
