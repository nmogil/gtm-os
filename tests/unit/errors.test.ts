import { describe, it, expect } from "vitest";
import { APIError, errorResponse } from "../../convex/lib/errors";

describe("APIError Class", () => {
  it("creates APIError with correct properties", () => {
    const error = new APIError(
      "invalid_api_key",
      "Invalid API key provided",
      { key_hint: "sk_test_***" },
      401
    );

    expect(error.code).toBe("invalid_api_key");
    expect(error.message).toBe("Invalid API key provided");
    expect(error.details).toEqual({ key_hint: "sk_test_***" });
    expect(error.statusCode).toBe(401);
  });

  it("uses default status code of 400", () => {
    const error = new APIError("invalid_request", "Bad request");
    expect(error.statusCode).toBe(400);
  });

  it("toResponse returns proper JSON response", async () => {
    const error = new APIError(
      "invalid_request",
      "Missing required field",
      { field: "email" },
      400
    );

    const response = error.toResponse();
    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toBe("application/json");

    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.message).toBe("Missing required field");
    expect(body.error.details).toEqual({ field: "email" });
  });

  it("handles errors with empty details", async () => {
    const error = new APIError("rate_limit_exceeded", "Too many requests", {}, 429);
    const response = error.toResponse();
    const body = await response.json();

    expect(body.error.details).toEqual({});
  });
});

describe("errorResponse Function", () => {
  it("creates error response with all parameters", async () => {
    const response = errorResponse(
      "journey_not_found",
      "Journey not found",
      { journey_id: "jd_123" },
      404
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("journey_not_found");
    expect(body.error.message).toBe("Journey not found");
    expect(body.error.details).toEqual({ journey_id: "jd_123" });
  });

  it("uses default status code", async () => {
    const response = errorResponse("invalid_email", "Invalid email format");
    expect(response.status).toBe(400);
  });

  it("handles different error codes", async () => {
    const codes = [
      "invalid_api_key",
      "resend_auth_failed",
      "rate_limit_exceeded",
      "journey_not_found",
      "duplicate_enrollment",
      "llm_generation_failed",
      "template_render_failed",
      "webhook_verification_failed",
      "contact_suppressed",
      "invalid_email"
    ];

    for (const code of codes) {
      const response = errorResponse(code as any, `Test ${code}`);
      const body = await response.json();
      expect(body.error.code).toBe(code);
    }
  });
});
