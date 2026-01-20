#!/bin/bash
# Security Testing Script for BouldersSPAflow
# Usage: ./test-security.sh <base-url>
# Example: ./test-security.sh http://localhost:5173
# Example: ./test-security.sh https://preview.pages.dev

BASE_URL="${1:-http://localhost:5173}"

echo "🔒 Testing Security Configuration for: $BASE_URL"
echo "=================================================="
echo ""

# Test 1: Valid API path
echo "✅ Test 1: Valid API path (should return 200 or data)"
curl -s -o /dev/null -w "Status: %{http_code}\n" \
  "$BASE_URL/api-proxy?path=/api/reference/business-units"
echo ""

# Test 2: Invalid API path (should return 403)
echo "🚫 Test 2: Invalid API path (should return 403)"
curl -s -o /dev/null -w "Status: %{http_code}\n" \
  "$BASE_URL/api-proxy?path=/etc/passwd"
echo ""

# Test 3: Missing path parameter (should return 400)
echo "🚫 Test 3: Missing path parameter (should return 400)"
curl -s -o /dev/null -w "Status: %{http_code}\n" \
  "$BASE_URL/api-proxy"
echo ""

# Test 4: CORS preflight with valid origin
echo "✅ Test 4: CORS preflight with localhost origin"
curl -s -I -X OPTIONS "$BASE_URL/api-proxy?path=/api/reference/business-units" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" | grep -i "access-control"
echo ""

# Test 5: Security headers on main page
echo "🔒 Test 5: Security headers on main page"
curl -s -I "$BASE_URL" | grep -E "(X-Content-Type|X-Frame|Content-Security|Strict-Transport|Referrer-Policy)"
echo ""

# Test 6: API proxy security headers
echo "🔒 Test 6: API proxy security headers"
curl -s -I "$BASE_URL/api-proxy?path=/api/reference/business-units" | grep -E "(X-Content-Type|X-Frame|Referrer-Policy|Access-Control)"
echo ""

echo "=================================================="
echo "✅ Testing complete!"
echo ""
echo "Next steps:"
echo "1. Check browser DevTools Console for CSP violations"
echo "2. Test actual signup flow in browser"
echo "3. Run: securityheaders.com scan on production URL"
echo "4. Verify GTM/analytics still work with CSP"
