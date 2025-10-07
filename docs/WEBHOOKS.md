# GTM OS Webhook Guide

GTM OS uses Resend webhooks to track email delivery, opens, clicks, bounces, and spam complaints in real-time.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Event Types](#event-types)
- [Security & Verification](#security--verification)
- [Webhook Processing](#webhook-processing)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

### What Webhooks Track

Resend webhooks notify GTM OS when:
- ✅ Emails are delivered
- ⏰ Emails are opened (tracking pixels)
- 🔗 Links are clicked
- ⚠️ Emails bounce (hard or soft)
- 🚫 Recipients mark emails as spam

### Why Use Webhooks

Without webhooks, you wouldn't know:
- Whether emails actually delivered
- If users are engaging with your content
- When emails bounce (wasting your reputation)
- When users mark you as spam (critical to address)

**Webhooks enable:**
- Real-time engagement tracking
- Automatic suppression list management
- Bounce and complaint handling
- Accurate analytics

---

## Setup

### Step 1: Get Webhook URL

Your webhook endpoint is:

```
https://focused-bloodhound-276.convex.site/webhooks/resend
```

This endpoint:
- ✅ Verifies webhook signatures (security)
- ✅ Deduplicates events
- ✅ Processes events asynchronously
- ✅ Updates message delivery status
- ✅ Manages suppression lists

### Step 2: Configure Resend Webhook

1. **Log in to Resend Dashboard**
   - Go to https://resend.com/webhooks

2. **Create New Endpoint**
   - Click "Add Endpoint"
   - Enter URL: `https://focused-bloodhound-276.convex.site/webhooks/resend`

3. **Select Events**
   Check all email events:
   - ☑️ `email.sent`
   - ☑️ `email.delivered`
   - ☑️ `email.bounced`
   - ☑️ `email.complained`
   - ☑️ `email.opened` (requires tracking enabled)
   - ☑️ `email.clicked` (requires tracking enabled)

4. **Copy Signing Secret**
   - After creating endpoint, copy the "Signing Secret"
   - Format: `whsec_xxxxxxxxxxxxx`

### Step 3: Add Secret to Environment

Add the signing secret to your Convex environment:

**Option A: Convex Dashboard**
1. Go to your Convex project dashboard
2. Click "Settings" → "Environment Variables"
3. Add new variable:
   - Name: `SVIX_WEBHOOK_SECRET`
   - Value: `whsec_xxxxxxxxxxxxx` (from Resend)
4. Click "Save"

**Option B: Command Line**
```bash
npx convex env set SVIX_WEBHOOK_SECRET whsec_xxxxxxxxxxxxx
```

**Option C: .env.local (for local development)**
```bash
# .env.local
SVIX_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Step 4: Verify Setup

Send a test webhook from Resend dashboard:
1. Go to webhook endpoint settings
2. Click "Send Test Event"
3. Select event type: `email.delivered`
4. Click "Send"

**Check logs:**
```bash
# View Convex logs
npx convex logs

# You should see:
# === RESEND WEBHOOK RECEIVED ===
# Webhook verified successfully
# Event type: email.delivered
# Webhook processed: {...}
```

---

## Event Types

### 1. email.sent

Fired when Resend accepts the email for delivery.

**Payload:**
```json
{
  "type": "email.sent",
  "created_at": "2025-10-06T10:00:00.000Z",
  "data": {
    "email_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "from": "digest@paper-boy.app",
    "to": ["user@company.com"],
    "subject": "Welcome to TechCo",
    "created_at": "2025-10-06T10:00:00.000Z"
  }
}
```

**GTM OS Action:**
- Updates message status to "sent"
- Records `sent_at` timestamp

---

### 2. email.delivered

Fired when the email is successfully delivered to the recipient's mail server.

**Payload:**
```json
{
  "type": "email.delivered",
  "created_at": "2025-10-06T10:01:00.000Z",
  "data": {
    "email_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "from": "digest@paper-boy.app",
    "to": ["user@company.com"],
    "subject": "Welcome to TechCo"
  }
}
```

**GTM OS Action:**
- Updates message `delivery_status` to "delivered"
- Records `delivered_at` timestamp
- This is the most important event for confirming delivery

---

### 3. email.bounced

Fired when an email bounces (permanent or temporary failure).

**Payload:**
```json
{
  "type": "email.bounced",
  "created_at": "2025-10-06T10:01:00.000Z",
  "data": {
    "email_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "from": "digest@paper-boy.app",
    "to": ["invalid@nonexistent-domain.com"],
    "subject": "Welcome to TechCo",
    "bounce_type": "hard"
  }
}
```

**Bounce Types:**
- **Hard bounce:** Permanent failure (invalid email, domain doesn't exist)
- **Soft bounce:** Temporary failure (mailbox full, server down)

**GTM OS Action:**
- Updates message `delivery_status` to "bounced"
- Sets `bounce_type` to "hard" or "soft"
- **Hard bounces:**
  - Adds email to suppression list (permanent)
  - Sets enrollment status to "suppressed"
  - Increments journey `total_bounced` stat
- **Soft bounces:**
  - Adds email to suppression list with 72-hour expiry
  - Will retry after expiry

---

### 4. email.complained

Fired when a recipient marks the email as spam.

**Payload:**
```json
{
  "type": "email.complained",
  "created_at": "2025-10-06T11:00:00.000Z",
  "data": {
    "email_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "from": "digest@paper-boy.app",
    "to": ["user@company.com"],
    "subject": "Welcome to TechCo"
  }
}
```

**GTM OS Action:**
- Updates message `delivery_status` to "complained"
- **Adds email to suppression list (permanent)**
- Sets enrollment status to "suppressed"
- Increments journey `total_complained` stat
- **Critical:** High spam rates damage your sender reputation

---

### 5. email.opened

Fired when a recipient opens the email (tracking pixel loaded).

**Payload:**
```json
{
  "type": "email.opened",
  "created_at": "2025-10-06T10:15:00.000Z",
  "data": {
    "email_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "from": "digest@paper-boy.app",
    "to": ["user@company.com"],
    "subject": "Welcome to TechCo"
  }
}
```

**GTM OS Action:**
- Creates "open" event record
- Updates journey open rate statistics
- Note: Multiple opens are possible (each time email is viewed)

**Limitations:**
- Requires tracking pixel enabled in Resend
- Blocked by privacy settings in some email clients
- Not 100% accurate (privacy features, plain text emails)

---

### 6. email.clicked

Fired when a recipient clicks a link in the email.

**Payload:**
```json
{
  "type": "email.clicked",
  "created_at": "2025-10-06T10:20:00.000Z",
  "data": {
    "email_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "from": "digest@paper-boy.app",
    "to": ["user@company.com"],
    "subject": "Welcome to TechCo",
    "click": {
      "link": "https://yourapp.com/dashboard",
      "ipAddress": "192.168.1.1"
    }
  }
}
```

**GTM OS Action:**
- Creates "click" event record
- Updates journey click rate statistics
- Stores clicked URL in metadata

**Limitations:**
- Requires link tracking enabled in Resend
- Only tracks HTTP/HTTPS links
- Multiple clicks on same link create multiple events

---

## Security & Verification

### Svix Signature Verification

All incoming webhooks are verified using [Svix](https://www.svix.com/) to prevent spoofing.

**How it works:**

1. **Resend signs webhook** with your secret
2. **GTM OS verifies signature** using same secret
3. **Rejects invalid signatures** (returns 401)

**Implementation:** (convex/webhooks.ts:52-69)

```typescript
const wh = new Webhook(webhookSecret);

try {
  payload = wh.verify(body, {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature
  });
} catch (err) {
  // Invalid signature - reject
  return errorResponse(
    "webhook_verification_failed",
    "Invalid webhook signature",
    { error: err.message },
    401
  );
}
```

### Required Headers

Every webhook must include these Svix headers:
- `svix-id` - Unique webhook message ID
- `svix-timestamp` - Unix timestamp of webhook
- `svix-signature` - HMAC signature

**Missing headers = rejected request (401)**

### Deduplication

GTM OS automatically deduplicates webhook events using:
```
unique_id = event_type + email_id
```

**Example:**
- `email.delivered:a1b2c3d4` ← First delivery event (processed)
- `email.delivered:a1b2c3d4` ← Duplicate (skipped)
- `email.opened:a1b2c3d4` ← Different event type (processed)

This prevents:
- Resend retry attempts from creating duplicates
- Accidental double-processing
- Incorrect analytics counts

---

## Webhook Processing

### Processing Flow

1. **Receive webhook** → Verify signature
2. **Look up message** → Find message by `resend_message_id`
3. **Store event** → Create webhook_event record
4. **Check for duplicate** → Skip if already processed
5. **Process event** → Update message status, create events, manage suppressions
6. **Return 200 OK** → Acknowledge receipt

### Async Processing

Webhooks are processed in two phases:

**Phase 1: Store (Immediate)**
```typescript
const result = await ctx.runMutation(api.mutations.createWebhookEvent, {
  account_id: accountId,
  resend_event_id: uniqueEventId,
  event_type: payload.type,
  contact_email: contactEmail,
  message_id: messageId,
  enrollment_id: enrollmentId,
  payload: payload
});
```

**Phase 2: Process (Async)**
```typescript
const processResult = await ctx.runMutation(api.mutations.processWebhookEvent, {
  webhook_event_id: result.webhook_event_id
});
```

This ensures:
- Fast webhook response (< 500ms)
- No retries for slow processing
- Guaranteed processing even if initial attempt fails

### Processing Actions by Event Type

**email.delivered:**
- Update message delivery_status
- Record delivered_at timestamp

**email.bounced:**
- Update message delivery_status
- Add to suppression list
- Update enrollment status
- Increment journey bounce count

**email.complained:**
- Update message delivery_status
- Add to suppression list (permanent)
- Update enrollment status
- Increment journey complaint count

**email.opened:**
- Create open event record
- Update journey open_rate

**email.clicked:**
- Create click event record
- Update journey click_rate
- Store clicked URL

---

## Testing

### Test Webhook Endpoint

Use curl to test your webhook endpoint:

```bash
curl -X POST "https://focused-bloodhound-276.convex.site/webhooks/resend" \
  -H "Content-Type: application/json" \
  -H "svix-id: msg_test123" \
  -H "svix-timestamp: 1704067200" \
  -H "svix-signature: v1,invalid_signature_for_testing" \
  -d '{
    "type": "email.delivered",
    "created_at": "2025-10-06T10:00:00.000Z",
    "data": {
      "email_id": "test-email-id",
      "from": "digest@paper-boy.app",
      "to": ["test@example.com"],
      "subject": "Test Email"
    }
  }'
```

**Expected response (401):**
```json
{
  "code": "webhook_verification_failed",
  "message": "Invalid webhook signature"
}
```

This confirms signature verification is working!

### Test with Resend Dashboard

1. Go to Resend webhook settings
2. Click "Send Test Event"
3. Select event type
4. Click "Send"

**Check Convex logs:**
```bash
npx convex logs

# Should see:
# === RESEND WEBHOOK RECEIVED ===
# Webhook verified successfully
# Event type: email.delivered
```

### Test End-to-End

1. **Create test enrollment:**
```bash
curl -X POST "https://focused-bloodhound-276.convex.site/enrollments" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "journey_id": "YOUR_JOURNEY_ID",
    "contact": {
      "email": "your-test-email@gmail.com",
      "data": {
        "name": "Test User"
      }
    },
    "options": {
      "test_mode": true
    }
  }'
```

2. **Wait for email to send** (scheduler runs every minute)

3. **Check your inbox** for the email

4. **Open the email** (triggers open webhook)

5. **Click a link** (triggers click webhook)

6. **Check Convex logs** for webhook events:
```bash
npx convex logs

# Should see:
# email.sent
# email.delivered
# email.opened
# email.clicked
```

7. **Query analytics:**
```bash
curl -X GET "https://focused-bloodhound-276.convex.site/journeys/YOUR_JOURNEY_ID/analytics" \
  -H "X-API-Key: YOUR_API_KEY"

# Should show:
# "open_rate": 1.0
# "click_rate": 1.0
```

---

## Troubleshooting

### Webhooks Not Arriving

**Check:**
1. ✅ Webhook endpoint URL is correct
2. ✅ Endpoint is enabled in Resend dashboard
3. ✅ Events are selected (check all email events)
4. ✅ Resend is sending to correct URL (check webhook logs in Resend)

**Debug:**
```bash
# Check Convex logs for incoming requests
npx convex logs

# If no logs, webhooks aren't reaching your endpoint
```

### Webhook Verification Failed (401)

**Causes:**
- ❌ `SVIX_WEBHOOK_SECRET` not set
- ❌ Wrong secret value
- ❌ Secret changed but not updated in environment

**Fix:**
```bash
# Verify secret is set
npx convex env get SVIX_WEBHOOK_SECRET

# If not set or wrong, update it
npx convex env set SVIX_WEBHOOK_SECRET whsec_xxxxxxxxxxxxx

# Restart Convex backend
npx convex dev
```

### Webhooks Failing to Process (500)

**Check logs:**
```bash
npx convex logs

# Look for:
# "Webhook processing error: ..."
```

**Common issues:**
- Missing message record (email sent outside GTM OS)
- Database schema mismatch
- Invalid payload structure

**Solution:**
- Check error message in logs
- Verify message exists: `messages.by_resend_message_id` index
- Report bug if payload structure changed

### Missing Events (No Opens/Clicks)

**Tracking must be enabled in Resend:**

When sending emails, include tracking options:

```javascript
// When configuring Resend API
{
  tracking: {
    opens: true,
    clicks: true
  }
}
```

**Note:** GTM OS handles this automatically. If you're missing open/click events, check:
1. Email client allows tracking pixels
2. Links are HTTP/HTTPS (mailto: links aren't tracked)
3. User privacy settings (some clients block tracking)

### Duplicate Events

**This is normal!** GTM OS deduplicates automatically.

**Example:**
- Resend retries failed webhooks
- Email opened multiple times
- Link clicked multiple times

**Deduplication ensures:**
- Only one delivery event per email
- Multiple opens/clicks are each tracked (expected behavior)

### Webhook Lag

Check the health endpoint:

```bash
curl -X GET "https://focused-bloodhound-276.convex.site/health" \
  -H "X-API-Key: YOUR_API_KEY"

# Check:
# "webhook_processing_lag": 0  ← Good
# "webhook_processing_lag": 500  ← 500 unprocessed events (investigate)
```

**High lag causes:**
- Large volume of webhooks
- Slow processing (database issues)
- Errors in webhook processing

**Solution:**
- Check Convex logs for errors
- Review `webhook_events` table for failed processing
- Contact support if persistent

---

## Best Practices

### 1. Always Set Webhook Secret

Never run without `SVIX_WEBHOOK_SECRET`:
- ❌ Allows anyone to spoof webhooks
- ❌ Invalid data in your database
- ❌ Incorrect analytics

### 2. Monitor Webhook Lag

Poll the health endpoint to detect processing issues:

```bash
*/5 * * * * curl -H "X-API-Key: $API_KEY" https://focused-bloodhound-276.convex.site/health
```

Alert if `webhook_processing_lag > 100`

### 3. Handle Bounces and Complaints

Check your suppression list regularly:

```bash
curl -X GET "https://focused-bloodhound-276.convex.site/suppressions?reason=spam_complaint" \
  -H "X-API-Key: YOUR_API_KEY"
```

**High complaint rate?**
- Review email content
- Check email targeting
- Ensure unsubscribe link is prominent

### 4. Test Webhooks Before Launch

Always test with real emails to verify:
- Webhooks arrive
- Events are processed
- Analytics are updated

### 5. Don't Rely Solely on Opens/Clicks

Open and click tracking has limitations:
- Privacy features block pixels
- Plain text emails can't be tracked
- Some email clients strip tracking

**Use delivery events as source of truth for sent/delivered status.**

---

## Reference

- **Webhook Implementation:** `convex/webhooks.ts`
- **Event Processing:** `convex/mutations.ts` (processWebhookEvent)
- **Resend Webhook Docs:** https://resend.com/docs/dashboard/webhooks/introduction
- **Svix Verification:** https://docs.svix.com/receiving/verifying-payloads/how

---

## Next Steps

- [API Reference](./API.md) - Complete endpoint documentation
- [Examples](./EXAMPLES.md) - Code examples for common use cases
- [Testing Guide](./TESTING.md) - Safe testing practices
