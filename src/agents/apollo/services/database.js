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
        timestamp INTEGER
      );

      CREATE TABLE IF NOT EXISTS token_interactions (
        address TEXT PRIMARY KEY,
        interaction_count INTEGER,
        last_interaction INTEGER
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        preference_key TEXT PRIMARY KEY,
        preference_value TEXT,
        last_updated INTEGER
      );
    `);
  }

  async storeConversation(input, response, queryType) {
    await this.db.run(
      'INSERT INTO conversations (input, response, query_type, timestamp) VALUES (?, ?, ?, ?)',
      [input, response, queryType, Date.now()]
    );
  }

  async updateTokenInteraction(address) {
    await this.db.run(`
      INSERT INTO token_interactions (address, interaction_count, last_interaction)
      VALUES (?, 1, ?)
      ON CONFLICT(address) DO UPDATE SET
        interaction_count = interaction_count + 1,
        last_interaction = ?
    `, [address, Date.now(), Date.now()]);
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

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

export const database = new Database(); 