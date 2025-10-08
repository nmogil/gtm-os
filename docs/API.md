# GTM OS API Reference

Base URL: `https://focused-bloodhound-276.convex.site`

## Authentication

All endpoints except `/u/:enrollment_id` (unsubscribe page) require the `X-API-Key` header:

```bash
X-API-Key: acct_xxxxx
```

### Optional: Resend API Key Override

You can override the account's default Resend API key on a per-request basis:

```bash
X-Resend-Key: re_xxxxx
```

This is useful for multi-tenant applications where different users have their own Resend accounts.

## Endpoints

### Health Check

**GET /health**

Returns system health and operational metrics.

**Request:**
```bash
curl -X GET "https://focused-bloodhound-276.convex.site/health" \
  -H "X-API-Key: YOUR_API_KEY"
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1704067200000,
  "account_id": "jx72w080b53f5nweh99n9b3ty57rmary",
  "metrics": {
    "active_enrollments": 127,
    "pending_sends": 43,
    "error_rate": 0.02,
    "failed_enrollments_24h": 5,
    "webhook_processing_lag": 0
  }
}
```

**Metrics:**
- `active_enrollments` - Total enrollments in "active" status
- `pending_sends` - Number of enrollments with `next_run_at` in the past (overdue)
- `error_rate` - Percentage of failed enrollments (failed / total)
- `failed_enrollments_24h` - Count of enrollments that failed in last 24 hours
- `webhook_processing_lag` - Number of unprocessed webhook events

---

### Create Journey

**POST /journeys**

Create a new email journey. Supports two modes:
- **AI Mode**: Provide `goal` and `audience`, AI generates stages
- **Manual Mode**: Provide `name` and `stages` array with custom content

**AI Mode Request:**
```bash
curl -X POST "https://focused-bloodhound-276.convex.site/journeys" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Convert trial users to paid within 14 days",
    "audience": "B2B SaaS trials who signed up in last 24h",
    "options": {
      "emails": 7,
      "default_reply_to": "support@yourcompany.com"
    }
  }'
```

**Manual Mode Request:**
```bash
curl -X POST "https://focused-bloodhound-276.convex.site/journeys" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Launch Sequence",
    "goal": "Launch new feature",
    "audience": "Existing customers",
    "stages": [
      {
        "day": 0,
        "subject": "🚀 New Feature Launch",
        "body": "Hi {{name}},\n\nWe'\''re excited to announce... {{unsubscribe_url}}"
      },
      {
        "day": 3,
        "subject": "How'\''s it going?",
        "body": "Hey {{name}},\n\nChecking in... {{unsubscribe_url}}"
      },
      {
        "day": 7,
        "subject": "One week milestone",
        "body": "Hi {{name}},\n\nCongrats... {{unsubscribe_url}}"
      }
    ],
    "options": {
      "default_reply_to": "support@yourcompany.com",
      "default_tags": {"campaign": "launch_2024"}
    }
  }'
```

**Parameters:**

*AI Mode:*
- `goal` (required) - The objective of the email journey
- `audience` (required) - Who the emails are targeting
- `options.emails` (optional) - Number of emails to generate (default: 5, max: 10)
- `options.default_reply_to` (optional) - Default Reply-To email address

*Manual Mode:*
- `name` (required) - Journey name
- `stages` (required) - Array of stage objects
  - `day` (required) - Day number (must be >= 0 and in ascending order)
  - `subject` (required) - Email subject (supports Handlebars)
  - `body` (required) - Email body HTML (supports Handlebars, must include `{{unsubscribe_url}}`)
- `goal` (optional) - Journey goal for analytics
- `audience` (optional) - Target audience for analytics
- `options.default_reply_to` (optional) - Default Reply-To email address
- `options.default_tags` (optional) - Default tags for all enrollments

**Response:**
```json
{
  "journey_id": "jd7fg1fa3kq2dncmm05323g1td7rnxse",
  "name": "Product Launch Sequence",
  "mode": "manual",
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
  "default_reply_to": "support@yourcompany.com"
}
```

**Errors:**
- `400` - Invalid stages (empty array, wrong day order, missing unsubscribe_url)
- `400` - Invalid template syntax
- `401` - Invalid or missing API key

**Notes:**
- AI mode uses OpenAI GPT-4 with fallback template if AI fails
- Manual mode gives full control over email content and timing
- Stage days must be in ascending order (0, 3, 7 not 7, 3, 0)
- All email bodies must include `{{unsubscribe_url}}` variable

---

### Get Journey

**GET /journeys/:id**

Retrieve full details for a specific journey.

