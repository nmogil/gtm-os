/**
 * Test script for GET /journeys/:id endpoint (Issue #26)
 * Usage: npx tsx testing/test-journey-retrieval.ts
 */

const API_URL = "https://focused-bloodhound-276.convex.site";
const API_KEY = "test-api-key-123";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<boolean>, expectedMessage: string) {
  try {
    const passed = await fn();
    results.push({ name, passed, message: expectedMessage });
    console.log(passed ? `✅ ${name}` : `❌ ${name}`);
  } catch (error: any) {
    results.push({ name, passed: false, message: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

async function runTests() {
  console.log("Testing GET /journeys/:id endpoint (Issue #26)");
  console.log("=".repeat(50));

  // Test 1: Get Journey (Happy Path)
  await test("Test 1: Get journey by ID (happy path)", async () => {
  // Create journey
  const createResponse = await fetch(`${API_URL}/journeys`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Test Get Journey",
      stages: [
        { day: 0, subject: "Day 0", body: "Welcome {{unsubscribe_url}}" },
        { day: 5, subject: "Day 5", body: "Follow up {{unsubscribe_url}}" }
      ]
    })
  });

  const createData = await createResponse.json();
  const journeyId = createData.journey_id;
  console.log(`   Created journey: ${journeyId}`);

  // Get journey
  const getResponse = await fetch(`${API_URL}/journeys/${journeyId}`, {
    method: "GET",
    headers: { "X-API-Key": API_KEY }
  });

  const getData = await getResponse.json();

  return (
    getResponse.status === 200 &&
    getData.journey_id === journeyId &&
    getData.name === "Test Get Journey" &&
    getData.stages.length === 2 &&
    getData.stages[0].day === 0 &&
    getData.stages[1].day === 5 &&
    getData.is_active === true &&
    typeof getData.stats === "object" &&
    typeof getData.created_at === "string"
  );
}, "Returns full journey details with correct structure");

// Test 2: Journey Not Found
await test("Test 2: Journey not found", async () => {
  const response = await fetch(`${API_URL}/journeys/jd7nonexistent123`, {
    method: "GET",
    headers: { "X-API-Key": API_KEY }
  });

  const data = await response.json();

  return (
    response.status === 404 &&
    data.error.code === "journey_not_found"
  );
}, "Returns 404 with journey_not_found error code");

// Test 3: Invalid Journey ID Format
await test("Test 3: Invalid journey ID format", async () => {
  const response = await fetch(`${API_URL}/journeys/invalid-id`, {
    method: "GET",
    headers: { "X-API-Key": API_KEY }
  });

  const data = await response.json();

  return (
    response.status === 400 &&
    data.error.code === "invalid_request" &&
    data.error.message.includes("Invalid journey ID format")
  );
}, "Returns 400 with invalid_request error code");

// Test 4: Get Journey with Stats
await test("Test 4: Get journey with enrollment stats", async () => {
  // Create journey
  const createResponse = await fetch(`${API_URL}/journeys`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Stats Test Journey",
      stages: [{ day: 0, subject: "Test", body: "Test {{unsubscribe_url}}" }]
    })
  });

  const createData = await createResponse.json();
  const journeyId = createData.journey_id;

  // Enroll a contact
  await fetch(`${API_URL}/enrollments`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      journey_id: journeyId,
      contact: {
        email: "stats-test@gmail.com",
        data: { name: "Stats Tester" }
      }
    })
  });

  // Wait a moment for stats to update
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Get journey and check stats
  const getResponse = await fetch(`${API_URL}/journeys/${journeyId}`, {
    method: "GET",
    headers: { "X-API-Key": API_KEY }
  });

  const getData = await getResponse.json();

  return (
    getResponse.status === 200 &&
    getData.stats.total_enrolled >= 1
  );
}, "Stats show updated enrollment count");

// Test 5: Ensure Analytics Endpoint Still Works
await test("Test 5: Analytics endpoint not broken", async () => {
  // Create journey with enrollment
  const createResponse = await fetch(`${API_URL}/journeys`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Analytics Test Journey",
      stages: [{ day: 0, subject: "Test", body: "Test {{unsubscribe_url}}" }]
    })
  });

  const createData = await createResponse.json();
  const journeyId = createData.journey_id;

  // Get analytics (different endpoint)
  const analyticsResponse = await fetch(`${API_URL}/journeys/${journeyId}/analytics`, {
    method: "GET",
    headers: { "X-API-Key": API_KEY }
  });

  const analyticsData = await analyticsResponse.json();

  return (
    analyticsResponse.status === 200 &&
    analyticsData.journey_id === journeyId &&
    typeof analyticsData.engagement === "object" &&
    Array.isArray(analyticsData.by_stage)
  );
}, "Analytics endpoint returns different structure and still works");

// Test 6: Authentication Required
await test("Test 6: Authentication required", async () => {
  const response = await fetch(`${API_URL}/journeys/jd7abc123`, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
    // No X-API-Key header
  });

  return response.status === 401;
}, "Returns 401 without API key");

// Test 7: Invalid Route (too many path segments)
await test("Test 7: Invalid route handling", async () => {
  const response = await fetch(`${API_URL}/journeys/jd7abc123/invalid`, {
    method: "GET",
    headers: { "X-API-Key": API_KEY }
  });

  return response.status === 404;
}, "Returns 404 for invalid path structure");

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("Test Summary");
  console.log("=".repeat(50));
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("✅ All tests passed!");
    process.exit(0);
  } else {
    console.log("❌ Some tests failed");
    results.forEach((r, i) => {
      if (!r.passed) {
        console.log(`   ${i + 1}. ${r.name}: ${r.message}`);
      }
    });
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
