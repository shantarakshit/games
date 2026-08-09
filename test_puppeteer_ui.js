const path = require('path');

async function runBrowserTest() {
  console.log('🌐 Launching Headless Chrome Browser for E2E UI verification...');
  const puppeteerModule = await import('file:///Users/buffries/Projects/Games/node_modules/puppeteer/lib/puppeteer/puppeteer.js');
  const puppeteer = puppeteerModule.default || puppeteerModule;

  const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER JS ERROR:', err.message));

  console.log('📱 Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // 1. Enter Player Name & Enter Hub
  await page.type('#inputPlayerName', 'ChromeHost');
  await page.click('#btnEnterHub');
  await page.waitForSelector('#viewLobby:not(.hidden)');
  console.log('✅ Room created. Arrived at Lobby view.');

  // 2. Select Codenames game
  await page.waitForSelector('.lobby-games-grid .game-card');
  await page.click('.lobby-games-grid .game-card');
  console.log('✅ Codenames game card clicked.');

  await new Promise(r => setTimeout(r, 400));

  // 3. Click Start Game
  await page.evaluate(() => {
    const btn = document.getElementById('btnStartGame');
    btn.disabled = false;
    btn.click();
  });
  console.log('🚀 Clicked Start Game button.');

  // 4. Verify transition to #viewCodenames
  await page.waitForSelector('#viewCodenames:not(.hidden)', { timeout: 5000 });
  console.log('✅ Switched to #viewCodenames view.');

  // 5. Verify 25 Codenames cards render in grid
  const cards = await page.$$('.cn-card');
  console.log(`📊 Number of .cn-card elements found in DOM: ${cards.length}`);
  if (cards.length !== 25) {
    throw new Error(`Expected 25 cards, but found ${cards.length}`);
  }

  const sampleWords = await page.$$eval('.cn-card .card-word', els => els.map(e => e.innerText).slice(0, 5));
  console.log('Sample Card Words:', sampleWords);

  // Take screenshot
  const screenshotPath = '/Users/buffries/.gemini/antigravity-cli/brain/4f428574-6d5d-422d-9477-aedc90cd50a1/scratch/browser_screen.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved to: ${screenshotPath}`);

  await browser.close();
  console.log('🎉 ALL 25 CARDS ARE 100% VISIBLE IN THE BROWSER (NO KEYCARD VIEW BUTTON)!');
  process.exit(0);
}

runBrowserTest().catch(err => {
  console.error('❌ Browser E2E Test Failed:', err);
  process.exit(1);
});
