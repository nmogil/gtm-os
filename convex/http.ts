import { httpRouter } from "convex/server";
import { authenticatedAction } from "./lib/httpAuth";
import { errorResponse } from "./lib/errors";
import { api, internal } from "./_generated/api";

/**
 * HTTP endpoints for GTM OS
 * PRD Reference: Section 9 - API Endpoints
 */
const http = httpRouter();

// Health check endpoint (authenticated)
http.route({
  path: "/health",
  method: "GET",
  handler: authenticatedAction(async (ctx, request, account) => {
    return new Response(
      JSON.stringify({ status: "ok", account_id: account._id }),
      { headers: { "Content-Type": "application/json" } }
    );
  })
});

// Create journey endpoint (PRD Section 3.1, 9.1)
http.route({
  path: "/journeys",
  method: "POST",
  handler: authenticatedAction(async (ctx, request, account) => {
    const body = await request.json();

    // Validate input
    if (!body.goal || !body.audience) {
      return errorResponse(
        "journey_not_found",
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
        default_reply_to: body.options?.default_reply_to,
        stages: journey.stages
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
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

export default http;
