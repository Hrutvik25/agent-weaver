# AEP Agent Orchestrator - Complete Setup & Deployment Guide

**Version**: 1.0.0  
**Status**: Production Ready  
**Last Updated**: March 29, 2026

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
4. [Configuration](#configuration)
5. [Adobe Integration](#adobe-integration)
6. [Database Setup](#database-setup)
7. [Kafka Configuration](#kafka-configuration)
8. [Deployment Options](#deployment-options)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Architecture Overview](#architecture-overview)

---

## Quick Start

### One-Command Docker Setup
```bash
# Clone repository
git clone <your-repo-url>
cd aep-orchestrator

# Copy environment template
cp .env.example .env

# Start all services with Docker Compose
docker-compose up -d

# Initialize Kafka topics
docker-compose exec app node scripts/kafka-init.js

# Initialize MongoDB
docker-compose exec mongodb mongosh < scripts/mongodb-init.js

# Verify health
curl http://localhost:5000/health
```

**Services Available After Startup**:
- Application: http://localhost:5000
- Kafka UI: http://localhost:8080
- MongoDB Express: http://localhost:8081 (admin/admin123)

---

## Prerequisites

### System Requirements
- **OS**: Linux, macOS, or Windows (WSL2)
- **Node.js**: >= 18.0.0
- **Docker**: >= 20.10.0
- **Docker Compose**: >= 2.0.0
- **RAM**: Minimum 4GB (8GB recommended)
- **Disk Space**: 10GB free

### Adobe Requirements
- Adobe Developer Console account
- Service Account credentials (Private Key, API Key, Org ID)
- Experience Platform or Real-time CDP access
- Appropriate permissions in your org

### Cloud Deployment (Optional)
- AWS/Azure/GCP account (for production)
- Container registry (ECR, ACR, or GCR)
- Database service (MongoDB Atlas, AWS DocumentDB)
- Message broker service (Confluent Cloud, AWS MSK)

---

## Local Development Setup

### Step 1: Install Node.js
```bash
# macOS (using Homebrew)
brew install node@18

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be v18.x.x
npm --version   # Should be 9.x.x or higher
```

### Step 2: Clone & Setup Repository
```bash
git clone <your-repo-url> aep-orchestrator
cd aep-orchestrator

# Install Node dependencies
npm install

# Create environment file
cp .env.example .env
```

### Step 3: Start Services with Docker Compose
```bash
# Start all services
docker-compose up -d

# Verify services are running
docker-compose ps

# Check logs
docker-compose logs -f app
```

### Step 4: Initialize Data
```bash
# Initialize MongoDB collections and indexes
docker-compose exec app node scripts/mongodb-init.js

# Initialize Kafka topics and seed sample data
docker-compose exec app node scripts/kafka-init.js

# Verify database
docker-compose exec mongodb mongosh -u admin -p admin123 --eval "use('aep-orchestrator'); db.audiences.countDocuments()"

# Verify Kafka topics
docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092
```

### Step 5: Start the Application
```bash
# Method 1: Development mode with auto-reload
npm run dev

# Method 2: Production mode
npm start

# Method 3: Using Docker
docker-compose restart app
docker-compose logs -f app
```

### Step 6: Verify Installation
```bash
# Check health
curl http://localhost:5000/health

# List audiences
curl http://localhost:5000/api/audiences

# Expected response:
# {
#   "success": true,
#   "data": [...]
# }
```

---

## Configuration

### Environment Variables Setup

Create `.env` file in root directory:

```env
# ==================== SERVER ====================
NODE_ENV=development
PORT=5000
LOG_LEVEL=debug

# ==================== DATABASE ====================
MONGO_URI=mongodb://localhost:27017/aep-orchestrator
# Or for MongoDB Atlas:
# MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/aep-orchestrator

# ==================== REDIS ====================
REDIS_URL=redis://localhost:6379
# Or for AWS ElastiCache:
# REDIS_URL=redis://endpoint:6379

# ==================== KAFKA ====================
KAFKA_BROKERS=localhost:9092
# Or for Confluent Cloud:
# KAFKA_BROKERS=pkc-xxx.us-east-1.provider.confluent.cloud:9092
# KAFKA_SASL_USERNAME=api-key
# KAFKA_SASL_PASSWORD=api-secret

# ==================== ADOBE INTEGRATION ====================
ADOBE_API_KEY=your_adobe_api_key
ADOBE_ORG_ID=your_org_id@AdobeOrg
ADOBE_TECH_ACCOUNT=your_tech_account@techacct.adobe.com
ADOBE_PRIVATE_KEY=/path/to/private.key
ADOBE_IMS_BASE_URL=https://ims-na1.adobelogin.com
ADOBE_AEP_BASE_URL=https://platform.adobe.io

# ==================== ANTHROPIC AI ====================
ANTHROPIC_API_KEY=sk-ant-your_key_here
CLAUDE_MODEL=claude-opus-4-6
CLAUDE_MAX_TOKENS=2048

# ==================== CORS ====================
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com

# ==================== FEATURES ====================
ENABLE_MOCK_ADOBE_API=false
ENABLE_KAFKA_LOGGING=true
ENABLE_DETAILED_ERRORS=true
```

### Getting Adobe Credentials

1. **Go to Adobe Developer Console**
   - https://developer.adobe.com/console
   - Sign in with your Adobe ID

2. **Create a New Project**
   - Click "Create new project"
   - Select "API"
   - Add APIs: "Experience Platform", "Real-time Customer Data Platform"

3. **Create Service Account**
   - Go to "Service Account (JWT)"
   - Click "Generate key pair"
   - Download private key (save to `private.key`)
   - Copy Public Key

4. **Get Credentials**
   - API Key: From the overview section
   - Org ID: From the URL or account settings
   - Technical Account ID: From Service Account details

5. **Update .env**
   ```bash
   ADOBE_API_KEY=your_api_key
   ADOBE_ORG_ID=your_org_id@AdobeOrg
   ADOBE_TECH_ACCOUNT=your_tech_account@techacct.adobe.com
   ADOBE_PRIVATE_KEY=/path/to/private.key
   ```

---

## Database Setup

### MongoDB Local Setup

```bash
# Start MongoDB container
docker-compose up -d mongodb

# Connect to MongoDB
docker-compose exec mongodb mongosh -u admin -p admin123

# Inside mongosh:
use('aep-orchestrator');
db.audiences.find().limit(1);
exit;
```

### MongoDB Atlas Cloud Setup

1. **Create MongoDB Atlas Account**
   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up and create a cluster

2. **Create Database User**
   - Go to Database Access
   - Click "Add New Database User"
   - Note username and password

3. **Get Connection String**
   - Go to Clusters → Connect
   - Choose "Connect your application"
   - Copy connection string
   - Replace `<username>` and `<password>`

4. **Update .env**
   ```env
   MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/aep-orchestrator
   ```

### Initialize Collections

```bash
# Run initialization script
docker-compose exec app node scripts/mongodb-init.js

# Or manually:
mongosh <private.key> -u admin -p admin123 --eval "
use('aep-orchestrator');
db.createCollection('audiences');
db.audiences.createIndex({ audienceId: 1 }, { unique: true });
"
```

---

## Kafka Configuration

### Local Kafka (Docker Compose)

Kafka automatically starts with Docker Compose. Topics are created on demand.

### Manual Topic Creation

```bash
# List existing topics
docker-compose exec kafka kafka-topics \
  --list \
  --bootstrap-server localhost:9092

# Create a topic
docker-compose exec kafka kafka-topics \
  --create \
  --topic audience-raw-data \
  --partitions 3 \
  --replication-factor 1 \
  --bootstrap-server localhost:9092

# Describe a topic
docker-compose exec kafka kafka-topics \
  --describe \
  --topic audience-raw-data \
  --bootstrap-server localhost:9092
```

### Confluent Cloud Setup

1. **Create Confluent Cloud Cluster**
   - Go to https://confluent.cloud
   - Create organization and cluster
   - Wait for provisioning

2. **Get Credentials**
   - Go to Cluster → API keys
   - Create new API key
   - Note API key and secret

3. **Update .env**
   ```env
   KAFKA_BROKERS=pkc-xxx.region.provider.confluent.cloud:9092
   KAFKA_SASL_USERNAME=your_api_key
   KAFKA_SASL_PASSWORD=your_api_secret
   ```

### Send Sample Data

```bash
# Using Kafka UI (easiest)
# Go to http://localhost:8080
# Select "audience-raw-data" topic
# Click "Produce" and send JSON message

# Using CLI:
docker-compose exec kafka kafka-console-producer \
  --broker-list localhost:9092 \
  --topic audience-raw-data \
  --property "parse.key=true" \
  --property "key.separator=:"

# Then paste:
# user_001:{"age":9,"segment":"school-aged","interests":["math"]}
```

---

## Deployment Options

### Option 1: Docker (Recommended for Quick Start)

```bash
# Build image
docker build -t aep-orchestrator:1.0.0 .

# Run container
docker run -d \
  --name aep-app \
  -p 5000:5000 \
  --env-file .env \
  aep-orchestrator:1.0.0

# View logs
docker logs -f aep-app

# Stop container
docker stop aep-app
```

### Option 2: Kubernetes

```bash
# Create namespace
kubectl create namespace aep

# Create ConfigMap for environment
kubectl create configmap aep-config \
  --from-env-file=.env \
  -n aep

# Deploy using Helm
helm install aep-orchestrator ./helm-chart \
  -n aep \
  --values values.yaml

# Check deployment
kubectl get pods -n aep
kubectl logs -f deployment/aep-orchestrator -n aep
```

### Option 3: AWS ECS

```bash
# Create ECR repository
aws ecr create-repository --repository-name aep-orchestrator

# Build and push image
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.us-east-1.amazonaws.com

docker tag aep-orchestrator:latest \
  123456789.dkr.ecr.us-east-1.amazonaws.com/aep-orchestrator:latest

docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/aep-orchestrator:latest

# Create ECS task definition (see ecs-task-definition.json)
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json

# Create and run service
aws ecs create-service \
  --cluster aep-cluster \
  --service-name aep-orchestrator \
  --task-definition aep-orchestrator \
  --desired-count 3 \
  --launch-type FARGATE
```

### Option 4: Heroku

```bash
# Install Heroku CLI
npm i -g heroku

# Login to Heroku
heroku login

# Create app
heroku create aep-orchestrator

# Set environment variables
heroku config:set MONGO_URI=mongodb+srv://...
heroku config:set ADOBE_API_KEY=...
heroku config:set ANTHROPIC_API_KEY=...

# Deploy
git push heroku main

# View logs
heroku logs -t
```

### Option 5: Azure Container Instances

```bash
# Build and push to ACR
az acr build \
  --registry myregistry \
  --image aep-orchestrator:latest .

# Deploy container instance
az container create \
  --resource-group mygroup \
  --name aep-orchestrator \
  --image myregistry.azurecr.io/aep-orchestrator:latest \
  --cpu 2 --memory 4 \
  --ports 5000 \
  --environment-variables \
    NODE_ENV=production \
    MONGO_URI=$MONGO_URI \
  --registry-login-server myregistry.azurecr.io \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD
```

---

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode (auto-rerun on changes)
npm test -- --watch
```

### API Testing with cURL

```bash
# Health check
curl http://localhost:5000/health

# Create audience
curl -X POST http://localhost:5000/api/audiences \
  -H "Content-Type: application/json" \
  -d '{
    "segment": "school-aged",
    "age": 9,
    "interests": ["math", "science"]
  }'

# Get audiences
curl http://localhost:5000/api/audiences

# Create content
curl -X POST http://localhost:5000/api/content \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Math Course",
    "type": "training_video",
    "ageSegment": "8-10yrs",
    "assetUrl": "https://example.com/video.mp4",
    "tags": ["math", "learning"]
  }'

# Create journey
curl -X POST http://localhost:5000/api/journeys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Math Journey",
    "audienceId": "aud_1711768800000",
    "steps": []
  }'

# Track event
curl -X POST http://localhost:5000/api/analytics/events \
  -H "Content-Type: application/json" \
  -d '{
    "journeyId": "journey_1711768800000",
    "audienceId": "aud_1711768800000",
    "contentId": "content_1711768800000",
    "eventType": "view",
    "userId": "user_123",
    "userCategory": "8-10yrs"
  }'
```

### Load Testing

```bash
# Install k6
brew install k6  # macOS
# or
sudo apt-get install k6  # Ubuntu

# Run load test
k6 run load-test.js

# Sample load-test.js:
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  let res = http.get('http://localhost:5000/health');
  check(res, { 'status was 200': (r) => r.status == 200 });
}
```

---

## Troubleshooting

### Connection Issues

**MongoDB Connection Refused**
```bash
# Check if MongoDB is running
docker-compose ps | grep mongodb

