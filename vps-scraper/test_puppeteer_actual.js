const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function test() {
    const handle = 'ncbn';
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        console.log("Trying twitter.com");
        const page = await browser.newPage();
        await page.goto(`https://twitter.com/${handle}`, { waitUntil: 'networkidle2', timeout: 20000 });
        
        await page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
        const tweets = await page.$$eval('[data-testid="tweet"]', els => els.length);
        console.log("Found", tweets, "tweets");
        
        const results = await page.$$eval('[data-testid="tweet"]', els => 
            els.slice(0,2).map(el => el.innerText)
        );
        console.log("Tweets:", results);
    } catch(e) {
        console.log("Error:", e.message);
    }
    
    await browser.close();
}
test();
