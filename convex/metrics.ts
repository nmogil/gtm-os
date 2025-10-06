import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Metrics collection for monitoring system health
 * PRD Reference: Section 11.2 - Critical Monitoring
 */

interface Metrics {
  // Sending metrics
  send_success_rate: number;
  messages_sent_24h: number;

  // Delivery metrics
  delivery_rate: number;
  bounce_rate: number;
  complaint_rate: number;

  // Engagement metrics
  open_rate: number;
  click_rate: number;
  conversion_rate: number;

  // Webhook metrics
  webhook_success_rate: number;
  webhook_lag: number;

  // Suppression metrics
  suppression_rate: number;
  suppression_by_reason: Record<string, number>;

  // System health
  active_enrollments_count: number;
  failed_enrollments_24h: number;
  error_rate: number;
}

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

    const metrics: Metrics = {
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

    return metrics;
  }
});

export const collectAndLogMetrics = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const metrics = await ctx.runQuery(internal.metrics.collectMetrics, {});

    // Log metrics in structured JSON format for monitoring tools
    console.log(JSON.stringify({
      timestamp: Date.now(),
      type: "metrics",
      metrics
    }));

    return null;
  }
});
