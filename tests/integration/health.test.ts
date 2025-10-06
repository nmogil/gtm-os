import { describe, it, expect } from "vitest";
import { apiRequest, CONVEX_SITE_URL } from "../helpers/api";

describe("GET /health", () => {
  it("returns health status with metrics", async () => {
    const { response, data } = await apiRequest("/health", {
      method: "GET"
    });

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
    expect(data.account_id).toBeDefined();
    expect(data.metrics).toBeDefined();
  });

  it("includes active enrollments metric", async () => {
    const { data } = await apiRequest("/health", {
      method: "GET"
    });

    expect(data.metrics.active_enrollments).toBeDefined();
    expect(typeof data.metrics.active_enrollments).toBe("number");
    expect(data.metrics.active_enrollments).toBeGreaterThanOrEqual(0);
  });

  it("includes pending sends metric", async () => {
    const { data } = await apiRequest("/health", {
      method: "GET"
    });

    expect(data.metrics.pending_sends).toBeDefined();
    expect(typeof data.metrics.pending_sends).toBe("number");
    expect(data.metrics.pending_sends).toBeGreaterThanOrEqual(0);
  });

  it("includes error rate metric", async () => {
    const { data } = await apiRequest("/health", {
      method: "GET"
    });

    expect(data.metrics.error_rate).toBeDefined();
    expect(typeof data.metrics.error_rate).toBe("number");
    expect(data.metrics.error_rate).toBeGreaterThanOrEqual(0);
    expect(data.metrics.error_rate).toBeLessThanOrEqual(1);
  });

  it("includes failed enrollments metric", async () => {
    const { data } = await apiRequest("/health", {
      method: "GET"
    });

    expect(data.metrics.failed_enrollments_24h).toBeDefined();
    expect(typeof data.metrics.failed_enrollments_24h).toBe("number");
    expect(data.metrics.failed_enrollments_24h).toBeGreaterThanOrEqual(0);
  });

  it("includes webhook processing lag metric", async () => {
    const { data } = await apiRequest("/health", {
      method: "GET"
    });

    expect(data.metrics.webhook_processing_lag).toBeDefined();
    expect(typeof data.metrics.webhook_processing_lag).toBe("number");
    expect(data.metrics.webhook_processing_lag).toBeGreaterThanOrEqual(0);
  });

  it("requires authentication", async () => {
    const response = await fetch(`${CONVEX_SITE_URL}/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    expect(response.status).toBe(401);
  });

  it("responds quickly (performance check)", async () => {
    const startTime = Date.now();

    const { response } = await apiRequest("/health", {
      method: "GET"
    });

    const responseTime = Date.now() - startTime;

    expect(response.status).toBe(200);
    expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
  });
});
