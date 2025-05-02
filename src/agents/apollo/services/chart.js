import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const DEXSCREENER_BASE_URL = 'https://dexscreener.com/solana/';

export async function captureTokenChart(tokenAddress) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--disable-setuid-sandbox',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
  });

  try {
    const page = await browser.newPage();
    const DEXSCREENER_URL = `${DEXSCREENER_BASE_URL}${tokenAddress}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=1&chartType=usd&interval=15`;

    await page.goto(DEXSCREENER_URL, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 // Increase timeout to 60 seconds
    });

    // Wait using evaluate instead of waitForTimeout
    await page.evaluate(() => {
      return new Promise((resolve) => setTimeout(resolve, 2000));
    });

    // Take screenshot
    const screenshot = await page.screenshot({
      encoding: 'base64',
      fullPage: false
    });

    await browser.close();
    return screenshot;
  } catch (error) {
    console.error('Error capturing chart:', error);
    await browser.close();
    return null;
  }
} 
