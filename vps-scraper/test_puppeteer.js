const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function test() {
    const handle = 'kotamreddy_NLR';
    const instances = [
        'https://xcancel.com',
        'https://nitter.poast.org'
    ];
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    for (const instance of instances) {
        try {
            console.log("Trying", instance);
            const page = await browser.newPage();
            await page.goto(`${instance}/${handle}`, { waitUntil: 'networkidle2', timeout: 15000 });
            
            const html = await page.content();
            const tweets = await page.$$eval('.timeline-item', els => els.length);
            console.log("Found", tweets, "tweets");
            
            if (tweets > 0) {
                const results = await page.$$eval('.timeline-item', els => 
                    els.slice(0,2).map(el => {
                        return {
                            date: el.querySelector('.tweet-date a')?.getAttribute('title'),
                            text: el.querySelector('.tweet-content')?.textContent,
                        };
                    })
                );
                console.log(results);
                break;
            }
        } catch(e) {
            console.log(instance, "error:", e.message);
        }
    }
    await browser.close();
}
test();
