/**
 * Test script for Resend API key validation in POST /enrollments
 * Run with: npx tsx testing/test-resend-validation.ts
 */

const CONVEX_SITE_URL = "https://focused-bloodhound-276.convex.site";
const API_KEY = "test-api-key-123";
const JOURNEY_ID = "jd7843201hz8pc4b26a3tecaed7rpwf1"; // Use existing journey

async function test1_ValidAccountKey() {
  console.log("\n=== Test 1: Valid Account Resend Key ===");

  const response = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    },
    body: JSON.stringify({
      journey_id: JOURNEY_ID,
      contact: {
        email: `test-valid-${Date.now()}@gmail.com`,
        data: { name: "Valid Key Test" }
      },
      options: { test_mode: true }
    })
  });

  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));

  if (response.status === 200) {
    console.log("✅ PASS: Enrollment created with valid key");
    return true;
  } else {
    console.log("❌ FAIL: Expected 200, got", response.status);
    return false;
  }
}

async function test2_InvalidHeaderKey() {
  console.log("\n=== Test 2: Invalid X-Resend-Key Header ===");

  const response = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      "X-Resend-Key": "re_invalid_12345"
    },
    body: JSON.stringify({
      journey_id: JOURNEY_ID,
      contact: {
        email: `test-invalid-${Date.now()}@gmail.com`,
        data: { name: "Invalid Key Test" }
      }
    })
  });

  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));

  if (response.status === 401 && data.error?.code === "invalid_resend_key") {
    console.log("✅ PASS: Correctly rejected invalid key");
    return true;
  } else {
    console.log("❌ FAIL: Expected 401 with invalid_resend_key error");
    return false;
  }
}

async function test3_ValidHeaderOverride() {
  console.log("\n=== Test 3: Valid X-Resend-Key Header Override ===");

  // Replace with your actual valid Resend key for testing
  const validKey = process.env.RESEND_API_KEY;

  if (!validKey) {
    console.log("⚠️  SKIP: RESEND_API_KEY env var not set");
    return true; // Skip but don't fail
  }

  const response = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      "X-Resend-Key": validKey
    },
    body: JSON.stringify({
      journey_id: JOURNEY_ID,
      contact: {
        email: `test-override-${Date.now()}@gmail.com`,
        data: { name: "Override Key Test" }
      },
      options: { test_mode: true }
    })
  });

  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));

  if (response.status === 200) {
    console.log("✅ PASS: Enrollment created with override key");
    return true;
  } else {
    console.log("❌ FAIL: Expected 200, got", response.status);
    return false;
  }
}

async function runTests() {
  console.log("Starting Resend API Key Validation Tests...");
  console.log("=".repeat(50));

  const results: boolean[] = [];

  try {
    results.push(await test1_ValidAccountKey());
    results.push(await test2_InvalidHeaderKey());
    results.push(await test3_ValidHeaderOverride());

    console.log("\n" + "=".repeat(50));
    const passCount = results.filter(r => r).length;
    const totalCount = results.length;

    if (passCount === totalCount) {
      console.log(`✅ All tests passed! (${passCount}/${totalCount})`);
    } else {
      console.log(`❌ Some tests failed: ${passCount}/${totalCount} passed`);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Test suite failed:", error);
    process.exit(1);
  }
}

runTests();
