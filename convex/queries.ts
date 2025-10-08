import { query, internalQuery } from "./_generated/server";
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

export const getAllWebhookEvents = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    return await ctx.db
      .query("webhook_events")
      .order("desc")
      .take(10);
  }
});

export const getWebhookEventsByAccount = query({
  args: { account_id: v.id("accounts") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhook_events")
      .withIndex("by_account", (q) => q.eq("account_id", args.account_id))
      .order("desc")
      .take(10);
  }
});

export const getMessageByResendId = query({
  args: { resend_message_id: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_resend_message_id", (q) =>
        q.eq("resend_message_id", args.resend_message_id))
      .first();
  }
});

export const getJourneyAnalytics = query({
  args: {
    journey_id: v.id("journeys"),
    account_id: v.id("accounts")
  },
  returns: v.union(
    v.object({
      journey_id: v.id("journeys"),
      journey_name: v.string(),
      total_enrolled: v.number(),
      completed: v.number(),
      converted: v.number(),
      active: v.number(),
      suppressed: v.number(),
      engagement: v.object({
        open_rate: v.number(),
        click_rate: v.number(),
        bounce_rate: v.number(),
        complaint_rate: v.number(),
        conversion_rate: v.number()
      }),
      by_stage: v.array(v.object({
        stage: v.number(),
        day: v.number(),
        subject: v.string(),
        sent: v.number(),
        delivered: v.number(),
        opened: v.number(),
        clicked: v.number(),
        bounced: v.number(),
        open_rate: v.number(),
        click_rate: v.number()
      }))
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Fetch journey and verify it belongs to account
    const journey = await ctx.db.get(args.journey_id);
    if (!journey || journey.account_id !== args.account_id) {
      return null;
    }

    // Get all enrollments for this journey
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_journey", (q) => q.eq("journey_id", args.journey_id))
      .collect();

    const total_enrolled = enrollments.length;
    const completed = enrollments.filter((e) => e.status === "completed").length;
    const converted = enrollments.filter((e) => e.status === "converted").length;
    const active = enrollments.filter((e) => e.status === "active").length;
    const suppressed = enrollments.filter((e) => e.status === "suppressed").length;

    // Get all messages for this journey
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_journey", (q) => q.eq("journey_id", args.journey_id))
      .collect();

    const sent = messages.filter((m) => m.status === "sent").length;
    const delivered = messages.filter((m) => m.delivery_status === "delivered").length;
    const bounced = messages.filter((m) => m.delivery_status === "bounced").length;
    const complained = messages.filter((m) => m.delivery_status === "complained").length;

    // Get all events for this journey
    const events = await ctx.db
      .query("events")
      .withIndex("by_journey", (q) => q.eq("journey_id", args.journey_id))
      .collect();

    const opens = events.filter((e) => e.event_type === "open").length;
    const clicks = events.filter((e) => e.event_type === "click").length;

    // Calculate engagement rates
    const open_rate = delivered > 0 ? opens / delivered : 0;
    const click_rate = delivered > 0 ? clicks / delivered : 0;
    const bounce_rate = sent > 0 ? bounced / sent : 0;
    const complaint_rate = sent > 0 ? complained / sent : 0;
    const conversion_rate = total_enrolled > 0 ? converted / total_enrolled : 0;

    // Calculate by-stage metrics
    const by_stage = journey.stages.map((stage, index) => {
      const stageMessages = messages.filter((m) => m.stage === index);
      const stageSent = stageMessages.length;
      const stageDelivered = stageMessages.filter(
        (m) => m.delivery_status === "delivered"
      ).length;
      const stageBounced = stageMessages.filter(
        (m) => m.delivery_status === "bounced"
      ).length;

      const stageEvents = events.filter(
        (e) => e.metadata?.stage === String(index)
      );
      const stageOpens = stageEvents.filter((e) => e.event_type === "open").length;
      const stageClicks = stageEvents.filter((e) => e.event_type === "click").length;

      return {
        stage: index,
        day: stage.day,
        subject: stage.subject,
        sent: stageSent,
        delivered: stageDelivered,
        opened: stageOpens,
        clicked: stageClicks,
        bounced: stageBounced,
        open_rate: stageDelivered > 0 ? stageOpens / stageDelivered : 0,
        click_rate: stageDelivered > 0 ? stageClicks / stageDelivered : 0
      };
    });

    return {
      journey_id: args.journey_id,
      journey_name: journey.name,
      total_enrolled,
      completed,
      converted,
      active,
      suppressed,
      engagement: {
        open_rate,
        click_rate,
        bounce_rate,
        complaint_rate,
        conversion_rate
      },
      by_stage
    };
  }
});

export const getEnrollmentTimeline = query({
  args: {
    enrollment_id: v.id("enrollments"),
    account_id: v.id("accounts")
  },
  returns: v.union(
    v.object({
      enrollment_id: v.id("enrollments"),
      contact_email: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("converted"),
        v.literal("removed"),
        v.literal("failed"),
        v.literal("suppressed")
      ),
      enrolled_at: v.number(),
      timeline: v.array(v.union(
        v.object({
          type: v.literal("message"),
          timestamp: v.number(),
          stage: v.number(),
          subject: v.string(),
          status: v.union(
            v.literal("queued"),
            v.literal("sent"),
            v.literal("failed"),
            v.literal("test")
          ),
          delivery_status: v.optional(v.union(
            v.literal("sent"),
            v.literal("delivered"),
            v.literal("bounced"),
            v.literal("complained"),
            v.literal("delayed")
          ))
        }),
        v.object({
          type: v.literal("event"),
          timestamp: v.number(),
          event_type: v.union(
            v.literal("conversion"),
            v.literal("unsubscribe"),
            v.literal("open"),
            v.literal("click"),
            v.literal("custom")
          ),
          metadata: v.optional(v.any())
        })
      ))
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Fetch enrollment and verify it belongs to account
    const enrollment = await ctx.db.get(args.enrollment_id);
    if (!enrollment || enrollment.account_id !== args.account_id) {
      return null;
    }

    // Get all messages for this enrollment
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_enrollment", (q) => q.eq("enrollment_id", args.enrollment_id))
      .collect();

    // Get all events for this enrollment
    const events = await ctx.db
      .query("events")
      .withIndex("by_enrollment", (q) => q.eq("enrollment_id", args.enrollment_id))
      .collect();

    // Create timeline entries from messages
    const messageEntries = messages.map((m) => ({
      type: "message" as const,
      timestamp: m.sent_at || m._creationTime,
      stage: m.stage,
      subject: m.subject,
      status: m.status,
      delivery_status: m.delivery_status
    }));

    // Create timeline entries from events
    const eventEntries = events.map((e) => ({
      type: "event" as const,
      timestamp: e.timestamp,
      event_type: e.event_type,
      metadata: e.metadata
    }));

    // Merge and sort chronologically
    const timeline = [...messageEntries, ...eventEntries].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    return {
      enrollment_id: args.enrollment_id,
      contact_email: enrollment.contact_email,
      status: enrollment.status,
      enrolled_at: enrollment.enrolled_at,
      timeline
    };
  }
});

export const getSuppressions = query({
  args: {
    account_id: v.id("accounts"),
    journey_id: v.optional(v.id("journeys")),
    reason: v.optional(v.union(
      v.literal("hard_bounce"),
      v.literal("soft_bounce"),
      v.literal("spam_complaint"),
      v.literal("unsubscribe"),
      v.literal("manual")
    ))
  },
  returns: v.object({
    data: v.array(v.object({
      email: v.string(),
      reason: v.union(
        v.literal("hard_bounce"),
        v.literal("soft_bounce"),
        v.literal("spam_complaint"),
        v.literal("unsubscribe"),
        v.literal("manual")
      ),
      journey_id: v.optional(v.id("journeys")),
      metadata: v.optional(v.any()),
      created_at: v.number(),
      expires_at: v.optional(v.number())
    })),
    total: v.number()
  }),
  handler: async (ctx, args) => {
    // Start with base query by account
    let suppressions;

    if (args.journey_id && args.reason) {
      // Filter by both journey_id and reason (no single index, use filter)
      suppressions = await ctx.db
        .query("suppressions")
        .filter((q) =>
          q.and(
            q.eq(q.field("account_id"), args.account_id),
            q.eq(q.field("journey_id"), args.journey_id),
            q.eq(q.field("reason"), args.reason)
          )
        )
        .collect();
    } else if (args.journey_id) {
      // Filter by journey_id only
      suppressions = await ctx.db
        .query("suppressions")
        .filter((q) =>
          q.and(
            q.eq(q.field("account_id"), args.account_id),
            q.eq(q.field("journey_id"), args.journey_id)
          )
        )
        .collect();
    } else if (args.reason) {
      // Use the by_account_and_reason index
      suppressions = await ctx.db
        .query("suppressions")
        .withIndex("by_account_and_reason", (q) =>
          q.eq("account_id", args.account_id).eq("reason", args.reason)
        )
        .collect();
    } else {
      // No filters, just account
      suppressions = await ctx.db
        .query("suppressions")
        .filter((q) => q.eq(q.field("account_id"), args.account_id))
        .collect();
    }

    return {
      data: suppressions.map((s) => ({
        email: s.contact_email,
        reason: s.reason,
        journey_id: s.journey_id,
        metadata: s.metadata,
        created_at: s.created_at,
        expires_at: s.expires_at
      })),
      total: suppressions.length
    };
  }
});

// ===== MONITORING QUERIES (Issue #15) =====

export const getActiveEnrollmentsCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const active = await ctx.db
      .query("enrollments")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    return active.length;
  }
});

