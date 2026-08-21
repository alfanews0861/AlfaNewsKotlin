const cheerio = require('cheerio');

async function test() {
    const sourceUrl = 'https://www.sakshi.com/telugu-news/nellore';
    const sourceBaseUrl = new URL(sourceUrl);
    
    const response = await fetch(sourceUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': 'https://www.google.com/',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const pathSegments = sourceBaseUrl.pathname.split('/').filter(s => s.length > 3);
    
    const links = [];
    $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.length > 15) {
            try {
                const fullUrl = href.startsWith('http') ? href : new URL(href, sourceUrl).href;
                const parsedUrl = new URL(fullUrl);
                
                const sourceDomain = sourceBaseUrl.hostname.replace('www.', '');
                const linkDomain = parsedUrl.hostname.replace('www.', '');
                const isSameDomain = linkDomain.includes(sourceDomain);
                
                if (!isSameDomain) return;

                const path = parsedUrl.pathname.toLowerCase();
                const spamPatterns = [
                    'facebook', 'twitter', 'whatsapp', 'linkedin', 'telegram', 'instagram', 'youtube',
                    '/category/', '/tag/', '/author/', '/about', '/contact', '/privacy', '/terms', 
                    '/disclaimer', '/login', '/register', '/profile', '/search', '/subscribe',
                    'javascript:', 'mailto:', 'tel:'
                ];
                
                const isSpam = spamPatterns.some(p => path.includes(p)) || 
                               path === '/' || path === '' || 
                               fullUrl === sourceUrl;
                
                if (isSpam) return;

                const genericSegments = ['telugu-news', 'news', 'andhra-pradesh', 'telangana', 'ap', 'ts', 'latest-news', 'districts', 'district', 'state', 'national', 'mainnews', 'article'];
                const specificSegments = pathSegments.filter(s => !genericSegments.includes(s.toLowerCase()));
                
                const isSakshi = sourceUrl.includes('sakshi.com');
                const isEenadu = sourceUrl.includes('eenadu.net');
                
                let isRelevant = true;
                if (isSakshi || isEenadu) {
                    // Sakshi changed their URL structure, so we need to be more flexible
                    if (isSakshi) {
                        // For Sakshi, check if the district name is anywhere in the URL
                        // Sakshi URLs often don't have the district name in the article URL itself anymore
                        // They just have /telugu-news/category/article-title-id
                        // So we'll consider all articles on the district page as relevant if they are actual articles
                        isRelevant = true;
                    } else {
                        if (specificSegments.length > 0) {
                            isRelevant = specificSegments.some(segment => fullUrl.toLowerCase().includes(segment.toLowerCase()));
                        }
                    }
                } else if (specificSegments.length > 0) {
                    isRelevant = specificSegments.some(segment => fullUrl.toLowerCase().includes(segment.toLowerCase()));
                } else if (pathSegments.length > 0) {
                    isRelevant = pathSegments.some(segment => fullUrl.toLowerCase().includes(segment.toLowerCase()));
                }

                // Sakshi URLs often don't have .html and might be shorter
                // A typical Sakshi article URL has a number at the end
                const hasNumberAtEnd = /\d+$/.test(path);
                const isLikelyArticle = path.split('/').filter(Boolean).length >= 2 || path.endsWith('.html') || path.endsWith('.php') || (isSakshi && hasNumberAtEnd);

                if (isLikelyArticle && isRelevant && (isSakshi ? hasNumberAtEnd : true)) {
                    links.push({ url: fullUrl, isRelevant });
                }
            } catch(e) {}
        }
    });

    const uniqueLinks = Array.from(new Set(links.map(l => l.url))).map(url => links.find(l => l.url === url));
    console.log(`Found ${uniqueLinks.length} links:`);
    uniqueLinks.forEach(l => console.log(`${l.isRelevant ? '[RELEVANT]' : '[IGNORED]'} ${l.url}`));
}
test();
