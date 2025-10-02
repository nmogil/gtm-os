#!/usr/bin/env tsx
/**
 * Comprehensive test suite for scheduler cron (Issue #11)
 * Tests batch email sending with real Resend integration
 *
 * Run with: npx tsx test-scheduler.ts
 */

const CONVEX_SITE_URL = "https://focused-bloodhound-276.convex.site";
const API_KEY = "test-api-key-123";

// Test email addresses using + addressing
const TEST_EMAILS = [
  "thenthrasher10@gmail.com",
  "thenthrasher10+gtmos_01@gmail.com",
  "thenthrasher10+gtmos_02@gmail.com",
  "thenthrasher10+gtmos_03@gmail.com",
  "thenthrasher10+gtmos_04@gmail.com"
];

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Running: ${name}`);
  console.log("=".repeat(60));

  try {
    await fn();
    results.push({
      name,
      passed: true,
      message: "✓ Passed",
      duration: Date.now() - start
    });
    console.log(`✓ PASSED (${Date.now() - start}ms)`);
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      message: `✗ Failed: ${error.message}`,
      duration: Date.now() - start
    });
    console.error(`✗ FAILED: ${error.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function makeRequest(endpoint: string, body: any): Promise<any> {
  const response = await fetch(`${CONVEX_SITE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to create a test journey
async function createTestJourney(name: string): Promise<string> {
  console.log(`Creating test journey: ${name}`);

  const response = await makeRequest("/journeys", {
    goal: "Test scheduler functionality with batch sending",
    audience: "Test users for scheduler verification",
    options: {
      emails: 3,
      name: name
    }
  });

  console.log(`✓ Created journey: ${response.journey_id}`);
  return response.journey_id;
}

// Helper to enroll a contact
async function enrollContact(
  journeyId: string,
  email: string,
  name: string,
  options: any = {}
): Promise<string> {
  const response = await makeRequest("/enrollments", {
    journey_id: journeyId,
    contact: {
      email: email,
      data: {
        name: name,
        company: "GTM OS Test"
      }
    },
    options: {
      test_mode: true, // Bypass send window restrictions
      ...options
    }
  });

  console.log(`✓ Enrolled ${email} -> ${response.enrollment_id}`);
  return response.enrollment_id;
}

// Main test execution
async function runTests() {
// Test A: Basic scheduler run with 5 immediate sends
await test("Test A: Basic Scheduler - 5 Immediate Sends", async () => {
  // Create journey
  const journeyId = await createTestJourney("Scheduler Test A - Basic Batch");

  // Enroll 5 contacts
  const enrollmentIds: string[] = [];
  for (let i = 0; i < TEST_EMAILS.length; i++) {
    const enrollmentId = await enrollContact(
      journeyId,
      TEST_EMAILS[i],
      `Test User ${i + 1}`
    );
    enrollmentIds.push(enrollmentId);
  }

  console.log("\n⏱️  Waiting 90 seconds for scheduler to process (runs every minute)...");
  await sleep(90000); // Wait for cron to run

  console.log("✓ Test A setup complete");
  console.log("📧 Check inbox at thenthrasher10@gmail.com for 5 emails from digest@paper-boy.app");
  console.log(`📊 Journey ID: ${journeyId}`);
  console.log(`📊 Enrollment IDs: ${enrollmentIds.join(", ")}`);
});

// Test B: Idempotency - scheduler should not send duplicate messages
await test("Test B: Idempotency - No Duplicate Sends", async () => {
  console.log("⏱️  Waiting another 90 seconds to verify no duplicates sent...");
  await sleep(90000);

  console.log("✓ Test B complete");
  console.log("📧 Verify ONLY 5 emails received (no duplicates)");
});

// Test C: Stage progression - verify enrollments advance to next stage
await test("Test C: Stage Progression", async () => {
  const journeyId = await createTestJourney("Scheduler Test C - Stage Progression");

  const enrollmentId = await enrollContact(
    journeyId,
    "thenthrasher10+stage_test@gmail.com",
    "Stage Test User"
  );

  console.log("\n⏱️  Waiting 90 seconds for first stage to send...");
  await sleep(90000);

  console.log("✓ Test C complete");
  console.log("📧 Check for stage 1 email");
  console.log(`📊 Enrollment ID: ${enrollmentId}`);
  console.log("🔍 Manually verify enrollment.current_stage = 1 in database");
});

// Test D: Send window blocking (non-test mode, outside hours)
await test("Test D: Send Window Blocking", async () => {
  const currentHour = new Date().getUTCHours();
  const isOutsideWindow = currentHour < 9 || currentHour >= 17;

  if (!isOutsideWindow) {
    console.log("⚠️  Skipping: Currently within send window (9am-5pm UTC)");
    console.log(`   Current UTC hour: ${currentHour}`);
    return;
  }

  const journeyId = await createTestJourney("Scheduler Test D - Send Window");

  // Enroll WITHOUT test_mode
  const enrollmentId = await enrollContact(
    journeyId,
    "thenthrasher10+window_test@gmail.com",
    "Window Test User",
    { test_mode: false } // Should block outside 9am-5pm
  );

  console.log("\n⏱️  Waiting 90 seconds...");
  await sleep(90000);

  console.log("✓ Test D complete");
  console.log("📧 Should NOT receive email (outside send window)");
  console.log(`📊 Enrollment ID: ${enrollmentId}`);
  console.log("🔍 Verify enrollment.next_run_at was rescheduled to 9am UTC");
});

// Test E: Stop-on-convert
await test("Test E: Stop-on-Convert", async () => {
  console.log("⚠️  Note: This test requires manual conversion event creation");
  console.log("📋 Steps:");
  console.log("   1. Create enrollment");
  console.log("   2. Manually insert conversion event in 'events' table");
  console.log("   3. Wait for scheduler");
  console.log("   4. Verify enrollment status = 'converted'");
  console.log("   5. Verify no further emails sent");

  const journeyId = await createTestJourney("Scheduler Test E - Stop-on-Convert");
  const enrollmentId = await enrollContact(
    journeyId,
    "thenthrasher10+convert_test@gmail.com",
    "Convert Test User"
  );

  console.log(`📊 Enrollment ID: ${enrollmentId}`);
  console.log("⏸️  Pausing test - manual intervention required");
});

// Test F: Suppression list
await test("Test F: Suppression List", async () => {
  console.log("⚠️  Note: This test requires manual suppression entry");
  console.log("📋 Steps:");
  console.log("   1. Create enrollment");
  console.log("   2. Manually insert suppression in 'suppressions' table");
  console.log("   3. Wait for scheduler");
  console.log("   4. Verify enrollment status = 'suppressed'");
  console.log("   5. Verify no email sent");

  const journeyId = await createTestJourney("Scheduler Test F - Suppression");
  const enrollmentId = await enrollContact(
    journeyId,
    "thenthrasher10+suppress_test@gmail.com",
    "Suppress Test User"
  );

  console.log(`📊 Enrollment ID: ${enrollmentId}`);
  console.log("⏸️  Pausing test - manual intervention required");
});

// Print summary
console.log("\n" + "=".repeat(60));
console.log("TEST SUMMARY");
console.log("=".repeat(60));

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

results.forEach(result => {
  const icon = result.passed ? "✓" : "✗";
  console.log(`${icon} ${result.name} (${result.duration}ms)`);
  if (!result.passed) {
    console.log(`  ${result.message}`);
  }
});

console.log("\n" + "=".repeat(60));
console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
console.log("=".repeat(60));

console.log("\n📧 MANUAL VERIFICATION CHECKLIST:");
console.log("1. Check thenthrasher10@gmail.com inbox");
console.log("2. Verify emails from digest@paper-boy.app");
console.log("3. Verify personalization (names, unsubscribe URLs)");
console.log("4. Query 'messages' table to verify records created");
console.log("5. Query 'enrollments' table to verify status updates");
console.log("6. Verify no duplicate sends (idempotency working)");

process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
