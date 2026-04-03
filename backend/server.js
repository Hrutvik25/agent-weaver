/**
 * AEP Agent Orchestrator - Backend Server v2.0
 * Event-Driven Architecture:
 * Kafka (analytics-events) → Analytics Agent → Orchestrator → Audience Agent → MongoDB
 */

const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');
const { Kafka } = require('kafkajs');
const axios = require('axios');
require('dotenv').config();
const cors = require('cors');
const MCPClient = require('./gateway/mcpClient');
const { MCPPolicyError } = require('./gateway/errors');
const MCP_GATEWAY_URL = process.env.MCP_GATEWAY_URL || 'http://localhost:5001';

const app = express();
app.use(express.json());
app.use(cors());

// ==================== CONFIGURATION ====================
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aep-orchestrator';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const ADOBE_API_KEY = process.env.ADOBE_API_KEY;
const ADOBE_ORG_ID = process.env.ADOBE_ORG_ID;
const ADOBE_TECH_ACCOUNT = process.env.ADOBE_TECH_ACCOUNT;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// ==================== DATABASE CONNECTION ====================
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✓ MongoDB connected'))
  .catch(err => console.error('✗ MongoDB error:', err));

// ==================== REDIS CLIENT ====================
const redisClient = redis.createClient({ url: REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.on('connect', () => console.log('✓ Redis connected'));
redisClient.connect();

// ==================== KAFKA ====================
const kafka = new Kafka({ clientId: 'aep-orchestrator', brokers: KAFKA_BROKERS });
const kafkaProducer = kafka.producer();
const kafkaConsumer = kafka.consumer({ groupId: 'aep-analytics-group' });
const kafkaAudienceConsumer = kafka.consumer({ groupId: 'aep-audience-group' });
const kafkaContentConsumer = kafka.consumer({ groupId: 'aep-content-group' });
const kafkaJourneyConsumer = kafka.consumer({ groupId: 'aep-journey-group' });

kafkaProducer.on('producer.connect', () => console.log('✓ Kafka Producer connected'));


// ==================== SCHEMAS ====================

// Audience Schema — stores optimized behavioral segments (output of orchestration)
const audienceSchema = new mongoose.Schema({
  audienceId:    { type: String, required: true },
  userId:        { type: String, required: true },
  segment:       { type: String, required: true }, // highly_engaged_users | potential_converters | drop_off_users
  score:         { type: Number, required: true },
  lastActivity:  { type: Date, default: Date.now },
  sourceEvent:   { type: mongoose.Schema.Types.Mixed }, // original analytics event
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     { type: Date, default: Date.now },
  status:        { type: String, enum: ['active', 'archived'], default: 'active' },
});
const Audience = mongoose.model('Audience', audienceSchema);

// Content Schema
const contentSchema = new mongoose.Schema({
  contentId:   String,
  title:       String,
  type:        String, // teaser_video | training_video | pdf | exam
  segment:     String, // target segment
  assetUrl:    String,
  metadata:    { duration: Number, fileSize: Number, format: String, author: String },
  tags:        [String],
  description: String,
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
  status:      { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
});
const Content = mongoose.model('Content', contentSchema);

// Journey Schema
const journeySchema = new mongoose.Schema({
  journeyId:                  String,
  name:                       String,
  audienceSegment:            String, // targets a segment, not a single audienceId
  steps: [{
    stepId:        { type: String },
    sequence:      { type: Number },
    type:          { type: String },
    contentId:     { type: String },
    condition:     mongoose.Schema.Types.Mixed,
    waitTime:      { type: Number },
    actionOnEvent: { type: String },
  }],
  surveyEnabled:              Boolean,
  personalizedTrainingEnabled: Boolean,
  createdAt:                  { type: Date, default: Date.now },
  updatedAt:                  { type: Date, default: Date.now },
  status:                     { type: String, enum: ['draft', 'active', 'paused', 'ended'], default: 'draft' },
});
const Journey = mongoose.model('Journey', journeySchema);

// Analytics Event Schema — raw behavioral events from Kafka
const analyticsEventSchema = new mongoose.Schema({
  analyticsId:  String,
  userId:       String,
  event:        String, // video_watched | clicked | page_view | course_completed
  watchTime:    Number,
  clicked:      Boolean,
  contentType:  String,
  journeyId:    String,
  contentId:    String,
  rating:       Number,
  recommendation: String,
  timestamp:    { type: Date, default: Date.now },
  data:         mongoose.Schema.Types.Mixed,
});
const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);

// Experiment Schema
const experimentSchema = new mongoose.Schema({
  experimentId: String,
  name:         String,
  segment:      String,
  variantA:     { contentId: String, trafficAllocation: Number },
  variantB:     { contentId: String, trafficAllocation: Number },
  startDate:    Date,
  endDate:      Date,
  metrics:      { impressions: Number, clicks: Number, conversions: Number, engagementRate: Number },
  winner:       String,
  status:       { type: String, enum: ['draft', 'running', 'completed'], default: 'draft' },
  createdAt:    { type: Date, default: Date.now },
});
const Experiment = mongoose.model('Experiment', experimentSchema);


// ==================== HELPER: GROQ AI ====================
async function callGroqAPI(prompt, context = {}) {
  if (!GROQ_API_KEY) {
    console.warn('⚠️  GROQ_API_KEY not set — skipping AI call');
    return null;
  }
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `You are an AEP marketing orchestration AI. ${JSON.stringify(context)}. Reply in JSON when possible.`,
          },
          { role: 'user', content: prompt },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Groq API error:', error.response?.data || error.message);
    return null;
  }
}

