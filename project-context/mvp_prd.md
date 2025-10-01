# PRD — GTM OS (v0.5)

**Version:** 0.5  
**Date:** October 1, 2025  
**Owner:** Engineering  
**Status:** Ready to build

---

## 1) Goal & Non-Goals

### 1.1 Goal (what v0 must do)

Ship a developer-first service where:

- **One API call** generates a ready-to-send multi-step **email** journeys (subjects, bodies, spacing).
- **One API call** enrolls contacts into that journey and the platform sends on schedule.
- **One API call** (conversion event) stops all future sends for that contact in that journey.
- Email sending uses the **customer's Resend API key (BYO)**.
- **Full dynamic personalization** via Handlebars merge tags using contact data.
- **Batch sending** for efficiency (up to 100 emails per API call to Resend).
- **Webhook integration** for automatic bounce/complaint handling and engagement tracking.
- **Rich metadata** support (reply-to, tags, custom headers).

### 1.2 Non-Goals (v0 will not include)

- SMS/WhatsApp/push or multi-channel.
- Temporal/long-running workflow engine.
- Per-message LLM calls (LLM only at journey creation).
- Rich condition engine beyond simple "converted / engaged recently".
- UI. (Optional JSON previews only.)
- Deep analytics dashboards (we'll expose simple counts via JSON).
- React Email support (Node.js SDK feature, post-v0).
- Resend Audience sync (post-v0).
- Attachment support (post-v0).

---

## 2) Target Users & Value

- **Who:** Seed/Series A B2B SaaS & dev tools where an engineer owns lifecycle emails.
- **Why valuable:**
    1. Skip copywriting + sequencing (AI creates 5–7 step journeys)
    2. Hosted scheduling with idempotency + stop-on-convert
    3. **Dynamic personalization** with any custom contact data
    4. 10-minute integration, **no email infra** (they bring their **Resend** key)
    5. **Native Resend integration** with batch sending, webhooks, and engagement tracking
    6. **Automatic list hygiene** via bounce/complaint handling

---

## 3) Product Surface

### 3.1 Endpoints (v0)

1. **POST `/journeys`**  
    Creates a journey with fixed stages from a goal + audience.
    
    - **Body:** `{ goal, audience, options? }`
    - **Returns:** `{ journey_id, name, stages: [{ day, subject, body }] }`
    - **LLM:** single call at creation time via Vercel AI SDK.
2. **POST `/enrollments`**  
    Enrolls a contact into an existing journey.
    
    - **Body:** `{ journey_id, contact: { email, data? }, options?: { start_at?, test_mode?, reply_to?, tags?, headers? } }`
    - **Returns:** `{ enrollment_id, status: "active", next_run_at }`
    - **Test Mode:** When `test_mode: true`, creates message records but no actual sends. Stages progress in minutes not days.
    - **Idempotency:** Use `X-Idempotency-Key` header to prevent duplicate enrollments.
3. **POST `/events`**  
    Records events; used at minimum for **`{ type: "conversion" }`** to stop sends.
    
    - **Body:** `{ type: "conversion" | "unsubscribe" | "open" | "click" | "custom", contact_email, journey_id?, enrollment_id?, metadata? }`
    - **Returns:** `{ event_id, accepted: true }`
4. **POST `/webhooks/resend`** (NEW)  
    Receives webhook events from Resend for bounce handling, engagement tracking, and compliance.
    
    - **Headers:** `X-Resend-Signature` (for verification)
    - **Body:** Resend webhook payload
    - **Handles:** `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.delivery_delayed`
    - **Returns:** `{ received: true }`
5. **GET `/enrollments/:id/timeline`**  
    Returns messages + events merged chronologically (debug/support).
    
6. **GET `/journeys/:id/analytics`** (NEW)  
    Returns engagement metrics and journey performance.
    
    - **Returns:** `{ total_enrolled, completed, converted, active, engagement: { open_rate, click_rate, bounce_rate, complaint_rate }, by_stage: [...] }`
7. **GET `/journeys/:id/preview?contact=email@example.com`** (optional)  
    Returns the staged emails with merge-tags filled for a sample contact (no send).
    
8. **GET `/suppressions`** (NEW)  
    Returns suppression list, filterable by journey or reason.
    
    - **Query params:** `?journey_id=xxx&reason=bounced`
    - **Returns:** `{ data: [{ email, reason, journey_id?, created_at }] }`
9. **GET `/health`** (internal)  
    Returns counts of active enrollments, pending sends, error rate.
    

> Authentication for all endpoints via `X-API-Key` (our API key).  
> **BYO Resend** via either:
> 
> - `resend_api_key` stored on the **Account** (preferred), or
> - Header override `X-Resend-Key` per request (useful for testing).  
>     If both are present, header wins.

### 3.2 Email Compliance (v0 must)

- **List-Unsubscribe** header (mailto + HTTPS URL).
- Footer unsubscribe link (tokenized).
- Per-journey **suppression** list.
- **Automatic suppression** from Resend webhooks:
    - Hard bounces → immediate suppression
    - Spam complaints → immediate suppression + stop all journeys for that contact
    - Soft bounces (3+ in a row) → temporary suppression
- Soft daily send caps per account.

### 3.3 Standard Error Format

All errors return consistent JSON:

```json
{
  "error": {
    "code": "invalid_api_key",
    "message": "The provided Resend API key is invalid",
    "details": { "key_suffix": "...abc123" }
  }
}
```

Error codes: `invalid_api_key`, `resend_auth_failed`, `rate_limit_exceeded`, `journey_not_found`, `duplicate_enrollment`, `llm_generation_failed`, `template_render_failed`, `webhook_verification_failed`, `contact_suppressed`

### 3.4 Merge Tag Handling

**Standard merge tags:**

- `{{name}}` - Contact's first name
- `{{email}}` - Contact's email address
- `{{company}}` - Company name
- Any custom fields passed in `contact.data`

**System-generated tags:**

- `{{unsubscribe_url}}` - Required in all email bodies
- `{{enrollment_id}}` - Unique identifier for this enrollment
- `{{journey_name}}` - Name of the journey

**Behavior:**

- **Missing tags:** Render as empty string (silent fail)
- **Reserved tags:** `{{unsubscribe_url}}` (system-generated)
- **Escaping:** All user data is HTML-escaped by default to prevent XSS
- **Custom helpers:** Support `{{uppercase name}}`, `{{default name "Friend"}}`, `{{date_format trial_ends}}`

**Example:**

```handlebars
Subject: Hey {{name}}, here's how {{company}} can help

Body: 
<p>Hi {{default name "there"}},</p>
<p>We noticed {{company}} signed up for {{uppercase plan}}...</p>
<p>Your trial ends on {{date_format trial_ends}}.</p>
<p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
```

**Validation at journey creation:**

- Test render with sample data: `{name: "Test", company: "TestCo"}`
- Verify `{{unsubscribe_url}}` present in all stages
- Catch malformed Handlebars syntax before saving

---

## 4) User Flow (happy path)

1. Dev calls **`POST /journeys`** with `{goal, audience}` → gets `journey_id` and 5–7 staged emails with merge tags.
2. Dev calls **`POST /enrollments`** for N contacts with personalization data + optional tags/reply-to.
3. **Scheduler** processes in batches of up to 100, sends stage 0 now (or at `start_at`), rendering merge tags with contact data, sets `next_run_at` for stage 1.
4. **Resend webhooks** deliver events → GTM OS processes bounces/complaints automatically, records engagement.
5. Their app calls **`POST /events { type:"conversion" }`** when user upgrades → we stop future sends immediately (≤ 60s).
6. Dev inspects **`GET /enrollments/:id/timeline`** or **`GET /journeys/:id/analytics`** if needed.

---

## 5) Architecture (v0)

**Stack:** Convex (HTTP + DB + Scheduler), **Vercel AI SDK** with **AI Gateway** (journey creation), Resend (sending; BYO key), **Handlebars** (templating), **Svix** (webhook verification).

### 5.1 AI Integration Setup

**Dependencies:**

```json
{
  "ai": "^5.0.0",
  "@ai-sdk/openai": "^1.0.0",
  "zod": "^3.22.0",
  "handlebars": "^4.7.8",
  "svix": "^1.x.x"
}
```

**AI Configuration:**

```typescript
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

// AI Gateway is automatically used when deployed on Vercel
// or can be explicitly configured with gateway() provider
```

**Journey Generation Schema:**

```typescript
const journeySchema = z.object({
  name: z.string().describe('A clear, descriptive name for the journey'),
  stages: z.array(
    z.object({
      day: z.number().describe('Day offset from enrollment (0 = immediate)'),
      subject: z.string().describe('Email subject line with merge tags like {{name}}'),
      body: z.string().describe('HTML email body with {{unsubscribe_url}} required')
    })
  ).min(5).max(7)
});

type JourneyStructure = z.infer<typeof journeySchema>;
```

### 5.2 Scheduler Loop (every minute) - BATCH OPTIMIZED

```typescript
select enrollments where status="active" and next_run_at <= now
  // Group by account + resend key for batch processing
  const batchesByAccount = groupBy(pendingSends, 'account_id')
  
  for each account batch (up to 100 enrollments):
    if any converted? -> status="completed" for those; skip
    
    // Build batch array
    const batchEmails = []
    for each enrollment in batch:
      stage = journey.stages[current_stage]
      
      # Send time windows (unless test_mode)
      if not test_mode and not within_send_window:
        next_run_at = next_9am; continue
      
      # Render templates with Handlebars
      try:
        context = {
          ...contact.data,
          email: contact.email,
          unsubscribe_url: generateUnsubscribeUrl(enrollment_id),
          enrollment_id: enrollment_id,
          journey_name: journey.name
        }
        rendered_body = handlebars.compile(stage.body)(context)
        rendered_subject = handlebars.compile(stage.subject)(context)
      catch TemplateError:
        log error with enrollment_id + stage
        status="failed"; last_error="template_render_failed"
        continue
      
      # Check suppression list
      if isContactSuppressed(contact.email, journey_id):
        status="suppressed"; continue
      
      # Add to batch
      batchEmails.push({
        from: journey.from || "Acme <onboarding@resend.dev>",
        to: [contact.email],
        subject: rendered_subject,
        html: rendered_body,
        reply_to: enrollment.reply_to || journey.default_reply_to,
        headers: {
          'X-Enrollment-ID': enrollment_id,
          'X-Journey-ID': journey_id,
          'X-Stage': current_stage,
          ...enrollment.custom_headers
        },
        tags: {
          journey_id: journey_id,
          stage: current_stage,
          ...enrollment.tags
        }
      })
    
    # Send batch to Resend (up to 100 emails)
    try:
      const idempotencyKey = `gtmos-batch-${Date.now()}-${account_id}`
      const results = await resend.batch.send(batchEmails, {
        headers: { 'Idempotency-Key': idempotencyKey }
      })
      
      # Process each result
      results.data.forEach((result, idx) => {
        const enrollment = batch[idx]
        if (result.id) {
          // Record message row (idempotent per enrollment+stage)
          create message {
            resend_message_id: result.id,
            enrollment_id: enrollment.enrollment_id,
            stage: enrollment.current_stage,
            subject: rendered_subject,
            body: rendered_body,
            status: "sent",
            sent_at: now,
            personalization_snapshot: contact.data,
            tags: enrollment.tags
          }
          
          // Update enrollment for next stage
          if (current_stage == last_stage):
            status="completed"
          else:
            current_stage += 1
            next_run_at = now + wait_from(stage.day or cadence)
        } else {
          handleSendError(enrollment, result.error)
        }
      })
    catch:
      retry entire batch with exponential backoff (1min, 5min, 15min)
      if all retries failed -> status="failed" for all in batch
```

**Idempotency:**

- `(enrollment_id, stage)` unique key prevents duplicate message records
- Resend `Idempotency-Key` header prevents duplicate sends at Resend level
- Enrollment-level `X-Idempotency-Key` on `/enrollments` prevents duplicate enrollments

**Stop-on-convert:** `/events` writes a `conversion` event; scheduler checks a cached flag or quick lookup.

**Batch Advantages:**

- 20-100x fewer API calls to Resend
- More efficient rate limiting
- Better error handling (per-email in batch vs all-or-nothing)

**Error Handling:**

- Failed batch sends: Retry 3x with exponential backoff (1min, 5min, 15min)
- Individual email errors in batch: Mark specific enrollment as failed
- Invalid Resend key: Surface immediately at enrollment, status="failed"
- LLM failures: Retry once with Vercel AI SDK's built-in retry, then return default journey template
- **Template render failures:** Log error, mark enrollment as failed, skip send
- Scheduler crashes: Idempotency ensures no duplicates on resume
- **Webhook processing failures:** Retry with exponential backoff, dead letter queue after 10 attempts

**Send Windows:**

- Default: Send between 9am-5pm recipient timezone (if known)
- Fallback: 9am-5pm EST
- Override: enrollment `options.send_immediately=true`

**Operational Limits (v0):**

- Max 100 enrollments/second per account
- Max 10 journeys per account
- Max 10k active enrollments per journey
- Messages expire after 30 days (scheduler skips)
- Hard bounce: immediate suppression
- Soft bounce: retry 3x, then temporary suppression

### 5.3 Webhook Processing (NEW)

```typescript
import { Webhook } from 'svix';

const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

async function handleResendWebhook(req: Request) {
  // Verify webhook signature
  const wh = new Webhook(webhookSecret);
  let payload;
  try {
    payload = wh.verify(
      req.body,
      {
        'svix-id': req.headers['svix-id'],
        'svix-timestamp': req.headers['svix-timestamp'],
        'svix-signature': req.headers['svix-signature']
      }
    );
  } catch (err) {
    throw new Error('webhook_verification_failed');
  }
  
  // Store raw webhook event
  await webhook_events.create({
    resend_event_id: payload.id,
    event_type: payload.type,
    contact_email: payload.data.to[0],
    payload: payload,
    processed: false
  });
  
  // Process event
  const event = payload.type;
  const data = payload.data;
  
  // Extract metadata from headers
  const enrollmentId = data.headers?.['X-Enrollment-ID'];
  const journeyId = data.headers?.['X-Journey-ID'];
  const stage = data.headers?.['X-Stage'];
  
  switch(event) {
    case 'email.sent':
      // Update message status
      await messages.update(
        { resend_message_id: data.email_id },
        { status: 'sent', sent_at: data.created_at }
      );
      break;
      
    case 'email.delivered':
      await messages.update(
        { resend_message_id: data.email_id },
        { delivery_status: 'delivered', delivered_at: data.created_at }
      );
      break;
      
    case 'email.bounced':
      const bounceType = data.bounce?.type; // 'hard' or 'soft'
      
      if (bounceType === 'hard') {
        // Immediate suppression
        await suppressions.create({
          contact_email: data.to[0],
          reason: 'hard_bounce',
          journey_id: journeyId,
          metadata: { bounce_reason: data.bounce.reason }
        });
        
        // Stop all active enrollments for this contact
        await enrollments.updateMany(
          { contact_email: data.to[0], status: 'active' },
          { status: 'suppressed', last_error: 'hard_bounce' }
        );
      } else {
        // Track soft bounces
        const softBounceCount = await countRecentSoftBounces(data.to[0]);
        if (softBounceCount >= 3) {
          // Temporary suppression after 3 soft bounces
          await suppressions.create({
            contact_email: data.to[0],
            reason: 'repeated_soft_bounce',
            journey_id: journeyId,
            expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
          });
        }
      }
      
      // Update message
      await messages.update(
        { resend_message_id: data.email_id },
        { delivery_status: 'bounced', bounce_type: bounceType }
      );
      break;
      
    case 'email.complained':
      // Immediate suppression + stop ALL journeys
      await suppressions.create({
        contact_email: data.to[0],
        reason: 'spam_complaint',
        journey_id: null, // Global suppression
        metadata: { complaint_type: data.complaint?.type }
      });
      
      // Stop all active enrollments across all journeys
      await enrollments.updateMany(
        { contact_email: data.to[0], status: 'active' },
        { status: 'suppressed', last_error: 'spam_complaint' }
      );
      
      await messages.update(
        { resend_message_id: data.email_id },
        { delivery_status: 'complained' }
      );
      break;
      
    case 'email.opened':
      // Record engagement event
      await events.create({
        type: 'open',
        contact_email: data.to[0],
        enrollment_id: enrollmentId,
        journey_id: journeyId,
        metadata: {
          opened_at: data.created_at,
          stage: stage
        }
      });
      break;
      
    case 'email.clicked':
      // Record engagement event
      await events.create({
        type: 'click',
        contact_email: data.to[0],
        enrollment_id: enrollmentId,
        journey_id: journeyId,
        metadata: {
          clicked_at: data.created_at,
          url: data.click?.link,
          stage: stage
        }
      });
      break;
      
    case 'email.delivery_delayed':
      // Log warning, may retry later
      await messages.update(
        { resend_message_id: data.email_id },
        { delivery_status: 'delayed', last_error: data.reason }
      );
      break;
  }
  
  // Mark webhook as processed
  await webhook_events.update(
    { resend_event_id: payload.id },
    { processed: true, processed_at: Date.now() }
  );
  
  return { received: true };
}
```

**Webhook Setup Instructions:**

1. In Resend Dashboard → Webhooks → Create endpoint
2. URL: `https://your-domain.com/webhooks/resend`
3. Events: Select all email events
4. Copy signing secret to `RESEND_WEBHOOK_SECRET` env var

---

## 6) Data Model (Convex)

```ts
// accounts
{ _id, name, api_key, resend_api_key_encrypted?, 
  plan, limits, usage, 
  webhook_secret_encrypted?, // NEW: for webhook verification
  created_at }

// journeys
{ _id, account_id, name, goal, audience,
  stages: [{ day: number, subject: string, body: string }],
  is_active: boolean,
  default_reply_to?: string, // NEW
  default_tags?: object,     // NEW
  stats: { 
    total_enrolled: number, 
    total_completed: number, 
    total_converted: number,
    total_bounced: number,    // NEW
    total_complained: number, // NEW
    open_rate: number,        // NEW
    click_rate: number        // NEW
  },
  created_at
}

// enrollments (UNIQUE: account_id + journey_id + contact_email)
{ _id, account_id, journey_id, contact_email, contact_data: any,
  status: "active" | "completed" | "converted" | "removed" | "failed" | "suppressed", // "suppressed" is NEW
  current_stage: number, next_run_at: number, enrolled_at: number,
  test_mode: boolean, retry_count: number, last_error?: string,
  reply_to?: string,         // NEW: per-enrollment override
  tags?: object,             // NEW: custom tags
  custom_headers?: object    // NEW: custom headers
}

// messages (ledger)
{ _id, account_id, enrollment_id, journey_id, stage: number,
  subject: string, body: string, 
  status: "queued" | "sent" | "failed" | "test",
  resend_message_id?: string,    // NEW: Resend's email ID
  delivery_status?: "sent" | "delivered" | "bounced" | "complained" | "delayed", // NEW
  bounce_type?: "hard" | "soft", // NEW
  sent_at?: number, delivered_at?: number, // delivered_at is NEW
  external_id?: string,
  retry_count: number, error_detail?: string,
  template_version?: string, 
  personalization_snapshot?: any,
  tags?: object,                 // NEW: tags from enrollment
  has_metadata: boolean          // NEW: tracks if custom headers/tags present
}

// events (timeline)
{ _id, account_id, contact_email, enrollment_id?, journey_id?,
  event_type: "conversion" | "unsubscribe" | "open" | "click" | "custom",
  metadata?: any, timestamp: number }

// suppressions (per journey or global)
{ _id, account_id, journey_id?, contact_email, 
  reason: "hard_bounce" | "soft_bounce" | "spam_complaint" | "unsubscribe" | "manual",
  metadata?: object,   // NEW: additional context (bounce reason, etc)
  expires_at?: number, // NEW: for temporary suppressions
  created_at }

// webhook_events (NEW - audit trail)
{ _id, account_id, resend_event_id: string, event_type: string,
  contact_email: string, message_id?: string, enrollment_id?: string,
  payload: any, processed: boolean, processed_at?: number,
  retry_count: number, last_error?: string,
  created_at }
```

**Indexes (minimal):**

- `enrollments`: by `account_id`, by `status`, by `next_run_at`, by `(account_id, journey_id, contact_email)` [UNIQUE].
- `messages`: by `enrollment_id`, by `journey_id`, by `resend_message_id`.
- `events`: by `(account_id, contact_email)`, by `enrollment_id`, by `journey_id`.
- `suppressions`: by `(journey_id, contact_email)`, by `(contact_email, expires_at)`.
- `webhook_events`: by `resend_event_id` [UNIQUE], by `processed`, by `account_id`.

**Duplicate Prevention:**

- Unique constraint on `(account_id, journey_id, contact_email)`
- Return existing `enrollment_id` if duplicate attempted
- Optional: `force_new` flag to create new enrollment
- `X-Idempotency-Key` header on `/enrollments` for client-side deduplication

---

## 7) LLM Usage with Vercel AI SDK

### 7.1 Journey Generation Implementation

**Single API call using Vercel AI SDK's `generateObject`:**

```typescript
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

async function generateJourney(goal: string, audience: string, emailCount = 5) {
  try {
    const { object } = await generateObject({
      model: openai('gpt-4o'), // or 'openai/gpt-4o' with AI Gateway
      schema: journeySchema,
      prompt: `Create a ${emailCount}-email nurture journey for:
Goal: ${goal}
Audience: ${audience}

Requirements:
- Space emails progressively (e.g., day 0, 2, 5, 8, 12)
- Include merge tags: {{name}}, {{company}}, {{email}}
- Use clear, friendly B2B tone
- Each email must include {{unsubscribe_url}} in body
- Subject lines should be compelling and specific
- Support dynamic personalization with any custom fields user provides`,
      temperature: 0.7,
      maxRetries: 2, // Built-in retry handling
    });

    // Validate required tokens and test templates
    const validation = validateJourneyTemplates(object.stages);
    if (!validation.valid) {
      console.error('Journey validation failed:', validation.errors);
      throw new Error('Generated journey has invalid templates');
    }

    return object;
  } catch (error) {
    console.error('LLM generation failed:', error);
    // Fall back to default journey
    return DEFAULT_JOURNEY;
  }
}
```

### 7.2 Validation Rules

```typescript
function validateJourneyStructure(journey: JourneyStructure): boolean {
  // Check stage ordering
  for (let i = 1; i < journey.stages.length; i++) {
    if (journey.stages[i].day <= journey.stages[i - 1].day) {
      return false;
    }
  }

  // Check required tokens
  for (const stage of journey.stages) {
    if (!stage.body.includes('{{unsubscribe_url}}')) {
      return false;
    }
    if (!stage.subject || !stage.body) {
      return false;
    }
  }

  return true;
}
```

### 7.3 Default Journey Fallback

```typescript
const DEFAULT_JOURNEY: JourneyStructure = {
  name: "Standard Nurture",
  stages: [
    { 
      day: 0, 
      subject: "Welcome to {{company}}, {{name}}", 
      body: `<p>Hi {{default name "there"}},</p><p>Thanks for signing up with {{company}}!</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>` 
    },
    { 
      day: 2, 
      subject: "Quick question, {{name}}", 
      body: `<p>Hi {{name}},</p><p>How's your experience with {{company}} so far?</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>` 
    },
    { 
      day: 5, 
      subject: "Getting started with {{company}}", 
      body: `<p>Hi {{name}},</p><p>Here's how to get the most out of {{company}}...</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>` 
    },
    { 
      day: 8, 
      subject: "See how others use {{company}}", 
      body: `<p>Hi {{name}},</p><p>Check out this customer story...</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>` 
    },
    { 
      day: 12, 
      subject: "Special offer for {{name}}", 
      body: `<p>Hi {{default name "there"}},</p><p>Limited time offer just for you...</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>` 
    }
  ]
};
```

---

## 8) BYO Resend: Handling & Security

- Store `resend_api_key_encrypted` per account using env-salted AEAD.
- **Validate key at enrollment time** by test-sending to Resend validation endpoint.
- Allow per-request override header `X-Resend-Key` for dev/testing.
- Never log full keys; redact to last 4.
- If key invalid at enrollment: Return immediate error, don't create enrollment.
- **Store webhook signing secret** (`webhook_secret_encrypted`) for verification.

**Sender identity:**

- v0 provides a default "sandbox" sender (we own) for quick start **or** lets the account pass `from` per journey.
- Docs show DNS steps to move to their domain later.

---

## 9) API Sketches

### 9.1 Create Journey

```http
POST /journeys
X-API-Key: acct_xxx
Content-Type: application/json

