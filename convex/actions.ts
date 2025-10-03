"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
// import { validateResendKey } from "./resend"; // Temporarily disabled
import { generateJourneyWithFallback } from "./lib/ai";
import { api } from "./_generated/api";
import { createCipheriv, randomBytes } from "crypto";
import { Resend } from "resend";

// Inline validateResendKey temporarily
async function validateResendKey(apiKey: string): Promise<void> {
  const resend = new Resend(apiKey);
  const result = await resend.domains.list();

  // Check if the result indicates an error
  if (result.error) {
    throw new Error(`Invalid Resend API key: ${result.error.message}`);
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

function decrypt(encryptedData: string): string {
  const { createDecipheriv } = require("crypto");
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

export const validateResendKeyAction = internalAction({
  args: {
    resend_api_key_encrypted: v.optional(v.string()),
    override_key: v.optional(v.string())
  },
  returns: v.object({
    valid: v.boolean(),
    error: v.optional(v.string())
  }),
  handler: async (ctx, args) => {
    try {
      let apiKey: string;

      // Priority: override_key > encrypted_key > system default
      if (args.override_key) {
        apiKey = args.override_key;
      } else if (args.resend_api_key_encrypted) {
        apiKey = decrypt(args.resend_api_key_encrypted);
      } else if (process.env.RESEND_API_KEY) {
        apiKey = process.env.RESEND_API_KEY;
      } else {
        return {
          valid: false,
          error: "No Resend API key available"
        };
      }

      // Test the key with lightweight API call
      await validateResendKey(apiKey);

      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || "Invalid Resend API key"
      };
    }
  }
});