// ==================== HELPER: ADOBE API CLIENT ====================
class AdobeAPIClient {
  constructor() {
    this.baseURL = 'https://platform.adobe.io';
    this.accessToken = 'mock_adobe_access_token';
  }

  async createSegment(segmentData) {
    if (!ADOBE_API_KEY) return null;
    try {
      const response = await axios.post(
        `${this.baseURL}/data/core/ups/segment-definitions`,
        { name: segmentData.name, description: segmentData.description },
        { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'x-api-key': ADOBE_API_KEY, 'x-gw-ims-org-id': ADOBE_ORG_ID } }
      );
      return response.data;
    } catch (error) {
      console.error('Adobe segment error:', error.message);
      return null;
    }
  }

  async publishJourney(journeyData) {
    if (!ADOBE_API_KEY) return null;
    try {
      const response = await axios.post(
        `${this.baseURL}/journeys`,
        journeyData,
        { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'x-api-key': ADOBE_API_KEY, 'x-gw-ims-org-id': ADOBE_ORG_ID } }
      );
      return response.data;
    } catch (error) {
      console.error('Adobe journey error:', error.message);
      return null;
    }
  }
}
const adobeClient = new AdobeAPIClient();


// ==================== ORCHESTRATOR: DECISION ENGINE ====================
/**
 * Analyzes a behavioral event and returns segment + score.
 * Input:  { userId, event, watchTime, clicked, contentType, ... }
 * Output: { segment, score }
 */
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

// ==================== AGENT: ANALYTICS ====================
/**
 * Consumes raw behavioral events from Kafka topic "analytics-events".
 * Saves the raw event, then passes result to Orchestrator → AudienceAgent.
 */
class AnalyticsAgent {
  constructor() {
    const agentId = 'analytics';
    this.mcpClient = new MCPClient({
      gatewayUrl: MCP_GATEWAY_URL,
      agentId,
      jwtSecret: process.env['AGENT_JWT_SECRET_' + agentId.toUpperCase()] || process.env.AGENT_JWT_SECRET || 'dev-secret-change-in-production',
    });
  }

  async enrichWithMCP(userId, segment) {
    console.log(`[AnalyticsAgent] Calling MCP enrichWithMCP for ${userId}, segment: ${segment}`);
    try {
      const leads = await this.mcpClient.invoke('salesforce.getLeads', { filter: { segment, status: 'open' }, limit: 5 });
      console.log(`[AnalyticsAgent] MCP response:`, leads);
      broadcastLog('ANALYTICS', 'analytics', `🔗 MCP enrichment: ${leads?.length ?? 0} leads for segment ${segment}`);
      return leads;
    } catch (err) {
      console.error(`[AnalyticsAgent] MCP enrichment error:`, err);
      if (err instanceof MCPPolicyError) {
        console.warn(`⚠️  [AnalyticsAgent] MCP policy denied: ${err.message}`);
        broadcastLog('ANALYTICS', 'analytics', `⚠️ MCP policy denied: ${err.message}`);
      } else {
        console.warn(`⚠️  [AnalyticsAgent] MCP enrichment failed: ${err.message}`);
        broadcastLog('ANALYTICS', 'analytics', `⚠️ MCP enrichment failed: ${err.message}`);
      }
      return null;
    }
  }

