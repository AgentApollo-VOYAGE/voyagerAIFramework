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
    
    // Callback function for when new entities are created
    this.onNewEntity = null;
    
    // Track entity counts by category for HIVE trust calculations
    this.entityCountByCategory = {};
    this.peerExpertise = {};
  }
  
  async initialize() {
    if (!this.initialized) {
      // Make sure the database is initialized
      if (!database.db) {
        await database.initialize();
      }
      
      // Seed some basic crypto concepts if they don't exist yet
      await this.seedBasicConcepts();
      
      // Load entity counts by category for HIVE trust calculations
      await this.loadEntityCounts();
      
      this.initialized = true;
    }
  }
  
  async loadEntityCounts() {
    // Get counts of entities by type
    const results = await database.db.all(
      'SELECT entity_type, COUNT(*) as count FROM knowledge_entities GROUP BY entity_type'
    );
    
    for (const row of results) {
      const category = this.entityTypeToCategory(row.entity_type);
      this.entityCountByCategory[category] = row.count;
    }
  }
  
  entityTypeToCategory(entityType) {
    // Map entity types to categories
    const typeToCategory = {
      'token': 'tokens',
      'wallet': 'wallets',
      'project': 'projects',
      'exchange': 'exchanges',
      'market_event': 'market_events',
      'concept': 'concepts'
    };
    
    return typeToCategory[entityType] || entityType;
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
    const entityIds = await this.storeEntitiesAndRelationships(entities);
    
    // Notify about new entities via callback (for HIVE sharing)
    if (this.onNewEntity && entityIds.length > 0) {
      for (const entityInfo of entityIds) {
        if (this.onNewEntity) {
          await this.onNewEntity(entityInfo);
        }
      }
    }
    
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
   * @returns {Array} Array of entity information objects
   */
  async storeEntitiesAndRelationships(entities) {
    const entityIds = {};
    const newEntities = [];
    
    // First pass: store all entities
    for (const entity of entities) {
      let id;
      let isNew = false;
      
      if (entity.existing_id) {
        id = entity.existing_id;
      } else {
        // Check if entity already exists
        const existingEntity = await this.getEntityByTypeAndValue(
          entity.type, 
          entity.value
        );
        
        if (existingEntity) {
          id = existingEntity.id;
        } else {
          id = await database.storeEntity(entity.type, entity.value, entity.metadata);
          isNew = true;
          
          // Update category counts
          const category = this.entityTypeToCategory(entity.type);
          this.entityCountByCategory[category] = (this.entityCountByCategory[category] || 0) + 1;
        }
      }
      
      entityIds[`${entity.type}:${entity.value}`] = id;
      
      if (isNew) {
        newEntities.push({
          id,
          type: entity.type,
          value: entity.value,
          metadata: entity.metadata
        });
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
    
    return newEntities;
  }
  
  /**
   * Get entity by type and value
   */
  async getEntityByTypeAndValue(type, value) {
    return await database.db.get(
      'SELECT * FROM knowledge_entities WHERE entity_type = ? AND entity_value = ?',
      [type, value]
    );
  }
  
  /**
   * Get entity by ID
   */
  async getEntityById(id) {
    return await database.db.get(
      'SELECT * FROM knowledge_entities WHERE id = ?',
      [id]
    );
  }
  
  /**
   * Update entity metadata
   */
  async updateEntityMetadata(id, metadata) {
    const metadataString = JSON.stringify(metadata);
    await database.db.run(
      'UPDATE knowledge_entities SET metadata = ?, updated_at = ? WHERE id = ?',
      [metadataString, Date.now(), id]
    );
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
    
    // Update category counts
    const category = this.entityTypeToCategory(eventEntity.type);
    this.entityCountByCategory[category] = (this.entityCountByCategory[category] || 0) + 1;
    
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
    
    // Notify about new entity via callback (for HIVE sharing)
    if (this.onNewEntity) {
      await this.onNewEntity({
        id: eventId,
        type: eventEntity.type,
        value: eventEntity.value,
        metadata: eventEntity.metadata
      });
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
  
  /**
   * Get knowledge entities by categories (for HIVE sharing)
   * @param {Array} categories - Categories to retrieve
   * @param {String} query - Optional query to filter entities
   * @returns {Array} - Array of entities
   */
  async getKnowledgeByCategories(categories, query = '') {
    const categoryToType = {
      'tokens': 'token',
      'wallets': 'wallet',
      'projects': 'project',
      'exchanges': 'exchange',
      'market_events': 'market_event',
      'concepts': 'concept'
    };
    
    const entityTypes = categories
      .map(cat => categoryToType[cat] || cat)
      .filter(type => Object.values(this.entityTypes).includes(type));
    
    if (entityTypes.length === 0) {
      return [];
    }
    
    // Create placeholders for SQL query
    const placeholders = entityTypes.map(() => '?').join(',');
    
    let queryClause = '';
    let queryParams = [];
    
    if (query && query.trim() !== '') {
      // Very basic query filtering - in a real implementation, you'd use better search
      queryClause = 'AND (entity_value LIKE ? OR metadata LIKE ?)';
      const queryPattern = `%${query}%`;
      queryParams = [queryPattern, queryPattern];
    }
    
    // Get entities
    const entities = await database.db.all(
      `SELECT id, entity_type, entity_value, metadata, created_at, updated_at 
       FROM knowledge_entities 
       WHERE entity_type IN (${placeholders}) ${queryClause}
       ORDER BY updated_at DESC 
       LIMIT 100`,
      [...entityTypes, ...queryParams]
    );
    
    // Format for sharing
    return entities.map(entity => ({
      id: entity.id,
      type: entity.entity_type,
      value: entity.entity_value,
      metadata: JSON.parse(entity.metadata || '{}'),
      created_at: entity.created_at,
      updated_at: entity.updated_at
    }));
  }
  
  /**
   * Process a shared entity from a HIVE peer
   * @param {Object} entity - The entity data
   * @param {String} sourcePeerId - The peer ID that shared the entity
   * @returns {Boolean} - Whether the entity was processed successfully
   */
  async processSharedEntity(entity, sourcePeerId) {
    try {
      // Check if we already have this entity
      const existingEntity = await this.getEntityByTypeAndValue(
        entity.type,
        entity.value
      );
      
      if (!existingEntity) {
        // If we don't have it, simply add it
        const entityId = await database.storeEntity(
          entity.type,
          entity.value,
          entity.metadata
        );
        
        // Update category counts
        const category = this.entityTypeToCategory(entity.type);
        this.entityCountByCategory[category] = (this.entityCountByCategory[category] || 0) + 1;
        
        // Track that this entity came from a peer
        await this.trackPeerEntity(entityId, sourcePeerId);
        
        return true;
      } else {
        // Only update if our data is older or less detailed
        const ourMetadata = JSON.parse(existingEntity.metadata || '{}');
        const theirMetadata = entity.metadata;
        
        const ourSize = Object.keys(ourMetadata).length;
        const theirSize = Object.keys(theirMetadata).length;
        
        // Simple heuristic: more fields = better data
        if (theirSize > ourSize) {
          await this.updateEntityMetadata(existingEntity.id, theirMetadata);
          
          // Track that this entity was updated from a peer
          await this.trackPeerEntity(existingEntity.id, sourcePeerId);
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error processing shared entity:', error);
      return false;
    }
  }
  
  /**
   * Track an entity received from a peer
   * @param {Number} entityId - The entity ID
   * @param {String} peerId - The peer ID
   */
  async trackPeerEntity(entityId, peerId) {
    try {
      // We would need to add a peer_entities table to the database
      // This is simplified for demonstration
      console.log(`Entity ${entityId} received from peer ${peerId}`);
      
      // Update peer expertise
      const entity = await this.getEntityById(entityId);
      if (entity) {
        const category = this.entityTypeToCategory(entity.entity_type);
        
        if (!this.peerExpertise[peerId]) {
          this.peerExpertise[peerId] = {};
        }
        
        if (!this.peerExpertise[peerId][category]) {
          this.peerExpertise[peerId][category] = 0;
        }
        
        // Increase expertise for this category
        this.peerExpertise[peerId][category] += 1;
        
        // Cap to reasonable range
        this.peerExpertise[peerId][category] = Math.min(20, this.peerExpertise[peerId][category]);
      }
    } catch (error) {
      console.error('Error tracking peer entity:', error);
    }
  }
  
  /**
   * Process a query using local knowledge (for HIVE collaborative queries)
   * @param {String} content - The query content
   * @param {Array} categories - The categories to search in
   * @returns {Object} - The query result
   */
  async processQuery(content, categories) {
    try {
      // This is a simplified implementation - in a real system, you'd process
      // the query more intelligently
      
      // Search for relevant information in our knowledge base
      const searchResults = await this.searchMemory(content, {
        limit: 10,
        includeEntities: true
      });
      
      // Format the results for sharing
      return {
        conversations: searchResults.conversations.map(conv => ({
          input: conv.input,
          response: conv.response,
          relevance: conv.relevance
        })),
        
        entities: searchResults.entities.map(entity => ({
          type: entity.entity_type,
          value: entity.entity_value,
          metadata: JSON.parse(entity.metadata || '{}')
        })),
        
        marketEvents: searchResults.marketEvents.map(event => ({
          eventType: event.event_type,
          relatedToken: event.related_token,
          description: event.description,
          impactScore: event.impact_score,
          timestamp: event.timestamp
        }))
      };
    } catch (error) {
      console.error('Error processing query for HIVE:', error);
      return null;
    }
  }
  
  /**
   * Calculate trust score for a peer in a specific category
   * @param {String} peerId - The peer ID
   * @param {String} category - The knowledge category
   * @returns {Number} - The trust score (0-1)
   */
  calculateCategoryTrust(peerId, category) {
    // Count how many entities we have in this category
    const entriesInCategory = this.entityCountByCategory[category] || 0;
    
    // Basic trust formula: less data means more trust in external sources
    // More data means we trust our own knowledge more
    const selfTrust = Math.min(0.9, 0.5 + (entriesInCategory / 100));
    
    // For known peers, check their category expertise
    const peerExpertise = this.peerExpertise[peerId]?.[category] || 0;
    
    // Combine factors
    const peerTrust = 0.5 + (peerExpertise / 20); // Max 0.5 additional trust
    
    // Return the higher of self-trust or peer-trust
    return Math.max(selfTrust, peerTrust);
  }
}

export const knowledgeManager = new KnowledgeManager(); 
