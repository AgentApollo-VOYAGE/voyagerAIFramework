# Apollo AI Agent Framework

A flexible AI agent framework for crypto analysis with multiple AI provider support and customizable personalities.

## Features
- Multiple AI providers (OpenAI, Anthropic, Google)
- Customizable AI personalities
- Persistent memory with SQLite
- Real-time crypto market analysis
- Sentiment analysis
- Portfolio tracking
- HIVE collaborative intelligence with automatic peer discovery

## Installation

Clone the repository:
   - git clone https://github.com/AgentApollo-VOYAGE/voyagerAIFramework.git
   - cd voyagerAIFramework

Install dependencies:
   - npm install

## CLI Usage

1. Copy the environment template (e.g., `.env.example`) to `.env`
2. Configure your `.env` file with your preferred AI provider and API keys, as well as a trending tokens api endpoint.
3. Run the chat interface:
    ```
    node chat.js
    ```

## HIVE Mind System

The framework includes HIVE Mind - a collaborative intelligence system that allows multiple agents to share knowledge and collaborate on queries.

### HIVE Features

- **Knowledge Sharing**: Agents can share entities and concepts with peers
- **Collaborative Queries**: Send queries to peers to get additional insights
- **Automatic Peer Discovery**: Connect to peers through a discovery server
- **Expertise-Based Matchmaking**: Match with peers based on knowledge specialties
- **Peer Trust**: Weight knowledge based on peer expertise

### HIVE Usage

1. Enable HIVE in your `.env` file:
```
ENABLE_HIVE=true
HIVE_PORT=3000
HIVE_AUTO_DISCOVERY=true
HIVE_DISCOVERY_SERVER=ws://your-discovery-server:8080
```

2. Run the HIVE demo to test peer collaboration:
```
node hive-demo.js
```

### Discovery Server

The framework includes a discovery server implementation that enables automatic peer discovery and matchmaking:

1. Start the discovery server:
```
node start-discovery-server.js
```

2. Test HIVE discovery with multiple agent instances:
```
node test-hive-discovery.js
```

For detailed documentation on HIVE peer discovery and matchmaking, see:
- `docs/HIVE_PEER_DISCOVERY.md` - Overview of peer discovery mechanisms
- `docs/DISCOVERY_SERVER_SETUP.md` - Deployment guide for the discovery server

## Web Integration

### 1. Basic React Integration

First, copy the required files from the `src/agents/apollo` directory into your React project, then:

```javascript
import { useState, useEffect } from 'react';
import { ApolloAgent } from './agents/apollo/ApolloAgent';

function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const [apollo, setApollo] = useState(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    const initApollo = async () => {
      const agent = new ApolloAgent();
      await agent.initialize();
      setApollo(agent);
    };
    initApollo();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !apollo) return;

    const content = input.trim();
    setInput('');
    
    try {
      const response = await apollo.sendMessage(content);
      setMessages(prev => [...prev,
        { role: 'user', content },
        { role: 'assistant', content: response }
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages-container">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="message-input"
        />
        <button type="submit" disabled={!apollo}>
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatComponent;
```

### 2. Next.js API Route
```javascript
import { ApolloAgent } from '../../../agents/apollo/ApolloAgent';

let apollo;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    if (!apollo) {
      apollo = new ApolloAgent();
      await apollo.initialize();
    }

    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const response = await apollo.sendMessage(message);
    res.status(200).json({ response });
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
```

### 3. Environment Setup for Web

Add to your web app's environment:

```
NEXT_PUBLIC_AI_PROVIDER=openai
NEXT_PUBLIC_AI_PERSONALITY=apollo
AI_PROVIDER_KEY=your_api_key
```

### 4. Personality Switching in UI

