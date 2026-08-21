const cheerio = require('cheerio');

async function test() {
    const sourceUrl = 'https://www.eenadu.net/andhra-pradesh/districts/nellore';
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
                    if (specificSegments.length > 0) {
                        isRelevant = specificSegments.some(segment => fullUrl.toLowerCase().includes(segment.toLowerCase()));
                    }
                } else if (specificSegments.length > 0) {
                    isRelevant = specificSegments.some(segment => fullUrl.toLowerCase().includes(segment.toLowerCase()));
                } else if (pathSegments.length > 0) {
                    isRelevant = pathSegments.some(segment => fullUrl.toLowerCase().includes(segment.toLowerCase()));
                }

                const isLikelyArticle = path.split('/').filter(Boolean).length >= 2 || path.endsWith('.html') || path.endsWith('.php');

                if (isRelevant && isLikelyArticle) links.push(fullUrl);
            } catch(e) {}
        }
    });

    const uniqueLinks = Array.from(new Set(links));
    console.log(`Found ${uniqueLinks.length} links:`);
    uniqueLinks.forEach(l => console.log(l));
}
test();
