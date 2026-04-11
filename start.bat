@echo off
REM AEP Agent Orchestrator - Quick Start Script for Windows
REM This script automates the setup and startup process

echo ================================================================
echo   AEP Agent Orchestrator - Quick Start
echo ================================================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Compose is not installed
    echo Please install Docker Compose from: https://docs.docker.com/compose/install/
    pause
    exit /b 1
)

REM Check if Docker daemon is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker daemon is not running
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)

echo [OK] Docker is installed and running
echo.

REM Stop any existing containers
echo [INFO] Stopping existing containers...
docker-compose down >nul 2>&1
echo.

REM Start all services
echo [INFO] Starting all services...
echo This may take 2-3 minutes on first run...
echo.
docker-compose up -d

echo.
echo [INFO] Waiting for services to be ready...
echo.

REM Wait for MongoDB to be healthy
echo Waiting for MongoDB...
set /a counter=0
set /a timeout=60
:wait_mongodb
docker exec aep-mongodb mongosh --eval "db.adminCommand('ping')" >nul 2>&1
if errorlevel 1 (
    if %counter% geq %timeout% (
        echo.
        echo [ERROR] MongoDB failed to start within %timeout% seconds
        echo Check logs: docker logs aep-mongodb
        pause
        exit /b 1
    )
    timeout /t 1 /nobreak >nul
    set /a counter+=1
    goto wait_mongodb
)
echo [OK]

REM Wait for Redis to be ready
echo Waiting for Redis...
set /a counter=0
:wait_redis
docker exec aep-redis redis-cli ping >nul 2>&1
if errorlevel 1 (
    if %counter% geq %timeout% (
        echo.
        echo [ERROR] Redis failed to start within %timeout% seconds
        echo Check logs: docker logs aep-redis
        pause
        exit /b 1
    )
    timeout /t 1 /nobreak >nul
    set /a counter+=1
    goto wait_redis
)
echo [OK]

REM Wait for Backend to be ready
echo Waiting for Backend...
set /a counter=0
:wait_backend
curl -s http://localhost/api/health >nul 2>&1
if errorlevel 1 (
    if %counter% geq %timeout% (
        echo.
        echo [ERROR] Backend failed to start within %timeout% seconds
        echo Check logs: docker logs aep-orchestrator
        pause
        exit /b 1
    )
    timeout /t 2 /nobreak >nul
    set /a counter+=1
    goto wait_backend
)
echo [OK]

echo.
echo ================================================================
echo   All services are running!
echo ================================================================
echo.
echo Access Points:
echo   Main Dashboard:    http://localhost
echo   MongoDB Express:   http://localhost:8081
echo   Kafka UI:          http://localhost:8082
echo   MCP Gateway:       http://localhost:5001/health
echo.
echo Quick Tests:
echo   Health Check:      curl http://localhost/api/health
echo   Audiences:         curl http://localhost/api/audiences
echo   Journeys:          curl http://localhost/api/journeys
echo   MCP Metrics:       curl http://localhost/api/mcp/metrics
echo.
echo View Logs:
echo   All services:      docker-compose logs -f
echo   Backend only:      docker logs aep-orchestrator -f
echo   Gateway only:      docker logs aep-mcp-gateway -f
echo.
echo Stop Services:
echo   docker-compose down
echo.
echo Ready! Open http://localhost in your browser
echo.
pause
