#!/bin/sh
# Docker entrypoint script - runs migrations then starts the application

set -e

echo "🐳 Starting Web Note container..."

# Run database migrations
echo "🗄️  Running database migrations..."
bun run scripts/db:migrate.ts

# Start the application
echo "🚀 Starting application..."
exec "$@"