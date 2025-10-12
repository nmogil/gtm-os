import { internalMutation } from "../_generated/server";

/**
 * Migration: Add resend_key_valid field to existing accounts
 * Issue #29: Optimize Resend API key validation to avoid rate limits
 *
 * Sets resend_key_valid to true for all existing accounts, assuming
 * currently stored keys are valid.
 */
export const migrateResendKeyValid = internalMutation({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("accounts").collect();

    let migrated = 0;
    for (const account of accounts) {
      if (account.resend_key_valid === undefined) {
        await ctx.db.patch(account._id, {
          resend_key_valid: true
        });
        migrated++;
      }
    }

    console.log(`Migration complete: Updated ${migrated} accounts out of ${accounts.length} total`);

    return {
      total_accounts: accounts.length,
      migrated_accounts: migrated,
      message: `Successfully migrated ${migrated} accounts`
    };
  }
});
