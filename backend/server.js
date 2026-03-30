/**
 * AEP Agent Orchestrator - Backend Server
 * Coordinates Audience, Content, Journey, and Analytics Agents
 * Deployed via Adobe ID with MongoDB local setup
 */

const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');
const { Kafka } = require('kafkajs');
const axios = require('axios');
require('dotenv').config();
const cors = require('cors');

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
const ADOBE_PRIVATE_KEY = process.env.ADOBE_PRIVATE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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

// ==================== KAFKA PRODUCER & CONSUMER ====================
const kafka = new Kafka({
  clientId: 'aep-orchestrator',
  brokers: KAFKA_BROKERS,
});

const kafkaProducer = kafka.producer();
const kafkaConsumer = kafka.consumer({ groupId: 'aep-orchestrator-group' });

kafkaProducer.on('producer.connect', () => console.log('✓ Kafka Producer connected'));
kafkaProducer.on('producer.disconnect', () => console.log('✗ Kafka Producer disconnected'));
kafkaConsumer.on('consumer.connect', () => console.log('✓ Kafka Consumer connected'));

// ==================== DATABASE SCHEMAS ====================

// Audience Schema
const audienceSchema = new mongoose.Schema({
  audienceId: String,
  name: String,
  segment: String,
  userCategory: String, // e.g., "0-2yrs", "8-10yrs", "11-17yrs", "18+"
  size: Number,
  attributes: mongoose.Schema.Types.Mixed,
  createdFrom: String, // 'raw_data', 'kafka_topic'
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft' },
});

const Audience = mongoose.model('Audience', audienceSchema);

// Content Schema
const contentSchema = new mongoose.Schema({
  contentId: String,
  title: String,
  type: String, // 'teaser_video', 'training_video', 'one_page_image', 'ppt', 'pdf', 'document', 'exam'
  ageSegment: String, // age range targeting
  assetUrl: String,
  metadata: {
    duration: Number, // in seconds for videos
    fileSize: Number,
    format: String,
    author: String,
  },
  tags: [String],
  description: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  adobeAssetId: String, // AEP reference
});

const Content = mongoose.model('Content', contentSchema);

// Journey Schema
const journeySchema = new mongoose.Schema({
  journeyId: String,
  name: String,
  audienceId: String,
  steps: [
    {
      stepId: String,
      sequence: Number,
      type: String, // 'email', 'survey', 'content_delivery', 'personalized_training'
      contentId: String,
      condition: mongoose.Schema.Types.Mixed,
      waitTime: Number, // in seconds
      actionOnEvent: String,
    },
  ],
  surveyEnabled: Boolean,
  surveyReach: Number,
  surveyAnalyticsEnabled: Boolean,
  personalizedTrainingEnabled: Boolean,
  registrationRequired: Boolean,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['draft', 'active', 'paused', 'ended'], default: 'draft' },
  adobeJourneyId: String, // AEP reference
});

const Journey = mongoose.model('Journey', journeySchema);

// Analytics Schema
const analyticsSchema = new mongoose.Schema({
  analyticsId: String,
  journeyId: String,
  audienceId: String,
  contentId: String,
  eventType: String, // 'view', 'click', 'engage', 'complete', 'feedback'
  userId: String,
  userCategory: String,
  timestamp: { type: Date, default: Date.now },
  data: mongoose.Schema.Types.Mixed,
  experimentationEnabled: Boolean,
  customTrainingRecommended: Boolean,
  feedbackSent: Boolean,
  rating: Number, // 1-5 scale
  recommendation: String,
});

const Analytics = mongoose.model('Analytics', analyticsSchema);

// Experiment Schema
const experimentSchema = new mongoose.Schema({
  experimentId: String,
  name: String,
  audience: String,
  variantA: { contentId: String, trafficAllocation: Number },
  variantB: { contentId: String, trafficAllocation: Number },
  startDate: Date,
  endDate: Date,
  metrics: {
    impressions: Number,
    clicks: Number,
    conversions: Number,
    engagementRate: Number,
  },
  winner: String,
  status: { type: String, enum: ['draft', 'running', 'completed'], default: 'draft' },
  createdAt: { type: Date, default: Date.now },
});

