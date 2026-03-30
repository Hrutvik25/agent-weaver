// MongoDB initialization script for AEP Agent Orchestrator
// Run this after MongoDB container starts to set up collections and indexes

db = db.getSiblingDB('aep-orchestrator');

// ==================== COLLECTIONS CREATION ====================

// Create Audiences collection with indexes
db.createCollection('audiences');
db.audiences.createIndex({ audienceId: 1 }, { unique: true });
db.audiences.createIndex({ status: 1 });
db.audiences.createIndex({ userCategory: 1 });
db.audiences.createIndex({ createdAt: 1 });
db.audiences.createIndex({ adobeAssetId: 1 }, { sparse: true });

// Create Content collection with indexes
db.createCollection('contents');
db.contents.createIndex({ contentId: 1 }, { unique: true });
db.contents.createIndex({ type: 1 });
db.contents.createIndex({ ageSegment: 1 });
db.contents.createIndex({ status: 1 });
db.contents.createIndex({ tags: 1 });
db.contents.createIndex({ createdAt: 1 });
db.contents.createIndex({ adobeAssetId: 1 }, { sparse: true });

// Create Journeys collection with indexes
db.createCollection('journeys');
db.journeys.createIndex({ journeyId: 1 }, { unique: true });
db.journeys.createIndex({ audienceId: 1 });
db.journeys.createIndex({ status: 1 });
db.journeys.createIndex({ createdAt: 1 });
db.journeys.createIndex({ adobeJourneyId: 1 }, { sparse: true });

// Create Analytics collection with indexes
db.createCollection('analytics');
db.analytics.createIndex({ analyticsId: 1 }, { unique: true });
db.analytics.createIndex({ journeyId: 1 });
db.analytics.createIndex({ contentId: 1 });
db.analytics.createIndex({ userId: 1 });
db.analytics.createIndex({ eventType: 1 });
db.analytics.createIndex({ timestamp: 1 });
db.analytics.createIndex({ userCategory: 1 });
// TTL index: auto-delete old analytics after 90 days
db.analytics.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

// Create Experiments collection with indexes
db.createCollection('experiments');
db.experiments.createIndex({ experimentId: 1 }, { unique: true });
db.experiments.createIndex({ audience: 1 });
db.experiments.createIndex({ status: 1 });
db.experiments.createIndex({ createdAt: 1 });

// Create audit log collection
db.createCollection('audit_logs');
db.audit_logs.createIndex({ timestamp: 1 });
db.audit_logs.createIndex({ action: 1 });
db.audit_logs.createIndex({ userId: 1 });
// TTL index: auto-delete old logs after 1 year
db.audit_logs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

// ==================== SAMPLE DATA ====================