{
  "goal": "Convert trial users to paid",
  "audience": "B2B SaaS trials",
  "options": { 
    "emails": 5,
    "default_reply_to": "support@yourcompany.com" // NEW
  }
}
```

**200 OK**

```json
{
  "journey_id": "jrn_123",
  "name": "Trial → Paid (B2B)",
  "default_reply_to": "support@yourcompany.com",
  "stages": [
    { 
      "day": 0, 
      "subject": "Welcome, {{name}}", 
      "body": "<p>Hi {{default name \"there\"}},</p><p>Thanks for trying {{company}}!</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>" 
    },
    { 
      "day": 2, 
      "subject": "Set up in 2 mins, {{name}}", 
      "body": "<p>Hi {{name}},</p><p>Quick setup guide...</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>" 
    }
  ]
}
```

### 9.2 Enroll Contact (Enhanced)

**Basic enrollment with metadata:**

```http
POST /enrollments
X-API-Key: acct_xxx
X-Idempotency-Key: client-unique-123  # NEW: prevents duplicates
Content-Type: application/json

{
  "journey_id": "jrn_123",
  "contact": { 
    "email": "sarah@techco.com", 
    "data": { 
      "name": "Sarah", 
      "company": "TechCo",
      "plan": "Pro",
      "trial_ends": "2025-10-15"
    } 
  },
  "options": {
    "test_mode": true,
    "reply_to": "sarah-rep@yourcompany.com",  // NEW: per-enrollment override
    "tags": {                                   // NEW: custom tags
      "segment": "enterprise",
      "source": "landing_page",
      "campaign": "q4_trial"
    },
    "headers": {                                // NEW: custom headers
      "X-Campaign-ID": "camp_abc123",
      "X-User-Tier": "premium"
    }
  }
}
```

**200 OK (new enrollment)**

```json
{
  "enrollment_id": "enr_456",
  "status": "active",
  "next_run_at": "2025-09-30T14:00:00Z",
  "test_mode": true,
  "tags": {
    "segment": "enterprise",
    "source": "landing_page",
    "campaign": "q4_trial"
  }
}
```

**200 OK (duplicate - idempotent)**

```json
{
  "enrollment_id": "enr_789",
  "status": "active",
  "existing": true,
  "enrolled_at": "2025-09-29T10:00:00Z"
}
```

**400 Error (Suppressed Contact)**

```json
{
  "error": {
    "code": "contact_suppressed",
    "message": "Contact is on suppression list due to hard bounce",
    "details": { 
      "email": "sarah@techco.com",
      "reason": "hard_bounce",
      "suppressed_at": "2025-09-28T10:00:00Z"
    }
  }
}
```

### 9.3 Webhook Endpoint (NEW)

```http
POST /webhooks/resend
Content-Type: application/json
Svix-Id: msg_xxx
Svix-Timestamp: 1234567890
Svix-Signature: v1,xxx

