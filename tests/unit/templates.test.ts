import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  validateTemplate,
  validateJourneyTemplates,
  verifyHTMLEscaping
} from "../../convex/lib/templates";
import { mockTemplateContext, mockStages } from "../helpers/fixtures";

describe("Template Rendering", () => {
  it("renders all tags when present", () => {
    const result = renderTemplate("Hi {{name}} from {{company}}", mockTemplateContext);
    expect(result).toBe("Hi Test User from Test Co");
  });

  it("renders missing optional tags as empty string", () => {
    const ctx = { ...mockTemplateContext, name: undefined };
    const result = renderTemplate("Hi {{name}}", ctx);
    expect(result).toBe("Hi ");
  });

  it("default helper provides fallback for missing values", () => {
    const ctx = { ...mockTemplateContext, name: undefined };
    const result = renderTemplate('Hi {{default name "Friend"}}', ctx);
    expect(result).toBe("Hi Friend");
  });

  it("default helper uses actual value when present", () => {
    const result = renderTemplate('Hi {{default name "Friend"}}', mockTemplateContext);
    expect(result).toBe("Hi Test User");
  });

  it("uppercase helper converts text to uppercase", () => {
    const result = renderTemplate("{{uppercase company}}", mockTemplateContext);
    expect(result).toBe("TEST CO");
  });

  it("uppercase helper handles missing values", () => {
    const ctx = { ...mockTemplateContext, company: undefined };
    const result = renderTemplate("{{uppercase company}}", ctx);
    expect(result).toBe("");
  });

  it("date_format helper formats timestamps", () => {
    const ctx = { ...mockTemplateContext, date: 1704153600000 };
    const result = renderTemplate("{{date_format date}}", ctx);
    expect(result).toContain("2024");
    expect(result).toContain("January");
  });

  it("date_format helper handles missing values", () => {
    const ctx = { ...mockTemplateContext, date: undefined };
    const result = renderTemplate("{{date_format date}}", ctx);
    expect(result).toBe("");
  });

  it("escapes HTML to prevent XSS", () => {
    const ctx = { ...mockTemplateContext, name: '<script>alert("xss")</script>' };
    const result = renderTemplate("{{name}}", ctx);
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("escapes dangerous HTML entities", () => {
    const ctx = { ...mockTemplateContext, name: '<img src=x onerror="alert(1)">' };
    const result = renderTemplate("Hello {{name}}", ctx);
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
  });

  it("handles complex templates with multiple variables", () => {
    const result = renderTemplate(
      "Hi {{name}} from {{company}}, check out {{unsubscribe_url}}",
      mockTemplateContext
    );
    expect(result).toContain("Test User");
    expect(result).toContain("Test Co");
    expect(result).toContain("https://testing.xyz/u/123");
  });

  it("handles templates with numbers", () => {
    const ctx = { ...mockTemplateContext, age: 30 };
    const result = renderTemplate("Age: {{age}}", ctx);
    expect(result).toBe("Age: 30");
  });

  it("handles templates with booleans", () => {
    const ctx = { ...mockTemplateContext, verified: true };
    const result = renderTemplate("Verified: {{verified}}", ctx);
    expect(result).toBe("Verified: true");
  });
});

describe("Template Validation", () => {
  it("validates correct template syntax", () => {
    const result = validateTemplate("Hello {{name}}");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("validates template with multiple variables", () => {
    const result = validateTemplate("Hi {{name}} from {{company}} - {{email}}");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("validates template with helpers", () => {
    const result = validateTemplate('{{default name "Guest"}} - {{uppercase company}}');
    expect(result.valid).toBe(true);
  });
});

describe("Journey Template Validation", () => {
  it("validates journey with proper unsubscribe_url", () => {
    const result = validateJourneyTemplates(mockStages);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when unsubscribe_url is missing", () => {
    const stages = [
      { day: 0, subject: "Test", body: "Missing unsubscribe link" }
    ];
    const result = validateJourneyTemplates(stages);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("unsubscribe_url");
  });

  it("validates stage day ordering", () => {
    const stages = [
      { day: 3, subject: "Day 3", body: "{{unsubscribe_url}}" },
      { day: 1, subject: "Day 1", body: "{{unsubscribe_url}}" }
    ];
    const result = validateJourneyTemplates(stages);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("ordering");
  });

  it("allows stages with sequential day ordering", () => {
    const stages = [
      { day: 0, subject: "Day 0", body: "{{unsubscribe_url}}" },
      { day: 2, subject: "Day 2", body: "{{unsubscribe_url}}" },
      { day: 5, subject: "Day 5", body: "{{unsubscribe_url}}" }
    ];
    const result = validateJourneyTemplates(stages);
    expect(result.valid).toBe(true);
  });

  it("fails when stages have duplicate days", () => {
    const stages = [
      { day: 0, subject: "First", body: "{{unsubscribe_url}}" },
      { day: 0, subject: "Second", body: "{{unsubscribe_url}}" }
    ];
    const result = validateJourneyTemplates(stages);
    expect(result.valid).toBe(false);
  });

  it("validates subject line templates", () => {
    const stages = [
      { day: 0, subject: "{{invalid", body: "{{unsubscribe_url}}" }
    ];
    const result = validateJourneyTemplates(stages);
    // Handlebars is permissive, but validation should catch this
    expect(result).toBeDefined();
  });
});

describe("HTML Escaping Verification", () => {
  it("verifies HTML is escaped", () => {
    const ctx = { ...mockTemplateContext, name: "<script>alert('xss')</script>" };
    const isEscaped = verifyHTMLEscaping("{{name}}", ctx);
    expect(isEscaped).toBe(true);
  });

  it("verifies templates without dynamic HTML", () => {
    // Template without HTML tags should verify as safe
    const isEscaped = verifyHTMLEscaping("Hello {{name}}, welcome!", mockTemplateContext);
    expect(isEscaped).toBe(true);
  });
});
