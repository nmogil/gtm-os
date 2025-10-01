#!/usr/bin/env tsx
/**
 * Comprehensive test suite for POST /journeys endpoint
 * Tests all scenarios from GitHub Issue #9
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
  body: any,
  apiKey?: string
): Promise<{ response: Response; data: any; duration: number }> {
  const start = Date.now();
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  const response = await fetch(`${CONVEX_URL}/journeys`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const data = await response.json();
  const duration = Date.now() - start;

  return { response, data, duration };
}

async function runAllTests() {

// Test 1: Basic happy path
await test("POST /journeys with valid goal and audience", async () => {
  const { response, data, duration } = await makeRequest(
    {
      goal: "Onboard new trial users",
      audience: "B2B SaaS founders"
    },
    TEST_API_KEY
  );

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  assert(data.journey_id, "Missing journey_id in response");
  assert(data.name, "Missing name in response");
  assert(Array.isArray(data.stages), "Stages should be an array");
  assert(
    data.stages.length >= 5 && data.stages.length <= 7,
    `Expected 5-7 stages, got ${data.stages.length}`
  );

  // Verify each stage has required fields
  for (let i = 0; i < data.stages.length; i++) {
    const stage = data.stages[i];
    assert(typeof stage.day === "number", `Stage ${i} missing day field`);
    assert(typeof stage.subject === "string", `Stage ${i} missing subject field`);
    assert(typeof stage.body === "string", `Stage ${i} missing body field`);
    assert(
      stage.body.includes("{{unsubscribe_url}}"),
      `Stage ${i} missing {{unsubscribe_url}}`
    );
  }

  console.log(`  → Journey created: ${data.journey_id}`);
  console.log(`  → Journey name: ${data.name}`);
  console.log(`  → Stages: ${data.stages.length}`);
  console.log(`  → Latency: ${duration}ms`);
});

// Test 2: Custom email count
await test("POST /journeys with options.emails = 7", async () => {
  const { response, data } = await makeRequest(
    {
      goal: "Nurture leads to conversion",
      audience: "Marketing managers",
      options: {
        emails: 7
      }
    },
    TEST_API_KEY
  );

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  assert(
    data.stages.length === 7,
    `Expected 7 stages with options.emails=7, got ${data.stages.length}`
  );
});

// Test 3: Default reply_to option
await test("POST /journeys with default_reply_to", async () => {
  const { response, data } = await makeRequest(
    {
      goal: "Customer onboarding",
      audience: "Enterprise customers",
      options: {
        default_reply_to: "support@example.com"
      }
    },
    TEST_API_KEY
  );

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  assert(
    data.default_reply_to === "support@example.com",
    "default_reply_to not returned in response"
  );
});

// Test 4: Both options combined
await test("POST /journeys with both options", async () => {
  const { response, data } = await makeRequest(
    {
      goal: "Product adoption journey",
      audience: "New users",
      options: {
        emails: 6,
        default_reply_to: "hello@example.com"
      }
    },
    TEST_API_KEY
  );

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  assert(data.stages.length === 6, `Expected 6 stages, got ${data.stages.length}`);
  assert(
    data.default_reply_to === "hello@example.com",
    "default_reply_to not preserved"
  );
});

// Test 5: Missing authentication
await test("POST /journeys without X-API-Key header", async () => {
  const { response, data } = await makeRequest({
    goal: "Test",
    audience: "Test"
  });

  assert(response.status === 401, `Expected 401, got ${response.status}`);
  assert(data.error, "Should have error object");
  assert(data.error.code === "invalid_api_key", "Error code should be invalid_api_key");
});

// Test 6: Invalid API key
await test("POST /journeys with invalid API key", async () => {
  const { response, data } = await makeRequest(
    {
      goal: "Test",
      audience: "Test"
    },
    "invalid-key-999"
  );

  assert(response.status === 401, `Expected 401, got ${response.status}`);
  assert(data.error, "Should have error object");
});

// Test 7: Missing goal field
await test("POST /journeys without goal field", async () => {
  const { response, data } = await makeRequest(
    {
      audience: "Test audience"
    },
    TEST_API_KEY
  );

  assert(response.status === 400, `Expected 400, got ${response.status}`);
  assert(data.error, "Should have error object");
  assert(
    data.error.message.includes("goal"),
    "Error message should mention missing goal"
  );
});

// Test 8: Missing audience field
await test("POST /journeys without audience field", async () => {
  const { response, data } = await makeRequest(
    {
      goal: "Test goal"
    },
    TEST_API_KEY
  );

  assert(response.status === 400, `Expected 400, got ${response.status}`);
  assert(data.error, "Should have error object");
  assert(
    data.error.message.includes("audience"),
    "Error message should mention missing audience"
  );
});

// Test 9: Empty body
await test("POST /journeys with empty body", async () => {
  const { response, data } = await makeRequest({}, TEST_API_KEY);

  assert(response.status === 400, `Expected 400, got ${response.status}`);
  assert(data.error, "Should have error object");
});

// Test 10: Performance test
await test("POST /journeys performance (under 10s)", async () => {
  const { response, duration } = await makeRequest(
    {
      goal: "Performance test journey",
      audience: "Test users"
    },
    TEST_API_KEY
  );

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  assert(duration < 10000, `Latency ${duration}ms exceeds 10s target`);
  console.log(`  → End-to-end latency: ${duration}ms`);
});

  // Print results
  console.log("\n" + "=".repeat(60));
  console.log("TEST RESULTS");
  console.log("=".repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    console.log(`\n${result.message} ${result.name}`);
    if (!result.passed) {
      console.log(`  Duration: ${result.duration}ms`);
    }
  });

  console.log("\n" + "=".repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log("=".repeat(60) + "\n");

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runAllTests();
