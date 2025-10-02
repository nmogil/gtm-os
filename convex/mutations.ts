import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { validateJourneyTemplates } from "./lib/templates";
import { APIError } from "./lib/errors";
import { createEnrollmentIdempotent } from "./lib/idempotency";
import { validateEmail } from "./lib/validation";

export const storeEncryptedResendApiKey = mutation({
  args: {
    account_id: v.id("accounts"),
    encrypted_key: v.string()
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.account_id, {
      resend_api_key_encrypted: args.encrypted_key
    });

    return { success: true };
  }
});

export const createJourneyFromGenerated = mutation({
  args: {
    account_id: v.id("accounts"),
    goal: v.string(),
    audience: v.string(),
    journey: v.object({
      name: v.string(),
      stages: v.array(v.object({
        day: v.number(),
        subject: v.string(),
        body: v.string()
      }))
    }),
    default_reply_to: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // Validate templates
    const validation = validateJourneyTemplates(args.journey.stages);
    if (!validation.valid) {
      throw new APIError(
        "llm_generation_failed",
        "Generated journey has invalid templates",
        { errors: validation.errors },
        500
      );
    }

    // Create journey record
    const journeyId = await ctx.db.insert("journeys", {
      account_id: args.account_id,
      name: args.journey.name,
      goal: args.goal,
      audience: args.audience,
      stages: args.journey.stages,
      is_active: true,
      default_reply_to: args.default_reply_to,
      stats: {
        total_enrolled: 0,
        total_completed: 0,
        total_converted: 0,
        total_bounced: 0,
        total_complained: 0,
        open_rate: 0,
        click_rate: 0
      },
      created_at: Date.now()
    });

    return { journeyId };
  }
});

export const createEnrollment = mutation({
  args: {
    account_id: v.id("accounts"),
    journey_id: v.id("journeys"),
    contact: v.object({
      email: v.string(),
      data: v.optional(v.any())
    }),
    options: v.optional(v.object({
      test_mode: v.optional(v.boolean()),
      start_at: v.optional(v.number()),
      reply_to: v.optional(v.string()),
      tags: v.optional(v.any()),
      headers: v.optional(v.any())
    })),
    idempotency_key: v.optional(v.string())
  },
  returns: v.object({
    enrollment: v.any(),
    existing: v.boolean()
  }),
  handler: async (ctx, args) => {
    // Validate email
    const emailValidation = validateEmail(args.contact.email);
    if (!emailValidation.valid) {
      throw new APIError(
        "invalid_email",
        emailValidation.error || "Invalid email address",
        { email: args.contact.email },
        400
      );
    }

    // Check suppression list
    const suppressed = await ctx.db
      .query("suppressions")
      .withIndex("by_email_expires", (q) => q.eq("contact_email", args.contact.email))
      .first();

    if (suppressed && (!suppressed.expires_at || suppressed.expires_at > Date.now())) {
      throw new APIError(
        "contact_suppressed",
        "Contact is on suppression list",
        {
          email: args.contact.email,
          reason: suppressed.reason,
          suppressed_at: suppressed.created_at
        },
        400
      );
    }

    // Create enrollment idempotently
    const { enrollment, existing } = await createEnrollmentIdempotent(ctx, {
      account_id: args.account_id,
      journey_id: args.journey_id,
      contact_email: args.contact.email,
      contact_data: args.contact.data || {},
      idempotency_key: args.idempotency_key
    });

    // Update with options if new enrollment
    if (!existing && args.options) {
      await ctx.db.patch(enrollment._id, {
        test_mode: args.options.test_mode || false,
        next_run_at: args.options.start_at || Date.now(),
        reply_to: args.options.reply_to,
        tags: args.options.tags,
        custom_headers: args.options.headers
      });

      // Re-fetch enrollment to get updated fields
      const updatedEnrollment = await ctx.db.get(enrollment._id);
      return { enrollment: updatedEnrollment!, existing };
    }

    return { enrollment, existing };
  }
});

export const deleteEnrollmentsByEmail = mutation({
  args: {
    email_pattern: v.string()
  },
  returns: v.object({
    deleted_count: v.number()
  }),
  handler: async (ctx, args) => {
    // Find all enrollments with emails matching the pattern
    const allEnrollments = await ctx.db
      .query("enrollments")
      .collect();

    let deletedCount = 0;
    for (const enrollment of allEnrollments) {
      if (enrollment.contact_email.includes(args.email_pattern)) {
        await ctx.db.delete(enrollment._id);
        deletedCount++;
      }
    }

    return { deleted_count: deletedCount };
  }
});

export const updateEnrollment = mutation({
  args: {
    enrollment_id: v.id("enrollments"),
    test_mode: v.optional(v.boolean()),
    next_run_at: v.optional(v.number()),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("converted"),
      v.literal("removed"),
      v.literal("failed"),
      v.literal("suppressed")
    ))
  },
  returns: v.object({
    success: v.boolean()
  }),
  handler: async (ctx, args) => {
    const updates: any = {};
    if (args.test_mode !== undefined) {
      updates.test_mode = args.test_mode;
    }
    if (args.next_run_at !== undefined) {
      updates.next_run_at = args.next_run_at;
    }
    if (args.status !== undefined) {
      updates.status = args.status;
    }

    await ctx.db.patch(args.enrollment_id, updates);
    return { success: true };
  }
});
