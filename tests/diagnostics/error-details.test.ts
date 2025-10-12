import { describe, it } from "vitest";
import { apiRequest, generateTestEmail } from "../helpers/api";
import { mockJourneyPayload } from "../helpers/fixtures";

/**
 * Simple test to capture the exact error message from 401 failures
 */
describe("Error Details Investigation", () => {
  it("runs enrollments until we capture a 401 error", async () => {
    // Create journey
    const { data: journeyData } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify(mockJourneyPayload)
    });

    console.log("\n=== Running enrollments to capture 401 error ===\n");

    // Try 20 enrollments to increase chance of catching a 401
    for (let i = 0; i < 20; i++) {
      const email = generateTestEmail();
      const { response, data } = await apiRequest("/enrollments", {
        method: "POST",
        body: JSON.stringify({
          journey_id: journeyData.journey_id,
          contact: {
            email,
            data: { name: `Error Test ${i}` }
          }
        })
      });

      if (response.status === 401) {
        console.log(`\n🔴 FOUND 401 ERROR at attempt ${i + 1}:\n`);
        console.log("Response status:", response.status);
        console.log("Response headers:", JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
        console.log("Error data:", JSON.stringify(data, null, 2));
        console.log("\nFull error object:", data);

        if (data && data.error) {
          console.log("\nError code:", data.error.code);
          console.log("Error message:", data.error.message);
          console.log("Error details:", data.error.details);
        }
        break;
      } else {
        console.log(`${i + 1}. Status: ${response.status} ✅`);
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }, { timeout: 60000 });
});
