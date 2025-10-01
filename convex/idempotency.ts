import { internalMutation } from "./_generated/server";
import { cleanupExpiredKeys } from "./lib/enrollmentIdempotency";

export const cleanupExpiredKeys = internalMutation({
  args: {},
  handler: async (ctx) => {
    cleanupExpiredKeys();
  },
});