// Sample Audiences
db.audiences.insertMany([
  {
    audienceId: "aud_sample_001",
    name: "Young Learners (0-2 years)",
    segment: "infant-toddler",
    userCategory: "0-2yrs",
    size: 15000,
    attributes: {
      language: ["en", "es", "fr"],
      deviceType: ["mobile", "tablet"],
      interests: ["early-learning", "parent-resources"]
    },
    createdFrom: "raw_data",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    audienceId: "aud_sample_002",
    name: "School Age (8-10 years)",
    segment: "school-aged",
    userCategory: "8-10yrs",
    size: 45000,
    attributes: {
      language: ["en", "es"],
      deviceType: ["tablet", "desktop"],
      interests: ["educational-content", "interactive-learning", "gaming"]
    },
    createdFrom: "raw_data",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    audienceId: "aud_sample_003",
    name: "Teens (11-17 years)",
    segment: "teen",
    userCategory: "11-17yrs",
    size: 62000,
    attributes: {
      language: ["en"],
      deviceType: ["mobile", "desktop"],
      interests: ["skill-building", "career-prep", "social-learning"]
    },
    createdFrom: "raw_data",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    audienceId: "aud_sample_004",
    name: "Adults (18+ years)",
    segment: "adult",
    userCategory: "18+",
    size: 120000,
    attributes: {
      language: ["en", "es", "fr"],
      deviceType: ["mobile", "desktop", "web"],
      interests: ["professional-development", "certifications", "advanced-training"]
    },
    createdFrom: "raw_data",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Sample Content
db.contents.insertMany([
  {
    contentId: "content_sample_001",
    title: "ABC Learning - Teaser",
    type: "teaser_video",
    ageSegment: "0-2yrs",
    assetUrl: "https://assets.example.com/teaser-abc.mp4",
    metadata: {
      duration: 30,
      fileSize: 5242880,
      format: "video/mp4",
      author: "Learning Team"
    },
    tags: ["learning", "alphabet", "teaser", "infants"],
    description: "Introduction to alphabet learning for infants",
    status: "published",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    contentId: "content_sample_002",
    title: "Math Fundamentals - Training Video",
    type: "training_video",
    ageSegment: "8-10yrs",
    assetUrl: "https://assets.example.com/training-math.mp4",
    metadata: {
      duration: 1200,
      fileSize: 314572800,
      format: "video/mp4",
      author: "Education Department"
    },
    tags: ["math", "training", "school-age", "fundamentals"],
    description: "Comprehensive training on basic mathematics",
    status: "published",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    contentId: "content_sample_003",
    title: "Career Pathways - PDF Guide",
    type: "pdf",
    ageSegment: "11-17yrs",
    assetUrl: "https://assets.example.com/career-guide.pdf",
    metadata: {
      fileSize: 10485760,
      format: "application/pdf",
      author: "Career Services"
    },
    tags: ["career", "guidance", "teens", "pathways"],
    description: "Guide to exploring different career pathways",
    status: "published",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    contentId: "content_sample_004",
    title: "Professional Development - Certification Exam",
    type: "exam",
    ageSegment: "18+",
    assetUrl: "https://platform.example.com/exams/prof-cert",
    metadata: {
      format: "web-based",
      author: "Certification Board"
    },
    tags: ["certification", "professional", "exam", "adults"],
    description: "Professional certification examination",
    status: "published",
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Sample Journey
db.journeys.insertMany([
  {
    journeyId: "journey_sample_001",
    name: "Complete Learning Path - School Age",
    audienceId: "aud_sample_002",
    steps: [
      {
        stepId: "step_001",
        sequence: 1,
        type: "content_delivery",
        contentId: "content_sample_002",
        condition: { minAge: 8, maxAge: 10 },
        waitTime: 0,
        actionOnEvent: "progress_to_next"
      },
      {
        stepId: "step_002",
        sequence: 2,
        type: "survey",
        condition: { previousStepCompleted: true },
        waitTime: 86400,
        actionOnEvent: "record_feedback"
      },
      {
        stepId: "step_003",
        sequence: 3,
        type: "personalized_training",
        condition: { feedbackProvided: true },
        waitTime: 0,
        actionOnEvent: "deliver_personalized_content"
      }
    ],
    surveyEnabled: true,
    surveyReach: 25000,
    surveyAnalyticsEnabled: true,
    personalizedTrainingEnabled: true,
    registrationRequired: false,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Sample Analytics Events
db.analytics.insertMany([
  {
    analyticsId: "analytics_sample_001",
    journeyId: "journey_sample_001",
    audienceId: "aud_sample_002",
    contentId: "content_sample_002",
    eventType: "view",
    userId: "user_12345",
    userCategory: "8-10yrs",
    data: { viewDuration: 1200, completionPercentage: 100 },
    timestamp: new Date(),
    experimentationEnabled: true,
    customTrainingRecommended: false,
    feedbackSent: false
  },
  {
    analyticsId: "analytics_sample_002",
    journeyId: "journey_sample_001",
    audienceId: "aud_sample_002",
    contentId: "content_sample_002",
    eventType: "feedback",
    userId: "user_12345",
    userCategory: "8-10yrs",
    data: { comment: "Great content, very engaging!" },
    timestamp: new Date(),
    experimentationEnabled: true,
    customTrainingRecommended: true,
    feedbackSent: true,
    rating: 5,
    recommendation: "Recommend advanced math track"
  }
]);

// Sample Experiment
db.experiments.insertMany([
  {
    experimentId: "exp_sample_001",
    name: "Video vs. Text Content - School Age",
    audience: "aud_sample_002",
    variantA: {
      contentId: "content_sample_002",
      trafficAllocation: 50
    },
    variantB: {
      contentId: "content_sample_003",
      trafficAllocation: 50
    },
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    metrics: {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      engagementRate: 0
    },
    status: "running",
    createdAt: new Date()
  }
]);

// Log initialization
print("✓ AEP Orchestrator MongoDB initialized successfully!");
print("✓ Collections created: audiences, contents, journeys, analytics, experiments, audit_logs");
print("✓ Sample data inserted for testing");
print("✓ Indexes created for optimal query performance");
