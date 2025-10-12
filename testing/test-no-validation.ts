#!/usr/bin/env tsx
/**
 * Test script to verify Issue #29 fix: Rapid enrollments without rate limit errors
 *
 * This script tests that we can make 10 rapid enrollments without hitting
 * Resend API rate limits (2 req/sec). Before the fix, this would fail with
 * 60% error rate due to Resend validation on every enrollment.
 *
 * Expected: 10/10 successes (no rate limit errors)
 */

const API_URL = "https://focused-bloodhound-276.convex.site";
const API_KEY = "test-api-key-123";

async function testRapidEnrollments() {
  console.log("\n=== Testing Issue #29 Fix: Rapid Enrollments ===\n");

  // Create a journey for testing
  console.log("1. Creating test journey...");
  const journeyRes = await fetch(`${API_URL}/journeys`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      goal: "Test rapid enrollments (Issue #29)",
      audience: "Test users",
      options: { emails: 5 }
    })
  });

  if (!journeyRes.ok) {
    console.error("❌ Failed to create journey:", await journeyRes.text());
    process.exit(1);
  }

  const journey = await journeyRes.json();
  console.log(`✅ Created journey: ${journey.journey_id}\n`);

  // Make 10 rapid enrollments (would previously fail with rate limit errors)
  console.log("2. Making 10 rapid enrollments (no delay)...");
  const startTime = Date.now();

  const promises = Array(10)
    .fill(null)
    .map(async (_, i) => {
      const enrollmentStart = Date.now();

      const res = await fetch(`${API_URL}/enrollments`, {
        method: "POST",
        headers: {
          "X-API-Key": API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          journey_id: journey.journey_id,
          contact: {
            email: `test-rapid-${Date.now()}-${i}@testing.xyz`,
            data: { name: `Test User ${i}` }
          }
        })
      });

      const duration = Date.now() - enrollmentStart;
      const data = await res.json();

      return {
        index: i,
        status: res.status,
        duration,
        data,
        success: res.status === 200
      };
    });

  const results = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;

  // Analyze results
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  console.log(`\n=== Results (${totalDuration}ms total) ===\n`);
  console.log(`✅ Successes: ${successes.length}/10`);
  console.log(`❌ Failures: ${failures.length}/10`);

  if (failures.length > 0) {
    console.log("\n❌ Failed requests:");
    failures.forEach((f) => {
      console.log(`  [${f.index}] ${f.status} (${f.duration}ms)`);
      console.log(`      Error: ${JSON.stringify(f.data)}`);

      // Check if it's a rate limit error
      if (
        f.data.error?.includes("rate limit") ||
        f.data.error?.includes("Too many requests") ||
        f.data.code === "invalid_resend_key"
      ) {
        console.log(`      ⚠️  RATE LIMIT ERROR DETECTED!`);
      }
    });
  }

  // Success metrics
  if (successes.length > 0) {
    const avgDuration =
      successes.reduce((sum, r) => sum + r.duration, 0) / successes.length;
    console.log(`\n✅ Average response time: ${avgDuration.toFixed(0)}ms`);
  }

  // Final verdict
  console.log("\n=== Verdict ===\n");
  if (failures.length === 0) {
    console.log(
      "✅ SUCCESS! All 10 rapid enrollments succeeded without rate limit errors."
    );
    console.log(
      "   Issue #29 fix is working correctly - no Resend API validation on enrollments."
    );
    process.exit(0);
  } else {
    console.log(
      `❌ FAILURE! ${failures.length}/10 enrollments failed.`
    );
    console.log(
      "   This may indicate Issue #29 fix is not working as expected."
    );
    process.exit(1);
  }
}

// Run the test
testRapidEnrollments().catch((error) => {
  console.error("\n❌ Test script error:", error);
  process.exit(1);
});
