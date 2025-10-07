# GTM OS Template Guide

GTM OS uses [Handlebars](https://handlebarsjs.com/) for email template personalization. This guide covers the templating system, custom helpers, and best practices.

## Table of Contents

- [Basic Syntax](#basic-syntax)
- [Custom Helpers](#custom-helpers)
- [Template Context](#template-context)
- [Required Variables](#required-variables)
- [HTML Escaping](#html-escaping)
- [Examples](#examples)
- [Validation](#validation)
- [Best Practices](#best-practices)

---

## Basic Syntax

### Variables

Use double curly braces to insert variables:

```handlebars
Hello {{name}}, welcome to {{company}}!
```

**Result:**
```
Hello Sarah, welcome to TechCo!
```

### Conditional Blocks

```handlebars
{{#if plan}}
  Your current plan: {{plan}}
{{else}}
  You're on the free plan.
{{/if}}
```

### Loops

```handlebars
{{#each features}}
  - {{this}}
{{/each}}
```

---

## Custom Helpers

GTM OS provides three custom Handlebars helpers:

### 1. `default` - Fallback Values

Provides a default value when a variable is undefined or empty.

**Syntax:**
```handlebars
{{default variable "fallback value"}}
```

**Example:**
```handlebars
Hello {{default name "there"}},

Your company: {{default company "your organization"}}
```

**With data:**
```json
{
  "name": "Sarah",
  "company": ""
}
```

**Result:**
```
Hello Sarah,

Your company: your organization
```

**Implementation:** (convex/lib/templates.ts:5-7)
```typescript
Handlebars.registerHelper("default", function(value: any, defaultValue: string) {
  return value || defaultValue;
});
```

---

### 2. `uppercase` - Transform to Uppercase

Converts a string to uppercase.

**Syntax:**
```handlebars
{{uppercase variable}}
```

**Example:**
```handlebars
Subject: {{uppercase priority}} ALERT: System Notification
```

**With data:**
```json
{
  "priority": "high"
}
```

**Result:**
```
Subject: HIGH ALERT: System Notification
```

**Implementation:** (convex/lib/templates.ts:9-11)
```typescript
Handlebars.registerHelper("uppercase", function(value: string) {
  return value ? value.toUpperCase() : "";
});
```

---

### 3. `date_format` - Format Unix Timestamps

Formats a Unix timestamp (milliseconds) into a human-readable date.

**Syntax:**
```handlebars
{{date_format timestamp}}
```

**Example:**
```handlebars
Your trial ends on {{date_format trial_ends}}
```

**With data:**
```json
{
  "trial_ends": 1729180800000
}
```

**Result:**
```
Your trial ends on October 17, 2024
```

**Format:** `Month Day, Year` (e.g., "January 1, 2025")

**Implementation:** (convex/lib/templates.ts:13-21)
```typescript
Handlebars.registerHelper("date_format", function(timestamp: number) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
});
```

---

## Template Context

Every email template receives a `TemplateContext` object with the following structure:

### Contact Data

Any data you provide in `contact.data` during enrollment:

```javascript
{
  contact: {
    email: "user@company.com",
    data: {
      name: "Sarah Chen",
      company: "TechCo",
      plan: "Pro",
      trial_ends: 1729180800000,
      // ... any custom fields
    }
  }
}
```

**Available as variables:**
```handlebars
{{name}}
{{company}}
{{plan}}
{{trial_ends}}
```

### System Variables

Automatically provided by GTM OS:

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `{{email}}` | string | Contact's email address | `user@company.com` |
| `{{unsubscribe_url}}` | string | Unsubscribe link (required) | `https://focused-bloodhound-276.convex.site/u/...` |
| `{{enrollment_id}}` | string | Unique enrollment ID | `jn73xsmrtb3f2awx3beamabym97rqcaj` |
| `{{journey_name}}` | string | Journey name | `Trial → Paid Conversion` |

### Custom Fields

You can add any custom fields to `contact.data`:

```javascript
{
  contact: {
    email: "user@company.com",
    data: {
      // Standard fields
      name: "Sarah",

      // Custom fields
      product_tier: "Enterprise",
      account_manager: "John Doe",
      custom_message: "Special offer just for you!",
      features_used: ["analytics", "reports", "api"]
    }
  }
}
```

**Use in templates:**
```handlebars
Hi {{name}},

Your account manager {{account_manager}} wanted to share:
{{custom_message}}

You're currently using:
{{#each features_used}}
  - {{this}}
{{/each}}
```

---

## Required Variables

### `{{unsubscribe_url}}` is Mandatory

**All email bodies MUST include `{{unsubscribe_url}}`**. This is enforced by validation.

**Minimum required footer:**
```html
<p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
```

**Better footer example:**
```html
<hr>
<p style="font-size: 12px; color: #666;">
  You're receiving this because you signed up for {{journey_name}}.
  <a href="{{unsubscribe_url}}">Unsubscribe</a> from this journey.
</p>
```

**Validation:** (convex/lib/templates.ts:108-110)
```typescript
if (!stage.body.includes("{{unsubscribe_url}}")) {
  errors.push("Stage " + i + " missing unsubscribe_url");
}
```

---

## HTML Escaping

### Automatic HTML Escaping

Handlebars **automatically escapes** HTML entities when using `{{variable}}` syntax:

**Template:**
```handlebars
<p>{{user_input}}</p>
```

**Data:**
```json
{
  "user_input": "<script>alert('xss')</script>"
}
```

**Output (safe):**
```html
<p>&lt;script&gt;alert('xss')&lt;/script&gt;</p>
```

### Triple-Braces for Unescaped HTML

Use `{{{variable}}}` (triple braces) only when you need to render HTML:

**Template:**
```handlebars
{{{rich_text_content}}}
```

**Data:**
```json
{
  "rich_text_content": "<strong>Bold text</strong>"
}
```

**Output:**
```html
<strong>Bold text</strong>
```

**⚠️ Warning:** Only use triple-braces for trusted content. Never use for user input.

---

## Examples

### Example 1: Welcome Email

**Template:**
```handlebars
Subject: Welcome to {{company}}, {{default name "there"}}!

Body:
<html>
<body>
  <h1>Welcome {{default name "aboard"}},</h1>

  <p>Thanks for signing up for {{company}}! We're excited to have you on board.</p>

  {{#if trial_ends}}
  <p><strong>Your trial ends on {{date_format trial_ends}}</strong></p>
  <p>Make sure to upgrade before then to keep access to all features!</p>
  {{/if}}

  <p>Questions? Just reply to this email.</p>

  <p>
    Best,<br>
    The {{company}} Team
  </p>

  <hr>
  <p style="font-size: 12px; color: #666;">
    <a href="{{unsubscribe_url}}">Unsubscribe</a>
  </p>
</body>
</html>
```

**Enrollment:**
```bash
curl -X POST "https://focused-bloodhound-276.convex.site/enrollments" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "journey_id": "...",
    "contact": {
      "email": "sarah@techco.com",
      "data": {
        "name": "Sarah",
        "company": "TechCo",
        "trial_ends": 1729180800000
      }
    }
  }'
```

**Rendered Output:**
```html
Subject: Welcome to TechCo, Sarah!

Body:
<html>
<body>
  <h1>Welcome Sarah,</h1>

  <p>Thanks for signing up for TechCo! We're excited to have you on board.</p>

  <p><strong>Your trial ends on October 17, 2024</strong></p>
  <p>Make sure to upgrade before then to keep access to all features!</p>

  <p>Questions? Just reply to this email.</p>

  <p>
    Best,<br>
    The TechCo Team
  </p>

  <hr>
  <p style="font-size: 12px; color: #666;">
    <a href="https://focused-bloodhound-276.convex.site/u/jn73xsmrtb3f2awx3beamabym97rqcaj">Unsubscribe</a>
  </p>
</body>
</html>
```

---

### Example 2: Feature Announcement

**Template:**
```handlebars
Subject: {{uppercase priority}} Update: New Features Available

Body:
<html>
<body>
  <h1>Hey {{default name "there"}},</h1>

  <p>We just launched some exciting new features:</p>

  <ul>
  {{#each features}}
    <li><strong>{{this.name}}</strong>: {{this.description}}</li>
  {{/each}}
  </ul>

  <p>
    <a href="{{dashboard_url}}">Check them out →</a>
  </p>

  <p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
</body>
</html>
```

**Data:**
```json
{
  "name": "Sarah",
  "priority": "important",
  "dashboard_url": "https://app.techco.com/dashboard",
  "features": [
    {
      "name": "Advanced Analytics",
      "description": "Deep dive into your metrics"
    },
    {
      "name": "API Access",
      "description": "Programmatic access to your data"
    }
  ]
}
```

---

### Example 3: Conditional Content

**Template:**
```handlebars
Subject: {{#if converted}}Thank you!{{else}}Don't miss out{{/if}}

Body:
<html>
<body>
  {{#if converted}}
    <h1>Thanks for upgrading, {{name}}! 🎉</h1>
    <p>You're now on the {{plan}} plan.</p>
  {{else}}
    <h1>Hi {{name}}, your trial is ending soon</h1>
    <p>You have {{days_left}} days left. Upgrade now!</p>
  {{/if}}

  <p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
</body>
</html>
```

---

## Validation

### Template Syntax Validation

GTM OS validates all templates before saving:

```typescript
// Validates Handlebars syntax
validateTemplate(template: string): { valid: boolean; errors: string[] }
```

**Common errors:**
- Unclosed tags: `{{#if condition}}...` (missing `{{/if}}`)
- Invalid syntax: `{{invalid syntax here}}`
- Unregistered helpers: `{{custom_helper value}}`

### Journey Template Validation

Full journey validation includes:

1. **Syntax validation** for all subjects and bodies
2. **Required field check:** `{{unsubscribe_url}}` must be present in all bodies
3. **Stage ordering:** Days must be in ascending order

**Example:**
```typescript
const stages = [
  {
    day: 0,
    subject: "Welcome!",
    body: "<p>Hi {{name}}!</p>"  // ❌ Missing {{unsubscribe_url}}
  },
  {
    day: 2,
    subject: "{{invalid}",  // ❌ Invalid syntax
    body: "<p>Follow up</p><p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a></p>"
  }
];

validateJourneyTemplates(stages);
// Returns: { valid: false, errors: ["Stage 0 missing unsubscribe_url", "Stage 1 subject has errors"] }
```

---

## Best Practices

### 1. Always Provide Fallbacks

Use the `default` helper for optional fields:

```handlebars
❌ Hi {{name}},
✅ Hi {{default name "there"}},

❌ Welcome to {{company}}
✅ Welcome to {{default company "our platform"}}
```

### 2. Test with Empty Data

Always test templates with minimal data:

```json
{
  "email": "test@example.com"
}
```

Your templates should render gracefully even when optional fields are missing.

### 3. Keep HTML Simple

Use basic HTML for maximum email client compatibility:

```html
✅ <p><strong>Bold</strong> and <em>italic</em></p>
❌ <div class="flex items-center">...</div>  <!-- Complex CSS won't work -->
```

### 4. Include Unsubscribe Link Prominently

Make it easy to find:

```html
✅
<hr>
<p><a href="{{unsubscribe_url}}">Unsubscribe</a> from these emails</p>

❌
<p style="font-size: 6px; color: #fafafa;"><a href="{{unsubscribe_url}}">.</a></p>
```

### 5. Use Semantic Variable Names

```handlebars
✅ {{trial_end_date}} {{feature_name}} {{upgrade_url}}
❌ {{d}} {{fn}} {{url}}
```

### 6. Handle Edge Cases

```handlebars
{{#if items}}
  {{#each items}}
    - {{this}}
  {{/each}}
{{else}}
  No items to show
{{/if}}
```

### 7. Keep Subject Lines Short

Aim for 50 characters or less:

```handlebars
✅ Welcome to {{company}}, {{name}}!
✅ Your trial ends {{date_format trial_ends}}
❌ Hey {{name}}, we wanted to reach out to you today to let you know about...
```

### 8. Test Rendering Before Launch

Create a test enrollment to verify templates render correctly:

```bash
curl -X POST "https://focused-bloodhound-276.convex.site/enrollments" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "journey_id": "...",
    "contact": {
      "email": "test@yourcompany.com",
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

---

## Common Pitfalls

### 1. Forgetting Unsubscribe Link

```handlebars
❌
<p>Thanks for reading!</p>
<!-- Missing {{unsubscribe_url}} -->

✅
<p>Thanks for reading!</p>
<p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>
```

### 2. Using Undefined Variables

```handlebars
❌ Welcome {{username}}  <!-- If 'username' is undefined, renders "Welcome " -->
✅ Welcome {{default username "there"}}
```

### 3. Assuming Data Exists

```handlebars
❌
Your plan: {{plan.name}}  <!-- Crashes if 'plan' is undefined -->

✅
{{#if plan}}
  Your plan: {{plan.name}}
{{else}}
  No plan selected
{{/if}}
```

### 4. HTML Injection Risk

```handlebars
❌
{{{user_bio}}}  <!-- User could inject <script> tags -->

✅
{{user_bio}}  <!-- Automatically escaped -->
```

---

## Testing Templates

### 1. Use Testing Utility

```bash
npx tsx testing/test-templates.ts
```

### 2. Test with Edge Cases

```json
// Empty data
{}

// Partial data
{ "email": "test@example.com" }

// Complete data
{
  "email": "test@example.com",
  "name": "Test User",
  "company": "Test Co",
  "trial_ends": 1729180800000
}
```

### 3. Verify HTML Output

Check rendered emails in:
- Gmail
- Outlook
- Apple Mail
- Mobile clients

---

## Reference

- **Handlebars Documentation:** https://handlebarsjs.com/
- **Template Implementation:** `convex/lib/templates.ts`
- **Custom Helpers:** Lines 5-21 in `templates.ts`
- **Template Context:** Lines 23-34 in `templates.ts`
- **Validation:** Lines 68-122 in `templates.ts`

---

## Next Steps

- [API Reference](./API.md) - Learn about the enrollment API
- [Code Examples](./EXAMPLES.md) - See real-world usage patterns
- [Testing Guide](./TESTING.md) - Learn how to test templates safely
