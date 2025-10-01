import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { validateJourneyTemplates } from "./lib/templates";
import { APIError } from "./lib/errors";

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

export const createJourneyFromGenerated = mutation({
  args: {
    account_id: v.id("accounts"),
    goal: v.string(),
    audience: v.string(),
    journey: v.object({
      name: v.string(),
      stages: v.array(v.object({
        day: v.number(),
        subject: v.string(),
        body: v.string()
      }))
    }),
    default_reply_to: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // Validate templates
    const validation = validateJourneyTemplates(args.journey.stages);
    if (!validation.valid) {
      throw new APIError(
        "llm_generation_failed",
        "Generated journey has invalid templates",
        { errors: validation.errors },
        500
      );
    }

    // Create journey record
    const journeyId = await ctx.db.insert("journeys", {
      account_id: args.account_id,
      name: args.journey.name,
      goal: args.goal,
      audience: args.audience,
      stages: args.journey.stages,
      is_active: true,
      default_reply_to: args.default_reply_to,
      stats: {
        total_enrolled: 0,
        total_completed: 0,
        total_converted: 0,
        total_bounced: 0,
        total_complained: 0,
        open_rate: 0,
        click_rate: 0
      },
      created_at: Date.now()
    });

    return { journeyId };
  }
});
