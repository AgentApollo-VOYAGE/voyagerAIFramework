import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

class AIProvider {
  constructor(type, apiKey) {
    this.type = type;
    this.apiKey = apiKey;
    this.client = this.initializeClient();
  }

  initializeClient() {
    switch (this.type) {
      case 'openai':
        return new OpenAI({ apiKey: this.apiKey });
      case 'anthropic':
        return new Anthropic({ apiKey: this.apiKey });
      case 'google':
        return new GoogleGenerativeAI(this.apiKey);
      default:
        throw new Error(`Unsupported AI provider: ${this.type}`);
    }
  }

  async generateResponse(messages) {
    switch (this.type) {
      case 'openai':
        return this.openaiGenerate(messages);
      case 'anthropic':
        return this.anthropicGenerate(messages);
      case 'google':
        return this.googleGenerate(messages);
      default:
        throw new Error(`Unsupported AI provider: ${this.type}`);
    }
  }

  async openaiGenerate(messages) {
    const completion = await this.client.chat.completions.create({
      messages,
      model: "gpt-4-turbo-preview"
    });
    return completion.choices[0].message.content;
  }

  async anthropicGenerate(messages) {
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    
    const msg = await this.client.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      system: systemMessage,
      messages: [{ role: 'user', content: userMessage }]
    });
    return msg.content[0].text;
  }

  async googleGenerate(messages) {
    const model = this.client.getGenerativeModel({ model: 'gemini-pro' });
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    
    const result = await model.generateContent(
      `${systemMessage}\n\nUser: ${userMessage}`
    );
    return result.response.text();
  }
}

export const createProvider = () => {
  const provider = process.env.AI_PROVIDER || 'openai';
  const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  
  if (!apiKey) {
    throw new Error(`Missing API key for provider: ${provider}`);
  }
  
  return new AIProvider(provider, apiKey);
}; 