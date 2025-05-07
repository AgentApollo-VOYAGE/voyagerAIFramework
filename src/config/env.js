import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
  AI_PROVIDER: process.env.AI_PROVIDER || 'openai',
  AI_PERSONALITY: process.env.AI_PERSONALITY || 'apollo',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  GROK_API_KEY: process.env.GROK_API_KEY,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  
  // HIVE Mind Configuration
  ENABLE_HIVE: process.env.ENABLE_HIVE === 'true',
  HIVE_PORT: parseInt(process.env.HIVE_PORT || '3000', 10),
  HIVE_KNOWN_PEERS: (process.env.HIVE_KNOWN_PEERS || '').split(',').filter(Boolean),
  HIVE_TIMEOUT: parseInt(process.env.HIVE_TIMEOUT || '5000', 10),
  HIVE_SHARE_CATEGORIES: (process.env.HIVE_SHARE_CATEGORIES || 'market_events,tokens,concepts').split(','),
  
  // Auto-discovery configuration
  HIVE_AUTO_DISCOVERY: process.env.HIVE_AUTO_DISCOVERY === 'true',
  HIVE_DISCOVERY_SERVER: process.env.HIVE_DISCOVERY_SERVER || '',
  
  // Matchmaking preferences
  HIVE_PREFER_RANDOM: process.env.HIVE_PREFER_RANDOM === 'true',
  HIVE_PREFER_COMPLEMENTARY: process.env.HIVE_PREFER_COMPLEMENTARY === 'true',
  HIVE_MAX_PEERS: parseInt(process.env.HIVE_MAX_PEERS || '3', 10),
  
  // Discovery server configuration (when hosting)
  DISCOVERY_PORT: parseInt(process.env.DISCOVERY_PORT || '8080', 10),
  MATCHMAKING_INTERVAL: parseInt(process.env.MATCHMAKING_INTERVAL || '5000', 10),
  MAX_PEERS_PER_CLIENT: parseInt(process.env.MAX_PEERS_PER_CLIENT || '5', 10),
}; 
