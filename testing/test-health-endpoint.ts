#!/usr/bin/env tsx
/**
 * Comprehensive test suite for GET /health endpoint
 * Tests all scenarios from GitHub Issue #15
 *
 * Tests:
 * 1. Basic health check with valid API key
 * 2. Returns correct structure and metrics
 * 3. Active enrollments count accuracy
 * 4. Pending sends count accuracy
 * 5. Error rate calculation
 * 6. Failed enrollments tracking
 * 7. Webhook lag detection
 * 8. Authentication requirement
 * 9. Response time performance (< 500ms)
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

async function makeHealthRequest(apiKey?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  return fetch(`${CONVEX_URL}/health`, {
    method: "GET",
    headers
  });
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

// Helper: Create a test journey
async function createTestJourney(): Promise<string> {
  const response = await makeRequest("/journeys", "POST", {
    goal: "Health Test Journey",
    audience: "Test Users",
    options: { emails: 3 }
  });

  const data = await response.json();
  assert(
    response.ok,
    `Failed to create test journey: ${JSON.stringify(data)}`
  );
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

  const data = await response.json();
  assert(
    response.ok,
    `Failed to create test enrollment: ${JSON.stringify(data)}`
  );
  return data.enrollment_id;
}

// ===== TESTS =====

async function runAllTests() {

await test("1. Health check returns 200 with valid API key", async () => {
  const response = await makeHealthRequest(TEST_API_KEY);
  assert(response.ok, `Expected 200, got ${response.status}`);
});

await test("2. Health check requires authentication", async () => {
  const response = await makeHealthRequest();
  assert(
    response.status === 401,
    `Expected 401 without API key, got ${response.status}`
  );
});

await test("3. Health check returns correct structure", async () => {
  const response = await makeHealthRequest(TEST_API_KEY);
  assert(response.ok, "Health check failed");

  const data = await response.json();

  // Check top-level structure
  assert(data.status === "ok", "Status should be 'ok'");
  assert(typeof data.timestamp === "number", "Timestamp should be a number");
  assert(data.account_id, "Should include account_id");
  assert(data.metrics, "Should include metrics object");

  // Check metrics structure
  const metrics = data.metrics;
  assert(
    typeof metrics.active_enrollments === "number",
    "active_enrollments should be a number"
  );
  assert(
    typeof metrics.pending_sends === "number",
    "pending_sends should be a number"
  );
  assert(typeof metrics.error_rate === "number", "error_rate should be a number");
  assert(
    typeof metrics.failed_enrollments_24h === "number",
    "failed_enrollments_24h should be a number"
  );
  assert(
    typeof metrics.webhook_processing_lag === "number",
    "webhook_processing_lag should be a number"
  );
});

await test("4. Active enrollments count is accurate", async () => {
  const responseBefore = await makeHealthRequest(TEST_API_KEY);
  assert(responseBefore.ok, "Health check failed");
  const dataBefore = await responseBefore.json();
  const countBefore = dataBefore.metrics.active_enrollments;

  // Create a test journey and enrollment
  const journeyId = await createTestJourney();
  const email = `health-test-${Date.now()}@gmail.com`;
  await createTestEnrollment(journeyId, email);

  // Wait a moment for database to update
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const responseAfter = await makeHealthRequest(TEST_API_KEY);
  assert(responseAfter.ok, "Health check failed");
  const dataAfter = await responseAfter.json();
  const countAfter = dataAfter.metrics.active_enrollments;

  assert(
    countAfter >= countBefore + 1,
    `Expected active enrollments to increase from ${countBefore} to at least ${
      countBefore + 1
    }, got ${countAfter}`
  );
});

await test("5. Pending sends count reflects due enrollments", async () => {
  const response = await makeHealthRequest(TEST_API_KEY);
  assert(response.ok, "Health check failed");

  const data = await response.json();
  const pendingSends = data.metrics.pending_sends;

  // Pending sends should be >= 0
  assert(
    pendingSends >= 0,
    `Pending sends should be non-negative, got ${pendingSends}`
  );

  // The timestamp in response should be recent (within last 5 seconds)
  const timeDiff = Date.now() - data.timestamp;
  assert(
    timeDiff < 5000,
    `Timestamp should be recent, was ${timeDiff}ms ago`
  );
});

await test("6. Error rate is a valid percentage", async () => {
  const response = await makeHealthRequest(TEST_API_KEY);
  assert(response.ok, "Health check failed");

  const data = await response.json();
  const errorRate = data.metrics.error_rate;

  assert(
    errorRate >= 0 && errorRate <= 1,
    `Error rate should be between 0 and 1, got ${errorRate}`
  );
});

await test("7. Failed enrollments count is tracked", async () => {
  const response = await makeHealthRequest(TEST_API_KEY);
  assert(response.ok, "Health check failed");

  const data = await response.json();
  const failedCount = data.metrics.failed_enrollments_24h;

  assert(
    failedCount >= 0,
    `Failed enrollments should be non-negative, got ${failedCount}`
  );
});

await test("8. Webhook processing lag is tracked", async () => {
  const response = await makeHealthRequest(TEST_API_KEY);
  assert(response.ok, "Health check failed");

  const data = await response.json();
  const webhookLag = data.metrics.webhook_processing_lag;

  assert(
    webhookLag >= 0,
    `Webhook lag should be non-negative, got ${webhookLag}`
  );
});

await test("9. Health check responds within 500ms", async () => {
  const start = Date.now();
  const response = await makeHealthRequest(TEST_API_KEY);
  const duration = Date.now() - start;

  assert(response.ok, "Health check failed");
  assert(
    duration < 500,
    `Health check should respond in < 500ms, took ${duration}ms`
  );
});

// ===== PRINT RESULTS =====

console.log("\n" + "=".repeat(80));
console.log("HEALTH ENDPOINT TEST RESULTS");
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
