import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

// Journey schema from PRD Section 7.1
export const journeySchema = z.object({
  name: z.string().describe("A clear, descriptive name for the journey"),
  stages: z.array(
    z.object({
      day: z.number().describe("Day offset from enrollment (0 = immediate)"),
      subject: z.string().describe("Email subject line with merge tags like {{name}}"),
      body: z.string().describe("HTML email body with {{unsubscribe_url}} required")
    })
  ).min(5).max(7)
});

export type JourneyStructure = z.infer<typeof journeySchema>;

export async function generateJourney(
  goal: string,
  audience: string,
  emailCount: number = 5
): Promise<JourneyStructure> {
  try {
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: journeySchema,
      prompt: createJourneyPrompt(goal, audience, emailCount),
      temperature: 0.7,
      maxRetries: 2
    });

    return object;
  } catch (error) {
    console.error("LLM generation failed:", error);
    throw error;
  }
}

function createJourneyPrompt(
  goal: string,
  audience: string,
  emailCount: number
): string {
  return "Create a " + emailCount + "-email nurture journey for:\n" +
    "Goal: " + goal + "\n" +
    "Audience: " + audience + "\n\n" +
    "Requirements:\n" +
    "- Space emails progressively (e.g., day 0, 2, 5, 8, 12)\n" +
    "- Include merge tags: {{name}}, {{company}}, {{email}}\n" +
    "- Use clear, friendly B2B tone\n" +
    "- Each email must include {{unsubscribe_url}} in body\n" +
    "- Subject lines should be compelling and specific\n" +
    "- Support dynamic personalization with any custom fields user provides";
}

// Default journey fallback (PRD Section 7.3)
export const DEFAULT_JOURNEY: JourneyStructure = {
  name: "Standard Nurture",
  stages: [
    {
      day: 0,
      subject: "Welcome to {{company}}, {{name}}",
      body: "<p>Hi {{default name \"there\"}},</p><p>Thanks for signing up!</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>"
    },
    {
      day: 2,
      subject: "Quick question, {{name}}",
      body: "<p>Hi {{name}},</p><p>How is your experience?</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>"
    },
    {
      day: 5,
      subject: "Getting started with {{company}}",
      body: "<p>Hi {{name}},</p><p>Here is how to get started...</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>"
    },
    {
      day: 8,
      subject: "See how others use {{company}}",
      body: "<p>Hi {{name}},</p><p>Check out this story...</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>"
    },
    {
      day: 12,
      subject: "Special offer for {{name}}",
      body: "<p>Hi {{default name \"there\"}},</p><p>Limited time offer...</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>"
    }
  ]
};

// AI generation with fallback
export async function generateJourneyWithFallback(
  goal: string,
  audience: string,
  emailCount: number = 5
): Promise<{ journey: JourneyStructure; usedFallback: boolean }> {
  try {
    const journey = await generateJourney(goal, audience, emailCount);
    return { journey, usedFallback: false };
  } catch (error) {
    console.error("AI generation failed, using fallback:", error);
    return { journey: DEFAULT_JOURNEY, usedFallback: true };
  }
}
