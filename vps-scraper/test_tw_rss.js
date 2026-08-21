const Parser = require('rss-parser');
const rssParser = new Parser();

async function test() {
    const handle = 'kotamreddy_NLR';
    const rssUrl = `https://xcancel.com/${handle}/rss`;
    try {
        const fetchedData = await rssParser.parseURL(rssUrl);
        console.log(`Found ${fetchedData.items.length} tweets`);
        for (const item of fetchedData.items) {
            console.log(item.title);
            console.log("Link:", item.link);
            console.log("Date:", item.pubDate);
            console.log("-------------");
        }
    } catch (e) {
        console.error(e);
    }
}
test();
