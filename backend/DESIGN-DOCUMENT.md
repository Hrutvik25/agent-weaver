# AEP Agent Orchestrator — Design Document

**Project:** AEP Agent Orchestrator (agent-weaver)
**Date:** March 31, 2026
**Author:** Kiro AI (Senior Developer Session)

---

## Session Intent

The goal of this session was to understand the full project end-to-end, identify a structural bug in the Kafka consumer pipeline, and fix it so that all incoming Kafka messages flow correctly through the AudienceAgent into the MongoDB `audiences` collection — removing all test/leftover code in the process.

---

## Prompts Used in This Session

### Prompt 1
> "ac as senior developer i want to understand the full project end to end in simple words what the exactly is the project about please explain me"

**Intent:** Full project comprehension. Read README, server.js, App.tsx, Index.tsx to map out the entire stack — frontend, backend, agents, infrastructure.

---

### Prompt 2
> "write what is the progress of this application... i can see all containers are running... but the problem is i see that in server.js there is kafka consumer it storing data into mongodb for testing i think but according to you the data has to store in audiences collection"

**Intent:** Identify the architectural mismatch between the test Kafka consumer (saving to `events` collection via `EventModel`) and the correct flow (saving to `audiences` collection via `AudienceAgent`).

---

### Prompt 3
> "yes please i want Kafka → AudienceAgent → processAudienceData → audiences collection. Delete: Event.js model, Kafka consumer using test-topic, any EventModel.create(...). USE ONLY Audience Agent. Make sure AudienceAgent.ingestFromKafka. Ensure Proper Data Format: { name, age } → { name, age, segment }"

**Intent:** Full refactor of the Kafka pipeline. Remove test artifacts, wire everything through the proper agent architecture.

---

## Changes Performed

### 1. Deleted `models/Event.js`
**File:** `agent-weaver/backend/models/Event.js`
**Reason:** This was a test model with schema `{ userId, action, message }` — completely unrelated to the real data architecture. It was only used by the test Kafka consumer on `test-topic`.

---

### 2. Removed `EventModel` import from `server.js`
**File:** `agent-weaver/backend/server.js`

**Removed:**
```js
const EventModel = require("./models/Event");
```

**Reason:** Model deleted, import no longer valid.

---

### 3. Removed test Kafka consumer block
**File:** `agent-weaver/backend/server.js`

**Removed entire block:**
```js
const consumer = kafka.consumer({ groupId: "test-group" });

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: "test-topic", fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const data = JSON.parse(message.value.toString());
      await EventModel.create(data); // ❌ wrong collection
    },
  });
}
```

**Reason:** This was a standalone test consumer that bypassed all agent logic and saved raw data directly to the `events` collection. It had no connection to the AudienceAgent or any other agent.

---

### 4. Updated `AudienceAgent.ingestFromKafka()`
**File:** `agent-weaver/backend/server.js`

**Before:**
```js
async ingestFromKafka(topic) {
  await kafkaConsumer.subscribe({ topic });
  await kafkaConsumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const data = JSON.parse(message.value.toString());
      await this.processAudienceData(data);
    },
  });
}
```

**After:**
```js
async ingestFromKafka(topic = 'audience-data') {
  await kafkaConsumer.subscribe({ topic, fromBeginning: true });
  await kafkaConsumer.run({
    eachMessage: async ({ message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        console.log('📨 Kafka message received:', data);
        await this.processAudienceData(data);
      } catch (err) {
        console.error('❌ Error processing Kafka message:', err);
      }
    },
  });
  console.log(`✅ AudienceAgent listening on topic: ${topic}`);
}
```

**Changes:**
- Added default topic `audience-data`
- Added `fromBeginning: true` so no messages are missed on restart
- Added try/catch per message so one bad message doesn't crash the consumer
- Added logging for observability

---

### 5. Updated `AudienceAgent.processAudienceData()`
**File:** `agent-weaver/backend/server.js`

**Before:**
```js
const ageGroup = this.inferAgeGroup(rawData);
const userCategory = `${ageGroup}yrs`;

const audience = new Audience({
  name: `Audience-${userCategory}`,
  segment: rawData.segment || 'default',
  userCategory,
  ...
});
```

