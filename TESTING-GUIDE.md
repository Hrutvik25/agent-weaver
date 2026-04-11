# Testing Guide - Sample Inputs & Expected Outputs

This guide shows you exactly what inputs to give the system and what to expect in return.

---

## 🎯 Method 1: Using the Web Dashboard (Easiest)

### Step 1: Open the Dashboard
```
http://localhost
```

### Step 2: Click "Run Orchestration" Button

**What happens:**
1. Frontend sends a pre-configured analytics event
2. Backend publishes to Kafka `analytics-events` topic
3. All 4 agents process the event in sequence
4. Real-time logs appear in the terminal
5. Data populates in panels

**Expected Output in Terminal:**
```
[ORCHESTRATOR] Pipeline initiated. Sending analytics event...
[SYSTEM] Triggering event pipeline via /api/orchestrate...
[ANALYTICS] Event published to Kafka analytics-events topic.
[ANALYTICS] 📤 Segment decision: user_1234567890 → highly_engaged_users (score: 90)
[ANALYTICS] 🔗 MCP enrichment: 3 leads for segment highly_engaged_users
[AUDIENCE] 📥 Segment received: user_1234567890 → highly_engaged_users
[AUDIENCE] ✓ Upserted: user_1234567890 → highly_engaged_users (score: 90)
[AUDIENCE] 🔗 MCP CRM enrichment: 3 leads for user_1234567890
[AUDIENCE] 📤 Sent to content-recommendations: user_1234567890
[CONTENT] 📥 Content recommendation: user_1234567890 → highly_engaged_users
[CONTENT] 🔗 MCP support context: 2 cases for segment highly_engaged_users
[CONTENT] 📤 Journey trigger sent: user_1234567890 — 0 content items
[JOURNEY] 📥 Journey trigger: user_1234567890 → highly_engaged_users
[JOURNEY] 🔗 MCP pipeline: 2 opportunities for segment highly_engaged_users
[JOURNEY] 🔗 MCP pipeline: 2 change requests for segment highly_engaged_users
[JOURNEY] ✓ Journey created: journey_1234567890
[JOURNEY] 🤖 AI: {"strategy": "personalized_content_recommendations", ...}
[ORCHESTRATOR] ✓ Full pipeline complete. All agents reporting nominal.
```

**Expected UI Changes:**
- Progress bar shows all 6 steps complete ✅
- Audience Segments panel shows "Highly Engaged Users: 1"
- Journey cards appear with "Journey: journey_1234567890"
- MCP Metrics panel shows increased call count
- Analytics charts update

---

## 🎯 Method 2: Using API Calls (For Testing)

### Test 1: Highly Engaged User (High Score)

**Input:**
```bash
curl -X POST http://localhost/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "analyticsEvent": {
      "userId": "user_alice_001",
      "event": "video_watched",
      "watchTime": 150,
      "clicked": true,
      "contentType": "training_video"
    }
  }'
```

**What This Does:**
- `watchTime: 150` (>100) + `clicked: true` = **Highly Engaged User**
- Score: 90
- Segment: `highly_engaged_users`

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2026-04-03T18:30:00.000Z",
    "steps": [
      {
        "name": "event_published",
        "userId": "user_alice_001",
        "topic": "analytics-events"
      }
    ]
  }
}
```

**What Happens Behind the Scenes:**
1. AnalyticsAgent receives event
2. Analyzes: `watchTime > 100 && clicked = true` → segment = `highly_engaged_users`, score = 90
3. Calls MCP: `salesforce.getLeads` (gets 3 mock leads)
4. Publishes to `audience-segments` topic
5. AudienceAgent upserts to MongoDB
6. Calls MCP: `salesforce.getLeads` again for CRM enrichment
7. ContentAgent fetches content, calls MCP: `salesforce.getCases`
8. JourneyAgent creates journey, calls MCP: `salesforce.getOpportunities` + `servicenow.getChangeRequests`

**Verify Results:**
```bash
# Check audience was created
curl http://localhost/api/audiences | jq '.data[] | select(.userId=="user_alice_001")'

