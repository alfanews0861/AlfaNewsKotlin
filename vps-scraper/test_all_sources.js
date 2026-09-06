/**
 * Test script to verify extractor.js against live Telugu news portals
 */
const { extractArticleLinks, extractArticleData, parseArticleDate, isArticleLink } = require('./extractor');

const TEST_LANDING_PAGES = [
    { name: 'Eenadu Nellore', url: 'https://www.eenadu.net/andhra-pradesh/districts/nellore' },
    { name: 'Sakshi Telangana', url: 'https://www.sakshi.com/telangana' },
    { name: 'Namasthe Telangana', url: 'https://www.ntnews.com/telangana' },
    { name: 'Andhra Jyothy Telangana', url: 'https://www.andhrajyothy.com/telangana' },
    { name: 'TV9 Telangana', url: 'https://tv9telugu.com/telangana' },
    { name: 'News18 Telangana', url: 'https://telugu.news18.com/telangana/' }
];

async function fetchPage(url) {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://www.google.com/'
        }
    });
    return await res.text();
}

async function runTests() {
    console.log("=================================================");
    console.log("STARTING LIVE SOURCE EXTRACTION VERIFICATION");
    console.log("=================================================\n");

    let totalPassed = 0;

    for (const source of TEST_LANDING_PAGES) {
        console.log(`>>> Testing [${source.name}]: ${source.url}`);
        try {
            const html = await fetchPage(source.url);
            const links = extractArticleLinks(html, source.url);
            console.log(`   Found ${links.length} filtered article links.`);
            
            if (links.length === 0) {
                console.log(`   ❌ FAILED: 0 article links found!`);
                continue;
            }

            console.log(`   Sample article link: ${links[0]}`);

            // Test first article extraction
            const articleHtml = await fetchPage(links[0]);
            const data = extractArticleData(articleHtml, links[0]);

            console.log(`   Headline: "${data.headline}"`);
            console.log(`   Body Length: ${data.body.length} chars`);
            console.log(`   Image: ${data.image || 'None'}`);
            console.log(`   Date: ${data.date ? data.date.toISOString() : 'None'}`);

            if (data.body.length >= 200) {
                console.log(`   ✅ PASSED: Successfully extracted robust article text!`);
                totalPassed++;
            } else {
                console.log(`   ⚠️ WARNING: Body text length is under 200 (${data.body.length})`);
            }
        } catch (e) {
            console.log(`   ❌ ERROR testing ${source.name}: ${e.message}`);
        }
        console.log("");
    }

    console.log(`=================================================`);
    console.log(`SUMMARY: ${totalPassed} / ${TEST_LANDING_PAGES.length} sources passed successfully.`);
    console.log(`=================================================`);
}

runTests();
