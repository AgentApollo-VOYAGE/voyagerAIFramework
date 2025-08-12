import { ApolloAgent } from './src/agents/apollo/ApolloAgent.js';
import { PERSONALITIES } from './src/config/personalities.js';
import { ENV } from './src/config/env.js';
import readline from 'readline';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to check if a port is in use
const isPortInUse = async (port) => {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', err => {
        if (err.code === 'EADDRINUSE') {
          resolve(true); // Port is in use
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.close();
        resolve(false); // Port is free
      })
      .listen(port);
  });
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// First check if port 3000 is already in use for the web server
const startWebServer = async () => {
  try {
    const port = 3000;
    const webPortInUse = await isPortInUse(port);
    
    if (!webPortInUse) {
      const app = express();
      app.use(cors());
      app.use(express.json());
      app.use(express.static(__dirname)); // Serve static files from current directory
      
      // Serve the chat.html file at the root URL
      app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'chat.html'));
      });

      // Serve the background tasks dashboard
      app.get('/dashboard', (req, res) => {
        res.sendFile(path.join(__dirname, 'background-tasks.html'));
      });
      
      app.post('/chat', async (req, res) => {
        const response = await apollo.sendMessage(req.body.message);
        res.json({ response });
      });

      // Background task management endpoints
      app.get('/background-tasks/status', (req, res) => {
        const status = apollo.getBackgroundTaskStatus();
        res.json({ status });
      });

      app.post('/background-tasks/start/:taskName', async (req, res) => {
        const result = await apollo.startBackgroundTask(req.params.taskName);
        res.json(result);
      });

      app.post('/background-tasks/stop/:taskName', (req, res) => {
        const result = apollo.stopBackgroundTask(req.params.taskName);
        res.json(result);
      });

      app.post('/background-tasks/stop-all', (req, res) => {
        const result = apollo.stopAllBackgroundTasks();
        res.json(result);
      });

      app.post('/background-tasks/restart', async (req, res) => {
        const result = await apollo.restartBackgroundTasks();
        res.json(result);
      });
      
      app.listen(port, () => {
        console.log(`Web server running on http://localhost:${port}`);
      });
    } else {
      console.log(`Web server port ${port} already in use - skipping web server start`);
    }
  } catch (error) {
    console.error("Error starting web server:", error);
  }
};

// Check if HIVE port is already in use before starting an instance
const setupHiveAgent = async () => {
  // Initialize Apollo agent with HIVE checks
  const apollo = new ApolloAgent();
  
  // Store original initialize method to modify it
  const originalInitialize = apollo.initialize;
  
  // Override the initialize method to check for existing HIVE server
  apollo.initialize = async function() {
    // If HIVE is enabled, check if a server is already running on the port
    if (ENV.ENABLE_HIVE) {
      const hivePortInUse = await isPortInUse(ENV.HIVE_PORT);
      
      if (hivePortInUse) {
        console.log(`HIVE port ${ENV.HIVE_PORT} already in use - will connect to existing server`);
        // Set a flag to indicate we should skip server creation but still connect as client
        ENV.HIVE_SKIP_SERVER_CREATION = true;
        
        // Add localhost as a known peer to ensure direct connection to the existing server
        if (!ENV.HIVE_KNOWN_PEERS || ENV.HIVE_KNOWN_PEERS.length === 0) {
          console.log(`Adding localhost:${ENV.HIVE_PORT} as a known peer for direct connection`);
          ENV.HIVE_KNOWN_PEERS = [`ws://localhost:${ENV.HIVE_PORT}`];
        } else if (!ENV.HIVE_KNOWN_PEERS.includes(`ws://localhost:${ENV.HIVE_PORT}`)) {
          console.log(`Adding localhost:${ENV.HIVE_PORT} to known peers list`);
          ENV.HIVE_KNOWN_PEERS.push(`ws://localhost:${ENV.HIVE_PORT}`);
        }
      } else {
        console.log(`HIVE port ${ENV.HIVE_PORT} is free - will start a new HIVE server`);
        ENV.HIVE_SKIP_SERVER_CREATION = false;
      }
    }
    
    // Call the original initialize method
    return await originalInitialize.call(this);
  };
  
  await apollo.initialize();
  return apollo;
};

// CLI chat functionality
async function startChat() {
  // Start the web server in the background
  startWebServer();
  
  // Initialize Apollo agent with HIVE checks
  const apollo = await setupHiveAgent();
  
  console.log(`Starting with personality: ${ENV.AI_PERSONALITY}`);
  console.log("Available personalities (use /switch to change):");
  Object.entries(PERSONALITIES).forEach(([key, p]) => {
    console.log(`${key}: ${p.description}`);
  });

  console.log(`${PERSONALITIES[ENV.AI_PERSONALITY].name} is ready! Type your message (or 'exit' to quit)`);

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      if (input.startsWith('/switch ')) {
        const newPersonality = input.split(' ')[1].toLowerCase();
        if (PERSONALITIES[newPersonality]) {
          apollo.setPersonality(newPersonality);
          await apollo.initialize();
          console.log(`Switched to ${PERSONALITIES[newPersonality].name}!`);
        } else {
          console.log('Unknown personality. Available options:', Object.keys(PERSONALITIES).join(', '));
        }
      } else {
        try {
          const response = await apollo.sendMessage(input);
          console.log(`\n${apollo.personality.name}: ${response}\n`);
        } catch (error) {
          console.error('Error:', error.message);
        }
      }

      askQuestion();
    });
  };

  askQuestion();
}

startChat().catch(console.error); 
