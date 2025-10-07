# Journey Retrieval (GET /journeys/:id)

## Overview
Add a new `GET /journeys/:id` endpoint to retrieve full journey details including name, stages, stats, and metadata.

## Context
Currently, there's no way to retrieve a single journey's details via the API. Users can only see journey data when they create it or view analytics. This endpoint enables:
- Fetching journey configuration to display in UI
- Inspecting current stage definitions
- Checking journey status (is_active)
- Building journey management dashboards

## Implementation Steps

### 1. Add `getJourneyById` Query

**File:** `convex/queries.ts`
**Location:** Add at the end of the file

**Add this new query:**

```typescript
/**
 * Get journey by ID
 */
export const getJourneyById = query({
  args: {
    journey_id: v.id("journeys"),
    account_id: v.id("accounts")
  },
  returns: v.union(
    v.object({
      _id: v.id("journeys"),
      _creationTime: v.number(),
      account_id: v.id("accounts"),
      name: v.string(),
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
      created_at: v.number()
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const journey = await ctx.db.get(args.journey_id);

    // Return null if not found
    if (!journey) {
      return null;
    }

    // Check authorization - journey must belong to the account
    if (journey.account_id !== args.account_id) {
      return null;
    }

    return journey;
  }
});
```

### 2. Add GET /journeys/:id HTTP Endpoint

**File:** `convex/http.ts`
**Location:** After the existing POST /journeys endpoint and before POST /enrollments (around line 110)

**Add this new route:**

```typescript
// Get journey by ID endpoint
http.route({
  pathPrefix: "/journeys/",
  method: "GET",
  handler: authenticatedAction(async (ctx, request, account) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(p => p);

    // This handler matches /journeys/*
    // We need to exclude /journeys/:id/analytics (handled by existing route)
    // Format: /journeys/:id where id is the journey ID
    if (pathParts.length !== 2) {
      return new Response("Not Found", { status: 404 });
    }

    // Check if this is the analytics endpoint (handled elsewhere)
    if (pathParts[1] === "analytics") {
      return new Response("Not Found", { status: 404 });
    }

    const journeyId = pathParts[1];

    // Validate journey ID format (starts with 'jd')
    if (!journeyId.startsWith("jd")) {
      return errorResponse(
        "invalid_request",
        "Invalid journey ID format",
        {},
        400
      );
    }

    // Get journey
    const journey = await ctx.runQuery(api.queries.getJourneyById, {
      journey_id: journeyId as Id<"journeys">,
      account_id: account._id
    }).catch(() => null);

    if (!journey) {
      return errorResponse(
        "journey_not_found",
        "Journey not found",
        {},
        404
      );
    }

    return new Response(
      JSON.stringify({
        journey_id: journey._id,
        name: journey.name,
        goal: journey.goal,
        audience: journey.audience,
        stages: journey.stages,
        is_active: journey.is_active,
        default_reply_to: journey.default_reply_to,
        default_tags: journey.default_tags,
        stats: journey.stats,
        created_at: new Date(journey.created_at).toISOString()
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  })
});
```

**IMPORTANT:** This route must be placed BEFORE the existing `/journeys/:id/analytics` route (currently at line 250) to avoid conflicts. The order matters in HTTP routing.

### 3. Update Route Ordering

**File:** `convex/http.ts`
**Action:** Ensure routes are in this order:

1. `POST /journeys` (line 62)
2. **NEW:** `GET /journeys/:id` (insert around line 110)
3. `POST /enrollments` (line 111)
4. ... other routes ...
5. `GET /journeys/:id/analytics` (line 250)

The more specific route (`/journeys/:id/analytics`) should come after the general route (`/journeys/:id`).

**Alternative:** Modify the new GET handler to explicitly route analytics requests:

```typescript
// Inside the GET /journeys/:id handler, before getting journey:
if (pathParts.length === 3 && pathParts[2] === "analytics") {
  // Let this fall through to the analytics handler
  return new Response("Not Found", { status: 404 });
}
```

## Testing Steps

### Test 1: Get Journey (Happy Path)

