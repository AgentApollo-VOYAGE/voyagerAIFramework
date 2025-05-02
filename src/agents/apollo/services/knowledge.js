import { database } from './database.js';

class KnowledgeManager {
  constructor() {
    this.initialized = false;
    this.entityTypes = {
      TOKEN: 'token',
      WALLET: 'wallet',
      PROJECT: 'project',
      EXCHANGE: 'exchange',
      MARKET_EVENT: 'market_event',
      CONCEPT: 'concept'
    };
    
    this.relationTypes = {
      BELONGS_TO: 'belongs_to',
      CREATED_BY: 'created_by',
      CORRELATED_WITH: 'correlated_with',
      IMPACTS: 'impacts',
      TRADED_ON: 'traded_on',
      SIMILAR_TO: 'similar_to',
      CONTRADICTS: 'contradicts',
      HAS_ATTRIBUTE: 'has_attribute'
    };
  }
  
  async initialize() {
    if (!this.initialized) {
      // Make sure the database is initialized
      if (!database.db) {
        await database.initialize();
      }
      
      // Seed some basic crypto concepts if they don't exist yet
      await this.seedBasicConcepts();
      
      this.initialized = true;
    }
  }
  
  async seedBasicConcepts() {
    // Add some basic crypto concepts and their relationships
    const concepts = [
      { type: this.entityTypes.CONCEPT, value: 'liquidity', metadata: { description: 'The degree to which an asset can be quickly bought or sold without affecting its price' } },
      { type: this.entityTypes.CONCEPT, value: 'market cap', metadata: { description: 'The total value of all tokens in circulation' } },
      { type: this.entityTypes.CONCEPT, value: 'volume', metadata: { description: 'The amount of tokens traded in a given period' } },
      { type: this.entityTypes.CONCEPT, value: 'volatility', metadata: { description: 'The degree of variation in a trading price over time' } },
      { type: this.entityTypes.CONCEPT, value: 'bullish', metadata: { description: 'Expecting prices to rise' } },
      { type: this.entityTypes.CONCEPT, value: 'bearish', metadata: { description: 'Expecting prices to fall' } },
      { type: this.entityTypes.CONCEPT, value: 'smart contract', metadata: { description: 'Self-executing contract with the terms directly written into code' } },
      { type: this.entityTypes.CONCEPT, value: 'token economics', metadata: { description: 'The system of incentives that governs a token ecosystem' } }
    ];
    
    // Store all concepts
    const conceptIds = {};
    for (const concept of concepts) {
      conceptIds[concept.value] = await database.storeEntity(concept.type, concept.value, concept.metadata);
    }
    
    // Create some relationships between concepts
    const relationships = [
      { source: 'liquidity', relation: this.relationTypes.IMPACTS, target: 'volatility', strength: 0.8 },
      { source: 'market cap', relation: this.relationTypes.CORRELATED_WITH, target: 'liquidity', strength: 0.7 },
      { source: 'volume', relation: this.relationTypes.IMPACTS, target: 'liquidity', strength: 0.9 },
      { source: 'bullish', relation: this.relationTypes.CONTRADICTS, target: 'bearish', strength: 1.0 },
      { source: 'smart contract', relation: this.relationTypes.HAS_ATTRIBUTE, target: 'token economics', strength: 0.6 }
    ];
    
    // Create relationships
    for (const rel of relationships) {
      if (conceptIds[rel.source] && conceptIds[rel.target]) {
        await database.createRelationship(
          conceptIds[rel.source],
          rel.relation,
          conceptIds[rel.target],
          rel.strength
        );
      }
    }
  }
  
