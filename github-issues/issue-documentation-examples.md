# Documentation and Examples for Manual Journey Management

## Overview
Update all user-facing documentation to include the new manual journey creation, retrieval, and update features.

## Context
This issue tracks documentation updates for the three new features:
1. Manual journey creation (POST /journeys with stages)
2. Journey retrieval (GET /journeys/:id)
3. Journey updates with versioning (PATCH /journeys/:id)

## Implementation Steps

### Step 1: Update API Documentation

**File:** `docs/API.md`

#### 1.1 Update POST /journeys Endpoint

**Location:** Find the "POST /journeys" section (around line 60)

**Replace with:**

```markdown
### POST /journeys

Create a new email journey. Supports two modes:
- **AI Mode**: Provide `goal` and `audience`, AI generates stages
- **Manual Mode**: Provide `name` and `stages` array with custom content

**AI Mode Request:**
```json
{
  "goal": "Convert trial users to paid customers",
  "audience": "B2B SaaS startups",
  "options": {
    "emails": 7,
    "default_reply_to": "support@example.com"
  }
}
```

**Manual Mode Request:**
```json
{
  "name": "Product Launch Sequence",
  "goal": "Launch new feature",       // Optional
  "audience": "Existing customers",   // Optional
  "stages": [
    {
      "day": 0,
      "subject": "🚀 New Feature Launch",
      "body": "Hi {{name}},\n\nWe're excited to announce... {{unsubscribe_url}}"
    },
    {
      "day": 3,
      "subject": "How's it going?",
      "body": "Hey {{name}},\n\nChecking in... {{unsubscribe_url}}"
    },
    {
      "day": 7,
      "subject": "One week milestone",
      "body": "Hi {{name}},\n\nCongrats... {{unsubscribe_url}}"
    }
  ],
  "options": {
    "default_reply_to": "support@example.com",
    "default_tags": {"campaign": "launch_2024"}
  }
}
```

**Stage Requirements:**
- `day`: Must be >= 0 and in ascending order (0, 3, 7, not 7, 3, 0)
- `subject`: Email subject line (supports Handlebars templates)
- `body`: Email body HTML (supports Handlebars templates)
- **Required:** Body must include `{{unsubscribe_url}}` template variable

**Response:**
```json
{
  "journey_id": "jd7fg1fa3kq2dncmm05323g1td7rnxse",
  "name": "Product Launch Sequence",
  "mode": "manual",
  "stages": [...],
  "default_reply_to": "support@example.com"
}
```

**Errors:**
- `400` - Invalid stages (empty array, wrong day order, missing unsubscribe_url)
- `400` - Invalid template syntax
- `401` - Invalid or missing API key
```

#### 1.2 Add GET /journeys/:id Endpoint

**Location:** After POST /journeys section

**Add:**

