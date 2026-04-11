# Installation Flow - What Happens Behind the Scenes

This document explains what happens when you run `docker-compose up -d` or the start scripts.

---

## Visual Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  YOU RUN: docker-compose up -d                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Docker Reads docker-compose.yml                        │
│  - Identifies 12 services to start                              │
│  - Checks which images need to be built                         │
│  - Creates Docker network: aep-network                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Build Custom Images (First Time Only)                  │
│                                                                  │
│  Frontend Image:                                                │
│  ├─ FROM node:18-alpine                                         │
│  ├─ COPY package*.json                                          │
│  ├─ RUN npm ci                          ← npm install here!     │
│  ├─ COPY source code                                            │
│  └─ RUN npm run build                                           │
│                                                                  │
│  Backend Image:                                                 │
│  ├─ FROM node:18-alpine                                         │
│  ├─ COPY package*.json                                          │
│  ├─ RUN npm ci --only=production        ← npm install here!     │
│  ├─ COPY server.js, gateway/, scripts/                          │
│  └─ Ready to run                                                │
│                                                                  │
│  Gateway Image:                                                 │
│  ├─ FROM node:20-alpine                                         │
│  ├─ COPY package.json                                           │
│  ├─ RUN npm install --omit=dev          ← npm install here!     │
│  ├─ COPY gateway code                                           │
│  └─ Ready to run                                                │
│                                                                  │
│  MCP Servers (Salesforce & ServiceNow):                         │
│  ├─ FROM node:20-alpine                                         │
│  ├─ COPY package.json                                           │
│  ├─ RUN npm install --omit=dev          ← npm install here!     │
│  ├─ COPY MCP server code                                        │
│  └─ Ready to run                                                │
│                                                                  │
│  Nginx Image:                                                   │
│  ├─ FROM nginx:1.25-alpine                                      │
│  ├─ COPY nginx.conf                                             │
│  ├─ COPY conf.d/                                                │
│  └─ Ready to run                                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Pull Pre-built Images                                  │
│  ├─ MongoDB 6.0                                                 │
│  ├─ Redis 7-alpine                                              │
│  ├─ Kafka 7.5.0                                                 │
│  ├─ Zookeeper 7.5.0                                             │
│  ├─ Mongo Express                                               │
│  └─ Kafka UI                                                    │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Start Infrastructure Services (Order Matters!)         │
│                                                                  │
│  1. Zookeeper (port 2181)                                       │
│     └─ Kafka needs this for coordination                        │
│                                                                  │
│  2. MongoDB (port 27017)                                        │
│     ├─ Runs init script: mongodb-init.js                        │
│     ├─ Creates database: aep-orchestrator                       │
│     ├─ Creates user: admin                                      │
│     └─ Waits for health check                                   │
│                                                                  │
│  3. Redis (port 6379)                                           │
│     └─ Waits for health check                                   │
│                                                                  │
│  4. Kafka (port 9092)                                           │
│     ├─ Connects to Zookeeper                                    │
│     ├─ Auto-creates topics:                                     │
│     │  ├─ analytics-events                                      │
│     │  ├─ audience-segments                                     │
│     │  ├─ content-recommendations                               │
│     │  └─ journey-triggers                                      │
│     └─ Waits for health check                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Start Application Services                             │
│                                                                  │
│  1. MCP Salesforce (port 5002)                                  │
│     ├─ Starts Express server                                    │
│     ├─ Registers tools:                                         │
│     │  ├─ salesforce.getLeads                                   │
│     │  ├─ salesforce.getCases                                   │
│     │  └─ salesforce.getOpportunities                           │
│     └─ Ready to receive requests                                │
│                                                                  │
│  2. MCP ServiceNow (port 5003)                                  │
│     ├─ Starts Express server                                    │
│     ├─ Registers tools:                                         │
│     │  └─ servicenow.getChangeRequests                          │
│     └─ Ready to receive requests                                │
│                                                                  │
│  3. MCP Gateway (port 5001)                                     │
│     ├─ Connects to MongoDB (waits for healthy)                  │
│     ├─ Connects to Redis (waits for healthy)                    │
│     ├─ Seeds default policies for 4 agents                      │
│     ├─ Starts Express server                                    │
│     └─ Ready to proxy MCP requests                              │
│                                                                  │
│  4. Backend Orchestrator (port 5000)                            │
│     ├─ Connects to MongoDB (waits for healthy)                  │
│     ├─ Connects to Redis (waits for healthy)                    │
│     ├─ Connects to Kafka Producer                               │
│     ├─ Starts 4 Kafka Consumers:                                │
│     │  ├─ AnalyticsAgent → analytics-events                     │
│     │  ├─ AudienceAgent → audience-segments                     │
│     │  ├─ ContentAgent → content-recommendations                │
│     │  └─ JourneyAgent → journey-triggers                       │
│     ├─ Starts Express server                                    │
│     ├─ Starts SSE log broadcaster                               │
│     └─ Ready to orchestrate                                     │
│                                                                  │
│  5. Frontend (port 8080)                                        │
│     ├─ Serves pre-built React app                               │
│     ├─ Nginx serves static files                                │
│     └─ Ready to display dashboard                               │
│                                                                  │
│  6. Nginx (port 80)                                             │
│     ├─ Loads configuration                                      │
│     ├─ Sets up upstream backends                                │
│     ├─ Configures rate limiting                                 │
│     ├─ Applies security headers                                 │
│     └─ Ready to proxy requests                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: Start Monitoring Tools (Optional)                      │
│                                                                  │
│  1. Mongo Express (port 8081)                                   │
│     ├─ Connects to MongoDB                                      │
│     └─ Web UI ready                                             │
│                                                                  │
│  2. Kafka UI (port 8082)                                        │
│     ├─ Connects to Kafka                                        │
│     └─ Web UI ready                                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  ✅ ALL SERVICES RUNNING!                                       │
│                                                                  │
│  You can now access:                                            │
│  - http://localhost (Main Dashboard)                            │
│  - http://localhost:8081 (MongoDB Express)                      │
│  - http://localhost:8082 (Kafka UI)                             │
│  - http://localhost:5001/health (MCP Gateway)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Time Breakdown

