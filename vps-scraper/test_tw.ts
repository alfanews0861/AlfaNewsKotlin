import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function test() {
    const handle = 'ncbn';
    const timelineUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`;
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
            let tweets = [];
            for (const entry of entries) {
                if (entry.type === 'tweet') {
                    const tweet = entry.content?.tweet;
                    if (tweet) {
                        tweets.push({
                            text: tweet.full_text || tweet.text,
                            date: new Date(tweet.created_at)
                        });
                    }
                }
            }
            tweets.sort((a,b) => b.date - a.date);
            console.log("Top 5 recent for ncbn:");
            for(const t of tweets.slice(0,5)) {
                console.log(t.date.toISOString(), t.text.substring(0, 50).replace(/\n/g, " "));
            }
        } 
    } 
}
test();
