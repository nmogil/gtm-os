# GTM OS MVP - Implementation Plan

**Generated:** October 1, 2025
**Total Duration:** 14 days (2 weeks)
**Total Issues:** 19
**GitHub Project:** [GTM OS MVP](https://github.com/users/nmogil/projects/4)
**Repository:** [nmogil/gtm-os](https://github.com/nmogil/gtm-os)

---

## Overview

This implementation plan breaks down the GTM OS MVP (defined in `mvp_prd.md`) into 19 digestible GitHub issues organized across 6 phases. Each issue includes:

- **Detailed implementation steps** with code snippets and file paths
- **Explicit testing steps** to verify functionality
- **Clear acceptance criteria** for completion
- **Dependencies** on other issues
- **References** to specific PRD sections

## Project Structure

```
Phase 1: Foundation & Setup (Days 1-2)           - 5 issues
Phase 2: Journey Generation & AI (Days 3-4)      - 2 issues
Phase 3: Enrollment & Batch Sending (Days 3-4)   - 2 issues
Phase 4: Webhooks & Compliance (Days 5-7)        - 2 issues
Phase 5: Analytics & Monitoring (Days 8-9)       - 3 issues
Phase 6: Testing & Launch (Days 10-14)           - 5 issues
```

---

## Phase 1: Foundation & Setup (Days 1-2)

**Goal:** Setup core infrastructure, database schema, authentication, and templating

### Issue #1: Setup Convex project and install core dependencies
- **Milestone:** Phase 1
- **Priority:** High
- **Labels:** foundation
- **Key Tasks:**
  - Initialize Convex project
  - Install dependencies (convex, ai, @ai-sdk/openai, zod, resend, handlebars, svix)
  - Setup environment variables
  - Create project structure
- **Files Created:** package.json, convex/schema.ts, convex/http.ts, .env.local

### Issue #2: Define Convex database schema for all tables
- **Milestone:** Phase 1
- **Priority:** High
- **Labels:** database, foundation
- **Dependencies:** #1
- **Key Tasks:**
  - Define all 7 tables: accounts, journeys, enrollments, messages, events, suppressions, webhook_events
  - Create all required indexes per PRD Section 6
  - Implement unique constraints
- **Files Modified:** convex/schema.ts

### Issue #3: Implement API authentication middleware with X-API-Key
- **Milestone:** Phase 1
- **Priority:** High
- **Labels:** api, foundation
- **Dependencies:** #2
- **Key Tasks:**
  - Create authentication utilities
  - Implement authenticatedAction wrapper
  - Create standard error response format
  - Define all error codes from PRD
- **Files Created:** convex/lib/auth.ts, convex/lib/httpAuth.ts, convex/lib/errors.ts, convex/queries.ts

### Issue #4: Implement BYO Resend key storage and validation
- **Milestone:** Phase 1
- **Priority:** High
- **Labels:** api, foundation
- **Dependencies:** #2, #3
- **Key Tasks:**
  - Create encryption utilities (AES-256-GCM)
  - Implement Resend key management
  - Add key validation before storage
  - Support X-Resend-Key header override
- **Files Created:** convex/lib/encryption.ts, convex/lib/resend.ts, convex/lib/env.ts, convex/mutations.ts

### Issue #6: Setup Handlebars templating with custom helpers
- **Milestone:** Phase 1
- **Priority:** High
- **Labels:** foundation
- **Dependencies:** #1
- **Key Tasks:**
  - Configure Handlebars with custom helpers (default, uppercase, date_format)
  - Implement template validation
  - Add XSS protection verification
  - Create template testing utilities
- **Files Created:** convex/lib/templates.ts, convex/lib/templateTests.ts

### Issue #7: Implement idempotency for enrollments and messages
- **Milestone:** Phase 1
- **Priority:** High
- **Labels:** foundation, api
- **Dependencies:** #2
- **Key Tasks:**
  - Create idempotency utilities
  - Implement X-Idempotency-Key header handling
  - Add enrollment deduplication by (account, journey, email)
  - Prevent duplicate messages by (enrollment, stage)
  - Add cleanup cron job
- **Files Created:** convex/lib/idempotency.ts, convex/lib/enrollmentIdempotency.ts, convex/lib/messageIdempotency.ts, convex/crons.ts

---

## Phase 2: Journey Generation & AI (Days 3-4)

**Goal:** Implement AI-powered journey generation using Vercel AI SDK

### Issue #8: Setup Vercel AI SDK with OpenAI for journey generation
- **Milestone:** Phase 2
- **Priority:** High
- **Labels:** ai-integration
- **Dependencies:** #1, #6
- **Key Tasks:**
  - Configure Vercel AI SDK with OpenAI
  - Implement journey schema with Zod
  - Create generateObject integration
  - Add default journey fallback
  - Implement retry logic
- **Files Created:** convex/lib/ai.ts
- **Files Modified:** convex/lib/env.ts

### Issue #9: Implement POST /journeys endpoint with AI generation
- **Milestone:** Phase 2
- **Priority:** High
- **Labels:** api, ai-integration
- **Dependencies:** #3, #8, #6
- **Key Tasks:**
  - Create journey creation mutation
  - Implement HTTP route
  - Add template validation before saving
  - Support options (emails count, default_reply_to)
- **Files Modified:** convex/mutations.ts, convex/queries.ts, convex/http.ts

---

## Phase 3: Enrollment & Batch Sending (Days 3-4)

**Goal:** Enable contact enrollment and implement batch email sending with scheduler

### Issue #10: Implement POST /enrollments endpoint with metadata support
- **Milestone:** Phase 3
- **Priority:** High
- **Labels:** api
- **Dependencies:** #3, #4, #7, #2
- **Key Tasks:**
  - Create enrollment mutation with suppression check
  - Implement idempotent enrollment creation
  - Support metadata (tags, headers, reply_to)
  - Add test_mode and start_at scheduling
  - Validate Resend key before enrollment
- **Files Modified:** convex/mutations.ts, convex/http.ts

### Issue #11: Implement scheduler cron for batch email sending
- **Milestone:** Phase 3
- **Priority:** High
- **Labels:** scheduler
- **Dependencies:** #4, #6, #7
- **Key Tasks:**
  - Create scheduler cron (runs every minute)
  - Group enrollments by account for batch processing
  - Implement batch sending (up to 100 emails per call)
  - Add send window logic (9am-5pm)
  - Handle template rendering with context
  - Process Resend batch API results
  - Update enrollment stages
- **Files Created:** convex/scheduler.ts
- **Files Modified:** convex/crons.ts

---

## Phase 4: Webhooks & Compliance (Days 5-7)

**Goal:** Process Resend webhooks for engagement tracking and implement compliance features

### Issue #12: Implement Resend webhook processing with Svix verification
- **Milestone:** Phase 4
- **Priority:** High
- **Labels:** webhooks
- **Dependencies:** #1, #2
- **Key Tasks:**
  - Create webhook handler with Svix signature verification
  - Process all event types (sent, delivered, bounced, complained, opened, clicked)
  - Implement bounce handling (hard/soft)
  - Implement complaint handling (global suppression)
  - Record engagement events
  - Add webhook route to HTTP router
- **Files Created:** convex/webhooks.ts
- **Files Modified:** convex/mutations.ts, convex/http.ts

### Issue #13: Implement POST /events endpoint for conversion and unsubscribe tracking
- **Milestone:** Phase 4
- **Priority:** High
- **Labels:** api, compliance
- **Dependencies:** #2, #3
- **Key Tasks:**
  - Create event recording mutation
  - Implement conversion handling (stop sends)
  - Implement unsubscribe handling (suppression)
  - Create unsubscribe page (GET /u/:token)
  - Update journey stats on conversion
- **Files Modified:** convex/mutations.ts, convex/queries.ts, convex/http.ts

---

## Phase 5: Analytics & Monitoring (Days 8-9)

**Goal:** Provide analytics, monitoring, and operational visibility

### Issue #14: Implement analytics and timeline endpoints
- **Milestone:** Phase 5
- **Priority:** Medium
- **Labels:** api
- **Dependencies:** #2, #3
- **Key Tasks:**
  - Create journey analytics query (engagement metrics, by-stage breakdown)
  - Create enrollment timeline query (merged messages and events)
  - Create suppressions query with filtering
  - Add HTTP routes for all analytics endpoints
- **Files Modified:** convex/queries.ts, convex/http.ts

### Issue #15: Implement monitoring, metrics, and health check endpoint
- **Milestone:** Phase 5
- **Priority:** Medium
- **Labels:** api
- **Dependencies:** #2
- **Key Tasks:**
  - Create health check endpoint
  - Implement monitoring queries (active enrollments, pending sends, error metrics)
  - Create metrics collection utility
  - Add metrics logging
  - Setup metrics collection cron (hourly)
- **Files Created:** convex/lib/metrics.ts
- **Files Modified:** convex/queries.ts, convex/http.ts, convex/crons.ts

---

## Phase 6: Testing & Launch (Days 10-14)

**Goal:** Comprehensive testing, documentation, pilot program, and launch

### Issue #16: Create comprehensive test suite (unit, integration, chaos)
- **Milestone:** Phase 6
- **Priority:** High
- **Labels:** testing
- **Dependencies:** All other issues
- **Key Tasks:**
  - Setup Vitest testing framework
  - Create unit tests (templates, idempotency, validation)
  - Create integration tests (full journey workflow)
  - Create chaos tests (scheduler crashes, failures)
  - Verify test mode functionality
  - Achieve 80%+ test coverage
- **Files Created:** tests/templates.test.ts, tests/integration.test.ts, tests/chaos.test.ts, vitest.config.ts

### Issue #17: Write documentation and copy-paste examples
- **Milestone:** Phase 6
- **Priority:** High
- **Labels:** docs
- **Dependencies:** All API endpoints
- **Key Tasks:**
  - Create README with 10-minute quickstart
  - Write complete API reference
  - Create code examples and recipes
  - Write webhook setup guide
  - Create contributing guide
- **Files Created:** README.md, API.md, EXAMPLES.md, WEBHOOK_SETUP.md, CONTRIBUTING.md

### Issue #18: Run design partner pilot program with 3 accounts
- **Milestone:** Phase 6
- **Priority:** High
- **Dependencies:** #1-#15
- **Key Tasks:**
  - Identify and onboard 3 design partners
  - Setup monitoring for pilot accounts
  - Collect feedback via interviews
  - Create fix list from feedback
  - Implement critical fixes
  - Validate success metrics
- **Deliverables:** Pilot report, feedback summary, fix list

### Issue #19: Conduct load testing for 10k enrollments/day target
- **Milestone:** Phase 6
- **Priority:** High
- **Labels:** testing
- **Dependencies:** All features, #15
- **Key Tasks:**
  - Setup Artillery for load testing
  - Create load test scenarios
  - Run enrollment load test (100/min)
  - Run batch sending test (10k enrollments)
  - Run webhook processing test (1000/min)
  - Monitor performance metrics
  - Analyze results against targets
- **Deliverables:** Load test scripts, performance report

### Issue #20: Final launch preparation and go-live
- **Milestone:** Phase 6
- **Priority:** High
- **Dependencies:** #18, #19, #17
- **Key Tasks:**
  - Complete security review checklist
  - Verify compliance requirements
  - Configure monitoring and alerts
  - Deploy to production
  - Run smoke tests
  - Announce launch
  - Monitor first 24 hours
- **Deliverables:** Production deployment, launch announcement

---

## Success Metrics

Per PRD Section 11.1, the MVP is successful if:

- ✅ **TTFV:** Journey sent in ≤10 minutes (cold start)
- ✅ **Stop-on-convert:** ≤60s from `/events` to suppression
- ✅ **Throughput:** 10k enrollments/day with <1% errors
- ✅ **Batch Efficiency:** ≥90% of sends use batch API
- ✅ **Webhook Reliability:** ≥99% processed within 30s
- ✅ **Suppression Accuracy:** 100% of bounces/complaints suppressed within 60s
- ✅ **AI Success Rate:** ≥95% of generations succeed
- ✅ **Template Reliability:** <0.1% render failures

---

## Issue Dependencies Graph

```
#1 (Convex Setup)
  └─ #2 (Schema)
      ├─ #3 (Auth)
      │   ├─ #9 (Journeys endpoint)
      │   ├─ #10 (Enrollments endpoint)
      │   └─ #13 (Events endpoint)
      ├─ #4 (Resend keys)
      │   └─ #10 (Enrollments)
      │   └─ #11 (Scheduler)
      ├─ #7 (Idempotency)
      │   └─ #10 (Enrollments)
      │   └─ #11 (Scheduler)
      └─ #12 (Webhooks)
      └─ #14 (Analytics)
      └─ #15 (Monitoring)
  └─ #6 (Handlebars)
      └─ #8 (AI SDK)
          └─ #9 (Journeys endpoint)
      └─ #11 (Scheduler)

#16 (Testing) → depends on all
#17 (Docs) → depends on all APIs
#18 (Pilot) → depends on #1-#15
#19 (Load Testing) → depends on #1-#15
#20 (Launch) → depends on #18, #19, #17
```

---

## Development Workflow

### For Each Issue:

1. **Read the issue carefully** - All implementation details are provided
2. **Check dependencies** - Ensure dependent issues are complete
3. **Create a feature branch** - `git checkout -b issue-<number>-<description>`
4. **Implement the code** - Follow the provided code snippets and file paths
5. **Run tests** - Complete all testing steps in the issue
6. **Verify acceptance criteria** - Check all boxes before submitting
7. **Create PR** - Reference the issue number in the PR description
8. **Get review** - Have another developer review if available
9. **Merge and deploy** - Merge to main and verify in staging

### Critical Path:

The fastest path through the issues:
1. #1 → #2 → #3 → #9 (Create journeys)
2. #4, #6, #7 in parallel
3. #10 (Enroll contacts)
4. #11 (Send emails)
5. #12 (Track webhooks)
6. #13 (Track conversions)

This gets you to a working end-to-end flow in ~7 days.

---

## Notes for Junior Engineers

### When You Get Stuck:

1. **Check the PRD** - Section references are provided in each issue
2. **Review existing code** - Look at similar patterns in the codebase
3. **Ask questions** - Better to clarify than implement incorrectly
4. **Use the testing steps** - They're designed to validate as you go
5. **Check dependencies** - You might be blocked by another issue

### Code Quality Checklist:

- ✅ TypeScript types defined for all parameters
- ✅ Error handling with proper error codes
- ✅ Logging for debugging (no secrets in logs)
- ✅ Comments for complex logic
- ✅ All acceptance criteria met
- ✅ Tests passing
- ✅ No console errors

### Common Patterns:

- **Mutations** go in `convex/mutations.ts`
- **Queries** go in `convex/queries.ts`
- **HTTP routes** go in `convex/http.ts`
- **Utilities** go in `convex/lib/`
- **Cron jobs** go in `convex/crons.ts`

---

## Project Links

- **GitHub Repository:** https://github.com/nmogil/gtm-os
- **GitHub Project Board:** https://github.com/users/nmogil/projects/4
- **PRD:** `/project-context/mvp_prd.md`
- **All Issues:** https://github.com/nmogil/gtm-os/issues

---

## Issue Summary Table

| # | Title | Phase | Priority | Labels |
|---|-------|-------|----------|--------|
| 1 | Setup Convex project and install core dependencies | 1 | High | foundation |
| 2 | Define Convex database schema for all tables | 1 | High | database, foundation |
| 3 | Implement API authentication middleware with X-API-Key | 1 | High | api, foundation |
| 4 | Implement BYO Resend key storage and validation | 1 | High | api, foundation |
| 6 | Setup Handlebars templating with custom helpers | 1 | High | foundation |
| 7 | Implement idempotency for enrollments and messages | 1 | High | foundation, api |
| 8 | Setup Vercel AI SDK with OpenAI for journey generation | 2 | High | ai-integration |
| 9 | Implement POST /journeys endpoint with AI generation | 2 | High | api, ai-integration |
| 10 | Implement POST /enrollments endpoint with metadata support | 3 | High | api |
| 11 | Implement scheduler cron for batch email sending | 3 | High | scheduler |
| 12 | Implement Resend webhook processing with Svix verification | 4 | High | webhooks |
| 13 | Implement POST /events endpoint for conversion and unsubscribe tracking | 4 | High | api, compliance |
| 14 | Implement analytics and timeline endpoints | 5 | Medium | api |
| 15 | Implement monitoring, metrics, and health check endpoint | 5 | Medium | api |
| 16 | Create comprehensive test suite (unit, integration, chaos) | 6 | High | testing |
| 17 | Write documentation and copy-paste examples | 6 | High | docs |
| 18 | Run design partner pilot program with 3 accounts | 6 | High | - |
| 19 | Conduct load testing for 10k enrollments/day target | 6 | High | testing |
| 20 | Final launch preparation and go-live | 6 | High | - |

---

**Last Updated:** October 1, 2025
**Status:** Ready to start development
