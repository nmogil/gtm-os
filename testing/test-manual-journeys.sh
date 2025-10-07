#!/bin/bash

# Test script for Manual Journey Creation (Issue #25)
# This script tests all aspects of the manual journey feature

API_URL="https://focused-bloodhound-276.convex.site/journeys"
API_KEY="test-api-key-123"

echo "========================================"
echo "Manual Journey Creation Tests (Issue #25)"
echo "========================================"
echo ""

# Test 1: Manual Journey Creation (Happy Path)
echo "Test 1: Manual Journey Creation (Happy Path)"
echo "--------------------------------------"
curl -X POST $API_URL \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @testing/test-manual-journey.json \
  -s | python3 -m json.tool
echo ""
echo "✓ Expected: 200 OK with journey_id, mode='manual', and stages"
echo ""

# Test 2: Missing Name
echo "Test 2: Validation - Missing Name"
echo "--------------------------------------"
curl -X POST $API_URL \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @testing/test-missing-name.json \
  -s | python3 -m json.tool
echo ""
echo "✓ Expected: 400 error with 'Missing required field: name'"
echo ""

# Test 3: Empty Stages
echo "Test 3: Validation - Empty Stages"
echo "--------------------------------------"
curl -X POST $API_URL \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @testing/test-empty-stages.json \
  -s | python3 -m json.tool
echo ""
echo "✓ Expected: 400 error with 'Missing required field: stages'"
echo ""

# Test 4: Bad Day Ordering
echo "Test 4: Validation - Bad Day Ordering"
echo "--------------------------------------"
curl -X POST $API_URL \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @testing/test-bad-ordering.json \
  -s | python3 -m json.tool
echo ""
echo "✓ Expected: 400 error with 'days must be in ascending order'"
echo ""

# Test 5: Negative Day
echo "Test 5: Validation - Negative Day"
echo "--------------------------------------"
curl -X POST $API_URL \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @testing/test-negative-day.json \
  -s | python3 -m json.tool
echo ""
echo "✓ Expected: 400 error with 'day must be >= 0'"
echo ""

# Test 6: Missing Unsubscribe URL
echo "Test 6: Validation - Missing Unsubscribe URL"
echo "--------------------------------------"
curl -X POST $API_URL \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @testing/test-missing-unsub.json \
  -s | python3 -m json.tool
echo ""
echo "✓ Expected: 400 error with 'invalid templates'"
echo ""

# Test 7: AI Mode Backward Compatibility
echo "Test 7: AI Mode - Error Handling"
echo "--------------------------------------"
curl -X POST $API_URL \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @testing/test-missing-goal-audience.json \
  -s | python3 -m json.tool
echo ""
echo "✓ Expected: 400 error with 'Missing required fields: goal and audience'"
echo ""

echo "========================================"
echo "All Tests Complete"
echo "========================================"
