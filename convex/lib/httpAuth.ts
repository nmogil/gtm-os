import { httpAction } from "../_generated/server";
import { validateApiKey } from "./auth";

export function authenticatedAction(
  handler: (ctx: any, request: Request, account: any) => Promise<Response>
) {
  return httpAction(async (ctx, request) => {
    try {
      const apiKey = request.headers.get("X-API-Key");
      const account = await validateApiKey(ctx, apiKey);

      return await handler(ctx, request, account);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_api_key",
            message: error.message,
            details: {}
          }
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  });
}
