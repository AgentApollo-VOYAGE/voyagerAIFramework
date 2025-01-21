import axios from 'axios';
import https from 'https';
import { axiosInstance, fetchWithRetry } from '../utils/axios.js';
import { transformedTokenImageUrl } from '../utils/formatters.js';

// Fetch the current Solana price from DexScreener API
async function fetchSolanaPrice() {
  const url = `https://api.dexscreener.com/latest/dex/tokens/0x570A5D26f7765Ecb712C0924E4De545B89fD43dF`;
  try {
    const response = await axios.get(url);
    const priceData = response.data.pairs[0];
    if (priceData && priceData.priceUsd) {
      return parseFloat(priceData.priceUsd);
    } else {
      throw new Error('Failed to fetch Solana price');
    }
  } catch (error) {
    console.error('Error fetching Solana price:', error);
    throw error;
  }
}

// Fetch token balances and metadata from the reliable endpoint
async function fetchTokenBalancesAndMetadata(account) {
  try {
    const url = `https://gmgn.ai/api/v1/wallet_holdings/sol/${account}`;
    const response = await axios.get(url);

    if (response.data && response.data.code === 0) {
      const holdings = response.data.data.holdings || [];
      const processedHoldings = holdings
        .filter(item => item && item.token && item.token.token_address)
        .map(item => ({
          address: item.token.token_address.toLowerCase(),
          balance: parseFloat(item.balance) / (10 ** (item.token.decimals || 0)),
          value: parseFloat(item.usd_value || 0),
          name: item.token.name || 'Unknown',
          symbol: item.token.symbol || 'Unknown',
        }));

      return processedHoldings.sort((a, b) => b.value - a.value);
    } else {
      throw new Error('Failed to fetch token balances and metadata');
    }
  } catch (error) {
    console.error('Error fetching token balances and metadata:', error);
    return [];
  }
}

// Fetch 7-day realized and unrealized PnL, winrate, Solana balance, and other details for a trader
async function fetchTraderDetails(account) {
  try {
    const url = `https://gmgn.ai/defi/quotation/v1/smartmoney/sol/walletNew/${account}`;
    const response = await axios.get(url);
    if (response.data && response.data.code === 0) {
      const { 
        pnl_7d: pnl7Day, 
        pnl_30d: pnl30Day,
        unrealized_pnl: unrealizedPnL7Day, 
        realized_profit_7d: realizedProfit7d,
        unrealized_pnl_30d: unrealizedPnL30Day,
        winrate, 
        sol_balance: solBalance,
        buy_7d: buy7d,
        buy_30d: buy30Day,
        sell_7d: sell7d,
        sell_30d: sell30Day,
        token_sold_avg_profit: token_sold_avg_profit,
        token_avg_cost: token_avg_cost,
      } = response.data.data;
      
      const traderType = parseInt(buy7d) > 700 ? 'Bot' : null;

      return { 
        pnl7Day, 
        pnl30Day,
        unrealizedPnL7Day, 
        unrealizedPnL30Day,
        realizedProfit7d,
        winrate, 
        solBalance: parseFloat(solBalance),
        buy7d,
        buy30Day,
        sell7d,
        sell30Day,
        token_sold_avg_profit,
        token_avg_cost,
        traderType
      };
    } else {
      throw new Error('Failed to fetch trader details');
    }
  } catch (error) {
    console.error('Error fetching trader details:', error);
    throw error;
  }
}

// Fetch token balances, metadata, and trader details, and calculate total value
async function fetchValue(address) {
  try {
    const [solanaPrice, tokenBalances, traderDetails] = await Promise.all([
      fetchSolanaPrice(),
      fetchTokenBalancesAndMetadata(address),
      fetchTraderDetails(address),
    ]);

    const totalValue = tokenBalances.reduce((sum, token) => sum + token.value, 0);

    return {
      top10Tokens: tokenBalances,
      totalValue,
      pnl7Day: traderDetails.pnl7Day,
      pnl30Day: traderDetails.pnl30Day,
      unrealizedPnL7Day: traderDetails.unrealizedPnL7Day,
      unrealizedPnL30Day: traderDetails.unrealizedPnL30Day,
      realizedProfit7d: traderDetails.realizedProfit7d,
      winrate: traderDetails.winrate,
      solBalance: traderDetails.solBalance?.toString() ?? 'N/A',
      buy7d: traderDetails.buy7d?.toString() ?? 'N/A',
      buy30Day: traderDetails.buy30Day?.toString() ?? 'N/A',
      sell7d: traderDetails.sell7d?.toString() ?? 'N/A',
      sell30Day: traderDetails.sell30Day?.toString() ?? 'N/A',
      token_sold_avg_profit: traderDetails.token_sold_avg_profit?.toString() ?? 'N/A',
      token_avg_cost: traderDetails.token_avg_cost?.toString() ?? 'N/A',
      traderType: traderDetails.traderType,
    };
  } catch (error) {
    console.error('Error fetching value:', error);
    return {
      top10Tokens: [],
      totalValue: 0,
      pnl7Day: 'N/A',
      realizedProfit7d: 'N/A',
      unrealizedPnL7Day: 'N/A',
      winrate: 'N/A',
      solBalance: 'N/A',
      buy7d: 'N/A',
      sell7d: 'N/A',
      token_sold_avg_profit: 'N/A',
      token_avg_cost: 'N/A',
      traderType: null,
    };
  }
}

