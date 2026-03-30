/**
 * Kafka Topics Initialization and Sample Data Producer
 * Creates required topics and seeds initial data for development
 */

const { Kafka, logLevel } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'aep-orchestrator-init',
  brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'],
  logLevel: logLevel.INFO,
});

const admin = kafka.admin();
const producer = kafka.producer();

const TOPICS = [
  {
    name: 'audience-raw-data',
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
      { name: 'cleanup.policy', value: 'delete' },
    ],
  },
  {
    name: 'aep-analytics-events',
    numPartitions: 5,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '2592000000' }, // 30 days
      { name: 'compression.type', value: 'snappy' },
    ],
  },
  {
    name: 'aep-feedback',
    numPartitions: 2,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '2592000000' }, // 30 days
    ],
  },
  {
    name: 'aep-journeys',
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
    ],
  },
  {
    name: 'aep-content-updates',
    numPartitions: 2,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
    ],
  },
  {
    name: 'aep-experiments',
    numPartitions: 1,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '7776000000' }, // 90 days
    ],
  },
];

async function initializeTopics() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Kafka Topics Initialization           ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    await admin.connect();
    console.log('✓ Connected to Kafka admin');

    // Delete existing topics (optional - for clean slate)
    const existingTopics = await admin.listTopics();
    const topicsToDelete = TOPICS.map(t => t.name).filter(t => existingTopics.includes(t));

    if (topicsToDelete.length > 0) {
      console.log(`\n⚠ Deleting existing topics: ${topicsToDelete.join(', ')}`);
      await admin.deleteTopics({
        topics: topicsToDelete,
        timeout: 30000,
      });
      console.log('✓ Topics deleted');

      // Wait for deletion to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Create topics
    console.log('\n📝 Creating topics...');
    await admin.createTopics({
      topics: TOPICS,
      validateOnly: false,
      timeout: 30000,
    });

    console.log('✓ All topics created successfully');

    // Verify topics
    const createdTopics = await admin.listTopics();
    console.log('\n✓ Verified topics:');
    TOPICS.forEach(topic => {
      if (createdTopics.includes(topic.name)) {
        console.log(`  - ${topic.name} (${topic.numPartitions} partitions)`);
      }
    });

    await admin.disconnect();
  } catch (error) {
    console.error('✗ Error initializing topics:', error.message);
    process.exit(1);
  }
}

async function seedSampleData() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Seeding Sample Data to Kafka Topics   ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    await producer.connect();
    console.log('✓ Connected to Kafka producer');

    // Sample audience data
    const audienceMessages = [
      {
        topic: 'audience-raw-data',
        messages: [
          {
            key: 'user_0001',
            value: JSON.stringify({
              userId: 'user_0001',
              age: 9,
              segment: 'school-aged',
              interests: ['math', 'science'],
              deviceType: 'tablet',
              lastActive: new Date(),
              engagementScore: 0.85,
            }),
          },
          {
            key: 'user_0002',
            value: JSON.stringify({
              userId: 'user_0002',
              age: 14,
              segment: 'teen',
              interests: ['coding', 'gaming', 'career-prep'],
              deviceType: 'mobile',
              lastActive: new Date(),
              engagementScore: 0.92,
            }),
          },
          {
            key: 'user_0003',
            value: JSON.stringify({
              userId: 'user_0003',
              age: 28,
              segment: 'adult',
              interests: ['professional-development', 'certifications'],
              deviceType: 'desktop',
              lastActive: new Date(),
              engagementScore: 0.78,
            }),
          },
        ],
      },
    ];

    // Sample analytics events
    const analyticsMessages = [
      {
        topic: 'aep-analytics-events',
        messages: [
          {
            key: 'event_0001',
            value: JSON.stringify({
              eventId: 'event_0001',
              type: 'view',
              userId: 'user_0001',
              contentId: 'content_sample_002',
              journeyId: 'journey_sample_001',
              timestamp: new Date(),
              duration: 1200,
              completionPercentage: 100,
            }),
          },
          {
            key: 'event_0002',
            value: JSON.stringify({
              eventId: 'event_0002',
              type: 'click',
              userId: 'user_0002',
              contentId: 'content_sample_003',
              journeyId: 'journey_sample_001',
              timestamp: new Date(),
              elementClicked: 'call-to-action-button',
            }),
          },
        ],
      },
    ];

    // Sample feedback
    const feedbackMessages = [
      {
        topic: 'aep-feedback',
        messages: [
          {
            key: 'feedback_0001',
            value: JSON.stringify({
              feedbackId: 'feedback_0001',
              userId: 'user_0001',
              contentId: 'content_sample_002',
              rating: 5,
              comment: 'Excellent content, very helpful!',
              timestamp: new Date(),
            }),
          },
          {
            key: 'feedback_0002',
            value: JSON.stringify({
              feedbackId: 'feedback_0002',
              userId: 'user_0002',
              contentId: 'content_sample_003',
              rating: 4,
              comment: 'Good but could have more examples',
              timestamp: new Date(),
            }),
          },
        ],
      },
    ];

    // Send all messages
    const allMessages = [...audienceMessages, ...analyticsMessages, ...feedbackMessages];

    for (const batch of allMessages) {
      console.log(`\n📤 Sending to ${batch.topic}...`);
      const result = await producer.sendBatch({
        topicMessages: [batch],
      });
      console.log(`✓ Sent ${batch.messages.length} messages`);
    }

    console.log('\n✓ All sample data seeded successfully');

    await producer.disconnect();
  } catch (error) {
    console.error('✗ Error seeding data:', error.message);
    process.exit(1);
  }
}

async function main() {
  try {
    await initializeTopics();
    await seedSampleData();

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  ✓ Kafka Setup Complete!              ║');
    console.log('╚════════════════════════════════════════╝\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