{
  "type": "email.bounced",
  "created_at": "2025-10-01T14:00:00Z",
  "data": {
    "email_id": "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794",
    "from": "Acme <onboarding@resend.dev>",
    "to": ["sarah@techco.com"],
    "subject": "Welcome to Acme",
    "bounce": {
      "type": "hard",
      "reason": "550 5.1.1 User unknown"
    },
    "headers": {
      "X-Enrollment-ID": "enr_456",
      "X-Journey-ID": "jrn_123",
      "X-Stage": "0"
    }
  }
}
```

**200 OK**

```json
{
  "received": true,
  "processed": true,
  "actions": [
    "contact_suppressed",
    "enrollment_stopped"
  ]
}
```

### 9.4 Journey Analytics (NEW)

```http
GET /journeys/jrn_123/analytics
X-API-Key: acct_xxx
```

**200 OK**

```json
{
  "journey_id": "jrn_123",
  "journey_name": "Trial → Paid (B2B)",
  "total_enrolled": 1247,
  "completed": 892,
  "converted": 234,
  "active": 121,
  "suppressed": 8,
  "engagement": {
    "open_rate": 0.68,
    "click_rate": 0.34,
    "bounce_rate": 0.006,
    "complaint_rate": 0.0008,
    "conversion_rate": 0.188
  },
  "by_stage": [
    { 
      "stage": 0, 
      "day": 0,
      "subject": "Welcome, {{name}}",
      "sent": 1247, 
      "delivered": 1239,
      "opened": 892, 
      "clicked": 456,
      "bounced": 8,
      "open_rate": 0.72,
      "click_rate": 0.37
    },
    { 
      "stage": 1,
      "day": 2, 
      "subject": "Set up in 2 mins, {{name}}",
      "sent": 1100, 
      "delivered": 1095,
      "opened": 748, 
      "clicked": 374,
      "bounced": 5,
      "open_rate": 0.68,
      "click_rate": 0.34
    }
  ],
  "recent_events": [
    {
      "type": "conversion",
      "contact_email": "sarah@techco.com",
      "timestamp": "2025-10-01T14:00:00Z"
    }
  ]
}
```

### 9.5 Suppression List (NEW)

```http
GET /suppressions?journey_id=jrn_123&reason=hard_bounce
X-API-Key: acct_xxx
```

**200 OK**

```json
{
  "data": [
    {
      "email": "bounced@example.com",
      "reason": "hard_bounce",
      "journey_id": "jrn_123",
      "metadata": {
        "bounce_reason": "550 5.1.1 User unknown"
      },
      "created_at": "2025-09-28T10:00:00Z",
      "expires_at": null
    },
    {
      "email": "complained@example.com",
      "reason": "spam_complaint",
      "journey_id": null,
      "metadata": {
        "complaint_type": "abuse"
      },
      "created_at": "2025-09-27T15:30:00Z",
      "expires_at": null
    }
  ],
  "total": 2
}
```

---

## 10) Compliance & Tracking (enhanced)

- **Unsubscribe:** tokenized link `/u/:token` → writes `events{unsubscribe}` + `suppressions` and halts future sends.
- **List-Unsubscribe:** `mailto:` + HTTPS link in headers.
- **Engagement:** wrap links through `/r/:msgId?url=...` to log `click`.
- **Opens:** optional pixel for `open` (best-effort).
- **Automatic Suppression (NEW):**
    - Hard bounces → immediate permanent suppression
    - Spam complaints → immediate global suppression (all journeys)
    - Repeated soft bounces (3+) → 7-day temporary suppression
    - Manual unsubscribes → permanent suppression per journey
- **Suppression Expiry:** Temporary suppressions automatically expire
- **Retention:** keep full bodies 90 days; keep subjects + hashes after.

---

## 11) Success Metrics & Monitoring

### 11.1 Success Metrics (for v0)

- **TTFV:** hello-world journey sent in **≤10 minutes** (cold start).
- **Reliability:** stop-on-convert takes **≤60s** from `/events` to suppression.
- **Throughput:** 10k enrollments/day with <1% duplicate/late sends.
- **Batch Efficiency:** ≥90% of sends use batch API (vs individual).
- **Webhook Reliability:** ≥99% of webhooks processed within 30s.
- **Suppression Accuracy:** 100% of hard bounces/complaints suppressed within 60s.
- **Supportability:** 100% of incidents diagnosable via `/timeline`.
- **AI Success Rate:** ≥95% of journey generations succeed without fallback.
- **Template Reliability:** <0.1% template render failures.

### 11.2 Critical Monitoring (Day 1)

```ts
// Must-have metrics from day 1:
{
  // Sending metrics
  send_success_rate: messages.sent / messages.total,
  batch_utilization: batch_sends / total_sends,
  api_latency: { p50: 100ms, p95: 500ms, p99: 1000ms },
  
  // Delivery metrics (from webhooks)
  delivery_rate: delivered / sent,
  bounce_rate: bounced / sent,
  hard_bounce_rate: hard_bounces / bounces,
  complaint_rate: complaints / sent,
  
  // Engagement metrics (from webhooks)
  open_rate: opens / delivered,
  click_rate: clicks / delivered,
  conversion_rate: conversions / enrolled,
  
  // Webhook metrics
  webhook_processing_time: { p50: ms, p95: ms },
  webhook_success_rate: processed / received,
  webhook_retry_rate: retries / received,
  
  // AI metrics
  llm_generation_success_rate: journeys.created / journeys.attempted,
  llm_fallback_rate: journeys.using_default / journeys.total,
  
  // Template metrics
  template_render_success_rate: renders.success / renders.total,
  
  // Suppression metrics
  suppression_rate: suppressed / enrolled,
  suppression_by_reason: { hard_bounce: n, spam_complaint: n, soft_bounce: n },
  
  // System health
  active_enrollments_count: enrollments.where(status="active").count,
  resend_errors_by_type: { auth: 0, rate_limit: 0, other: 0 },
  ai_gateway_usage: { requests: n, errors: n, latency_p95: ms }
}

