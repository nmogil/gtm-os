import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkMessageExists as checkMessageExistsHelper } from "./lib/messageIdempotency";
import { Id } from "./_generated/dataModel";

interface EnrollmentDoc {
  _id: Id<"enrollments">;
  account_id: Id<"accounts">;
  journey_id: Id<"journeys">;
  contact_email: string;
  contact_data: any;
  status: "active" | "completed" | "converted" | "removed" | "failed" | "suppressed";
  current_stage: number;
  next_run_at: number;
  enrolled_at: number;
  test_mode: boolean;
  retry_count: number;
  last_error?: string;
  reply_to?: string;
  tags?: any;
  custom_headers?: any;
}

function groupByAccount(enrollments: EnrollmentDoc[]): Record<string, EnrollmentDoc[]> {
  const batches: Record<string, EnrollmentDoc[]> = {};
  for (const enrollment of enrollments) {
    const accountId = enrollment.account_id;
    if (!batches[accountId]) {
      batches[accountId] = [];
    }
    batches[accountId].push(enrollment);
  }
  return batches;
}

async function checkIfConverted(ctx: any, enrollmentId: Id<"enrollments">): Promise<boolean> {
  const conversionEvent = await ctx.db
    .query("events")
    .withIndex("by_enrollment", (q: any) => q.eq("enrollment_id", enrollmentId))
    .filter((q: any) => q.eq(q.field("event_type"), "conversion"))
    .first();

  return conversionEvent !== null;
}

async function isContactSuppressed(
  ctx: any,
  contactEmail: string,
  journeyId: Id<"journeys">
): Promise<boolean> {
  const suppression = await ctx.db
    .query("suppressions")
    .withIndex("by_journey_email", (q: any) =>
      q.eq("journey_id", journeyId).eq("contact_email", contactEmail)
    )
    .first();

  if (!suppression) return false;

  // Check if suppression has expired
  if (suppression.expires_at && suppression.expires_at < Date.now()) {
    return false;
  }

  return true;
}

function getDayOffset(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

// Main cron entry point - runs every minute
export const processPendingSends = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get pending enrollments (up to 1000 at a time)
    const pending = await ctx.db
      .query("enrollments")
      .withIndex("by_next_run_at")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          q.lte(q.field("next_run_at"), now)
        )
      )
      .take(1000);

    // Group by account for batch processing
    const batches = groupByAccount(pending);

    // Schedule batch processing actions for each account
    for (const [accountId, enrollments] of Object.entries(batches)) {
      await ctx.scheduler.runAfter(0, internal.schedulerActions.processBatchAction, {
        accountId: accountId as Id<"accounts">,
        enrollmentIds: enrollments.map(e => e._id)
      });
    }

    return null;
  }
});

// Query helpers
export const loadAccount = internalQuery({
  args: { accountId: v.id("accounts") },
  returns: v.union(
    v.object({
      _id: v.id("accounts"),
      resend_api_key_encrypted: v.optional(v.string())
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return null;
    return {
      _id: account._id,
      resend_api_key_encrypted: account.resend_api_key_encrypted
    };
  }
});

export const loadEnrollments = internalQuery({
  args: { enrollmentIds: v.array(v.id("enrollments")) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const enrollments = [];
    for (const id of args.enrollmentIds) {
      const enrollment = await ctx.db.get(id);
      if (enrollment) {
        enrollments.push(enrollment);
      }
    }
    return enrollments;
  }
});

export const loadJourney = internalQuery({
  args: { journeyId: v.id("journeys") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.journeyId);
  }
});

export const checkConverted = internalQuery({
  args: { enrollmentId: v.id("enrollments") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    return await checkIfConverted(ctx, args.enrollmentId);
  }
});

export const checkSuppressed = internalQuery({
  args: {
    contactEmail: v.string(),
    journeyId: v.id("journeys")
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    return await isContactSuppressed(ctx, args.contactEmail, args.journeyId);
  }
});

export const checkMessageExists = internalQuery({
  args: {
    enrollmentId: v.id("enrollments"),
    stage: v.number()
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    return await checkMessageExistsHelper(ctx, args.enrollmentId, args.stage);
  }
});

// Mutation helpers
export const markEnrollmentCompleted = internalMutation({
  args: {
    enrollmentId: v.id("enrollments"),
    reason: v.string()
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) return null;

    await ctx.db.patch(args.enrollmentId, {
      status: args.reason === "converted" ? "converted" : "completed"
    });

    return null;
  }
});

export const markEnrollmentSuppressed = internalMutation({
  args: { enrollmentId: v.id("enrollments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.enrollmentId, {
      status: "suppressed"
    });
    return null;
  }
});

export const markEnrollmentFailed = internalMutation({
  args: {
    enrollmentId: v.id("enrollments"),
    error: v.string()
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.enrollmentId, {
      status: "failed",
      last_error: args.error
    });
    return null;
  }
});

export const rescheduleEnrollment = internalMutation({
  args: {
    enrollmentId: v.id("enrollments"),
    nextRunAt: v.number()
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.enrollmentId, {
      next_run_at: args.nextRunAt
    });
    return null;
  }
});

export const recordMessageSent = internalMutation({
  args: {
    accountId: v.id("accounts"),
    enrollmentId: v.id("enrollments"),
    journeyId: v.id("journeys"),
    stage: v.number(),
    subject: v.string(),
    body: v.string(),
    resendMessageId: v.string(),
    personalizationSnapshot: v.any(),
    tags: v.any()
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Create message record
    await ctx.db.insert("messages", {
      account_id: args.accountId,
      enrollment_id: args.enrollmentId,
      journey_id: args.journeyId,
      stage: args.stage,
      subject: args.subject,
      body: args.body,
      status: "sent",
      resend_message_id: args.resendMessageId,
      sent_at: Date.now(),
      retry_count: 0,
      personalization_snapshot: args.personalizationSnapshot,
      tags: args.tags,
      has_metadata: !!args.tags
    });

    // Update enrollment
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) return null;

    const isLastStage = args.stage >= enrollment.stages_snapshot.length - 1;

    await ctx.db.patch(args.enrollmentId, {
      status: isLastStage ? "completed" : "active",
      current_stage: args.stage + 1,
      next_run_at: isLastStage
        ? Date.now()
        : Date.now() + getDayOffset(enrollment.stages_snapshot[args.stage + 1].day - enrollment.stages_snapshot[args.stage].day)
    });

    return null;
  }
});
