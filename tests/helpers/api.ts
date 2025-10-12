const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL || "https://focused-bloodhound-276.convex.site";
const API_KEY = process.env.TEST_API_KEY || "test-api-key-123";

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${CONVEX_SITE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...options.headers
    }
  });

  let data;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  return { response, data };
}

export function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@testing.xyz`;
}

export function generateIdempotencyKey(): string {
  return `test-idem-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export { CONVEX_SITE_URL, API_KEY };
