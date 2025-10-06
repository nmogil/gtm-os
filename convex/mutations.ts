import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { validateJourneyTemplates } from "./lib/templates";
import { APIError } from "./lib/errors";
import { createEnrollmentIdempotent } from "./lib/idempotency";
import { validateEmail } from "./lib/validation";
import { Id } from "./_generated/dataModel";

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

/**
 * Create webhook event record (with idempotency)
 * PRD Reference: Section 5.3 - Webhook Processing
 */
export const createWebhookEvent = mutation({
  args: {
    account_id: v.id("accounts"),
    resend_event_id: v.string(),
    event_type: v.string(),
    contact_email: v.string(),
    message_id: v.optional(v.string()),
    enrollment_id: v.optional(v.string()),
    payload: v.any()
  },
  returns: v.object({
    webhook_event_id: v.id("webhook_events"),
    duplicate: v.boolean()
  }),
  handler: async (ctx, args) => {
    // Check for duplicate event (idempotency)
    const existing = await ctx.db
      .query("webhook_events")
      .withIndex("by_resend_event_id", (q) =>
        q.eq("resend_event_id", args.resend_event_id)
      )
      .first();

    if (existing) {
      return { webhook_event_id: existing._id, duplicate: true };
    }

    // Create new webhook event record
    const webhookEventId = await ctx.db.insert("webhook_events", {
      account_id: args.account_id,
      resend_event_id: args.resend_event_id,
      event_type: args.event_type,
      contact_email: args.contact_email,
      message_id: args.message_id,
      enrollment_id: args.enrollment_id,
      payload: args.payload,
      processed: false,
      retry_count: 0,
      created_at: Date.now()
    });

    return { webhook_event_id: webhookEventId, duplicate: false };
  }
});

/**
 * Process webhook event and update relevant records
 * PRD Reference: Section 5.3 - Webhook Processing
 */
export const processWebhookEvent = mutation({
  args: {
    webhook_event_id: v.id("webhook_events")
  },
  returns: v.object({
    processed: v.boolean(),
    actions: v.array(v.string())
  }),
  handler: async (ctx, args) => {
    const webhookEvent = await ctx.db.get(args.webhook_event_id);

    if (!webhookEvent || webhookEvent.processed) {
      return { processed: false, actions: [] };
    }

    const { event_type, payload } = webhookEvent;
    const actions: Array<string> = [];

    // Extract data from payload
    const emailId = payload.data?.email_id;
    const emailData = payload.data;

    switch (event_type) {
      case "email.sent":
        if (emailId) {
          const message = await ctx.db
            .query("messages")
            .withIndex("by_resend_message_id", (q) =>
              q.eq("resend_message_id", emailId)
            )
            .first();

          if (message) {
            await ctx.db.patch(message._id, {
              status: "sent",
              delivery_status: "sent",
              sent_at: new Date(emailData.created_at).getTime()
            });
            actions.push("message_status_updated");
          }
        }
        break;

      case "email.delivered":
        if (emailId) {
          const message = await ctx.db
            .query("messages")
            .withIndex("by_resend_message_id", (q) =>
              q.eq("resend_message_id", emailId)
            )
            .first();

          if (message) {
            await ctx.db.patch(message._id, {
              delivery_status: "delivered",
              delivered_at: new Date(emailData.created_at).getTime()
            });
            actions.push("delivery_confirmed");
          }
        }
        break;

      case "email.bounced":
        await handleBounce(ctx, webhookEvent, emailData);
        actions.push("bounce_processed");
        break;

      case "email.complained":
        await handleComplaint(ctx, webhookEvent, emailData);
        actions.push("complaint_processed");
        break;

      case "email.opened":
        const enrollmentIdOpen = emailData.headers?.['"X-Enrollment-ID"'] ||
                                emailData.headers?.["X-Enrollment-ID"];
        const journeyIdOpen = emailData.headers?.['"X-Journey-ID"'] ||
                             emailData.headers?.["X-Journey-ID"];
        const stageOpen = emailData.headers?.['"X-Stage"'] ||
                         emailData.headers?.["X-Stage"];

        await ctx.db.insert("events", {
          account_id: webhookEvent.account_id,
          contact_email: webhookEvent.contact_email,
          enrollment_id: enrollmentIdOpen,
          journey_id: journeyIdOpen,
          event_type: "open",
          metadata: {
            opened_at: emailData.created_at,
            stage: stageOpen ? parseInt(stageOpen) : undefined
          },
          timestamp: Date.now()
        });
        actions.push("open_tracked");
        break;

      case "email.clicked":
        const enrollmentIdClick = emailData.headers?.['"X-Enrollment-ID"'] ||
                                 emailData.headers?.["X-Enrollment-ID"];
        const journeyIdClick = emailData.headers?.['"X-Journey-ID"'] ||
                              emailData.headers?.["X-Journey-ID"];
        const stageClick = emailData.headers?.['"X-Stage"'] ||
                          emailData.headers?.["X-Stage"];

        await ctx.db.insert("events", {
          account_id: webhookEvent.account_id,
          contact_email: webhookEvent.contact_email,
          enrollment_id: enrollmentIdClick,
          journey_id: journeyIdClick,
          event_type: "click",
          metadata: {
            clicked_at: emailData.created_at,
            url: emailData.click?.link,
            stage: stageClick ? parseInt(stageClick) : undefined
          },
          timestamp: Date.now()
        });
        actions.push("click_tracked");
        break;
    }

    // Mark webhook event as processed
    await ctx.db.patch(webhookEvent._id, {
      processed: true,
      processed_at: Date.now()
    });

    return { processed: true, actions };
  }
});

