# Manual Journey Management - Implementation Guide

## Overview

This directory contains 4 GitHub issues that together implement comprehensive manual journey management for GTM OS. These features allow end users to create, retrieve, and update journeys with custom content and timing, providing an alternative to AI-generated journeys.

## Feature Set

### Current State (AI-Only)
- ✅ POST /journeys with `goal` and `audience` → AI generates stages
- ❌ No way to specify custom stages
- ❌ No way to retrieve journey details
- ❌ No way to update journey after creation

### New Features
1. **Manual Journey Creation** - Create journeys with custom stages and timing
2. **Journey Retrieval** - Fetch full journey details via API
3. **Journey Updates with Versioning** - Update journeys safely without disrupting active enrollments
4. **Comprehensive Documentation** - Updated API docs and examples

## Issues Breakdown

### Issue #1: Manual Journey Creation
**File:** `issue-manual-journey-creation.md`
**Complexity:** 🟢 Low-Medium
**Estimated Time:** 3-4 hours

**What It Does:**
- Extends POST /journeys to support a new "manual mode"
- Users provide `name` and `stages` array instead of `goal`/`audience`
- Endpoint auto-detects mode (if `stages` present → manual, else → AI)
- Maintains backward compatibility with existing AI mode

**Key Changes:**
- ✅ New mutation: `createManualJourney`
- ✅ Updated HTTP handler with mode detection
- ✅ Stage validation (ordering, unsubscribe_url, templates)

**Dependencies:** None (standalone)

---

### Issue #2: Journey Retrieval
**File:** `issue-journey-retrieval.md`
**Complexity:** 🟢 Low
**Estimated Time:** 2-3 hours

**What It Does:**
- New GET /journeys/:id endpoint
- Returns full journey details (name, stages, stats, metadata)
- Authorization check ensures account ownership

**Key Changes:**
- ✅ New query: `getJourneyById`
- ✅ New HTTP GET handler
- ✅ Route ordering consideration (analytics endpoint)

**Dependencies:** None (standalone)

---

### Issue #3: Journey Updates with Versioning
**File:** `issue-journey-updates-versioning.md`
**Complexity:** 🔴 High
**Estimated Time:** 8-10 hours (includes migration)

**What It Does:**
- PATCH /journeys/:id endpoint
- Journey versioning system
- Existing enrollments continue with original stages (via snapshot)
- Supports both full and partial stage updates

**Key Changes:**
- ✅ Schema updates (version, journey_version, stages_snapshot)
- ✅ New mutation: `updateJourney`
- ✅ Updated enrollment creation to snapshot stages
- ✅ Migration script for existing data
- ✅ New HTTP PATCH handler

**Dependencies:**
- Requires Issue #2 (uses getJourneyById for testing)
- Should be done after Issue #1 (tests manual journey updates)

---

### Issue #4: Documentation and Examples
**File:** `issue-documentation-examples.md`
**Complexity:** 🟡 Medium
**Estimated Time:** 4-5 hours

**What It Does:**
- Updates all user-facing documentation
- Adds code examples for new features
- Documents versioning system

**Files Updated:**
- ✅ docs/API.md - API reference
- ✅ docs/EXAMPLES.md - Code examples
- ✅ CLAUDE.md - Developer guide
- ✅ README.md - Quick start

**Dependencies:** All previous issues (documents features implemented in #1-3)

## Recommended Implementation Order

### Phase 1: Foundation (Issues #1 and #2)
**Duration:** 1-2 days

1. **Issue #1: Manual Journey Creation**
   - Implement `createManualJourney` mutation
   - Update POST /journeys handler
   - Test all validation cases
   - ✅ Backward compatible (AI mode still works)

2. **Issue #2: Journey Retrieval**
   - Implement `getJourneyById` query
   - Add GET /journeys/:id handler
   - Test authorization and edge cases
   - ✅ Enables UI to display journey details

**Why This Order:**
- Both are standalone features
- No schema changes required
- Quick wins with immediate user value
- Can be deployed independently

### Phase 2: Advanced Features (Issue #3)
**Duration:** 2-3 days

3. **Issue #3: Journey Updates with Versioning**
   - Update schema (version, snapshots)
   - Run migration on existing data
   - Implement `updateJourney` mutation
   - Update enrollment creation to snapshot
   - Add PATCH /journeys/:id handler
   - Extensive testing of versioning behavior
   - ✅ Most complex but highest value

**Why After Phase 1:**
- Needs GET endpoint for testing
- Benefits from manual journey testing framework
- Schema changes require more careful rollout

### Phase 3: Documentation (Issue #4)
**Duration:** 1 day

4. **Issue #4: Documentation and Examples**
   - Update all documentation files
   - Add code examples
   - Test all examples work
   - ✅ Makes features discoverable and usable

**Why Last:**
- Documents completed features
- Examples can be tested against live implementation
- Can include lessons learned from implementation

## Total Timeline

**Estimate:** 6-9 days of development

- **Junior Developer:** ~9 days (follow issues step-by-step)
- **Mid-level Developer:** ~7 days (some optimization)
- **Senior Developer:** ~6 days (parallel work where possible)

## Testing Strategy

Each issue includes comprehensive testing steps. Key test areas:

### Manual Journey Creation (Issue #1)
- ✅ Both AI and manual modes work
- ✅ Validation catches all error cases
- ✅ Backward compatibility confirmed

### Journey Retrieval (Issue #2)
- ✅ Authorization works correctly
- ✅ Analytics endpoint not broken
- ✅ Error cases handled

### Journey Updates (Issue #3)
- ✅ Versioning increments correctly
- ✅ Existing enrollments use snapshots
- ✅ Partial and full updates work
- ✅ Migration successful

### Documentation (Issue #4)
- ✅ All code examples run successfully
- ✅ API documentation accurate
- ✅ Cross-references correct

## Migration Considerations

**Issue #3 requires data migration:**

```typescript
// All existing journeys need version: 1
// All existing enrollments need journey_version and stages_snapshot

// Run: npx convex run migrations:migrateJourneysAndEnrollments
```

**Safety:**
- Run on staging/dev first
- Test with subset of data
- Verify enrollments continue working
- Monitor for 24h after production migration

## Success Metrics

After implementation, users can:
1. ✅ Create journeys without AI (manual mode)
2. ✅ Retrieve journey details via API
3. ✅ Update journey content safely
4. ✅ See version history
5. ✅ Know existing enrollments won't break

**API Coverage:**
- POST /journeys (both modes)
- GET /journeys/:id
- PATCH /journeys/:id

## Questions?

If implementing these issues, note:
- Each issue is self-contained with detailed steps
- Line numbers are approximate (may shift slightly)
- Test cases are production-ready
- All validation logic is specified
- Migration scripts included where needed

## File Locations

```
github-issues/
├── README.md (this file)
├── issue-manual-journey-creation.md
├── issue-journey-retrieval.md
├── issue-journey-updates-versioning.md
└── issue-documentation-examples.md
```

**Usage:** Copy each .md file content into a GitHub issue. Assign in the order recommended above.
