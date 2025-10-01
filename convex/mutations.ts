import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const storeEncryptedResendApiKey = mutation({
  args: {
    account_id: v.id("accounts"),
    encrypted_key: v.string()
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.account_id, {
      resend_api_key_encrypted: args.encrypted_key
    });

    return { success: true };
  }
});
