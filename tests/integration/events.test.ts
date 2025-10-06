import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, generateTestEmail, CONVEX_SITE_URL } from "../helpers/api";
import { mockJourneyPayload } from "../helpers/fixtures";

describe("POST /events", () => {
  let journeyId: string;
  let testEmail: string;

  beforeAll(async () => {
    // Create journey and enrollment for testing events
    const { data: journeyData } = await apiRequest("/journeys", {
      method: "POST",
      body: JSON.stringify(mockJourneyPayload)
    });
    journeyId = journeyData.journey_id;

    testEmail = generateTestEmail();
    await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: {
          email: testEmail,
          data: { name: "Event Test User" }
        }
      })
    });
  });

  it("tracks conversion event", async () => {
    const email = generateTestEmail();

    // Create enrollment first
    await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: { email, data: { name: "Conversion Test" } }
      })
    });

    const { response, data } = await apiRequest("/events", {
      method: "POST",
      body: JSON.stringify({
        type: "conversion",
        contact_email: email,
        journey_id: journeyId
      })
    });

    expect(response.status).toBe(200);
    expect(data.event_id).toBeDefined();
    expect(data.success).toBe(true);
  });

  it("tracks unsubscribe event", async () => {
    const email = generateTestEmail();

    // Create enrollment first
    await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: { email, data: { name: "Unsubscribe Test" } }
      })
    });

    const { response, data } = await apiRequest("/events", {
      method: "POST",
      body: JSON.stringify({
        type: "unsubscribe",
        contact_email: email,
        journey_id: journeyId
      })
    });

    expect(response.status).toBe(200);
    expect(data.event_id).toBeDefined();
  });

  it("tracks custom event with metadata", async () => {
    const { response, data } = await apiRequest("/events", {
      method: "POST",
      body: JSON.stringify({
        type: "custom",
        contact_email: testEmail,
        metadata: {
          action: "clicked_demo",
          page: "/demo",
          timestamp: Date.now()
        }
      })
    });

    expect(response.status).toBe(200);
    expect(data.event_id).toBeDefined();
  });

  it("validates event type", async () => {
    const { response, data } = await apiRequest("/events", {
      method: "POST",
      body: JSON.stringify({
        type: "invalid_type",
        contact_email: testEmail
      })
    });

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe("invalid_event_type");
  });

  it("requires contact_email", async () => {
    const { response } = await apiRequest("/events", {
      method: "POST",
      body: JSON.stringify({
        type: "conversion"
      })
    });

    expect(response.status).toBe(400);
  });

  it("handles global conversion (without journey_id)", async () => {
    const email = generateTestEmail();

    // Create enrollment in any journey
    await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: { email, data: { name: "Global Conversion" } }
      })
    });

    const { response, data } = await apiRequest("/events", {
      method: "POST",
      body: JSON.stringify({
        type: "conversion",
        contact_email: email
      })
    });

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("handles global unsubscribe (without journey_id)", async () => {
    const email = generateTestEmail();

    await apiRequest("/enrollments", {
      method: "POST",
      body: JSON.stringify({
        journey_id: journeyId,
        contact: { email, data: { name: "Global Unsub" } }
      })
    });

    const { response, data } = await apiRequest("/events", {
      method: "POST",
      body: JSON.stringify({
        type: "unsubscribe",
        contact_email: email
      })
    });

    expect(response.status).toBe(200);
  });

  it("requires authentication", async () => {
    const response = await fetch(`${CONVEX_SITE_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "conversion",
        contact_email: testEmail
      })
    });

    expect(response.status).toBe(401);
  });
});
