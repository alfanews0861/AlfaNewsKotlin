const cheerio = require('cheerio');

async function test() {
    const handle = 'kotamreddy_NLR';
    const urls = [
        `https://xcancel.com/${handle}`,
        `https://nitter.cz/${handle}`,
        `https://nitter.privacydev.net/${handle}`
    ];
    for (const url of urls) {
        try {
            console.log("Trying", url);
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            const text = await res.text();
            const $ = cheerio.load(text);
            const tweets = $('.timeline-item').length;
            console.log("Found", tweets, "tweets");
            
            if (tweets > 0) {
                $('.timeline-item').slice(0, 2).each((i, el) => {
                    const txt = $(el).find('.tweet-content').text().trim();
                    const date = $(el).find('.tweet-date a').attr('title');
                    const img = $(el).find('.attachment.image img').attr('src');
                    console.log(date, txt.substring(0, 50).replace(/\n/g, ' '));
                    console.log("Image", img);
                });
                break;
            }
        } catch(e) {
            console.error(url, e.message);
        }
    }
}
test();
