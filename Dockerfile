# Multi-stage build for Web Note
# Stage 1: Build frontend and backend
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install build dependencies (npm needed for node-gyp upgrade)
RUN apk add --no-cache python3 make g++ sqlite-dev npm

# Copy package files
COPY package.json bun.lock* ./

# Upgrade node-gyp to support Node 26, then install deps
RUN npm install -g node-gyp@latest
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Generate types and OpenAPI
RUN bun run types:generate
RUN bun run openapi:generate

# Build frontend
RUN bunx vite build

# Stage 2: Production image
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache sqlite-libs tini

# Create non-root user (GID 1000 may already exist in base image)
RUN addgroup -g 1001 -S webnote 2>/dev/null || true && \
    adduser -u 1001 -S webnote -G webnote 2>/dev/null || adduser -S webnote -G webnote || true

# Create data directories
RUN mkdir -p /data /app-data && \
    chown -R webnote:webnote /data /app-data

# Copy built artifacts
COPY --from=builder --chown=webnote:webnote /app/dist ./dist
COPY --from=builder --chown=webnote:webnote /app/node_modules ./node_modules
COPY --from=builder --chown=webnote:webnote /app/package.json ./

# Copy backend source (needed for Bun to run TypeScript directly)
COPY --from=builder --chown=webnote:webnote /app/src/backend ./src/backend

# Copy scripts
COPY --from=builder --chown=webnote:webnote /app/scripts ./scripts

# Copy Drizzle config and migrations
COPY --from=builder --chown=webnote:webnote /app/drizzle.config.ts ./
COPY --from=builder --chown=webnote:webnote /app/src/backend/db/migrations ./src/backend/db/migrations

# Set environment
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_ROOT=/data
ENV APP_DATA_ROOT=/app-data
ENV DATABASE_URL=file:/app-data/webnote.db

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Switch to non-root user
USER webnote

# Expose port
EXPOSE 8080

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["bun", "run", "src/backend/index.ts"]