**After:**
```js
const segment = this.inferSegment(rawData.age);

const audience = new Audience({
  name: rawData.name || `Audience-${segment}`,
  segment,
  userCategory: segment,
  ...
});
```

**Reason:** The old code used a hardcoded name and ignored the `name` field from the Kafka message. Now it uses the actual `name` from the payload and derives the segment from `age`.

---

### 6. Replaced `inferAgeGroup()` with `inferSegment()`
**File:** `agent-weaver/backend/server.js`

**Before:**
```js
inferAgeGroup(data) {
  const age = data.age || data.userAge;
  if (age <= 2)  return '0-2';
  if (age <= 10) return '8-10';
  if (age <= 17) return '11-17';
  return '18+';
}
```

**After:**
```js
inferSegment(age) {
  if (!age || isNaN(age)) return '0-10';
  if (age <= 10) return '0-10';
  if (age <= 19) return '11-19';
  if (age <= 30) return '20-30';
  if (age <= 45) return '31-45';
  return '46+';
}
```

**Reason:** New segment ranges are cleaner and more realistic for a general-purpose platform. Input is now the raw `age` number directly, not the full `rawData` object.

---

### 7. Fixed `buildSegmentPredicate()`
**File:** `agent-weaver/backend/server.js`

**Before:**
```js
return `(profile.attributes.age >= ${data.minAge || 0}) AND (profile.attributes.age <= ${data.maxAge || 100})`;
```

**After:**
```js
const segment = this.inferSegment(data.age);
const [min, max] = segment.replace('+', '-999').split('-').map(Number);
return `(profile.attributes.age >= ${min}) AND (profile.attributes.age <= ${max})`;
```

**Reason:** Old code relied on `minAge`/`maxAge` fields that were never in the Kafka payload. Now it derives the range from the same `inferSegment` logic.

---

### 8. Fixed stale `userCategory` variable reference
**File:** `agent-weaver/backend/server.js`

After renaming `userCategory` to `segment`, two references inside `processAudienceData` still used the old variable name. Fixed both:

```js
// Before
{ audienceId: audience.audienceId, userCategory }
`Segment for ${userCategory}`

// After
{ audienceId: audience.audienceId, segment }
`Segment for ${segment}`
```

---

### 9. Updated `startServer()` to use AudienceAgent
**File:** `agent-weaver/backend/server.js`

**Before:**
```js
await startConsumer(); // called the test consumer
```

**After:**
```js
await audienceAgent.ingestFromKafka('audience-data');
```

**Reason:** Server startup now wires directly into the proper agent pipeline.

---

## Final Data Flow

```
Kafka Producer
  ↓  (topic: audience-data)
  ↓  message: { "name": "Hrutvik", "age": 23 }
AudienceAgent.ingestFromKafka()
  ↓
processAudienceData()
  ↓
inferSegment(23) → "20-30"
  ↓
Audience.save() → MongoDB audiences collection
  {
    audienceId: "aud_1774957744041",
    name: "Hrutvik",
    age: 23,
    segment: "20-30",
    userCategory: "20-30",
    createdFrom: "kafka_topic",
    status: "draft"
  }
  ↓
Redis cache (1hr TTL)
  ↓
Adobe AEP (if credentials set)
  ↓
Content Agent → Journey Agent → Analytics Agent
```

---

## Known Non-Blocking Errors

| Error | Cause | Impact |
|-------|-------|--------|
| `Claude API 401` | Replaced by Groq | None |
| `Groq API 401` | `GROQ_API_KEY` blank or has leading space in `.env` | None — audience still saved |
| `Groq API 400` | Decommissioned model `llama3-8b-8192` | Fixed — updated to `llama-3.3-70b-versatile` |
| `Adobe 404` | Adobe credentials not set in `.env` | None — audience still saved |

All are optional integrations. Core pipeline works without them.

---

## Segment Reference Table (Final)

| Age Range | Segment  |
|-----------|----------|
| 0 – 10    | `0-10`   |
| 11 – 19   | `11-19`  |
| 20 – 30   | `20-30`  |
| 31 – 45   | `31-45`  |
| 46 – 60   | `46-60`  |
| 61 – 75   | `61-75`  |
| 76+       | `76-100` |

