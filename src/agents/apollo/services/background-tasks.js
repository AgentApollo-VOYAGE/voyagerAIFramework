import { database } from './database.js';
import { hiveP2P } from './hive-p2p.js';
import { ENV } from '../../config/env.js';
import { BACKGROUND_TASK_CONFIG } from '../../config/background-tasks.js';

/**
 * Background Task Manager for Apollo Agent
 * 
 * Handles various background operations:
 * - Knowledge base maintenance
 * - Market data monitoring
 * - User preference learning
 * - HIVE mind synchronization
 * - Database cleanup and optimization
 */
class BackgroundTaskManager {
  constructor() {
    this.tasks = new Map();
    this.running = false;
    this.taskIntervals = new Map();
    
    // Task configurations - use external config with environment overrides
    this.taskConfig = { ...BACKGROUND_TASK_CONFIG };
    
    // Override HIVE sync based on environment setting
    if (this.taskConfig.hiveSync) {
      this.taskConfig.hiveSync.enabled = ENV.ENABLE_HIVE;
    }
  }

  /**
   * Initialize the background task manager
   */
  async initialize() {
    console.log('Initializing Background Task Manager...');
    
    // Register all tasks
    this.registerTasks();
    
    // Start the task manager
    await this.start();
    
    console.log('Background Task Manager initialized successfully');
  }

  /**
   * Register all background tasks
   */
  registerTasks() {
    // Knowledge base maintenance
    this.registerTask('knowledgeMaintenance', async () => {
      try {
        console.log('Running knowledge maintenance...');
        
        // Clean up old semantic vectors
        await this.cleanupOldSemanticVectors();
        
        // Optimize entity relationships
        await this.optimizeEntityRelationships();
        
        // Update knowledge relevance scores
        await this.updateKnowledgeRelevance();
        
        console.log('Knowledge maintenance completed');
      } catch (error) {
        console.error('Error in knowledge maintenance:', error);
      }
    });

    // Market monitoring
    this.registerTask('marketMonitoring', async () => {
      try {
        console.log('Running market monitoring...');
        
        // Check for new market events
        await this.checkMarketEvents();
        
        // Update token sentiment scores
        await this.updateTokenSentiment();
        
        // Analyze market trends
        await this.analyzeMarketTrends();
        
        console.log('Market monitoring completed');
      } catch (error) {
        console.error('Error in market monitoring:', error);
      }
    });

    // User learning
    this.registerTask('userLearning', async () => {
      try {
        console.log('Running user learning...');
        
        // Analyze conversation patterns
        await this.analyzeConversationPatterns();
        
        // Update user preferences
        await this.updateUserPreferences();
        
        // Learn from interaction patterns
        await this.learnFromInteractions();
        
        console.log('User learning completed');
      } catch (error) {
        console.error('Error in user learning:', error);
      }
    });

    // HIVE synchronization
    this.registerTask('hiveSync', async () => {
      try {
        if (!ENV.ENABLE_HIVE) return;
        
        console.log('Running HIVE synchronization...');
        
        // Share new knowledge with peers
        await this.shareNewKnowledge();
        
        // Request knowledge from peers
        await this.requestPeerKnowledge();
        
        // Update peer status
        await this.updatePeerStatus();
        
        console.log('HIVE synchronization completed');
      } catch (error) {
        console.error('Error in HIVE synchronization:', error);
      }
    });

    // Database cleanup
    this.registerTask('databaseCleanup', async () => {
      try {
        console.log('Running database cleanup...');
        
        // Clean old conversations
        await this.cleanupOldConversations();
        
        // Optimize database
        await this.optimizeDatabase();
        
        // Archive old data
        await this.archiveOldData();
        
        console.log('Database cleanup completed');
      } catch (error) {
        console.error('Error in database cleanup:', error);
      }
    });

    // Sentiment analysis
    this.registerTask('sentimentAnalysis', async () => {
      try {
        console.log('Running sentiment analysis...');
        
        // Analyze recent conversations
        await this.analyzeRecentSentiment();
        
        // Update token sentiment trends
        await this.updateSentimentTrends();
        
        // Generate sentiment reports
        await this.generateSentimentReport();
        
        console.log('Sentiment analysis completed');
      } catch (error) {
        console.error('Error in sentiment analysis:', error);
      }
    });
  }

  /**
   * Register a single task
   */
  registerTask(name, taskFunction) {
    this.tasks.set(name, taskFunction);
    console.log(`Registered task: ${name}`);
  }

  /**
   * Start the background task manager
   */
  async start() {
    if (this.running) {
      console.log('Background Task Manager is already running');
      return;
    }

    this.running = true;
    console.log('Starting Background Task Manager...');

    // Start each enabled task
    for (const [taskName, config] of Object.entries(this.taskConfig)) {
      if (config.enabled && this.tasks.has(taskName)) {
        await this.startTask(taskName, config.interval);
      }
    }
  }

  /**
   * Start a specific task
   */
  async startTask(taskName, interval) {
    const task = this.tasks.get(taskName);
    if (!task) {
      console.error(`Task ${taskName} not found`);
      return;
    }

    // Run the task immediately
    await task();

    // Schedule the task to run periodically
    const intervalId = setInterval(async () => {
      try {
        await task();
      } catch (error) {
        console.error(`Error in task ${taskName}:`, error);
      }
    }, interval);

    this.taskIntervals.set(taskName, intervalId);
    console.log(`Started task: ${taskName} (interval: ${interval}ms)`);
  }

