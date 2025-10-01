import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createTestAccount = mutation({
  args: {
    name: v.string(),
    apiKey: v.string()
  },
  handler: async (ctx, args) => {
    // Check if account already exists
    const existing = await ctx.db
      .query("accounts")
      .filter((q) => q.eq(q.field("api_key"), args.apiKey))
      .first();

    if (existing) {
      return { success: true, account_id: existing._id, message: "Account already exists" };
    }

    // Create new test account
    const accountId = await ctx.db.insert("accounts", {
      name: args.name,
      api_key: args.apiKey,
      plan: "free",
      limits: {
        max_journeys: 5,
        max_active_enrollments: 1000,
        max_enrollments_per_second: 10
      },
      usage: {
        journeys_created: 0,
        active_enrollments: 0,
        messages_sent_today: 0
      },
      created_at: Date.now()
    });

    return { success: true, account_id: accountId, message: "Test account created" };
  }
});
