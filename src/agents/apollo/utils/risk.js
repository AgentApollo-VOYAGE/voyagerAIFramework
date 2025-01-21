export const getRiskDescription = (marketCap) => {
    if (marketCap < 100000) {
      return "Extremely low market cap indicates very high risk";
    } else if (marketCap < 1000000) {
      return "Low market cap indicates higher risk";
    }
    return "Market cap above $1M indicates standard market risks";
  };
  
  export const getLiquidityEmoji = (ratio) => {
    return ratio > 15 ? "✅" : "⚠️";
  };
  
  export const getLiquidityDescription = (ratio) => {
    return ratio > 15 ? "Strong liquidity" : "Low liquidity";
  };
  
  export const getVolumeEmoji = (ratio) => {
    return ratio > 10 ? "✅" : "⚠️";
  };
  
  export const getVolumeDescription = (ratio) => {
    return ratio > 10 ? "Normal trading volume" : "Low trading volume";
  };