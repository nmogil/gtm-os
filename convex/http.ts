import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { authenticatedAction } from "./lib/httpAuth";
import { errorResponse } from "./lib/errors";
import { api, internal } from "./_generated/api";
import { handleResendWebhook } from "./webhooks";
import { Id } from "./_generated/dataModel";

/**
 * HTTP endpoints for GTM OS
 * PRD Reference: Section 9 - API Endpoints
 */
const http = httpRouter();

// Enhanced health check endpoint with metrics (Issue #15)
http.route({
  path: "/health",
  method: "GET",
  handler: authenticatedAction(async (ctx, request, account) => {
    const now = Date.now();

    // Get active enrollments count
    const activeEnrollments = await ctx.runQuery(
      api.queries.getActiveEnrollmentsCount,
      {}
    );

    // Get pending sends count
    const pendingSends = await ctx.runQuery(
      api.queries.getPendingSendsCount,
      { timestamp: now }
    );

    // Get error metrics
    const errorMetrics = await ctx.runQuery(
      api.queries.getErrorMetrics,
      {}
    );

    return new Response(
      JSON.stringify({
        status: "ok",
        timestamp: now,
        account_id: account._id,
        metrics: {
          active_enrollments: activeEnrollments,
          pending_sends: pendingSends,
          error_rate: errorMetrics.error_rate,
          failed_enrollments_24h: errorMetrics.failed_24h,
          webhook_processing_lag: errorMetrics.webhook_lag
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  })
});

// Create journey endpoint (PRD Section 3.1, 9.1)
// Supports both AI-generated and manual journey creation
http.route({
  path: "/journeys",
  method: "POST",
  handler: authenticatedAction(async (ctx, request, account) => {
    const body = await request.json();

    // Detect mode: if 'stages' is provided -> manual mode, else -> AI mode
    const isManualMode = body.stages && Array.isArray(body.stages);

    if (isManualMode) {
      // Manual journey creation
      if (!body.name) {
        return errorResponse(
          "invalid_request",
          "Missing required field: name",
          {},
          400
        );
      }

      if (!body.stages || body.stages.length === 0) {
        return errorResponse(
          "invalid_request",
          "Missing required field: stages (must be non-empty array)",
          {},
          400
        );
      }

      // Create manual journey (via mutation)
      let result;
      try {
        result = await ctx.runMutation(api.mutations.createManualJourney, {
          account_id: account._id,
          name: body.name,
          goal: body.goal,
          audience: body.audience,
          stages: body.stages,
          default_reply_to: body.options?.default_reply_to,
          default_tags: body.options?.default_tags
        });
      } catch (error: any) {
        // Handle APIError from mutation
        console.error("Manual journey creation error:", error);

        // Convex wraps errors, check both error.data and direct properties
        const errorData = error.data || error;
        const code = errorData.code || "invalid_request";
        const message = errorData.message || error.message || "Failed to create journey";
        const details = errorData.details || {};
        const statusCode = errorData.statusCode || 400;

        return errorResponse(code, message, details, statusCode);
      }

      return new Response(
        JSON.stringify({
          journey_id: result.journeyId,
          name: body.name,
          mode: "manual",
          stages: body.stages
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } else {
      // AI-generated journey (existing logic)
      if (!body.goal || !body.audience) {
        return errorResponse(
          "invalid_request",
          "Missing required fields: goal and audience",
          {},
          400
        );
      }

      const emailCount = body.options?.emails || 5;

      // Generate journey with AI (via action)
      const { journey, usedFallback } = await ctx.runAction(api.actions.generateJourneyAction, {
        goal: body.goal,
        audience: body.audience,
        emailCount: emailCount
      });

      // Create journey record (via mutation)
      const result = await ctx.runMutation(api.mutations.createJourneyFromGenerated, {
        account_id: account._id,
        goal: body.goal,
        audience: body.audience,
        journey: journey,
        default_reply_to: body.options?.default_reply_to
      });

      return new Response(
        JSON.stringify({
          journey_id: result.journeyId,
          name: journey.name,
          mode: "ai",
          default_reply_to: body.options?.default_reply_to,
          stages: journey.stages
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  })
});

// Enroll contact endpoint (PRD Section 3.1, 9.2)
http.route({
  path: "/enrollments",
  method: "POST",
  handler: authenticatedAction(async (ctx, request, account) => {
    const body = await request.json();
    const idempotencyKey = request.headers.get("X-Idempotency-Key");

    // Validate input
    if (!body.journey_id || !body.contact?.email) {
      return errorResponse(
        "invalid_request",
        "Missing required fields: journey_id and contact.email",
        {},
        400
      );
    }

    // Validate Resend key before enrollment
    const overrideKey = request.headers.get("X-Resend-Key");
    const validation = await ctx.runAction(internal.actions.validateResendKeyAction, {
      resend_api_key_encrypted: account.resend_api_key_encrypted,
      override_key: overrideKey || undefined
    });

    if (!validation.valid) {
      return errorResponse(
        "invalid_resend_key",
        validation.error || "Invalid Resend API key",
        {
          hint: "Set a valid Resend API key in your account settings or provide X-Resend-Key header"
        },
        401
      );
    }

    let result;
    try {
      result = await ctx.runMutation(api.mutations.createEnrollment, {
        account_id: account._id,
        journey_id: body.journey_id,
        contact: body.contact,
        options: body.options,
        idempotency_key: idempotencyKey || undefined
      });
    } catch (error: any) {
      // Handle APIError from mutation
      console.error("Enrollment creation error:", error);

      // Convex wraps errors, check both error.data and direct properties
      const errorData = error.data || error;
      const code = errorData.code || "enrollment_failed";
      const message = errorData.message || error.message || "Failed to create enrollment";
      const details = errorData.details || {};
      const statusCode = errorData.statusCode || 400;

      return errorResponse(code, message, details, statusCode);
    }

    return new Response(
      JSON.stringify({
        enrollment_id: result.enrollment._id,
        status: result.enrollment.status,
        next_run_at: new Date(result.enrollment.next_run_at).toISOString(),
        test_mode: result.enrollment.test_mode,
        tags: result.enrollment.tags,
        existing: result.existing || false,
        ...(result.existing && {
          enrolled_at: new Date(result.enrollment.enrolled_at).toISOString()
        })
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  })
});

// Get and update journey endpoints: /journeys/:id and /journeys/:id/analytics (Issue #26, #27)
http.route({
  pathPrefix: "/journeys/",
  method: "GET",
  handler: authenticatedAction(async (ctx, request, account) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(p => p);

    // Handle GET /journeys/:id/analytics (pathParts.length === 3)
    if (pathParts.length === 3 && pathParts[2] === "analytics") {
      const journeyId = pathParts[1];

      // Get analytics
      const analytics = await ctx.runQuery(api.queries.getJourneyAnalytics, {
        journey_id: journeyId as Id<"journeys">,
        account_id: account._id
      }).catch(() => null);

      if (!analytics) {
        return errorResponse(
          "journey_not_found",
          "Journey not found",
          {},
          404
        );
      }

      return new Response(
        JSON.stringify(analytics),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Handle GET /journeys/:id (pathParts.length === 2)
    if (pathParts.length !== 2) {
      return new Response("Not Found", { status: 404 });
    }

    const journeyId = pathParts[1];

    // Validate journey ID format (starts with 'jd')
    if (!journeyId.startsWith("jd")) {
      return errorResponse(
        "invalid_request",
        "Invalid journey ID format",
        {},
        400
      );
    }

    // Get journey
    const journey = await ctx.runQuery(api.queries.getJourneyById, {
      journey_id: journeyId as Id<"journeys">,
      account_id: account._id
    }).catch(() => null);

    if (!journey) {
      return errorResponse(
        "journey_not_found",
        "Journey not found",
        {},
        404
      );
    }

    return new Response(
      JSON.stringify({
        journey_id: journey._id,
        name: journey.name,
        version: journey.version || 1,
        goal: journey.goal,
        audience: journey.audience,
        stages: journey.stages,
        is_active: journey.is_active,
        default_reply_to: journey.default_reply_to,
        default_tags: journey.default_tags,
        stats: journey.stats,
        created_at: new Date(journey.created_at).toISOString(),
        updated_at: journey.updated_at ? new Date(journey.updated_at).toISOString() : undefined
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  })
});

http.route({
  pathPrefix: "/journeys/",
  method: "PATCH",
  handler: authenticatedAction(async (ctx, request, account) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(p => p);

    // Handle PATCH /journeys/:id
    if (pathParts.length !== 2) {
      return new Response("Not Found", { status: 404 });
    }

    const journeyId = pathParts[1];

    // Validate journey ID format
    if (!journeyId.startsWith("jd")) {
      return errorResponse(
        "invalid_request",
        "Invalid journey ID format",
        {},
        400
      );
    }

    const body = await request.json();

    // Update journey
    let result;
    try {
      result = await ctx.runMutation(api.mutations.updateJourney, {
        account_id: account._id,
        journey_id: journeyId as Id<"journeys">,
        name: body.name,
        goal: body.goal,
        audience: body.audience,
        stages: body.stages,
        stage_updates: body.stage_updates,
        is_active: body.is_active,
        default_reply_to: body.default_reply_to,
        default_tags: body.default_tags
      });
    } catch (error: any) {
      console.error("Journey update error:", error);

      const errorData = error.data || error;
      const code = errorData.code || "update_failed";
      const message = errorData.message || error.message || "Failed to update journey";
      const details = errorData.details || {};
      const statusCode = errorData.statusCode || 400;

      return errorResponse(code, message, details, statusCode);
    }

    return new Response(
      JSON.stringify({
        success: true,
        journey_id: journeyId,
        version: result.version
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  })
});

// Events endpoint (PRD Section 3.1)
http.route({
  path: "/events",
  method: "POST",
  handler: authenticatedAction(async (ctx, request, account) => {
    const body = await request.json();

    // Validate input
    if (!body.type || !body.contact_email) {
      return errorResponse(
        "invalid_request",
        "Missing required fields: type and contact_email",
        {},
        400
      );
    }

    // Validate event type
    const validTypes = ["conversion", "unsubscribe", "open", "click", "custom"];
    if (!validTypes.includes(body.type)) {
      return errorResponse(
        "invalid_event_type",
        `Invalid event type. Must be one of: ${validTypes.join(", ")}`,
        { provided: body.type },
        400
      );
    }

    try {
      const result = await ctx.runMutation(api.mutations.recordEvent, {
        account_id: account._id,
        type: body.type,
        contact_email: body.contact_email,
        journey_id: body.journey_id,
        enrollment_id: body.enrollment_id,
        metadata: body.metadata
      });

      return new Response(
        JSON.stringify({
          event_id: result.event_id,
          accepted: true
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } catch (error: any) {
      console.error("Event recording error:", error);
      return errorResponse(
        "invalid_request",
        error.message || "Failed to record event",
        {},
        400
      );
    }
  })
});

// Enrollment timeline endpoint (PRD Section 3.1, 9.5)
http.route({
  pathPrefix: "/enrollments/",
  method: "GET",
  handler: authenticatedAction(async (ctx, request, account) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(p => p);

    // Check if this is the timeline endpoint: /enrollments/:id/timeline
    if (pathParts.length !== 3 || pathParts[2] !== "timeline") {
      return new Response("Not Found", { status: 404 });
    }

    const enrollmentId = pathParts[1];

    // Get timeline
    const timeline = await ctx.runQuery(api.queries.getEnrollmentTimeline, {
      enrollment_id: enrollmentId as Id<"enrollments">,
      account_id: account._id
    }).catch(() => null);

    if (!timeline) {
      return errorResponse(
        "enrollment_not_found",
        "Enrollment not found",
        {},
        404
      );
    }

    return new Response(
      JSON.stringify(timeline),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  })
});

// Suppressions list endpoint (PRD Section 3.1)
http.route({
  path: "/suppressions",
  method: "GET",
  handler: authenticatedAction(async (ctx, request, account) => {
    const url = new URL(request.url);
    const journeyId = url.searchParams.get("journey_id");
    const reason = url.searchParams.get("reason");

    const args: {
      account_id: Id<"accounts">;
      journey_id?: Id<"journeys">;
      reason?: "hard_bounce" | "soft_bounce" | "spam_complaint" | "unsubscribe" | "manual";
    } = {
      account_id: account._id
    };

    if (journeyId) {
      args.journey_id = journeyId as Id<"journeys">;
    }

    if (reason) {
      args.reason = reason as "hard_bounce" | "soft_bounce" | "spam_complaint" | "unsubscribe" | "manual";
    }

    const suppressions = await ctx.runQuery(api.queries.getSuppressions, args);

    return new Response(
      JSON.stringify(suppressions),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  })
});

// Unsubscribe page handler (PRD Section 10)
http.route({
  pathPrefix: "/u/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(p => p);
    const enrollmentId = pathParts[pathParts.length - 1];

    // Validate enrollment_id format
    if (!enrollmentId || enrollmentId.length === 0) {
      return new Response(
        "<html><body><h1>Invalid Unsubscribe Link</h1><p>The link you clicked is invalid.</p></body></html>",
        {
          status: 404,
          headers: { "Content-Type": "text/html" }
        }
      );
    }

    // Get enrollment (with try/catch for invalid ID format)
    let enrollment;
    try {
      enrollment = await ctx.runQuery(api.queries.getEnrollment, {
        enrollment_id: enrollmentId as Id<"enrollments">
      });
    } catch (error) {
      // Invalid enrollment ID format
      return new Response(
        "<html><body><h1>Invalid Unsubscribe Link</h1><p>This unsubscribe link is not valid.</p></body></html>",
        {
          status: 404,
          headers: { "Content-Type": "text/html" }
        }
      );
    }

    if (!enrollment) {
      return new Response(
        "<html><body><h1>Invalid Unsubscribe Link</h1><p>This unsubscribe link is not valid or has expired.</p></body></html>",
        {
          status: 404,
          headers: { "Content-Type": "text/html" }
        }
      );
    }

    // Record unsubscribe event
    try {
      await ctx.runMutation(api.mutations.recordEvent, {
        account_id: enrollment.account_id,
        type: "unsubscribe",
        contact_email: enrollment.contact_email,
        journey_id: enrollment.journey_id,
        enrollment_id: enrollmentId as Id<"enrollments">,
        metadata: { source: "unsubscribe_link" }
      });

      return new Response(
        `<html>
          <head>
            <title>Unsubscribed</title>
            <style>
              body { font-family: system-ui, sans-serif; max-width: 600px; margin: 100px auto; text-align: center; }
              h1 { color: #333; }
              p { color: #666; line-height: 1.6; }
            </style>
          </head>
          <body>
            <h1>You have been unsubscribed</h1>
            <p>You will no longer receive emails from this journey.</p>
            <p>Email: <strong>${enrollment.contact_email}</strong></p>
          </body>
        </html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html" }
        }
      );
    } catch (error: any) {
      console.error("Unsubscribe error:", error);
      return new Response(
        "<html><body><h1>Error</h1><p>There was an error processing your unsubscribe request. Please try again.</p></body></html>",
        {
          status: 500,
          headers: { "Content-Type": "text/html" }
        }
      );
    }
  })
});

// Resend webhook endpoint (PRD Section 5.3)
http.route({
  path: "/webhooks/resend",
  method: "POST",
  handler: handleResendWebhook
});

export default http;
