import { httpRouter } from "convex/server";
import { authenticatedAction } from "./lib/httpAuth";

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

export default http;
