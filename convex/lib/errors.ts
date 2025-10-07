export type ErrorCode =
  | "invalid_api_key"
  | "resend_auth_failed"
  | "rate_limit_exceeded"
  | "journey_not_found"
  | "duplicate_enrollment"
  | "llm_generation_failed"
  | "template_render_failed"
  | "webhook_verification_failed"
  | "webhook_processing_failed"
  | "contact_suppressed"
  | "invalid_email"
  | "invalid_request"
  | "invalid_resend_key"
  | "enrollment_failed"
  | "enrollment_not_found"
  | "event_not_found"
  | "invalid_event_type"
  | "invalid_templates";

export class APIError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public details: Record<string, any> = {},
    public statusCode: number = 400
  ) {
    super(message);
  }

  toResponse(): Response {
    return new Response(
      JSON.stringify({
        error: {
          code: this.code,
          message: this.message,
          details: this.details
        }
      }),
      {
        status: this.statusCode,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  details: Record<string, any> = {},
  statusCode: number = 400
): Response {
  return new APIError(code, message, details, statusCode).toResponse();
}