# Expected output:
{
  "userId": "user_alice_001",
  "segment": "highly_engaged_users",
  "score": 90,
  "status": "active"
}
```

---

### Test 2: Potential Converter (Medium Score)

**Input:**
```bash
curl -X POST http://localhost/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "analyticsEvent": {
      "userId": "user_bob_002",
      "event": "page_view",
      "watchTime": 75,
      "clicked": false,
      "contentType": "product_page"
    }
  }'
```

**What This Does:**
- `watchTime: 75` (>50 but <100) + `clicked: false` = **Potential Converter**
- Score: 60
- Segment: `potential_converters`

**Expected Segment:**
```json
{
  "userId": "user_bob_002",
  "segment": "potential_converters",
  "score": 60
}
```

---

### Test 3: Drop-off User (Low Score)

**Input:**
```bash
curl -X POST http://localhost/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "analyticsEvent": {
      "userId": "user_charlie_003",
      "event": "page_view",
      "watchTime": 10,
      "clicked": false,
      "contentType": "landing_page"
    }
  }'
```

**What This Does:**
- `watchTime: 10` (<50) + `clicked: false` = **Drop-off User**
- Score: 30
- Segment: `drop_off_users`

**Expected Segment:**
```json
{
  "userId": "user_charlie_003",
  "segment": "drop_off_users",
  "score": 30
}
```

---

### Test 4: Batch Processing (Multiple Users)

**Input:**
```bash
curl -X POST http://localhost/api/orchestrate/batch \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "userId": "user_david_004",
        "event": "video_watched",
        "watchTime": 200,
        "clicked": true,
        "contentType": "course"
      },
      {
        "userId": "user_eve_005",
        "event": "clicked",
        "watchTime": 80,
        "clicked": true,
        "contentType": "teaser"
      },
      {
        "userId": "user_frank_006",
        "event": "page_view",
        "watchTime": 5,
        "clicked": false,
        "contentType": "blog"
      }
    ]
  }'
```

**What This Does:**
- Processes 3 users simultaneously
- Each goes through the full pipeline
- All 4 agents process each event

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "total": 3,
    "results": [
      {
        "userId": "user_david_004",
        "status": "published",
        "topic": "analytics-events"
      },
      {
        "userId": "user_eve_005",
        "status": "published",
        "topic": "analytics-events"
      },
      {
        "userId": "user_frank_006",
        "status": "published",
        "topic": "analytics-events"
      }
    ]
  }
}
```

**Verify All Were Processed:**
```bash
curl http://localhost/api/audiences | jq '.data | length'
# Should show 3 (or more if you ran previous tests)
```

---

## 🎯 Method 3: Direct Agent Testing

### Test Analytics Agent Only

**Input:**
```bash
curl -X POST http://localhost/api/analytics/events \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_test_007",
    "event": "course_completed",
    "watchTime": 300,
    "clicked": true,
    "contentType": "certification",
    "rating": 5
  }'
```

