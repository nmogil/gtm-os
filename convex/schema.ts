import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  accounts: defineTable({
    name: v.string(),
    api_key: v.string(),
    resend_api_key_encrypted: v.optional(v.string()),
    resend_key_valid: v.optional(v.boolean()),
    plan: v.string(),
    limits: v.object({
      max_journeys: v.number(),
      max_active_enrollments: v.number(),
      max_enrollments_per_second: v.number()
    }),
    usage: v.object({
      journeys_created: v.number(),
      active_enrollments: v.number(),
      messages_sent_today: v.number()
    }),
    webhook_secret_encrypted: v.optional(v.string()),
    created_at: v.number()
  }),

  journeys: defineTable({
    account_id: v.id("accounts"),
    name: v.string(),
    version: v.optional(v.number()),
    goal: v.string(),
    audience: v.string(),
    stages: v.array(v.object({
      day: v.number(),
      subject: v.string(),
      body: v.string()
    })),
    is_active: v.boolean(),
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
  }).index("by_account", ["account_id"]),

  enrollments: defineTable({
    account_id: v.id("accounts"),
    journey_id: v.id("journeys"),
    journey_version: v.optional(v.number()),
    stages_snapshot: v.optional(v.array(v.object({
      day: v.number(),
      subject: v.string(),
      body: v.string()
    }))),
    contact_email: v.string(),
    contact_data: v.any(),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("converted"),
      v.literal("removed"),
      v.literal("failed"),
      v.literal("suppressed")
    ),
    current_stage: v.number(),
    next_run_at: v.number(),
    enrolled_at: v.number(),
    test_mode: v.boolean(),
    retry_count: v.number(),
    last_error: v.optional(v.string()),
    reply_to: v.optional(v.string()),
    tags: v.optional(v.any()),
    custom_headers: v.optional(v.any())
  })
    .index("by_account", ["account_id"])
    .index("by_journey", ["journey_id"])
    .index("by_status", ["status"])
    .index("by_next_run_at", ["next_run_at"])
    .index("by_account_journey_email", ["account_id", "journey_id", "contact_email"]),

  messages: defineTable({
    account_id: v.id("accounts"),
    enrollment_id: v.id("enrollments"),
    journey_id: v.id("journeys"),
    stage: v.number(),
    subject: v.string(),
    body: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("test")
    ),
    resend_message_id: v.optional(v.string()),
    delivery_status: v.optional(v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("delayed")
    )),
    bounce_type: v.optional(v.union(v.literal("hard"), v.literal("soft"))),
    sent_at: v.optional(v.number()),
    delivered_at: v.optional(v.number()),
    retry_count: v.number(),
    error_detail: v.optional(v.string()),
    personalization_snapshot: v.optional(v.any()),
    tags: v.optional(v.any()),
    has_metadata: v.boolean()
  })
    .index("by_enrollment", ["enrollment_id"])
    .index("by_journey", ["journey_id"])
    .index("by_resend_message_id", ["resend_message_id"]),

  events: defineTable({
    account_id: v.id("accounts"),
    contact_email: v.string(),
    enrollment_id: v.optional(v.id("enrollments")),
    journey_id: v.optional(v.id("journeys")),
    event_type: v.union(
      v.literal("conversion"),
      v.literal("unsubscribe"),
      v.literal("open"),
      v.literal("click"),
      v.literal("custom")
    ),
    metadata: v.optional(v.any()),
    timestamp: v.number()
  })
    .index("by_account_email", ["account_id", "contact_email"])
    .index("by_enrollment", ["enrollment_id"])
    .index("by_journey", ["journey_id"]),

  suppressions: defineTable({
    account_id: v.id("accounts"),
    journey_id: v.optional(v.id("journeys")),
    contact_email: v.string(),
    reason: v.union(
      v.literal("hard_bounce"),
      v.literal("soft_bounce"),
      v.literal("spam_complaint"),
      v.literal("unsubscribe"),
      v.literal("manual")
    ),
    metadata: v.optional(v.any()),
    expires_at: v.optional(v.number()),
    created_at: v.number()
  })
    .index("by_journey_email", ["journey_id", "contact_email"])
    .index("by_email_expires", ["contact_email", "expires_at"])
    .index("by_account_and_reason", ["account_id", "reason"]),

  webhook_events: defineTable({
    account_id: v.id("accounts"),
    resend_event_id: v.string(),
    event_type: v.string(),
    contact_email: v.string(),
    message_id: v.optional(v.string()),
    enrollment_id: v.optional(v.string()),
    payload: v.any(),
    processed: v.boolean(),
    processed_at: v.optional(v.number()),
    retry_count: v.number(),
    last_error: v.optional(v.string()),
    created_at: v.number()
  })
    .index("by_resend_event_id", ["resend_event_id"])
    .index("by_processed", ["processed"])
    .index("by_account", ["account_id"])
});
