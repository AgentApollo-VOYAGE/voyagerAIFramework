import { fetchDashboardData, fetchTokenMetadata } from '../services/api.js';
import { formatNumber } from '../utils/formatters.js';
import { BLACKLISTED_TOKENS } from '../constants/tokens.js';

export async function enhanceMarketQuery(content) {
  try {
    const data = await fetchDashboardData();
    const tokenAnalysis = new Map();
    
    // Process trading activities
    data.activities.forEach(activity => {
      const token = activity.token;
      
      // Skip blacklisted tokens
      if (BLACKLISTED_TOKENS.addresses.includes(token.address) ||
          BLACKLISTED_TOKENS.symbols.includes(token.symbol) ||
          BLACKLISTED_TOKENS.names.includes(token.name)) {
        return;
      }

      if (!tokenAnalysis.has(token.address)) {
        tokenAnalysis.set(token.address, {
          name: token.name,
          symbol: token.symbol,
          address: token.address,
          buyCount: 0,
          sellCount: 0,
          totalVolume: 0,
          recentTrades: [],
          firstBuyTime: activity.timestamp
        });
      }

      const analysis = tokenAnalysis.get(token.address);
      if (activity.event_type === 'buy') analysis.buyCount++;
      else if (activity.event_type === 'sell') analysis.sellCount++;
      
      analysis.totalVolume += parseFloat(activity.cost_usd);
      analysis.recentTrades.push({
        type: activity.event_type,
        amount: activity.cost_usd,
        time: activity.timestamp
      });
    });

    // Enhance with DexScreener metadata
    const enhancedTokens = await Promise.all(
      Array.from(tokenAnalysis.values()).map(async (token) => {
        try {
          const metadata = await fetchTokenMetadata(token.address);
          if (!metadata || !metadata.pairs) return token;

          return {
            ...token,
            price: metadata.priceUsd,
            marketCap: metadata.marketCap,
            volume24h: metadata.volume24h,
            priceChange24h: metadata.priceChange24h,
            liquidity: metadata.liquidityUsd
          };
        } catch (error) {
          console.error(`Error fetching metadata for ${token.address}:`, error);
          return token;
        }
      })
    );

    // Sort by volume and get top 5
    const marketData = enhancedTokens
      .filter(token => token.marketCap && token.price)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 9);

    const marketContext = `
      Analyze these top trending tokens in the last 24h:

      ${marketData.map((token, index) => {
        const volumeToMcapRatio = ((token.volume24h || 0) / (token.marketCap || 1)) * 100;
        const liquidityToMcapRatio = ((token.liquidity || 0) / (token.marketCap || 1)) * 100;
        const ageInHours = (Date.now() - token.firstBuyTime) / (1000 * 60 * 60);
        
        return `
          ${index + 1}. $${token.symbol}
          Address: ${token.address}
          Recent Buy Size: $${formatNumber(token.recentTrades[0]?.amount || 0)}
          Volume/MCap Ratio: ${volumeToMcapRatio.toFixed(2)}%
          Liquidity/MCap Ratio: ${liquidityToMcapRatio.toFixed(2)}%
          Token Age: ${Math.floor(ageInHours)} hours
          24h Volume Change: ${((token.volume24h || 0) / (token.totalVolume || 1) * 100).toFixed(2)}%
          Market Cap: $${formatNumber(token.marketCap)}
          24h Volume: $${formatNumber(token.volume24h)}
          Current Price: $${token.price?.toFixed(8) || 'N/A'}
        `;
      }).join('\n\n')}

      Required Analysis Points:
      - Give symbol(with $ prefix) and address for each token
      - State how big the recent buys were
      - Provide volume/mcap ratio analysis
      - Provide liquidity/mcap ratio analysis
      - Note token age
      - Highlight significant volume changes
      - Look for correlations between tokens
      - Keep response under 80 words
      - Use space-themed analogies
      - Never use "*" or "**" characters in your response
    `;

    return `${content}\n\nMarket Data:\n${marketContext}`;
  } catch (error) {
    console.error('Error fetching market trends:', error);
    return `${content}\n\nSorry, I couldn't fetch the latest market data at this time.`;
  }
} 