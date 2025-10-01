export function validateEnvironment() {
  const required = ["ENCRYPTION_KEY", "OPENAI_API_KEY"];

  for (const varName of required) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }

  // Validate encryption key length
  const encKey = process.env.ENCRYPTION_KEY!;
  if (Buffer.from(encKey, "hex").length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
  }
}