  async startKafkaConsumer() {
    try {
      await kafkaConsumer.subscribe({ topic: 'analytics-events', fromBeginning: true });
      await kafkaConsumer.run({
        eachMessage: async ({ message }) => {
          try {
            const raw = message.value.toString();
            const event = JSON.parse(raw);

            if (!event.userId || !event.event) {
              console.warn('⚠️  Invalid analytics event — missing userId or event:', raw);
              return;
            }

            console.log('� [AnalyticsAgent] Received event:', event.userId);

            // Guard: skip if this is a segment message accidentally routed here
            if (event.segment) {
              console.warn('⚠️  [AnalyticsAgent] Skipping non-analytics message for:', event.userId);
              return;
            }

            // Save raw event
            await AnalyticsEvent.create({
              analyticsId: `ae_${Date.now()}`,
              userId:      event.userId,
              event:       event.event,
              watchTime:   event.watchTime || 0,
              clicked:     event.clicked   || false,
              contentType: event.contentType || 'unknown',
              journeyId:   event.journeyId,
              contentId:   event.contentId,
              data:        event,
            });

            // Orchestrator decision — produce result to audience-segments topic
            const segmentResult = analyzeBehavior(event);

            // MCP enrichment — enrich with Salesforce leads (non-blocking)
            await this.enrichWithMCP(event.userId, segmentResult.segment);

            const segmentData = {
              userId:       event.userId,
              segment:      segmentResult.segment,
              score:        segmentResult.score,
              lastEvent:    event.event,
              lastActivity: new Date().toISOString(),
              sourceEvent:  event,
            };

            await kafkaProducer.send({
              topic: 'audience-segments',
              messages: [{ key: event.userId, value: JSON.stringify(segmentData) }],
            });

            console.log(`📤 [AnalyticsAgent] Sent to audience-segments: ${event.userId} → ${segmentResult.segment}`);
            broadcastLog('ANALYTICS', 'analytics', `📤 Segment decision: ${event.userId} → ${segmentResult.segment} (score: ${segmentResult.score})`);

          } catch (err) {
            console.error('❌ Error processing analytics event:', err.message);
          }
        },
      });
      console.log('✅ AnalyticsAgent listening on topic: analytics-events');
    } catch (error) {
      console.error('AnalyticsAgent Kafka error:', error);
    }
  }

  async trackEvent(eventData) {
    try {
      const record = await AnalyticsEvent.create({
        analyticsId: `ae_${Date.now()}`,
        userId:      eventData.userId,
        event:       eventData.event || eventData.eventType,
        watchTime:   eventData.watchTime || 0,
        clicked:     eventData.clicked || false,
        contentType: eventData.contentType || 'unknown',
        journeyId:   eventData.journeyId,
        contentId:   eventData.contentId,
        rating:      eventData.rating,
        data:        eventData,
      });

      // Also publish to Kafka for real-time processing
      await kafkaProducer.send({
        topic: 'analytics-events',
        messages: [{ value: JSON.stringify(eventData) }],
      });

      console.log('✓ Event tracked:', record.event);
      return record;
    } catch (error) {
      console.error('Event tracking error:', error);
    }
  }

  async submitFeedback(contentId, userId, rating, comment) {
    try {
      const record = await AnalyticsEvent.create({
        analyticsId: `fb_${Date.now()}`,
        userId,
        event:       'feedback',
        contentId,
        rating,
        data:        { comment },
      });

      if (rating <= 2) {
        const recommendation = await callGroqAPI(
          `User rated content ${rating}/5. Comment: "${comment}". Suggest content improvement or alternative.`
        );
        record.recommendation = recommendation;
        await record.save();
      }

      await kafkaProducer.send({
        topic: 'analytics-events',
        messages: [{ value: JSON.stringify({ userId, event: 'feedback', contentId, rating, comment }) }],
      });

      console.log('✓ Feedback submitted for content:', contentId);
      return record;
    } catch (error) {
      console.error('Feedback error:', error);
    }
  }

  async getMetrics(journeyId, dateRange = {}) {
    try {
      const query = { journeyId };
      if (dateRange.startDate || dateRange.endDate) {
        query.timestamp = {};
        if (dateRange.startDate) query.timestamp.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate)   query.timestamp.$lte = new Date(dateRange.endDate);
      }

      const events = await AnalyticsEvent.find(query);
      const metrics = {
        totalEvents: events.length,
        eventsByType: {},
        userEngagement: {
          uniqueUsers:   new Set(events.map(e => e.userId)).size,
          averageRating: 0,
          feedbackCount: 0,
        },
      };

      let totalRating = 0;
      events.forEach(e => {
        metrics.eventsByType[e.event] = (metrics.eventsByType[e.event] || 0) + 1;
        if (e.rating) { totalRating += e.rating; metrics.userEngagement.feedbackCount++; }
      });

      if (metrics.userEngagement.feedbackCount > 0) {
        metrics.userEngagement.averageRating = totalRating / metrics.userEngagement.feedbackCount;
      }

      return metrics;
    } catch (error) {
      console.error('Metrics error:', error);
    }
  }

  async createExperiment(experimentData) {
    try {
      const experiment = await Experiment.create({
        experimentId: `exp_${Date.now()}`,
        name:         experimentData.name,
        segment:      experimentData.segment,
        variantA:     experimentData.variantA,
        variantB:     experimentData.variantB,
        startDate:    experimentData.startDate,
        endDate:      experimentData.endDate,
        status:       'running',
      });
      console.log('✓ Experiment created:', experiment.experimentId);
      return experiment;
    } catch (error) {
      console.error('Experiment error:', error);
    }
  }
}