### First Run (with image building):
- **Download base images:** 1-2 minutes
- **Build custom images:** 2-3 minutes
- **Start services:** 30-60 seconds
- **Total:** ~5 minutes

### Subsequent Runs (images cached):
- **Start services:** 30-60 seconds
- **Total:** ~1 minute

---

## What Gets Installed (npm packages)

### Frontend (`package.json`):
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "axios": "^1.7.9",
    "recharts": "^2.15.0",
    "@radix-ui/*": "Various UI components",
    "tailwindcss": "^3.4.17"
  }
}
```

### Backend (`backend/package.json`):
```json
{
  "dependencies": {
    "express": "^4.21.2",
    "mongoose": "^8.9.3",
    "redis": "^4.7.0",
    "kafkajs": "^2.2.4",
    "axios": "^1.7.9",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7"
  }
}
```

### Gateway (`backend/gateway/package.json`):
```json
{
  "dependencies": {
    "express": "^4.21.2",
    "mongoose": "^8.9.3",
    "redis": "^4.7.0",
    "jsonwebtoken": "^9.0.2",
    "axios": "^1.7.9",
    "uuid": "^11.0.5",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7"
  }
}
```

### MCP Servers (`backend/mcp-servers/*/package.json`):
```json
{
  "dependencies": {
    "express": "^4.21.2",
    "cors": "^2.8.5"
  }
}
```

**Total npm packages installed:** ~200+ (including dependencies)

---

## Docker Image Sizes

| Image | Size | Purpose |
|-------|------|---------|
| agent-weaver-frontend | ~150MB | React app |
| agent-weaver-backend | ~200MB | Node.js orchestrator |
| agent-weaver-gateway | ~180MB | MCP Gateway |
| agent-weaver-nginx | ~25MB | Reverse proxy |
| mongo:6.0 | ~700MB | Database |
| redis:7-alpine | ~30MB | Cache |
| kafka:7.5.0 | ~800MB | Event streaming |
| zookeeper:7.5.0 | ~800MB | Coordination |

**Total disk usage:** ~3-4GB

---

## Network Communication

```
Browser (Port 80)
    │
    ├─ GET / → Nginx → Frontend (8080)
    │
    ├─ GET /api/* → Nginx → Backend (5000)
    │   │
    │   ├─ MongoDB (27017)
    │   ├─ Redis (6379)
    │   ├─ Kafka (29092)
    │   └─ MCP Gateway (5001)
    │       │
    │       ├─ Salesforce MCP (5002)
    │       └─ ServiceNow MCP (5003)
    │
    └─ GET /api/mcp/* → Nginx → MCP Gateway (5001)
```

---

## Environment Variables Flow

```
docker-compose.yml
    │
    ├─ Backend Container
    │   ├─ NODE_ENV=production
    │   ├─ MONGO_URI=mongodb://admin:admin123@mongodb:27017/...
    │   ├─ REDIS_URL=redis://redis:6379
    │   ├─ KAFKA_BROKERS=kafka:29092
    │   ├─ MCP_GATEWAY_URL=http://gateway:5001
    │   └─ AGENT_JWT_SECRET_*=changeme-*
    │
    └─ Gateway Container
        ├─ NODE_ENV=production
        ├─ MONGO_URI=mongodb://admin:admin123@mongodb:27017/...
        ├─ REDIS_URL=redis://redis:6379
        ├─ SALESFORCE_MCP_URL=mcp-salesforce:5002
        ├─ SERVICENOW_MCP_URL=mcp-servicenow:5003
        └─ AGENT_JWT_SECRET_*=changeme-*
```

---

## Key Takeaways

✅ **No manual npm install needed** - Docker handles it  
✅ **No Node.js installation needed** - Included in containers  
✅ **No database setup needed** - MongoDB auto-initializes  
✅ **No Kafka configuration needed** - Topics auto-create  
✅ **Just run `docker-compose up -d`** - Everything else is automatic  

---

## Troubleshooting Build Issues

### Issue: npm install fails during build

**Cause:** Network issues or npm registry down

**Solution:**
```bash
# Retry build
docker-compose build --no-cache

# Or use different npm registry
docker-compose build --build-arg NPM_REGISTRY=https://registry.npmmirror.com
```

### Issue: Build takes too long

**Cause:** Slow internet or limited CPU

**Solution:**
```bash
# Build with more resources
# Docker Desktop > Settings > Resources
# - CPUs: 4+
# - Memory: 8GB+
# - Swap: 2GB+
```

### Issue: Out of disk space

**Cause:** Too many old Docker images

**Solution:**
```bash
# Clean up old images
docker system prune -a

# Remove unused volumes
docker volume prune
```

---

**Remember:** Docker does all the heavy lifting. You just need to run one command! 🚀
