# Manual Journey Creation (POST /journeys with manual mode)

## Overview
Extend the existing `POST /journeys` endpoint to support manual journey creation where users can specify custom stages, copy, and timing without AI generation.

## Context
Currently, `POST /journeys` only supports AI-generated journeys by providing `goal` and `audience`. This issue adds support for manual journey creation where users provide the exact stages array.

## Implementation Steps

### 1. Add `createManualJourney` Mutation

**File:** `convex/mutations.ts`
**Location:** After `createJourneyFromGenerated` function (after line 73)

**Add this new mutation:**

```typescript
/**
 * Create journey with manual/custom stages (no AI generation)
 */
export const createManualJourney = mutation({
  args: {
    account_id: v.id("accounts"),
    name: v.string(),
    goal: v.optional(v.string()),
    audience: v.optional(v.string()),
    stages: v.array(v.object({
      day: v.number(),
      subject: v.string(),
      body: v.string()
    })),
    default_reply_to: v.optional(v.string()),
    default_tags: v.optional(v.any())
  },
  returns: v.object({
    journeyId: v.id("journeys")
  }),
  handler: async (ctx, args) => {
    // Validate stages array is not empty
    if (args.stages.length === 0) {
      throw new APIError(
        "invalid_request",
        "Journey must have at least one stage",
        {},
        400
      );
    }

    // Validate day ordering (must be >= 0 and in ascending order)
    for (let i = 0; i < args.stages.length; i++) {
      if (args.stages[i].day < 0) {
        throw new APIError(
          "invalid_request",
          `Stage ${i + 1}: day must be >= 0`,
          { stage: i, day: args.stages[i].day },
          400
        );
      }
      if (i > 0 && args.stages[i].day <= args.stages[i - 1].day) {
        throw new APIError(
          "invalid_request",
          `Stage ${i + 1}: days must be in ascending order`,
          { stage: i, day: args.stages[i].day, previous_day: args.stages[i - 1].day },
          400
        );
      }
    }

    // Validate templates using existing validation
    const validation = validateJourneyTemplates(args.stages);
    if (!validation.valid) {
      throw new APIError(
        "invalid_templates",
        "Journey has invalid templates",
        { errors: validation.errors },
        400
      );
    }

    // Create journey record
    const journeyId = await ctx.db.insert("journeys", {
      account_id: args.account_id,
      name: args.name,
      goal: args.goal || "",
      audience: args.audience || "",
      stages: args.stages,
      is_active: true,
      default_reply_to: args.default_reply_to,
      default_tags: args.default_tags,
      stats: {
        total_enrolled: 0,
        total_completed: 0,
        total_converted: 0,
        total_bounced: 0,
        total_complained: 0,
        open_rate: 0,
        click_rate: 0
      },
      created_at: Date.now()
    });

    return { journeyId };
  }
});
```

### 2. Update POST /journeys HTTP Endpoint

**File:** `convex/http.ts`
**Location:** Replace the existing POST /journeys handler (lines 62-109)

**Replace with:**

```typescript
// Create journey endpoint (PRD Section 3.1, 9.1)
// Supports both AI-generated and manual journey creation
http.route({
  path: "/journeys",
  method: "POST",
  handler: authenticatedAction(async (ctx, request, account) => {
    const body = await request.json();

    // Detect mode: if 'stages' is provided -> manual mode, else -> AI mode
    const isManualMode = body.stages && Array.isArray(body.stages);

    if (isManualMode) {
      // Manual journey creation
      if (!body.name) {
        return errorResponse(
          "invalid_request",
          "Missing required field: name",
          {},
          400
        );
      }

      if (!body.stages || body.stages.length === 0) {
        return errorResponse(
          "invalid_request",
          "Missing required field: stages (must be non-empty array)",
          {},
          400
        );
      }

      // Create manual journey (via mutation)
      const result = await ctx.runMutation(api.mutations.createManualJourney, {
        account_id: account._id,
        name: body.name,
        goal: body.goal,
        audience: body.audience,
        stages: body.stages,
        default_reply_to: body.options?.default_reply_to,
        default_tags: body.options?.default_tags
      });

      return new Response(
        JSON.stringify({
          journey_id: result.journeyId,
          name: body.name,
          mode: "manual",
          stages: body.stages
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } else {
      // AI-generated journey (existing logic)
      if (!body.goal || !body.audience) {
        return errorResponse(
          "invalid_request",
          "Missing required fields: goal and audience",
          {},
          400
        );
      }

      const emailCount = body.options?.emails || 5;

      // Generate journey with AI (via action)
      const { journey, usedFallback } = await ctx.runAction(api.actions.generateJourneyAction, {
        goal: body.goal,
        audience: body.audience,
        emailCount: emailCount
      });

      // Create journey record (via mutation)
      const result = await ctx.runMutation(api.mutations.createJourneyFromGenerated, {
        account_id: account._id,
        goal: body.goal,
        audience: body.audience,
        journey: journey,
        default_reply_to: body.options?.default_reply_to
      });

      return new Response(
        JSON.stringify({
          journey_id: result.journeyId,
          name: journey.name,
          mode: "ai",
          default_reply_to: body.options?.default_reply_to,
          stages: journey.stages
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  })
});
```