```markdown
### GET /journeys/:id

Retrieve full details for a specific journey.

**Request:**
```bash
GET /journeys/jd7fg1fa3kq2dncmm05323g1td7rnxse
X-API-Key: your-api-key
```

**Response:**
```json
{
  "journey_id": "jd7fg1fa3kq2dncmm05323g1td7rnxse",
  "name": "Product Launch Sequence",
  "version": 2,
  "goal": "Launch new feature",
  "audience": "Existing customers",
  "stages": [
    {
      "day": 0,
      "subject": "🚀 New Feature Launch",
      "body": "Hi {{name}},\n\nWe're excited..."
    }
  ],
  "is_active": true,
  "default_reply_to": "support@example.com",
  "default_tags": {"campaign": "launch_2024"},
  "stats": {
    "total_enrolled": 45,
    "total_completed": 12,
    "total_converted": 8,
    "total_bounced": 1,
    "total_complained": 0,
    "open_rate": 0.65,
    "click_rate": 0.32
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `404` - Journey not found or you don't have access
- `401` - Invalid or missing API key
```

#### 1.3 Add PATCH /journeys/:id Endpoint

**Location:** After GET /journeys/:id section

**Add:**

```markdown
### PATCH /journeys/:id

Update an existing journey. Supports updating metadata, full stage replacement, or partial stage updates.

**Important:** Existing active enrollments continue with their original stages. Only new enrollments will use the updated stages.

**Update Metadata Only (name, reply_to, etc.):**
```json
{
  "name": "Updated Journey Name",
  "default_reply_to": "newsupport@example.com",
  "is_active": false
}
```

**Full Stage Replacement:**
```json
{
  "stages": [
    {"day": 0, "subject": "New Day 0", "body": "New content {{unsubscribe_url}}"},
    {"day": 2, "subject": "New Day 2", "body": "More content {{unsubscribe_url}}"}
  ]
}
```

**Partial Stage Updates (by index):**
```json
{
  "stage_updates": [
    {
      "index": 0,
      "subject": "Updated Subject for Stage 0"
    },
    {
      "index": 2,
      "body": "Updated body for stage 2 {{unsubscribe_url}}"
    }
  ]
}
```

**Partial Stage Updates (by day):**
```json
{
  "stage_updates": [
    {
      "day": 3,
      "subject": "Updated Subject for Day 3 Email"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "journey_id": "jd7fg1fa3kq2dncmm05323g1td7rnxse",
  "version": 3
}
```

**Version Behavior:**
- Metadata updates (name, goal, is_active, reply_to) → version stays same
- Stage updates (full or partial) → version increments

**Errors:**
- `400` - Invalid update (both stages and stage_updates provided)
- `400` - Invalid stage ordering or missing unsubscribe_url
- `404` - Journey not found
- `403` - You don't have access to this journey
- `401` - Invalid or missing API key
```

### Step 2: Update Examples Documentation

**File:** `docs/EXAMPLES.md`

#### 2.1 Add "Manual Journey Creation" Example

**Location:** After "Recipe 1: Trial User Conversion Flow" (around line 50)

**Add:**

```markdown
## Recipe 2: Manual Journey Creation with Custom Timing

This example shows how to create a journey with precise control over email content and timing.

### Use Case
You have pre-written email copy for a product launch and want exact control over when each email sends.

### Node.js Example
```javascript
const axios = require('axios');

async function createManualJourney() {
  const response = await axios.post(
    'https://your-deployment.convex.site/journeys',
    {
      name: 'Q1 2024 Product Launch',
      goal: 'Drive adoption of new analytics feature',
      audience: 'Existing Pro customers',
      stages: [
        {
          day: 0,
          subject: '🚀 Introducing Advanced Analytics',
          body: `
            <html>
              <body>
                <h1>Hi {{name}},</h1>
                <p>We're thrilled to announce our new Advanced Analytics dashboard,
                built specifically for teams like yours at {{company}}.</p>

                <a href="https://app.example.com/analytics">Try it now</a>

                <p><small><a href="{{unsubscribe_url}}">Unsubscribe</a></small></p>
              </body>
            </html>
          `
        },
        {
          day: 2,
          subject: 'Quick tips for getting started',
          body: `
            <html>
              <body>
                <h1>Hey {{name}},</h1>
                <p>Here are 3 quick ways to get the most from Advanced Analytics...</p>
                <p><small><a href="{{unsubscribe_url}}">Unsubscribe</a></small></p>
              </body>
            </html>
          `
        },
        {
          day: 7,
          subject: 'Your first week with Analytics',
          body: `
            <html>
              <body>
                <h1>Hi {{name}},</h1>
                <p>It's been a week since we launched Advanced Analytics.
                Here's what other teams at companies like {{company}} are discovering...</p>
                <p><small><a href="{{unsubscribe_url}}">Unsubscribe</a></small></p>
              </body>
            </html>
          `
        },
        {
          day: 14,
          subject: 'Need help? We're here',
          body: `
            <html>
              <body>
                <h1>Hey {{name}},</h1>
                <p>Have questions about Analytics? Our team is here to help.</p>
                <p>Reply to this email or book a call.</p>
                <p><small><a href="{{unsubscribe_url}}">Unsubscribe</a></small></p>
              </body>
            </html>
          `
        }
      ],
      options: {
        default_reply_to: 'product@example.com',
        default_tags: {
          campaign: 'analytics_launch_q1',
          team: 'product'
        }
      }
    },
    {
      headers: {
        'X-API-Key': 'your-api-key',
        'Content-Type': 'application/json'
      }
    }
  );

  console.log('Journey created:', response.data.journey_id);
  return response.data;
}

createManualJourney();
```

### Python Example
```python
import requests

def create_manual_journey():
    response = requests.post(
        'https://your-deployment.convex.site/journeys',
        headers={
            'X-API-Key': 'your-api-key',
            'Content-Type': 'application/json'
        },
        json={
            'name': 'Q1 2024 Product Launch',
            'stages': [
                {
                    'day': 0,
                    'subject': '🚀 Introducing Advanced Analytics',
                    'body': f'''
                        <html>
                          <body>
                            <h1>Hi {{{{name}}}},</h1>
                            <p>We're thrilled to announce...</p>
                            <p><small><a href="{{{{unsubscribe_url}}}}">Unsubscribe</a></small></p>
                          </body>
                        </html>
                    '''
                },
                {
                    'day': 2,
                    'subject': 'Quick tips for getting started',
                    'body': '...'
                }
            ],
            'options': {
                'default_reply_to': 'product@example.com'
            }
        }
    )

    print(f"Journey created: {response.json()['journey_id']}")
    return response.json()

create_manual_journey()
```

### Key Points
- ✅ Full control over email copy and timing
- ✅ Days must be in ascending order (0, 2, 7, 14)
- ✅ Each body must include `{{unsubscribe_url}}`
- ✅ Supports Handlebars variables: `{{name}}`, `{{company}}`, etc.
```

#### 2.2 Add "Journey Update Workflows" Example

**Location:** After the manual creation example

**Add:**

```markdown
## Recipe 3: Updating Journey Content

This example shows how to update journey stages after creation.

### Scenario 1: Fix a Typo in One Email

**Node.js:**
```javascript
async function fixTypoInStage(journeyId) {
  // Get current journey to see what needs fixing
  const journey = await axios.get(
    `https://your-deployment.convex.site/journeys/${journeyId}`,
    { headers: { 'X-API-Key': 'your-api-key' } }
  );

  console.log('Current stage 2:', journey.data.stages[2]);

  // Update just the stage with the typo (stage index 2)
  const response = await axios.patch(
    `https://your-deployment.convex.site/journeys/${journeyId}`,
    {
      stage_updates: [
        {
          index: 2,
          subject: 'Corrected Subject Line Here'
        }
      ]
    },
    { headers: { 'X-API-Key': 'your-api-key' } }
  );

  console.log('Updated to version:', response.data.version);
}
```

### Scenario 2: A/B Test New Email Copy

**Node.js:**
```javascript
async function createABTest() {
  // Create original journey (control)
  const controlJourney = await axios.post(
    'https://your-deployment.convex.site/journeys',
    {
      name: 'Welcome Series - Control',
      stages: [
        { day: 0, subject: 'Welcome!', body: 'Original copy {{unsubscribe_url}}' }
      ]
    },
    { headers: { 'X-API-Key': 'your-api-key' } }
  );

  // Create variant journey (test)
  const testJourney = await axios.post(
    'https://your-deployment.convex.site/journeys',
    {
      name: 'Welcome Series - Test',
      stages: [
        { day: 0, subject: 'Welcome aboard! 🎉', body: 'New copy {{unsubscribe_url}}' }
      ]
    },
    { headers: { 'X-API-Key': 'your-api-key' } }
  );

  // Enroll 50% to each
  for (const user of users) {
    const journeyId = Math.random() < 0.5
      ? controlJourney.data.journey_id
      : testJourney.data.journey_id;

    await enrollUser(journeyId, user);
  }
}
```

### Scenario 3: Pause Journey for Maintenance

**Node.js:**
```javascript
async function pauseAndResumeJourney(journeyId) {
  // Pause journey (stops new enrollments)
  await axios.patch(
    `https://your-deployment.convex.site/journeys/${journeyId}`,
    { is_active: false },
    { headers: { 'X-API-Key': 'your-api-key' } }
  );

  console.log('Journey paused. Existing enrollments continue, new enrollments blocked.');

  // Do maintenance work...

  // Resume journey
  await axios.patch(
    `https://your-deployment.convex.site/journeys/${journeyId}`,
    { is_active: true },
    { headers: { 'X-API-Key': 'your-api-key' } }
  );

  console.log('Journey resumed.');
}
```

### Scenario 4: Replace Entire Email Sequence

**Node.js:**
```javascript
async function replaceEntireSequence(journeyId) {
  // Replace all stages with new content
  const response = await axios.patch(
    `https://your-deployment.convex.site/journeys/${journeyId}`,
    {
      name: 'Welcome Series v2',
      stages: [
        { day: 0, subject: 'Welcome!', body: 'New v2 content {{unsubscribe_url}}' },
        { day: 1, subject: 'Day 1', body: 'Faster followup {{unsubscribe_url}}' },
        { day: 3, subject: 'Day 3', body: 'Check in {{unsubscribe_url}}' }
      ]
    },
    { headers: { 'X-API-Key': 'your-api-key' } }
  );

  console.log('Journey updated to version:', response.data.version);
  console.log('⚠️  Note: Existing enrollments continue with original stages');
  console.log('New enrollments will use v2 stages');
}
```

### Key Points
- ✅ **Existing enrollments are not affected** - they continue with original stages
- ✅ Version increments only when stages change
- ✅ Metadata updates (name, is_active) don't change version
- ✅ Use `stage_updates` for partial changes, `stages` for full replacement
```

