/**
 * Creates a test journey with emails sent 2-3 minutes apart for quick testing
 * Run with: npx tsx create-fast-test-journey.ts
 */

async function createFastTestJourney() {
  const { ConvexHttpClient } = await import("convex/browser");
  
  const client = new ConvexHttpClient("https://focused-bloodhound-276.convex.site");
  
  const journeyData = {
    name: "Fast Test Journey (2-3 min intervals)",
    stages: [
      {
        day: 0,
        subject: "Stage 0: Immediate Welcome, {{name}}!",
        body: "<p>Hi {{name}},</p><p>This is stage 0, sent immediately!</p><p>Next email in ~2 minutes.</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>"
      },
      {
        day: 0.0014, // ~2 minutes (2/1440 days)
        subject: "Stage 1: 2 Minutes Later, {{name}}!",
        body: "<p>Hi {{name}},</p><p>This is stage 1, sent ~2 minutes after stage 0!</p><p>Next email in ~3 minutes.</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>"
      },
      {
        day: 0.0035, // ~5 minutes from start
        subject: "Stage 2: Final Test Email, {{name}}!",
        body: "<p>Hi {{name}},</p><p>This is stage 2, sent ~5 minutes after stage 0!</p><p>Test complete!</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>"
      }
    ]
  };

  console.log("Creating fast test journey with 2-3 minute intervals...\n");

  try {
    const result = await client.mutation("mutations:createJourneyFromGenerated" as any, {
      account_id: "jx72w080b53f5nweh99n9b3ty57rmary",
      goal: "Fast testing with 2-3 minute intervals",
      audience: "Test users",
      journey: journeyData
    });

    console.log("✅ Fast test journey created!");
    console.log("Journey ID:", result.journeyId);
    console.log("\nStage timing:");
    console.log("  Stage 0: Immediate");
    console.log("  Stage 1: ~2 minutes later");
    console.log("  Stage 2: ~5 minutes from start (~3 min after stage 1)");
    console.log("\nUse this journey_id for testing:\n");
    console.log(result.journeyId);
    
    return result.journeyId;
  } catch (error: any) {
    console.error("Error creating journey:", error.message);
    throw error;
  }
}

createFastTestJourney().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