  /**
   * Analyzes a conversation and extracts entities and concepts
   * @param {string} input - User input
   * @param {string} response - Agent response
   * @param {string} queryType - Type of query
   * @returns {object} - Analysis results
   */
  async analyzeConversation(input, response, queryType) {
    // A more advanced implementation would use NLP for entity extraction
    // This is a simple rule-based implementation
    
    const combinedText = `${input} ${response}`.toLowerCase();
    const entities = [];
    
    // Simple entity extraction for demonstration
    // Extract token addresses (simplified pattern)
    const tokenAddressRegex = /0x[a-f0-9]{40}/g;
    const tokenAddresses = combinedText.match(tokenAddressRegex) || [];
    
    for (const address of tokenAddresses) {
      entities.push({
        type: this.entityTypes.TOKEN,
        value: address,
        metadata: { extracted_from: 'conversation' }
      });
    }
    
    // Extract wallet addresses (simplified, assuming similar pattern to tokens for demo)
    // In real implementation, you would have better validation
    const walletAddressRegex = /[a-zA-Z0-9]{40,45}/g;
    const potentialWallets = combinedText.match(walletAddressRegex) || [];
    
    for (const wallet of potentialWallets) {
      if (!tokenAddresses.includes(wallet)) {
        entities.push({
          type: this.entityTypes.WALLET,
          value: wallet,
          metadata: { extracted_from: 'conversation' }
        });
      }
    }
    
    // Extract known concepts
    const conceptMatches = await this.matchConceptsInText(combinedText);
    entities.push(...conceptMatches);
    
    // Extract market sentiment
    const sentimentScore = this.analyzeSentiment(combinedText);
    
    // Extract topics/tags
    const tags = this.extractTags(combinedText);
    
    // Calculate importance score (1-10)
    const importanceScore = this.calculateImportance(entities.length, sentimentScore, queryType);
    
    // Store everything
    const conversationId = await database.storeConversation(input, response, queryType, {
      sentiment: sentimentScore,
      importance: importanceScore,
      tags: tags.join(',')
    });
    
    // Store entities and create relationships
    await this.storeEntitiesAndRelationships(entities);
    
    return {
      conversationId,
      entities,
      sentiment: sentimentScore,
      importance: importanceScore,
      tags
    };
  }
  
  /**
   * Matches text against known concepts in the knowledge base
   */
  async matchConceptsInText(text) {
    const matches = [];
    
    // Get all concepts from the database
    const concepts = await database.db.all(
      'SELECT id, entity_value, metadata FROM knowledge_entities WHERE entity_type = ?',
      [this.entityTypes.CONCEPT]
    );
    
    for (const concept of concepts) {
      // Simple string matching - a more advanced implementation would use NLP
      if (text.includes(concept.entity_value.toLowerCase())) {
        matches.push({
          type: this.entityTypes.CONCEPT,
          value: concept.entity_value,
          metadata: JSON.parse(concept.metadata || '{}'),
          existing_id: concept.id
        });
      }
    }
    
    return matches;
  }
  
  /**
   * Very basic sentiment analysis
   * A real implementation would use a more sophisticated approach
   */
  analyzeSentiment(text) {
    const positiveWords = ['bullish', 'green', 'pumping', 'moon', 'profit', 'gain', 'good', 'great', 'excellent', 'up', 'increase', 'growth'];
    const negativeWords = ['bearish', 'red', 'dumping', 'crash', 'loss', 'bad', 'terrible', 'poor', 'down', 'decrease', 'drop', 'falling'];
    
    let score = 0;
    const words = text.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    }
    
