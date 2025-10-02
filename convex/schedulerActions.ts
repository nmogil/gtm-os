"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Resend } from "resend";
import { renderTemplate, type TemplateContext } from "./lib/templates";
import { generateBatchIdempotencyKey } from "./lib/messageIdempotency";
import { Id } from "./_generated/dataModel";
import { createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];

  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// Helper functions for send windows
function isWithinSendWindow(timestamp: number): boolean {
  const hour = new Date(timestamp).getUTCHours();
  return hour >= 9 && hour < 17; // 9am-5pm UTC
}

function getNext9AM(): number {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(9, 0, 0, 0);
  return tomorrow.getTime();
}

function generateUnsubscribeUrl(enrollmentId: string): string {
  // TODO: Replace with actual unsubscribe URL from your domain
  return `https://app.gtmos.dev/unsubscribe/${enrollmentId}`;
}

function getResendKey(account: any, systemDefault: string | null): string {
  if (account.resend_api_key_encrypted) {
    return decrypt(account.resend_api_key_encrypted);
  }
  if (systemDefault) {
    return systemDefault;
  }
  throw new Error("No Resend API key available");
}

// Action to process a batch for one account
export const processBatchAction = internalAction({
  args: {
    accountId: v.id("accounts"),
    enrollmentIds: v.array(v.id("enrollments"))
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log("processBatchAction called with accountId:", args.accountId, "enrollmentIds:", args.enrollmentIds);

    // Load account and enrollments
    const account = await ctx.runQuery(internal.scheduler.loadAccount, {
      accountId: args.accountId
    });

    if (!account) {
      console.error("Account not found:", args.accountId);
      return null;
    }

    const enrollments = await ctx.runQuery(internal.scheduler.loadEnrollments, {
      enrollmentIds: args.enrollmentIds
    });

    console.log("Loaded enrollments:", enrollments.map((e: any) => ({ id: e._id, email: e.contact_email })));

    // Get Resend API key
    const resendKey = getResendKey(account, process.env.RESEND_API_KEY || null);
    const resend = new Resend(resendKey);

    const batchEmails: Array<{
      from: string;
      to: string[];
      subject: string;
      html: string;
      reply_to?: string;
      headers?: Record<string, string>;
      tags?: Array<{ name: string; value: string }>;
      enrollmentId: Id<"enrollments">;
      journeyId: Id<"journeys">;
      stage: number;
    }> = [];

    const now = Date.now();

    for (const enrollment of enrollments) {
      // Check if converted (stop-on-convert)
      const converted: boolean = await ctx.runQuery(internal.scheduler.checkConverted, {
        enrollmentId: enrollment._id
      });

      if (converted) {
        await ctx.runMutation(internal.scheduler.markEnrollmentCompleted, {
          enrollmentId: enrollment._id,
          reason: "converted"
        });
        continue;
      }

      // Check suppression
      const suppressed: boolean = await ctx.runQuery(internal.scheduler.checkSuppressed, {
        contactEmail: enrollment.contact_email,
        journeyId: enrollment.journey_id
      });

      if (suppressed) {
        await ctx.runMutation(internal.scheduler.markEnrollmentSuppressed, {
          enrollmentId: enrollment._id
        });
        continue;
      }

      // Get journey
      const journey = await ctx.runQuery(internal.scheduler.loadJourney, {
        journeyId: enrollment.journey_id
      });

      if (!journey) {
        console.error("Journey not found:", enrollment.journey_id);
        continue;
      }

      // Check if stage exists
      if (enrollment.current_stage >= journey.stages.length) {
        await ctx.runMutation(internal.scheduler.markEnrollmentCompleted, {
          enrollmentId: enrollment._id,
          reason: "all_stages_complete"
        });
        continue;
      }

      const stage = journey.stages[enrollment.current_stage];

      // Check send window (PRD Section 5.2) - skip if test_mode is true
      if (!enrollment.test_mode && !isWithinSendWindow(now)) {
        await ctx.runMutation(internal.scheduler.rescheduleEnrollment, {
          enrollmentId: enrollment._id,
          nextRunAt: getNext9AM()
        });
        continue;
      }

      // Check for existing message (idempotency)
      const messageExists: boolean = await ctx.runQuery(internal.scheduler.checkMessageExists, {
        enrollmentId: enrollment._id,
        stage: enrollment.current_stage
      });

      if (messageExists) {
        console.log("Message already exists for enrollment:", enrollment._id, "stage:", enrollment.current_stage);
        continue;
      }

      // Render templates
      const templateContext: TemplateContext = {
        ...enrollment.contact_data,
        email: enrollment.contact_email,
        unsubscribe_url: generateUnsubscribeUrl(enrollment._id),
        enrollment_id: enrollment._id,
        journey_name: journey.name
      };

      try {
        const renderedSubject = renderTemplate(stage.subject, templateContext);
        const renderedBody = renderTemplate(stage.body, templateContext);

        // Add to batch
        // Use reply_to only if it's a non-empty string, otherwise use journey default
        const reply_to = (enrollment.reply_to && enrollment.reply_to.trim() !== "")
          ? enrollment.reply_to
          : (journey.default_reply_to && journey.default_reply_to.trim() !== "")
            ? journey.default_reply_to
            : undefined;

        batchEmails.push({
          from: "digest@paper-boy.app",
          to: [enrollment.contact_email],
          subject: renderedSubject,
          html: renderedBody,
          reply_to,
          headers: {
            "X-Enrollment-ID": enrollment._id,
            "X-Journey-ID": enrollment.journey_id,
            "X-Stage": String(enrollment.current_stage),
            ...(enrollment.custom_headers || {})
          },
          tags: [
            { name: "journey_id", value: enrollment.journey_id },
            { name: "stage", value: String(enrollment.current_stage) },
            ...(enrollment.tags ? Object.entries(enrollment.tags).map(([name, value]) => ({
              name,
              value: String(value)
            })) : [])
          ],
          enrollmentId: enrollment._id,
          journeyId: enrollment.journey_id,
          stage: enrollment.current_stage
        });

      } catch (error: any) {
        console.error("Template render failed:", error);
        await ctx.runMutation(internal.scheduler.markEnrollmentFailed, {
          enrollmentId: enrollment._id,
          error: "template_render_failed: " + error.message
        });
      }
    }

    // Send batch to Resend
    if (batchEmails.length > 0) {
      await sendBatch(ctx, resend, args.accountId, batchEmails);
    }

    return null;
  }
});

