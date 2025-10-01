import { httpRouter } from "convex/server";
import { authenticatedAction } from "./lib/httpAuth";
import { errorResponse } from "./lib/errors";
import { api } from "./_generated/api";

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

export default http;