Create a new component for personality selection:
```javascript
import { useState } from 'react';

const PERSONALITIES = {
  apollo: {
    name: 'Apollo',
    description: 'Charismatic crypto expert from 2157'
  },
  sage: {
    name: 'Sage',
    description: 'Ancient wise crypto oracle'
  },
  trader: {
    name: 'Trader',
    description: 'Fast-talking Wall Street crypto trader'
  }
};

function PersonalitySelector({ onSelect, apollo }) {
  const [currentPersonality, setCurrentPersonality] = useState('apollo');

  const handlePersonalityChange = (value) => {
    setCurrentPersonality(value);
    if (apollo) {
      apollo.setPersonality(value);
    }
    onSelect(value);
  };

  return (
    <div className="personality-selector">
      <label htmlFor="personality-select">Choose AI Personality:</label>
      <select
        id="personality-select"
        value={currentPersonality}
        onChange={(e) => handlePersonalityChange(e.target.value)}
        className="personality-select"
      >
        {Object.entries(PERSONALITIES).map(([key, personality]) => (
          <option key={key} value={key}>
            {personality.name} - {personality.description}
          </option>
        ))}
      </select>
    </div>
  );
}

export default PersonalitySelector;
```

Add styling (e.g., `PersonalitySelector.css`):
```css
.personality-selector {
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.personality-selector label {
  font-weight: 500;
  color: #333;
}

.personality-select {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  background-color: white;
  cursor: pointer;
}

.personality-select:hover {
  border-color: #007bff;
}

.personality-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}
```

Use in your chat component:
```javascript
import { useState, useEffect } from 'react';
import { ApolloAgent } from './agents/apollo/ApolloAgent';
import PersonalitySelector from './PersonalitySelector';
import './PersonalitySelector.css';

function ChatWithPersonality() {
  const [messages, setMessages] = useState([]);
  const [apollo, setApollo] = useState(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    const initApollo = async () => {
      const agent = new ApolloAgent();
      await agent.initialize();
      setApollo(agent);
    };
    initApollo();
  }, []);

  const handlePersonalitySelect = (personalityKey) => {
    if (apollo) {
      apollo.setPersonality(personalityKey);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !apollo) return;

    const content = input.trim();
    setInput('');
    
    try {
      const response = await apollo.sendMessage(content);
      setMessages(prev => [...prev,
        { role: 'user', content },
        { role: 'assistant', content: response }
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="chat-container">
      <PersonalitySelector onSelect={handlePersonalitySelect} apollo={apollo} />
      <div className="messages-container">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="message-input"
        />
        <button type="submit" disabled={!apollo}>
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatWithPersonality;
```

## Available Personalities
- **Apollo**: Charismatic crypto expert from 2157
- **Sage**: Ancient wise crypto oracle
- **Trader**: Fast-talking Wall Street crypto trader

# Background Tasks System

The Voyager AI Framework now includes a comprehensive background task system that enables the AI agent to perform various maintenance, monitoring, and learning tasks automatically in the background.

## Overview

The background task system provides:

- **Automatic Maintenance**: Database cleanup, knowledge base optimization
- **Real-time Monitoring**: Market events, token prices, system performance
- **Continuous Learning**: User preference analysis, conversation pattern recognition
- **Network Synchronization**: HIVE mind peer communication and knowledge sharing
- **Data Analysis**: Sentiment analysis, trend detection, performance metrics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Background Task Manager                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Maintenance │ │ Monitoring  │ │ Learning    │           │
│  │   Tasks     │ │   Tasks     │ │   Tasks     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Networking  │ │ Analysis    │ │ Custom      │           │
│  │   Tasks     │ │   Tasks     │ │   Tasks     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database & Services                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   SQLite    │ │ Knowledge   │ │ HIVE P2P    │           │
│  │  Database   │ │  Manager    │ │  Network    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Available Tasks

### 1. Knowledge Maintenance
- **Interval**: 5 minutes
- **Purpose**: Keeps the knowledge base clean and optimized
- **Actions**:
  - Clean up old semantic vectors (older than 30 days)
  - Remove weak entity relationships (strength < 0.1)
  - Update knowledge relevance scores based on usage

