import { describe, it } from "vitest";
import { Resend } from "resend";

/**
 * Direct test of Resend API to confirm 429 rate limiting
 */
describe("Resend API Rate Limit Investigation", () => {
  it("makes rapid calls to Resend to trigger rate limit", async () => {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.log("⚠️  No RESEND_API_KEY found in environment");
      return;
    }

    console.log("\n=== Testing Resend API rate limits ===\n");
    console.log("API Key:", apiKey.substring(0, 10) + "...");

    const resend = new Resend(apiKey);

    // Make 10 rapid calls to trigger rate limit
    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();

      try {
        const result = await resend.domains.list();
        const duration = Date.now() - startTime;

        if (result.error) {
          console.log(`\n🔴 Request ${i + 1}: ERROR (${duration}ms)`);
          console.log("Error object:", JSON.stringify(result.error, null, 2));
          console.log("Error message:", result.error.message);
          console.log("Error name:", result.error.name);

          // Check if it's a rate limit error
          if (result.error.message?.includes("Too many requests") ||
              result.error.message?.includes("rate limit")) {
            console.log("✅ CONFIRMED: This is a Resend rate limit error (likely HTTP 429)");
          }
        } else {
          console.log(`✅ Request ${i + 1}: SUCCESS (${duration}ms) - ${result.data?.data?.length || 0} domains`);
        }
      } catch (error: any) {
        const duration = Date.now() - startTime;
        console.log(`\n❌ Request ${i + 1}: EXCEPTION (${duration}ms)`);
        console.log("Exception type:", error.constructor.name);
        console.log("Exception message:", error.message);
        console.log("Exception status:", error.statusCode || error.status);
        console.log("Full exception:", error);
      }

      // No delay - we want to trigger rate limit
    }

    console.log("\n=== Test with delays (500ms) to stay under rate limit ===\n");

    // Now try with delays
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      const result = await resend.domains.list();
      const duration = Date.now() - startTime;

      if (result.error) {
        console.log(`🔴 Request ${i + 1}: ERROR (${duration}ms) - ${result.error.message}`);
      } else {
        console.log(`✅ Request ${i + 1}: SUCCESS (${duration}ms)`);
      }

      // Wait 500ms (allows 2 requests/second)
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }, { timeout: 60000 });

  it("makes a single Resend API call to inspect response structure", async () => {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.log("⚠️  No RESEND_API_KEY found");
      return;
    }

    const resend = new Resend(apiKey);

    console.log("\n=== Inspecting Resend API response structure ===\n");

    const result = await resend.domains.list();

    console.log("Result keys:", Object.keys(result));
    console.log("Has error?:", !!result.error);
    console.log("Has data?:", !!result.data);
    console.log("Full result:", JSON.stringify(result, null, 2));
  }, { timeout: 10000 });
});
