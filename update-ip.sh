#!/bin/bash

# Dynamic IP Configuration Script
# Automatically detects your local network IP and updates development configuration
# This enables network access for testing on mobile devices and other computers

# Get current local IP address
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)

echo "Detected local IP: $LOCAL_IP"

# Update .env.local file
cat > apps/web/.env.local << EOF
# Development environment variables (auto-updated)
NEXT_PUBLIC_API_URL=http://${LOCAL_IP}:3001
NEXT_PUBLIC_SOCKET_URL=http://${LOCAL_IP}:3001
NEXT_PUBLIC_VERBOSE_LOGS=true

# Server-side environment variables for SSR
NEXTAUTH_URL=http://${LOCAL_IP}:3000
INTERNAL_API_URL=http://localhost:3001

# Development hostname for Next.js dev server
DEV_HOSTNAME=${LOCAL_IP}
EOF

echo "Updated .env.local with IP: $LOCAL_IP"
echo "Updated DEV_HOSTNAME environment variable to: $LOCAL_IP"
echo "Restart your dev server: pnpm dev"