**Request:**
```bash
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/jd7fg1fa3kq2dncmm05323g1td7rnxse" \
  -H "X-API-Key: YOUR_API_KEY"
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
  "default_reply_to": "support@yourcompany.com",
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

---

### Update Journey

**PATCH /journeys/:id**

Update an existing journey. Supports updating metadata, full stage replacement, or partial stage updates.

**Important:** Existing active enrollments continue with their original stages. Only new enrollments will use the updated stages.

**Update Metadata Only (name, reply_to, etc.):**
```bash
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/jd7fg1fa3kq2dncmm05323g1td7rnxse" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Journey Name",
    "default_reply_to": "newsupport@yourcompany.com",
    "is_active": false
  }'
```

**Full Stage Replacement:**
```bash
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/jd7fg1fa3kq2dncmm05323g1td7rnxse" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "stages": [
      {"day": 0, "subject": "New Day 0", "body": "New content {{unsubscribe_url}}"},
      {"day": 2, "subject": "New Day 2", "body": "More content {{unsubscribe_url}}"}
    ]
  }'
```

**Partial Stage Updates (by index):**
```bash
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/jd7fg1fa3kq2dncmm05323g1td7rnxse" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

**Partial Stage Updates (by day):**
```bash
curl -X PATCH "https://focused-bloodhound-276.convex.site/journeys/jd7fg1fa3kq2dncmm05323g1td7rnxse" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "stage_updates": [
      {
        "day": 3,
        "subject": "Updated Subject for Day 3 Email"
      }
    ]
  }'
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

---

### Enroll Contact

**POST /enrollments**

Enrolls a contact in a journey.

**Request:**
```bash
curl -X POST "https://focused-bloodhound-276.convex.site/enrollments" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "journey_id": "jd7fg1fa3kq2dncmm05323g1td7rnxse",
    "contact": {
      "email": "user@company.com",
      "data": {
        "name": "Sarah Chen",
        "company": "TechCo",
        "plan": "Pro",
        "trial_ends": "2025-10-20"
      }
    },
    "options": {
      "test_mode": false,
      "reply_to": "sales@yourcompany.com",
      "tags": {
        "segment": "enterprise",
        "source": "landing_page"
      }
    }
  }'
```

**Parameters:**
- `journey_id` (required) - ID of the journey to enroll in
- `contact.email` (required) - Contact's email address
- `contact.data` (optional) - Any key-value data for template personalization
- `options.test_mode` (optional) - If true, bypasses send window restrictions (default: false)
- `options.reply_to` (optional) - Override Reply-To for this enrollment
- `options.tags` (optional) - Key-value tags for analytics/filtering

**Idempotency:**
You can provide an idempotency key to prevent duplicate enrollments:

```bash
-H "X-Idempotency-Key: your-unique-key-123"
```

**Response:**
```json
{
  "enrollment_id": "jn73xsmrtb3f2awx3beamabym97rqcaj",
  "status": "active",
  "next_run_at": "2025-10-06T14:30:00.000Z",
  "test_mode": false,
  "tags": {
    "segment": "enterprise",
    "source": "landing_page"
  },
  "existing": false
}
```

**If enrollment already exists (idempotent):**
```json
{
  "enrollment_id": "jn73xsmrtb3f2awx3beamabym97rqcaj",
  "status": "active",
  "next_run_at": "2025-10-06T14:30:00.000Z",
  "test_mode": false,
  "tags": {...},
  "existing": true,
  "enrolled_at": "2025-10-06T10:00:00.000Z"
}
```

**Enrollment Statuses:**
- `active` - Receiving emails
- `completed` - Finished all stages
- `converted` - Conversion event received
- `removed` - Unsubscribed or removed
- `failed` - Failed to send (permanent)
- `suppressed` - On suppression list

**Notes:**
- Enrollments are idempotent by `(account_id, journey_id, contact_email)`
- First email scheduled immediately (or next send window)
- Sends only happen 9am-5pm UTC Mon-Fri (unless test_mode: true)
- Validates Resend API key before enrollment

---

### Track Event

**POST /events**

Tracks events for contacts (conversion, unsubscribe, custom).

**Request (Conversion):**
```bash
curl -X POST "https://focused-bloodhound-276.convex.site/events" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "conversion",
    "contact_email": "user@company.com",
    "journey_id": "jd7fg1fa3kq2dncmm05323g1td7rnxse",
    "metadata": {
      "plan": "Enterprise",
      "mrr": 499
    }
  }'
```

**Request (Custom Event):**
```bash
curl -X POST "https://focused-bloodhound-276.convex.site/events" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "custom",
    "contact_email": "user@company.com",
    "metadata": {
      "action": "clicked_demo",
      "page": "/pricing"
    }
  }'
