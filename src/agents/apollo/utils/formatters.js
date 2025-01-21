export const formatNumber = (num) => {
    if (!num) return '0.00';
    
    const numValue = typeof num === 'string' ? parseFloat(num) : num;
    
    if (isNaN(numValue)) return '0.00';
    
    return numValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };
  
  export const transformedTokenImageUrl = (image) => {
    if (!image) return '';
    return image.replace('http://10.128.13.101:3000', 'https://dd.dexscreener.com');
  };