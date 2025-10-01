"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
// import { validateResendKey } from "./resend"; // Temporarily disabled
import { generateJourneyWithFallback } from "./lib/ai";
import { api } from "./_generated/api";
import { createCipheriv, randomBytes } from "crypto";
import { Resend } from "resend";

// Inline validateResendKey temporarily
async function validateResendKey(apiKey: string): Promise<boolean> {
  try {
    const resend = new Resend(apiKey);
    await resend.domains.list();
    return true;
  } catch (error: any) {
    throw new Error("Invalid Resend API key");
  }
}

const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32 bytes

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Return iv:authTag:encrypted
  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
}

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
