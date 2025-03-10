import { createProvider } from './services/providers.js';
import { PERSONALITIES } from '../../config/personalities.js';
import { database } from './services/database.js';
import { ENV } from '../../config/env.js';
import { 
  enhanceWalletQuery,
  enhanceTokenQuery,
  enhanceMarketQuery,
  enhanceSentimentQuery,
  enhanceSwapQuery 
} from './enhancers/index.js';

export class ApolloAgent {
  constructor(personality = ENV.AI_PERSONALITY) {
    this.provider = createProvider();
    this.initialized = false;
    this.setPersonality(personality);
  }

  setPersonality(personalityKey) {
    if (!PERSONALITIES[personalityKey]) {
      throw new Error(`Unknown personality: ${personalityKey}`);
    }
    this.personality = PERSONALITIES[personalityKey];
  }

  async initialize() {
    await database.initialize();
    
    if (this.provider.type === 'openai') {
      // Use OpenAI's assistants API
      this.assistant = await this.provider.client.beta.assistants.create({
        name: this.personality.name,
        instructions: this.personality.instructions,
        tools: [{ type: "code_interpreter" }],
        model: "gpt-4-turbo-preview"
      });
      this.thread = await this.provider.client.beta.threads.create();
    } else {
      // For other providers, just initialize a conversation history
      this.conversationHistory = [];
    }
    
    this.initialized = true;
  }

  async analyzeQuery(content) {
    try {
      const response = await this.provider.generateResponse([{
        role: "system",
        content: `You are a query analyzer. Analyze the user's message and return a JSON object with:
          - type: The query type (wallet, specific_token, market, sentiment, dex_status, swap, or general)
          - address: Any Solana address found (if applicable)
          - solAmount: Amount of SOL to swap (if applicable)
          - tokenAmount: Amount of tokens to swap (if applicable)
          - action: "buy" or "sell" (if applicable)
          - confidence: How confident you are in this classification (0-1)`
      }, {
        role: "user",
        content
      }]);

      return JSON.parse(response);
    } catch (error) {
      console.error('Error analyzing query:', error);
      return { type: 'general', confidence: 0 };
    }
  }

  async sendMessage(content) {
    if (!this.initialized) {
      await this.initialize();
    }

    const analysis = await this.analyzeQuery(content);
    let response;

    try {
      switch (analysis.type.toLowerCase()) {
        case 'wallet':
          const walletResponse = await enhanceWalletQuery(content);
          response = walletResponse.response;
          break;
        case 'specific_token':
          const tokenResponse = await enhanceTokenQuery(content);
          response = tokenResponse.response;
          if (analysis.address) {
            await database.updateTokenInteraction(analysis.address);
          }
          break;
        case 'market':
          response = await enhanceMarketQuery(content);
          break;
        case 'sentiment':
          response = await enhanceSentimentQuery(content);
          break;
        case 'swap':
          response = await enhanceSwapQuery(content, analysis);
          break;
        default:
          if (this.provider.type === 'openai') {
            // Use OpenAI's threads API
            await this.provider.client.beta.threads.messages.create(
              this.thread.id,
              { role: "user", content }
            );

            const run = await this.provider.client.beta.threads.runs.create(
              this.thread.id,
              { assistant_id: this.assistant.id }
            );

            const messages = await this.waitForCompletion(this.thread.id, run.id);
            response = messages[0].content[0].text.value;
          } else {
            // For other providers, use direct message generation
            this.conversationHistory.push({ role: "user", content });
            
            // Prepare messages with system prompt and conversation history
            const messages = [
              { role: "system", content: this.personality.instructions },
              ...this.conversationHistory.slice(-10) // Keep last 10 messages
            ];
            
            response = await this.provider.generateResponse(messages);
            
            // Add response to history
            this.conversationHistory.push({ role: "assistant", content: response });
          }
      }

      // Store the conversation in the background
      await database.storeConversation(content, response, analysis.type);

      return response;

    } catch (error) {
      console.error('Error in sendMessage:', error);
      return "I encountered an error processing your request. Please try again.";
    }
  }

  async waitForCompletion(threadId, runId) {
    let run;
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      run = await this.provider.client.beta.threads.runs.retrieve(threadId, runId);
    } while (run.status === 'in_progress' || run.status === 'queued');

    if (run.status === 'completed') {
      const messages = await this.provider.client.beta.threads.messages.list(threadId);
      return messages.data;
    } else {
      throw new Error(`Run ended with status: ${run.status}`);
    }
  }
}
