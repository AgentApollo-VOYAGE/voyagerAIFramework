import { fetchTokenMetadata } from '../services/api.js';
import { formatNumber } from '../utils/formatters.js';
import { 
  getRiskDescription, 
  getLiquidityEmoji, 
  getLiquidityDescription,
  getVolumeEmoji,
  getVolumeDescription 
} from '../utils/risk.js';

export async function enhanceTokenQuery(content) {
  const solanaAddressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
  const addressMatch = content.match(solanaAddressRegex);

  if (!addressMatch) {
    return {
      response: `I notice you're asking about a specific token, but I don't see a contract address. Please provide the Solana contract address for a detailed analysis!`,
      analysis: {
        type: "specific_token",
        confidence: 0.95
      }
    };
  }

  try {
    const metadata = await fetchTokenMetadata(addressMatch[0]);
    
    if (metadata && metadata.marketCap !== 'N/A') {
      const liquidityRatio = (metadata.liquidityUsd / metadata.marketCap) * 100;
      const volumeToMcapRatio = (metadata.volume24h / metadata.marketCap) * 100;
      const ageInHours = (Date.now() - metadata.pairCreatedAt) / (1000 * 60 * 60);
      const ageInDays = Math.floor(ageInHours / 24);

      let riskLevel = '';
      if (metadata.marketCap < 100000) {
        riskLevel = "EXTREME RISK";
      } else if (metadata.marketCap < 1000000) {
        riskLevel = "HIGH RISK";
      } else {
        riskLevel = "MODERATE RISK";
      }

      const message = `Token Analysis:

Detailed analysis of ${metadata.name} ($${metadata.symbol}):
- Recent Buy: $${metadata.symbol}
- Volume/MCap: ${volumeToMcapRatio.toFixed(1)}%
- Liquidity/MCap: ${liquidityRatio.toFixed(1)}%
- Age: ${ageInDays} days
- Volume Change: ${metadata.priceChange24h.toFixed(2)}%

Risk Assessment:
- 📊 ${riskLevel}: ${getRiskDescription(metadata.marketCap)}
- Liquidity/MC Ratio: ${liquidityRatio.toFixed(1)}% (${getLiquidityEmoji(liquidityRatio)} ${getLiquidityDescription(liquidityRatio)})
- Volume/MC Ratio: ${volumeToMcapRatio.toFixed(1)}% (${getVolumeEmoji(volumeToMcapRatio)} ${getVolumeDescription(volumeToMcapRatio)})
- Age Factor: Token has been trading for ${ageInDays} days`;

      return {
        response: message,
        analysis: {
          type: "specific_token",
          address: addressMatch[0],
          confidence: 0.95
        },
        tokenMetadata: {
          name: metadata.name,
          symbol: metadata.symbol,
          address: addressMatch[0],
          price: metadata.priceUsd,
          marketCap: metadata.marketCap,
          volume24h: metadata.volume24h,
          liquidity: metadata.liquidityUsd,
          priceChange24h: metadata.priceChange24h,
          riskLevel: riskLevel
        },
      };
    }
  } catch (error) {
    console.error('Error fetching token metadata:', error);
  }

  return {
    response: `Sorry, I couldn't fetch metadata for this token. Please verify the address and try again.`,
    analysis: {
      type: "specific_token",
      address: addressMatch[0],
      confidence: 0.95
    }
  };
}