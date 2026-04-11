# AEP Agent Orchestrator - Quick Start Guide

[![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)]()
[![Docker](https://img.shields.io/badge/docker-required-blue)]()
[![Node](https://img.shields.io/badge/node-18+-green)]()

A full-stack, event-driven multi-agent orchestration platform for Adobe Experience Platform (AEP) marketing workflows with MCP (Model Context Protocol) integration.

## 🚀 Quick Start (5 Minutes)

### Prerequisites

Before you begin, ensure you have installed:

- **Docker Desktop** (v20.10+) - [Download here](https://www.docker.com/products/docker-desktop)
- **Docker Compose** (v2.0+) - Usually included with Docker Desktop
- **Git** - [Download here](https://git-scm.com/downloads)

**System Requirements:**
- RAM: 8GB minimum (16GB recommended)
- Disk Space: 10GB free
- OS: Windows 10/11, macOS 10.15+, or Linux

### Step 1: Clone the Repository

```bash
git clone <your-repository-url>
cd agent-weaver
```

### Step 2: Configure Environment Variables (Optional)

The project includes example environment files. You can use them as-is for development:

```bash
# Backend environment is already configured in docker-compose.yml
# Optional: Add your Groq API key for AI features
# Edit backend/.env and add:
# GROQ_API_KEY=your_groq_api_key_here
```

**Note:** The system works without GROQ_API_KEY, but AI-powered journey personalization will be disabled.

**Important:** You do NOT need to run `npm install` - Docker handles all dependencies automatically!

### Step 3: Start All Services

```bash
docker-compose up -d
```

This command will:
- Download all required Docker images (~2-3 minutes first time)
- Build custom images for frontend, backend, gateway, and MCP servers
- Start 12 containers (Nginx, Frontend, Backend, Gateway, MongoDB, Redis, Kafka, Zookeeper, 2 MCP servers, Mongo Express, Kafka UI)
- Initialize databases and create Kafka topics

**Expected output:**
```
[+] Running 12/12
 ✔ Container aep-zookeeper     Started
 ✔ Container aep-mongodb       Healthy
 ✔ Container aep-redis         Healthy
 ✔ Container aep-kafka         Started
 ✔ Container aep-mcp-gateway   Started
 ✔ Container aep-mcp-salesforce Started
 ✔ Container aep-mcp-servicenow Started
 ✔ Container aep-orchestrator  Started
 ✔ Container aep-frontend      Started
 ✔ Container aep-nginx         Started
 ✔ Container aep-mongo-express Started
 ✔ Container aep-kafka-ui      Started
```

### Step 4: Wait for Services to be Ready

```bash
# Check all containers are running
docker-compose ps

# Watch backend logs until you see "AEP Agent Orchestrator v2.0"
docker logs aep-orchestrator -f
```

Wait for these messages:
```
✓ MongoDB connected
✓ Redis connected
✓ Kafka Producer connected
✅ AnalyticsAgent listening on topic: analytics-events
✅ AudienceAgent listening on topic: audience-segments
✅ ContentAgent listening on topic: content-recommendations
✅ JourneyAgent listening on topic: journey-triggers
```

Press `Ctrl+C` to stop watching logs.

### Step 5: Access the Application

Open your browser and navigate to:

**🎯 Main Application:** http://localhost

You should see the AEP Agent Orchestrator dashboard with:
- 4 agent cards (Audience, Content, Experiment, Journey)
- A "Run Orchestration" button
- Real-time terminal console
- Analytics panels

### Step 6: Test the System

1. **Click "Run Orchestration"** button on the dashboard
2. Watch the real-time logs in the terminal
3. Observe the pipeline progress bar (6 steps)
4. See audience segments populate
5. View journey cards appear
6. Check MCP metrics panel update

**Expected behavior:**
- Terminal shows live logs from all 4 agents
- Audience segments appear in ~3 seconds
- Journey cards populate in ~5 seconds
- MCP metrics show successful tool calls
- No errors in the console

---

## 📊 Access Additional Tools

### MongoDB Express (Database UI)
- **URL:** http://localhost:8081
- **Purpose:** View and manage MongoDB collections
- **Collections:** audiences, journeys, analyticsevents, mcpauditlogs, mcppolicies

### Kafka UI (Event Streaming)
- **URL:** http://localhost:8082
- **Purpose:** Monitor Kafka topics and messages
- **Topics:** analytics-events, audience-segments, content-recommendations, journey-triggers

### MCP Gateway (Direct Access)
- **URL:** http://localhost:5001/health
- **Metrics:** http://localhost:5001/mcp/metrics
- **Audit Logs:** http://localhost:5001/mcp/audit

---

## 🧪 Verify Installation

Run these commands to verify everything is working:

```bash
# 1. Check all containers are running
docker-compose ps

# 2. Test API endpoints
curl http://localhost/api/health
curl http://localhost/api/audiences
curl http://localhost/api/journeys
curl http://localhost/api/stats
curl http://localhost/api/mcp/metrics

# 3. Test SSE stream (press Ctrl+C to stop)
curl -N http://localhost/api/logs/stream

# 4. Trigger orchestration via API
curl -X POST http://localhost/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "analyticsEvent": {
      "userId": "test_user_123",
      "event": "video_watched",
      "watchTime": 120,
      "clicked": true,
      "contentType": "course"
    }
  }'
```

**All commands should return JSON responses without errors.**

---

## 💻 Local Development (Without Docker)

If you want to develop locally without Docker:

### Prerequisites
- Node.js 18+
- MongoDB running locally
- Redis running locally
- Kafka running locally

### Setup

```bash
# 1. Install frontend dependencies
npm install

# 2. Install backend dependencies
cd backend
npm install

# 3. Install gateway dependencies
cd gateway
npm install
cd ..

# 4. Install MCP server dependencies
cd mcp-servers/salesforce
npm install
cd ../servicenow
npm install
cd ../../..

# 5. Configure environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your local MongoDB, Redis, Kafka URLs

# 6. Start services (in separate terminals)

# Terminal 1: Start backend
cd backend
npm start

# Terminal 2: Start gateway
cd backend/gateway
node index.js

# Terminal 3: Start Salesforce MCP
cd backend/mcp-servers/salesforce
node index.js

# Terminal 4: Start ServiceNow MCP
cd backend/mcp-servers/servicenow
node index.js

# Terminal 5: Start frontend
npm run dev
```

**Note:** Docker is the recommended approach as it handles all dependencies and services automatically.

---

## 🛠️ Common Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker logs aep-orchestrator -f
docker logs aep-mcp-gateway -f
docker logs aep-nginx -f

# Last 50 lines
docker logs aep-orchestrator --tail 50
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker restart aep-orchestrator
docker restart aep-nginx

# Rebuild and restart
docker-compose up -d --build backend
```

### Stop Services

```bash
# Stop all (keeps data)
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Stop specific service
docker stop aep-orchestrator
```

### Check Service Health

```bash
# Container status
docker ps

# Backend health
curl http://localhost/api/health

# Gateway health
curl http://localhost:5001/health

# MongoDB
docker exec aep-mongodb mongosh --eval "db.adminCommand('ping')"

# Redis
docker exec aep-redis redis-cli ping
```

---

## 🐛 Troubleshooting

### Issue: Port Already in Use

**Error:** `Bind for 0.0.0.0:80 failed: port is already allocated`

**Solution:**
```bash
# Find what's using port 80
# Windows:
netstat -ano | findstr :80

# macOS/Linux:
lsof -i :80

# Stop the conflicting service or change the port in docker-compose.yml:
# nginx:
#   ports:
#     - "8080:80"  # Change to 8080
```

### Issue: Containers Keep Restarting

**Solution:**
```bash
# Check logs for errors
docker logs aep-orchestrator --tail 100

# Common fixes:
# 1. Increase Docker memory (Docker Desktop > Settings > Resources > Memory: 8GB)
# 2. Wait for MongoDB/Redis to be healthy before backend starts
# 3. Rebuild images: docker-compose up -d --build --force-recreate
```

### Issue: Frontend Shows "Cannot GET /api/..."

**Solution:**
```bash
# 1. Check Nginx is running
docker ps | grep nginx

# 2. Check backend is running
docker ps | grep orchestrator

# 3. Restart Nginx
docker restart aep-nginx

# 4. Check Nginx logs
docker logs aep-nginx --tail 50
```

### Issue: MCP Calls Failing

**Solution:**
```bash
# 1. Check gateway logs
docker logs aep-mcp-gateway -f

# 2. Verify MCP servers are running
docker ps | grep mcp

# 3. Check JWT secrets match in docker-compose.yml
# Both backend and gateway must have same AGENT_JWT_SECRET_* values

# 4. Restart gateway
docker restart aep-mcp-gateway
```

### Issue: MongoDB Connection Refused

**Solution:**
```bash
# 1. Check MongoDB is healthy
docker ps | grep mongodb

# 2. Wait for MongoDB to be ready (can take 30 seconds)
docker logs aep-mongodb --tail 20

# 3. Restart backend after MongoDB is healthy
docker restart aep-orchestrator
```

### Issue: Kafka Consumer Not Receiving Messages

**Solution:**
```bash
# 1. Check Kafka is running
docker ps | grep kafka

# 2. Check Kafka logs
docker logs aep-kafka --tail 50

# 3. Verify topics exist
docker exec aep-kafka kafka-topics --list --bootstrap-server localhost:9092

# 4. Restart Kafka consumers
docker restart aep-orchestrator
```

---

## 📁 Project Structure

```
agent-weaver/
├── backend/                 # Node.js orchestrator
│   ├── gateway/            # MCP Gateway
│   ├── mcp-servers/        # Salesforce & ServiceNow MCP
│   ├── scripts/            # Init scripts
│   └── server.js           # Main orchestrator
├── nginx/                  # Reverse proxy config
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── lib/               # API client
│   └── pages/             # Dashboard page
├── docker-compose.yml      # Service orchestration
├── README.md              # This file
└── PROJECT-DOCUMENTATION.md # Detailed docs
```

---

## 🔧 Configuration

### Environment Variables

**Backend** (configured in `docker-compose.yml`):
```yaml
NODE_ENV: production
PORT: 5000
MONGO_URI: mongodb://admin:admin123@mongodb:27017/aep-orchestrator?authSource=admin
REDIS_URL: redis://redis:6379
KAFKA_BROKERS: kafka:29092
MCP_GATEWAY_URL: http://gateway:5001
GROQ_API_KEY: <optional-for-ai-features>
AGENT_JWT_SECRET_ANALYTICS: changeme-analytics
AGENT_JWT_SECRET_AUDIENCE: changeme-audience
AGENT_JWT_SECRET_CONTENT: changeme-content
AGENT_JWT_SECRET_JOURNEY: changeme-journey
```

**Gateway** (configured in `docker-compose.yml`):
```yaml
NODE_ENV: production
PORT: 5001
MONGO_URI: mongodb://admin:admin123@mongodb:27017/aep-orchestrator?authSource=admin
REDIS_URL: redis://redis:6379
SALESFORCE_MCP_URL: mcp-salesforce:5002
SERVICENOW_MCP_URL: mcp-servicenow:5003
AGENT_JWT_SECRET_ANALYTICS: changeme-analytics
AGENT_JWT_SECRET_AUDIENCE: changeme-audience
AGENT_JWT_SECRET_CONTENT: changeme-content
AGENT_JWT_SECRET_JOURNEY: changeme-journey
```

### Ports

| Service | Port | Access |
|---------|------|--------|
| Nginx (Main) | 80 | http://localhost |
| Frontend | 8080 | Internal only |
| Backend | 5000 | Internal only |
| MCP Gateway | 5001 | http://localhost:5001 |
| MongoDB | 27017 | localhost:27017 |
| Mongo Express | 8081 | http://localhost:8081 |
| Kafka UI | 8082 | http://localhost:8082 |
| Kafka | 9092 | localhost:9092 |

---

## 🚀 Production Deployment

### Security Checklist

Before deploying to production:

- [ ] Change all JWT secrets in `docker-compose.yml`
- [ ] Change MongoDB credentials
- [ ] Add GROQ_API_KEY for AI features
- [ ] Enable HTTPS with SSL certificates
- [ ] Configure firewall rules
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure log aggregation (ELK stack)
- [ ] Set up automated backups for MongoDB
- [ ] Review and adjust rate limits in Nginx
- [ ] Enable Redis persistence
- [ ] Configure Kafka replication

### Recommended Changes

```yaml
# docker-compose.yml - Production settings
environment:
  NODE_ENV: production
  AGENT_JWT_SECRET_ANALYTICS: <generate-strong-secret>
  AGENT_JWT_SECRET_AUDIENCE: <generate-strong-secret>
  AGENT_JWT_SECRET_CONTENT: <generate-strong-secret>
  AGENT_JWT_SECRET_JOURNEY: <generate-strong-secret>
  MONGO_URI: mongodb://<user>:<strong-password>@mongodb:27017/...
```

Generate strong secrets:
```bash
# Linux/macOS
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

---

## 📚 Additional Resources

- **Detailed Documentation:** See [PROJECT-DOCUMENTATION.md](./PROJECT-DOCUMENTATION.md)
- **API Documentation:** See [backend/API-DOCUMENTATION.md](./backend/API-DOCUMENTATION.md)
- **Design Document:** See [backend/DESIGN-DOCUMENT.md](./backend/DESIGN-DOCUMENT.md)
- **Setup Guide:** See [backend/SETUP-GUIDE.md](./backend/SETUP-GUIDE.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License.

---

## 💬 Support

If you encounter issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review logs: `docker-compose logs -f`
3. Verify all containers are running: `docker-compose ps`
4. Check [PROJECT-DOCUMENTATION.md](./PROJECT-DOCUMENTATION.md) for detailed guides

---

## ✅ Success Checklist

After setup, you should be able to:

- [ ] Access dashboard at http://localhost
- [ ] Click "Run Orchestration" and see live logs
- [ ] View audience segments populate
- [ ] See journey cards appear
- [ ] Check MCP metrics panel shows data
- [ ] Access MongoDB Express at http://localhost:8081
- [ ] Access Kafka UI at http://localhost:8082
- [ ] All API endpoints return valid JSON
- [ ] No errors in container logs

**If all checkboxes are ✅, your installation is successful!**

---

**Built with ❤️ using Docker, Node.js, React, Kafka, MongoDB, and MCP**