// Implementation: Log to console with structured format
// Optional: Pipe to Axiom/Datadog (1 line setup)
```

---

## 12) Testing Plan

- **Unit:**
    - Zod schema validation for journey structure
    - Idempotent send (unique `(enrollment, stage)`)
    - **Batch processing:** 100 emails grouped correctly
    - **Webhook signature verification:** valid/invalid signatures
    - **Suppression logic:** hard bounce, soft bounce threshold, complaints
    - **Merge-tag testing:**
        - All tags present → renders correctly
        - Missing optional tags → renders as empty string
        - Missing with `{{default}}` helper → renders default value
        - Special characters in data → properly HTML escaped
        - Array/object data → stringified appropriately
        - Malformed Handlebars syntax → caught at validation
        - XSS attempt in data → escaped properly
    - Duplicate enrollment handling with idempotency keys
- **Integration:**
    - Create journey with Vercel AI SDK → validate structure and templates
    - Enroll 100 with various personalization data → scheduler batches and sends → verify Resend receives batch
    - **Webhook flow:** Simulate bounce webhook → verify suppression created → verify enrollment stopped
    - **Engagement tracking:** Simulate open/click webhooks → verify events recorded
    - Fire 10 conversions → no further sends
    - Test AI Gateway failover (if configured)
    - Enroll with missing data → verify `{{default}}` helpers work
    - Enroll with complex nested data → verify rendering
    - **Idempotency:** Same idempotency key → returns existing enrollment
    - **Tags and headers:** Verify custom metadata passed to Resend
- **Chaos:**
    - Kill scheduler mid-batch; ensure no duplicates on resume
    - Simulate LLM failures; verify fallback to default journey
    - Simulate template render failures; verify error handling
    - **Webhook retries:** Fail webhook processing → verify exponential backoff
    - **Batch failures:** Resend API errors → verify individual error handling
- **Compliance:**
    - Verify unsubscribe removes future sends within one cycle
    - **Hard bounce → suppression:** verify <60s
    - **Spam complaint → global suppression:** verify all journeys stopped
- **BYO:**
    - Invalid Resend key surfaces actionable error at enrollment
    - Header override works
- **Performance:**
    - 100-email batch sends in <2s
    - Webhook processing <100ms per event
    - Analytics endpoint <500ms for 10k enrollments
- **Test Mode:**
    - Verify no actual sends, faster progression, message records created
- **AI Testing:**
    - Mock LLM responses for deterministic tests
    - Verify schema validation catches malformed AI outputs
    - Test retry logic on AI SDK errors

---

## 13) Delivery Plan (2 weeks)

**Day 1-2:** Schema + endpoints scaffolding + Vercel AI SDK setup + Handlebars setup + BYO Resend plumbing + duplicate prevention + idempotency keys

**Day 3-4:** Journey creation with `generateObject` + template validation + fallback, **batch sending logic**, idempotency

**Day 5-6:** **Webhook endpoint + Svix verification**, suppression logic (bounce/complaint handling), error handling, retry logic (including AI SDK retries, template render failures), send windows, Handlebars helpers

**Day 7:** Unsubscribe + suppression + link redirect tracking + **engagement event recording (open/click)**

**Day 8:** `/timeline`, `/preview`, **`/analytics`**, **`/suppressions`**, `/health`, test mode

**Day 9:** **Webhook processing refinement**, monitoring setup (including webhook metrics, batch metrics, engagement metrics), operational limits, rate limiting

**Day 10:** Docs + copy-paste snippets; sandbox sender; sample recipes with personalization + tags + webhook setup guide

**Day 11-12:** Design-partner pilots (3 accounts), fix list, **load testing with batch sends + webhook simulation**

**Day 13:** Buffer for issues

**Day 14:** Launch prep + final testing

---

## 14) Risks & Mitigations

- **Deliverability:** provide sandbox sender + daily cap; DKIM/SPF guide.
- **Scheduler drift / load spikes:** batch sends (20-100x fewer API calls); per-account rate limit; exponential backoff on Resend errors.
- **PII safety:** redact keys; limited retention; encryption at rest for keys and contact data.
- **LLM variance:** strict Zod schema + validation; default journey on failure; built-in retries with Vercel AI SDK.
- **Template failures:** validation at journey creation; graceful degradation; clear error messages.
- **XSS via user data:** all data HTML-escaped by Handlebars by default.
- **Duplicate enrollments:** unique constraint + idempotency keys + return existing enrollment.
- **AI Gateway dependency:** fallback to direct OpenAI if gateway unavailable (automatic with AI SDK).
- **Token costs:** bounded by single generation per journey; consider caching common journey patterns.
- **Webhook failures:** Retry with exponential backoff; dead letter queue; alert on >1% failure rate.
- **Webhook replay attacks:** Svix signature verification with timestamp checks (prevent >5min old requests).
- **Batch send failures:** Individual email error handling within batch; retry only failed sends.
- **Suppression bypass:** Check suppression list before every send; cache hot suppressions.
- **Webhook storms:** Rate limit webhook processing; queue for async processing if needed.
- **Data inconsistency:** Webhook events may arrive out of order; use idempotent processing.

---

## 15) Future Compatibility Note

- `enrollment_id` will remain stable for v1
- Journey structure may expand (backward compatible)
- API endpoints will be versioned if breaking changes needed
- Message history will be preserved
- `personalization_snapshot` enables audit trail and debugging
- Migration path to Temporal orchestration ready (workflow_id field exists)
- AI Gateway enables easy model switching (GPT-4 → Claude, etc.) without code changes
- Handlebars helpers can be extended without breaking existing journeys
- Webhook event types can expand without breaking existing handlers
- **Batch send logic supports future Resend API changes**
- **Suppression rules can be customized per account in future**

---

## 16) Nice-to-Have (post-v0)

- Per-message LLM personalization variants (A/B) using streaming `generateObject`
- More conditions (engaged_recently N days, opened_last_email, etc.)
- SDK package (Node.js, Python, Go)
- Multi-channel + journey marketplace
- Temporal integration for complex workflows
- AI Gateway advanced features: A/B testing across models, cost optimization routing
- Structured output streaming for real-time journey preview during generation
- Advanced Handlebars helpers: conditional logic, loops, date math
- Template library marketplace
- **Resend Audience sync:** Import contacts from Resend Audiences
- **Resend Broadcast integration:** Use Resend Broadcasts for one-time mass sends
- **React Email support:** Native React component templates (Node.js only)
- **Attachment support:** File attachments per stage
- **Advanced analytics:** Funnel visualization, cohort analysis, revenue attribution
- **Smart send time optimization:** Per-recipient best time to send
- **Engagement-based throttling:** Slow down if low open rates
- **Custom unsubscribe pages:** Branded unsubscribe experience
- **Domain management UI:** View/configure Resend domains in GTM OS
- **Team collaboration:** Share journeys, approval workflows

---

## 17) Technology Stack Summary

### 17.1 Core Dependencies

```json
{
  "dependencies": {
    "convex": "^1.x.x",
    "ai": "^5.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "zod": "^3.22.0",
    "resend": "^2.x.x",
    "handlebars": "^4.7.8",
    "svix": "^1.x.x"
  }
}
```

### 17.2 Environment Variables

```bash
# Convex
CONVEX_DEPLOYMENT=prod:gtm-os

