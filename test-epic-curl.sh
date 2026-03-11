#!/bin/bash
# Test Epic SMART config endpoint (no auth needed)
set -e
source .env.local 2>/dev/null || true

BASE_URL="${EPIC_FHIR_BASE_URL:-https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4}"
SMART_URL="${BASE_URL}/.well-known/smart-configuration"

echo "=== Testing SMART config ==="
echo "URL: $SMART_URL"
curl -s -o /tmp/smart.json -w "HTTP status: %{http_code}\n" \
  -H "Accept: application/json" \
  "$SMART_URL"

echo ""
echo "=== SMART config token_endpoint ==="
cat /tmp/smart.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token_endpoint','NOT FOUND'))" 2>/dev/null || \
  grep -o '"token_endpoint":"[^"]*"' /tmp/smart.json
