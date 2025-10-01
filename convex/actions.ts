"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { encrypt } from "./lib/encryption";
import { validateResendKey } from "./lib/resend";
import { generateJourneyWithFallback } from "./lib/ai";
import { api } from "./_generated/api";

export const updateResendApiKey = action({
  args: {
    account_id: v.id("accounts"),
    resend_api_key: v.string()
  },
  handler: async (ctx, args) => {
    // Validate key before storing
    await validateResendKey(args.resend_api_key);

    // Encrypt the key
    const encrypted = encrypt(args.resend_api_key);

    // Store encrypted key via mutation
    await ctx.runMutation(api.mutations.storeEncryptedResendApiKey, {
      account_id: args.account_id,
      encrypted_key: encrypted
    });

    return { success: true };
  }
});

export const generateJourneyAction = action({
  args: {
    goal: v.string(),
    audience: v.string(),
    emailCount: v.number()
  },
  handler: async (ctx, args) => {
    // Generate journey with AI (can use fetch in actions)
    return await generateJourneyWithFallback(
      args.goal,
      args.audience,
      args.emailCount
    );
  }
});