const analyticsAgent = new AnalyticsAgent();


// ==================== AGENT: AUDIENCE ====================
/**
 * Receives processed segment results from the Orchestrator.
 * Upserts optimized audience segments into MongoDB "audiences" collection.
 * Input:  userId + { segment, score } from analyzeBehavior()
 * Output: MongoDB audiences document
 */
class AudienceAgent {
  constructor() {
    const agentId = 'audience';
    this.mcpClient = new MCPClient({
      gatewayUrl: MCP_GATEWAY_URL,
      agentId,
      jwtSecret: process.env['AGENT_JWT_SECRET_' + agentId.toUpperCase()] || process.env.AGENT_JWT_SECRET || 'dev-secret-change-in-production',
    });
  }

  async enrichSegmentWithCRM(userId, segment) {
    console.log(`[AudienceAgent] Calling MCP enrichSegmentWithCRM for ${userId}, segment: ${segment}`);
    try {
      const leads = await this.mcpClient.invoke('salesforce.getLeads', { filter: { segment, status: 'open' }, limit: 10 });
      console.log(`[AudienceAgent] MCP response:`, leads);
      broadcastLog('AUDIENCE', 'audience', `🔗 MCP CRM enrichment: ${leads?.length ?? 0} leads for ${userId}`);
      return leads;
    } catch (err) {
      console.error(`[AudienceAgent] MCP enrichment error:`, err);
      if (err instanceof MCPPolicyError) {
        console.warn(`⚠️  [AudienceAgent] MCP policy denied: ${err.message}`);
        broadcastLog('AUDIENCE', 'audience', `⚠️ MCP policy denied: ${err.message}`);
      } else {
        console.warn(`⚠️  [AudienceAgent] MCP enrichment failed: ${err.message}`);
        broadcastLog('AUDIENCE', 'audience', `⚠️ MCP enrichment failed: ${err.message}`);
      }
      return null;
    }
  }

  async startKafkaConsumer() {
    try {
      await kafkaAudienceConsumer.subscribe({ topic: 'audience-segments', fromBeginning: true });
      await kafkaAudienceConsumer.run({
        eachMessage: async ({ message }) => {
          try {
            const data = JSON.parse(message.value.toString());

            if (!data.userId || !data.segment) {
              console.warn('⚠️  [AudienceAgent] Skipping invalid segment message — missing userId or segment');
              return;
            }

            // Guard: skip if this is a raw analytics event accidentally routed here
            if (!data.segment) {
              console.warn('⚠️  [AudienceAgent] Skipping non-segment message');
              return;
            }

            console.log('📥 [AudienceAgent] Received segment:', data.userId, '→', data.segment);
            broadcastLog('AUDIENCE', 'audience', `📥 Segment received: ${data.userId} → ${data.segment}`);
            await this.upsertSegment(data.userId, { segment: data.segment, score: data.score }, data.sourceEvent || {});

            // MCP enrichment — enrich segment with Salesforce CRM data (non-blocking)
            await this.enrichSegmentWithCRM(data.userId, data.segment);

            // Produce to content-recommendations so ContentAgent can react
            await kafkaProducer.send({
              topic: 'content-recommendations',
              messages: [{ key: data.userId, value: JSON.stringify({
                userId:   data.userId,
                segment:  data.segment,
                score:    data.score,
              }) }],
            });
            console.log(`📤 [AudienceAgent] Sent to content-recommendations: ${data.userId} → ${data.segment}`);
            broadcastLog('AUDIENCE', 'audience', `📤 Sent to content-recommendations: ${data.userId}`);

          } catch (err) {
            console.error('❌ Error processing segment message:', err.message);
          }
        },
      });
      console.log('✅ AudienceAgent listening on topic: audience-segments');
    } catch (error) {
      console.error('AudienceAgent Kafka error:', error);
    }
  }

  async upsertSegment(userId, segmentResult, sourceEvent = {}) {
    try {
      const { segment, score } = segmentResult;

      // Upsert — update if exists, create if not
      const audience = await Audience.findOneAndUpdate(
        { userId },
        {
          $set: {
            audienceId:   `aud_${userId}`,
            userId,
            segment,
            score,
            lastActivity: new Date(),
            sourceEvent,
            updatedAt:    new Date(),
            status:       'active',
          },
        },
        { upsert: true, new: true }
      );

      // Cache in Redis
      await redisClient.setEx(`audience:${userId}`, 3600, JSON.stringify(audience));

      console.log(`✓ Audience upserted: ${userId} → ${segment} (score: ${score})`);
      broadcastLog('AUDIENCE', 'audience', `✓ Upserted: ${userId} → ${segment} (score: ${score})`);
      return audience;
    } catch (error) {
      console.error('Audience upsert error:', error);
    }
  }

