# 🚀 Quick Start - 3 Simple Steps

Get the AEP Agent Orchestrator running in under 5 minutes!

---

## Prerequisites

✅ **Docker Desktop** installed and running  
✅ **8GB RAM** available  
✅ **10GB disk space** free

[Download Docker Desktop](https://www.docker.com/products/docker-desktop) if you don't have it.

---

## Option 1: Automated Start (Recommended)

### Windows:
```cmd
start.bat
```

### macOS/Linux:
```bash
chmod +x start.sh
./start.sh
```

The script will:
- ✅ Check Docker is installed
- ✅ Stop any existing containers
- ✅ Start all 12 services
- ✅ Wait for everything to be ready
- ✅ Show you access URLs

**Wait for:** "All services are running!" message

---

## Option 2: Manual Start

```bash
# 1. Start all services
docker-compose up -d

# 2. Wait 30-60 seconds for services to initialize

# 3. Check status
docker-compose ps
```

---

## Access the Application

Open your browser: **http://localhost**

You should see:
- 🎯 Dashboard with 4 agent cards
- 🖥️ Real-time terminal console
- 📊 Analytics panels
- ▶️ "Run Orchestration" button

---

## Test It Works

### In the Browser:
1. Click **"Run Orchestration"** button
2. Watch real-time logs appear in terminal
3. See audience segments populate (~3 seconds)
4. View journey cards appear (~5 seconds)
5. Check MCP metrics panel update

### From Command Line:
```bash
# Test API endpoints
curl http://localhost/api/health
curl http://localhost/api/audiences
curl http://localhost/api/journeys
curl http://localhost/api/mcp/metrics
```

All should return JSON responses ✅

---

## Additional Tools

| Tool | URL | Purpose |
|------|-----|---------|
| **Main Dashboard** | http://localhost | Agent orchestration UI |
| **MongoDB Express** | http://localhost:8081 | Database viewer |
| **Kafka UI** | http://localhost:8082 | Event stream monitor |
| **MCP Gateway** | http://localhost:5001/health | Gateway health |

---

## Common Commands

```bash
# View all logs
docker-compose logs -f

# View backend logs only
docker logs aep-orchestrator -f

# Restart everything
docker-compose restart

# Stop everything
docker-compose down

# Stop and remove all data (fresh start)
docker-compose down -v
```

---

## Troubleshooting

### Port 80 Already in Use?

**Windows:**
```cmd
netstat -ano | findstr :80
```

**macOS/Linux:**
```bash
lsof -i :80
```

Stop the conflicting service or change port in `docker-compose.yml`:
```yaml
nginx:
  ports:
    - "8080:80"  # Use port 8080 instead
```

Then access at: http://localhost:8080

### Services Not Starting?

```bash
# Check Docker has enough memory (8GB recommended)
# Docker Desktop > Settings > Resources > Memory

# View error logs
docker-compose logs

# Force rebuild
docker-compose up -d --build --force-recreate
```

### Still Having Issues?

See detailed troubleshooting in [README.md](./README.md#-troubleshooting)

---

## What's Running?

After successful start, you'll have:

- ✅ **Nginx** - Reverse proxy (port 80)
- ✅ **Frontend** - React dashboard
- ✅ **Backend** - Node.js orchestrator with 4 agents
- ✅ **MCP Gateway** - Secure tool proxy
- ✅ **MongoDB** - Database
- ✅ **Redis** - Cache & metrics
- ✅ **Kafka** - Event streaming
- ✅ **Zookeeper** - Kafka coordination
- ✅ **Salesforce MCP** - Mock Salesforce API
- ✅ **ServiceNow MCP** - Mock ServiceNow API
- ✅ **Mongo Express** - Database UI
- ✅ **Kafka UI** - Event stream UI

---

## Next Steps

1. ✅ **Test the orchestration** - Click "Run Orchestration" and watch it work
2. 📚 **Read the docs** - See [README.md](./README.md) for detailed guide
3. 🔧 **Explore the code** - Check out the architecture
4. 🚀 **Customize** - Add your own agents or MCP integrations

---

## Success Checklist

- [ ] Dashboard loads at http://localhost
- [ ] "Run Orchestration" shows live logs
- [ ] Audience segments appear
- [ ] Journey cards populate
- [ ] MCP metrics show data
- [ ] No errors in logs

**All checked? You're ready to go! 🎉**

---

## Frequently Asked Questions

### Do I need to run `npm install`?

**No!** Docker handles all dependencies automatically. When you run `docker-compose up -d`, it:
- Installs all npm packages inside containers
- Sets up all services
- Configures everything for you

You only need `npm install` if you're developing **outside Docker** (not recommended for beginners).

### Do I need Node.js installed?

**No!** Docker includes Node.js in the containers. You only need:
- Docker Desktop
- Git (to clone the repo)

### How much disk space do I need?

- **First run:** ~5GB (downloads Docker images)
- **After setup:** ~3GB (running containers)
- **Total recommended:** 10GB free space

### Can I use a different port than 80?

Yes! Edit `docker-compose.yml`:
```yaml
nginx:
  ports:
    - "8080:80"  # Change 80 to any port
```

Then access at: http://localhost:8080

### How do I stop everything?

```bash
docker-compose down
```

To also remove all data (fresh start):
```bash
docker-compose down -v
```

---

## Need Help?

- 📖 **Full Documentation:** [README.md](./README.md)
- 📋 **Detailed Guide:** [PROJECT-DOCUMENTATION.md](./PROJECT-DOCUMENTATION.md)
- 🐛 **Troubleshooting:** [README.md#troubleshooting](./README.md#-troubleshooting)
- 📝 **View Logs:** `docker-compose logs -f`

---

**Time to first orchestration: ~5 minutes** ⚡
