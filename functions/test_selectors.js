const cheerio = require('cheerio');
const https = require('https');

const url = 'https://www.sakshi.com/andhra-pradesh/annamayya';

https.get(url, (res) => {
    let html = '';
    res.on('data', chunk => html += chunk);
    res.on('end', () => {
        const $ = cheerio.load(html);

        console.log('=== Testing CSS Selectors ===\n');

        // Test main content selector
        const mainLinks = $('ul#news-view a.news_link, ul.news_list a.news_link');
        console.log(`Main content links found: ${mainLinks.length}`);
        mainLinks.slice(0, 5).each((i, el) => {
            const href = $(el).attr('href');
            const title = $(el).find('h2').text().trim();
            console.log(`  ${i + 1}. ${title.substring(0, 50)}... (${href})`);
        });

        console.log('\n=== Testing Breaking News Exclusion ===\n');

        // Test breaking news selector
        const breakingLinks = $('.notify_content a');
        console.log(`Breaking news links found: ${breakingLinks.length}`);
        breakingLinks.slice(0, 3).each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            console.log(`  ${i + 1}. ${text.substring(0, 50)}... (${href})`);
        });

        console.log('\n=== Testing Image Detection ===\n');

        // Test image detection
        mainLinks.slice(0, 3).each((i, el) => {
            const img = $(el).find('img');
            const imgSrc = img.attr('src');
            const title = $(el).find('h2').text().trim();
            const isGeneric = imgSrc && (imgSrc.includes('Default.svg') || imgSrc.toLowerCase().includes('logo'));
            console.log(`  ${i + 1}. ${title.substring(0, 40)}`);
            console.log(`     Image: ${imgSrc || 'NO IMAGE'}`);
            console.log(`     Generic: ${isGeneric ? 'YES - SKIP' : 'NO - OK'}`);
        });
    });
}).on('error', err => console.error(err));
