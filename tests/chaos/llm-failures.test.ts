import { describe, it, expect } from "vitest";
import { generateJourneyWithFallback, DEFAULT_JOURNEY } from "../../convex/lib/ai";

describe("LLM Failure Handling", () => {
  it("DEFAULT_JOURNEY has proper structure", () => {
    expect(DEFAULT_JOURNEY).toBeDefined();
    expect(DEFAULT_JOURNEY.name).toBeDefined();
    expect(DEFAULT_JOURNEY.stages).toBeDefined();
    expect(Array.isArray(DEFAULT_JOURNEY.stages)).toBe(true);
    expect(DEFAULT_JOURNEY.stages.length).toBeGreaterThanOrEqual(5);

    // Verify each stage has unsubscribe_url
    DEFAULT_JOURNEY.stages.forEach(stage => {
      expect(stage.day).toBeDefined();
      expect(stage.subject).toBeDefined();
      expect(stage.body).toBeDefined();
      expect(stage.body).toContain("{{unsubscribe_url}}");
    });
  });

  it("DEFAULT_JOURNEY stages are properly ordered", () => {
    for (let i = 1; i < DEFAULT_JOURNEY.stages.length; i++) {
      expect(DEFAULT_JOURNEY.stages[i].day).toBeGreaterThan(
        DEFAULT_JOURNEY.stages[i - 1].day
      );
    }
  });

  it("DEFAULT_JOURNEY uses personalization tags", () => {
    const allContent = DEFAULT_JOURNEY.stages
      .map(s => s.subject + " " + s.body)
      .join(" ");

    // Should use at least some personalization
    const hasPersonalization =
      allContent.includes("{{name}}") ||
      allContent.includes("{{company}}") ||
      allContent.includes("{{default");

    expect(hasPersonalization).toBe(true);
  });

  // Note: Testing actual AI fallback requires mocking OpenAI or intentionally causing failures
  // In a real scenario, you would:
  // 1. Mock the OpenAI client to throw errors
  // 2. Verify that generateJourneyWithFallback returns usedFallback: true
  // 3. Verify the returned journey matches DEFAULT_JOURNEY structure

  it("generateJourneyWithFallback function exists", () => {
    expect(generateJourneyWithFallback).toBeDefined();
    expect(typeof generateJourneyWithFallback).toBe("function");
  });

  it("can handle concurrent journey generation requests", async () => {
    // Test that multiple journey generations can happen concurrently
    // This helps ensure the fallback mechanism is thread-safe

    const promises = Array(5).fill(null).map(() =>
      generateJourneyWithFallback("Test goal", "Test audience", 5)
    );

    const results = await Promise.all(promises);

    results.forEach(result => {
      expect(result.journey).toBeDefined();
      expect(result.journey.stages.length).toBeGreaterThanOrEqual(5);
      expect(typeof result.usedFallback).toBe("boolean");
    });
  });
});

describe("Journey Validation (Chaos)", () => {
  it("handles empty goal gracefully", async () => {
    // AI should handle edge cases
    const result = await generateJourneyWithFallback("", "Test audience", 5);
    expect(result.journey).toBeDefined();
  });

  it("handles empty audience gracefully", async () => {
    const result = await generateJourneyWithFallback("Test goal", "", 5);
    expect(result.journey).toBeDefined();
  });

  it("handles extreme email counts", async () => {
    // Test minimum
    const resultMin = await generateJourneyWithFallback("Test", "Test", 5);
    expect(resultMin.journey.stages.length).toBeGreaterThanOrEqual(5);
    expect(resultMin.journey.stages.length).toBeLessThanOrEqual(7);

    // Test maximum
    const resultMax = await generateJourneyWithFallback("Test", "Test", 7);
    expect(resultMax.journey.stages.length).toBeGreaterThanOrEqual(5);
    expect(resultMax.journey.stages.length).toBeLessThanOrEqual(7);
  });
});
