import { runKnowledgeDemo } from './src/agents/apollo/utils/knowledge-demo.js';

// Run the knowledge management system demonstration
console.log('Starting Knowledge Management System Demonstration');
console.log('================================================\n');

runKnowledgeDemo()
  .then(() => {
    console.log('\nDemonstration completed successfully!');
    console.log('\nThis enhanced memory system provides your AI agent with:');
    console.log('1. Semantic search of past conversations');
    console.log('2. Entity extraction and relationship tracking');
    console.log('3. Knowledge graph for connecting concepts');
    console.log('4. User interest profiling');
    console.log('5. Market event tracking');
    console.log('\nAll without requiring any external API keys!\n');
  })
  .catch(error => {
    console.error('Error running demonstration:', error);
  }); 
