# Journey Updates with Versioning (PATCH /journeys/:id)

## Overview
Add support for updating existing journeys with versioning to ensure active enrollments continue with their original stages. Supports both full and partial stage updates.

## Context
Users need to be able to:
- Update journey metadata (name, goal, audience, reply_to, tags)
- Update stages (full replacement or partial updates)
- Pause/resume journeys (is_active flag)

**Critical Requirement:** Existing enrollments must continue with the stages they were enrolled with, not the updated stages. This prevents breaking user experiences mid-journey.

## Architecture: Journey Versioning

### Version Strategy
- Each journey has a `version` field (starts at 1)
- When stages are updated, version increments
- Enrollments store a `journey_version` snapshot
- Enrollments also store a `stages_snapshot` of the stages they're following

### Why Snapshot Stages in Enrollments?
- Prevents race conditions when journey is deleted/updated mid-enrollment
- Allows enrollments to complete independently of journey changes
- Enables reporting on which version of stages a user experienced

## Implementation Steps

### Step 1: Update Schema

**File:** `convex/schema.ts`

**1.1 Update `journeys` table** (line 24-47)

Add `version` field after `name`:

```typescript
journeys: defineTable({
  account_id: v.id("accounts"),
  name: v.string(),
  version: v.number(), // NEW: Track journey version
  goal: v.string(),
  audience: v.string(),
  stages: v.array(v.object({
    day: v.number(),
    subject: v.string(),
    body: v.string()
  })),
  is_active: v.boolean(),
  default_reply_to: v.optional(v.string()),
  default_tags: v.optional(v.any()),
  stats: v.object({
    total_enrolled: v.number(),
    total_completed: v.number(),
    total_converted: v.number(),
    total_bounced: v.number(),
    total_complained: v.number(),
    open_rate: v.number(),
    click_rate: v.number()
  }),
  created_at: v.number(),
  updated_at: v.optional(v.number()) // NEW: Track last update time
}).index("by_account", ["account_id"]),
```

**1.2 Update `enrollments` table** (line 49-76)

Add `journey_version` and `stages_snapshot` fields after `journey_id`:

```typescript
enrollments: defineTable({
  account_id: v.id("accounts"),
  journey_id: v.id("journeys"),
  journey_version: v.number(), // NEW: Which version of journey this enrollment uses
  stages_snapshot: v.array(v.object({ // NEW: Snapshot of stages at enrollment time
    day: v.number(),
    subject: v.string(),
    body: v.string()
  })),
  contact_email: v.string(),
  contact_data: v.any(),
  status: v.union(
    v.literal("active"),
    v.literal("completed"),
    v.literal("converted"),
    v.literal("removed"),
    v.literal("failed"),
    v.literal("suppressed")
  ),
  current_stage: v.number(),
  next_run_at: v.number(),
  enrolled_at: v.number(),
  test_mode: v.boolean(),
  retry_count: v.number(),
  last_error: v.optional(v.string()),
  reply_to: v.optional(v.string()),
  tags: v.optional(v.any()),
  custom_headers: v.optional(v.any())
})
  .index("by_account", ["account_id"])
  .index("by_journey", ["journey_id"])
  .index("by_status", ["status"])
  .index("by_next_run_at", ["next_run_at"])
  .index("by_account_journey_email", ["account_id", "journey_id", "contact_email"]),
```

### Step 2: Update Existing Mutations to Support Versioning

**File:** `convex/mutations.ts`

**2.1 Update `createJourneyFromGenerated`** (lines 23-73)

Add `version: 1` when creating journey:

```typescript
// Inside the handler, in the ctx.db.insert call (around line 51):
const journeyId = await ctx.db.insert("journeys", {
  account_id: args.account_id,
  name: args.journey.name,
  version: 1, // NEW: Initial version
  goal: args.goal,
  audience: args.audience,
  stages: args.journey.stages,
  is_active: true,
  default_reply_to: args.default_reply_to,
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
```

