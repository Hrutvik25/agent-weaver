# Quick Reference Cheat Sheet

One-page reference for common operations.

---

## 🚀 Quick Start

```bash
# Clone and start
git clone <repo-url>
cd agent-weaver
docker-compose up -d

# Access
http://localhost
```

---

## 📝 Sample Inputs

### High Engagement (Score: 90)
```json
{
  "userId": "user_001",
  "event": "video_watched",
  "watchTime": 150,
  "clicked": true,
  "contentType": "course"
}
```
**Result:** `highly_engaged_users` segment

### Medium Engagement (Score: 60)
```json
{
  "userId": "user_002",
  "event": "page_view",
  "watchTime": 75,
  "clicked": false,
  "contentType": "blog"
}
```
**Result:** `potential_converters` segment

### Low Engagement (Score: 30)
```json
{
  "userId": "user_003",
  "event": "page_view",
  "watchTime": 10,
  "clicked": false,
  "contentType": "landing"
}
```
**Result:** `drop_off_users` segment

---

## 🔗 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/orchestrate` | POST | Trigger pipeline |
| `/api/audiences` | GET | List audiences |
| `/api/journeys` | GET | List journeys |
| `/api/stats` | GET | Dashboard stats |
| `/api/mcp/metrics` | GET | MCP metrics |
| `/api/mcp/audit` | GET | Audit logs |
| `/api/logs/stream` | GET | SSE logs |

---

## 🧪 Quick Tests

```bash
# Test orchestration
curl -X POST http://localhost/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"analyticsEvent": {"userId": "test", "event": "video_watched", "watchTime": 150, "clicked": true, "contentType": "course"}}'

# Check audiences
curl http://localhost/api/audiences

# Check journeys
curl http://localhost/api/journeys

# Check MCP metrics
curl http://localhost/api/mcp/metrics

# Watch live logs
curl -N http://localhost/api/logs/stream
```

---

## 🐳 Docker Commands

```bash
# Start all
docker-compose up -d

# Stop all
docker-compose down

# Restart
docker-compose restart

# View logs
docker-compose logs -f

# Rebuild
docker-compose up -d --build

# Fresh start
docker-compose down -v && docker-compose up -d
```

---

## 📊 Segmentation Rules

| Condition | Segment | Score |
|-----------|---------|-------|
| `watchTime > 100 && clicked` | highly_engaged_users | 90 |
| `watchTime > 50 || clicked` | potential_converters | 60 |
| else | drop_off_users | 30 |

---

## 🔍 Debug Commands

```bash
# Check container status
docker ps

# Backend logs
docker logs aep-orchestrator --tail 50

# Gateway logs
docker logs aep-mcp-gateway --tail 50

# MongoDB shell
docker exec -it aep-mongodb mongosh -u admin -p admin123

# Redis CLI
docker exec -it aep-redis redis-cli

# Kafka topics
docker exec aep-kafka kafka-topics --list --bootstrap-server localhost:9092
```

---

## 🌐 Access URLs

| Service | URL |
|---------|-----|
| Dashboard | http://localhost |
| MongoDB Express | http://localhost:8081 |
| Kafka UI | http://localhost:8082 |
| MCP Gateway | http://localhost:5001/health |

---

## 📦 What's Running

- **Nginx** (port 80) - Reverse proxy
- **Frontend** (8080) - React dashboard
- **Backend** (5000) - Node.js orchestrator
- **MCP Gateway** (5001) - Tool proxy
- **MongoDB** (27017) - Database
- **Redis** (6379) - Cache
- **Kafka** (9092) - Event streaming
- **Zookeeper** (2181) - Coordination
- **Salesforce MCP** (5002) - Mock API
- **ServiceNow MCP** (5003) - Mock API

---

## ✅ Success Checklist

- [ ] `docker-compose ps` shows all containers running
- [ ] `curl http://localhost/api/health` returns JSON
- [ ] Dashboard loads at http://localhost
- [ ] "Run Orchestration" shows live logs
- [ ] Audiences populate after orchestration
- [ ] Journeys appear in panel
- [ ] MCP metrics show data
- [ ] No errors in `docker-compose logs`

---

## 🆘 Common Issues

### Port 80 in use
```bash
# Change port in docker-compose.yml
nginx:
  ports:
    - "8080:80"
```

### Services not starting
```bash
# Increase Docker memory to 8GB
# Docker Desktop > Settings > Resources

# Force rebuild
docker-compose up -d --build --force-recreate
```

### MongoDB connection refused
```bash
# Wait for MongoDB to be healthy (30-60 seconds)
docker logs aep-mongodb --tail 20

# Restart backend after MongoDB is ready
docker restart aep-orchestrator
```

---

## 📚 Documentation

- **Quick Start:** [QUICKSTART.md](./QUICKSTART.md)
- **Full Guide:** [README.md](./README.md)
- **Testing:** [TESTING-GUIDE.md](./TESTING-GUIDE.md)
- **Technical:** [PROJECT-DOCUMENTATION.md](./PROJECT-DOCUMENTATION.md)
- **Installation:** [INSTALLATION-FLOW.md](./INSTALLATION-FLOW.md)

---

**Print this page for quick reference!** 📄
