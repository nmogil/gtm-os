import { v } from "convex/values";
import { checkIdempotencyKey, setIdempotencyKey } from "./enrollmentIdempotency";

export function generateIdempotencyKey(prefix: string, ...parts: string[]): string {
  return prefix + "-" + parts.join("-") + "-" + Date.now();
}

export async function checkEnrollmentExists(
  ctx: any,
  accountId: string,
  journeyId: string,
  contactEmail: string
) {
  const existing = await ctx.db
    .query("enrollments")
    .withIndex("by_account_journey_email", (q: any) =>
      q.eq("account_id", accountId)
       .eq("journey_id", journeyId)
       .eq("contact_email", contactEmail)
    )
    .first();

  return existing;
}

export async function createEnrollmentIdempotent(
  ctx: any,
  args: {
    account_id: string;
    journey_id: string;
    contact_email: string;
    contact_data: any;
    idempotency_key?: string;
  }
) {
  // Check idempotency key first if provided
  if (args.idempotency_key) {
    const existing = checkIdempotencyKey(args.idempotency_key);
    if (existing) {
      const enrollment = await ctx.db.get(existing);
      return { enrollment, existing: true };
    }
  }

  // Check for duplicate enrollment by email+journey
  const duplicate = await checkEnrollmentExists(
    ctx,
    args.account_id,
    args.journey_id,
    args.contact_email
  );

  if (duplicate) {
    // Return existing enrollment (idempotent behavior)
    return { enrollment: duplicate, existing: true };
  }

  // Create new enrollment
  const enrollmentId = await ctx.db.insert("enrollments", {
    account_id: args.account_id,
    journey_id: args.journey_id,
    contact_email: args.contact_email,
    contact_data: args.contact_data,
    status: "active",
    current_stage: 0,
    next_run_at: Date.now(),
    enrolled_at: Date.now(),
    test_mode: false,
    retry_count: 0
  });

  // Cache idempotency key
  if (args.idempotency_key) {
    setIdempotencyKey(args.idempotency_key, enrollmentId);
  }

  const enrollment = await ctx.db.get(enrollmentId);
  return { enrollment, existing: false };
}
