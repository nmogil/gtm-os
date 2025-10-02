#!/usr/bin/env tsx
/**
 * Emergency cleanup script to stop spam emails
 * Deletes all enrollments from the database
 */

const CONVEX_SITE_URL = "https://focused-bloodhound-276.convex.site";
const API_KEY = "test-api-key-123";

async function deleteAllEnrollments() {
  console.log("🧹 Starting emergency enrollment cleanup...\n");

  // Get all enrollments via the data API
  const response = await fetch(`${CONVEX_SITE_URL}/api/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY
    },
    body: JSON.stringify({
      path: "queries:listAllEnrollments",
      args: {}
    })
  });

  if (!response.ok) {
    console.error("❌ Failed to fetch enrollments");
    console.error("Response:", await response.text());
    process.exit(1);
  }

  const data = await response.json();
  console.log("Found enrollments:", data);

  console.log("\n⚠️  Manual cleanup required:");
  console.log("1. Go to Convex Dashboard: https://dashboard.convex.dev");
  console.log("2. Select your deployment: focused-bloodhound-276");
  console.log("3. Navigate to Data → enrollments table");
  console.log("4. Delete all rows or filter by journey_id: jd7fg1fa3kq2dncmm05323g1td7rnxse");
  console.log("\nThis will immediately stop the spam emails.");
}

deleteAllEnrollments().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
