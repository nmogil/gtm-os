import { internalMutation } from "../_generated/server";

/**
 * Migration: Fix enrollments missing stages_snapshot field
 *
 * This migration addresses enrollments created before the stages_snapshot
 * field was added. It attempts to backfill from the journey's current stages,
 * or marks them as failed if the journey no longer exists.
 *
 * Background: The scheduler was crashing every minute trying to process
 * enrollments without stages_snapshot, causing high Convex usage.
 */
export const fixMissingStagesSnapshot = internalMutation({
  args: {},
  handler: async (ctx) => {
    const enrollments = await ctx.db.query("enrollments").collect();

    let backfilled = 0;
    let markedFailed = 0;
    let alreadyHaveSnapshot = 0;

    for (const enrollment of enrollments) {
      // Skip if already has stages_snapshot
      if (enrollment.stages_snapshot && Array.isArray(enrollment.stages_snapshot)) {
        alreadyHaveSnapshot++;
        continue;
      }

      // Try to get journey to backfill stages
      const journey = await ctx.db.get(enrollment.journey_id);

      if (journey && journey.stages && Array.isArray(journey.stages) && journey.stages.length > 0) {
        // Backfill from journey's current stages
        await ctx.db.patch(enrollment._id, {
          stages_snapshot: journey.stages,
          journey_version: journey.version || 1
        });
        backfilled++;
        console.log(`Backfilled stages_snapshot for enrollment ${enrollment._id} from journey ${journey._id}`);
      } else {
        // Journey doesn't exist or has no stages - mark enrollment as failed
        await ctx.db.patch(enrollment._id, {
          status: "failed",
          last_error: "migration: journey_not_found_or_no_stages"
        });
        markedFailed++;
        console.log(`Marked enrollment ${enrollment._id} as failed - journey not found or has no stages`);
      }
    }

    const result = {
      total_enrollments: enrollments.length,
      already_have_snapshot: alreadyHaveSnapshot,
      backfilled: backfilled,
      marked_failed: markedFailed,
      message: `Migration complete: ${backfilled} backfilled, ${markedFailed} marked as failed`
    };

    console.log("Migration complete:", result);
    return result;
  }
});
