# Chat App

A real-time chat application built with Next.js, NestJS, and WebSocket support.

## Development

### Quick Start

For development with automatic IP detection and network access:

```bash
pnpm run dev:network
```

This command:
1. Automatically detects your current local IP address
2. Updates `.env.local` and configuration files with the detected IP
3. Starts both frontend and backend development servers
4. Makes the app accessible from any device on your network

### Manual Development

```bash
# Start with default localhost configuration
pnpm dev

# Update IP configuration manually
pnpm run update-ip
```

### Network Access

The `dev:network` script automatically configures the application for network access:

- **Web App**: `http://YOUR_IP:3000` (accessible from mobile devices)
- **API Server**: `http://YOUR_IP:3001` (backend services)
- **WebSocket**: Real-time messaging across all network devices

### IP Auto-Detection

The `update-ip.sh` script automatically:
- Detects your current local network IP address
- Updates `apps/web/.env.local` with the correct URLs
- Updates `apps/web/package.json` hostname binding
- Ensures seamless network connectivity for development and testing

### Scripts

- `pnpm run dev:network` - Start development with auto IP detection
- `pnpm run dev` - Start development with default configuration
- `pnpm run update-ip` - Manually update IP configuration
- `pnpm run build` - Build the application
- `pnpm run start` - Start with Docker Compose

## Architecture

- **Frontend**: Next.js with TypeScript, Tailwind CSS, Zustand
- **Backend**: NestJS with WebSocket gateway, Prisma ORM
- **Database**: PostgreSQL
- **Cache**: Redis
- **Real-time**: Socket.IO WebSocket communication

## Mobile Development

The application is fully responsive and optimized for mobile development:
- Responsive design with mobile-first approach
- WebSocket connectivity works across network devices
- Automatic IP detection for seamless cross-device testing

## Testing

Test the application on different devices by connecting to the same Wi-Fi network and visiting the auto-detected IP address.