# Restart MongoDB
docker-compose restart mongodb

# Check logs
docker-compose logs mongodb
```

**Kafka Connection Failed**
```bash
# Verify Kafka is running
docker-compose ps | grep kafka

# Check Zookeeper
docker-compose logs zookeeper

# Restart Kafka
docker-compose restart kafka zookeeper
```

**Redis Connection Error**
```bash
# Check Redis
docker-compose ps | grep redis

# Test connection
docker-compose exec redis redis-cli ping

# Should return: PONG
```

### Port Conflicts

```bash
# Find what's using port 5000
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or use different port
PORT=5001 npm start
```

### Environment Variable Issues

```bash
# Verify .env is loaded
npm start 2>&1 | grep "MONGO_URI"

# Debug: Print all env vars
node -e "console.log(process.env)" | grep -i mongo

# Manually set variables
export MONGO_URI="mongodb://localhost:27017/aep-orchestrator"
npm start
```

### API Rate Limiting

```bash
# Clear rate limit cache (if using Redis)
docker-compose exec redis redis-cli FLUSHDB
```

### Adobe Authentication Failures

```bash
# Verify credentials
echo $ADOBE_API_KEY
echo $ADOBE_ORG_ID

# Test token generation (requires JWT library)
node scripts/test-adobe-token.js

