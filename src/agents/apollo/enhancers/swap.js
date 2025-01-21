import { fetchTokenMetadata } from '../services/api.js';

export async function enhanceSwapQuery(content, analysis) {
  try {
    if (!analysis.address || (!analysis.solAmount && !analysis.tokenAmount)) {
      return `I notice you want to swap, but I need both a token address and amount. Please specify both, like "swap 0.1 SOL for {token address}" or "swap {token amount} {token address} for SOL".`;
    }

    const metadata = await fetchTokenMetadata(analysis.address);
    if (!metadata?.pairs?.[0]) {
      return `I couldn't find that token. Please verify the address.`;
    }

    const token = metadata.pairs[0].baseToken;

    if (analysis.action === 'buy') {
      return `I've initiated a swap of ${analysis.solAmount} SOL for ${token.name} ($${token.symbol}). Check your wallet to confirm the transaction! 🚀`;
    } else if (analysis.action === 'sell') {
      return `I've initiated a swap of ${analysis.tokenAmount} ${token.name} ($${token.symbol}) for SOL. Check your wallet to confirm the transaction! 🚀`;
    } else {
      return `Please specify whether you want to buy or sell.`;
    }
  } catch (error) {
    console.error('Error processing swap:', error);
    return `Sorry, I encountered an error while processing the swap request.`;
  }
} 