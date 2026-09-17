# Multi-stage build for Web Note
# Stage 1: Build frontend and backend
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ sqlite-dev

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies (skip native addon scripts, rebuild manually)
RUN bun install --frozen-lockfile --ignore-scripts
RUN bun rebuild better-sqlite3

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

# Copy scripts
COPY --from=builder --chown=webnote:webnote /app/scripts ./scripts

# Set environment
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_ROOT=/data
ENV APP_DATA_ROOT=/app-data

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
CMD ["bun", "run", "dist/index.js"]