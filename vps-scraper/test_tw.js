import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function test() {
    const handle = 'kotamreddy_NLR';
    const timelineUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`;
    console.log("Fetching", timelineUrl);
    const synRes = await fetch(timelineUrl, {
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        }
    });
    if (synRes.ok) {
        const html = await synRes.text();
        const $ = cheerio.load(html);
        const nextData = $('#__NEXT_DATA__').html();
        if (nextData) {
            const synData = JSON.parse(nextData);
            const entries = synData?.props?.pageProps?.timeline?.entries || [];
            console.log("Found entries:", entries.length);
            for (const entry of entries) {
                if (entry.type === 'tweet') {
                    const tweet = entry.content?.tweet;
                    if (tweet) {
                        console.log(tweet.full_text || tweet.text);
                        console.log("Media:", tweet.entities?.media?.[0]?.media_url_https);
                        console.log("Date:", tweet.created_at);
                        console.log("----------");
                    }
                }
            }
        } else {
            console.log("__NEXT_DATA__ not found");
        }
    } else {
        console.log("Failed", synRes.status, await synRes.text());
    }
}
test();
