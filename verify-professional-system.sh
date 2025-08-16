#!/bin/bash

# PROFESSIONAL SYSTEM VERIFICATION SCRIPT
# Tests all 4 fixes to ensure they're working

echo "🔍 VERIFYING PROFESSIONAL JOBTRACKER SYSTEM..."

# Test 1: Live Console Logs
echo ""
echo "1️⃣ TESTING LIVE CONSOLE LOGS..."
curl -s "https://boostkit-jobtracker.duckdns.org/api/dashboard/activity" | jq '.[] | select(.service == "aggressive_tracker" or .service == "job_tracker") | {message, timestamp, service}' | head -5

# Test 2: Clean Hire Data Quality
echo ""
echo "2️⃣ TESTING HIRE DATA QUALITY..."
curl -s "https://boostkit-jobtracker.duckdns.org/api/hires?limit=5" | jq '.[] | {personName, company, position, confidenceScore, source}' | head -10

# Test 3: LinkedIn Integration Status
echo ""
echo "3️⃣ TESTING LINKEDIN INTEGRATION..."
curl -s "https://boostkit-jobtracker.duckdns.org/api/linkedin/status"

# Test 4: System Status
echo ""
echo "4️⃣ TESTING SYSTEM STATUS..."
curl -s "https://boostkit-jobtracker.duckdns.org/api/system/status"

# Test 5: Webhook Endpoint
echo ""
echo "5️⃣ TESTING WEBHOOK ENDPOINT..."
curl -s "https://boostkit-jobtracker.duckdns.org/webhook"

echo ""
echo "🎯 VERIFICATION COMPLETE!"
echo ""
echo "✅ EXPECTED RESULTS:"
echo "1. Live logs should show 'aggressive_tracker' and 'job_tracker' entries"
echo "2. Hires should have proper names (John Doe) not garbage (Kevin Scott, Evolution)"
echo "3. LinkedIn should show authentication status"
echo "4. System should be running with professional services"
echo "5. Webhook should respond with 'OK'"