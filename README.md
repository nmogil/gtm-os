# GTM OS - Email Journey Automation

Developer-first email journey automation with AI-generated sequences, dynamic personalization, and real-time tracking.

## Quick Start (10 Minutes)

### 1. Get Your API Key

Contact support to get your GTM OS API key: `acct_xxxxx`

### 2. Create Your First Journey

**Option 1: AI-Generated Journey**

```bash
curl -X POST "https://focused-bloodhound-276.convex.site/journeys" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Convert trial users to paid within 14 days",
    "audience": "B2B SaaS trials who signed up in last 24h",
    "options": {
      "emails": 7,
      "default_reply_to": "sales@yourcompany.com"
    }
  }'
```

**Option 2: Manual Journey (Custom Content)**

```bash
curl -X POST "https://focused-bloodhound-276.convex.site/journeys" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
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

**Response:**
```json
{
  "journey_id": "jd7abc...",
  "name": "Welcome Series",
  "mode": "manual",
  "stages": [...]
}
```

### 3. Enroll a Contact

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
      "tags": {
        "source": "landing_page",
        "segment": "enterprise"
      }
    }
  }'
```

**Response:**
```json
{
  "enrollment_id": "jn73xsmrtb3f2awx3beamabym97rqcaj",
  "status": "active",
  "next_run_at": "2025-10-06T14:30:00.000Z",
  "test_mode": false
}
```

### 4. Track Conversions (Stop Sends)

When a user upgrades or completes your goal:

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

**Stops all sends within 60 seconds!**

---

## Features

- ✅ **AI-Generated Journeys** - OpenAI GPT-4 creates multi-step email sequences
- ✅ **Dynamic Personalization** - Handlebars templating with custom helpers
- ✅ **BYO Resend API Key** - Use your own Resend account
- ✅ **Stop-on-Convert** - Automatically stops sends within 60s of conversion
- ✅ **Automatic Suppression** - Handles bounces, complaints, unsubscribes
- ✅ **Real-Time Tracking** - Webhooks for opens, clicks, deliveries
- ✅ **Idempotent Enrollments** - Safe retries, no duplicates
- ✅ **Test Mode** - Safe testing without production restrictions
- ✅ **Batch Operations** - Enroll 1000+ users with rate limiting
- ✅ **Analytics** - Journey metrics, conversion rates, engagement

---

## API Overview

**Base URL:** `https://focused-bloodhound-276.convex.site`

### Core Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | System health & metrics |
| `/journeys` | POST | Create AI-generated or manual journey |
| `/journeys/:id` | GET | Retrieve journey details |
| `/journeys/:id` | PATCH | Update journey content or metadata |
| `/enrollments` | POST | Enroll contact in journey |
| `/events` | POST | Track conversion/unsubscribe/custom |
| `/journeys/:id/analytics` | GET | Journey performance metrics |
| `/enrollments/:id/timeline` | GET | Enrollment event timeline |
| `/suppressions` | GET | Suppression list (bounces, complaints) |
| `/u/:enrollment_id` | GET | Public unsubscribe page |
| `/webhooks/resend` | POST | Resend webhook handler |

**Authentication:** All endpoints (except `/u/`) require `X-API-Key` header.

📖 **[Complete API Reference →](./docs/API.md)**

---

## Documentation

### Guides

- **[API Reference](./docs/API.md)** - Complete endpoint documentation with examples
- **[Code Examples](./docs/EXAMPLES.md)** - Production-ready code recipes for common use cases
- **[Template Guide](./docs/TEMPLATES.md)** - Handlebars personalization & custom helpers
- **[Webhook Setup](./docs/WEBHOOKS.md)** - Real-time event tracking with Resend
- **[Testing Guide](./docs/TESTING.md)** - Safe testing practices & utilities

### Quick Links