```

**Parameters:**
- `type` (required) - Event type: `conversion`, `unsubscribe`, `open`, `click`, `custom`
- `contact_email` (required) - Contact's email address
- `journey_id` (optional) - Specific journey to track against
- `enrollment_id` (optional) - Specific enrollment to track against
- `metadata` (optional) - Any additional event data

**Response:**
```json
{
  "event_id": "kg7843201hz8pc4b26a3tecaed7rpwf1",
  "accepted": true
}
```

**Stop-on-Convert Behavior:**
- Conversion events stop sends within 60 seconds
- Enrollment status changed to "converted"
- No further emails sent to that contact in that journey
- Can specify global conversion (all journeys) by omitting `journey_id`

**Unsubscribe Behavior:**
- Adds email to suppression list
- Stops all sends for that journey
- Can specify global unsubscribe (all journeys) by omitting `journey_id`

---

### Get Journey Analytics

**GET /journeys/:id/analytics**

Retrieves analytics and performance metrics for a journey.

**Request:**
```bash
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/jd7fg1fa3kq2dncmm05323g1td7rnxse/analytics" \
  -H "X-API-Key: YOUR_API_KEY"
```

**Response:**
```json
{
  "journey_id": "jd7fg1fa3kq2dncmm05323g1td7rnxse",
  "name": "Trial → Paid Conversion",
  "stats": {
    "total_enrolled": 1247,
    "total_completed": 523,
    "total_converted": 189,
    "total_bounced": 12,
    "total_complained": 3,
    "open_rate": 0.42,
    "click_rate": 0.18
  },
  "stage_breakdown": [
    {
      "stage": 0,
      "sent": 1247,
      "opens": 524,
      "clicks": 224
    },
    {
      "stage": 1,
      "sent": 1058,
      "opens": 445,
      "clicks": 189
    }
  ],
  "recent_conversions": [
    {
      "contact_email": "user@company.com",
      "converted_at": "2025-10-05T14:23:00.000Z",
      "metadata": {"plan": "Pro"}
    }
  ]
}
```

---

### Get Enrollment Timeline

**GET /enrollments/:id/timeline**

Retrieves the event timeline for a specific enrollment.

**Request:**
```bash
curl -X GET "https://focused-bloodhound-276.convex.site/enrollments/jn73xsmrtb3f2awx3beamabym97rqcaj/timeline" \
  -H "X-API-Key: YOUR_API_KEY"
```

**Response:**
```json
{
  "enrollment_id": "jn73xsmrtb3f2awx3beamabym97rqcaj",
  "contact_email": "user@company.com",
  "status": "converted",
  "current_stage": 2,
  "events": [
    {
      "type": "enrolled",
      "timestamp": "2025-10-06T10:00:00.000Z"
    },
    {
      "type": "sent",
      "stage": 0,
      "timestamp": "2025-10-06T10:01:00.000Z",
      "subject": "Welcome to TechCo"
    },
    {
      "type": "opened",
      "stage": 0,
      "timestamp": "2025-10-06T10:15:00.000Z"
    },
    {
      "type": "sent",
      "stage": 1,
      "timestamp": "2025-10-08T10:00:00.000Z",
      "subject": "Get started with your first project"
    },
    {
      "type": "conversion",
      "timestamp": "2025-10-08T14:30:00.000Z",
      "metadata": {"plan": "Pro"}
    }
  ]
}
```

---

### Get Suppressions

**GET /suppressions**

Retrieves the suppression list (bounces, complaints, unsubscribes).

**Request:**
```bash
curl -X GET "https://focused-bloodhound-276.convex.site/suppressions" \
  -H "X-API-Key: YOUR_API_KEY"
```

**Query Parameters:**
- `journey_id` (optional) - Filter by journey
- `reason` (optional) - Filter by reason: `hard_bounce`, `soft_bounce`, `spam_complaint`, `unsubscribe`, `manual`

**Examples:**
```bash
# All suppressions
GET /suppressions

# Journey-specific
GET /suppressions?journey_id=jd7fg1fa3kq2dncmm05323g1td7rnxse

# Only hard bounces
GET /suppressions?reason=hard_bounce
```

**Response:**
```json
{
  "suppressions": [
    {
      "contact_email": "bounce@example.com",
      "reason": "hard_bounce",
      "journey_id": "jd7fg1fa3kq2dncmm05323g1td7rnxse",
      "created_at": "2025-10-05T12:00:00.000Z",
      "metadata": {
        "bounce_type": "hard",
        "resend_event_id": "..."
      }
    },
    {
      "contact_email": "unsubscribed@example.com",
      "reason": "unsubscribe",
      "created_at": "2025-10-06T09:00:00.000Z",
      "metadata": {
        "source": "unsubscribe_link"
      }
    }
  ]
}
```

**Suppression Behavior:**
- Hard bounces: Permanent, blocks all sends to that email
- Soft bounces: Temporary (72 hours), then expires
- Spam complaints: Permanent, blocks all sends
- Unsubscribes: Per-journey or global
- Manual: Set by admin, permanent

---

### Unsubscribe Page

**GET /u/:enrollment_id**

Public unsubscribe page (no authentication required).

**URL:**
```
https://focused-bloodhound-276.convex.site/u/jn73xsmrtb3f2awx3beamabym97rqcaj
```

**Behavior:**
- Automatically records unsubscribe event
- Sets enrollment status to "removed"
- Adds email to suppression list for that journey
- Shows confirmation page

**Response (HTML):**
```html
<html>
  <body>
    <h1>You have been unsubscribed</h1>
    <p>You will no longer receive emails from this journey.</p>
    <p>Email: <strong>user@company.com</strong></p>
  </body>
