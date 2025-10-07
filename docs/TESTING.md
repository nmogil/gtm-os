# GTM OS Testing Guide

Safe testing practices for developing and debugging email journeys without spamming users.

## Table of Contents

- [Test Mode](#test-mode)
- [Testing Utilities](#testing-utilities)
- [Running Tests](#running-tests)
- [Creating Test Journeys](#creating-test-journeys)
- [Testing Workflows](#testing-workflows)
- [Cleanup](#cleanup)
- [Best Practices](#best-practices)

---

## Test Mode

### What is Test Mode?

Test mode bypasses production restrictions to enable safe, fast testing:

**Bypasses:**
- ✅ Send window restrictions (9am-5pm UTC Mon-Fri)
- ✅ Minimum delay between stages
- ✅ Rate limits (for testing)

**Does NOT bypass:**
- ❌ Email sending (real emails are sent!)
- ❌ Resend API key validation
- ❌ Template rendering
- ❌ Webhook processing

**Use test mode for:**
- Development and debugging
- QA testing
- Demo environments
- Fast iteration

**Do NOT use test mode for:**
- Production enrollments
- Real customer emails
- Marketing campaigns

### Enabling Test Mode

Add `test_mode: true` to enrollment options:

```bash
curl -X POST "https://focused-bloodhound-276.convex.site/enrollments" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "journey_id": "jd7fg1fa3kq2dncmm05323g1td7rnxse",
    "contact": {
      "email": "test@yourcompany.com",
      "data": {
        "name": "Test User"
      }
    },
    "options": {
      "test_mode": true
    }
  }'
```

**Response includes test_mode flag:**
```json
{
  "enrollment_id": "...",
  "status": "active",
  "test_mode": true
}
```

---

## Testing Utilities

GTM OS includes testing utilities in the `testing/` directory:

### Available Test Scripts

**1. test-scheduler.ts**
- Comprehensive scheduler testing
- Tests batch sending, idempotency, stage progression
- Send window blocking, stop-on-convert
- Run with: `npx tsx testing/test-scheduler.ts`

**2. test-resend-validation.ts**
- Tests Resend API key validation
- Verifies valid/invalid key handling
- Run with: `npx tsx testing/test-resend-validation.ts`

**3. create-fast-test-journey.ts**
- Creates journey with 2-3 minute intervals
- For quick testing without waiting days
- Run with: `npx tsx testing/create-fast-test-journey.ts`

**4. cleanup-enrollments.ts**
- Removes test enrollments from database
- Cleans up test data
- Run with: `npx tsx testing/cleanup-enrollments.ts`

---

## Running Tests

### Prerequisites

```bash
# 1. Ensure Convex is running
npm run dev

# 2. Set up test account API key
export GTM_OS_TEST_API_KEY="test-api-key-123"

# 3. Use test email addresses (+ addressing)
# Examples:
# - yourname+test01@gmail.com
# - yourname+test02@gmail.com
```

### Test 1: Health Endpoint

```bash
npx tsx testing/test-health-endpoint.ts
```

**What it tests:**
- Health endpoint returns correct structure
- Active enrollments count
- Pending sends count
- Error rate calculation
- Failed enrollments tracking
- Webhook processing lag
- Authentication
- Response time < 500ms

**Expected output:**
```
Running: Health endpoint returns correct structure ✓ PASSED
Running: Active enrollments count is accurate ✓ PASSED
Running: Pending sends count is accurate ✓ PASSED
...
Total: 9 | Passed: 9 | Failed: 0
```

### Test 2: Metrics Collection

```bash
npx tsx testing/test-metrics-collection.ts
```

**What it tests:**
- Metrics accuracy
- Active enrollment counting
- Pending sends calculation
- Error rate formulas
- Failed enrollments (24h window)
- Webhook lag detection

**Expected output:**
```
Total: 9 | Passed: 9 | Failed: 0
```

### Test 3: Scheduler & Sending

```bash
npx tsx testing/test-scheduler.ts
```

**What it tests:**
- Basic batch sending (5 emails)
- Idempotency (no duplicates)
- Stage progression
- Send window blocking
- Stop-on-convert
- Suppression list

**Expected output:**
```
Running: Test A: Basic Scheduler - 5 Immediate Sends
✓ Created journey: jd7fg1fa3kq2dncmm05323g1td7rnxse
✓ Enrolled test1@gmail.com -> enrollment_id
✓ Enrolled test2@gmail.com -> enrollment_id
...
⏱️  Waiting 90 seconds for scheduler...
✓ PASSED

📧 MANUAL VERIFICATION CHECKLIST:
1. Check inbox for 5 emails
2. Verify personalization (names, unsubscribe URLs)
3. Verify no duplicates
```

**Important:** This test sends real emails! Use test email addresses.

### Test 4: Template Rendering

```bash
npx tsx testing/test-templates.ts
```

**What it tests:**
- Handlebars template rendering
- Custom helpers (default, uppercase, date_format)
- Required variables (unsubscribe_url)
- Template validation
- HTML escaping

**Expected output:**
```
✓ Basic template rendering
✓ default helper works
✓ uppercase helper works
✓ date_format helper works
✓ Missing unsubscribe_url fails validation
✓ HTML escaping prevents XSS
```

---

## Creating Test Journeys

### Fast Test Journey (2-3 min intervals)

For rapid testing without waiting days between emails:

```bash
npx tsx testing/create-fast-test-journey.ts
```

**Creates journey with:**
- Stage 0: Immediate
- Stage 1: ~2 minutes later
- Stage 2: ~5 minutes from start

**Use this journey for:**
- Testing scheduler logic
- Verifying stage progression
- Debugging send issues
- Demo purposes

### Custom Test Journey

Create a journey manually with custom content:

```bash
curl -X POST "https://focused-bloodhound-276.convex.site/journeys" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Test template rendering and personalization",
    "audience": "Test users",
    "options": {
      "emails": 3,
      "default_reply_to": "test@yourcompany.com"
    }
  }'
```

**Save the journey_id for testing:**
```bash
export TEST_JOURNEY_ID="jd7fg1fa3kq2dncmm05323g1td7rnxse"
```

---

## Testing Workflows

### Workflow 1: Test Full User Journey

**1. Create journey:**
```bash
curl -X POST "https://focused-bloodhound-276.convex.site/journeys" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "End-to-end test",
    "audience": "Test users",
    "options": {
      "emails": 3
    }
  }'
```

**2. Enroll test contact:**
```bash
curl -X POST "https://focused-bloodhound-276.convex.site/enrollments" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "journey_id": "'"$TEST_JOURNEY_ID"'",
    "contact": {
      "email": "yourname+test@gmail.com",
      "data": {
        "name": "Test User",
        "company": "Test Co"
      }
    },
    "options": {
      "test_mode": true
    }
  }'
```

**3. Wait for scheduler (60-90 seconds)**

**4. Check inbox for email**

**5. Verify email content:**
- ✅ Personalization works (name, company)
- ✅ Unsubscribe link present
- ✅ HTML renders correctly
- ✅ Subject line rendered

**6. Test unsubscribe link:**
```bash
# Click unsubscribe link in email
# Or curl the URL:
curl -X GET "https://focused-bloodhound-276.convex.site/u/ENROLLMENT_ID"
```

**7. Verify enrollment stopped:**
```bash
curl -X GET "https://focused-bloodhound-276.convex.site/enrollments/ENROLLMENT_ID/timeline" \
  -H "X-API-Key: YOUR_API_KEY"

# Check status = "removed"
```

### Workflow 2: Test Stop-on-Convert

**1. Enroll contact:**
```bash
ENROLLMENT=$(curl -s -X POST "https://focused-bloodhound-276.convex.site/enrollments" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "journey_id": "'"$TEST_JOURNEY_ID"'",
    "contact": {
      "email": "yourname+convert@gmail.com",
      "data": {
        "name": "Convert Test"
      }
    },
    "options": {
      "test_mode": true
    }
  }')

ENROLLMENT_ID=$(echo $ENROLLMENT | jq -r '.enrollment_id')
echo "Enrolled: $ENROLLMENT_ID"
```

**2. Send conversion event:**
```bash
curl -X POST "https://focused-bloodhound-276.convex.site/events" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "conversion",
    "contact_email": "yourname+convert@gmail.com",
    "journey_id": "'"$TEST_JOURNEY_ID"'"
  }'
```

**3. Wait 60 seconds (stop window)**

**4. Verify no more emails sent:**
```bash
# Check timeline
curl -X GET "https://focused-bloodhound-276.convex.site/enrollments/$ENROLLMENT_ID/timeline" \
  -H "X-API-Key: YOUR_API_KEY"

# Should show:
# - "status": "converted"
# - No emails after conversion event
```

### Workflow 3: Test Batch Enrollment

**1. Create test contacts file:**
```bash
cat > test-contacts.json <<EOF
[
  {
    "email": "yourname+batch01@gmail.com",
    "data": { "name": "Batch User 1", "company": "Test Co 1" }
  },
  {
    "email": "yourname+batch02@gmail.com",
    "data": { "name": "Batch User 2", "company": "Test Co 2" }
  },
  {
    "email": "yourname+batch03@gmail.com",
    "data": { "name": "Batch User 3", "company": "Test Co 3" }
  }
]
EOF
```

**2. Enroll contacts:**
```bash
cat test-contacts.json | jq -c '.[]' | while read contact; do
  curl -s -X POST "https://focused-bloodhound-276.convex.site/enrollments" \
    -H "X-API-Key: YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "journey_id": "'"$TEST_JOURNEY_ID"'",
      "contact": '"$contact"',
      "options": {
        "test_mode": true
      }
    }' | jq -r '.enrollment_id'

  # Rate limit: 10 req/sec
  sleep 0.1
done
```

**3. Verify all enrolled:**
```bash
# Check health endpoint
curl -X GET "https://focused-bloodhound-276.convex.site/health" \
  -H "X-API-Key: YOUR_API_KEY" | jq '.metrics.active_enrollments'
```

**4. Wait for scheduler**

**5. Check inboxes (should receive 3 emails)**

### Workflow 4: Test Idempotency

**1. Enroll same contact twice with same idempotency key:**
```bash
IDEMPOTENCY_KEY="test-idempotency-123"

# First enrollment
RESULT1=$(curl -s -X POST "https://focused-bloodhound-276.convex.site/enrollments" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "journey_id": "'"$TEST_JOURNEY_ID"'",
    "contact": {
      "email": "yourname+idempotent@gmail.com",
      "data": { "name": "Idempotent Test" }
    },
    "options": {
      "test_mode": true
    }
  }')

ENROLLMENT_ID=$(echo $RESULT1 | jq -r '.enrollment_id')
echo "First enrollment: $ENROLLMENT_ID"

# Second enrollment (should return existing)
RESULT2=$(curl -s -X POST "https://focused-bloodhound-276.convex.site/enrollments" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "journey_id": "'"$TEST_JOURNEY_ID"'",
    "contact": {
      "email": "yourname+idempotent@gmail.com",
      "data": { "name": "Idempotent Test" }
    },
    "options": {
      "test_mode": true
    }
  }')

echo "Second enrollment: $(echo $RESULT2 | jq -r '.enrollment_id')"
echo "Existing flag: $(echo $RESULT2 | jq -r '.existing')"

# Should be:
# - Same enrollment_id
# - existing: true
```

**2. Verify only one email sent (no duplicate)**

---

## Cleanup

### Cleanup Test Enrollments

After testing, clean up test data:

```bash
npx tsx testing/cleanup-enrollments.ts
```

**What it does:**
- Removes enrollments with `test_mode: true`
- Deletes associated messages
- Cleans up events
- Preserves analytics (journey stats)

**Manual cleanup:**

```bash
# Get all test enrollments
curl -X GET "https://focused-bloodhound-276.convex.site/enrollments?test_mode=true" \
  -H "X-API-Key: YOUR_API_KEY"

# Delete specific enrollment (if endpoint exists)
curl -X DELETE "https://focused-bloodhound-276.convex.site/enrollments/ENROLLMENT_ID" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Cleanup Test Journeys

Test journeys can be deleted via Convex dashboard or mutation:

```javascript
// In Convex dashboard:
// Go to Data > journeys
// Find test journeys
// Delete manually
```

---

## Best Practices

### 1. Use Test Email Addresses

**Use + addressing:**
```
yourname+test01@gmail.com
yourname+test02@gmail.com
yourname+feature_x@gmail.com
```

All emails go to `yourname@gmail.com` but are treated as unique addresses.

**Benefits:**
- Easy to filter in inbox
- Unlimited test addresses
- Real email delivery testing

### 2. Always Use Test Mode for Development

```javascript
{
  "options": {
    "test_mode": true
  }
}
```

**Prevents:**
- Waiting for send windows
- Slow iteration
- Production data contamination

### 3. Tag Test Enrollments

```javascript
{
  "options": {
    "test_mode": true,
    "tags": {
      "test": "true",
      "feature": "new_templates",
      "developer": "yourname"
    }
  }
}
```

**Benefits:**
- Easy to identify test data
- Filter analytics by test/prod
- Track which features are being tested

### 4. Verify Before Production

**Checklist:**
- ✅ Templates render correctly
- ✅ Personalization works
- ✅ Unsubscribe link works
- ✅ HTML displays in email clients
- ✅ Subject lines aren't truncated
- ✅ Resend API key is valid
- ✅ Webhooks are configured

### 5. Test Error Cases

Don't just test the happy path:

**Test:**
- Invalid email addresses
- Missing template variables
- Invalid journey_id
- Invalid API key
- Resend API failures
- Duplicate enrollments

### 6. Monitor Test Metrics

Even in test mode, monitor:
- Error rates
- Failed sends
- Bounce rates (if using real emails)

```bash
curl -X GET "https://focused-bloodhound-276.convex.site/health" \
  -H "X-API-Key: YOUR_API_KEY"
```

### 7. Clean Up After Testing

Always clean up test data:
- Prevents database bloat
- Keeps analytics clean
- Avoids confusion with prod data

### 8. Test with Real Email Clients

Send test emails and verify in:
- Gmail (web and mobile)
- Outlook (desktop and web)
- Apple Mail (macOS and iOS)
- Yahoo Mail

**Different clients render differently!**

### 9. Use Fast Test Journeys

For rapid iteration:
```bash
npx tsx testing/create-fast-test-journey.ts
```

Minutes instead of days between emails.

### 10. Document Test Scenarios

Create a test plan:

```markdown
# Test Plan: Feature X

## Scenarios
1. Happy path - user completes journey
2. User converts mid-journey
3. User unsubscribes
4. Email bounces (hard)
5. Template variables missing
6. Batch enrollment (100 users)
7. Idempotency (retry enrollment)

## Expected Results
...
```

---

## Continuous Testing

### Automated Testing

Set up automated tests with CI/CD:

```yaml
# .github/workflows/test.yml
name: Test GTM OS

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
      - run: npx tsx testing/test-scheduler.ts
```

### Monitoring

Set up monitoring for test environments:

```bash
# Cron job to check health
*/5 * * * * curl -H "X-API-Key: $API_KEY" https://focused-bloodhound-276.convex.site/health
```

Alert if:
- Error rate > 5%
- Webhook lag > 100
- Failed enrollments > 10

---

## Reference

- **Test Scripts:** `testing/` directory
- **Test Utilities:** `testing/test-*.ts`
- **Cleanup Scripts:** `testing/cleanup-*.ts`
- **Fast Journeys:** `testing/create-fast-test-journey.ts`

---

## Next Steps

- [API Reference](./API.md) - Endpoint documentation
- [Examples](./EXAMPLES.md) - Code recipes
- [Templates](./TEMPLATES.md) - Template guide
- [Webhooks](./WEBHOOKS.md) - Webhook setup
