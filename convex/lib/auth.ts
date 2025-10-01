import { api } from "../_generated/api";

export async function validateApiKey(ctx: any, apiKey: string | null) {
  if (!apiKey) {
    throw new Error("Missing X-API-Key header");
  }

  // Query accounts table for matching API key
  const account = await ctx.runQuery(api.queries.getAccountByApiKey, {
    apiKey: apiKey
  });

  if (!account) {
    throw new Error("Invalid API key");
  }

  return account;
}