const Experiment = mongoose.model('Experiment', experimentSchema);

// ==================== HELPER: ADOBE API CLIENT ====================
class AdobeAPIClient {
  constructor() {
    this.baseURL = 'https://platform.adobe.io';
    this.accessToken = null;
  }

  async getAccessToken() {
    if (this.accessToken) return this.accessToken;

    try {
      const jwtPayload = {
        iss: ADOBE_ORG_ID,
        sub: ADOBE_TECH_ACCOUNT,
        aud: 'https://ims-na1.adobelogin.com/c/' + ADOBE_API_KEY,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      // Note: Actual implementation requires JWT library and private key processing
      // This is a simplified mock for demonstration
      this.accessToken = 'mock_adobe_access_token';
      return this.accessToken;
    } catch (error) {
      console.error('Adobe token error:', error);
      throw error;
    }
  }

  async createSegment(segmentData) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.post(
        `${this.baseURL}/data/core/ups/segment-definitions`,
        {
          schema: { name: '_xdm.context.profile' },
          description: segmentData.description,
          expression: {
            value: segmentData.predicate,
          },
          ttlInDays: 30,
          name: segmentData.name,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-api-key': ADOBE_API_KEY,
            'x-gw-ims-org-id': ADOBE_ORG_ID,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Adobe segment creation error:', error.message);
      return null;
    }
  }

  async publishJourney(journeyData) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.post(
        `${this.baseURL}/journeys`,
        journeyData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-api-key': ADOBE_API_KEY,
            'x-gw-ims-org-id': ADOBE_ORG_ID,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Adobe journey publish error:', error.message);
      return null;
    }
  }
}

const adobeClient = new AdobeAPIClient();

