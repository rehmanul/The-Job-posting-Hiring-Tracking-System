#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define variables
NEW_PORT=8081
HEALTH_CHECK_URL="http://localhost:$NEW_PORT/api/health"
MAX_RETRIES=5
RETRY_INTERVAL=5

# Build the application
echo "Building the application..."
npm run build

# Start the application on the new port
echo "Starting the application on port $NEW_PORT..."
PORT=$NEW_PORT npm start &
APP_PID=$!

# Wait for the application to start
echo "Waiting for the application to start..."
sleep 10

# Health check
for i in $(seq 1 $MAX_RETRIES); do
  echo "Performing health check (attempt $i)..."
  if curl -f "$HEALTH_CHECK_URL"; then
    echo "Health check successful."
    exit 0
  fi
  echo "Health check failed. Retrying in $RETRY_INTERVAL seconds..."
  sleep $RETRY_INTERVAL
done

echo "Application failed to start."
kill $APP_PID
exit 1
