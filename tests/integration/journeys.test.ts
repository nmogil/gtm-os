import { describe, it, expect } from "vitest";
import { apiRequest, CONVEX_SITE_URL } from "../helpers/api";
import { mockJourneyPayload } from "../helpers/fixtures";

describe("POST /journeys", () => {
  it("creates journey with AI generation", async () => {
    const { response, data } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify(mockJourneyPayload)
    });

    expect(response.status).toBe(200);
    expect(data.journey_id).toBeDefined();
    expect(data.journey_id).toMatch(/^jd[a-z0-9]+$/);
    expect(data.name).toBeDefined();
    expect(data.stages).toBeDefined();
    expect(Array.isArray(data.stages)).toBe(true);
    expect(data.stages.length).toBeGreaterThanOrEqual(5);
    expect(data.stages.length).toBeLessThanOrEqual(7);

    // Verify each stage has required fields
    data.stages.forEach((stage: any, index: number) => {
      expect(stage).toHaveProperty("day");
      expect(stage).toHaveProperty("subject");
      expect(stage).toHaveProperty("body");
      expect(stage.body).toContain("{{unsubscribe_url}}");

      // Verify day ordering
      if (index > 0) {
        expect(stage.day).toBeGreaterThan(data.stages[index - 1].day);
      }
    });
  });

  it("creates journey with custom email count", async () => {
    const { response, data } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify({
        goal: "Onboard new users",
        audience: "SaaS trial users",
        options: { emails: 7 }
      })
    });

    expect(response.status).toBe(200);
    expect(data.stages.length).toBe(7);
  });

  it("requires authentication", async () => {
    const response = await fetch(`${CONVEX_SITE_URL}/journeys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockJourneyPayload)
    });

    expect(response.status).toBe(401);
  });

  it("validates required fields", async () => {
    const { response, data } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify({
        // Missing goal and audience
        options: { emails: 5 }
      })
    });

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("handles missing goal", async () => {
    const { response } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify({
        audience: "Test audience"
      })
    });

    expect(response.status).toBe(400);
  });

  it("handles missing audience", async () => {
    const { response } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify({
        goal: "Test goal"
      })
    });

    expect(response.status).toBe(400);
  });

  it("accepts optional default_reply_to", async () => {
    const { response, data } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify({
        ...mockJourneyPayload,
        options: {
          emails: 5,
          default_reply_to: "custom@example.com"
        }
      })
    });

    expect(response.status).toBe(200);
    expect(data.default_reply_to).toBe("custom@example.com");
  });

  it("journey stages include proper merge tags", async () => {
    const { response, data } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify(mockJourneyPayload)
    });

    expect(response.status).toBe(200);

    // Check that stages use common merge tags
    const allContent = data.stages.map((s: any) => s.subject + " " + s.body).join(" ");
    const hasPersonalization =
      allContent.includes("{{name}}") ||
      allContent.includes("{{company}}") ||
      allContent.includes("{{email}}");

    expect(hasPersonalization).toBe(true);
  });
});
