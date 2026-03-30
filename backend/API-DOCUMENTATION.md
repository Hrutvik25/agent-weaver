# AEP Agent Orchestrator - API Documentation

## Overview
Complete REST API for coordinating Audience, Content, Journey, and Analytics agents within Adobe Experience Platform. Deployable with Adobe ID credentials.

---

## Base URL
```
http://localhost:5000/api
```

---

## Authentication
Include Adobe API credentials in the request headers:
```
Authorization: Bearer {ADOBE_ACCESS_TOKEN}
x-api-key: {ADOBE_API_KEY}
x-gw-ims-org-id: {ADOBE_ORG_ID}
```

---

## Health Check

### GET /health
Check server and service status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-29T10:00:00Z",
  "services": {
    "mongodb": "connected",
    "redis": "connected",
    "kafka": "connected"
  }
}
```

---

## AUDIENCE AGENT

### POST /audiences
Create a new audience from raw data.

**Request Body:**
```json
{
  "segment": "school-aged",
  "age": 9,
  "interests": ["math", "science"],
  "deviceType": "tablet",
  "deviceOS": "iOS",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "audienceId": "aud_1711768800000",
    "name": "Audience-8-10yrs",
    "segment": "school-aged",
    "userCategory": "8-10yrs",
    "size": 0,
    "attributes": {...},
    "createdFrom": "raw_data",
    "status": "draft",
    "createdAt": "2026-03-29T10:00:00Z"
  }
}
```

### GET /audiences
List all audiences with optional filters.

**Query Parameters:**
- `status`: draft, active, archived
- `userCategory`: 0-2yrs, 8-10yrs, 11-17yrs, 18+
- `segment`: segment name

**Example:**
```
GET /audiences?status=active&userCategory=8-10yrs
```

### GET /audiences/{audienceId}
Retrieve a specific audience by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "audienceId": "aud_1711768800000",
    "name": "School Age (8-10 years)",
    "segment": "school-aged",
    ...
  }
}
```

### POST /audiences/ingest-kafka
Start ingesting audience data from Kafka topics.

**Request Body:**
```json
{
  "topic": "audience-raw-data"
}
```

---

## CONTENT AGENT

### POST /content
Create new content asset with metadata.

**Request Body:**
```json
{
  "title": "Math Fundamentals Training",
  "type": "training_video",
  "ageSegment": "8-10yrs",
  "assetUrl": "https://cdn.example.com/math-training.mp4",
  "description": "Comprehensive training on basic mathematics",
  "metadata": {
    "duration": 1200,
    "fileSize": 314572800,
    "format": "video/mp4",
    "author": "Education Team"
  },
  "tags": ["math", "training", "fundamentals", "school-age"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contentId": "content_1711768800000",
    "title": "Math Fundamentals Training",
    "type": "training_video",
    "ageSegment": "8-10yrs",
    "status": "draft",
    "tags": ["math", "training", "fundamentals", "school-age"],
    "createdAt": "2026-03-29T10:00:00Z"
  }
}
```

### POST /content/{contentId}/publish
Publish content and make it available to audiences.

**Response:**
```json
{
  "success": true,
  "data": {
    "contentId": "content_1711768800000",
    "status": "published",
    "adobeAssetId": "asset_abc123",
    "publishedAt": "2026-03-29T10:05:00Z"
  }
}
```

### GET /content/{contentId}
Retrieve specific content details.

### GET /content/segment/{ageSegment}
List all published content for a specific age segment.

**Example:**
```
GET /content/segment/8-10yrs
```

### POST /content/{contentId}/tag
Add or update tags for content.

**Request Body:**
```json
{
  "tags": ["featured", "popular", "trending"]
}
```

---

## JOURNEY AGENT

### POST /journeys
Create a new journey orchestrating multiple steps.

**Request Body:**
```json
{
  "name": "Complete Learning Path - School Age",
  "audienceId": "aud_1711768800000",
  "steps": [
    {
      "type": "content_delivery",
      "contentId": "content_1711768800000",
      "condition": {"minAge": 8, "maxAge": 10},
      "waitTime": 0
    },
    {
      "type": "survey",
      "condition": {"previousStepCompleted": true},
      "waitTime": 86400
    },
    {
      "type": "personalized_training",
      "condition": {"feedbackProvided": true},
      "waitTime": 0
    }
  ],
  "surveyEnabled": true,
  "surveyReach": 25000,
  "personalizedTrainingEnabled": true,
  "registrationRequired": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "journeyId": "journey_1711768800000",
    "name": "Complete Learning Path - School Age",
    "audienceId": "aud_1711768800000",
    "status": "draft",
    "steps": [...],
    "createdAt": "2026-03-29T10:00:00Z"
  }
}
```

