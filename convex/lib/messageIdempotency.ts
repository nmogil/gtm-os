export async function checkMessageExists(
  ctx: any,
  enrollmentId: string,
  stage: number
): Promise<boolean> {
  const existing = await ctx.db
    .query("messages")
    .withIndex("by_enrollment", (q: any) => q.eq("enrollment_id", enrollmentId))
    .filter((q: any) => q.eq(q.field("stage"), stage))
    .first();

  return existing !== null;
}

export function generateBatchIdempotencyKey(
  accountId: string,
  timestamp: number
): string {
  return "gtmos-batch-" + timestamp + "-" + accountId;
}