**2.2 Update `createManualJourney`** (from Issue #1)

Add `version: 1` when creating journey:

```typescript
// Inside the handler, in the ctx.db.insert call:
const journeyId = await ctx.db.insert("journeys", {
  account_id: args.account_id,
  name: args.name,
  version: 1, // NEW: Initial version
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
```

**2.3 Update `createEnrollment`** (lines 75-153)

Add version and stages snapshot to enrollment:

```typescript
// Inside createEnrollmentIdempotent function in convex/lib/idempotency.ts
// After line where journey is fetched (you'll need to fetch journey first):

export async function createEnrollmentIdempotent(
  ctx: MutationCtx,
  args: {
    account_id: Id<"accounts">;
    journey_id: Id<"journeys">;
    contact_email: string;
    contact_data: any;
    idempotency_key?: string;
  }
): Promise<{ enrollment: any; existing: boolean }> {
  // ... existing idempotency check code ...

  // Fetch journey to get current version and stages
  const journey = await ctx.db.get(args.journey_id);
  if (!journey) {
    throw new APIError("journey_not_found", "Journey not found", {}, 404);
  }

  if (!journey.is_active) {
    throw new APIError(
      "journey_inactive",
      "Cannot enroll in inactive journey",
      {},
      400
    );
  }

  // Create new enrollment with version and snapshot
  const enrollmentId = await ctx.db.insert("enrollments", {
    account_id: args.account_id,
    journey_id: args.journey_id,
    journey_version: journey.version, // NEW: Record version
    stages_snapshot: journey.stages, // NEW: Snapshot stages
    contact_email: args.contact_email,
    contact_data: args.contact_data,
    status: "active",
    current_stage: 0,
    next_run_at: Date.now(),
    enrolled_at: Date.now(),
    test_mode: false,
    retry_count: 0
  });

  // ... rest of the function ...
}
```

**Note:** You'll need to update `convex/lib/idempotency.ts` to fetch the journey and include version/snapshot.

### Step 3: Add Update Journey Mutation

**File:** `convex/mutations.ts`
**Location:** Add after `createManualJourney` function

```typescript
/**
 * Update existing journey with versioning support
 * Supports both full and partial stage updates
 */
export const updateJourney = mutation({
  args: {
    account_id: v.id("accounts"),
    journey_id: v.id("journeys"),
    name: v.optional(v.string()),
    goal: v.optional(v.string()),
    audience: v.optional(v.string()),
    stages: v.optional(v.array(v.object({
      day: v.number(),
      subject: v.string(),
      body: v.string()
    }))),
    stage_updates: v.optional(v.array(v.object({
      index: v.optional(v.number()), // Update by array index
      day: v.optional(v.number()),   // Or find by day number
      subject: v.optional(v.string()),
      body: v.optional(v.string())
    }))),
    is_active: v.optional(v.boolean()),
    default_reply_to: v.optional(v.string()),
    default_tags: v.optional(v.any())
  },
  returns: v.object({
    success: v.boolean(),
    version: v.number()
  }),
  handler: async (ctx, args) => {
    // Get journey and verify ownership
    const journey = await ctx.db.get(args.journey_id);
    if (!journey) {
      throw new APIError(
        "journey_not_found",
        "Journey not found",
        {},
        404
      );
    }

    if (journey.account_id !== args.account_id) {
      throw new APIError(
        "unauthorized",
        "You don't have access to this journey",
        {},
        403
      );
    }

    // Check for conflicting stage update methods
    if (args.stages && args.stage_updates) {
      throw new APIError(
        "invalid_request",
        "Cannot use both 'stages' (full replacement) and 'stage_updates' (partial) in same request",
        {},
        400
      );
    }

    // Build update object
    const updates: any = {};
    let stagesChanged = false;

    // Handle metadata updates (don't change version)
    if (args.name !== undefined) updates.name = args.name;
    if (args.goal !== undefined) updates.goal = args.goal;
    if (args.audience !== undefined) updates.audience = args.audience;
    if (args.is_active !== undefined) updates.is_active = args.is_active;
    if (args.default_reply_to !== undefined) updates.default_reply_to = args.default_reply_to;
    if (args.default_tags !== undefined) updates.default_tags = args.default_tags;

    // Handle full stage replacement
    if (args.stages) {
      if (args.stages.length === 0) {
        throw new APIError(
          "invalid_request",
          "Journey must have at least one stage",
          {},
          400
        );
      }

      // Validate day ordering
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

      // Validate templates
      const validation = validateJourneyTemplates(args.stages);
      if (!validation.valid) {
        throw new APIError(
          "invalid_templates",
          "Journey has invalid templates",
          { errors: validation.errors },
          400
        );
      }

      updates.stages = args.stages;
      stagesChanged = true;
    }

    // Handle partial stage updates
    if (args.stage_updates) {
      const updatedStages = [...journey.stages];

      for (const update of args.stage_updates) {
        let stageIndex: number;

        // Find stage by index or day
        if (update.index !== undefined) {
          stageIndex = update.index;
        } else if (update.day !== undefined) {
          stageIndex = updatedStages.findIndex(s => s.day === update.day);
          if (stageIndex === -1) {
            throw new APIError(
              "invalid_request",
              `No stage found with day ${update.day}`,
              { day: update.day },
              400
            );
          }
        } else {
          throw new APIError(
            "invalid_request",
            "Each stage_update must have either 'index' or 'day'",
            {},
            400
          );
        }

        // Validate index
        if (stageIndex < 0 || stageIndex >= updatedStages.length) {
          throw new APIError(
            "invalid_request",
            `Stage index ${stageIndex} out of bounds (0-${updatedStages.length - 1})`,
            { index: stageIndex },
            400
          );
        }

        // Apply partial update
        if (update.subject !== undefined) {
          updatedStages[stageIndex].subject = update.subject;
        }
        if (update.body !== undefined) {
          updatedStages[stageIndex].body = update.body;
        }
        // Note: can't update day in partial update to preserve ordering
      }

      // Validate updated templates
      const validation = validateJourneyTemplates(updatedStages);
      if (!validation.valid) {
        throw new APIError(
          "invalid_templates",
          "Updated journey has invalid templates",
          { errors: validation.errors },
          400
        );
      }

      updates.stages = updatedStages;
      stagesChanged = true;
    }

    // Increment version if stages changed
    if (stagesChanged) {
      updates.version = journey.version + 1;
    }

    // Always update timestamp if any changes
    if (Object.keys(updates).length > 0) {
      updates.updated_at = Date.now();
    }

    // Update journey
    await ctx.db.patch(args.journey_id, updates);

    return {
      success: true,
      version: stagesChanged ? journey.version + 1 : journey.version
    };
  }
});
```

### Step 4: Add PATCH /journeys/:id HTTP Endpoint

**File:** `convex/http.ts`
**Location:** After GET /journeys/:id endpoint (from Issue #2)

```typescript
// Update journey endpoint
http.route({
  pathPrefix: "/journeys/",
  method: "PATCH",
  handler: authenticatedAction(async (ctx, request, account) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(p => p);

    // Format: PATCH /journeys/:id
    if (pathParts.length !== 2) {
      return new Response("Not Found", { status: 404 });
    }

    const journeyId = pathParts[1];

    // Validate journey ID format
    if (!journeyId.startsWith("jd")) {
      return errorResponse(
        "invalid_request",
        "Invalid journey ID format",
        {},
        400
      );
    }

    const body = await request.json();

    // Update journey
    let result;
    try {
      result = await ctx.runMutation(api.mutations.updateJourney, {
        account_id: account._id,
        journey_id: journeyId as Id<"journeys">,
        name: body.name,
        goal: body.goal,
        audience: body.audience,
        stages: body.stages,
        stage_updates: body.stage_updates,
        is_active: body.is_active,
        default_reply_to: body.default_reply_to,
        default_tags: body.default_tags
      });
    } catch (error: any) {
      console.error("Journey update error:", error);

      const errorData = error.data || error;
      const code = errorData.code || "update_failed";
      const message = errorData.message || error.message || "Failed to update journey";
      const details = errorData.details || {};
      const statusCode = errorData.statusCode || 400;

      return errorResponse(code, message, details, statusCode);
    }

    return new Response(
      JSON.stringify({
        success: true,
        journey_id: journeyId,
        version: result.version
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  })
});
```

### Step 5: Update Message Scheduler

**File:** `convex/lib/scheduler.ts` or wherever messages are sent

**Important:** Ensure the scheduler uses `enrollment.stages_snapshot` instead of fetching stages from the journey. This ensures enrollments continue with their original stages.

Example change in scheduler:
```typescript
// BEFORE (fetching from journey):
const journey = await ctx.db.get(enrollment.journey_id);
const stage = journey.stages[enrollment.current_stage];

// AFTER (using snapshot):
const stage = enrollment.stages_snapshot[enrollment.current_stage];
```

## Testing Steps

### Test 1: Update Journey Name (Metadata Only)

```bash
# Create journey
JOURNEY_RESPONSE=$(curl -s -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Original Name",
    "stages": [{"day": 0, "subject": "Test", "body": "Test {{unsubscribe_url}}"}]
  }')

JOURNEY_ID=$(echo $JOURNEY_RESPONSE | jq -r '.journey_id')

# Update name
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name"
  }'

# Verify update
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" | jq '{name, version}'
```

**Expected Result:**
- PATCH returns `success: true`, `version: 1` (unchanged, metadata only)
- GET shows `name: "Updated Name"`, `version: 1`

### Test 2: Full Stage Replacement (Increment Version)

```bash
# Update stages completely
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "stages": [
      {"day": 0, "subject": "New Day 0", "body": "New body {{unsubscribe_url}}"},
      {"day": 2, "subject": "New Day 2", "body": "New body 2 {{unsubscribe_url}}"}
    ]
  }'

# Verify version incremented
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" | jq '{version, stages}'
```

**Expected Result:**
- PATCH returns `version: 2`
- GET shows `version: 2` and new stages

### Test 3: Partial Stage Update by Index

```bash
# Update specific stage by index
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "stage_updates": [
      {"index": 0, "subject": "Updated Subject for Stage 0"}
    ]
  }'

# Verify only subject changed
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" | jq '.stages[0]'
```

**Expected Result:**
- PATCH returns `version: 3`
- Stage 0 has new subject, but body and day unchanged

### Test 4: Partial Stage Update by Day

```bash
# Update stage by day number
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "stage_updates": [
      {"day": 2, "body": "Updated body for day 2 {{unsubscribe_url}}"}
    ]
  }'
```

**Expected Result:**
- PATCH returns `version: 4`
- Stage with day 2 has new body

### Test 5: Existing Enrollments Use Original Stages

```bash
# Create journey with version 1
JOURNEY_RESPONSE=$(curl -s -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Versioning Test",
    "stages": [
      {"day": 0, "subject": "V1 Subject", "body": "V1 Body {{unsubscribe_url}}"}
    ]
  }')

JOURNEY_ID=$(echo $JOURNEY_RESPONSE | jq -r '.journey_id')

# Enroll contact
curl -X POST https://focused-bloodhound-276.convex.site/enrollments \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d "{
    \"journey_id\": \"$JOURNEY_ID\",
    \"contact\": {
      \"email\": \"versioning-test@example.com\",
      \"data\": {\"name\": \"Test User\"}
    }
  }"

# Update journey stages (creates version 2)
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "stages": [
      {"day": 0, "subject": "V2 Subject", "body": "V2 Body {{unsubscribe_url}}"}
    ]
  }'

# Check enrollment still has V1 stages
# (Use Convex dashboard or a test query to verify enrollment.stages_snapshot and journey_version)
```

**Expected Result:**
- Enrollment has `journey_version: 1`
- Enrollment has `stages_snapshot` with "V1 Subject" and "V1 Body"
- Journey now has version 2 with "V2 Subject" and "V2 Body"
- When enrollment sends email, it uses V1 stages from snapshot

### Test 6: Pause/Resume Journey

```bash
# Pause journey
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false
  }'

# Try to enroll (should fail)
curl -X POST https://focused-bloodhound-276.convex.site/enrollments \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d "{
    \"journey_id\": \"$JOURNEY_ID\",
    \"contact\": {\"email\": \"should-fail@example.com\"}
  }"

# Resume journey
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": true
  }'
```

**Expected Result:**
- First PATCH succeeds, version unchanged (metadata only)
- Enrollment attempt fails with "journey_inactive" error
- Second PATCH succeeds, journey active again

### Test 7: Invalid Updates

```bash
# Try both full and partial update (conflict)
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "stages": [{"day": 0, "subject": "Full", "body": "Full {{unsubscribe_url}}"}],
    "stage_updates": [{"index": 0, "subject": "Partial"}]
  }'
```

**Expected Result:**
- Status: 400
- Error: "Cannot use both 'stages' and 'stage_updates' in same request"

### Test 8: Update Stage Without Unsubscribe URL

```bash
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "stage_updates": [
      {"index": 0, "body": "No unsubscribe link here"}
    ]
  }'
```

**Expected Result:**
- Status: 400
- Error: "Updated journey has invalid templates"

## Success Criteria

- ✅ Schema updated with `version`, `journey_version`, and `stages_snapshot` fields
- ✅ New journey creation sets version to 1
- ✅ Enrollments store version and stages snapshot
- ✅ PATCH endpoint supports metadata, full stage replacement, and partial updates
- ✅ Version increments only when stages change
- ✅ Existing enrollments continue with original stages (via snapshot)
- ✅ All 8 test cases pass

## Migration Notes

**Existing Data:** After deploying schema changes:

1. All existing journeys need `version: 1` added (Convex will auto-backfill with default)
2. All existing enrollments need:
   - `journey_version: 1`
   - `stages_snapshot` populated from their journey's current stages

**Migration Script** (run via Convex CLI):

```typescript
// convex/migrations/addVersioning.ts
import { internalMutation } from "./_generated/server";

export const migrateJourneysAndEnrollments = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx, args) => {
    // Update all journeys to version 1
    const journeys = await ctx.db.query("journeys").collect();
    for (const journey of journeys) {
      if (journey.version === undefined) {
        await ctx.db.patch(journey._id, { version: 1 });
      }
    }

    // Update all enrollments with version and snapshot
    const enrollments = await ctx.db.query("enrollments").collect();
    for (const enrollment of enrollments) {
      if (enrollment.journey_version === undefined) {
        const journey = await ctx.db.get(enrollment.journey_id);
        if (journey) {
          await ctx.db.patch(enrollment._id, {
            journey_version: journey.version || 1,
            stages_snapshot: journey.stages
          });
        }
      }
    }

    return null;
  }
});
```

Run with: `npx convex run migrations:migrateJourneysAndEnrollments`

## Notes

- **Version Semantics:** Version is an incrementing integer, not semantic versioning (1.0.0)
- **Partial Updates:** Can update subject/body but not day (to preserve ordering)
- **Snapshot Strategy:** Enrollments are self-contained with stage snapshots
- **Performance:** Snapshots add ~1KB per enrollment (acceptable trade-off for safety)
