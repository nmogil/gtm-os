# GTM OS Code Examples

Production-ready code examples for common use cases.

## Table of Contents

- [Recipe 1: Trial User Conversion Flow](#recipe-1-trial-user-conversion-flow)
- [Recipe 2: Onboarding Sequence](#recipe-2-onboarding-sequence)
- [Recipe 3: Re-engagement Campaign](#recipe-3-re-engagement-campaign)
- [Recipe 4: Product Launch Announcement](#recipe-4-product-launch-announcement)
- [Recipe 5: Event-Driven Emails](#recipe-5-event-driven-emails)
- [Recipe 6: Batch Enrollment](#recipe-6-batch-enrollment)
- [Recipe 7: Analytics Dashboard](#recipe-7-analytics-dashboard)
- [Recipe 8: Idempotent Operations](#recipe-8-idempotent-operations)

---

## Recipe 1: Trial User Conversion Flow

**Use Case:** Send a 7-email sequence to trial users to convert them to paid within 14 days. Stop immediately when they upgrade.

### Step 1: Create Journey

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

**Response:**
```json
{
  "journey_id": "jd7fg1fa3kq2dncmm05323g1td7rnxse",
  "name": "Trial → Paid Conversion",
  "stages": [...]
}
```

### Step 2: Enroll Users on Signup

#### Node.js
```javascript
// app/api/signup.js
async function handleUserSignup(user) {
  // ... create user in your database ...

  // Enroll in trial conversion journey
  const response = await fetch('https://focused-bloodhound-276.convex.site/enrollments', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.GTM_OS_API_KEY,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `signup_${user.id}_trial_journey`
    },
    body: JSON.stringify({
      journey_id: process.env.TRIAL_JOURNEY_ID,
      contact: {
        email: user.email,
        data: {
          name: user.name,
          company: user.company,
          plan: user.plan,
          trial_ends: user.trial_end_date.getTime()
        }
      },
      options: {
        tags: {
          source: 'signup_form',
          plan: user.plan
        }
      }
    })
  });

  const enrollment = await response.json();
  console.log('Enrolled in trial journey:', enrollment.enrollment_id);
}
```

#### Python
```python
# app/auth.py
import requests
import os

def handle_user_signup(user):
    # ... create user in your database ...

    # Enroll in trial conversion journey
    response = requests.post(
        'https://focused-bloodhound-276.convex.site/enrollments',
        headers={
            'X-API-Key': os.environ['GTM_OS_API_KEY'],
            'Content-Type': 'application/json',
            'X-Idempotency-Key': f'signup_{user.id}_trial_journey'
        },
        json={
            'journey_id': os.environ['TRIAL_JOURNEY_ID'],
            'contact': {
                'email': user.email,
                'data': {
                    'name': user.name,
                    'company': user.company,
                    'plan': user.plan,
                    'trial_ends': int(user.trial_end_date.timestamp() * 1000)
                }
            },
            'options': {
                'tags': {
                    'source': 'signup_form',
                    'plan': user.plan
                }
            }
        }
    )

    enrollment = response.json()
    print(f'Enrolled in trial journey: {enrollment["enrollment_id"]}')
```

### Step 3: Track Conversion (Stop Sends)

#### Node.js
```javascript
// app/api/upgrade.js
async function handleUserUpgrade(user) {
  // ... process payment ...

  // Send conversion event to stop trial emails immediately
  await fetch('https://focused-bloodhound-276.convex.site/events', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.GTM_OS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'conversion',
      contact_email: user.email,
      journey_id: process.env.TRIAL_JOURNEY_ID,
      metadata: {
        plan: user.upgraded_plan,
        mrr: user.monthly_revenue
      }
    })
  });

  console.log('Conversion tracked - trial emails stopped');
}
```

#### Python
```python
# app/billing.py
def handle_user_upgrade(user):
    # ... process payment ...

    # Send conversion event to stop trial emails immediately
    requests.post(
        'https://focused-bloodhound-276.convex.site/events',
        headers={
            'X-API-Key': os.environ['GTM_OS_API_KEY'],
            'Content-Type': 'application/json'
        },
        json={
            'type': 'conversion',
            'contact_email': user.email,
            'journey_id': os.environ['TRIAL_JOURNEY_ID'],
            'metadata': {
                'plan': user.upgraded_plan,
                'mrr': user.monthly_revenue
            }
        }
    )

    print('Conversion tracked - trial emails stopped')
```

---

## Recipe 2: Onboarding Sequence

**Use Case:** Welcome new users with a 5-email onboarding sequence teaching them how to use your product.

### Complete Example (Node.js)

```javascript
// onboarding.js
const GTM_OS_API_KEY = process.env.GTM_OS_API_KEY;
const BASE_URL = 'https://focused-bloodhound-276.convex.site';

class OnboardingManager {
  constructor() {
    this.journeyId = null;
  }

  async createJourney() {
    const response = await fetch(`${BASE_URL}/journeys`, {
      method: 'POST',
      headers: {
        'X-API-Key': GTM_OS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        goal: 'Teach new users core product features',
        audience: 'New signups in first 7 days',
        options: {
          emails: 5,
          default_reply_to: 'support@yourcompany.com'
        }
      })
    });

    const journey = await response.json();
    this.journeyId = journey.journey_id;
    console.log('Created onboarding journey:', this.journeyId);
    return this.journeyId;
  }

  async enrollUser(user) {
    const response = await fetch(`${BASE_URL}/enrollments`, {
      method: 'POST',
      headers: {
        'X-API-Key': GTM_OS_API_KEY,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `onboarding_${user.id}`
      },
      body: JSON.stringify({
        journey_id: this.journeyId,
        contact: {
          email: user.email,
          data: {
            name: user.name,
            company: user.company,
            role: user.role,
            signup_date: Date.now()
          }
        },
        options: {
          tags: {
            source: 'onboarding',
            cohort: this.getCohortName()
          }
        }
      })
    });

    return await response.json();
  }

  async trackFeatureUsed(user, featureName) {
    // Track when users complete onboarding steps
    await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'X-API-Key': GTM_OS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'custom',
        contact_email: user.email,
        journey_id: this.journeyId,
        metadata: {
          feature: featureName,
          completed_at: Date.now()
        }
      })
    });
  }

  getCohortName() {
    const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    return `week_${week}`;
  }
}

// Usage
const onboarding = new OnboardingManager();

// Create journey once
await onboarding.createJourney();

// Enroll users as they sign up
app.post('/api/signup', async (req, res) => {
  const user = await createUser(req.body);
  await onboarding.enrollUser(user);
  res.json({ success: true });
});

// Track feature usage
app.post('/api/features/:name/used', async (req, res) => {
  await onboarding.trackFeatureUsed(req.user, req.params.name);
  res.json({ success: true });
});
```

---

## Recipe 3: Re-engagement Campaign

**Use Case:** Send emails to inactive users who haven't logged in for 30 days.

### Python Example

```python
# reengagement.py
import requests
import os
from datetime import datetime, timedelta

GTM_OS_API_KEY = os.environ['GTM_OS_API_KEY']
BASE_URL = 'https://focused-bloodhound-276.convex.site'

class ReengagementCampaign:
    def __init__(self):
        self.journey_id = None

    def create_journey(self):
        response = requests.post(
            f'{BASE_URL}/journeys',
            headers={
                'X-API-Key': GTM_OS_API_KEY,
                'Content-Type': 'application/json'
            },
            json={
                'goal': 'Re-engage inactive users',
                'audience': 'Users who haven\'t logged in for 30 days',
                'options': {
                    'emails': 3,
                    'default_reply_to': 'success@yourcompany.com'
                }
            }
        )

        journey = response.json()
        self.journey_id = journey['journey_id']
        print(f'Created re-engagement journey: {self.journey_id}')
        return self.journey_id

    def find_inactive_users(self):
        # Query your database for inactive users
        cutoff_date = datetime.now() - timedelta(days=30)

        # Example query (adjust for your database)
        inactive_users = User.objects.filter(
            last_login__lt=cutoff_date,
            account_status='active'
        )

        return inactive_users

    def enroll_inactive_users(self):
        inactive_users = self.find_inactive_users()

        enrolled_count = 0
        for user in inactive_users:
            try:
                response = requests.post(
                    f'{BASE_URL}/enrollments',
                    headers={
                        'X-API-Key': GTM_OS_API_KEY,
                        'Content-Type': 'application/json',
                        'X-Idempotency-Key': f'reengagement_{user.id}_{datetime.now().strftime("%Y%m")}'
                    },
                    json={
                        'journey_id': self.journey_id,
                        'contact': {
                            'email': user.email,
                            'data': {
                                'name': user.name,
                                'last_login': int(user.last_login.timestamp() * 1000),
                                'days_inactive': (datetime.now() - user.last_login).days
                            }
                        },
                        'options': {
                            'tags': {
                                'campaign': 'reengagement',
                                'inactive_days': str((datetime.now() - user.last_login).days)
                            }
                        }
                    }
                )

                if response.status_code == 200:
                    enrolled_count += 1
                    print(f'Enrolled: {user.email}')
                else:
                    print(f'Failed to enroll {user.email}: {response.text}')

            except Exception as e:
                print(f'Error enrolling {user.email}: {e}')

        print(f'Total enrolled: {enrolled_count}/{len(inactive_users)}')

    def track_reactivation(self, user):
        # Call this when a user logs in again
        requests.post(
            f'{BASE_URL}/events',
            headers={
                'X-API-Key': GTM_OS_API_KEY,
                'Content-Type': 'application/json'
            },
            json={
                'type': 'conversion',
                'contact_email': user.email,
                'journey_id': self.journey_id,
                'metadata': {
                    'reactivated_at': int(datetime.now().timestamp() * 1000)
                }
            }
        )
        print(f'Reactivation tracked for {user.email}')

# Usage
campaign = ReengagementCampaign()

# Run once to create journey
campaign.create_journey()

# Run daily via cron
campaign.enroll_inactive_users()

# Hook into your login system
@app.route('/api/login', methods=['POST'])
def login():
    user = authenticate(request.json)
    if user.was_inactive_for_30_days():
        campaign.track_reactivation(user)
    return jsonify({'success': True})
```

---

## Recipe 4: Product Launch Announcement

**Use Case:** Announce a new product feature to your entire user base.

### Bash Script

```bash
#!/bin/bash
# product-launch.sh

GTM_OS_API_KEY="your-api-key"
BASE_URL="https://focused-bloodhound-276.convex.site"

# Create journey
JOURNEY_RESPONSE=$(curl -s -X POST "${BASE_URL}/journeys" \
  -H "X-API-Key: ${GTM_OS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Announce new analytics dashboard",
    "audience": "All active users",
    "options": {
      "emails": 2,
      "default_reply_to": "product@yourcompany.com"
    }
  }')

JOURNEY_ID=$(echo $JOURNEY_RESPONSE | jq -r '.journey_id')
echo "Created journey: ${JOURNEY_ID}"

# Export users from your database to CSV
# Example: id,email,name,company,plan
# 1,user1@company.com,John,TechCo,Pro
# 2,user2@company.com,Sarah,StartupCo,Enterprise

# Enroll users from CSV
while IFS=, read -r id email name company plan; do
  # Skip header
  if [ "$id" == "id" ]; then
    continue
  fi

  curl -s -X POST "${BASE_URL}/enrollments" \
    -H "X-API-Key: ${GTM_OS_API_KEY}" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: product_launch_${id}" \
    -d "{
      \"journey_id\": \"${JOURNEY_ID}\",
      \"contact\": {
        \"email\": \"${email}\",
        \"data\": {
          \"name\": \"${name}\",
          \"company\": \"${company}\",
          \"plan\": \"${plan}\"
        }
      },
      \"options\": {
        \"tags\": {
          \"campaign\": \"analytics_launch\",
          \"plan\": \"${plan}\"
        }
      }
    }" > /dev/null

  echo "Enrolled: ${email}"

  # Rate limit: 10 req/sec
  sleep 0.1
done < users.csv

echo "Launch campaign complete!"
```

---

## Recipe 5: Event-Driven Emails

**Use Case:** Send targeted emails based on user actions (demo requested, feature used, etc.).

### Node.js + Express

```javascript
// event-driven-emails.js
const express = require('express');
const app = express();

const GTM_OS_API_KEY = process.env.GTM_OS_API_KEY;
const BASE_URL = 'https://focused-bloodhound-276.convex.site';

// Journey IDs (created once, stored in env)
const JOURNEYS = {
  DEMO_REQUESTED: process.env.DEMO_JOURNEY_ID,
  FEATURE_INTEREST: process.env.FEATURE_INTEREST_JOURNEY_ID,
  CART_ABANDONED: process.env.CART_ABANDONED_JOURNEY_ID
};

// Helper function to enroll
async function enrollInJourney(journeyId, email, data, tags = {}) {
  const response = await fetch(`${BASE_URL}/enrollments`, {
    method: 'POST',
    headers: {
      'X-API-Key': GTM_OS_API_KEY,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `${journeyId}_${email}_${Date.now()}`
    },
    body: JSON.stringify({
      journey_id: journeyId,
      contact: { email, data },
      options: { tags }
    })
  });

  return await response.json();
}

// Event handlers
app.post('/api/events/demo-requested', async (req, res) => {
  const { email, name, company, preferred_date } = req.body;

  await enrollInJourney(
    JOURNEYS.DEMO_REQUESTED,
    email,
    {
      name,
      company,
      preferred_date,
      requested_at: Date.now()
    },
    {
      event: 'demo_requested',
      source: 'website_form'
    }
  );

  res.json({ success: true, message: 'Demo sequence started' });
});

app.post('/api/events/feature-clicked', async (req, res) => {
  const { email, feature_name } = req.body;

  // Track custom event
  await fetch(`${BASE_URL}/events`, {
    method: 'POST',
    headers: {
      'X-API-Key': GTM_OS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'custom',
      contact_email: email,
      metadata: {
        feature: feature_name,
        clicked_at: Date.now()
      }
    })
  });

  // If high-value feature, enroll in education journey
  if (['analytics', 'api', 'integrations'].includes(feature_name)) {
    await enrollInJourney(
      JOURNEYS.FEATURE_INTEREST,
      email,
      { interested_feature: feature_name },
      { feature: feature_name }
    );
  }

  res.json({ success: true });
});

app.post('/api/events/cart-abandoned', async (req, res) => {
  const { email, cart_items, cart_value } = req.body;

  await enrollInJourney(
    JOURNEYS.CART_ABANDONED,
    email,
    {
      cart_items: cart_items.join(', '),
      cart_value,
      abandoned_at: Date.now()
    },
    {
      event: 'cart_abandoned',
      cart_value: String(cart_value)
    }
  );

  res.json({ success: true, message: 'Cart recovery sequence started' });
});

app.listen(3000, () => console.log('Event API running on port 3000'));
```

---

## Recipe 6: Batch Enrollment

**Use Case:** Enroll 1000+ users efficiently with proper error handling and rate limiting.

### Python with Async

```python
# batch_enrollment.py
import asyncio
import aiohttp
import os
from typing import List, Dict

GTM_OS_API_KEY = os.environ['GTM_OS_API_KEY']
BASE_URL = 'https://focused-bloodhound-276.convex.site'

class BatchEnroller:
    def __init__(self, journey_id: str, rate_limit: int = 10):
        self.journey_id = journey_id
        self.rate_limit = rate_limit  # requests per second
        self.semaphore = asyncio.Semaphore(rate_limit)

    async def enroll_contact(self, session: aiohttp.ClientSession, contact: Dict) -> Dict:
        async with self.semaphore:
            try:
                async with session.post(
                    f'{BASE_URL}/enrollments',
                    headers={
                        'X-API-Key': GTM_OS_API_KEY,
                        'Content-Type': 'application/json',
                        'X-Idempotency-Key': f'batch_{self.journey_id}_{contact["email"]}'
                    },
                    json={
                        'journey_id': self.journey_id,
                        'contact': contact,
                        'options': {
                            'tags': {'source': 'batch_import'}
                        }
                    }
                ) as response:
                    result = await response.json()

                    if response.status == 200:
                        return {
                            'success': True,
                            'email': contact['email'],
                            'enrollment_id': result['enrollment_id']
                        }
                    else:
                        return {
                            'success': False,
                            'email': contact['email'],
                            'error': result.get('message', 'Unknown error')
                        }

            except Exception as e:
                return {
                    'success': False,
                    'email': contact['email'],
                    'error': str(e)
                }

            finally:
                # Rate limiting
                await asyncio.sleep(1 / self.rate_limit)

    async def enroll_batch(self, contacts: List[Dict]) -> Dict:
        async with aiohttp.ClientSession() as session:
            tasks = [self.enroll_contact(session, contact) for contact in contacts]
            results = await asyncio.gather(*tasks)

        successful = [r for r in results if r['success']]
        failed = [r for r in results if not r['success']]

        return {
            'total': len(results),
            'successful': len(successful),
            'failed': len(failed),
            'failures': failed
        }

# Usage
async def main():
    # Load contacts from database or CSV
    contacts = [
        {
            'email': 'user1@company.com',
            'data': {
                'name': 'John Doe',
                'company': 'TechCo'
            }
        },
        {
            'email': 'user2@company.com',
            'data': {
                'name': 'Jane Smith',
                'company': 'StartupCo'
            }
        },
        # ... 1000+ more contacts
    ]

    enroller = BatchEnroller(
        journey_id='jd7fg1fa3kq2dncmm05323g1td7rnxse',
        rate_limit=10  # 10 requests per second
    )

    print(f'Enrolling {len(contacts)} contacts...')

    results = await enroller.enroll_batch(contacts)

    print(f"\nResults:")
    print(f"  Total: {results['total']}")
    print(f"  Successful: {results['successful']}")
    print(f"  Failed: {results['failed']}")

    if results['failures']:
        print(f"\nFailures:")
        for failure in results['failures']:
            print(f"  {failure['email']}: {failure['error']}")

# Run
asyncio.run(main())
```

---

## Recipe 7: Analytics Dashboard

**Use Case:** Build a real-time dashboard showing journey performance.

### Node.js + React

```javascript
// api/analytics.js
const express = require('express');
const router = express.Router();

const GTM_OS_API_KEY = process.env.GTM_OS_API_KEY;
const BASE_URL = 'https://focused-bloodhound-276.convex.site';

router.get('/journeys/:id/analytics', async (req, res) => {
  try {
    const response = await fetch(
      `${BASE_URL}/journeys/${req.params.id}/analytics`,
      {
        headers: {
          'X-API-Key': GTM_OS_API_KEY
        }
      }
    );

    const analytics = await response.json();
    res.json(analytics);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/health', async (req, res) => {
  try {
    const response = await fetch(
      `${BASE_URL}/health`,
      {
        headers: {
          'X-API-Key': GTM_OS_API_KEY
        }
      }
    );

    const health = await response.json();
    res.json(health);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

```javascript
// components/JourneyDashboard.jsx
import React, { useEffect, useState } from 'react';

function JourneyDashboard({ journeyId }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [journeyId]);

  async function fetchAnalytics() {
    const response = await fetch(`/api/journeys/${journeyId}/analytics`);
    const data = await response.json();
    setAnalytics(data);
    setLoading(false);
  }

  if (loading) return <div>Loading...</div>;

  const { stats } = analytics;

  return (
    <div className="dashboard">
      <h1>{analytics.name}</h1>

      <div className="metrics">
        <MetricCard
          title="Enrolled"
          value={stats.total_enrolled}
        />
        <MetricCard
          title="Conversions"
          value={stats.total_converted}
          percentage={(stats.total_converted / stats.total_enrolled * 100).toFixed(1) + '%'}
        />
        <MetricCard
          title="Open Rate"
          value={(stats.open_rate * 100).toFixed(1) + '%'}
        />
        <MetricCard
          title="Click Rate"
          value={(stats.click_rate * 100).toFixed(1) + '%'}
        />
      </div>

      <div className="stage-breakdown">
        <h2>Stage Performance</h2>
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Sent</th>
              <th>Opens</th>
              <th>Clicks</th>
              <th>Open Rate</th>
            </tr>
          </thead>
          <tbody>
            {analytics.stage_breakdown.map(stage => (
              <tr key={stage.stage}>
                <td>Stage {stage.stage}</td>
                <td>{stage.sent}</td>
                <td>{stage.opens}</td>
                <td>{stage.clicks}</td>
                <td>{((stage.opens / stage.sent) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ title, value, percentage }) {
  return (
    <div className="metric-card">
      <h3>{title}</h3>
      <div className="value">{value}</div>
      {percentage && <div className="percentage">{percentage}</div>}
    </div>
  );
}

export default JourneyDashboard;
```

---

## Recipe 8: Idempotent Operations

**Use Case:** Safely retry failed enrollments without creating duplicates.

### Node.js with Retry Logic

```javascript
// enrollment-service.js
class EnrollmentService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://focused-bloodhound-276.convex.site';
  }

  async enrollWithRetry(journeyId, contact, options = {}, maxRetries = 3) {
    // Generate deterministic idempotency key
    const idempotencyKey = this.generateIdempotencyKey(journeyId, contact.email);

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/enrollments`, {
          method: 'POST',
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify({
            journey_id: journeyId,
            contact,
            options
          })
        });

        if (response.ok) {
          const enrollment = await response.json();

          if (enrollment.existing) {
            console.log(`Enrollment already exists: ${enrollment.enrollment_id}`);
          } else {
            console.log(`Created new enrollment: ${enrollment.enrollment_id}`);
          }

          return {
            success: true,
            enrollment,
            attempts: attempt
          };
        }

        // Handle specific error codes
        if (response.status === 401) {
          throw new Error('Invalid API key - not retrying');
        }

        if (response.status === 404) {
          throw new Error('Journey not found - not retrying');
        }

        // Server error - retry
        const error = await response.json();
        lastError = new Error(error.message || 'Server error');

        console.log(`Attempt ${attempt} failed: ${lastError.message}`);

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error) {
        if (error.message.includes('not retrying')) {
          throw error;
        }

        lastError = error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError.message,
      attempts: maxRetries
    };
  }

  generateIdempotencyKey(journeyId, email) {
    // Deterministic key based on journey and email
    // Same inputs always produce same key
    return `${journeyId}_${email}_${this.normalizeEmail(email)}`;
  }

  normalizeEmail(email) {
    return email.toLowerCase().trim();
  }

  async batchEnrollWithRetry(journeyId, contacts) {
    const results = await Promise.all(
      contacts.map(contact =>
        this.enrollWithRetry(journeyId, contact)
          .catch(error => ({
            success: false,
            error: error.message,
            contact
          }))
      )
    );

    return {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
}

// Usage
const service = new EnrollmentService(process.env.GTM_OS_API_KEY);

// Single enrollment with retry
const result = await service.enrollWithRetry(
  'jd7fg1fa3kq2dncmm05323g1td7rnxse',
  {
    email: 'user@company.com',
    data: {
      name: 'John Doe',
      company: 'TechCo'
    }
  }
);

if (result.success) {
  console.log('Enrollment successful:', result.enrollment.enrollment_id);
} else {
  console.error('Enrollment failed after retries:', result.error);
}

// Batch with retry
const batchResults = await service.batchEnrollWithRetry(
  'jd7fg1fa3kq2dncmm05323g1td7rnxse',
  contacts
);

console.log(`Batch complete: ${batchResults.successful}/${batchResults.total} successful`);
```

---

## Additional Resources

- [API Reference](./API.md) - Complete endpoint documentation
- [Template Guide](./TEMPLATES.md) - Email personalization with Handlebars
- [Webhook Setup](./WEBHOOKS.md) - Real-time event tracking
- [Testing Guide](./TESTING.md) - Safe testing practices

---

## Best Practices Summary

1. **Always use idempotency keys** for enrollments
2. **Track conversions immediately** to stop sends within 60s
3. **Use test_mode** for development and testing
4. **Implement retry logic** with exponential backoff
5. **Rate limit batch operations** to 10 req/sec
6. **Normalize emails** before creating idempotency keys
7. **Tag enrollments** for analytics and filtering
8. **Monitor health endpoint** for system status
9. **Handle errors gracefully** and log failures
10. **Test templates** before enrolling real users