  async getAudience(userId) {
    const cached = await redisClient.get(`audience:${userId}`);
    if (cached) return JSON.parse(cached);
    return Audience.findOne({ userId });
  }

  async listAudiences(filters = {}) {
    return Audience.find(filters);
  }

  async getSegmentSummary() {
    return Audience.aggregate([
      { $group: { _id: '$segment', count: { $sum: 1 }, avgScore: { $avg: '$score' } } },
      { $sort: { count: -1 } },
    ]);
  }
}

const audienceAgent = new AudienceAgent();

// ==================== AGENT: CONTENT ====================
class ContentAgent {
  constructor() {
    const agentId = 'content';
    this.mcpClient = new MCPClient({
      gatewayUrl: MCP_GATEWAY_URL,
      agentId,
      jwtSecret: process.env['AGENT_JWT_SECRET_' + agentId.toUpperCase()] || process.env.AGENT_JWT_SECRET || 'dev-secret-change-in-production',
    });
  }

  async fetchSupportContext(segment) {
    try {
      const cases = await this.mcpClient.invoke('salesforce.getCases', { status: 'Working', limit: 5 });
      broadcastLog('CONTENT', 'content', `🔗 MCP support context: ${cases?.length ?? 0} cases for segment ${segment}`);
      return cases;
    } catch (err) {
      if (err instanceof MCPPolicyError) {
        console.warn(`⚠️  [ContentAgent] MCP policy denied: ${err.message}`);
      } else {
        console.warn(`⚠️  [ContentAgent] MCP support context failed: ${err.message}`);
      }
      return null;
    }
  }

  async startKafkaConsumer() {
    try {
      await kafkaContentConsumer.subscribe({ topic: 'content-recommendations', fromBeginning: true });
      await kafkaContentConsumer.run({
        eachMessage: async ({ message }) => {
          try {
            const data = JSON.parse(message.value.toString());

            if (!data.userId || !data.segment) {
              console.warn('⚠️  [ContentAgent] Skipping invalid message');
              return;
            }

            console.log('📥 [ContentAgent] Received recommendation:', data.userId, '→', data.segment);
            broadcastLog('CONTENT', 'content', `📥 Content recommendation: ${data.userId} → ${data.segment}`);

            // MCP enrichment — fetch support context from Salesforce (non-blocking)
            await this.fetchSupportContext(data.segment);

            // Find published content matching this segment
            const content = await this.listContentBySegment(data.segment);

            // Produce journey-trigger event for JourneyAgent
            await kafkaProducer.send({
              topic: 'journey-triggers',
              messages: [{ key: data.userId, value: JSON.stringify({
                userId:    data.userId,
                segment:   data.segment,
                score:     data.score,
                contentIds: content.map(c => c.contentId),
              }) }],
            });

            console.log(`📤 [ContentAgent] Sent to journey-triggers: ${data.userId}, ${content.length} content items`);
            broadcastLog('CONTENT', 'content', `📤 Journey trigger sent: ${data.userId} — ${content.length} content items`);
          } catch (err) {
            console.error('❌ [ContentAgent] Error:', err.message);
          }
        },
      });
      console.log('✅ ContentAgent listening on topic: content-recommendations');
    } catch (error) {
      console.error('ContentAgent Kafka error:', error);
    }
  }

  async createContent(contentData) {
    try {
      const content = await Content.create({
        contentId:   `content_${Date.now()}`,
        title:       contentData.title,
        type:        contentData.type,
        segment:     contentData.segment,
        assetUrl:    contentData.assetUrl,
        metadata:    contentData.metadata || {},
        tags:        contentData.tags || [],
        description: contentData.description,
        status:      'draft',
      });
      await redisClient.setEx(`content:${content.contentId}`, 3600, JSON.stringify(content));
      console.log('✓ Content created:', content.contentId);
      return content;
    } catch (error) {
      console.error('Content creation error:', error);
    }
  }

  async publishContent(contentId) {
    try {
      // Clear cache first so findOneAndUpdate result is fresh
      await redisClient.del(`content:${contentId}`);

      const content = await Content.findOneAndUpdate(
        { contentId },
        { $set: { status: 'published', updatedAt: new Date() } },
        { new: true }
      );
      if (!content) throw new Error('Content not found');

      console.log('✓ Content published:', contentId);
      return content;
    } catch (error) {
      console.error('Content publish error:', error);
    }
  }

  async getContent(contentId) {
    const cached = await redisClient.get(`content:${contentId}`);
    if (cached) return JSON.parse(cached);
    return Content.findOne({ contentId });
  }

  async listContentBySegment(segment) {
    return Content.find({ segment, status: 'published' });
  }