**What This Does:**
- Directly tracks an analytics event
- Stores in MongoDB `analyticsevents` collection
- Also publishes to Kafka for agent processing

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "analyticsId": "ae_1234567890",
    "userId": "user_test_007",
    "event": "course_completed",
    "watchTime": 300,
    "clicked": true,
    "contentType": "certification",
    "rating": 5
  }
}
```

---

### Test Content Creation

**Input:**
```bash
curl -X POST http://localhost/api/content \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Advanced Marketing Automation",
    "type": "training_video",
    "segment": "highly_engaged_users",
    "assetUrl": "https://example.com/video.mp4",
    "metadata": {
      "duration": 1800,
      "fileSize": 524288000,
      "format": "mp4",
      "author": "Marketing Team"
    },
    "tags": ["automation", "advanced", "marketing"],
    "description": "Learn advanced marketing automation techniques"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "contentId": "content_1234567890",
    "title": "Advanced Marketing Automation",
    "type": "training_video",
    "segment": "highly_engaged_users",
    "status": "draft"
  }
}
```

**Publish the Content:**
```bash
curl -X POST http://localhost/api/content/content_1234567890/publish
```

---

### Test Journey Creation

**Input:**
```bash
curl -X POST http://localhost/api/journeys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Onboarding Journey - New Users",
    "audienceSegment": "potential_converters",
    "steps": [
      {
        "stepId": "step_001",
        "sequence": 1,
        "type": "email",
        "contentId": "content_welcome_email"
      },
      {
        "stepId": "step_002",
        "sequence": 2,
        "type": "content_delivery",
        "contentId": "content_tutorial_video"
      }
    ],
    "surveyEnabled": true,
    "personalizedTrainingEnabled": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "journeyId": "journey_1234567890",
    "name": "Onboarding Journey - New Users",
    "audienceSegment": "potential_converters",
    "status": "draft",
    "steps": [...]
  }
}
```

---

## 🎯 Method 4: MCP Gateway Testing

### Test MCP Metrics

**Input:**
```bash
curl http://localhost/api/mcp/metrics?window=24h
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "perAgent": [
      {
        "agentId": "analytics",
        "calls": 5,
        "errors": 0,
        "cost": 0.00082,
        "avgLatency": 652.5
      },
      {
        "agentId": "audience",
        "calls": 8,
        "errors": 0,
        "cost": 0.001312,
        "avgLatency": 218.66
      }
    ],
    "perTool": [
      {
        "tool": "salesforce.getLeads",
        "calls": 13,
        "errors": 0
      },
      {
        "tool": "salesforce.getCases",
        "calls": 5,
        "errors": 0
      }
    ],
    "totals": {
      "calls": 25,
      "cost": 0.00368,
      "avgLatency": 329.18
    }
  },
  "window": "24h"
}
```

---

### Test MCP Audit Logs

**Input:**
```bash
curl "http://localhost/api/mcp/audit?limit=5&agentId=analytics"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "auditId": "audit_1234567890_abc123",
      "agentId": "analytics",
      "tool": "salesforce.getLeads",
      "server": "salesforce",
      "params": {
        "filter": {
          "segment": "highly_engaged_users",
          "status": "open"
        },
        "limit": 5
      },
      "outcome": "allowed",
      "httpStatus": 200,
      "latencyMs": 689,
      "tokensUsed": 82,
      "estimatedCostUsd": 0.000164,
      "timestamp": "2026-04-03T18:30:00.000Z"
    }
  ]
}
```

---

## 🎯 Method 5: Query Data

### Get All Audiences

**Input:**
```bash
curl http://localhost/api/audiences
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "audienceId": "aud_user_alice_001",
      "userId": "user_alice_001",
      "segment": "highly_engaged_users",
      "score": 90,
      "lastActivity": "2026-04-03T18:30:00.000Z",
      "status": "active"
    },
    {
      "userId": "user_bob_002",
      "segment": "potential_converters",
      "score": 60,
      "status": "active"
    }
  ]
}
```

---

### Get Segment Summary

**Input:**
```bash
curl http://localhost/api/audiences/summary
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "highly_engaged_users",
      "count": 5,
      "avgScore": 90
    },
    {
      "_id": "potential_converters",
      "count": 3,
      "avgScore": 60
    },
    {
      "_id": "drop_off_users",
      "count": 2,
      "avgScore": 30
    }
  ]
}
```

---

### Get All Journeys

**Input:**
```bash
curl http://localhost/api/journeys
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "journeyId": "journey_1234567890",
      "name": "Auto-Journey: highly_engaged_users - user_alice_001",
      "audienceSegment": "highly_engaged_users",
      "status": "draft",
      "steps": [],
      "createdAt": "2026-04-03T18:30:00.000Z"
    }
  ]
}
```

---

### Get Dashboard Stats

**Input:**
```bash
curl http://localhost/api/stats
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 10,
    "totalJourneys": 8,
    "totalEvents": 25,
    "segments": [
      {
        "_id": "highly_engaged_users",
        "count": 5,
        "avgScore": 90
      }
    ]
  }
}
```

---

## 📊 Understanding the Segmentation Logic

The system uses this logic to determine segments:

```javascript
function analyzeBehavior(event) {
  const watchTime = event.watchTime || 0;
  const clicked   = event.clicked   || false;

  if (watchTime > 100 && clicked) {
    return { segment: 'highly_engaged_users', score: 90 };
  } else if (watchTime > 50 || clicked) {
    return { segment: 'potential_converters', score: 60 };
  } else {
    return { segment: 'drop_off_users', score: 30 };
  }
}
```

### Decision Tree:

```
Event Input
    │
    ├─ watchTime > 100 AND clicked = true
    │   └─> highly_engaged_users (score: 90)
    │
    ├─ watchTime > 50 OR clicked = true
    │   └─> potential_converters (score: 60)
    │
    └─ else
        └─> drop_off_users (score: 30)
