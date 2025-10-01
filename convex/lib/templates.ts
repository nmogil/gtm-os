import Handlebars from "handlebars";
import { APIError } from "./errors";

// Register custom helpers (PRD Section 3.4)
Handlebars.registerHelper("default", function(value: any, defaultValue: string) {
  return value || defaultValue;
});

Handlebars.registerHelper("uppercase", function(value: string) {
  return value ? value.toUpperCase() : "";
});

Handlebars.registerHelper("date_format", function(timestamp: number) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
});

export interface TemplateContext {
  // Contact data
  name?: string;
  email: string;
  company?: string;
  [key: string]: any;

  // System-generated
  unsubscribe_url: string;
  enrollment_id: string;
  journey_name: string;
}

export function renderTemplate(
  template: string,
  context: TemplateContext
): string {
  try {
    // Handlebars escapes HTML by default for {{variable}} syntax
    // Use {{{variable}}} (triple braces) only if you need unescaped HTML
    const compiled = Handlebars.compile(template);
    return compiled(context);
  } catch (error: any) {
    throw new APIError(
      "template_render_failed",
      "Failed to render template",
      { template_preview: template.substring(0, 100) },
      500
    );
  }
}

// Helper to verify HTML escaping is working correctly
export function verifyHTMLEscaping(template: string, context: any): boolean {
  const rendered = renderTemplate(template, context);

  // If context contains HTML tags and template uses {{}} syntax,
  // the rendered output should have escaped HTML entities
  const hasEscapedHTML = rendered.includes("&lt;") || rendered.includes("&gt;") || rendered.includes("&amp;");
  const hasRawHTML = /<[^>]+>/.test(rendered);

  // Return true if dangerous HTML is escaped or no HTML present
  return !hasRawHTML || hasEscapedHTML;
}

export function validateTemplate(template: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    Handlebars.compile(template);
  } catch (error: any) {
    errors.push("Syntax error: " + error.message);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateJourneyTemplates(stages: Array<{
  day: number;
  subject: string;
  body: string;
}>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];

    // Validate templates
    const subjectValidation = validateTemplate(stage.subject);
    if (!subjectValidation.valid) {
      errors.push("Stage " + i + " subject has errors");
    }

    const bodyValidation = validateTemplate(stage.body);
    if (!bodyValidation.valid) {
      errors.push("Stage " + i + " body has errors");
    }

    // Check for required unsubscribe_url
    if (!stage.body.includes("{{unsubscribe_url}}")) {
      errors.push("Stage " + i + " missing unsubscribe_url");
    }

    // Validate stage ordering
    if (i > 0 && stage.day <= stages[i - 1].day) {
      errors.push("Stage " + i + " day ordering invalid");
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
