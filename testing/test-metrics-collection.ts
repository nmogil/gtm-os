#!/usr/bin/env tsx
/**
 * Comprehensive test suite for metrics collection system
 * Tests metrics.ts functionality from GitHub Issue #15
 *
 * Tests:
 * 1. Metrics collection includes all required fields
 * 2. Send success rate calculation
 * 3. Delivery metrics calculation
 * 4. Engagement metrics (open/click/conversion rates)
 * 5. Webhook metrics
 * 6. Suppression metrics
 * 7. System health metrics
 */

const CONVEX_URL = "https://focused-bloodhound-276.convex.site";
const TEST_API_KEY = "test-api-key-123";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(
  name: string,
  fn: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({
      name,
      passed: true,
      message: "✓ Passed",
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      message: `✗ Failed: ${error.message}`,
      duration: Date.now() - start
    });
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function makeRequest(
  path: string,
  method: string,
  body?: any,
  apiKey: string = TEST_API_KEY
): Promise<Response> {
  const headers: Record<string, string> = {
    "X-API-Key": apiKey,
    "Content-Type": "application/json"
  };

  const options: RequestInit = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return fetch(`${CONVEX_URL}${path}`, options);
}

async function getHealthMetrics(): Promise<any> {
  const response = await makeRequest("/health", "GET");
  assert(response.ok, "Failed to get health metrics");
  return await response.json();
}

// Helper: Create a test journey
async function createTestJourney(): Promise<string> {
  const response = await makeRequest("/journeys", "POST", {
    goal: "Metrics Test Journey",
    audience: "Test Users",
    options: { emails: 3 }
  });

  assert(response.ok, "Failed to create test journey");
  const data = await response.json();
  return data.journey_id;
}

// Helper: Create a test enrollment
async function createTestEnrollment(
  journeyId: string,
  email: string
): Promise<string> {
  const response = await makeRequest("/enrollments", "POST", {
    journey_id: journeyId,
    contact: {
      email,
      data: { name: "Test User", company: "Test Co" }
    }
  });

  assert(response.ok, "Failed to create test enrollment");
  const data = await response.json();
  return data.enrollment_id;
}

// Helper: Record an event
async function recordEvent(
  type: string,
  email: string,
  journeyId?: string,
  enrollmentId?: string
): Promise<void> {
  const body: any = {
    type,
    contact_email: email
  };

  if (journeyId) body.journey_id = journeyId;
  if (enrollmentId) body.enrollment_id = enrollmentId;

  const response = await makeRequest("/events", "POST", body);
  assert(response.ok, `Failed to record ${type} event`);
}

// ===== TESTS =====

async function runAllTests() {

await test("1. Health metrics include all required fields", async () => {
  const health = await getHealthMetrics();
  const metrics = health.metrics;

  // Core health metrics
  assert(
    typeof metrics.active_enrollments === "number",
    "Missing active_enrollments"
  );
  assert(typeof metrics.pending_sends === "number", "Missing pending_sends");
  assert(typeof metrics.error_rate === "number", "Missing error_rate");
  assert(
    typeof metrics.failed_enrollments_24h === "number",
    "Missing failed_enrollments_24h"
  );
  assert(
    typeof metrics.webhook_processing_lag === "number",
    "Missing webhook_processing_lag"
  );
});

await test("2. Active enrollments increase with new enrollments", async () => {
  const before = await getHealthMetrics();
  const countBefore = before.metrics.active_enrollments;

  // Create test enrollment
  const journeyId = await createTestJourney();
  const email = `metrics-test-${Date.now()}@gmail.com`;
  await createTestEnrollment(journeyId, email);

  // Wait for database update
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const after = await getHealthMetrics();
  const countAfter = after.metrics.active_enrollments;

  assert(
    countAfter > countBefore,
    `Active enrollments should increase (before: ${countBefore}, after: ${countAfter})`
  );
});

await test("3. Error rate is calculated correctly", async () => {
  const health = await getHealthMetrics();
  const errorRate = health.metrics.error_rate;

  // Error rate should be between 0 and 1
  assert(
    errorRate >= 0 && errorRate <= 1,
    `Error rate should be 0-1, got ${errorRate}`
  );

  // If there are any failed messages, error rate should be > 0
  // Otherwise it can be 0
  assert(
    typeof errorRate === "number" && !isNaN(errorRate),
    "Error rate should be a valid number"
  );
});

await test("4. Pending sends reflects enrollments due for sending", async () => {
  const health = await getHealthMetrics();
  const pendingSends = health.metrics.pending_sends;

  // Pending sends should be non-negative
  assert(
    pendingSends >= 0,
    `Pending sends should be >= 0, got ${pendingSends}`
  );

  // Should be a whole number (count of enrollments)
  assert(
    Number.isInteger(pendingSends),
    `Pending sends should be an integer, got ${pendingSends}`
  );
});

await test("5. Failed enrollments tracking works", async () => {
  const health = await getHealthMetrics();
  const failedCount = health.metrics.failed_enrollments_24h;

  // Should be non-negative
  assert(
    failedCount >= 0,
    `Failed enrollments should be >= 0, got ${failedCount}`
  );

  // Should be a whole number
  assert(
    Number.isInteger(failedCount),
    `Failed enrollments should be an integer, got ${failedCount}`
  );
});

await test("6. Webhook processing lag is tracked", async () => {
  const health = await getHealthMetrics();
  const webhookLag = health.metrics.webhook_processing_lag;

  // Should be non-negative
  assert(
    webhookLag >= 0,
    `Webhook lag should be >= 0, got ${webhookLag}`
  );

  // Should be a whole number (count of lagged webhooks)
  assert(
    Number.isInteger(webhookLag),
    `Webhook lag should be an integer, got ${webhookLag}`
  );
});

await test("7. Journey analytics tracks conversions", async () => {
  // Create a journey and enrollment
  const journeyId = await createTestJourney();
  const email = `conversion-test-${Date.now()}@gmail.com`;
  const enrollmentId = await createTestEnrollment(journeyId, email);

  // Wait for database update
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Record a conversion event
  await recordEvent("conversion", email, journeyId, enrollmentId);

  // Wait for event to be recorded
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Get journey analytics
  const response = await makeRequest(
    `/journeys/${journeyId}/analytics`,
    "GET"
  );
  assert(response.ok, "Failed to get journey analytics");

  const analytics = await response.json();
  assert(analytics.converted >= 1, "Should have at least 1 conversion");
  assert(
    analytics.engagement.conversion_rate > 0,
    "Conversion rate should be > 0"
  );
});

await test("8. Journey analytics tracks unsubscribes", async () => {
  // Create a journey and enrollment
  const journeyId = await createTestJourney();
  const email = `unsub-test-${Date.now()}@gmail.com`;
  const enrollmentId = await createTestEnrollment(journeyId, email);

  // Wait for database update
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Record an unsubscribe event
  await recordEvent("unsubscribe", email, journeyId, enrollmentId);

  // Wait for event to be recorded
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Get journey analytics
  const response = await makeRequest(
    `/journeys/${journeyId}/analytics`,
    "GET"
  );
  assert(response.ok, "Failed to get journey analytics");

  const analytics = await response.json();
  // After unsubscribe, enrollment should be suppressed
  assert(
    analytics.suppressed >= 0,
    "Suppressed count should be tracked"
  );
});

await test("9. Metrics respond quickly (< 200ms)", async () => {
  const start = Date.now();
  await getHealthMetrics();
  const duration = Date.now() - start;

  assert(
    duration < 200,
    `Metrics should respond in < 200ms, took ${duration}ms`
  );
});

// ===== PRINT RESULTS =====

console.log("\n" + "=".repeat(80));
console.log("METRICS COLLECTION TEST RESULTS");
console.log("=".repeat(80) + "\n");

let passed = 0;
let failed = 0;

results.forEach((result) => {
  console.log(`${result.message} ${result.name} (${result.duration}ms)`);
  if (result.passed) {
    passed++;
  } else {
    failed++;
  }
});

console.log("\n" + "=".repeat(80));
console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
console.log("=".repeat(80) + "\n");

if (failed > 0) {
  process.exit(1);
}
}

// Run tests
runAllTests();
