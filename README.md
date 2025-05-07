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

## API Reference

Key classes and methods referenced from: `src/agents/apollo/ApolloAgent.js`

## Database Schema

Referenced from: `src/agents/apollo/services/database.js`

## Contributing

Pull requests welcome! Please check our contributing guidelines.

## License

ISC