export {
  fetchSolanaPrice,
  fetchTokenBalancesAndMetadata,
  fetchTraderDetails,
  fetchValue as fetchPortfolioValue,
};

export const fetchTokenMetadata = async (address) => {
  try {
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    const data = response.data;
    if (data.pairs && data.pairs.length > 0) {
      const tokenInfo = data.pairs[0].baseToken;
      const socials = data.pairs[0].info?.socials || [];
      const websites = data.pairs[0].info?.websites || [];
      const buys24h = parseInt(data.pairs[0].txns.h24.buys) || 0;
      const sells24h = parseInt(data.pairs[0].txns.h24.sells) || 0;
      const totalTxns = buys24h + sells24h;
      
      const totalLiquidity = data.pairs.reduce((total, pair) => {
        return total + (parseFloat(pair.liquidity?.usd) || 0);
      }, 0);
      
      const buyerSellerRatio = totalTxns > 0 ? (buys24h / totalTxns * 100) : 0;
      let ghostPercent = 0;
      if (buyerSellerRatio > 56) {
        ghostPercent = (buyerSellerRatio - 56) * 2;
      }

      return {
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        image: transformedTokenImageUrl(data.pairs[0].info?.imageUrl || ''),
        priceUsd: parseFloat(data.pairs[0].priceUsd) || 0,
        marketCap: parseFloat(data.pairs[0].fdv) || 'N/A',
        volume: parseFloat(data.pairs[0].volume.h24) || 0,
        volume5m: parseFloat(data.pairs[0].volume.m5) || 0,
        volume1h: parseFloat(data.pairs[0].volume.h1) || 0,
        volume6h: parseFloat(data.pairs[0].volume.h6) || 0,
        volume24h: parseFloat(data.pairs[0].volume.h24) || 0,
        priceChange5m: parseFloat(data.pairs[0].priceChange.m5) || 0,
        priceChange1h: parseFloat(data.pairs[0].priceChange.h1) || 0,
        priceChange6h: parseFloat(data.pairs[0].priceChange.h6) || 0,
        priceChange24h: parseFloat(data.pairs[0].priceChange.h24) || 0,
        pairAddress: data.pairs[0].pairAddress,
        socials: [...websites.map(website => ({ type: 'website', url: website })), ...socials],
        pairCreatedAt: parseFloat(data.pairs[0].pairCreatedAt) || 0,
        buyerSellerRatio,
        ghostPercent,
        liquidityUsd: totalLiquidity,
        pairs: data.pairs,
      };
    }
    return { pairs: null };
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return { pairs: null };
  }
};

export const fetchDashboardData = async () => {
  try {
    const response = await axios.get(process.env.DASHBOARD_API_URL);
    
    // Process the transactions to match the expected format
    const processedTransactions = response.data.map(activity => ({
      chain: activity.chain,
      tx_hash: activity.tx_hash,
      type: activity.event_type,
      event_type: activity.event_type,
      token: {
        address: activity.token?.address || 'Unknown',
        name: activity.token?.name || 'Unknown',
        symbol: activity.token?.symbol || 'Unknown',
        logo: activity.token?.logo || '',
      },
      tokenAmount: parseFloat(activity.token_amount) || 0,
      token_amount: parseFloat(activity.token_amount) || 0,
      quote_amount: parseFloat(activity.quote_amount) || 0,
      usdAmount: parseFloat(activity.cost_usd || 0),
      cost_usd: parseFloat(activity.cost_usd || 0),
      buy_cost_usd: activity.buy_cost_usd || 0,
      price: activity.price || 0,
      price_usd: activity.price_usd || 0,
      timestamp: activity.timestamp || 0,
      balance: activity.balance || 0,
      id: activity.id || '',
      walletAddress: activity.walletAddress || '',
      processed_at: activity.processed_at || '',
      profit: activity.cost_usd - activity.buy_cost_usd
    }));

    return {
      activities: processedTransactions,
      walletMetrics: [],
      transactionsByWallet: {},
      averageHoldTimes: {},
      overallAverageHoldTime: 0
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return {
      activities: [],
      walletMetrics: [],
      transactionsByWallet: {},
      averageHoldTimes: {},
      overallAverageHoldTime: 0
    };
  }
};

export const fetchDexPaid = async (tokenAddress) => {   
  try {
    const data = await fetchWithRetry(`https://api.dexscreener.com/orders/v1/solana/${tokenAddress}`);
    // Check if data is an array and has any entries with status 'approved' or 'pending'
    return Array.isArray(data) && data.some(order => 
      order.status === 'approved' || order.status === 'pending'
    );
  } catch (error) {
    console.error('Error fetching dex paid status:', error);
    return false;
  }
};