```

---

## 🧪 Complete Test Scenario

Here's a complete test scenario you can run:

```bash
# 1. Start fresh
docker-compose down -v
docker-compose up -d

# 2. Wait for services (60 seconds)
sleep 60

# 3. Create 3 different user types
curl -X POST http://localhost/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"analyticsEvent": {"userId": "alice", "event": "video_watched", "watchTime": 150, "clicked": true, "contentType": "course"}}'

curl -X POST http://localhost/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"analyticsEvent": {"userId": "bob", "event": "page_view", "watchTime": 75, "clicked": false, "contentType": "blog"}}'

curl -X POST http://localhost/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"analyticsEvent": {"userId": "charlie", "event": "page_view", "watchTime": 10, "clicked": false, "contentType": "landing"}}'

# 4. Wait for processing (5 seconds)
sleep 5

# 5. Check results
echo "=== Audiences ==="
curl -s http://localhost/api/audiences | jq '.data[] | {userId, segment, score}'

echo "=== Segment Summary ==="
curl -s http://localhost/api/audiences/summary | jq '.data'

echo "=== Journeys ==="
curl -s http://localhost/api/journeys | jq '.data | length'

echo "=== MCP Metrics ==="
curl -s http://localhost/api/mcp/metrics | jq '.data.totals'

echo "=== Stats ==="
curl -s http://localhost/api/stats | jq '.data'
```

**Expected Output:**
```json
=== Audiences ===
{
  "userId": "alice",
  "segment": "highly_engaged_users",
  "score": 90
}
{
  "userId": "bob",
  "segment": "potential_converters",
  "score": 60
}
{
  "userId": "charlie",
  "segment": "drop_off_users",
  "score": 30
}

=== Segment Summary ===
[
  {"_id": "highly_engaged_users", "count": 1, "avgScore": 90},
  {"_id": "potential_converters", "count": 1, "avgScore": 60},
  {"_id": "drop_off_users", "count": 1, "avgScore": 30}
]

=== Journeys ===
3

=== MCP Metrics ===
{
  "calls": 12,
  "cost": 0.001968,
  "avgLatency": 329.18
}

=== Stats ===
{
  "totalUsers": 3,
  "totalJourneys": 3,
  "totalEvents": 3
}
```

---

## 🎉 Success Indicators

You know the system is working when:

✅ **API calls return 200 status**  
✅ **Audiences appear in MongoDB**  
✅ **Journeys are created automatically**  
✅ **MCP metrics show successful calls**  
✅ **Audit logs record all MCP invocations**  
✅ **Real-time logs stream to frontend**  
✅ **No errors in docker logs**  

---

## 🐛 If Something Goes Wrong

```bash
# Check all containers are running
docker-compose ps

# View backend logs
docker logs aep-orchestrator -f

# View gateway logs
docker logs aep-mcp-gateway -f

# Check MongoDB data
docker exec -it aep-mongodb mongosh -u admin -p admin123
> use aep-orchestrator
> db.audiences.find().pretty()
> db.journeys.find().pretty()
> db.mcpauditlogs.find().limit(5).pretty()

# Check Redis metrics
docker exec -it aep-redis redis-cli
> KEYS mcp:metrics:*
> HGETALL mcp:metrics:analytics:salesforce.getLeads:12345
```

---

**Now you have everything you need to test the system thoroughly!** 🚀
