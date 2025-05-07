# HIVE Discovery Server Setup Guide

This document explains how to set up and deploy a HIVE discovery server to enable automatic peer discovery and matchmaking for HIVE peers.

## Overview

The HIVE discovery server is a WebSocket-based service that:
- Facilitates peer discovery by maintaining a registry of available peers
- Provides a matchmaking queue to connect peers based on expertise and preferences
- Allows peers to find each other without explicitly configuring peer addresses

## Quick Start

For local testing, you can run the discovery server directly with:

```bash
node start-discovery-server.js
```

This will start the discovery server on the default port (8080) or the port specified in your `.env` file.

## Configuration Options

In your `.env` file, you can configure the discovery server with these settings:

```
# Port to run the discovery server on
DISCOVERY_PORT=8080

# Matchmaking interval in milliseconds (how often to process the queue)
MATCHMAKING_INTERVAL=5000

# Maximum peers per client (limit how many peers can be suggested)
MAX_PEERS_PER_CLIENT=5
```

## Production Deployment

For a production environment, you'll want to deploy the discovery server on a publicly accessible server. Here are deployment options:

### Option 1: Standard Node.js Server (e.g., with PM2)

1. Install PM2 (Process Manager):
```bash
npm install -g pm2
```

2. Start the discovery server with PM2:
```bash
pm2 start start-discovery-server.js --name "hive-discovery"
```

3. Make sure PM2 restarts on system boot:
```bash
pm2 save
pm2 startup
```

### Option 2: Docker Deployment

1. Create a `Dockerfile` in your project root:
```dockerfile
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

CMD ["node", "start-discovery-server.js"]
```

2. Build and run the Docker container:
```bash
docker build -t hive-discovery .
docker run -p 8080:8080 -d hive-discovery
```

### Option 3: Cloud Deployment (e.g., Heroku)

1. Create a `Procfile` in your project root:
```
web: node start-discovery-server.js
```

2. Initialize a git repository (if not already):
```bash
git init
git add .
git commit -m "Initial commit"
```

3. Create and deploy to Heroku:
```bash
heroku create
git push heroku main
```

## Security Considerations

When deploying a public discovery server, consider these security best practices:

1. **Use HTTPS/WSS**: In production, secure your WebSocket connections with WSS (WebSocket Secure):
   - Set up a reverse proxy like Nginx with SSL certificates
   - Use services like Cloudflare for SSL termination

2. **Implement Authentication**: For private discovery networks, add authentication:
   - API keys or tokens for joining the discovery network
   - JWT validation for peer registration

3. **Rate Limiting**: Implement rate limiting to prevent abuse:
   - Limit connections per IP
   - Limit matchmaking requests

4. **Firewall Rules**: Configure your firewall to:
   - Allow only WebSocket traffic on the discovery port
   - Block unnecessary access

## Client Configuration

Clients (HIVE peers) need to be configured to use your discovery server:

1. In the client's `.env` file, set:
```
HIVE_AUTO_DISCOVERY=true
HIVE_DISCOVERY_SERVER=ws://your-server.example.com:8080
```

2. For secure connections (recommended for production):
```
HIVE_DISCOVERY_SERVER=wss://your-server.example.com/discovery
```

## Monitoring

For production deployments, set up monitoring:

1. **Logs**: Capture and analyze logs:
```bash
pm2 logs hive-discovery
```

2. **Health Checks**: Implement a simple health check endpoint

3. **Metrics**: Track metrics like:
   - Number of connected peers
   - Matchmaking queue length
   - Successful matches

## Troubleshooting

Common issues and solutions:

1. **Connection Refused**: Check firewall settings and ensure the port is open

2. **Peers Not Matching**: Check that expertise profiles are being shared correctly

3. **High CPU Usage**: Consider increasing the matchmaking interval for larger networks

4. **Memory Leaks**: Monitor the server memory usage and restart periodically if needed

## Advanced Deployment: Multi-Region

For large-scale deployments, consider:

1. **Multiple Discovery Servers**: Deploy in different regions
2. **Federation**: Implement discovery server federation for sharing peers between regions
3. **Load Balancing**: Use load balancers to distribute client connections 