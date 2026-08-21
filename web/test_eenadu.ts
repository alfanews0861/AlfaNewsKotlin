import * as cheerio from 'cheerio';

async function test() {
  try {
    const response = await fetch('https://www.eenadu.net/telugu-news/districts/ap/nellore', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.google.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Length:', text.length);
    const $ = cheerio.load(text);
    console.log('Links:', $('a').length);
  } catch (e) {
    console.error(e);
  }
}
test();
