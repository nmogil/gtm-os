import { query } from "./_generated/server";
import { v } from "convex/values";

export const getAccountByApiKey = query({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("accounts")
      .filter((q) => q.eq(q.field("api_key"), args.apiKey))
      .first();
    return account;
  }
});

export const getJourney = query({
  args: { journey_id: v.id("journeys") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.journey_id);
  }
});