export const getPendingSendsCount = query({
  args: { timestamp: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("enrollments")
      .withIndex("by_next_run_at")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          q.lte(q.field("next_run_at"), args.timestamp)
        )
      )
      .collect();
    return pending.length;
  }
});

export const getErrorMetrics = query({
  args: {},
  returns: v.object({
    error_rate: v.number(),
    failed_24h: v.number(),
    webhook_lag: v.number()
  }),
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Get recent messages
    const recentMessages = await ctx.db
      .query("messages")
      .filter((q) => q.gte(q.field("_creationTime"), oneDayAgo))
      .collect();

    const total = recentMessages.length;
    const failed = recentMessages.filter((m) => m.status === "failed").length;
    const error_rate = total > 0 ? failed / total : 0;

    // Get failed enrollments in last 24h
    const failedEnrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .filter((q) => q.gte(q.field("_creationTime"), oneDayAgo))
      .collect();

    // Get unprocessed webhooks older than 1 minute
    const unprocessedWebhooks = await ctx.db
      .query("webhook_events")
      .withIndex("by_processed", (q) => q.eq("processed", false))
      .filter((q) => q.lte(q.field("_creationTime"), Date.now() - 60000))
      .collect();

    return {
      error_rate,
      failed_24h: failedEnrollments.length,
      webhook_lag: unprocessedWebhooks.length
    };
  }
});