  async tagContent(contentId, tags) {
    try {
      const content = await Content.findOne({ contentId });
      content.tags = [...new Set([...content.tags, ...tags])];
      await content.save();
      await redisClient.del(`content:${contentId}`);
      return content;
    } catch (error) {
      console.error('Content tagging error:', error);
    }
  }
}

const contentAgent = new ContentAgent();

// ==================== AGENT: JOURNEY ====================
class JourneyAgent {
  constructor() {
    const agentId = 'journey';
    this.mcpClient = new MCPClient({
      gatewayUrl: MCP_GATEWAY_URL,
      agentId,
      jwtSecret: process.env['AGENT_JWT_SECRET_' + agentId.toUpperCase()] || process.env.AGENT_JWT_SECRET || 'dev-secret-change-in-production',
    });
  }

  async fetchPipelineContext(segment) {
    let opportunities = null;
    let changeRequests = null;

    try {
      opportunities = await this.mcpClient.invoke('salesforce.getOpportunities', { stage: 'Prospecting', limit: 5 });
      broadcastLog('JOURNEY', 'journey', `🔗 MCP pipeline: ${opportunities?.length ?? 0} opportunities for segment ${segment}`);
    } catch (err) {
      if (err instanceof MCPPolicyError) {
        console.warn(`⚠️  [JourneyAgent] MCP policy denied (opportunities): ${err.message}`);
      } else {
        console.warn(`⚠️  [JourneyAgent] MCP opportunities failed: ${err.message}`);
      }
    }

    try {
      changeRequests = await this.mcpClient.invoke('servicenow.getChangeRequests', { state: 'scheduled', limit: 5 });
      broadcastLog('JOURNEY', 'journey', `🔗 MCP pipeline: ${changeRequests?.length ?? 0} change requests for segment ${segment}`);
    } catch (err) {
      if (err instanceof MCPPolicyError) {
        console.warn(`⚠️  [JourneyAgent] MCP policy denied (changeRequests): ${err.message}`);
      } else {
        console.warn(`⚠️  [JourneyAgent] MCP change requests failed: ${err.message}`);
      }
    }

    return { opportunities, changeRequests };
  }

  async startKafkaConsumer() {
    try {
      await kafkaJourneyConsumer.subscribe({ topic: 'journey-triggers', fromBeginning: true });
      await kafkaJourneyConsumer.run({
        eachMessage: async ({ message }) => {
          try {
            const data = JSON.parse(message.value.toString());

            if (!data.userId || !data.segment) {
              console.warn('⚠️  [JourneyAgent] Skipping invalid message');
              return;
            }

            console.log('📥 [JourneyAgent] Received trigger:', data.userId, '→', data.segment);
            broadcastLog('JOURNEY', 'journey', `📥 Journey trigger: ${data.userId} → ${data.segment}`);

            // MCP enrichment — fetch pipeline context from Salesforce + ServiceNow (non-blocking)
            await this.fetchPipelineContext(data.segment);

            // Auto-create a personalized journey for this user's segment
            const journey = await this.createJourney({
              name:                        `Auto-Journey: ${data.segment} - ${data.userId}`,
              audienceSegment:             data.segment,
              personalizedTrainingEnabled: true,
              steps: (data.contentIds || []).map((contentId, i) => ({
                stepId:    `step_${Date.now()}_${i}`,
                sequence:  i + 1,
                type:      'content_delivery',
                contentId,
              })),
            });

            // Use Groq to get personalization recommendation
            const recommendation = await callGroqAPI(
              `User ${data.userId} is in segment "${data.segment}" with score ${data.score}. They have ${data.contentIds?.length || 0} content items. Suggest the best engagement strategy in one sentence.`
            );

            console.log(`✓ [JourneyAgent] Journey created: ${journey.journeyId} | AI: ${recommendation}`);
            broadcastLog('JOURNEY', 'journey', `✓ Journey created: ${journey.journeyId}`);
            if (recommendation) broadcastLog('JOURNEY', 'journey', `🤖 AI: ${recommendation.slice(0, 120)}`);

          } catch (err) {
            console.error('❌ [JourneyAgent] Error:', err.message);
          }
        },
      });
      console.log('✅ JourneyAgent listening on topic: journey-triggers');
    } catch (error) {
      console.error('JourneyAgent Kafka error:', error);
    }
  }

  async createJourney(journeyData) {
    try {
      const journey = await Journey.create({
        journeyId:                   `journey_${Date.now()}`,
        name:                        journeyData.name,
        audienceSegment:             journeyData.audienceSegment,
        steps:                       journeyData.steps || [],
        surveyEnabled:               journeyData.surveyEnabled || false,
        personalizedTrainingEnabled: journeyData.personalizedTrainingEnabled || false,
        status:                      'draft',
      });
      await redisClient.setEx(`journey:${journey.journeyId}`, 3600, JSON.stringify(journey));
      console.log('✓ Journey created:', journey.journeyId);
      return journey;
    } catch (error) {
      console.error('Journey creation error:', error);
    }
  }