### 2. Market Monitoring
- **Interval**: 2 minutes
- **Purpose**: Tracks market events and trends
- **Actions**:
  - Check for new market events
  - Update token sentiment scores
  - Analyze market trends from stored events

### 3. User Learning
- **Interval**: 10 minutes
- **Purpose**: Learns from user interactions and preferences
- **Actions**:
  - Analyze conversation patterns
  - Update user preferences
  - Learn from interaction patterns

### 4. HIVE Synchronization
- **Interval**: 30 seconds
- **Purpose**: Synchronizes with HIVE mind peers
- **Actions**:
  - Share new knowledge with peers
  - Request knowledge from peers
  - Update peer status

### 5. Database Cleanup
- **Interval**: 1 hour
- **Purpose**: Maintains database performance
- **Actions**:
  - Remove conversations older than 90 days
  - Run database optimization (VACUUM, ANALYZE)
  - Archive old data

### 6. Sentiment Analysis
- **Interval**: 15 minutes
- **Purpose**: Analyzes conversation sentiment
- **Actions**:
  - Analyze recent conversations for sentiment
  - Update sentiment trends
  - Generate sentiment reports

### 7. Token Price Monitoring
- **Interval**: 1 minute
- **Purpose**: Monitors token prices and alerts on changes
- **Status**: Disabled by default (to avoid API rate limits)
- **Actions**:
  - Fetch current token prices
  - Detect significant price changes
  - Generate alerts for price movements

### 8. Conversation Archiving
- **Interval**: 24 hours
- **Purpose**: Archives old conversations to save storage
- **Actions**:
  - Move old conversations to archive tables
  - Compress archived data
  - Clean up storage space

### 9. Performance Metrics
- **Interval**: 5 minutes
- **Purpose**: Collects and stores performance data
- **Actions**:
  - Monitor system performance
  - Track response times
  - Store performance metrics

### 10. Knowledge Sharing
- **Interval**: 30 minutes
- **Purpose**: Shares knowledge with external systems
- **Status**: Disabled by default
- **Actions**:
  - Export knowledge to external APIs
  - Share insights with other systems
  - Sync with external knowledge bases

## Configuration

### Task Configuration File
All task settings are defined in `src/config/background-tasks.js`:

```javascript
export const BACKGROUND_TASK_CONFIG = {
  knowledgeMaintenance: {
    interval: 5 * 60 * 1000, // 5 minutes
    enabled: true,
    description: 'Maintain and optimize knowledge base',
    priority: 'high',
    category: 'maintenance'
  },
  // ... more tasks
};
```

### Environment Variables
Some tasks can be controlled via environment variables:

- `ENABLE_HIVE`: Controls HIVE synchronization tasks
- Task-specific variables can be added as needed

### Priority Levels
- **High**: Critical tasks that should run frequently
- **Medium**: Important tasks that run periodically
- **Low**: Background tasks that run occasionally

### Categories
- **Maintenance**: System maintenance and optimization
- **Monitoring**: Real-time monitoring and alerting
- **Learning**: Machine learning and pattern recognition
- **Networking**: Communication and synchronization
- **Analysis**: Data analysis and processing

## Usage

### Starting the System
The background task system starts automatically when the Apollo agent initializes:

```javascript
const apollo = new ApolloAgent();
await apollo.initialize(); // Background tasks start automatically
```

### Web Dashboard
Access the background tasks dashboard at `http://localhost:3000/dashboard`

Features:
- Real-time task status monitoring
- Start/stop individual tasks
- Global task management
- Task statistics and metrics

### API Endpoints
The system provides REST API endpoints for programmatic control:

```bash
# Get task status
GET /background-tasks/status

# Start a specific task
POST /background-tasks/start/:taskName

# Stop a specific task
POST /background-tasks/stop/:taskName

# Stop all tasks
POST /background-tasks/stop-all

# Restart all tasks
POST /background-tasks/restart
```

### Programmatic Control
You can control tasks programmatically through the Apollo agent:

