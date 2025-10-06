import { TemplateContext } from "../../convex/lib/templates";

export const mockTemplateContext: TemplateContext = {
  email: "test@example.com",
  name: "Test User",
  company: "Test Co",
  unsubscribe_url: "https://example.com/u/123",
  enrollment_id: "enr_123",
  journey_name: "Test Journey"
};

export const mockJourneyPayload = {
  goal: "Convert trial users to paid customers",
  audience: "B2B SaaS trial users",
  options: { emails: 5 }
};

export const mockEnrollmentPayload = (journeyId: string, email?: string) => ({
  journey_id: journeyId,
  contact: {
    email: email || "test@example.com",
    data: {
      name: "Test User",
      company: "Test Company"
    }
  }
});

export const mockStages = [
  {
    day: 0,
    subject: "Welcome to {{journey_name}}",
    body: "<p>Hi {{name}}!</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>"
  },
  {
    day: 3,
    subject: "Quick question for {{name}}",
    body: "<p>Hi {{name}} from {{company}},</p><p>How are you?</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>"
  },
  {
    day: 7,
    subject: "Getting started with {{company}}",
    body: "<p>Hello {{default name \"there\"}},</p><p>Let's get started!</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>"
  }
];