  async activateJourney(journeyId) {
    try {
      const journey = await Journey.findOneAndUpdate(
        { journeyId },
        { $set: { status: 'active', updatedAt: new Date() } },
        { new: true }
      );
      if (!journey) throw new Error('Journey not found');
      await adobeClient.publishJourney({ name: journey.name, steps: journey.steps });
      await redisClient.del(`journey:${journeyId}`);
      console.log('✓ Journey activated:', journeyId);
      return journey;
    } catch (error) {
      console.error('Journey activation error:', error);
    }
  }

  async addJourneyStep(journeyId, step) {
    try {
      const journey = await Journey.findOne({ journeyId });
      step.stepId   = `step_${Date.now()}`;
      step.sequence = journey.steps.length + 1;
      journey.steps.push(step);
      await journey.save();
      await redisClient.del(`journey:${journeyId}`);
      return journey;
    } catch (error) {
      console.error('Journey step error:', error);
    }
  }

  async getJourney(journeyId) {
    const cached = await redisClient.get(`journey:${journeyId}`);
    if (cached) return JSON.parse(cached);
    return Journey.findOne({ journeyId });
  }

  async personalizeContent(journeyId, userId) {
    try {
      const journey  = await this.getJourney(journeyId);
      const audience = await audienceAgent.getAudience(userId);
      const prompt   = `Journey: "${journey.name}", User segment: "${audience?.segment}", Score: ${audience?.score}. Suggest best content sequence for conversion.`;
      return await callGroqAPI(prompt);
    } catch (error) {
      console.error('Personalization error:', error);
    }
  }
}

const journeyAgent = new JourneyAgent();


// ==================== SSE: REAL-TIME LOG BROADCASTER ====================
const sseClients = new Set();

function broadcastLog(tag, tagClass, message) {
  const payload = JSON.stringify({
    time: new Date().toTimeString().slice(0, 8),
    tag: `[${tag}]`,
    tagClass,
    message,
  });
  sseClients.forEach(client => {
    try { client.write(`data: ${payload}\n\n`); } catch (_) { sseClients.delete(client); }
  });
}

app.get('/api/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  sseClients.add(res);
  broadcastLog('SYSTEM', 'system', 'SSE client connected — live logs active.');

  req.on('close', () => sseClients.delete(res));
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    pipeline: 'analytics-events → AnalyticsAgent → Orchestrator → AudienceAgent → MongoDB',
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis:   'connected',
      kafka:   'connected',
    },
  });
});

// Health check (API version)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    pipeline: 'analytics-events → AnalyticsAgent → Orchestrator → AudienceAgent → MongoDB',
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis:   'connected',
      kafka:   'connected',
    },
  });
});

