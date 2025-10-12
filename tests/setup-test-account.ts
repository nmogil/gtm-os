#!/usr/bin/env node
/**
 * Setup test account for integration tests
 * Run: npx tsx tests/setup-test-account.ts
 */
import { setupTestAccount } from "./helpers/setup";

async function main() {
  try {
    await setupTestAccount();
    process.exit(0);
  } catch (error) {
    console.error("Setup failed:", error);
    process.exit(1);
  }
}

main();
