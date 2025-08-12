/**
 * Background Tasks Configuration
 * 
 * This file contains configuration for all background tasks in the Voyager AI Framework.
 * You can easily modify intervals, enable/disable tasks, and add new tasks here.
 */

export const BACKGROUND_TASK_CONFIG = {
  // Knowledge base maintenance - keeps the knowledge base clean and optimized
  knowledgeMaintenance: {
    interval: 5 * 60 * 1000, // 5 minutes
    enabled: true,
    description: 'Maintain and optimize knowledge base',
    priority: 'high',
    category: 'maintenance'
  },

  // Market monitoring - tracks market events and trends
  marketMonitoring: {
    interval: 2 * 60 * 1000, // 2 minutes
    enabled: true,
    description: 'Monitor market events and trends',
    priority: 'high',
    category: 'monitoring'
  },

  // User learning - learns from user interactions
  userLearning: {
    interval: 10 * 60 * 1000, // 10 minutes
    enabled: true,
    description: 'Learn from user interactions and preferences',
    priority: 'medium',
    category: 'learning'
  },

  // HIVE synchronization - syncs with other AI agents
  hiveSync: {
    interval: 30 * 1000, // 30 seconds
    enabled: true, // Will be overridden by ENV.ENABLE_HIVE
    description: 'Synchronize with HIVE mind peers',
    priority: 'high',
    category: 'networking'
  },

  // Database cleanup - maintains database performance
  databaseCleanup: {
    interval: 60 * 60 * 1000, // 1 hour
    enabled: true,
    description: 'Clean up old data and optimize database',
    priority: 'medium',
    category: 'maintenance'
  },

  // Sentiment analysis - analyzes conversation sentiment
  sentimentAnalysis: {
    interval: 15 * 60 * 1000, // 15 minutes
    enabled: true,
    description: 'Analyze sentiment trends from conversations',
    priority: 'medium',
    category: 'analysis'
  },

  // Token price monitoring - tracks token prices
  tokenPriceMonitoring: {
    interval: 1 * 60 * 1000, // 1 minute
    enabled: false, // Disabled by default to avoid API rate limits
    description: 'Monitor token prices and alert on significant changes',
    priority: 'medium',
    category: 'monitoring'
  },

  // Conversation archiving - archives old conversations
  conversationArchiving: {
    interval: 24 * 60 * 60 * 1000, // 24 hours
    enabled: true,
    description: 'Archive old conversations to save storage space',
    priority: 'low',
    category: 'maintenance'
  },

  // Performance metrics - collects performance data
  performanceMetrics: {
    interval: 5 * 60 * 1000, // 5 minutes
    enabled: true,
    description: 'Collect and store performance metrics',
    priority: 'low',
    category: 'monitoring'
  },

  // Knowledge sharing - shares knowledge with external systems
  knowledgeSharing: {
    interval: 30 * 60 * 1000, // 30 minutes
    enabled: false, // Disabled by default
    description: 'Share knowledge with external systems and APIs',
    priority: 'low',
    category: 'networking'
  }
};

/**
 * Task Categories
 */
export const TASK_CATEGORIES = {
  maintenance: {
    name: 'Maintenance',
    description: 'System maintenance and optimization tasks',
    color: '#3498db'
  },
  monitoring: {
    name: 'Monitoring',
    description: 'Real-time monitoring and alerting tasks',
    color: '#e74c3c'
  },
  learning: {
    name: 'Learning',
    description: 'Machine learning and pattern recognition tasks',
    color: '#9b59b6'
  },
  networking: {
    name: 'Networking',
    description: 'Communication and synchronization tasks',
    color: '#f39c12'
  },
  analysis: {
    name: 'Analysis',
    description: 'Data analysis and processing tasks',
    color: '#27ae60'
  }
};

/**
 * Priority Levels
 */
export const PRIORITY_LEVELS = {
  high: {
    name: 'High',
    description: 'Critical tasks that should run frequently',
    color: '#e74c3c'
  },
  medium: {
    name: 'Medium',
    description: 'Important tasks that run periodically',
    color: '#f39c12'
  },
  low: {
    name: 'Low',
    description: 'Background tasks that run occasionally',
    color: '#27ae60'
  }
};

/**
 * Get configuration for a specific task
 */
export function getTaskConfig(taskName) {
  return BACKGROUND_TASK_CONFIG[taskName] || null;
}

/**
 * Get all enabled tasks
 */
export function getEnabledTasks() {
  return Object.entries(BACKGROUND_TASK_CONFIG)
    .filter(([name, config]) => config.enabled)
    .reduce((acc, [name, config]) => {
      acc[name] = config;
      return acc;
    }, {});
}

/**
 * Get tasks by category
 */
export function getTasksByCategory() {
  const tasksByCategory = {};
  
  Object.entries(BACKGROUND_TASK_CONFIG).forEach(([name, config]) => {
    const category = config.category;
    if (!tasksByCategory[category]) {
      tasksByCategory[category] = [];
    }
    tasksByCategory[category].push({ name, ...config });
  });
  
  return tasksByCategory;
}

/**
 * Get tasks by priority
 */
export function getTasksByPriority() {
  const tasksByPriority = {};
  
  Object.entries(BACKGROUND_TASK_CONFIG).forEach(([name, config]) => {
    const priority = config.priority;
    if (!tasksByPriority[priority]) {
      tasksByPriority[priority] = [];
    }
    tasksByPriority[priority].push({ name, ...config });
  });
  
  return tasksByPriority;
}

/**
 * Validate task configuration
 */
export function validateTaskConfig() {
  const errors = [];
  
  Object.entries(BACKGROUND_TASK_CONFIG).forEach(([name, config]) => {
    if (!config.interval || config.interval < 1000) {
      errors.push(`Task ${name}: Invalid interval (must be at least 1000ms)`);
    }
    
    if (!config.description) {
      errors.push(`Task ${name}: Missing description`);
    }
    
    if (!config.priority || !PRIORITY_LEVELS[config.priority]) {
      errors.push(`Task ${name}: Invalid priority level`);
    }
    
    if (!config.category || !TASK_CATEGORIES[config.category]) {
      errors.push(`Task ${name}: Invalid category`);
    }
  });
  
  return errors;
}