// ==================== AUDIENCE ENDPOINTS ====================
app.get('/api/audiences', async (req, res) => {
  try {
    const audiences = await audienceAgent.listAudiences(req.query);
    res.json({ success: true, data: audiences });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audiences/summary', async (req, res) => {
  try {
    const summary = await audienceAgent.getSegmentSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get overall stats for dashboard
app.get('/api/stats', async (req, res) => {
  try {
    const totalAudiences = await Audience.countDocuments();
    const totalJourneys = await Journey.countDocuments();
    const totalEvents = await AnalyticsEvent.countDocuments();
    const segmentBreakdown = await audienceAgent.getSegmentSummary();

    res.json({
      success: true,
      data: {
        totalUsers: totalAudiences,
        totalJourneys,
        totalEvents,
        segments: segmentBreakdown,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audiences/:userId', async (req, res) => {
  try {
    const audience = await audienceAgent.getAudience(req.params.userId);
    if (!audience) return res.status(404).json({ error: 'Audience not found' });
    res.json({ success: true, data: audience });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CONTENT ENDPOINTS ====================
app.post('/api/content', async (req, res) => {
  try {
    const content = await contentAgent.createContent(req.body);
    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/content/:contentId/publish', async (req, res) => {
  try {
    const content = await contentAgent.publishContent(req.params.contentId);
    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/content/:contentId', async (req, res) => {
  try {
    const content = await contentAgent.getContent(req.params.contentId);
    if (!content) return res.status(404).json({ error: 'Content not found' });
    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/content/segment/:segment', async (req, res) => {
  try {
    const content = await contentAgent.listContentBySegment(req.params.segment);
    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/content/:contentId/tag', async (req, res) => {
  try {
    const content = await contentAgent.tagContent(req.params.contentId, req.body.tags);
    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== JOURNEY ENDPOINTS ====================
app.post('/api/journeys', async (req, res) => {
  try {
    const journey = await journeyAgent.createJourney(req.body);
    res.json({ success: true, data: journey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/journeys/:journeyId/activate', async (req, res) => {
  try {
    const journey = await journeyAgent.activateJourney(req.params.journeyId);
    res.json({ success: true, data: journey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/journeys', async (req, res) => {
  try {
    const journeys = await Journey.find().sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data: journeys });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/journeys/:journeyId', async (req, res) => {
  try {
    const journey = await journeyAgent.getJourney(req.params.journeyId);
    if (!journey) return res.status(404).json({ error: 'Journey not found' });
    res.json({ success: true, data: journey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/journeys/:journeyId/steps', async (req, res) => {
  try {
    const journey = await journeyAgent.addJourneyStep(req.params.journeyId, req.body);
    res.json({ success: true, data: journey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/journeys/:journeyId/personalize', async (req, res) => {
  try {
    const result = await journeyAgent.personalizeContent(req.params.journeyId, req.body.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ANALYTICS ENDPOINTS ====================
app.post('/api/analytics/events', async (req, res) => {
  try {
    const event = await analyticsAgent.trackEvent(req.body);
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analytics/feedback', async (req, res) => {
  try {
    const feedback = await analyticsAgent.submitFeedback(
      req.body.contentId, req.body.userId, req.body.rating, req.body.comment
    );
    res.json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/metrics/:journeyId', async (req, res) => {
  try {
    const metrics = await analyticsAgent.getMetrics(req.params.journeyId, req.query);
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analytics/experiments', async (req, res) => {
  try {
    const experiment = await analyticsAgent.createExperiment(req.body);
    res.json({ success: true, data: experiment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ORCHESTRATOR ENDPOINT ====================
// Full pipeline trigger via REST (for testing without Kafka)
app.post('/api/orchestrate', async (req, res) => {
  try {
    const { analyticsEvent, contentData, journeyData } = req.body;
    const result = { timestamp: new Date(), steps: [] };

    if (analyticsEvent) {
      // Strict event-driven: only publish to Kafka, never write DB directly
      await kafkaProducer.send({
        topic: 'analytics-events',
        messages: [{ key: analyticsEvent.userId, value: JSON.stringify(analyticsEvent) }],
      });
      console.log(`📤 [Orchestrate] Event published → analytics-events: ${analyticsEvent.userId}`);
      broadcastLog('ORCHESTRATOR', 'orchestrator', `📤 Event published → analytics-events: ${analyticsEvent.userId}`);
      result.steps.push({ name: 'event_published', userId: analyticsEvent.userId, topic: 'analytics-events' });
    }

    if (contentData) {
      const content = await contentAgent.createContent(contentData);
      result.steps.push({ name: 'content_created', contentId: content.contentId });
    }

    if (journeyData) {
      const journey = await journeyAgent.createJourney(journeyData);
      result.steps.push({ name: 'journey_created', journeyId: journey.journeyId });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== BATCH ORCHESTRATOR ENDPOINT ====================
// Send multiple analytics events at once
app.post('/api/orchestrate/batch', async (req, res) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events must be a non-empty array' });
    }

    const results = [];
    for (const analyticsEvent of events) {
      if (!analyticsEvent.userId || !analyticsEvent.event) {
        results.push({ userId: analyticsEvent.userId, status: 'skipped', reason: 'missing userId or event' });
        continue;
      }
      await kafkaProducer.send({
        topic: 'analytics-events',
        messages: [{ key: analyticsEvent.userId, value: JSON.stringify(analyticsEvent) }],
      });
      console.log(`📤 [Batch] Event published → analytics-events: ${analyticsEvent.userId}`);
      results.push({ userId: analyticsEvent.userId, status: 'published', topic: 'analytics-events' });
    }

    res.json({ success: true, data: { total: events.length, results } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await kafkaProducer.connect();
    console.log('✅ Kafka Producer connected');

    // Stage 1: analytics-events → AnalyticsAgent → analyzeBehavior() → audience-segments
    await analyticsAgent.startKafkaConsumer();

    // Stage 2: audience-segments → AudienceAgent → MongoDB + content-recommendations
    await kafkaAudienceConsumer.connect();
    await audienceAgent.startKafkaConsumer();

    // Stage 3: content-recommendations → ContentAgent → journey-triggers
    await kafkaContentConsumer.connect();
    await contentAgent.startKafkaConsumer();

    // Stage 4: journey-triggers → JourneyAgent → personalized journeys
    await kafkaJourneyConsumer.connect();
    await journeyAgent.startKafkaConsumer();

    app.listen(PORT, () => {
      console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
      console.log(`║  AEP Agent Orchestrator v2.0                                 ║`);
      console.log(`║  Port: ${PORT}                                                   ║`);
      console.log(`║  Pipeline:                                                   ║`);
      console.log(`║  analytics-events → audience-segments → content-recs         ║`);
      console.log(`║                   → journey-triggers → MongoDB               ║`);
      console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