    // Clamp between -1 and 1
    return Math.max(-1, Math.min(1, score));
  }
  
  /**
   * Extract tags from text
   */
  extractTags(text) {
    // Predefined categories that might be relevant in crypto discussions
    const tagCategories = {
      'trading': ['buy', 'sell', 'trade', 'long', 'short', 'position', 'entry', 'exit'],
      'analysis': ['chart', 'technical', 'fundamental', 'analysis', 'indicator', 'pattern'],
      'defi': ['defi', 'yield', 'farm', 'staking', 'liquidity', 'pool', 'swap', 'amm'],
      'news': ['announcement', 'launch', 'release', 'news', 'update', 'partnership'],
      'risk': ['risk', 'scam', 'rugpull', 'caution', 'warning', 'safe', 'unsafe'],
      'nft': ['nft', 'collectible', 'art', 'mint', 'marketplace'],
      'meme': ['meme', 'doge', 'shib', 'pepe', 'dog', 'moon'],
      'solana': ['solana', 'sol', 'spl']
    };
    
    const tags = [];
    const words = text.toLowerCase().split(/\s+/);
    
    // Check for category matches
    for (const [category, keywords] of Object.entries(tagCategories)) {
      for (const keyword of keywords) {
        if (words.includes(keyword)) {
          tags.push(category);
          break;
        }
      }
    }
    
    // Add query-specific tags
    if (text.includes('price') || text.includes('worth')) tags.push('price-inquiry');
    if (text.includes('wallet') || text.includes('portfolio')) tags.push('portfolio');
    if (text.includes('when') || text.includes('future')) tags.push('prediction');
    
    return [...new Set(tags)]; // Remove duplicates
  }
  
  /**
   * Calculate conversation importance (1-10)
   */
  calculateImportance(entityCount, sentiment, queryType) {
    let score = 5; // Default medium importance
    
    // More entities mentioned = more important conversation
    score += Math.min(3, entityCount);
    
    // Strong sentiment (positive or negative) = more important
    score += Math.abs(sentiment) * 2;
    
    // Certain query types are more important
    if (['wallet', 'market', 'swap'].includes(queryType)) {
      score += 1;
    }
    
    // Cap at 1-10 range
    return Math.max(1, Math.min(10, Math.round(score)));
  }
  
  /**
   * Store entities and their relationships
   */
  async storeEntitiesAndRelationships(entities) {
    const entityIds = {};
    
    // First pass: store all entities
    for (const entity of entities) {
      if (entity.existing_id) {
        entityIds[`${entity.type}:${entity.value}`] = entity.existing_id;
      } else {
        const id = await database.storeEntity(entity.type, entity.value, entity.metadata);
        entityIds[`${entity.type}:${entity.value}`] = id;
      }
    }
    
    // Second pass: create relationships between entities
    if (entities.length > 1) {
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const entityA = entities[i];
          const entityB = entities[j];
          
          const idA = entityIds[`${entityA.type}:${entityA.value}`];
          const idB = entityIds[`${entityB.type}:${entityB.value}`];
          
          if (idA && idB) {
            // Determine relationship type based on entity types
            let relationType = this.relationTypes.CORRELATED_WITH; // default
            let strength = 0.5; // default medium strength
            
            if (entityA.type === this.entityTypes.TOKEN && entityB.type === this.entityTypes.CONCEPT) {
              relationType = this.relationTypes.HAS_ATTRIBUTE;
              strength = 0.7;
            } else if (entityA.type === this.entityTypes.WALLET && entityB.type === this.entityTypes.TOKEN) {
              relationType = this.relationTypes.BELONGS_TO;
              strength = 0.9;
            }
            
            // Create bidirectional relationship
            await database.createRelationship(idA, relationType, idB, strength);
          }
        }
      }
    }
  }
  
  /**
   * Records a market event and its relationships to relevant entities
   */
  async recordMarketEvent(eventType, relatedToken, description, impactScore = 3) {
    await database.recordMarketEvent(eventType, relatedToken, description, impactScore);
    
    // Also store as an entity for knowledge graph connections
    const eventEntity = {
      type: this.entityTypes.MARKET_EVENT,
      value: `${eventType}_${Date.now()}`,
      metadata: { description, impact_score: impactScore, token: relatedToken }
    };
    
    const eventId = await database.storeEntity(
      eventEntity.type, 
      eventEntity.value, 
      eventEntity.metadata
    );
    
    // If this relates to a token, create a relationship
    if (relatedToken) {
      const tokenEntity = await database.db.get(
        'SELECT id FROM knowledge_entities WHERE entity_type = ? AND entity_value = ?',
        [this.entityTypes.TOKEN, relatedToken]
      );
      
      if (tokenEntity) {
        await database.createRelationship(
          eventId,
          this.relationTypes.IMPACTS,
          tokenEntity.id,
          impactScore / 10 // Scale to 0-1 range
        );
      }
    }
    
    return eventId;
  }
  
  /**
   * Search for relevant memories based on query
   */
  async searchMemory(query, options = {}) {
    const { limit = 5, includeEntities = true } = options;
    
    // Get semantically related conversations
    const conversations = await database.searchSemanticMemory(query, limit);
    
    let entities = [];
    if (includeEntities) {
      // Extract and match concepts from the query
      const conceptMatches = await this.matchConceptsInText(query);
      
      // Get related entities for matched concepts
      for (const concept of conceptMatches) {
        const related = await database.getRelatedEntities(
          concept.type, 
          concept.value, 
          Math.ceil(limit / conceptMatches.length)
        );
        entities.push(...related);
      }
    }
    
    // Get recent market events
    const marketEvents = await database.getRecentMarketEvents(limit);
    
    return {
      conversations,
      entities,
      marketEvents
    };
  }
  
  /**
   * Get user preferences and interests based on interaction history
   */
  async getUserKnowledge() {
    return await database.getUserInterests();
  }
}

export const knowledgeManager = new KnowledgeManager(); 