  /**
   * Stop the background task manager
   */
  stop() {
    if (!this.running) {
      console.log('Background Task Manager is not running');
      return;
    }

    console.log('Stopping Background Task Manager...');

    // Clear all intervals
    for (const [taskName, intervalId] of this.taskIntervals) {
      clearInterval(intervalId);
      console.log(`Stopped task: ${taskName}`);
    }

    this.taskIntervals.clear();
    this.running = false;
    console.log('Background Task Manager stopped');
  }

  /**
   * Stop a specific task
   */
  stopTask(taskName) {
    const intervalId = this.taskIntervals.get(taskName);
    if (intervalId) {
      clearInterval(intervalId);
      this.taskIntervals.delete(taskName);
      console.log(`Stopped task: ${taskName}`);
    }
  }

  /**
   * Get task status
   */
  getTaskStatus() {
    const status = {};
    for (const [taskName, config] of Object.entries(this.taskConfig)) {
      status[taskName] = {
        enabled: config.enabled,
        running: this.taskIntervals.has(taskName),
        description: config.description,
        interval: config.interval
      };
    }
    return status;
  }

  // Task implementations

  async cleanupOldSemanticVectors() {
    // Remove semantic vectors older than 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    await database.db.run(
      'DELETE FROM semantic_vectors WHERE source_type = "conversation" AND source_id IN (SELECT id FROM conversations WHERE timestamp < ?)',
      [thirtyDaysAgo]
    );
  }

  async optimizeEntityRelationships() {
    // Remove weak relationships (strength < 0.1)
    await database.db.run(
      'DELETE FROM entity_relationships WHERE strength < 0.1'
    );
  }

  async updateKnowledgeRelevance() {
    // Update importance scores based on recent usage
    await database.db.run(`
      UPDATE semantic_vectors 
      SET importance = importance * 0.95 
      WHERE source_type = "conversation" 
      AND source_id IN (SELECT id FROM conversations WHERE timestamp < ?)
    `, [Date.now() - (7 * 24 * 60 * 60 * 1000)]);
  }

  async checkMarketEvents() {
    // This would integrate with external market APIs
    // For now, just log that we're checking
    console.log('Checking for new market events...');
  }

  async updateTokenSentiment() {
    // Update token sentiment based on recent interactions
    await database.db.run(`
      UPDATE token_interactions 
      SET sentiment_score = (
        SELECT AVG(sentiment) 
        FROM conversations 
        WHERE input LIKE '%' || address || '%' 
        AND timestamp > ?
      )
      WHERE last_interaction > ?
    `, [Date.now() - (24 * 60 * 60 * 1000), Date.now() - (7 * 24 * 60 * 60 * 1000)]);
  }

  async analyzeMarketTrends() {
    // Analyze market trends from stored events
    const recentEvents = await database.getRecentMarketEvents(50);
    console.log(`Analyzing ${recentEvents.length} recent market events`);
  }

  async analyzeConversationPatterns() {
    // Analyze conversation patterns for learning
    const recentConversations = await database.getRecentConversations(100);
    console.log(`Analyzing ${recentConversations.length} recent conversations`);
  }

  async updateUserPreferences() {
    // Update user preferences based on recent interactions
    const userInterests = await database.getUserInterests();
    console.log('Updated user preferences:', userInterests);
  }

  async learnFromInteractions() {
    // Learn from user interaction patterns
    console.log('Learning from user interactions...');
  }

  async shareNewKnowledge() {
    if (!ENV.ENABLE_HIVE) return;
    
    // Share new entities with HIVE peers
    const recentEntities = await database.db.all(
      'SELECT * FROM knowledge_entities WHERE updated_at > ?',
      [Date.now() - (5 * 60 * 1000)] // Last 5 minutes
    );
    
    for (const entity of recentEntities) {
      await hiveP2P.shareEntity(entity);
    }
  }

  async requestPeerKnowledge() {
    if (!ENV.ENABLE_HIVE) return;
    
    // Request knowledge from peers
    console.log('Requesting knowledge from HIVE peers...');
  }

  async updatePeerStatus() {
    if (!ENV.ENABLE_HIVE) return;
    
    // Update peer status and health
    console.log('Updating peer status...');
  }

  async cleanupOldConversations() {
    // Remove conversations older than 90 days
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    await database.db.run(
      'DELETE FROM conversations WHERE timestamp < ?',
      [ninetyDaysAgo]
    );
  }

  async optimizeDatabase() {
    // Run database optimization
    await database.db.run('VACUUM');
    await database.db.run('ANALYZE');
  }

  async archiveOldData() {
    // Archive old data (could move to separate tables or files)
    console.log('Archiving old data...');
  }

  async analyzeRecentSentiment() {
    // Analyze sentiment from recent conversations
    const recentConversations = await database.db.all(
      'SELECT * FROM conversations WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 50',
      [Date.now() - (24 * 60 * 60 * 1000)]
    );
    
    console.log(`Analyzing sentiment for ${recentConversations.length} recent conversations`);
  }

  async updateSentimentTrends() {
    // Update sentiment trends
    console.log('Updating sentiment trends...');
  }

  async generateSentimentReport() {
    // Generate sentiment analysis report
    console.log('Generating sentiment report...');
  }
}

export const backgroundTaskManager = new BackgroundTaskManager();
