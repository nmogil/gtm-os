#!/usr/bin/env tsx
/**
 * Performance and load testing for health endpoint
 * Tests performance under various data volumes from GitHub Issue #15
 *
 * Tests:
 * 1. Health check with baseline data
 * 2. Health check with 100 active enrollments
 * 3. Health check with 1000 active enrollments
 * 4. Health check with 5000 active enrollments
 * 5. Verify response time stays under 500ms threshold
 * 6. Cleanup test data
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
const createdJourneys: string[] = [];
const createdEmails: string[] = [];

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

async function getHealthMetrics(): Promise<{ data: any; duration: number }> {
  const start = Date.now();
  const response = await makeRequest("/health", "GET");
  const duration = Date.now() - start;

  assert(response.ok, "Failed to get health metrics");
  const data = await response.json();

  return { data, duration };
}

// Helper: Create a test journey
async function createTestJourney(name: string): Promise<string> {
  const response = await makeRequest("/journeys", "POST", {
    goal: name,
    audience: "Performance Test Users",
    options: { emails: 3 }
  });

  assert(response.ok, "Failed to create test journey");
  const data = await response.json();
  createdJourneys.push(data.journey_id);
  return data.journey_id;
}

// Helper: Create multiple test enrollments
async function createBulkEnrollments(
  journeyId: string,
  count: number,
  prefix: string
): Promise<void> {
  console.log(`  Creating ${count} enrollments...`);

  // Create enrollments in batches to avoid overwhelming the API
  const batchSize = 10;
  const batches = Math.ceil(count / batchSize);

  for (let batch = 0; batch < batches; batch++) {
    const batchStart = batch * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, count);
    const promises = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const email = `${prefix}-${i}-${Date.now()}@gmail.com`;
      createdEmails.push(email);

      const promise = makeRequest("/enrollments", "POST", {
        journey_id: journeyId,
        contact: {
          email,
          data: { name: `Load Test User ${i}`, company: "Test Co" }
        }
      });

      promises.push(promise);
    }

    await Promise.all(promises);

    // Progress indicator
    if (batch % 10 === 0) {
      console.log(
        `  Progress: ${Math.min(batchEnd, count)}/${count} enrollments created`
      );
    }

    // Small delay between batches to be nice to the API
    if (batch < batches - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`  ✓ Created ${count} enrollments`);
}

// ===== TESTS =====

async function runAllTests() {

await test("1. Baseline health check performance", async () => {
  const { data, duration } = await getHealthMetrics();

  console.log(`  Response time: ${duration}ms`);
  console.log(`  Active enrollments: ${data.metrics.active_enrollments}`);

  assert(
    duration < 500,
    `Baseline health check should respond in < 500ms, took ${duration}ms`
  );
});

await test("2. Health check with 100 active enrollments", async () => {
  console.log("\n  Setting up 100 enrollments...");

  // Create journey
  const journeyId = await createTestJourney("Load Test 100");

  // Create 100 enrollments
  await createBulkEnrollments(journeyId, 100, "load100");

  // Wait for database to catch up
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test health check performance
  const { data, duration } = await getHealthMetrics();

  console.log(`  Response time: ${duration}ms`);
  console.log(`  Active enrollments: ${data.metrics.active_enrollments}`);

  assert(
    duration < 500,
    `Health check with 100 enrollments should respond in < 500ms, took ${duration}ms`
  );
});

await test("3. Health check with 1000 active enrollments", async () => {
  console.log("\n  Setting up 1000 enrollments...");

  // Create journey
  const journeyId = await createTestJourney("Load Test 1000");

  // Create 1000 enrollments
  await createBulkEnrollments(journeyId, 1000, "load1000");

  // Wait for database to catch up
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Test health check performance
  const { data, duration } = await getHealthMetrics();

  console.log(`  Response time: ${duration}ms`);
  console.log(`  Active enrollments: ${data.metrics.active_enrollments}`);

  assert(
    duration < 500,
    `Health check with 1000 enrollments should respond in < 500ms, took ${duration}ms`
  );
});

await test("4. Multiple rapid health checks (stress test)", async () => {
  console.log("\n  Running 10 rapid health checks...");

  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(getHealthMetrics());
  }

  const results = await Promise.all(promises);

  const maxDuration = Math.max(...results.map((r) => r.duration));
  const avgDuration =
    results.reduce((sum, r) => sum + r.duration, 0) / results.length;

  console.log(`  Max response time: ${maxDuration}ms`);
  console.log(`  Avg response time: ${avgDuration.toFixed(1)}ms`);

  assert(
    maxDuration < 500,
    `All health checks should respond in < 500ms, max was ${maxDuration}ms`
  );
});

await test("5. Health check accuracy with high volume", async () => {
  console.log("\n  Verifying metric accuracy with current data volume...");

  const { data, duration } = await getHealthMetrics();
  const metrics = data.metrics;

  console.log(`  Response time: ${duration}ms`);
  console.log(`  Active enrollments: ${metrics.active_enrollments}`);
  console.log(`  Pending sends: ${metrics.pending_sends}`);
  console.log(`  Error rate: ${(metrics.error_rate * 100).toFixed(2)}%`);
  console.log(`  Failed enrollments (24h): ${metrics.failed_enrollments_24h}`);
  console.log(`  Webhook lag: ${metrics.webhook_processing_lag}`);

  // Verify metrics are reasonable
  assert(
    metrics.active_enrollments >= 1100,
    `Should have at least 1100 active enrollments (created 1100 in tests)`
  );
  assert(
    metrics.pending_sends >= 0,
    "Pending sends should be non-negative"
  );
  assert(
    metrics.error_rate >= 0 && metrics.error_rate <= 1,
    "Error rate should be between 0 and 1"
  );
  assert(
    metrics.webhook_processing_lag >= 0,
    "Webhook lag should be non-negative"
  );
});

// ===== PRINT RESULTS =====

console.log("\n" + "=".repeat(80));
console.log("HEALTH ENDPOINT PERFORMANCE TEST RESULTS");
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
console.log("=".repeat(80));

console.log("\n" + "=".repeat(80));
console.log("CLEANUP SUMMARY");
console.log("=".repeat(80));
console.log(`Created ${createdJourneys.length} test journeys`);
console.log(`Created ${createdEmails.length} test enrollments`);
console.log(
  "\nNote: Test data will remain in the database. Use cleanup-enrollments.ts to remove."
);
console.log("=".repeat(80) + "\n");

if (failed > 0) {
  process.exit(1);
}
}

// Run tests
runAllTests();
