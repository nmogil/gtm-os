import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Metrics collection for monitoring system health
 * PRD Reference: Section 11.2 - Critical Monitoring
 * Note: collectMetrics query moved to queries.ts to avoid Node.js runtime conflicts
 */

export const collectAndLogMetrics = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const metrics = await ctx.runQuery(internal.queries.collectMetrics, {});

    // Log metrics in structured JSON format for monitoring tools
    console.log(JSON.stringify({
      timestamp: Date.now(),
      type: "metrics",
      metrics
    }));

    return null;
  }
});