### Step 3: Update CLAUDE.md (Developer Guide)

**File:** `CLAUDE.md`

#### 3.1 Update "Core Features" Section

**Location:** Around line 20, in the list of core features

**Add:**

```markdown
- **Journey Creation**: AI-generated OR manual custom journeys
  - AI Mode: Provide goal/audience, get AI-generated stages
  - Manual Mode: Provide name and custom stages array
- **Journey Updates**: Update journey content with versioning
  - Metadata updates: name, reply_to, is_active
  - Full stage replacement or partial stage updates
  - Version tracking ensures existing enrollments use original stages
- **Journey Retrieval**: GET endpoint to fetch journey details
```

#### 3.2 Update "Key Files" Section

**Location:** End of file, around line 200

**Update the mutations entry:**

```markdown
- `convex/mutations.ts`: Database write operations
  - `createJourneyFromGenerated`: AI-generated journey creation
  - `createManualJourney`: Manual journey creation with custom stages
  - `updateJourney`: Update existing journey with versioning support
  - `createEnrollment`: Enrollment creation with stage snapshot
  - ... (other mutations)
```

**Update the schema section:**

```markdown
- `convex/schema.ts`: Database schema and indexes
  - Journeys table: Added `version` field for tracking updates
  - Enrollments table: Added `journey_version` and `stages_snapshot` for isolation
```

