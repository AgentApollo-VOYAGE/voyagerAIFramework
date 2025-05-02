import { createProvider } from './services/providers.js';
import { PERSONALITIES } from '../../config/personalities.js';
import { database } from './services/database.js';
import { knowledgeManager } from './services/knowledge.js';
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
    await knowledgeManager.initialize();
    
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

  async retrieveRelevantKnowledge(content) {
    // Search the knowledge base for relevant information
    const relevantKnowledge = await knowledgeManager.searchMemory(content);
    
    // Format it for inclusion in the prompt
    let knowledgePrompt = "";
    
    if (relevantKnowledge.conversations.length > 0) {
      knowledgePrompt += "\nRelevant past conversations:\n";
      relevantKnowledge.conversations.forEach((conv, i) => {
        knowledgePrompt += `[${i+1}] User: ${conv.input}\nResponse: ${conv.response}\n\n`;
      });
    }
    
    if (relevantKnowledge.entities.length > 0) {
      knowledgePrompt += "\nRelevant knowledge:\n";
      relevantKnowledge.entities.forEach((entity, i) => {
        const metadata = JSON.parse(entity.metadata || '{}');
        knowledgePrompt += `[${i+1}] ${entity.entity_type.toUpperCase()}: ${entity.entity_value}`;
        if (metadata.description) {
          knowledgePrompt += ` - ${metadata.description}`;
        }
        knowledgePrompt += `\n`;
      });
    }
    
    if (relevantKnowledge.marketEvents.length > 0) {
      knowledgePrompt += "\nRecent market events:\n";
      relevantKnowledge.marketEvents.forEach((event, i) => {
        const date = new Date(event.timestamp).toLocaleDateString();
        knowledgePrompt += `[${i+1}] ${date} - ${event.event_type}: ${event.description}\n`;
      });
    }
    
    return knowledgePrompt;
  }
  
  async getUserProfile() {
    const userInterests = await knowledgeManager.getUserKnowledge();
    
    let profilePrompt = "\nUser profile:\n";
    
    if (userInterests.tokens.length > 0) {
      profilePrompt += "Tokens of interest: ";
      profilePrompt += userInterests.tokens
        .map(t => `${t.address.substring(0, 8)}... (interactions: ${t.interaction_count})`)
        .join(", ");
      profilePrompt += "\n";
    }
    
    if (userInterests.interests.length > 0) {
      profilePrompt += "Topics of interest: ";
      profilePrompt += userInterests.interests
        .map(i => `${i.tag} (${i.count})`)
        .join(", ");
      profilePrompt += "\n";
    }
    
    return profilePrompt;
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
            await database.updateTokenInteraction(analysis.address, {
              sentiment: 0.5 // Neutral sentiment by default
            });
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
          // Retrieve relevant knowledge to include in the prompt
          const relevantKnowledge = await this.retrieveRelevantKnowledge(content);
          const userProfile = await this.getUserProfile();
          
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
            
            // Prepare messages with system prompt, knowledge context, and conversation history
            const enhancedInstructions = `${this.personality.instructions}\n\n${relevantKnowledge}\n${userProfile}\n\nUse the information above if relevant to the user's query, but don't mention that you're using memory or stored knowledge unless specifically asked.`;
            
            const messages = [
              { role: "system", content: enhancedInstructions },
              ...this.conversationHistory.slice(-10) // Keep last 10 messages
            ];
            
            response = await this.provider.generateResponse(messages);
            
            // Add response to history
            this.conversationHistory.push({ role: "assistant", content: response });
          }
      }

      // Store the conversation and analyze it for knowledge extraction
      await knowledgeManager.analyzeConversation(content, response, analysis.type);

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
