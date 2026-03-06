#!/bin/sh

set -e

# Run Prisma migrations
echo "Deploying Prisma migrations..."
npx prisma migrate deploy

# Run Prisma DB seed to ensure default admin user
echo "Running Prisma DB seed..."
npx prisma db seed

# Start the application
echo "Starting application..."
exec node dist/src/main