#### 3.3 Add "Journey Versioning" Section

**Location:** After "Idempotency System" section

**Add:**

```markdown
### Journey Versioning

GTM OS uses a versioning system to ensure active enrollments are not disrupted by journey updates.

**How It Works:**
1. Each journey has a `version` field (starts at 1)
2. When stages are updated, version increments
3. Each enrollment stores:
   - `journey_version`: Which version they enrolled with
   - `stages_snapshot`: Copy of stages at enrollment time
4. Enrollments always use their snapshot, never fetch from journey

**Benefits:**
- ✅ Safe to update journey content without breaking active enrollments
- ✅ Users complete journeys with consistent messaging
- ✅ Can track which version performed better for A/B tests

**Example Flow:**
```
1. Create journey v1 with 3 stages
2. User A enrolls (gets v1 snapshot)
3. Update journey to v2 with different copy
4. User B enrolls (gets v2 snapshot)
5. User A completes with v1, User B with v2 - no interference
```

**Implementation:**
- Snapshots stored in `enrollments.stages_snapshot` field
- Scheduler uses snapshot, not journey lookup
- GET /journeys/:id shows current version
- PATCH increments version only for stage changes
```

### Step 4: Update README Quick Start

**File:** `README.md`

#### 4.1 Update "Quick Start" Section

