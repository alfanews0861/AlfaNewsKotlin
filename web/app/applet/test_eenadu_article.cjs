const cheerio = require('cheerio');

async function test() {
  try {
    const response = await fetch('https://www.eenadu.net/telugu-news/districts/nellore-news/9/126045130', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.google.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    $('script, style, nav, header, footer, .sidebar, .comments, .related, .ads, .menu, .navigation, .social-share, .footer-tags, .tags, aside, .widget, .promo, .about-us, .author-bio, [role="complementary"], .breadcrumb').remove();
    $('.next-article, .js-next-article, .js_lazy_article, #appended_articles, .infinite-scroll, .also-read, .read-more, .trending, .latest-news, .recommendations, [data-itemprop="isBasedOn"], .taboola, .outbrain, .related-news, .related-articles, .more-news, .top-stories, .popular-news, .you-may-like, .recommended').remove();
    
    let bodyText = '';
    const selectors = [
        '.story-full-text p', '.story-details p', '.article-content p', 
        'article p', '.entry-content p', '.full-details p', 
        '.post-content p', '.td-post-content p', '.article-body p',
        '.content-area p', '[itemprop="articleBody"] p', '.post-text p',
        'div[data-articlebody] p', '._3WlLe p', '.art_content p',
        '.text-justify p', '.content-body p', '.artical-content p',
        '.news-content p', '.story-content p', '.main-content p',
        '.sak-article-content p', '.story-full-text',
        '.story-content', '.full-details', '.article-content'
    ];
    
    $(selectors.join(', ')).each((i, el) => {
        const txt = $(el).text().trim();
        if (txt.length > 30) bodyText += txt + ' ';
    });
    
    console.log('Extracted Text Length:', bodyText.length);
    console.log('Extracted Text Preview:', bodyText.substring(0, 200));
  } catch (e) {
    console.error(e);
  }
}
test();