/**
 * Helper function to handle bounce events
 */
async function handleBounce(ctx: any, webhookEvent: any, emailData: any) {
  const bounceType = emailData.bounce?.type || "soft";
  const emailId = emailData.email_id;

  // Update message record
  if (emailId) {
    const message = await ctx.db
      .query("messages")
      .withIndex("by_resend_message_id", (q) =>
        q.eq("resend_message_id", emailId)
      )
      .first();

    if (message) {
      await ctx.db.patch(message._id, {
        delivery_status: "bounced",
        bounce_type: bounceType === "hard" ? "hard" : "soft",
        error_detail: emailData.bounce?.reason
      });
    }
  }

  // Only create suppression for hard bounces
  if (bounceType === "hard") {
    // Create suppression
    await ctx.db.insert("suppressions", {
      account_id: webhookEvent.account_id,
      contact_email: webhookEvent.contact_email,
      journey_id: undefined,
      reason: "hard_bounce",
      metadata: { bounce_reason: emailData.bounce?.reason },
      created_at: Date.now()
    });

    // Stop all active enrollments for this email
    const enrollments = await ctx.db
      .query("enrollments")
      .filter((q) =>
        q.and(
          q.eq(q.field("contact_email"), webhookEvent.contact_email),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();

    for (const enrollment of enrollments) {
      await ctx.db.patch(enrollment._id, {
        status: "suppressed",
        last_error: "hard_bounce"
      });
    }
  }
}

/**
 * Helper function to handle spam complaint events
 */
async function handleComplaint(ctx: any, webhookEvent: any, emailData: any) {
  const emailId = emailData.email_id;

  // Update message record
  if (emailId) {
    const message = await ctx.db
      .query("messages")
      .withIndex("by_resend_message_id", (q) =>
        q.eq("resend_message_id", emailId)
      )
      .first();

    if (message) {
      await ctx.db.patch(message._id, {
        delivery_status: "complained",
        error_detail: "spam_complaint"
      });
    }
  }

  // Create global suppression for spam complaints
  await ctx.db.insert("suppressions", {
    account_id: webhookEvent.account_id,
    contact_email: webhookEvent.contact_email,
    journey_id: undefined, // Global suppression
    reason: "spam_complaint",
    metadata: { complaint_type: emailData.complaint?.type },
    created_at: Date.now()
  });

  // Stop ALL enrollments for this email (global suppression)
  const enrollments = await ctx.db
    .query("enrollments")
    .filter((q) =>
      q.and(
        q.eq(q.field("contact_email"), webhookEvent.contact_email),
        q.eq(q.field("status"), "active")
      )
    )
    .collect();

  for (const enrollment of enrollments) {
    await ctx.db.patch(enrollment._id, {
      status: "suppressed",
      last_error: "spam_complaint"
    });
  }
}

/**
 * Record event and handle conversion/unsubscribe logic
 * PRD Reference: Section 3.1 - POST /events
 */
export const recordEvent = mutation({
  args: {
    account_id: v.id("accounts"),
    type: v.union(
      v.literal("conversion"),
      v.literal("unsubscribe"),
      v.literal("open"),
      v.literal("click"),
      v.literal("custom")
    ),
    contact_email: v.string(),
    journey_id: v.optional(v.id("journeys")),
    enrollment_id: v.optional(v.id("enrollments")),
    metadata: v.optional(v.any())
  },
  returns: v.object({
    event_id: v.id("events"),
    accepted: v.boolean()
  }),
  handler: async (ctx, args) => {
    // Record event
    const eventId = await ctx.db.insert("events", {
      account_id: args.account_id,
      contact_email: args.contact_email,
      enrollment_id: args.enrollment_id,
      journey_id: args.journey_id,
      event_type: args.type,
      metadata: args.metadata,
      timestamp: Date.now()
    });

    // Handle conversion
    if (args.type === "conversion") {
      await handleConversionMutation(
        ctx,
        args.contact_email,
        args.journey_id,
        args.account_id
      );
    }

    // Handle unsubscribe
    if (args.type === "unsubscribe") {
      await handleUnsubscribeMutation(
        ctx,
        args.account_id,
        args.contact_email,
        args.journey_id
      );
    }

    return { event_id: eventId, accepted: true };
  }
});

/**
 * Helper: Handle conversion logic
 */
async function handleConversionMutation(
  ctx: any,
  contactEmail: string,
  journeyId: Id<"journeys"> | undefined,
  accountId: Id<"accounts">
) {
  // Build query for active enrollments
  const query = ctx.db
    .query("enrollments")
    .filter((q: any) =>
      q.and(
        q.eq(q.field("account_id"), accountId),
        q.eq(q.field("contact_email"), contactEmail),
        q.eq(q.field("status"), "active")
      )
    );

  // If journey_id specified, only stop enrollments in that journey
  let enrollments;
  if (journeyId) {
    enrollments = await query
      .filter((q: any) => q.eq(q.field("journey_id"), journeyId))
      .collect();
  } else {
    enrollments = await query.collect();
  }

  // Stop all matching active enrollments
  for (const enrollment of enrollments) {
    await ctx.db.patch(enrollment._id, {
      status: "converted"
    });
  }

  // Update journey stats if journey specified
  if (journeyId) {
    const journey = await ctx.db.get(journeyId);
    if (journey) {
      await ctx.db.patch(journeyId, {
        stats: {
          ...journey.stats,
          total_converted: journey.stats.total_converted + 1
        }
      });
    }
  }
}

/**
 * Helper: Handle unsubscribe logic
 */
async function handleUnsubscribeMutation(
  ctx: any,
  accountId: Id<"accounts">,
  contactEmail: string,
  journeyId: Id<"journeys"> | undefined
) {
  // Add to suppression list
  await ctx.db.insert("suppressions", {
    account_id: accountId,
    journey_id: journeyId, // undefined = global suppression
    contact_email: contactEmail,
    reason: "unsubscribe",
    metadata: { source: "api" },
    created_at: Date.now()
  });

  // Build query for active enrollments
  const query = ctx.db
    .query("enrollments")
    .filter((q: any) =>
      q.and(
        q.eq(q.field("account_id"), accountId),
        q.eq(q.field("contact_email"), contactEmail),
        q.eq(q.field("status"), "active")
      )
    );

  // If journey_id specified, only stop enrollments in that journey
  let enrollments;
  if (journeyId) {
    enrollments = await query
      .filter((q: any) => q.eq(q.field("journey_id"), journeyId))
      .collect();
  } else {
    enrollments = await query.collect();
  }

  // Stop all matching enrollments
  for (const enrollment of enrollments) {
    await ctx.db.patch(enrollment._id, {
      status: "removed",
      last_error: "unsubscribed"
    });
  }
}
