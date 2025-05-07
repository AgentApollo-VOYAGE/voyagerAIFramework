import { createProvider } from './services/providers.js';
import { PERSONALITIES } from '../../config/personalities.js';
import { database } from './services/database.js';
import { knowledgeManager } from './services/knowledge.js';
import { hiveP2P } from './services/hive-p2p.js';
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
    
    // HIVE settings
    this.enableHive = ENV.ENABLE_HIVE;
    this.hiveInitialized = false;
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
    
    // Initialize HIVE if enabled
    if (this.enableHive) {
      try {
        // Set up the callback for sharing new entities
        knowledgeManager.onNewEntity = async (entityInfo) => {
          if (this.hiveInitialized) {
            await hiveP2P.shareEntity(entityInfo);
          }
        };
        
        // Initialize HIVE P2P
        await hiveP2P.initialize(knowledgeManager);
        this.hiveInitialized = true;
        console.log('HIVE mind enabled and initialized');
      } catch (error) {
        console.error('Failed to initialize HIVE:', error);
        this.enableHive = false;
      }
    }
    
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
          - confidence: How confident you are in this classification (0-1)
          
          VERY IMPORTANT: Return ONLY the JSON object, with no markdown formatting, backticks, or explanations.`
      }, {
        role: "user",
        content
      }]);

      try {
        // First try direct JSON parsing
        return JSON.parse(response);
      } catch (parseError) {
        console.log('Direct JSON parsing failed, trying to extract JSON from response...');
        
        // Check if response contains markdown code blocks with json
        const jsonRegex = /```(?:json)?\s*({[\s\S]*?})\s*```/;
        const match = response.match(jsonRegex);
        
        if (match && match[1]) {
          try {
            // Try to parse JSON from the code block
            return JSON.parse(match[1]);
          } catch (codeBlockError) {
            console.error('Failed to parse JSON from code block:', codeBlockError);
          }
        }
        
        // If all parsing attempts fail, return a default response
        console.error('Could not parse JSON response:', response);
        return { 
          type: 'general', 
          confidence: 0.5,
          parseError: true
        };
      }
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
  
  /**
   * Query the HIVE for additional knowledge
   * @param {String} content - The user's query
   * @param {String} queryType - The type of query
   * @returns {String} - Additional knowledge from HIVE peers
   */
  async queryHiveKnowledge(content, queryType) {
    if (!this.enableHive || !this.hiveInitialized) {
      return '';
    }
    
    try {
      console.log('Querying HIVE mind for additional knowledge...');
      
      // Determine relevant categories based on query type
      const categoryMap = {
        'wallet': ['wallets', 'tokens'],
        'specific_token': ['tokens', 'market_events'],
        'market': ['market_events', 'tokens', 'concepts'],
        'sentiment': ['market_events', 'concepts'],
        'swap': ['tokens', 'market_events'],
        'general': ['concepts', 'tokens', 'market_events']
      };
      
      const categories = categoryMap[queryType] || ['concepts', 'tokens', 'market_events'];
      
      // Request knowledge from HIVE peers
      const hiveEntities = await hiveP2P.requestKnowledge(categories, content);
      
      if (hiveEntities.length === 0) {
        return '';
      }
      
      // Generate knowledge prompt from HIVE entities
      let hivePrompt = "\nHIVE mind knowledge:\n";
      
      // Group entities by type for better presentation
      const groupedEntities = hiveEntities.reduce((acc, entity) => {
        const type = entity.type;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(entity);
        return acc;
      }, {});
      
      // Add each type of entity to the prompt
      for (const [type, entities] of Object.entries(groupedEntities)) {
        hivePrompt += `\n${type.toUpperCase()} entities:\n`;
        
        entities.slice(0, 5).forEach((entity, i) => {
          hivePrompt += `[${i+1}] ${entity.value}`;
          if (entity.metadata && entity.metadata.description) {
            hivePrompt += ` - ${entity.metadata.description}`;
          }
          hivePrompt += '\n';
        });
        
        if (entities.length > 5) {
          hivePrompt += `... and ${entities.length - 5} more ${type} entities\n`;
        }
      }
      
      console.log(`Retrieved ${hiveEntities.length} entities from HIVE mind`);
      return hivePrompt;
    } catch (error) {
      console.error('Error querying HIVE knowledge:', error);
      return '';
    }
  }
  
  /**
   * Send a collaborative query to HIVE peers
   * @param {String} content - The user's query
   * @param {String} queryType - The type of query 
   * @returns {String} - Collaborative results from HIVE peers
   */
  async sendCollaborativeQuery(content, queryType) {
    if (!this.enableHive || !this.hiveInitialized) {
      return '';
    }
    
    try {
      console.log('Sending collaborative query to HIVE mind...');
      
      // Determine relevant categories based on query type
      const categoryMap = {
        'wallet': ['wallets', 'tokens'],
        'specific_token': ['tokens', 'market_events'],
        'market': ['market_events', 'tokens', 'concepts'],
        'sentiment': ['market_events', 'concepts'],
        'swap': ['tokens', 'market_events'],
        'general': ['concepts', 'tokens', 'market_events']
      };
      
      const categories = categoryMap[queryType] || ['concepts', 'tokens', 'market_events'];
      
      // Send query to HIVE peers
      const results = await hiveP2P.sendCollaborativeQuery(content, categories);
      
      if (results.length === 0) {
        return '';
      }
      
      // Format the results from HIVE peers
      let collaborativePrompt = "\nHIVE mind collaborative insights:\n";
      
      results.forEach((peerResult, i) => {
        collaborativePrompt += `\nFrom HIVE peer ${i+1}:\n`;
        
        // Add relevant conversations
        if (peerResult.result.conversations && peerResult.result.conversations.length > 0) {
          collaborativePrompt += "Related conversations:\n";
          peerResult.result.conversations.slice(0, 2).forEach((conv, j) => {
            collaborativePrompt += `- User: ${conv.input.substring(0, 100)}${conv.input.length > 100 ? '...' : ''}\n`;
            collaborativePrompt += `  Response: ${conv.response.substring(0, 100)}${conv.response.length > 100 ? '...' : ''}\n`;
          });
          
          if (peerResult.result.conversations.length > 2) {
            collaborativePrompt += `... and ${peerResult.result.conversations.length - 2} more conversations\n`;
          }
        }
        
        // Add market events
        if (peerResult.result.marketEvents && peerResult.result.marketEvents.length > 0) {
          collaborativePrompt += "Market events:\n";
          peerResult.result.marketEvents.slice(0, 3).forEach((event, j) => {
            const date = new Date(event.timestamp).toLocaleDateString();
            collaborativePrompt += `- ${date}: ${event.description}\n`;
          });
          
          if (peerResult.result.marketEvents.length > 3) {
            collaborativePrompt += `... and ${peerResult.result.marketEvents.length - 3} more events\n`;
          }
        }
      });
      
      console.log(`Received collaborative insights from ${results.length} HIVE peers`);
      return collaborativePrompt;
    } catch (error) {
      console.error('Error in collaborative HIVE query:', error);
      return '';
    }
  }

  async sendMessage(content) {
    if (!this.initialized) {
      await this.initialize();
    }

    const analysis = await this.analyzeQuery(content);
    let response;

    try {
      // Query HIVE for additional knowledge with timeout
      let hiveKnowledge = '';
      let hiveCollaborativeInsights = '';
      
      if (this.enableHive && this.hiveInitialized) {
        // Use Promise.race to implement timeout
        const hiveKnowledgePromise = this.queryHiveKnowledge(content, analysis.type);
        const hiveTimeout = new Promise(resolve => {
          setTimeout(() => resolve(''), ENV.HIVE_TIMEOUT);
        });
        
        hiveKnowledge = await Promise.race([hiveKnowledgePromise, hiveTimeout]);
        
        // If we got knowledge, also try collaborative insights
        if (hiveKnowledge) {
          const hiveCollabPromise = this.sendCollaborativeQuery(content, analysis.type);
          hiveCollaborativeInsights = await Promise.race([hiveCollabPromise, hiveTimeout]);
        }
      }
      
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
          
          // Combine local knowledge with HIVE knowledge
          const combinedKnowledge = relevantKnowledge + hiveKnowledge + hiveCollaborativeInsights;
          
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
            const enhancedInstructions = `${this.personality.instructions}\n\n${combinedKnowledge}\n${userProfile}\n\nUse the information above if relevant to the user's query, but don't mention that you're using memory or stored knowledge unless specifically asked.`;
            
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
  
  /**
   * Close the agent and its components
   */
  async close() {
    // Close HIVE if initialized
    if (this.enableHive && this.hiveInitialized) {
      await hiveP2P.close();
    }
    
    // Close database connection
    await database.close();
  }
}
