# GTM OS Test Suite

Comprehensive test suite for GTM OS covering unit, integration, and chaos testing scenarios.

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with UI (interactive browser interface)
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Test Organization

### Unit Tests (`tests/unit/`)

Test individual modules and functions in isolation:

- **templates.test.ts** (37 tests) - Handlebars template rendering, validation, HTML escaping
- **idempotency.test.ts** (6 tests) - Enrollment idempotency cache functionality
- **errors.test.ts** (7 tests) - Error handling and API error responses

**Run unit tests only:**
```bash
npx vitest run tests/unit/
```

### Integration Tests (`tests/integration/`)

Test full API endpoints against deployed Convex instance:

- **journeys.test.ts** - POST /journeys endpoint (journey creation with AI)
- **enrollments.test.ts** - POST /enrollments endpoint (contact enrollment)
- **events.test.ts** - POST /events endpoint (conversion/unsubscribe tracking)
- **health.test.ts** - GET /health endpoint (metrics and monitoring)
- **test-mode.test.ts** - Test mode functionality verification

**Run integration tests only:**
```bash
npx vitest run tests/integration/
```

### Chaos Tests (`tests/chaos/`)

Test system resilience and failure scenarios:

- **llm-failures.test.ts** - AI generation fallback behavior
- **scheduler-resilience.test.ts** - Concurrent operations and edge cases
- **webhook-retries.test.ts** - Webhook error handling

**Run chaos tests only:**
```bash
npx vitest run tests/chaos/
```

## Test Helpers

Located in `tests/helpers/`:

- **api.ts** - HTTP request utilities with authentication
- **fixtures.ts** - Mock data and test payloads

## Environment Configuration

Integration and chaos tests require a running Convex deployment:

```bash
# Set custom Convex site URL (default: production site)
export CONVEX_SITE_URL="https://your-deployment.convex.site"

# Set custom API key (default: test-api-key-123)
export TEST_API_KEY="your-test-api-key"
```

## Coverage

Generate test coverage report:

```bash
npm run test:coverage
```

Coverage reports are generated in `coverage/` directory:
- HTML report: `coverage/index.html`
- JSON report: `coverage/coverage-final.json`

## Continuous Integration

Run tests in CI/CD:

```bash
# Single run (exits with code 1 on failure)
npm test

# With coverage
npm run test:coverage
```

## Test Writing Guidelines

### Unit Tests
- Test pure functions without external dependencies
- Mock external APIs and services
- Use `beforeEach` to reset state (e.g., clear idempotency cache)

### Integration Tests
- Test against real Convex deployment
- Use generated test emails/IDs to avoid conflicts
- Clean up test data when necessary

### Chaos Tests
- Test error scenarios and edge cases
- Verify graceful degradation
- Test concurrent operations

## Troubleshooting

**Tests timeout:**
- Integration tests may take longer due to network requests
- Adjust timeout in `vitest.config.ts` if needed

**TypeScript errors:**
- Ensure `node_modules` is up to date: `npm install`
- Check `tsconfig.json` configuration

**API authentication errors:**
- Verify `TEST_API_KEY` environment variable
- Ensure Convex deployment is accessible

## Test Statistics

- **Total Tests**: 37+ (unit tests verified)
- **Test Files**: 10+
- **Code Coverage Target**: >80%
- **Max Test Duration**: 30 seconds per test

## Related Documentation

- Main README: `/README.md`
- Convex functions: `/convex/`
- Testing scripts: `/testing/` (legacy manual tests)
