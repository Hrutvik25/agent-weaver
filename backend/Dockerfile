# Multi-stage build for optimized production image

# ==================== BUILD STAGE ====================
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with production flag
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY server.js ./
COPY scripts ./scripts

# ==================== RUNTIME STAGE ====================
FROM node:18-alpine

WORKDIR /app

# Install dumb-init to handle signals properly
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Copy application code
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs scripts ./scripts
COPY --chown=nodejs:nodejs .env.example ./.env.example

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init to ensure proper signal handling
#ENTRYPOINT ["/sbin/dumb-init", "--"]

# Start application
CMD ["node", "server.js"]