- [Trial User Conversion Flow](./docs/EXAMPLES.md#recipe-1-trial-user-conversion-flow)
- [Batch Enrollment](./docs/EXAMPLES.md#recipe-6-batch-enrollment)
- [Analytics Dashboard](./docs/EXAMPLES.md#recipe-7-analytics-dashboard)
- [Handlebars Custom Helpers](./docs/TEMPLATES.md#custom-helpers)
- [Test Mode](./docs/TESTING.md#test-mode)

---

## Development

### Prerequisites

- Node.js 18+ installed
- Convex account (sign up at https://convex.dev)

### Installation

1. **Clone repository:**
   ```bash
   git clone https://github.com/nmogil/gtm-os.git
   cd gtm-os
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Initialize Convex:**
   ```bash
   npx convex dev
   ```

   This will:
   - Prompt you to log in to Convex
   - Create a new project or select existing
   - Generate `CONVEX_DEPLOYMENT` URL
   - Watch `convex/` directory for changes

4. **Configure environment variables:**

   Create `.env.local`:
   ```bash
   # Auto-generated by Convex
   CONVEX_DEPLOYMENT=dev:focused-bloodhound-276
   CONVEX_URL=https://focused-bloodhound-276.convex.site

   # Required for AI journey generation
   OPENAI_API_KEY=sk-proj-xxxxx

   # System default Resend key (fallback)
   RESEND_API_KEY=re_xxxxx

   # Webhook verification
   SVIX_WEBHOOK_SECRET=whsec_xxxxx

   # Encryption key (32 bytes / 64 hex chars)
   ENCRYPTION_KEY=4457322d5f0aa425e70058b14686123810f3ee06733e87463db73ec1b57affcb
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

### Project Structure

```
/convex
  /schema.ts          # Database schemas & indexes
  /http.ts            # HTTP API endpoints
  /actions.ts         # External API integrations (OpenAI, Resend)
  /mutations.ts       # Database write operations
  /queries.ts         # Database read operations
  /crons.ts           # Scheduled jobs (scheduler, cleanup)
  /webhooks.ts        # Resend webhook handler
  /lib/               # Shared utilities
    /auth.ts          # API key authentication
    /templates.ts     # Handlebars rendering
    /idempotency.ts   # Idempotency key management
    /ai.ts            # OpenAI journey generation
    /encryption.ts    # Sensitive data encryption
    /errors.ts        # Error handling
/docs                 # Documentation
/testing              # Test utilities & scripts
```

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npx tsx testing/test-scheduler.ts
npx tsx testing/test-health-endpoint.ts
npx tsx testing/test-metrics-collection.ts

# Create fast test journey (2-3 min intervals)
npx tsx testing/create-fast-test-journey.ts

# Cleanup test data
npx tsx testing/cleanup-enrollments.ts
```

---

## Usage Examples

### Node.js

```javascript
const GTM_OS_API_KEY = process.env.GTM_OS_API_KEY;
const BASE_URL = 'https://focused-bloodhound-276.convex.site';

// Create journey
const journey = await fetch(`${BASE_URL}/journeys`, {
  method: 'POST',
  headers: {
    'X-API-Key': GTM_OS_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    goal: 'Convert trial users to paid',
    audience: 'B2B SaaS trials',
    options: { emails: 7 }
  })
}).then(r => r.json());

// Enroll user on signup
await fetch(`${BASE_URL}/enrollments`, {
  method: 'POST',
  headers: {
    'X-API-Key': GTM_OS_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    journey_id: journey.journey_id,
    contact: {
      email: user.email,
      data: {
        name: user.name,
        company: user.company
      }
    }
  })
});

// Track conversion when user upgrades
await fetch(`${BASE_URL}/events`, {
  method: 'POST',
  headers: {
    'X-API-Key': GTM_OS_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'conversion',
    contact_email: user.email,
    journey_id: journey.journey_id
  })
});
```

### Python

```python
import requests
import os

GTM_OS_API_KEY = os.environ['GTM_OS_API_KEY']
BASE_URL = 'https://focused-bloodhound-276.convex.site'

# Create journey
journey = requests.post(
    f'{BASE_URL}/journeys',
    headers={
        'X-API-Key': GTM_OS_API_KEY,
        'Content-Type': 'application/json'
    },
    json={
        'goal': 'Convert trial users to paid',
        'audience': 'B2B SaaS trials',
        'options': {'emails': 7}
    }
).json()

# Enroll user
requests.post(
    f'{BASE_URL}/enrollments',
    headers={
        'X-API-Key': GTM_OS_API_KEY,
        'Content-Type': 'application/json'
    },
    json={
        'journey_id': journey['journey_id'],
        'contact': {
            'email': user.email,
            'data': {
                'name': user.name,
                'company': user.company
            }
        }
    }
)

# Track conversion
requests.post(
    f'{BASE_URL}/events',
    headers={
        'X-API-Key': GTM_OS_API_KEY,
        'Content-Type': 'application/json'
    },
    json={
        'type': 'conversion',
        'contact_email': user.email,
        'journey_id': journey['journey_id']
    }
)
```

📖 **[More Examples →](./docs/EXAMPLES.md)**

---

## Key Concepts

### Journeys

A journey is a multi-stage email sequence with:
- **Goal:** What you want to achieve (e.g., "Convert trial users")
- **Audience:** Who you're targeting (e.g., "B2B SaaS trials")
- **Stages:** Array of emails with day delays, subjects, and bodies

**Stages are generated by AI** using OpenAI GPT-4.

### Enrollments

An enrollment represents a contact's progression through a journey:
- **Status:** active, completed, converted, removed, failed, suppressed
- **Current Stage:** Which email they're on (0-indexed)
- **Next Run At:** When the next email will send

**Enrollments are idempotent** - enrolling the same contact twice returns the existing enrollment.

### Events

Events track user actions and trigger behavior:
- **conversion:** User completed goal → stops sends immediately
- **unsubscribe:** User opted out → adds to suppression list
- **open/click:** Email engagement → tracked for analytics
- **custom:** Your own events (e.g., "demo_requested")

### Templates

Email templates use Handlebars for personalization:

```handlebars
Hi {{default name "there"}},

Your trial ends on {{date_format trial_ends}}.

Upgrade now: {{uppercase company}}

<a href="{{unsubscribe_url}}">Unsubscribe</a>
```

**Custom helpers:**
- `{{default value "fallback"}}` - Provides fallback values
- `{{uppercase value}}` - Transforms to uppercase
- `{{date_format timestamp}}` - Formats Unix timestamp

📖 **[Template Guide →](./docs/TEMPLATES.md)**

### Test Mode

Enable test mode to bypass production restrictions:

```json
{
  "options": {
    "test_mode": true
  }
}
```

**Bypasses:**
- Send window restrictions (9am-5pm UTC)
- Minimum stage delays
- Rate limits

**Still sends real emails!** Use test email addresses.

📖 **[Testing Guide →](./docs/TESTING.md)**

---

## Architecture

### Backend: Convex

All backend logic runs on Convex with three core function types:

1. **HTTP Routes** (`convex/http.ts`) - Public REST API
2. **Actions** (`convex/actions.ts`) - External API calls (OpenAI, Resend)
3. **Mutations** (`convex/mutations.ts`) - Database writes
4. **Queries** (`convex/queries.ts`) - Database reads
5. **Crons** (`convex/crons.ts`) - Scheduled jobs (scheduler, cleanup)

### Database

**Core Tables:**
- `accounts` - Multi-tenant account system
- `journeys` - Email sequences with stages
- `enrollments` - Contact enrollments with status
- `messages` - Individual emails sent
- `events` - Tracking events (opens, clicks, conversions)
- `suppressions` - Bounce/complaint suppression list
- `webhook_events` - Resend webhook event queue

**Key Indexes:**
- `enrollments.by_next_run_at` - Scheduler query
- `enrollments.by_account_journey_email` - Idempotency
- `messages.by_resend_message_id` - Webhook lookup

### Email Sending

- **Scheduler:** Cron runs every minute, queries `enrollments.by_next_run_at`
- **Batch:** Sends up to 100 emails per run
- **Resend API:** All emails sent via user's Resend API key
- **Webhooks:** Real-time delivery, open, click tracking

### Security

- **API Authentication:** X-API-Key header (plaintext in DB)
- **Encryption:** Sensitive data encrypted with AES-256
- **Webhook Verification:** Svix signature verification
- **Idempotency:** Prevents duplicate enrollments/messages

---

## Best Practices

### 1. Use Idempotency Keys

Always use idempotency keys for enrollments:

```bash
-H "X-Idempotency-Key: signup_${USER_ID}_${JOURNEY_ID}"
```

### 2. Track Conversions Immediately

Send conversion events as soon as they happen to stop sends within 60s:

```javascript
await trackConversion(user.email, journeyId);
```

### 3. Use Test Mode for Development

Always test with `test_mode: true`:

```json
{
  "options": {
    "test_mode": true
  }
}
```

### 4. Set Up Webhooks

Configure Resend webhooks for real-time tracking:

📖 **[Webhook Setup Guide →](./docs/WEBHOOKS.md)**

### 5. Monitor Health Endpoint

Poll `/health` to monitor system status:

```bash
*/5 * * * * curl -H "X-API-Key: $API_KEY" https://focused-bloodhound-276.convex.site/health
```

### 6. Handle Errors Gracefully

Implement retry logic with exponential backoff:

📖 **[Retry Example →](./docs/EXAMPLES.md#recipe-8-idempotent-operations)**

### 7. Test Templates Before Launch

Create test enrollments to verify templates render correctly:

📖 **[Testing Guide →](./docs/TESTING.md)**

---

## Support

- **Documentation:** [docs/](./docs/)
- **Issues:** [GitHub Issues](https://github.com/nmogil/gtm-os/issues)
- **Email:** support@gtm-os.com

---

## License

ISC

---

## Contributors

- Noah Mogil ([@nmogil](https://github.com/nmogil))

---

## Changelog

### v1.0.0 (2025-10-06)

- ✅ AI-generated journeys with OpenAI GPT-4
- ✅ Enrollment API with idempotency
- ✅ Event tracking (conversion, unsubscribe, custom)
- ✅ Handlebars template engine with custom helpers
- ✅ Resend webhook integration
- ✅ Automatic suppression list management
- ✅ Health & analytics endpoints
- ✅ Test mode for safe development
- ✅ Comprehensive documentation
