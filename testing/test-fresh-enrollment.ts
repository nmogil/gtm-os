/**
 * Comprehensive test script for POST /enrollments endpoint
 * Tests fresh enrollment with full metadata and scheduler integration
 * Run with: npx tsx test-fresh-enrollment.ts
 */

const CONVEX_SITE_URL = "https://focused-bloodhound-276.convex.site";
const API_KEY = "test-api-key-123";
const TEST_EMAIL = "thenthrasher10+testing_01@gmail.com";

// You'll need to set this to a valid journey_id from your database
const JOURNEY_ID = "jd7fg1fa3kq2dncmm05323g1td7rnxse"; // Update this!

async function testFreshEnrollment() {
  console.log("\n=== Test 1: Fresh Enrollment with Full Metadata ===");

  const response = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    },
    body: JSON.stringify({
      journey_id: JOURNEY_ID,
      contact: {
        email: TEST_EMAIL,
        data: {
          name: "Noah",
          company: "GTM OS"
        }
      },
      options: {
        test_mode: true,
        reply_to: "noah@gtmos.dev",
        tags: {
          source: "test_script",
          test_id: "fresh_enrollment_01"
        },
        headers: {
          "X-Custom-Test": "fresh-enrollment"
        },
        start_at: Date.now() // Start immediately
      }
    })
  });

  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));

  if (response.status !== 200) {
    throw new Error("Failed to create enrollment");
  }

  console.log("\n✅ Enrollment created successfully!");
  console.log("Enrollment ID:", data.enrollment_id);
  console.log("Test mode:", data.test_mode);
  console.log("Tags:", JSON.stringify(data.tags, null, 2));

  return data.enrollment_id;
}

async function testIdempotency(enrollmentId: string) {
  console.log("\n=== Test 2: Idempotency Check ===");

  const idempotencyKey = `test-fresh-${Date.now()}`;

  // First request with idempotency key
  console.log("\nSending first request with idempotency key:", idempotencyKey);
  const response1 = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      "X-Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify({
      journey_id: JOURNEY_ID,
      contact: {
        email: `thenthrasher10+idempotent_test@gmail.com`,
        data: {
          name: "Idempotency Test"
        }
      },
      options: {
        test_mode: true
      }
    })
  });

  const data1 = await response1.json();
  console.log("First request - Status:", response1.status);
  console.log("First request - existing:", data1.existing);

  // Duplicate request with same key
  console.log("\nSending duplicate request with same idempotency key...");
  const response2 = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      "X-Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify({
      journey_id: JOURNEY_ID,
      contact: {
        email: `thenthrasher10+idempotent_test@gmail.com`,
        data: {
          name: "Idempotency Test"
        }
      },
      options: {
        test_mode: true
      }
    })
  });

  const data2 = await response2.json();
  console.log("Second request - Status:", response2.status);
  console.log("Second request - existing:", data2.existing);

  if (data2.existing !== true) {
    throw new Error("Idempotency check failed - expected existing=true");
  }

  console.log("\n✅ Idempotency working correctly!");
}

async function queryEnrollments() {
  console.log("\n=== Test 3: Query Enrollments from Database ===");

  // Note: This would require a query endpoint. For now, we'll just document this step.
  console.log("\nTo verify enrollment in database, you can:");
  console.log("1. Check Convex Dashboard > Data > enrollments table");
  console.log(`2. Filter by contact_email: ${TEST_EMAIL}`);
  console.log("3. Verify metadata fields: test_mode, tags, custom_headers, reply_to");
  console.log("\n⏭️  Skipping automated query (would need query endpoint)");
}

async function waitForScheduler() {
  console.log("\n=== Test 4: Wait for Scheduler to Process ===");
  console.log("\nThe scheduler runs every minute (cron job).");
  console.log("Since test_mode=true, it will send immediately (bypassing send window).");
  console.log("\nWaiting 90 seconds for scheduler to pick up enrollment...");

  // Wait 90 seconds
  for (let i = 90; i > 0; i -= 10) {
    process.stdout.write(`\rTime remaining: ${i}s...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  console.log("\n\n✅ Wait complete!");
}

async function checkMessages() {
  console.log("\n=== Test 5: Verify Message Was Sent ===");

  console.log("\nTo verify message was sent, check:");
  console.log("1. Convex Dashboard > Data > messages table");
  console.log(`2. Filter by enrollment_id (from Test 1)`);
  console.log("3. Verify status='sent' and resend_message_id is present");
  console.log("4. Verify tags and has_metadata=true");
  console.log("\n5. Check your email inbox:", TEST_EMAIL);
  console.log("   (Gmail will show this in your main inbox via + addressing)");
  console.log("\n⏭️  Manual verification required");
}

async function testErrorCases() {
  console.log("\n=== Test 6: Error Cases ===");

  // Test with invalid journey_id
  console.log("\nTest 6a: Invalid journey_id");
  const response1 = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    },
    body: JSON.stringify({
      journey_id: "invalid_journey_id",
      contact: {
        email: TEST_EMAIL
      }
    })
  });

  console.log("Status:", response1.status);
  if (response1.status === 400) {
    console.log("✅ Invalid journey_id rejected correctly");
  }

  // Test with invalid email
  console.log("\nTest 6b: Invalid email format");
  const response2 = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    },
    body: JSON.stringify({
      journey_id: JOURNEY_ID,
      contact: {
        email: "invalid-email"
      }
    })
  });

  const data2 = await response2.json();
  console.log("Status:", response2.status);
  console.log("Error:", data2.error || data2.code);
  if (response2.status === 400) {
    console.log("✅ Invalid email rejected correctly");
  }

  // Test with missing required fields
  console.log("\nTest 6c: Missing required fields");
  const response3 = await fetch(`${CONVEX_SITE_URL}/enrollments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    },
    body: JSON.stringify({
      journey_id: JOURNEY_ID
      // Missing contact
    })
  });

  console.log("Status:", response3.status);
  if (response3.status === 400) {
    console.log("✅ Missing fields rejected correctly");
  }
}

async function cleanupInstructions(enrollmentId: string) {
  console.log("\n=== Test 7: Cleanup Instructions ===");
  console.log("\nTo clean up test enrollments, run:");
  console.log(`npx tsx cleanup-enrollments.ts`);
  console.log("\nOr manually delete from Convex Dashboard:");
  console.log("1. Go to Data > enrollments");
  console.log(`2. Find enrollment_id: ${enrollmentId}`);
  console.log("3. Delete the record");
  console.log("\n⏭️  Cleanup can be done manually");
}

async function runTests() {
  try {
    console.log("=".repeat(60));
    console.log("  COMPREHENSIVE POST /ENROLLMENTS ENDPOINT TEST");
    console.log("=".repeat(60));

    const enrollmentId = await testFreshEnrollment();
    await testIdempotency(enrollmentId);
    await queryEnrollments();
    await waitForScheduler();
    await checkMessages();
    await testErrorCases();
    await cleanupInstructions(enrollmentId);

    console.log("\n" + "=".repeat(60));
    console.log("  ✅ ALL TESTS COMPLETED!");
    console.log("=".repeat(60));
    console.log("\nNext steps:");
    console.log("1. Check your email:", TEST_EMAIL);
    console.log("2. Verify message in Convex Dashboard > Data > messages");
    console.log("3. Confirm enrollment advanced to next stage");
    console.log("4. Clean up test data when done\n");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

runTests();