**Location:** Around line 50, after "Create a Journey"

**Update the example to show both modes:**

```markdown
### Create a Journey

**Option 1: AI-Generated Journey**
```bash
curl -X POST $DEPLOYMENT_URL/journeys \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "goal": "Convert trial users to paid",
    "audience": "B2B SaaS startups",
    "options": {"emails": 5}
  }'
```

**Option 2: Manual Journey (Custom Content)**
```bash
curl -X POST $DEPLOYMENT_URL/journeys \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Welcome Series",
    "stages": [
      {
        "day": 0,
        "subject": "Welcome aboard!",
        "body": "Hi {{name}}, welcome to our platform! {{unsubscribe_url}}"
      },
      {
        "day": 3,
        "subject": "Getting started tips",
        "body": "Hey {{name}}, here are some tips... {{unsubscribe_url}}"
      }
    ]
  }'
```

Response:
```json
{
  "journey_id": "jd7abc...",
  "name": "Welcome Series",
  "mode": "manual",
  "stages": [...]
}
```
```

## Testing Steps

### Test 1: Verify API.md Updates

**Manual Review:**
1. Open `docs/API.md`
2. Verify POST /journeys shows both AI and manual modes
3. Verify GET /journeys/:id section exists and is clear
4. Verify PATCH /journeys/:id shows all update modes
5. Check that versioning behavior is explained
6. Ensure all curl examples are correct

### Test 2: Verify EXAMPLES.md Updates

**Manual Review:**
1. Open `docs/EXAMPLES.md`
2. Find "Manual Journey Creation" example
3. Find "Journey Update Workflows" example
4. Check that code examples are syntactically correct
5. Verify examples cover common use cases:
   - Creating manual journey
   - Fixing typo with partial update
   - A/B testing approach
   - Pause/resume workflow
   - Full sequence replacement

### Test 3: Verify CLAUDE.md Updates

**Manual Review:**
1. Open `CLAUDE.md`
2. Check "Journey Versioning" section exists
3. Verify mutations list is updated
4. Confirm schema changes are documented

### Test 4: Test Documentation Examples

**Run the actual curl commands from docs:**

```bash
# From API.md - Manual Journey Creation
curl -X POST https://focused-bloodhound-276.convex.site/journeys \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Docs Test Journey",
    "stages": [
      {"day": 0, "subject": "Test", "body": "Test {{unsubscribe_url}}"}
    ]
  }'

# Capture journey_id
JOURNEY_ID="<journey_id_from_above>"

# From API.md - GET Journey
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123"

# From API.md - PATCH Journey
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/$JOURNEY_ID" \
  -H "X-API-Key: test-api-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Docs Test"
  }'
```

**Expected:** All examples work as documented

### Test 5: Copy-Paste Node.js Examples

**From EXAMPLES.md:**

1. Copy the "Manual Journey Creation" Node.js example
2. Save to `test-manual-journey.js`
3. Update API key and deployment URL
4. Run: `node test-manual-journey.js`

**Expected:** Journey created successfully

### Test 6: Verify Cross-Reference Links

**Manual Check:**
1. README.md links to API.md for detailed endpoint docs → Verify link works
2. EXAMPLES.md references TEMPLATES.md for template syntax → Verify link works
3. API.md mentions EXAMPLES.md for code samples → Add link if missing

## Success Criteria

- ✅ `docs/API.md` updated with all 3 new endpoints
- ✅ `docs/EXAMPLES.md` has 2 new recipes (manual creation, updates)
- ✅ `CLAUDE.md` documents versioning system
- ✅ `README.md` Quick Start shows both AI and manual modes
- ✅ All code examples are tested and work
- ✅ Documentation is clear and covers common use cases
- ✅ Cross-references between docs are correct

## Notes

- Use real curl examples that work with the test API key
- Keep code examples concise but complete
- Emphasize the versioning behavior - it's a key feature
- Include both Node.js and Python examples where appropriate
