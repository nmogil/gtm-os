/**
 * Emergency cleanup mutations
 * Use these to stop spam emails by removing orphaned enrollments
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Delete all enrollments with missing journeys
 * This stops the spam emails immediately
 */
export const deleteOrphanedEnrollments = internalMutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
    journeyId: v.string()
  }),
  handler: async (ctx) => {
    const journeyId = "jd7fg1fa3kq2dncmm05323g1td7rnxse";

    // Find all enrollments for the deleted journey
    const orphanedEnrollments = await ctx.db
      .query("enrollments")
      .filter((q) => q.eq(q.field("journey_id"), journeyId))
      .collect();

    console.log(`Found ${orphanedEnrollments.length} orphaned enrollments`);

    // Delete them all
    for (const enrollment of orphanedEnrollments) {
      await ctx.db.delete(enrollment._id);
    }

    return {
      deleted: orphanedEnrollments.length,
      journeyId: journeyId
    };
  }
});

/**
 * Delete ALL enrollments (nuclear option)
 */
export const deleteAllEnrollments = internalMutation({
  args: {},
  returns: v.object({
    deleted: v.number()
  }),
  handler: async (ctx) => {
    const allEnrollments = await ctx.db.query("enrollments").collect();

    console.log(`Deleting ${allEnrollments.length} total enrollments`);

    for (const enrollment of allEnrollments) {
      await ctx.db.delete(enrollment._id);
    }

    return {
      deleted: allEnrollments.length
    };
  }
});
