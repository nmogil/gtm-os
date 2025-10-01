"use node";

import { Resend } from "resend";
import { decrypt, redactApiKey } from "./encryption";
import { APIError } from "./errors";

export function getResendKey(
  account: any,
  headerOverride?: string | null
): string {
  // Header override takes precedence (PRD Section 8)
  if (headerOverride) {
    return headerOverride;
  }

  if (!account.resend_api_key_encrypted) {
    throw new APIError(
      "invalid_api_key",
      "No Resend API key configured for this account",
      { account_id: account._id },
      400
    );
  }

  return decrypt(account.resend_api_key_encrypted);
}

export async function validateResendKey(apiKey: string): Promise<boolean> {
  try {
    const resend = new Resend(apiKey);

    // Test API key by fetching domains (lightweight validation)
    await resend.domains.list();

    return true;
  } catch (error: any) {
    if (error.message?.includes("401") || error.message?.includes("Invalid")) {
      throw new APIError(
        "resend_auth_failed",
        "The provided Resend API key is invalid",
        { key_suffix: redactApiKey(apiKey) },
        401
      );
    }
    throw error;
  }
}

export function createResendClient(apiKey: string): Resend {
  return new Resend(apiKey);
}

export async function getResendClientFromRequest(
  account: any,
  request: Request
): Promise<Resend> {
  const headerKey = request.headers.get("X-Resend-Key");
  const apiKey = getResendKey(account, headerKey);

  // Validate on first use
  await validateResendKey(apiKey);

  return createResendClient(apiKey);
}
