import { ConvexHttpClient } from "convex/browser";

// Use CONVEX_URL for direct client access (ends with .convex.cloud)
// Falls back to hardcoded deployment URL if not set
const CONVEX_URL = process.env.CONVEX_URL || "https://focused-bloodhound-276.convex.cloud";
const TEST_API_KEY = process.env.TEST_API_KEY || "test-api-key-123";

export async function setupTestAccount() {
  const client = new ConvexHttpClient(CONVEX_URL);

  try {
    // Call the mutation directly via the Convex client
    const result = await client.mutation("mutations:upsertTestAccount" as any, {
      api_key: TEST_API_KEY,
      name: "Test Account"
    });

    if (result.created) {
      console.log("✓ Created test account with API key:", TEST_API_KEY);
    } else {
      console.log("✓ Test account already exists");
    }

    return result.account_id;
  } catch (error) {
    console.error("Failed to setup test account:", error);
    throw error;
  }
}

export async function setup() {
  console.log("\n🔧 Setting up test environment...");
  await setupTestAccount();
  console.log("✓ Test environment ready\n");
}