## Testing Steps

### Test 1: Manual Journey Creation (Happy Path)

```bash
curl -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Manual Test Journey",
    "stages": [
      {
        "day": 0,
        "subject": "Welcome to GTM OS",
        "body": "Hi {{name}}, welcome! {{unsubscribe_url}}"
      },
      {
        "day": 3,
        "subject": "How are things going?",
        "body": "Hey {{name}}, checking in. {{unsubscribe_url}}"
      },
      {
        "day": 7,
        "subject": "Week 1 Complete",
        "body": "Hi {{name}}, congrats on week 1! {{unsubscribe_url}}"
      }
    ],
    "goal": "Onboarding",
    "audience": "New users",
    "options": {
      "default_reply_to": "support@example.com"
    }
  }'
```

**Expected Result:**
- Status: 200
- Response includes `journey_id`, `name`, `mode: "manual"`, and `stages` array

### Test 2: AI Journey Creation (Ensure Backward Compatibility)

```bash
curl -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Convert trial users to paid",
    "audience": "SaaS startups",
    "options": {
      "emails": 5
    }
  }'
```

**Expected Result:**
- Status: 200
- Response includes `journey_id`, `name`, `mode: "ai"`, and `stages` array
- Should work exactly as before (no breaking changes)

### Test 3: Validation - Missing Name

```bash
curl -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "stages": [
      {"day": 0, "subject": "Test", "body": "Test {{unsubscribe_url}}"}
    ]
  }'
```

**Expected Result:**
- Status: 400
- Error: "Missing required field: name"

### Test 4: Validation - Empty Stages

```bash
curl -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Empty Journey",
    "stages": []
  }'
```

**Expected Result:**
- Status: 400
- Error: "Journey must have at least one stage"

### Test 5: Validation - Invalid Day Ordering

```bash
curl -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Order Journey",
    "stages": [
      {"day": 3, "subject": "Test", "body": "Test {{unsubscribe_url}}"},
      {"day": 1, "subject": "Test", "body": "Test {{unsubscribe_url}}"}
    ]
  }'
```

**Expected Result:**
- Status: 400
- Error: "Stage 2: days must be in ascending order"

### Test 6: Validation - Negative Day

```bash
curl -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Negative Day Journey",
    "stages": [
      {"day": -1, "subject": "Test", "body": "Test {{unsubscribe_url}}"}
    ]
  }'
```

**Expected Result:**
- Status: 400
- Error: "Stage 1: day must be >= 0"

### Test 7: Validation - Missing Unsubscribe URL

```bash
curl -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "No Unsub Journey",
    "stages": [
      {"day": 0, "subject": "Test", "body": "No unsubscribe link here"}
    ]
  }'
```

**Expected Result:**
- Status: 400
- Error: "Journey has invalid templates"
- Details should mention missing `{{unsubscribe_url}}`

### Test 8: Validation - Invalid Handlebars Syntax

```bash
curl -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Syntax Journey",
    "stages": [
      {"day": 0, "subject": "Test", "body": "Hello {{name {{unsubscribe_url}}"}
    ]
  }'
```

**Expected Result:**
- Status: 400
- Error: "Journey has invalid templates"
- Details should mention Handlebars syntax error

## Success Criteria

- ✅ POST /journeys supports both `stages` (manual) and `goal`/`audience` (AI) modes
- ✅ Manual mode validates: non-empty stages, day ordering, template syntax
- ✅ AI mode continues to work without any breaking changes
- ✅ All 8 test cases pass
- ✅ Response includes `mode` field ("manual" or "ai")

## Notes

- This change is **backward compatible** - existing AI mode usage continues to work
- Manual mode makes `goal` and `audience` optional (can be provided for metadata but not required)
- Template validation uses the existing `validateJourneyTemplates()` function from `convex/lib/templates.ts`