</html>
```

**Note:** This URL is automatically generated and included in email templates via `{{unsubscribe_url}}`.

---

### Resend Webhooks

**POST /webhooks/resend**

Endpoint for receiving Resend webhook events (delivery, bounces, opens, clicks).

**URL to configure in Resend:**
```
https://focused-bloodhound-276.convex.site/webhooks/resend
```

**Supported Events:**
- `email.sent`
- `email.delivered`
- `email.bounced`
- `email.complained` (spam)
- `email.opened`
- `email.clicked`

**Authentication:**
- Uses Svix signature verification
- Webhook secret stored encrypted in environment

**See:** [WEBHOOKS.md](./WEBHOOKS.md) for detailed setup instructions.

---

## Error Codes

### 400 Bad Request
Invalid request parameters.

```json
{
  "code": "invalid_request",
  "message": "Missing required fields: goal and audience",
  "details": {}
}
```

### 401 Unauthorized
Invalid API key or Resend key.

```json
{
  "code": "invalid_api_key",
  "message": "Invalid or missing API key",
  "details": {
    "hint": "Provide X-API-Key header with valid account API key"
  }
}
```

### 404 Not Found
Resource not found.

```json
{
  "code": "journey_not_found",
  "message": "Journey not found",
  "details": {}
}
```

### 500 Internal Server Error
Server error.

```json
{
  "code": "internal_error",
  "message": "An unexpected error occurred",
  "details": {}
}
```

---

## Rate Limits

Rate limits are set at the account level based on plan:

**Free Plan:**
- Max journeys: 10
- Max active enrollments: 1,000
- Max enrollments per second: 10

**Pro Plan:**
- Max journeys: 100
- Max active enrollments: 50,000
- Max enrollments per second: 100

**Enterprise Plan:**
- Custom limits

When rate limits are exceeded, you'll receive a 429 error:

```json
{
  "code": "rate_limit_exceeded",
  "message": "Rate limit exceeded",
  "details": {
    "limit": 10,
    "current": 10,
    "reset_at": "2025-10-07T00:00:00.000Z"
  }
}
```

---

## SDKs and Libraries

### Node.js
```javascript
// Native fetch (Node 18+)
const response = await fetch('https://focused-bloodhound-276.convex.site/journeys', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.GTM_OS_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    goal: 'Convert trial users',
    audience: 'B2B SaaS trials'
  })
});

const data = await response.json();
console.log('Journey ID:', data.journey_id);
```

### Python
```python
import requests

response = requests.post(
    'https://focused-bloodhound-276.convex.site/journeys',
    headers={
        'X-API-Key': os.environ['GTM_OS_API_KEY'],
        'Content-Type': 'application/json'
    },
    json={
        'goal': 'Convert trial users',
        'audience': 'B2B SaaS trials'
    }
)

data = response.json()
print('Journey ID:', data['journey_id'])
```

---

## Best Practices

### 1. Use Idempotency Keys
Always use idempotency keys for enrollments to prevent duplicates:

```bash
-H "X-Idempotency-Key: user_${USER_ID}_journey_${JOURNEY_ID}"
```

### 2. Track Conversions Immediately
Send conversion events as soon as they happen to stop sends within 60 seconds:

```javascript
// On user upgrade
await trackConversion(user.email, journeyId);
```

### 3. Use Test Mode for Development
Always use `test_mode: true` when testing to bypass send windows:

```json
{
  "options": {
    "test_mode": true
  }
}
```

### 4. Monitor Health Endpoint
Poll the `/health` endpoint to monitor system status:

```bash
*/5 * * * * curl -H "X-API-Key: $API_KEY" https://focused-bloodhound-276.convex.site/health
```

### 5. Handle Webhooks
Set up Resend webhooks to track delivery, opens, and bounces in real-time.

See [WEBHOOKS.md](./WEBHOOKS.md) for setup guide.

---

## Support

- Documentation: https://github.com/nmogil/gtm-os/tree/main/docs
- Issues: https://github.com/nmogil/gtm-os/issues
- Email: support@gtm-os.com
