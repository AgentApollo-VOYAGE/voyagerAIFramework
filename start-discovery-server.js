import DiscoveryServer from './src/discovery-server.js';
import dotenv from 'dotenv';
import { networkInterfaces } from 'os';

// Load environment variables
dotenv.config();

// Helper function to get local IP address
function getLocalIpAddress() {
  const nets = networkInterfaces();
  const results = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  
  return results;
}

// Get local IP addresses
const localIPs = getLocalIpAddress();
const port = process.env.DISCOVERY_PORT || 8080;

console.log('🐝 Starting HIVE Discovery Server 🐝');
console.log('===================================');
console.log(`Local IP Addresses: ${localIPs.join(', ')}`);
console.log(`Discovery Port: ${port}`);

// For remote connections, display possible URLs
localIPs.forEach(ip => {
  console.log(`For remote connections use: ws://${ip}:${port}`);
});

console.log('\nServer Configuration:');
console.log('-------------------');
console.log(`MAX_PEERS_PER_CLIENT: ${process.env.MAX_PEERS_PER_CLIENT || 3}`);
console.log(`MATCHMAKING_INTERVAL: ${process.env.MATCHMAKING_INTERVAL || 5000}ms`);

// Create and start the discovery server
const server = new DiscoveryServer(port);
server.start();

// Periodic statistics logger
setInterval(() => {
  const connectedPeers = Array.from(server.peers.keys());
  const matchmakingQueue = server.matchmakingQueue;
  
  console.log('\n📊 Server Statistics 📊');
  console.log(`Connected Peers: ${connectedPeers.length}`);
  console.log(`Peers in Matchmaking Queue: ${matchmakingQueue.length}`);
  
  if (connectedPeers.length > 0) {
    console.log('\nConnected Peers:');
    connectedPeers.forEach((peerId) => {
      console.log(`- ${peerId}`);
    });
  }
  
  if (matchmakingQueue.length > 0) {
    console.log('\nMatchmaking Queue:');
    matchmakingQueue.forEach((peerId) => {
      const preferences = server.peerPreferences.get(peerId) || {};
      console.log(`- ${peerId} (preferences: ${JSON.stringify(preferences)})`);
    });
  }
}, 10000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down HIVE Discovery Server...');
  server.stop();
  process.exit(0);
});

console.log('Discovery server is running. Press Ctrl+C to stop.'); 