async function sendBatch(
  ctx: any,
  resend: Resend,
  accountId: Id<"accounts">,
  emails: Array<{
    from: string;
    to: string[];
    subject: string;
    html: string;
    reply_to?: string;
    headers?: Record<string, string>;
    tags?: Array<{ name: string; value: string }>;
    enrollmentId: Id<"enrollments">;
    journeyId: Id<"journeys">;
    stage: number;
  }>
) {
  const idempotencyKey = generateBatchIdempotencyKey(accountId, Date.now());

  try {
    // Prepare batch for Resend
    const resendEmails = emails.map(email => {
      const emailPayload: any = {
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html
      };

      // Only include optional fields if they have valid, non-empty values
      if (email.reply_to && email.reply_to.trim() !== "") {
        emailPayload.reply_to = email.reply_to;
      }
      if (email.headers && Object.keys(email.headers).length > 0) {
        // Filter out empty string values from headers
        const validHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(email.headers)) {
          if (value && String(value).trim() !== "") {
            validHeaders[key] = value;
          }
        }
        if (Object.keys(validHeaders).length > 0) {
          emailPayload.headers = validHeaders;
        }
      }
      if (email.tags && email.tags.length > 0) {
        // Filter out tags with empty name or value
        const validTags = email.tags.filter(tag =>
          tag.name && tag.name.trim() !== "" &&
          tag.value && tag.value.trim() !== ""
        );
        if (validTags.length > 0) {
          emailPayload.tags = validTags;
        }
      }

      return emailPayload;
    });

    console.log("=== RESEND BATCH SEND DEBUG ===");
    console.log("Total emails in batch:", resendEmails.length);
    console.log("First email payload:", JSON.stringify(resendEmails[0], null, 2));

    // Validate no empty strings in critical fields
    resendEmails.forEach((email, index) => {
      if (email.reply_to === "") {
        console.warn(`⚠️  Email ${index} has empty reply_to (should be omitted)`);
      }
      if (email.tags) {
        email.tags.forEach((tag: any, tagIndex: number) => {
          if (tag.name === "" || tag.value === "") {
            console.warn(`⚠️  Email ${index}, tag ${tagIndex} has empty name or value:`, tag);
          }
        });
      }
    });

    const results = await resend.batch.send(resendEmails);

    console.log("=== RESEND API RESPONSE ===");
    console.log("results.data:", results.data);
    console.log("results.error:", results.error);

    // Resend batch API returns { data: { data: [...] } }
    const batchData = results.data?.data;

    if (!batchData || !Array.isArray(batchData)) {
      console.error("Batch send failed - no data:", JSON.stringify(results, null, 2));
      console.error("First email payload:", JSON.stringify(resendEmails[0], null, 2));
      return;
    }

    console.log("Successfully sent", batchData.length, "emails");

    // Process results
    for (let i = 0; i < batchData.length; i++) {
      const result = batchData[i];
      const email = emails[i];

      if (result.id) {
        // Create message record and update enrollment
        await ctx.runMutation(internal.scheduler.recordMessageSent, {
          accountId,
          enrollmentId: email.enrollmentId,
          journeyId: email.journeyId,
          stage: email.stage,
          subject: email.subject,
          body: email.html,
          resendMessageId: result.id,
          personalizationSnapshot: emails[i].tags,
          tags: emails[i].tags
        });
      } else {
        console.error("Failed to send email:", result);
        await ctx.runMutation(internal.scheduler.markEnrollmentFailed, {
          enrollmentId: email.enrollmentId,
          error: "send_failed"
        });
      }
    }
  } catch (error: any) {
    console.error("Batch send failed:", error);
    // Mark all enrollments as failed
    for (const email of emails) {
      await ctx.runMutation(internal.scheduler.markEnrollmentFailed, {
        enrollmentId: email.enrollmentId,
        error: "batch_send_error: " + error.message
      });
    }
  }
}
