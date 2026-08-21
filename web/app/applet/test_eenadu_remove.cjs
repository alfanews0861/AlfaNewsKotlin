const cheerio = require('cheerio');

async function test() {
  try {
    const response = await fetch('https://www.eenadu.net/andhra-pradesh/districts/nellore', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.google.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const text = await response.text();
    const $ = cheerio.load(text);
    
    let linksBefore = [];
    $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('/districts/')) linksBefore.push(href);
    });
    console.log('District Links Before Removal:', linksBefore.length);
    
    $('nav, header, footer, script, style, .footer, .header').remove();
    
    let linksAfter = [];
    $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('/districts/')) linksAfter.push(href);
    });
    console.log('District Links After Removal:', linksAfter.length);
    
  } catch (e) {
    console.error(e);
  }
}
test();
