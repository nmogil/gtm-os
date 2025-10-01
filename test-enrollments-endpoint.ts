/**
 * Test script for POST /enrollments endpoint
 * Run with: npx tsx test-enrollments-endpoint.ts
 */

const CONVEX_SITE_URL = "https://focused-bloodhound-276.convex.site";
const API_KEY = "test-api-key-123";
const JOURNEY_ID = "jd7770pq5v15twqp9xa7kxhx497rnb45"; // Created via POST /journeys

async function testBasicEnrollment() {
  console.log("\n=== Test 1: Basic Enrollment ===");

  const response = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    },
    body: JSON.stringify({
      journey_id: JOURNEY_ID,
      contact: {
        email: "test@example.com",
        data: {
          name: "Test User",
          company: "Acme Inc"
        }
      }
    })
  });

  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));

  return data;
}

async function testWithMetadata() {
  console.log("\n=== Test 2: Enrollment with Metadata ===");

  const response = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    },
    body: JSON.stringify({
      journey_id: JOURNEY_ID,
      contact: {
        email: "metadata-test@example.com",
        data: {
          name: "Metadata User",
          company: "Test Co"
        }
      },
      options: {
        test_mode: true,
        reply_to: "custom@example.com",
        tags: ["test", "demo"],
        headers: {
          "X-Custom": "value"
        }
      }
    })
  });

  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));

  return data;
}

async function testIdempotency() {
  console.log("\n=== Test 3: Idempotency ===");

  const idempotencyKey = `test-${Date.now()}`;
  const payload = {
    journey_id: JOURNEY_ID,
    contact: {
      email: "idempotent@example.com",
      data: {
        name: "Idempotent User"
      }
    }
  };

  // First request
  console.log("\nFirst request with idempotency key:", idempotencyKey);
  const response1 = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      "X-Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify(payload)
  });

  const data1 = await response1.json();
  console.log("Status:", response1.status);
  console.log("Response:", JSON.stringify(data1, null, 2));

  // Duplicate request with same key
  console.log("\nDuplicate request with same idempotency key...");
  const response2 = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      "X-Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify(payload)
  });

  const data2 = await response2.json();
  console.log("Status:", response2.status);
  console.log("Response:", JSON.stringify(data2, null, 2));
  console.log("existing flag:", data2.existing);
}

async function runTests() {
  try {
    await testBasicEnrollment();
    await testWithMetadata();
    await testIdempotency();

    console.log("\n✅ All tests completed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  }
}

runTests();