# Check Adobe API status
curl https://status.adobe.io
```

### Memory Issues

```bash
# Increase Node memory limit
NODE_OPTIONS=--max-old-space-size=4096 npm start

# Or in Docker
docker run -e NODE_OPTIONS="--max-old-space-size=4096" aep-orchestrator
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend                           │
│                  (Dashboard.jsx)                            │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
┌────────────────────────▼────────────────────────────────────┐
│         Express.js Backend Server (server.js)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Orchestrator Core                                   │   │
│  │  ├─ Audience Agent    → Kafka Consumers              │   │
│  │  ├─ Content Agent     → Asset Management             │   │
│  │  ├─ Journey Agent     → Orchestration Logic          │   │
│  │  └─ Analytics Agent   → Event Tracking               │   │
│  └──────────────────────────────────────────────────────┘   │
└──┬──────────────┬──────────────┬──────────────┬──────────────┘
   │              │              │              │
   │ Kafka        │ Redis        │ MongoDB      │ Adobe API
   │              │              │              │
┌──▼──┐        ┌──▼──┐        ┌──▼──┐        ┌──▼──────┐
│Kafka│        │Cache│        │Data │        │  AEP/   │
│ Flow│        │Layer│        │Layer│        │ Real-   │
│     │        │     │        │     │        │ time    │
└─────┘        └─────┘        └─────┘        │  CDP    │
               │Caching│        │MongoDB│     └─────────┘
               │Querying│       │Indexing│
```

### Data Flow
1. **User Input** → React Frontend
2. **API Request** → Express Server
3. **Agent Processing** → Four Specialized Agents
4. **Data Persistence** → MongoDB
5. **Real-time Caching** → Redis
6. **Event Streaming** → Kafka Topics
7. **Adobe Integration** → Experience Platform
8. **Analytics** → Metrics & Insights

---

## Support & Documentation

- **API Docs**: [API-DOCUMENTATION.md](./API-DOCUMENTATION.md)
- **Architecture**: See diagrams above
- **Scripts**: `./scripts/` directory
- **Examples**: Check test files in `./tests/`

### Getting Help

1. Check logs: `docker-compose logs -f`
2. Read API documentation
3. Review example requests in this guide
4. Check troubleshooting section above

---

**Ready to deploy!** 🚀

For Adobe deployment with your credentials, ensure you have:
- ✅ Adobe API Key
- ✅ Adobe Org ID
- ✅ Technical Account ID
- ✅ Private Key file
- ✅ Adobe Experience Platform/Real-time CDP access
