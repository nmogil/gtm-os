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

export const getEnrollment = query({
  args: { enrollment_id: v.id("enrollments") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.enrollment_id);
  }
});

export const getAllEnrollments = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db.query("enrollments").collect();
  }
});

export const getAllMessages = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db.query("messages").collect();
  }
});

export const getEnrollmentByEmail = query({
  args: { email: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const enrollments = await ctx.db
      .query("enrollments")
      .filter((q) => q.eq(q.field("contact_email"), args.email))
      .order("desc")
      .take(1);
    return enrollments[0] || null;
  }
});

export const getMessagesByEnrollmentId = query({
  args: { enrollment_id: v.id("enrollments") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_enrollment", (q) => q.eq("enrollment_id", args.enrollment_id))
      .collect();
  }
});
