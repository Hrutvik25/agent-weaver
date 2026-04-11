#!/bin/bash

# AEP Agent Orchestrator - Quick Start Script
# This script automates the setup and startup process

set -e  # Exit on error

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  AEP Agent Orchestrator - Quick Start                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed"
    echo "Please install Docker Compose from: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Error: Docker daemon is not running"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

echo "✅ Docker is installed and running"
echo ""

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down 2>/dev/null || true
echo ""

# Start all services
echo "🚀 Starting all services..."
echo "This may take 2-3 minutes on first run..."
echo ""
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
echo ""

# Wait for MongoDB to be healthy
echo "Waiting for MongoDB..."
timeout=60
counter=0
until docker exec aep-mongodb mongosh --eval "db.adminCommand('ping')" &>/dev/null || [ $counter -eq $timeout ]; do
    printf "."
    sleep 1
    ((counter++))
done

if [ $counter -eq $timeout ]; then
    echo ""
    echo "❌ MongoDB failed to start within $timeout seconds"
    echo "Check logs: docker logs aep-mongodb"
    exit 1
fi
echo " ✅"

# Wait for Redis to be ready
echo "Waiting for Redis..."
counter=0
until docker exec aep-redis redis-cli ping &>/dev/null || [ $counter -eq $timeout ]; do
    printf "."
    sleep 1
    ((counter++))
done

if [ $counter -eq $timeout ]; then
    echo ""
    echo "❌ Redis failed to start within $timeout seconds"
    echo "Check logs: docker logs aep-redis"
    exit 1
fi
echo " ✅"

# Wait for Backend to be ready
echo "Waiting for Backend..."
counter=0
until curl -s http://localhost/api/health &>/dev/null || [ $counter -eq $timeout ]; do
    printf "."
    sleep 2
    ((counter++))
done

if [ $counter -eq $timeout ]; then
    echo ""
    echo "❌ Backend failed to start within $timeout seconds"
    echo "Check logs: docker logs aep-orchestrator"
    exit 1
fi
echo " ✅"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅ All services are running!                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Access Points:"
echo "   Main Dashboard:    http://localhost"
echo "   MongoDB Express:   http://localhost:8081"
echo "   Kafka UI:          http://localhost:8082"
echo "   MCP Gateway:       http://localhost:5001/health"
echo ""
echo "📊 Quick Tests:"
echo "   Health Check:      curl http://localhost/api/health"
echo "   Audiences:         curl http://localhost/api/audiences"
echo "   Journeys:          curl http://localhost/api/journeys"
echo "   MCP Metrics:       curl http://localhost/api/mcp/metrics"
echo ""
echo "📝 View Logs:"
echo "   All services:      docker-compose logs -f"
echo "   Backend only:      docker logs aep-orchestrator -f"
echo "   Gateway only:      docker logs aep-mcp-gateway -f"
echo ""
echo "🛑 Stop Services:"
echo "   docker-compose down"
echo ""
echo "🎉 Ready! Open http://localhost in your browser"
echo ""
