import { httpAction } from "./_generated/server";
import { Webhook } from "svix";
import { api } from "./_generated/api";
import { errorResponse } from "./lib/errors";

/**
 * Resend Webhook Handler with Svix Verification
 * PRD Reference: Section 5.3 - Webhook Processing
 *
 * Handles webhook events from Resend:
 * - email.sent: Message successfully sent
 * - email.delivered: Message delivered to recipient
 * - email.bounced: Message bounced (hard/soft)
 * - email.complained: Recipient marked as spam
 * - email.opened: Recipient opened email
 * - email.clicked: Recipient clicked link
 */
export const handleResendWebhook = httpAction(async (ctx, request) => {
  console.log("=== RESEND WEBHOOK RECEIVED ===");

  // Get webhook secret from environment
  const webhookSecret = process.env.SVIX_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("SVIX_WEBHOOK_SECRET not configured");
    return errorResponse(
      "webhook_verification_failed",
      "Webhook secret not configured",
      {},
      500
    );
  }

  // Get request body as text for verification
  const body = await request.text();

  // Get Svix headers
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("Missing Svix headers");
    return errorResponse(
      "webhook_verification_failed",
      "Missing Svix verification headers",
      {},
      401
    );
  }

  // Verify webhook signature
  const wh = new Webhook(webhookSecret);
  let payload: any;

  try {
    payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature
    });
  } catch (err: any) {
    console.error("Webhook verification failed:", err.message);
    return errorResponse(
      "webhook_verification_failed",
      "Invalid webhook signature",
      { error: err.message },
      401
    );
  }

  console.log("Webhook verified successfully");
  console.log("Event type:", payload.type);
  console.log("Event ID:", payload.data?.email_id);

  // Look up account_id from message record (Resend doesn't send custom headers in webhooks)
  const emailId = payload.data?.email_id;

  if (!emailId) {
    console.error("No email_id in webhook payload");
    return new Response(
      JSON.stringify({
        received: true,
        warning: "No email_id in payload"
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Query message by resend_message_id to get account_id
  const message = await ctx.runQuery(api.queries.getMessageByResendId, {
    resend_message_id: emailId
  });

  if (!message) {
    console.error("Could not find message for email_id:", emailId);
    // Still return 200 to prevent retries
    return new Response(
      JSON.stringify({
        received: true,
        warning: "Could not determine account_id"
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const accountId = message.account_id;

  // Extract contact email
  const contactEmail = payload.data?.to?.[0] || payload.data?.email || "";

  // Extract message ID and enrollment ID from headers
  const messageId = payload.data?.email_id;
  const enrollmentId = payload.data?.headers?.['"X-Enrollment-ID"'] ||
                      payload.data?.headers?.["X-Enrollment-ID"];

  try {
    // Store webhook event with unique ID per event type
    // Combine event type + message ID to ensure each event is unique
    const uniqueEventId = `${payload.type}:${payload.data?.email_id || payload.created_at}`;

    const result = await ctx.runMutation(api.mutations.createWebhookEvent, {
      account_id: accountId,
      resend_event_id: uniqueEventId,
      event_type: payload.type,
      contact_email: contactEmail,
      message_id: messageId,
      enrollment_id: enrollmentId,
      payload: payload
    });

    if (result.duplicate) {
      console.log("Duplicate webhook event, skipping processing");
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Process webhook event
    const processResult = await ctx.runMutation(api.mutations.processWebhookEvent, {
      webhook_event_id: result.webhook_event_id
    });

    console.log("Webhook processed:", processResult);

    return new Response(
      JSON.stringify({
        received: true,
        processed: processResult.processed,
        actions: processResult.actions
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return errorResponse(
      "webhook_processing_failed",
      "Failed to process webhook",
      { error: error.message },
      500
    );
  }
});
