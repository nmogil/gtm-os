# CLAUDE.md

GTM OS (Go-to-Market Operating System) is an email journey automation platform built on Convex. It enables users to create AI-generated email sequences, enroll contacts, and manage multi-stage email campaigns with template personalization.

## Development Commands

```bash
npm run dev          # Start Convex dev server
npx convex dev       # Initialize Convex (first-time)
npx tsx testing/*    # Run test scripts
```

## Architecture

**Convex Function Types:**
- **HTTP Routes** (`convex/http.ts`): Public REST API with X-API-Key auth via `authenticatedAction` wrapper
- **Actions** (`convex/actions.ts`): External API calls (OpenAI, Resend, encryption) - marked `"use node"`, must call mutations/queries for DB access
- **Mutations** (`convex/mutations.ts`): All database writes
- **Queries** (`convex/queries.ts`): Database reads
- **Crons** (`convex/crons.ts`): Scheduled jobs (hourly idempotency cleanup)

**Database Schema** (`convex/schema.ts`):
- `accounts`: Multi-tenant API keys, plan limits, usage tracking
- `journeys`: Email sequences with stages, version field for updates
- `enrollments`: Contact enrollments with `journey_version` and `stages_snapshot` for isolation
- `messages`: Individual emails with delivery status
- `events`: Opens, clicks, conversions, unsubscribes
- `suppressions`: Bounce/complaint list
- `webhook_events`: Resend webhook queue

**Key Indexes:**
- `enrollments.by_account_journey_email`: Idempotency checking
- `enrollments.by_next_run_at`: Scheduling sends
- `messages.by_resend_message_id`: Webhook processing

**Authentication:**
- X-API-Key validated against `accounts.api_key` (plaintext)
- Sensitive data encrypted via `convex/lib/encryption.ts`
- Flow: `convex/lib/httpAuth.ts` → `convex/lib/auth.ts`

**Templating** (`convex/lib/templates.ts`):
- Handlebars-based with helpers: `{{default}}`, `{{uppercase}}`, `{{date_format}}`
- Required: `{{unsubscribe_url}}` in all email bodies
- Context: contact data (name, email, company, custom fields) + system vars
- Validate with `validateJourneyTemplates()`

**Idempotency:**
- `convex/lib/enrollmentIdempotency.ts`: In-memory cache → DB lookup via index
- `convex/lib/messageIdempotency.ts`: Prevents duplicate sends per stage
- Use `createEnrollmentIdempotent()` from `convex/lib/idempotency.ts`

**Journey Versioning:**
- Each journey has `version` field (increments on stage updates)
- Enrollments store `journey_version` and `stages_snapshot` at enrollment time
- Active enrollments unaffected by journey updates (use snapshot, not live journey)
- Metadata updates (name, is_active) don't increment version

**AI Generation:**
- Flow: HTTP → `generateJourneyAction` → `generateJourneyWithFallback` (`convex/lib/ai.ts`)
- Vercel AI SDK + OpenAI with Zod schemas
- Requires `OPENAI_API_KEY`, has fallback template

**Email Sending:**
- BYO Resend API keys (encrypted in `accounts.resend_api_key_encrypted`)
- Validation: `validateResendKey()` in `convex/lib/resend.ts`

## Environment Variables

```bash
CONVEX_DEPLOYMENT=    # Auto-generated
OPENAI_API_KEY=       # AI generation
RESEND_API_KEY=       # System default
SVIX_WEBHOOK_SECRET=  # Webhook verification
ENCRYPTION_KEY=       # Auto-generated if missing
```

## Testing

**Endpoint Tests:** `test-journeys-endpoint.ts`, `test-enrollments-endpoint.ts`, `test-health-endpoint.ts`, `test-metrics-collection.ts`, `test-health-performance.ts`

**System Tests:** `test-templates.ts`, `test-scheduler.ts`, `test-resend-validation.ts`, `test-fresh-enrollment.ts`

**Utilities:** `cleanup-enrollments.ts`, `create-fast-test-journey.ts`

Run with: `npx tsx testing/<filename>`

## Common Patterns

**New HTTP endpoint:**
1. Add route in `convex/http.ts` with `authenticatedAction()`
2. Use `errorResponse()` for errors
3. Call actions via `ctx.runAction` (external APIs)
4. Call mutations via `ctx.runMutation` (DB writes)

**New mutation:** Define in `convex/mutations.ts` with `mutation()`, use Convex validators, access DB via `ctx.db`

**New action:** Start with `"use node"`, define with `action()`, use for external APIs, must call mutations/queries for DB

## Key Files

- `convex/schema.ts`: Schema + indexes (journeys.version, enrollments.stages_snapshot)
- `convex/http.ts`: API endpoints (POST/GET/PATCH /journeys, POST /enrollments, etc.)
- `convex/actions.ts`: External API layer
- `convex/mutations.ts`: DB writes (createJourneyFromGenerated, createManualJourney, updateJourney, createEnrollment)
- `convex/queries.ts`: DB reads (getJourney)
- `convex/lib/httpAuth.ts`: API auth wrapper
- `convex/lib/templates.ts`: Handlebars engine
- `convex/lib/idempotency.ts`: Idempotency management
- `convex/lib/ai.ts`: OpenAI generation
- `convex/lib/encryption.ts`: Data encryption

## Convex Guidelines

**Function Syntax:** Use new syntax with `args`/`returns` validators:
```ts
export const f = query({
  args: { name: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => { ... }
});
```

**Registration:** Use `internalQuery/Mutation/Action` for private functions, `query/mutation/action` for public API

**Calling:** `ctx.runQuery/runMutation/runAction` with FunctionReference from `api` or `internal` objects

**HTTP:** `httpAction` in `convex/http.ts`, path field specifies exact route

**Validators:** `v.null()` for null returns, `v.id(tableName)` for IDs, `v.array()`, `v.object()`, `v.record()` for objects with dynamic keys

**Schema:** Index names include all fields (e.g., `by_field1_and_field2`), query fields in index order

**Queries:** Use `.withIndex()` not `.filter()`, `.unique()` for single result, `.order('asc'|'desc')` for ordering

**Actions:** Add `"use node";` for Node modules, never use `ctx.db` (call mutations/queries instead)

**Types:** Use `Id<'tableName'>` from `./_generated/dataModel`, strict typing for document IDs

## User Documentation

**Structure:**
- `README.md`: Quick start guide
- `docs/API.md`: Complete API reference with examples
- `docs/EXAMPLES.md`: Production code in Node.js/Python/Bash
- `docs/TEMPLATES.md`: Handlebars guide
- `docs/WEBHOOKS.md`: Resend webhook setup
- `docs/TESTING.md`: Testing workflows

**When to Reference:**
- User questions → Point to relevant docs/ file
- Internal development → Use CLAUDE.md
- Code changes → Update related docs (new endpoints → API.md, new helpers → TEMPLATES.md, etc.)
