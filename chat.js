import { ApolloAgent } from './src/agents/apollo/ApolloAgent.js';
import { PERSONALITIES } from './src/config/personalities.js';
import { ENV } from './src/config/env.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function startChat() {
  console.log(`Starting with personality: ${ENV.AI_PERSONALITY}`);
  console.log("Available personalities (use /switch to change):");
  Object.entries(PERSONALITIES).forEach(([key, p]) => {
    console.log(`${key}: ${p.description}`);
  });

  const apollo = new ApolloAgent();
  await apollo.initialize();
  console.log(`${PERSONALITIES[ENV.AI_PERSONALITY].name} is ready! Type your message (or 'exit' to quit)`);

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      if (input.startsWith('/switch ')) {
        const newPersonality = input.split(' ')[1].toLowerCase();
        if (PERSONALITIES[newPersonality]) {
          apollo.setPersonality(newPersonality);
          await apollo.initialize();
          console.log(`Switched to ${PERSONALITIES[newPersonality].name}!`);
        } else {
          console.log('Unknown personality. Available options:', Object.keys(PERSONALITIES).join(', '));
        }
      } else {
        try {
          const response = await apollo.sendMessage(input);
          console.log(`\n${apollo.personality.name}: ${response}\n`);
        } catch (error) {
          console.error('Error:', error.message);
        }
      }

      askQuestion();
    });
  };

  askQuestion();
}

startChat().catch(console.error); 