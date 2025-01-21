import { fetchTokenMetadata } from '../services/api.js';

export async function enhanceSentimentQuery(content) {
  const solanaAddressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
  const addressMatch = content.match(solanaAddressRegex);

  if (addressMatch) {
    try {
      const metadata = await fetchTokenMetadata(addressMatch[0]);
      
      if (!metadata?.pairs?.[0]) {
        return `${content}\n\nI couldn't find metadata for this token. Please verify the contract address.`;
      }

      const firstPair = metadata.pairs[0];
      const token = firstPair.baseToken;
      const priceChange = firstPair.priceChange?.h24 || 0;
      const volume = firstPair.volume?.h24 || 0;
      const marketCap = firstPair.fdv || 0;

      const sentimentContext = `
        Market Analysis for ${token.name} ($${token.symbol}):
        - 24h Price Change: ${priceChange.toFixed(2)}%
        - 24h Volume: $${volume.toLocaleString()}
        - Market Cap: $${marketCap.toLocaleString()}
      `;

      return `${content}\n\nMarket Analysis:\n${sentimentContext}`;
    } catch (error) {
      console.error('Error fetching sentiment data:', error);
      return `${content}\n\nSorry, I encountered an error while analyzing market data for this token.`;
    }
  } else {
    return `${content}\n\nTo analyze a token's market sentiment, please provide a valid token address.`;
  }
} 