### POST /journeys/{journeyId}/activate
Activate a journey to start processing audience members.

**Response:**
```json
{
  "success": true,
  "data": {
    "journeyId": "journey_1711768800000",
    "status": "active",
    "adobeJourneyId": "adobe_journey_xyz789",
    "activatedAt": "2026-03-29T10:05:00Z"
  }
}
```

### GET /journeys/{journeyId}
Retrieve journey details and current status.

### POST /journeys/{journeyId}/steps
Add a new step to an existing journey.

**Request Body:**
```json
{
  "type": "email",
  "condition": {"eventTriggered": "survey_completed"},
  "waitTime": 3600
}
```

### POST /journeys/{journeyId}/personalize
Get AI-powered personalization recommendations for a user.

**Request Body:**
```json
{
  "userId": "user_12345",
  "userCategory": "8-10yrs"
}
```

**Response:**
```json
{
  "success": true,
  "data": "Based on user's engagement patterns and feedback, recommend the advanced math track combined with interactive coding challenges. Suggest gamification elements to increase engagement."
}
```

---

## ANALYTICS AGENT

### POST /analytics/events
Track user events (views, clicks, engagements).

**Request Body:**
```json
{
  "journeyId": "journey_1711768800000",
  "audienceId": "aud_1711768800000",
  "contentId": "content_1711768800000",
  "eventType": "view",
  "userId": "user_12345",
  "userCategory": "8-10yrs",
  "data": {
    "viewDuration": 1200,
    "completionPercentage": 100,
    "deviceType": "tablet"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analyticsId": "analytics_1711768800000",
    "eventType": "view",
    "timestamp": "2026-03-29T10:00:00Z",
    "userId": "user_12345"
  }
}
```

### POST /analytics/feedback
Submit user feedback with rating and comments.

**Request Body:**
```json
{
  "contentId": "content_1711768800000",
  "userId": "user_12345",
  "rating": 5,
  "comment": "Excellent content, very engaging and easy to understand!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analyticsId": "feedback_1711768800000",
    "eventType": "feedback",
    "rating": 5,
    "feedbackSent": true,
    "recommendation": "Recommend advanced track based on positive feedback",
    "timestamp": "2026-03-29T10:00:00Z"
  }
}
```

### GET /analytics/metrics/{journeyId}
Retrieve comprehensive metrics for a journey.

**Query Parameters:**
- `startDate`: ISO date (2026-03-01)
- `endDate`: ISO date (2026-03-31)

**Example:**
```
GET /analytics/metrics/journey_1711768800000?startDate=2026-03-01&endDate=2026-03-31
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEvents": 15000,
    "eventsByType": {
      "view": 8000,
      "click": 4500,
      "feedback": 2000,
      "complete": 500
    },
    "userEngagement": {
      "uniqueUsers": 2500,
      "averageRating": 4.2,
      "feedbackCount": 1200
    }
  }
}
```

### POST /analytics/experiments
Create an A/B experiment to test content variations.

**Request Body:**
```json
{
  "name": "Video vs. Text Content - School Age",
  "audience": "aud_1711768800000",
  "variantA": {
    "contentId": "content_1711768800000",
    "trafficAllocation": 50
  },
  "variantB": {
    "contentId": "content_2711768800000",
    "trafficAllocation": 50
  },
  "startDate": "2026-03-29T00:00:00Z",
  "endDate": "2026-04-29T00:00:00Z"
}
```

---

## ORCHESTRATOR FLOW

### POST /orchestrate
Execute a complete orchestration workflow combining all agents.

