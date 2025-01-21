import axios from 'axios';
import https from 'https';

export const axiosInstance = axios.create({
  timeout: 30000,
  maxRedirects: 5,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true
  }),
  headers: {
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://wenonbase.com',
    'Referer': 'https://wenonbase.com/',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
});

export const fetchWithRetry = async (url, options = {}, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axiosInstance({
        url,
        ...options,
        validateStatus: (status) => status < 500
      });
      return response.data;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}; 