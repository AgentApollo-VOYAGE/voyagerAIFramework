import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
  AI_PROVIDER: process.env.AI_PROVIDER || 'openai',
  AI_PERSONALITY: process.env.AI_PERSONALITY || 'apollo',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY
}; 