**Request Body:**
```json
{
  "action": "create_complete_journey",
  "data": {
    "audienceData": {
      "segment": "school-aged",
      "age": 9,
      "interests": ["math", "science"]
    },
    "contentData": {
      "title": "Interactive Math Course",
      "type": "training_video",
      "ageSegment": "8-10yrs",
      "assetUrl": "https://cdn.example.com/math.mp4",
      "tags": ["math", "interactive"]
    },
    "journeyData": {
      "name": "Math Mastery Journey",
      "steps": [
        {
          "type": "content_delivery",
          "condition": {"minAge": 8, "maxAge": 10}
        },
        {
          "type": "survey",
          "condition": {"previousStepCompleted": true}
        }
      ]
    },
    "analyticsData": {
      "eventType": "journey_created"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "action": "create_complete_journey",
    "timestamp": "2026-03-29T10:00:00Z",
    "steps": [
      {
        "name": "audience_created",
        "audienceId": "aud_1711768800000"
      },
      {
        "name": "content_created",
        "contentId": "content_1711768800000"
      },
      {
        "name": "journey_created",
        "journeyId": "journey_1711768800000"
      },
      {
        "name": "analytics_tracked",
        "analyticsId": "analytics_1711768800000"
      }
    ]
  }
}
```

---

## Error Handling

All errors return appropriate HTTP status codes with error details:

**400 Bad Request**
```json
{
  "error": "Bad Request",
  "message": "Missing required field: audienceId"
}
```

**404 Not Found**
```json
{
  "error": "Audience not found",
  "message": "No audience exists with ID: aud_invalid"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal Server Error",
  "message": "Database connection failed"
}
```

---

## Rate Limiting

- Default: 100 requests per 15 minutes per IP
- Premium (with API key): 1000 requests per 15 minutes
- Burst limit: 50 requests per second

Headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1711770600
```

---

## Example Workflows

### Complete Campaign Setup

```bash
# 1. Create audience
curl -X POST http://localhost:5000/api/audiences \
  -H "Content-Type: application/json" \
  -d '{"segment": "school-aged", "age": 9}'

# 2. Create content
curl -X POST http://localhost:5000/api/content \
  -H "Content-Type: application/json" \
  -d '{"title": "Math Course", "type": "training_video", ...}'

# 3. Create journey
curl -X POST http://localhost:5000/api/journeys \
  -H "Content-Type: application/json" \
  -d '{"name": "Math Journey", "audienceId": "aud_...", ...}'

# 4. Activate journey
curl -X POST http://localhost:5000/api/journeys/journey_1711768800000/activate

# 5. Track events
curl -X POST http://localhost:5000/api/analytics/events \
  -H "Content-Type: application/json" \
  -d '{"eventType": "view", "userId": "user_12345", ...}'

# 6. Submit feedback
curl -X POST http://localhost:5000/api/analytics/feedback \
  -H "Content-Type: application/json" \
  -d '{"rating": 5, "comment": "Great!", ...}'

# 7. Get metrics
curl http://localhost:5000/api/analytics/metrics/journey_1711768800000
```

---

## SDK Usage (Node.js)

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  }
});

// Create audience
const audience = await client.post('/audiences', {
  segment: 'school-aged',
  age: 9
});

// Get journey metrics
const metrics = await client.get(`/analytics/metrics/${journeyId}`);

// Submit feedback
await client.post('/analytics/feedback', {
  contentId: 'content_123',
  userId: 'user_456',
  rating: 5,
  comment: 'Excellent!'
});
```

---

## Deployment with Adobe ID

### Prerequisites
1. Adobe Developer Account
2. Created a new Project in Adobe Developer Console
3. Added APIs: Experience Platform, Real-time Customer Data Platform
4. Generated Service Account credentials

### Deployment Steps

```bash
# 1. Set Adobe credentials
export ADOBE_API_KEY="your-api-key"
export ADOBE_ORG_ID="your-org-id@AdobeOrg"
export ADOBE_TECH_ACCOUNT="your-tech-account@techacct.adobe.com"
export ADOBE_PRIVATE_KEY="path-to-private-key"

# 2. Build Docker image
docker build -t aep-orchestrator:latest .

# 3. Deploy to your environment
docker run -d \
  -p 5000:5000 \
  -e ADOBE_API_KEY=$ADOBE_API_KEY \
  -e ADOBE_ORG_ID=$ADOBE_ORG_ID \
  -e ADOBE_TECH_ACCOUNT=$ADOBE_TECH_ACCOUNT \
  -e ADOBE_PRIVATE_KEY=$ADOBE_PRIVATE_KEY \
  aep-orchestrator:latest
```

---

## Support & Monitoring

- Health endpoint: `GET /health`
- Kafka UI: `http://localhost:8080` (development)
- MongoDB Express: `http://localhost:8081` (development)
- Logs: Check Docker container logs for detailed information

---

**Last Updated**: March 29, 2026  
**Version**: 1.0.0  
**Status**: Production Ready