// ==================== HELPER: CLAUDE AI INTEGRATION ====================
async function callClaudeAPI(prompt, context = {}) {
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-opus-4-6',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        system: `You are an AI agent for AEP (Adobe Experience Platform) orchestration. 
${JSON.stringify(context, null, 2)}
Provide actionable insights and recommendations in JSON format when possible.`,
      },
      {
        headers: {
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
        },
      }
    );

    return response.data.content[0].text;
  } catch (error) {
    console.error('Claude API error:', error.message);
    return null;
  }
}

// ==================== AGENT: AUDIENCE ====================
class AudienceAgent {
  async ingestFromKafka(topic) {
    try {
      await kafkaConsumer.subscribe({ topic });
      await kafkaConsumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const data = JSON.parse(message.value.toString());
          await this.processAudienceData(data);
        },
      });
    } catch (error) {
      console.error('Kafka ingestion error:', error);
    }
  }

  async processAudienceData(rawData) {
    try {
      // Infer user category from raw data
      const ageGroup = this.inferAgeGroup(rawData);
      const userCategory = `${ageGroup}yrs`;

      // Create audience segment
      const audience = new Audience({
        audienceId: `aud_${Date.now()}`,
        name: `Audience-${userCategory}`,
        segment: rawData.segment || 'default',
        userCategory,
        attributes: rawData,
        createdFrom: 'kafka_topic',
        status: 'draft',
      });

      await audience.save();

      // Call Claude for segment optimization
      const optimization = await callClaudeAPI(
        `Analyze this audience data and suggest segment optimizations: ${JSON.stringify(rawData)}`,
        { audienceId: audience.audienceId, userCategory }
      );

      // Push to Redis cache
      await redisClient.setEx(
        `audience:${audience.audienceId}`,
        3600,
        JSON.stringify(audience)
      );

      // Publish to Adobe AEP
      const adobeSegment = await adobeClient.createSegment({
        name: audience.name,
        description: `Segment for ${userCategory}`,
        predicate: this.buildSegmentPredicate(rawData),
      });

      if (adobeSegment) {
        audience.adobeAssetId = adobeSegment.id;
        await audience.save();
      }

      console.log('✓ Audience created:', audience.audienceId);
      return audience;
    } catch (error) {
      console.error('Audience processing error:', error);
    }
  }

  inferAgeGroup(data) {
    const age = data.age || data.userAge;
    if (!age) return '0-2';

    if (age <= 2) return '0-2';
    if (age <= 10) return '8-10';
    if (age <= 17) return '11-17';
    return '18+';
  }

  buildSegmentPredicate(data) {
    // Build XDM-compatible predicate for AEP
    return `(profile.attributes.age >= ${data.minAge || 0}) AND (profile.attributes.age <= ${data.maxAge || 100})`;
  }

  async getAudience(audienceId) {
    // Check cache first
    const cached = await redisClient.get(`audience:${audienceId}`);
    if (cached) return JSON.parse(cached);

    return Audience.findOne({ audienceId });
  }

  async listAudiences(filters = {}) {
    return Audience.find(filters);
  }
}

const audienceAgent = new AudienceAgent();

// ==================== AGENT: CONTENT BODY ====================
class ContentAgent {
  async createContent(contentData) {
    try {
      const content = new Content({
        contentId: `content_${Date.now()}`,
        title: contentData.title,
        type: contentData.type, // teaser_video, training_video, etc.
        ageSegment: contentData.ageSegment,
        assetUrl: contentData.assetUrl,
        metadata: contentData.metadata || {},
        tags: contentData.tags || [],
        description: contentData.description,
        status: 'draft',
      });

      await content.save();

      // Cache content metadata
      await redisClient.setEx(
        `content:${content.contentId}`,
        3600,
        JSON.stringify(content)
      );

      console.log('✓ Content created:', content.contentId);
      return content;
    } catch (error) {
      console.error('Content creation error:', error);
    }
  }

  async publishContent(contentId) {
    try {
      const content = await Content.findOne({ contentId });
      if (!content) throw new Error('Content not found');

      content.status = 'published';
      await content.save();

      // Publish to Adobe AEP as asset
      // This would integrate with Adobe's DAM (Digital Asset Management)

      // Invalidate cache
      await redisClient.del(`content:${contentId}`);

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

  async listContentBySegment(ageSegment) {
    return Content.find({ ageSegment, status: 'published' });
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
  async createJourney(journeyData) {
    try {
      const journey = new Journey({
        journeyId: `journey_${Date.now()}`,
        name: journeyData.name,
        audienceId: journeyData.audienceId,
        steps: journeyData.steps || [],
        surveyEnabled: journeyData.surveyEnabled || false,
        surveyReach: journeyData.surveyReach || 0,
        surveyAnalyticsEnabled: journeyData.surveyAnalyticsEnabled || false,
        personalizedTrainingEnabled: journeyData.personalizedTrainingEnabled || false,
        registrationRequired: journeyData.registrationRequired || false,
        status: 'draft',
      });

      await journey.save();

      await redisClient.setEx(
        `journey:${journey.journeyId}`,
        3600,
        JSON.stringify(journey)
      );

      console.log('✓ Journey created:', journey.journeyId);
      return journey;
    } catch (error) {
      console.error('Journey creation error:', error);
    }
  }

  async activateJourney(journeyId) {
    try {
      const journey = await Journey.findOne({ journeyId });
      if (!journey) throw new Error('Journey not found');

      journey.status = 'active';
      await journey.save();

      // Publish to Adobe AEP
      const adobeJourney = await adobeClient.publishJourney({
        name: journey.name,
        steps: journey.steps,
      });

      if (adobeJourney) {
        journey.adobeJourneyId = adobeJourney.id;
        await journey.save();
      }

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
      const stepId = `step_${Date.now()}`;
      step.stepId = stepId;
      step.sequence = journey.steps.length + 1;

      journey.steps.push(step);
      await journey.save();

      await redisClient.del(`journey:${journeyId}`);
      return journey;
    } catch (error) {
      console.error('Journey step addition error:', error);
    }
  }

  async getJourney(journeyId) {
    const cached = await redisClient.get(`journey:${journeyId}`);
    if (cached) return JSON.parse(cached);

    return Journey.findOne({ journeyId });
  }

  async personalizeContent(journeyId, userId, userCategory) {
    try {
      const journey = await this.getJourney(journeyId);
      const audience = await audienceAgent.getAudience(journey.audienceId);

      const prompt = `
        Recommend personalized content for:
        - Journey: ${journey.name}
        - User Category: ${userCategory}
        - Audience Segment: ${audience.segment}
        - Available Steps: ${journey.steps.length}
        
        Suggest the best content sequencing and personalization strategy.
      `;

      const recommendation = await callClaudeAPI(prompt);
      return recommendation;
    } catch (error) {
      console.error('Personalization error:', error);
    }
  }
}

const journeyAgent = new JourneyAgent();

// ==================== AGENT: ANALYTICS ====================
class AnalyticsAgent {
  async trackEvent(eventData) {
    try {
      const analytics = new Analytics({
        analyticsId: `analytics_${Date.now()}`,
        journeyId: eventData.journeyId,
        audienceId: eventData.audienceId,
        contentId: eventData.contentId,
        eventType: eventData.eventType,
        userId: eventData.userId,
        userCategory: eventData.userCategory,
        data: eventData.data || {},
      });

      await analytics.save();

      // Send to Kafka for real-time processing
      await kafkaProducer.send({
        topic: 'aep-analytics-events',
        messages: [{ value: JSON.stringify(analytics) }],
      });

      console.log('✓ Event tracked:', eventData.eventType);
      return analytics;
    } catch (error) {
      console.error('Event tracking error:', error);
    }
  }

  async getFeedback(contentId, userId) {
    return Analytics.findOne({
      contentId,
      userId,
      eventType: 'feedback',
    });
  }

  async submitFeedback(contentId, userId, rating, comment) {
    try {
      const analytics = new Analytics({
        analyticsId: `feedback_${Date.now()}`,
        contentId,
        userId,
        eventType: 'feedback',
        rating,
        data: { comment },
        feedbackSent: true,
      });

      await analytics.save();

      // Generate AI recommendation based on feedback
      if (rating <= 2) {
        const recommendation = await callClaudeAPI(
          `User gave low rating (${rating}/5) on content. Feedback: ${comment}. Recommend alternative content or improvement.`
        );

        analytics.recommendation = recommendation;
        await analytics.save();
      }

      // Publish feedback to AEP for analysis
      await kafkaProducer.send({
        topic: 'aep-feedback',
        messages: [{ value: JSON.stringify(analytics) }],
      });

      console.log('✓ Feedback submitted:', contentId);
      return analytics;
    } catch (error) {
      console.error('Feedback submission error:', error);
    }
  }

  async getMetrics(journeyId, dateRange = {}) {
    try {
      const query = { journeyId };

      if (dateRange.startDate || dateRange.endDate) {
        query.timestamp = {};
        if (dateRange.startDate) query.timestamp.$gte = new Date(dateRange.startDate);
        if (dateRange.endDate) query.timestamp.$lte = new Date(dateRange.endDate);
      }

      const events = await Analytics.find(query);

      const metrics = {
        totalEvents: events.length,
        eventsByType: {},
        userEngagement: {
          uniqueUsers: new Set(events.map(e => e.userId)).size,
          averageRating: 0,
          feedbackCount: 0,
        },
      };

      let totalRating = 0;
      events.forEach(event => {
        metrics.eventsByType[event.eventType] = (metrics.eventsByType[event.eventType] || 0) + 1;

        if (event.rating) {
          totalRating += event.rating;
          metrics.userEngagement.feedbackCount++;
        }
      });

      metrics.userEngagement.averageRating = metrics.userEngagement.feedbackCount > 0
        ? totalRating / metrics.userEngagement.feedbackCount
        : 0;

      return metrics;
    } catch (error) {
      console.error('Metrics retrieval error:', error);
    }
  }

  async createExperiment(experimentData) {
    try {
      const experiment = new Experiment({
        experimentId: `exp_${Date.now()}`,
        name: experimentData.name,
        audience: experimentData.audience,
        variantA: experimentData.variantA,
        variantB: experimentData.variantB,
        startDate: experimentData.startDate,
        endDate: experimentData.endDate,
        status: 'running',
      });

      await experiment.save();
      console.log('✓ Experiment created:', experiment.experimentId);
      return experiment;
    } catch (error) {
      console.error('Experiment creation error:', error);
    }
  }
}

const analyticsAgent = new AnalyticsAgent();

// ==================== API ENDPOINTS ====================

// ORCHESTRATOR HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis: 'connected', // Simplified
      kafka: 'connected', // Simplified
    },
  });
});

// ==================== AUDIENCE ENDPOINTS ====================
app.post('/api/audiences', async (req, res) => {
  try {
    const audience = await audienceAgent.processAudienceData(req.body);
    res.json({ success: true, data: audience });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audiences/:audienceId', async (req, res) => {
  try {
    const audience = await audienceAgent.getAudience(req.params.audienceId);
    if (!audience) return res.status(404).json({ error: 'Audience not found' });
    res.json({ success: true, data: audience });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audiences', async (req, res) => {
  try {
    const audiences = await audienceAgent.listAudiences(req.query);
    res.json({ success: true, data: audiences });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/audiences/ingest-kafka', async (req, res) => {
  try {
    const topic = req.body.topic || 'audience-data';
    await audienceAgent.ingestFromKafka(topic);
    res.json({ success: true, message: 'Kafka ingestion started' });
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

app.get('/api/content/segment/:ageSegment', async (req, res) => {
  try {
    const content = await contentAgent.listContentBySegment(req.params.ageSegment);
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
    const recommendation = await journeyAgent.personalizeContent(
      req.params.journeyId,
      req.body.userId,
      req.body.userCategory
    );
    res.json({ success: true, data: recommendation });
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
      req.body.contentId,
      req.body.userId,
      req.body.rating,
      req.body.comment
    );
    res.json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/metrics/:journeyId', async (req, res) => {
  try {
    const metrics = await analyticsAgent.getMetrics(
      req.params.journeyId,
      req.query
    );
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

// ==================== ORCHESTRATOR FLOW ====================
app.post('/api/orchestrate', async (req, res) => {
  try {
    const { action, data } = req.body;

    const result = {
      action,
      timestamp: new Date(),
      steps: [],
    };

    // 1. Create audience
    if (data.audienceData) {
      const audience = await audienceAgent.processAudienceData(data.audienceData);
      result.steps.push({ name: 'audience_created', audienceId: audience.audienceId });
    }

    // 2. Create content
    if (data.contentData) {
      const content = await contentAgent.createContent(data.contentData);
      result.steps.push({ name: 'content_created', contentId: content.contentId });
    }

    // 3. Create journey
    if (data.journeyData) {
      const journey = await journeyAgent.createJourney(data.journeyData);
      result.steps.push({ name: 'journey_created', journeyId: journey.journeyId });
    }

    // 4. Track analytics
    if (data.analyticsData) {
      const analytics = await analyticsAgent.trackEvent(data.analyticsData);
      result.steps.push({ name: 'analytics_tracked', analyticsId: analytics.analyticsId });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ERROR HANDLING ====================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// ==================== SERVER STARTUP ====================
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await kafkaProducer.connect();
    app.listen(PORT, () => {
      console.log(`\n╔════════════════════════════════════════╗`);
      console.log(`║  AEP Agent Orchestrator - v1.0.0      ║`);
      console.log(`║  Server running on port ${PORT}          ║`);
      console.log(`║  MongoDB: ${MONGO_URI.substring(0, 35)}... ║`);
      console.log(`╚════════════════════════════════════════╝\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
