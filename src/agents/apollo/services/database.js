import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    this.db = await open({
      filename: './apollo_memory.db',
      driver: sqlite3.Database
    });

    // Create tables if they don't exist
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        input TEXT,
        response TEXT,
        query_type TEXT,
        timestamp INTEGER,
        sentiment REAL,
        importance_score INTEGER DEFAULT 0,
        tags TEXT
      );

      CREATE TABLE IF NOT EXISTS token_interactions (
        address TEXT PRIMARY KEY,
        interaction_count INTEGER,
        last_interaction INTEGER,
        sentiment_score REAL DEFAULT 0,
        user_interest_level INTEGER DEFAULT 1,
        related_tokens TEXT
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        preference_key TEXT PRIMARY KEY,
        preference_value TEXT,
        last_updated INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS knowledge_entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_value TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        UNIQUE(entity_type, entity_value)
      );
      
      CREATE TABLE IF NOT EXISTS entity_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_entity_id INTEGER NOT NULL,
        relation_type TEXT NOT NULL,
        target_entity_id INTEGER NOT NULL,
        strength REAL DEFAULT 1.0,
        created_at INTEGER,
        FOREIGN KEY(source_entity_id) REFERENCES knowledge_entities(id),
        FOREIGN KEY(target_entity_id) REFERENCES knowledge_entities(id),
        UNIQUE(source_entity_id, relation_type, target_entity_id)
      );
      
      CREATE TABLE IF NOT EXISTS market_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        related_token TEXT,
        description TEXT,
        impact_score INTEGER,
        timestamp INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS semantic_vectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL,
        source_id INTEGER NOT NULL,
        term TEXT NOT NULL,
        importance REAL DEFAULT 1.0,
        UNIQUE(source_type, source_id, term)
      );
    `);
  }

  async storeConversation(input, response, queryType, options = {}) {
    const { sentiment = 0, importance = 0, tags = '' } = options;
    
    const result = await this.db.run(
      'INSERT INTO conversations (input, response, query_type, timestamp, sentiment, importance_score, tags) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [input, response, queryType, Date.now(), sentiment, importance, tags]
    );
    
    // Extract and store key terms for semantic search
    const conversationId = result.lastID;
    if (conversationId) {
      await this.storeSemanticTerms('conversation', conversationId, input + ' ' + response);
    }
    
    return conversationId;
  }

  async updateTokenInteraction(address, options = {}) {
    const { sentiment = 0, interestLevel = 1, relatedTokens = '' } = options;
    
    await this.db.run(`
      INSERT INTO token_interactions (address, interaction_count, last_interaction, sentiment_score, user_interest_level, related_tokens)
      VALUES (?, 1, ?, ?, ?, ?)
      ON CONFLICT(address) DO UPDATE SET
        interaction_count = interaction_count + 1,
        last_interaction = ?,
        sentiment_score = (sentiment_score + ?) / 2,
        user_interest_level = MAX(user_interest_level, ?),
        related_tokens = ?
    `, [address, Date.now(), sentiment, interestLevel, relatedTokens, Date.now(), sentiment, interestLevel, relatedTokens]);
  }

  async recordMarketEvent(eventType, relatedToken, description, impactScore = 3) {
    await this.db.run(
      'INSERT INTO market_events (event_type, related_token, description, impact_score, timestamp) VALUES (?, ?, ?, ?, ?)',
      [eventType, relatedToken, description, impactScore, Date.now()]
    );
  }

  async storeEntity(entityType, entityValue, metadata = {}) {
    const metadataString = JSON.stringify(metadata);
    const now = Date.now();
    
    const result = await this.db.run(
      'INSERT INTO knowledge_entities (entity_type, entity_value, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(entity_type, entity_value) DO UPDATE SET metadata = ?, updated_at = ?',
      [entityType, entityValue, metadataString, now, now, metadataString, now]
    );
    
    // Get the entity ID (either the newly inserted one or the existing one)
    let entityId;
    if (result.lastID) {
      entityId = result.lastID;
    } else {
      const entity = await this.db.get('SELECT id FROM knowledge_entities WHERE entity_type = ? AND entity_value = ?', [entityType, entityValue]);
      entityId = entity.id;
    }
    
    return entityId;
  }
  
  async createRelationship(sourceEntityId, relationType, targetEntityId, strength = 1.0) {
    await this.db.run(
      'INSERT INTO entity_relationships (source_entity_id, relation_type, target_entity_id, strength, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(source_entity_id, relation_type, target_entity_id) DO UPDATE SET strength = ?, created_at = ?',
      [sourceEntityId, relationType, targetEntityId, strength, Date.now(), strength, Date.now()]
    );
  }
  
  async storeSemanticTerms(sourceType, sourceId, text) {
    // This is a very basic implementation - in a real system, you'd use proper NLP
    // But for a simple demo without external APIs, this will provide basic functionality
    const terms = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 3 && !['this', 'that', 'with', 'from', 'have', 'what'].includes(term));
    
    // Get unique terms with counts
    const termCounts = {};
    for (const term of terms) {
      termCounts[term] = (termCounts[term] || 0) + 1;
    }
    
    // Store each significant term
    for (const [term, count] of Object.entries(termCounts)) {
      if (count > 0) {
        await this.db.run(
          'INSERT INTO semantic_vectors (source_type, source_id, term, importance) VALUES (?, ?, ?, ?) ON CONFLICT(source_type, source_id, term) DO UPDATE SET importance = ?',
          [sourceType, sourceId, term, count, count]
        );
      }
    }
  }
  
  async searchSemanticMemory(query, limit = 5) {
    // Basic semantic search without ML - finds records with term overlap
    const terms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 3 && !['this', 'that', 'with', 'from', 'have', 'what'].includes(term));
    
    if (terms.length === 0) return [];
    
    // Using a subquery to get relevance scores based on term matches
    const placeholders = terms.map(() => '?').join(',');
    const result = await this.db.all(`
      SELECT c.*, COUNT(sv.term) as relevance 
      FROM conversations c
      JOIN semantic_vectors sv ON sv.source_type = 'conversation' AND sv.source_id = c.id
      WHERE sv.term IN (${placeholders})
      GROUP BY c.id
      ORDER BY relevance DESC, c.importance_score DESC
      LIMIT ?
    `, [...terms, limit]);
    
    return result;
  }

  async getRecentConversations(limit = 5) {
    return await this.db.all(
      'SELECT * FROM conversations ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
  }

  async getPopularTokens(limit = 3) {
    return await this.db.all(
      'SELECT * FROM token_interactions ORDER BY interaction_count DESC LIMIT ?',
      [limit]
    );
  }
  
  async getUserInterests() {
    const tokens = await this.db.all(
      'SELECT address, interaction_count, user_interest_level FROM token_interactions ORDER BY user_interest_level DESC, interaction_count DESC LIMIT 10'
    );
    
    const conversations = await this.db.all(
      'SELECT DISTINCT tags FROM conversations WHERE tags IS NOT NULL AND tags != ""'
    );
    
    const tags = conversations
      .map(c => c.tags.split(','))
      .flat()
      .filter(tag => tag.trim() !== '')
      .reduce((acc, tag) => {
        const trimmedTag = tag.trim();
        acc[trimmedTag] = (acc[trimmedTag] || 0) + 1;
        return acc;
      }, {});
    
    return {
      tokens,
      interests: Object.entries(tags)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => ({ tag, count }))
        .slice(0, 10)
    };
  }
  
  async getRelatedEntities(entityType, entityValue, limit = 5) {
    const entity = await this.db.get(
      'SELECT id FROM knowledge_entities WHERE entity_type = ? AND entity_value = ?',
      [entityType, entityValue]
    );
    
    if (!entity) return [];
    
    return await this.db.all(`
      SELECT ke.entity_type, ke.entity_value, ke.metadata, er.relation_type, er.strength
      FROM entity_relationships er
      JOIN knowledge_entities ke ON er.target_entity_id = ke.id
      WHERE er.source_entity_id = ?
      ORDER BY er.strength DESC
      LIMIT ?
    `, [entity.id, limit]);
  }
  
  async getRecentMarketEvents(limit = 10) {
    return await this.db.all(
      'SELECT * FROM market_events ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

export const database = new Database(); 