**Setup:** First create a journey and capture its ID:

```bash
# Create a manual journey
JOURNEY_RESPONSE=$(curl -s -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Get Journey",
    "stages": [
      {"day": 0, "subject": "Day 0", "body": "Welcome {{unsubscribe_url}}"},
      {"day": 5, "subject": "Day 5", "body": "Follow up {{unsubscribe_url}}"}
    ]
  }')

JOURNEY_ID=$(echo $JOURNEY_RESPONSE | jq -r '.journey_id')
echo "Created journey: $JOURNEY_ID"

# Now get the journey
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123"
```

**Expected Result:**
- Status: 200
- Response includes:
  - `journey_id` (matches created ID)
  - `name`: "Test Get Journey"
  - `stages`: array with 2 stages (day 0 and day 5)
  - `is_active`: true
  - `stats`: all zeros (newly created)
  - `created_at`: ISO timestamp

### Test 2: Journey Not Found

```bash
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/jd7nonexistent123" \
  -H "X-API-Key: test-api-key-123"
```

**Expected Result:**
- Status: 404
- Error code: "journey_not_found"

### Test 3: Invalid Journey ID Format

```bash
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/invalid-id" \
  -H "X-API-Key: test-api-key-123"
```

**Expected Result:**
- Status: 400
- Error code: "invalid_request"
- Message: "Invalid journey ID format"

### Test 4: Unauthorized Access (Different Account)

This requires two API keys. If you have access to another test account:

```bash
# Create journey with account A
JOURNEY_RESPONSE=$(curl -s -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Account A Journey",
    "stages": [{"day": 0, "subject": "Test", "body": "Test {{unsubscribe_url}}"}]
  }')

JOURNEY_ID=$(echo $JOURNEY_RESPONSE | jq -r '.journey_id')

# Try to access with account B
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: different-api-key-456"
```

**Expected Result:**
- Status: 404 (for security, don't reveal existence)
- Error code: "journey_not_found"

### Test 5: Get Journey with Enrollments (Verify Stats)

```bash
# Create journey
JOURNEY_RESPONSE=$(curl -s -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Stats Test Journey",
    "stages": [{"day": 0, "subject": "Test", "body": "Test {{unsubscribe_url}}"}]
  }')

JOURNEY_ID=$(echo $JOURNEY_RESPONSE | jq -r '.journey_id')

# Enroll a contact
curl -X POST https://focused-bloodhound-276.convex.site/enrollments \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d "{
    \"journey_id\": \"$JOURNEY_ID\",
    \"contact\": {
      \"email\": \"stats-test@example.com\",
      \"data\": {\"name\": \"Stats Tester\"}
    }
  }"

# Get journey and check stats
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" | jq '.stats'
```

**Expected Result:**
- Stats show updated enrollment count
- `total_enrolled` should be >= 1

### Test 6: Ensure Analytics Endpoint Still Works

```bash
# Use journey from previous test
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID/analytics" \
  -H "X-API-Key: test-api-key-123"
```

**Expected Result:**
- Status: 200
- Response includes analytics data (different structure than journey details)
- Verify this endpoint still works and isn't broken by the new route

### Test 7: Authentication Required

```bash
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/jd7abc123" \
  -H "Content-Type: application/json"
```

**Expected Result:**
- Status: 401
- Error: Missing or invalid X-API-Key

## Success Criteria

- ✅ GET /journeys/:id returns full journey details
- ✅ Authorization check ensures only account owner can access
- ✅ Returns 404 for non-existent journeys
- ✅ Returns 400 for invalid journey ID format
- ✅ Analytics endpoint (`/journeys/:id/analytics`) continues to work
- ✅ All 7 test cases pass

## Notes

- **Security:** Journey access is restricted to the owning account via `account_id` check
- **Route Ordering:** The new GET handler must handle both `/journeys/:id` and allow `/journeys/:id/analytics` to pass through
- **Response Format:** Returns journey exactly as stored in DB with ISO timestamp for `created_at`
- **Performance:** Single DB lookup via `ctx.db.get()` - very fast