Segments are fully deterministic — no AI involved in range calculation.


---

## Today's Session Summary — March 31, 2026

**Total Tasks Completed: 4**

**Task 1 — Project Understanding**
Reviewed the full stack end-to-end. Mapped out the React frontend, Node.js backend, 4 agent classes (Audience, Content, Journey, Analytics), and the infrastructure (MongoDB, Redis, Kafka, Docker). Confirmed all 8 containers were running healthy via `docker compose up -d`.

**Task 2 — Bug Identification**
Spotted that `server.js` had two Kafka consumers running in parallel — one proper (inside `AudienceAgent`) and one leftover test consumer subscribed to `"test-topic"` that was saving raw data into an `events` collection via `EventModel`. This was bypassing all agent logic entirely.

**Task 3 — Pipeline Refactor**
Removed `models/Event.js`, the test consumer, and the `EventModel` import. Rewired `startServer()` to call `audienceAgent.ingestFromKafka("audience-data")`. Updated `processAudienceData()` to use the `name` field from the Kafka payload. Replaced `inferAgeGroup()` with a cleaner `inferSegment()` function using ranges: `0-10`, `11-19`, `20-30`, `31-45`, `46+`.

**Task 4 — Verification**
Sent a test Kafka message `{ "name": "Hrutvik", "age": 23 }` and confirmed the output:
- Message received by AudienceAgent ✅
- Segment correctly resolved to `"20-30"` ✅
- Audience saved to MongoDB `audiences` collection as `aud_1774957744041` ✅
- Claude and Adobe errors are non-blocking (missing API keys in `.env`) ✅


---

## Additional Changes — March 31, 2026 (Post-Session)

### Change 10 — Replaced Claude with Groq (free AI)
**Reason:** Claude API is paid. Switched to Groq which has a free tier.

- Removed `ANTHROPIC_API_KEY` config and `callClaudeAPI()` function
- Added `callGroqAPI()` using `https://api.groq.com/openai/v1/chat/completions`
- Initial model: `llama3-8b-8192`
- Added `GROQ_API_KEY` to `.env`

---

### Change 11 — Fixed Groq 400 error (decommissioned model)
**Error:** `model_decommissioned` — `llama3-8b-8192` no longer supported by Groq

**Fix:** Updated model name in `callGroqAPI()`:
```js
// Before
model: 'llama3-8b-8192'

// After
model: 'llama-3.3-70b-versatile'
```

---

### Change 12 — Fixed Groq 400 error (leading space in API key)
**Error:** `Request failed with status code 400`

**Root Cause:** `.env` had a space before the key value:
```
GROQ_API_KEY= gsk_xxx   ← space caused invalid auth header
```

**Fix:** Removed the leading space:
```
GROQ_API_KEY=gsk_xxx
```

---

### Change 13 — Attempted dynamic AI segment naming for age > 45
**Intent:** Instead of hardcoding `46+`, ask Groq to generate a segment label dynamically for ages above 45.

**Problem:** Groq was inconsistent — returned `60+`, `61-75`, or other formats that didn't match the age correctly (age 60 got segment `61-75`).

**Decision:** Reverted to fully deterministic segment logic. AI should not be used for basic numeric bucketing.

---

### Change 14 — Final deterministic segment table (no AI)
**File:** `agent-weaver/backend/server.js`

Replaced the partial `inferSegment()` + `inferSegmentWithAI()` approach with a single complete deterministic function:

```js
inferSegment(age) {
  if (!age || isNaN(age)) return '0-10';
  if (age <= 10)  return '0-10';
  if (age <= 19)  return '11-19';
  if (age <= 30)  return '20-30';
  if (age <= 45)  return '31-45';
  if (age <= 60)  return '46-60';
  if (age <= 75)  return '61-75';
  return '76-100';
}

async inferSegmentWithAI(age) {
  return this.inferSegment(age); // always deterministic
}
```

Groq is still used for segment optimization insights — just not for deciding which age bucket a user falls into.
