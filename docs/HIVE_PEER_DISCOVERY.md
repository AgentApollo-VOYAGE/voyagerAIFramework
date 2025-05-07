# HIVE Peer Discovery and Matchmaking

The HIVE Mind system supports both explicit peer connections and automatic peer discovery, allowing agents to collaborate without requiring manual configuration of peer connections.

## Connection Methods

HIVE supports three primary connection methods:

1. **Explicit Connections**: Directly specify known peers in your `.env` file
2. **Automatic Discovery**: Connect to a discovery server to find available peers
3. **Matchmaking Queue**: Join a queue to be matched with suitable peers based on expertise profiles

## Configuration Options

In your `.env` file, you can configure how HIVE connects to peers:

```
# Comma-separated list of known HIVE peers (WebSocket URLs)
# Leave empty to use auto-discovery or random matchmaking
HIVE_KNOWN_PEERS=ws://localhost:3001,ws://localhost:3002

# Enable automatic peer discovery and matchmaking
HIVE_AUTO_DISCOVERY=true

# URL of the HIVE discovery server (if using central discovery)
HIVE_DISCOVERY_SERVER=ws://discovery.example.com:8080

# Prefer to connect to random peers when no specific peer is required
HIVE_PREFER_RANDOM=true

# Prefer peers with complementary knowledge (recommended for diverse insights)
HIVE_PREFER_COMPLEMENTARY=true

# Maximum number of peers to connect to through auto-discovery
HIVE_MAX_PEERS=3
```

## How It Works

### Connection Process

1. When HIVE initializes, it first attempts to connect to any explicitly defined peers in `HIVE_KNOWN_PEERS`
2. If auto-discovery is enabled (`HIVE_AUTO_DISCOVERY=true`) and no explicit peers were connected, HIVE will connect to the discovery server
3. When connected to the discovery server, HIVE can:
   - Register itself as an available peer
   - Join the matchmaking queue to be matched with other peers
   - Receive peer suggestions based on compatibility

### Matchmaking Logic

HIVE uses expertise profiles to intelligently match peers:

1. Each HIVE instance builds an expertise profile based on its knowledge categories
2. When joining the matchmaking queue, it can specify preferences:
   - `HIVE_PREFER_RANDOM`: Connect to random available peers
   - `HIVE_PREFER_COMPLEMENTARY`: Connect to peers with complementary knowledge

### Targeting Specific Expertise

When sending knowledge requests or collaborative queries, HIVE can:

1. Find the best peer for a specific knowledge category
2. Select a random peer if no specific expertise is required
3. Target multiple peers with different expertise areas

## Discovery Server

The project includes a Discovery Server implementation that enables automatic peer discovery and matchmaking.

### Discovery Server Features

- **Peer Registry**: Maintains a list of active HIVE peers
- **Expertise Tracking**: Records and matches peers based on knowledge expertise
- **Matchmaking Queue**: Processes and matches peers with compatible profiles
- **Preference-Based Matching**: Supports both random and complementary knowledge matching
- **WebSocket Protocol**: Simple JSON-based protocol for peer coordination

### Running a Discovery Server

To run your own discovery server:

1. Use the included script:
   ```bash
   node start-discovery-server.js
   ```
   
2. Configuration options in your `.env` file:
   ```
   DISCOVERY_PORT=8080
   MATCHMAKING_INTERVAL=5000
   MAX_PEERS_PER_CLIENT=5
   ```

3. For production deployments, see the full guide in `docs/DISCOVERY_SERVER_SETUP.md`

### Discovery Server Protocol

The discovery server uses a simple WebSocket protocol:

- **Client → Server**:
  - `register_expertise`: Share expertise profile
  - `join_matchmaking`: Join the matchmaking queue with preferences
  - `leave_matchmaking`: Leave the matchmaking queue
  - `get_peers`: Request peer suggestions
  - `heartbeat`: Keep connection alive

- **Server → Client**:
  - `welcome`: Initial connection with assigned peer ID
  - `matchmaking_status`: Queue status updates
  - `match_found`: Notification of a matched peer
  - `peer_suggestions`: List of suggested peers

## Best Practices

1. **For Development**: Use explicit peer connections (`HIVE_KNOWN_PEERS`) for testing with known endpoints
2. **For Production**: Enable auto-discovery for a more dynamic and resilient network
3. **For Specific Use Cases**: Configure matchmaking preferences to optimize for your needs:
   - Knowledge diversity: Set `HIVE_PREFER_COMPLEMENTARY=true`
   - Random connections: Set `HIVE_PREFER_RANDOM=true`
   - Limited connections: Set a lower value for `HIVE_MAX_PEERS`

## Troubleshooting

- If peers aren't connecting via auto-discovery, check that your discovery server URL is correct
- Ensure that your firewall allows WebSocket connections on the specified ports
- Check logs for connection errors in the HIVE initialization process 