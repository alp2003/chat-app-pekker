#!/bin/bash

# Dynamic development server starter
# Sources environment variables and starts development servers

set -e

# Update IP configuration
./update-ip.sh

# Source the environment variables
if [ -f "apps/web/.env.local" ]; then
    export $(cat apps/web/.env.local | grep -v '^#' | xargs)
fi

echo "Starting development servers with hostname: ${DEV_HOSTNAME:-localhost}"

# Start development servers
turbo run dev --parallel