/**
 * Get journey by ID with account authorization check
 * Used by GET /journeys/:id endpoint (Issue #26)
 */
export const getJourneyById = query({
  args: {
    journey_id: v.id("journeys"),
    account_id: v.id("accounts")
  },
  returns: v.union(
    v.object({
      _id: v.id("journeys"),
      _creationTime: v.number(),
      account_id: v.id("accounts"),
      name: v.string(),
      goal: v.string(),
      audience: v.string(),
      stages: v.array(v.object({
        day: v.number(),
        subject: v.string(),
        body: v.string()
      })),
      is_active: v.boolean(),
      version: v.optional(v.number()),
      default_reply_to: v.optional(v.string()),
      default_tags: v.optional(v.any()),
      stats: v.object({
        total_enrolled: v.number(),
        total_completed: v.number(),
        total_converted: v.number(),
        total_bounced: v.number(),
        total_complained: v.number(),
        open_rate: v.number(),
        click_rate: v.number()
      }),
      created_at: v.number(),
      updated_at: v.optional(v.number())
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const journey = await ctx.db.get(args.journey_id);

    // Return null if not found
    if (!journey) {
      return null;
    }

    // Check authorization - journey must belong to the account
    if (journey.account_id !== args.account_id) {
      return null;
    }

    // Calculate real-time stats by counting enrollments and messages
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_journey", (q) => q.eq("journey_id", args.journey_id))
      .collect();

    const total_enrolled = enrollments.length;
    const total_completed = enrollments.filter((e) => e.status === "completed").length;
    const total_converted = enrollments.filter((e) => e.status === "converted").length;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_journey", (q) => q.eq("journey_id", args.journey_id))
      .collect();

    const sent = messages.filter((m) => m.status === "sent").length;
    const delivered = messages.filter((m) => m.delivery_status === "delivered").length;
    const total_bounced = messages.filter((m) => m.delivery_status === "bounced").length;
    const total_complained = messages.filter((m) => m.delivery_status === "complained").length;

    const events = await ctx.db
      .query("events")
      .withIndex("by_journey", (q) => q.eq("journey_id", args.journey_id))
      .collect();

    const opens = events.filter((e) => e.event_type === "open").length;
    const clicks = events.filter((e) => e.event_type === "click").length;

    const open_rate = delivered > 0 ? opens / delivered : 0;
    const click_rate = delivered > 0 ? clicks / delivered : 0;

    return {
      _id: journey._id,
      _creationTime: journey._creationTime,
      account_id: journey.account_id,
      name: journey.name,
      goal: journey.goal,
      audience: journey.audience,
      stages: journey.stages,
      is_active: journey.is_active,
      version: journey.version,
      default_reply_to: journey.default_reply_to,
      default_tags: journey.default_tags,
      created_at: journey._creationTime,
      updated_at: journey.updated_at,
      stats: {
        total_enrolled,
        total_completed,
        total_converted,
        total_bounced,
        total_complained,
        open_rate,
        click_rate
      }
    };
  }
});

/**
 * Collect comprehensive system metrics for monitoring
 * PRD Reference: Section 11.2 - Critical Monitoring
 * Moved from metrics.ts to avoid Node.js runtime conflicts (Issue #26 deployment blocker)
 */
export const collectMetrics = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Sending metrics
    const messages = await ctx.db
      .query("messages")
      .filter((q) => q.gte(q.field("_creationTime"), oneDayAgo))
      .collect();

    const totalMessages = messages.length;
    const sentMessages = messages.filter((m) => m.status === "sent").length;
    const failedMessages = messages.filter((m) => m.status === "failed").length;
    const send_success_rate = totalMessages > 0 ? sentMessages / totalMessages : 0;
    const error_rate = totalMessages > 0 ? failedMessages / totalMessages : 0;

    // Delivery metrics
    const deliveredMessages = messages.filter((m) => m.delivery_status === "delivered").length;
    const bouncedMessages = messages.filter((m) => m.delivery_status === "bounced").length;
    const complainedMessages = messages.filter((m) => m.delivery_status === "complained").length;

    const delivery_rate = sentMessages > 0 ? deliveredMessages / sentMessages : 0;
    const bounce_rate = sentMessages > 0 ? bouncedMessages / sentMessages : 0;
    const complaint_rate = sentMessages > 0 ? complainedMessages / sentMessages : 0;

    // Events for engagement metrics
    const events = await ctx.db
      .query("events")
      .filter((q) => q.gte(q.field("timestamp"), oneDayAgo))
      .collect();

    const opens = events.filter((e) => e.event_type === "open").length;
    const clicks = events.filter((e) => e.event_type === "click").length;
    const conversions = events.filter((e) => e.event_type === "conversion").length;

    const open_rate = deliveredMessages > 0 ? opens / deliveredMessages : 0;
    const click_rate = deliveredMessages > 0 ? clicks / deliveredMessages : 0;

    // Enrollments for conversion rate
    const enrollments = await ctx.db
      .query("enrollments")
      .filter((q) => q.gte(q.field("enrolled_at"), oneDayAgo))
      .collect();

    const totalEnrolled = enrollments.length;
    const conversion_rate = totalEnrolled > 0 ? conversions / totalEnrolled : 0;

    // Webhook metrics
    const webhooks = await ctx.db
      .query("webhook_events")
      .filter((q) => q.gte(q.field("_creationTime"), oneDayAgo))
      .collect();

    const processedWebhooks = webhooks.filter((w) => w.processed).length;
    const webhook_success_rate = webhooks.length > 0 ? processedWebhooks / webhooks.length : 0;

    // Webhook lag (unprocessed events older than 1 minute)
    const unprocessedWebhooks = await ctx.db
      .query("webhook_events")
      .withIndex("by_processed", (q) => q.eq("processed", false))
      .filter((q) => q.lte(q.field("_creationTime"), Date.now() - 60000))
      .collect();

    const webhook_lag = unprocessedWebhooks.length;

    // Suppression metrics
    const suppressions = await ctx.db
      .query("suppressions")
      .filter((q) => q.gte(q.field("created_at"), oneDayAgo))
      .collect();

    const suppression_by_reason: Record<string, number> = {};
    suppressions.forEach((s) => {
      suppression_by_reason[s.reason] = (suppression_by_reason[s.reason] || 0) + 1;
    });

    const suppression_rate = totalMessages > 0 ? suppressions.length / totalMessages : 0;

    // Active enrollments
    const activeEnrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Failed enrollments in last 24h
    const failedEnrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .filter((q) => q.gte(q.field("_creationTime"), oneDayAgo))
      .collect();

    return {
      send_success_rate,
      messages_sent_24h: sentMessages,
      delivery_rate,
      bounce_rate,
      complaint_rate,
      open_rate,
      click_rate,
      conversion_rate,
      webhook_success_rate,
      webhook_lag,
      suppression_rate,
      suppression_by_reason,
      active_enrollments_count: activeEnrollments.length,
      failed_enrollments_24h: failedEnrollments.length,
      error_rate
    };
  }
});