```javascript
// Get task status
const status = apollo.getBackgroundTaskStatus();

// Start a specific task
const result = await apollo.startBackgroundTask('knowledgeMaintenance');

// Stop all tasks
const result = apollo.stopAllBackgroundTasks();

// Restart all tasks
const result = await apollo.restartBackgroundTasks();
```

## Adding Custom Tasks

### 1. Define the Task Configuration
Add your task to `src/config/background-tasks.js`:

```javascript
export const BACKGROUND_TASK_CONFIG = {
  // ... existing tasks
  myCustomTask: {
    interval: 10 * 60 * 1000, // 10 minutes
    enabled: true,
    description: 'My custom background task',
    priority: 'medium',
    category: 'monitoring'
  }
};
```

### 2. Implement the Task Function
Add your task implementation to `src/agents/apollo/services/background-tasks.js`:

```javascript
registerTasks() {
  // ... existing tasks
  
  // My custom task
  this.registerTask('myCustomTask', async () => {
    try {
      console.log('Running my custom task...');
      
      // Your task logic here
      await this.performCustomTask();
      
      console.log('My custom task completed');
    } catch (error) {
      console.error('Error in my custom task:', error);
    }
  });
}

async performCustomTask() {
  // Implement your task logic here
  console.log('Performing custom task operations...');
}
```

### 3. Register the Task
The task will be automatically registered when the background task manager initializes.

## Monitoring and Debugging

### Logs
All background tasks log their activities to the console:

```
Running knowledge maintenance...
Knowledge maintenance completed
Running market monitoring...
Market monitoring completed
```

### Error Handling
Tasks are designed to be fault-tolerant:
- Individual task failures don't stop other tasks
- Errors are logged but don't crash the system
- Failed tasks will retry on their next scheduled run

### Performance Monitoring
The system includes built-in performance monitoring:
- Task execution times
- Success/failure rates
- Resource usage tracking

## Best Practices

### 1. Task Design
- Keep tasks focused and single-purpose
- Use appropriate intervals (not too frequent, not too rare)
- Handle errors gracefully
- Log important events

### 2. Resource Management
- Be mindful of database connections
- Avoid memory leaks in long-running tasks
- Use appropriate timeouts for external API calls

### 3. Configuration
- Use the configuration file for all task settings
- Enable/disable tasks based on environment needs
- Adjust intervals based on system resources

### 4. Monitoring
- Regularly check task logs
- Monitor system performance
- Use the web dashboard for real-time monitoring

## Troubleshooting

### Common Issues

1. **Tasks not starting**
   - Check if the task is enabled in configuration
   - Verify the Apollo agent is properly initialized
   - Check console logs for error messages

2. **High resource usage**
   - Increase task intervals
   - Optimize task implementations
   - Disable non-critical tasks

3. **Database errors**
   - Check database connection
   - Verify table structure
   - Check for concurrent access issues

4. **HIVE synchronization issues**
   - Verify HIVE is enabled (`ENABLE_HIVE=true`)
   - Check network connectivity
   - Verify peer configuration

### Debug Mode
Enable debug logging by setting the log level in your environment:

```javascript
// Add to your environment configuration
DEBUG_BACKGROUND_TASKS=true
```

## Future Enhancements

### Planned Features
- Task scheduling with cron-like expressions
- Task dependencies and workflows
- Advanced monitoring and alerting
- Task performance analytics
- Distributed task execution
- Task result caching
- Webhook notifications for task events

### Extensibility
The system is designed to be easily extensible:
- Plugin architecture for custom tasks
- External task execution
- Integration with external monitoring systems
- Custom task categories and priorities

## Conclusion

The background task system provides a robust foundation for automated AI operations. It enables the Voyager AI Framework to maintain itself, learn continuously, and provide better user experiences through proactive monitoring and optimization.


## API Reference

Key classes and methods referenced from: `src/agents/apollo/ApolloAgent.js`

## Database Schema

Referenced from: `src/agents/apollo/services/database.js`

## Contributing

Pull requests welcome! Please check our contributing guidelines.

## License

ISC