# Vercel AI (AI Gateway automatically configured on Vercel)
OPENAI_API_KEY=sk-...

# Optional: Explicit AI Gateway config (if self-hosting)
VERCEL_AI_GATEWAY_URL=https://gateway.ai.vercel.com

# Webhook verification
RESEND_WEBHOOK_SECRET=whsec_...

# Encryption
ENCRYPTION_KEY=...
```

---

## 18) Resend-Specific Integration Details

### 18.1 Batch Sending Advantages

- **Efficiency:** 100 emails per API call vs 100 individual calls
- **Rate Limits:** Single rate limit check vs 100 checks
- **Latency:** ~1-2s total vs 100× individual latencies
- **Error Handling:** Per-email errors in response vs all-or-nothing
- **Cost:** Potential Resend billing advantages (TBD)

### 18.2 Webhook Event Coverage

GTM OS processes these Resend webhook events:

|Event|Action|Impact|
|---|---|---|
|`email.sent`|Update message status|Confirmation|
|`email.delivered`|Update delivery status|Success metric|
|`email.bounced`|Add to suppression, stop enrollment|Critical: prevents future bounces|
|`email.complained`|Global suppression, stop all enrollments|Critical: compliance|
|`email.opened`|Record engagement event|Analytics|
|`email.clicked`|Record engagement event|Analytics|
|`email.delivery_delayed`|Log warning|Monitoring|

### 18.3 Metadata Flow

```
Journey Creation → Enrollment → Batch Send → Resend → Webhook → Analytics
     ↓                ↓              ↓          ↓         ↓          ↓
  journey_id    enrollment_id    headers     stores     reads     reports
                   + tags        + tags     metadata   metadata   metrics
```

Custom headers in emails enable webhook event correlation back to GTM OS entities.

### 18.4 Recommended Resend Setup

1. **Create API Key:** Full access (for sending + domain management)
2. **Configure Webhook:**
    - URL: `https://your-domain.com/webhooks/resend`
    - Events: All email events
    - Copy signing secret
3. **Verify Domain:** Add DNS records for SPF, DKIM
4. **Enable Tracking:** Turn on open/click tracking in Resend dashboard
5. **Test:** Send test email, verify webhook delivery

---

**Document Status:** Ready to Build  
**Version Notes:** v0.5 adds comprehensive Resend integration with batch sending (20-100x efficiency), webhook processing for automatic bounce/complaint handling and engagement tracking, rich metadata support (tags, custom headers, reply-to), enhanced analytics, suppression list management, and idempotency keys for reliability. All "Must Have" and "Should Have" features integrated into v0 scope.

**Next Action:** Begin Day 1 implementation with Vercel AI SDK setup + Handlebars integration + schema validation + idempotency framework