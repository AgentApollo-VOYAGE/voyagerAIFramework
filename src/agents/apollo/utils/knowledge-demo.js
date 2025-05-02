import { knowledgeManager } from '../services/knowledge.js';
import { database } from '../services/database.js';

/**
 * This utility demonstrates how to use the knowledge management system
 * for advanced queries and insights.
 */

// Initialize the knowledge system
async function initializeKnowledge() {
  await database.initialize();
  await knowledgeManager.initialize();
  console.log('Knowledge system initialized');
}

// Add a custom market event
async function recordMarketEvent(eventType, token, description, impact) {
  const eventId = await knowledgeManager.recordMarketEvent(
    eventType, 
    token, 
    description, 
    impact
  );
  console.log(`Recorded market event with ID: ${eventId}`);
}

// Manually add a token entity with metadata
async function addTokenEntity(address, metadata) {
  const entityId = await database.storeEntity(
    knowledgeManager.entityTypes.TOKEN,
    address,
    metadata
  );
  console.log(`Stored token entity with ID: ${entityId}`);
  return entityId;
}

// Manually create relationships between entities
async function createEntityRelationship(sourceId, relationType, targetId, strength) {
  await database.createRelationship(sourceId, relationType, targetId, strength);
  console.log(`Created relationship between entities ${sourceId} and ${targetId}`);
}

// Search for relevant knowledge based on a query
async function searchKnowledge(query) {
  console.log(`Searching knowledge for: "${query}"`);
  const results = await knowledgeManager.searchMemory(query);
  
  console.log('\n===== RELEVANT CONVERSATIONS =====');
  if (results.conversations.length === 0) {
    console.log('No relevant conversations found');
  } else {
    results.conversations.forEach((conv, i) => {
      console.log(`[${i+1}] Relevance: ${conv.relevance}, Importance: ${conv.importance_score}`);
      console.log(`User: ${conv.input}`);
      console.log(`Response: ${conv.response}`);
      console.log('---');
    });
  }
  
  console.log('\n===== RELEVANT ENTITIES =====');
  if (results.entities.length === 0) {
    console.log('No relevant entities found');
  } else {
    results.entities.forEach((entity, i) => {
      const metadata = JSON.parse(entity.metadata || '{}');
      console.log(`[${i+1}] ${entity.entity_type.toUpperCase()}: ${entity.entity_value}`);
      if (Object.keys(metadata).length > 0) {
        console.log('Metadata:', metadata);
      }
      console.log(`Relation: ${entity.relation_type}, Strength: ${entity.strength}`);
      console.log('---');
    });
  }
  
  console.log('\n===== RECENT MARKET EVENTS =====');
  if (results.marketEvents.length === 0) {
    console.log('No recent market events found');
  } else {
    results.marketEvents.forEach((event, i) => {
      const date = new Date(event.timestamp).toLocaleDateString();
      console.log(`[${i+1}] ${date} - ${event.event_type}`);
      console.log(`Related to: ${event.related_token || 'N/A'}`);
      console.log(`Description: ${event.description}`);
      console.log(`Impact: ${event.impact_score}/10`);
      console.log('---');
    });
  }
}

// Get user interests based on interaction history
async function getUserInterests() {
  console.log('Retrieving user interests...');
  const interests = await knowledgeManager.getUserKnowledge();
  
  console.log('\n===== TOKEN INTERESTS =====');
  if (interests.tokens.length === 0) {
    console.log('No token interests found');
  } else {
    interests.tokens.forEach((token, i) => {
      console.log(`[${i+1}] ${token.address}`);
      console.log(`Interactions: ${token.interaction_count}`);
      console.log(`Interest level: ${token.user_interest_level}/10`);
      console.log('---');
    });
  }
  
  console.log('\n===== TOPIC INTERESTS =====');
  if (interests.interests.length === 0) {
    console.log('No topic interests found');
  } else {
    interests.interests.forEach((topic, i) => {
      console.log(`[${i+1}] ${topic.tag} (${topic.count} mentions)`);
    });
  }
}

// Perform a test run of all the knowledge features
async function runKnowledgeDemo() {
  await initializeKnowledge();
  
  // Add some sample data
  console.log('\n===== ADDING SAMPLE DATA =====');
  
  // Add a token
  const tokenId = await addTokenEntity('0x123456789abcdef0123456789abcdef01234567', {
    name: 'Demo Token',
    symbol: 'DEMO',
    description: 'A demonstration token for the knowledge system'
  });
  
  // Add a concept
  const conceptId = await database.storeEntity(
    knowledgeManager.entityTypes.CONCEPT,
    'token utility',
    { description: 'The practical uses and applications of a token' }
  );
  
  // Create relationship
  await createEntityRelationship(
    tokenId,
    knowledgeManager.relationTypes.HAS_ATTRIBUTE,
    conceptId,
    0.8
  );
  
  // Record market events
  await recordMarketEvent(
    'price_movement',
    '0x123456789abcdef0123456789abcdef01234567',
    'Demo Token (DEMO) increased by 15% in the last 24 hours',
    7
  );
  
  await recordMarketEvent(
    'listing',
    '0x123456789abcdef0123456789abcdef01234567',
    'Demo Token (DEMO) was listed on a major exchange',
    8
  );
  
  // Simulate a conversation
  const mockConversation = {
    input: 'Tell me about the Demo Token and its utility. Has it had any recent price movements?',
    response: 'Demo Token (DEMO) is designed with strong utility features. It has recently seen a 15% price increase and was listed on a major exchange, which has boosted its visibility and trading volume.',
    queryType: 'specific_token'
  };
  
  await knowledgeManager.analyzeConversation(
    mockConversation.input,
    mockConversation.response,
    mockConversation.queryType
  );
  
  // Wait a moment for all database operations to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Demonstrate searching
  console.log('\n===== KNOWLEDGE SEARCH DEMO =====');
  await searchKnowledge('Demo Token price movement');
  
  // Demonstrate user interests
  console.log('\n===== USER INTERESTS DEMO =====');
  await getUserInterests();
  
  console.log('\n===== KNOWLEDGE DEMO COMPLETE =====');
}

// Export the demo functions
export {
  initializeKnowledge,
  recordMarketEvent,
  addTokenEntity,
  createEntityRelationship,
  searchKnowledge,
  getUserInterests,
  runKnowledgeDemo
}; 
