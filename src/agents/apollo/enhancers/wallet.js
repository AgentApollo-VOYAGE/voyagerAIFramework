import { fetchTokenMetadata, fetchPortfolioValue } from '../services/api.js';
import { formatNumber } from '../utils/formatters.js';

export async function enhanceWalletQuery(content) {
  const solanaWalletRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
  const walletMatch = content.match(solanaWalletRegex);

  if (!walletMatch) {
    return {
      response: `${content}\n\nI notice you're asking about a wallet, but I don't see a valid Solana address. Please provide the wallet address for analysis!`,
      analysis: {
        type: "wallet",
        confidence: 0.95
      }
    };
  }

  try {
    // Get SOL price first for accurate portfolio value
    const solData = await fetchTokenMetadata('So11111111111111111111111111111111111111112');
    const solPriceUsd = solData?.priceUsd || 0;
    
    // Fetch portfolio data
    const portfolioData = await fetchPortfolioValue(walletMatch[0]);
    
    if (!portfolioData) {
      return {
        response: `${content}\n\nI couldn't find any data for this wallet. It might be empty or the address might be incorrect.`,
        analysis: {
          type: "wallet",
          address: walletMatch[0],
          confidence: 0.95
        }
      };
    }

    // Calculate SOL value in USD
    const solBalanceUsd = (portfolioData.solBalance || 0) * solPriceUsd;
    portfolioData.totalValue = (portfolioData.totalValue || 0) + solBalanceUsd;
    portfolioData.solBalanceUsd = solBalanceUsd;

    // Calculate risk metrics
    const winRate = portfolioData.winrate || 0;
    const pnl7Day = portfolioData.pnl7Day || 0;
    const realizedProfit7d = portfolioData.realizedProfit7d || 0;

    // Get holdings breakdown
    const holdings = {
      SOL: solBalanceUsd,
      AI: portfolioData.top10Tokens?.reduce((sum, token) => {
        const isAI = token.name?.toLowerCase().includes('ai') || 
                    token.symbol?.toLowerCase().includes('ai');
        return sum + (isAI ? token.value : 0);
      }, 0) || 0,
      STABLES: portfolioData.top10Tokens?.reduce((sum, token) => {
        const isStable = ['usdc', 'usdt'].includes(token.symbol?.toLowerCase());
        return sum + (isStable ? token.value : 0);
      }, 0) || 0,
      MEME: portfolioData.top10Tokens?.reduce((sum, token) => {
        const isAI = token.name?.toLowerCase().includes('ai') || 
                    token.symbol?.toLowerCase().includes('ai');
        const isStable = ['usdc', 'usdt'].includes(token.symbol?.toLowerCase());
        return sum + (!isAI && !isStable ? token.value : 0);
      }, 0) || 0
    };

    const walletContext = `
      Wallet Analysis for ${walletMatch[0]}:
      
      Portfolio Overview:
      - Total Value: $${formatNumber(portfolioData.totalValue)}
      - Win Rate: ${(winRate * 100).toFixed(1)}% ${winRate >= 0.6 ? '(Expert Trader! 🏆)' : winRate >= 0.4 ? '(Average Trader)' : '(High Risk Trader ⚠️)'}
      - 7-Day PnL: ${(pnl7Day * 100).toFixed(1)}% ${pnl7Day > 0 ? '📈' : '📉'}
      - 7-Day Realized Profit: $${formatNumber(realizedProfit7d)}

      Holdings Breakdown:
      - SOL: $${formatNumber(holdings.SOL)} (${((holdings.SOL / portfolioData.totalValue) * 100).toFixed(1)}%)
      - AI Tokens: $${formatNumber(holdings.AI)} (${((holdings.AI / portfolioData.totalValue) * 100).toFixed(1)}%)
      - Stablecoins: $${formatNumber(holdings.STABLES)} (${((holdings.STABLES / portfolioData.totalValue) * 100).toFixed(1)}%)
      - Other Tokens: $${formatNumber(holdings.MEME)} (${((holdings.MEME / portfolioData.totalValue) * 100).toFixed(1)}%)

      Top Holdings:
      ${portfolioData.top10Tokens?.map(token => 
        `- ${token.name} ($${token.symbol}): $${formatNumber(token.value)}`
      ).join('\n')}
    `;

    return {
      response: walletContext,
      analysis: {
        type: "wallet",
        address: walletMatch[0],
        confidence: 0.95
      },
      walletMetadata: {
        address: walletMatch[0],
        totalValue: portfolioData.totalValue,
        solBalance: portfolioData.solBalance,
        winrate: portfolioData.winrate,
        pnl7Day: portfolioData.pnl7Day,
        realizedProfit7d: portfolioData.realizedProfit7d,
        top10Tokens: portfolioData.top10Tokens
      }
    };

  } catch (error) {
    console.error('Error fetching wallet data:', error);
    return {
      response: `${content}\n\nI encountered an error analyzing this wallet. Please verify the address and try again.`,
      analysis: {
        type: "wallet",
        address: walletMatch[0],
        confidence: 0.95
      }
    };
  }
} 