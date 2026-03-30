# React + Node.js + Nginx API Gateway — Master Setup Prompt

## Architecture Overview

```
Browser
  └─► Nginx (port 80)          ← API Gateway: routing, rate limiting, security headers
        ├─► /api/*  → Node.js backend (port 5000, internal)
        └─► /*      → React frontend (port 8080, internal)
```

All services communicate on an internal Docker network. Only Nginx is exposed externally.

---

## Technology Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React 18, Vite, TypeScript, TanStack Query |
| API Gateway | Nginx 1.25 (Alpine)               |
| Backend     | Node.js 18, Express               |
| Database    | MongoDB 6                         |
| Cache       | Redis 7                           |
| Messaging   | Kafka (Confluent 7.5)             |
| Container   | Docker + Docker Compose           |

---

## File Structure

```
/
├── docker-compose.yml          ← Root orchestration (all services)
├── Dockerfile                  ← React frontend image
├── vite.config.ts              ← Dev proxy: /api → localhost:5000
├── .env.example                ← Frontend env template
├── src/
│   ├── lib/api.ts              ← Axios client + typed API helpers
│   └── hooks/use-api.ts        ← Generic useApi hook
├── nginx/
│   ├── Dockerfile
│   ├── nginx.conf              ← Worker/event config, upstreams, rate limit zones
│   └── conf.d/
│       └── api-gateway.conf    ← Route rules, CORS, security headers
└── backend/
    ├── Dockerfile
    ├── server.js               ← Express app (agents: Audience, Content, Journey, Analytics)
    ├── .env                    ← Runtime secrets (git-ignored)
    └── .env.example            ← Template
```

---

## Quick Start

### Docker (production-like)
```bash
# Build and start all services
docker compose up --build

# App:          http://localhost
# API:          http://localhost/api/
# Health:       http://localhost/health
# Kafka UI:     http://localhost:8082
# Mongo UI:     http://localhost:8081
```

### Local development (no Docker)
```bash
# Terminal 1 — backend
cd backend && npm install && npm run dev

# Terminal 2 — frontend (Vite proxies /api to localhost:5000)
npm install && npm run dev
# → http://localhost:8080
```

---

## Key Design Decisions

- **No hardcoded ports in frontend** — `VITE_API_URL` defaults to `/api` (relative), so the same build works behind Nginx or any reverse proxy.
- **Vite dev proxy** — mirrors Nginx routing locally so you never need to change API URLs between environments.
- **Rate limiting** — three zones: `general` (30r/s), `api` (20r/s), `auth` (5r/m).
- **Security headers** — X-Frame-Options, X-Content-Type-Options, CSP, Referrer-Policy applied at gateway level.
- **JWT flow** — `src/lib/api.ts` interceptors attach `Authorization: Bearer <token>` and redirect to `/login` on 401.
- **Backend not exposed** — only Nginx port 80 is published; backend/Redis/Kafka are internal-only.

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `PORT` | Express listen port (default 5000) |
| `MONGO_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `KAFKA_BROKERS` | Comma-separated broker list |
| `ADOBE_API_KEY` | Adobe AEP API key |
| `ANTHROPIC_API_KEY` | Claude API key |

### Frontend (`.env.local`)
| Variable | Description |
|---|---|
| `VITE_API_URL` | API base URL (leave blank to use `/api` via Nginx) |

---

## Validation Checklist

- [ ] `docker compose up --build` completes without errors
- [ ] `http://localhost/health` returns `{"status":"healthy"}`
- [ ] `http://localhost/api/audiences` returns JSON (not 502)
- [ ] React app loads at `http://localhost`
- [ ] Rate limiting: >30 req/s to `/api/` returns 429
- [ ] Auth redirect: expired token → redirected to `/login`
