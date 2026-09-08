/**
 * AlfaNews - Advanced Web Scraping Extractor Module
 * Supports: Eenadu, Sakshi, Namasthe Telangana, Andhra Jyothy, TV9, News18, Samayam, and standard news CMS.
 */

const cheerio = require('cheerio');

// ============================================================================
// TELUGU MONTH MAPPING & DATE PARSER
// ============================================================================
const TELUGU_MONTHS = {
    'జనవరి': 0, 'ఫిబ్రవరి': 1, 'మార్చి': 2, 'ఏప్రిల్': 3,
    'మే': 4, 'జూన్': 5, 'జూలై': 6, 'ఆగస్టు': 7,
    'సెప్టెంబర్': 8, 'సెప్టెంబరు': 8, 'అక్టోబర్': 9, 'అక్టోబరు': 9,
    'నవంబర్': 10, 'నవంబరు': 10, 'డిసెంబర్': 11, 'డిసెంబరు': 11
};

/**
 * Robustly parses article dates across ISO, RFC, Drupal/Sakshi formats, and Telugu text dates.
 * @param {string|Date} rawDate 
 * @returns {Date|null}
 */
function parseArticleDate(rawDate) {
    if (!rawDate) return null;
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) return rawDate;
    if (typeof rawDate !== 'string') return null;

    const trimmed = rawDate.trim();

    // 1. Try native Date constructor
    let date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
        return date;
    }

    // 2. Sakshi Drupal format: "Fri, 09/04/2026 - 13:13" or "09/04/2026 - 13:13"
    const drupalMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2}):(\d{2})/);
    if (drupalMatch) {
        const [, month, day, year, hour, minute] = drupalMatch;
        // Interpret as IST (Asia/Kolkata +05:30)
        date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:00+05:30`);
        if (!isNaN(date.getTime())) return date;
    }

    // 3. Indian format "DD-MM-YYYY HH:mm:ss" or "YYYY-MM-DD HH:mm:ss"
    const standardMatch = trimmed.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (standardMatch) {
        const [, y, m, d, h, min, s] = standardMatch;
        date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min}:${s || '00'}+05:30`);
        if (!isNaN(date.getTime())) return date;
    }

    // 4. Telugu month string e.g. "సెప్టెంబర్ 4, 2026" or "04 సెప్టెంబర్ 2026"
    for (const [telMonth, monthIdx] of Object.entries(TELUGU_MONTHS)) {
        if (trimmed.includes(telMonth)) {
            const numbers = trimmed.match(/\d+/g);
            if (numbers && numbers.length >= 2) {
                let day = parseInt(numbers[0], 10);
                let year = parseInt(numbers[1], 10);
                if (day > 1000) { // Swapped (year first)
                    const temp = day;
                    day = year;
                    year = temp;
                }
                date = new Date(year, monthIdx, day);
                if (!isNaN(date.getTime())) return date;
            }
        }
    }

    return null;
}

// ============================================================================
// GENERIC / LOGO IMAGE FILTERING
// ============================================================================
const GENERIC_IMAGE_PATTERNS = [
    'placeholder', 'default-image', 'default_image', 'no-image', 'noimage',
    'masthead', 'site-logo', 'sitelogo', 'site_logo', 'channel_logo', 'brand_logo', 'news_logo',
    'app-logo', 'header_logo', 'header-logo', 'footer_logo', 'footer-logo', 'favicon',
    'dummy', 'share_image', 'og_default', 'fb_share', 'twitter_share',
    'header_sun', 'eenadu_sun', 'eenadu_header', 'eenadu_red', 'eenadu_logo',
    'toi_logo', 'toi-logo', 'timesofindia_logo', 'sakshi_logo', 'sakshi-logo',
    'aj_logo', 'ntnews_logo', 'tv9_logo', 'v6_logo', 'abp_logo', 'abp_live',
    'etv', 'etvbharat', 'etv-bharat', 'etv_bharat', 'etv_logo', 'bharat_logo',
    'hmtv', 'mahaa', '10tv', 'ap7am', 'telugustop', 'tv5', 'ntv_logo', 'aajtak', 'news18',
    'greatandhra', 'gulte', 'thehindu', 'deccanchronicle', 'watermark', 'banner_logo',
    'static.toiimg.com/photo/108381831', 'static.toiimg.com/photo/4752938',
    'scorecardresearch.com', 'google-analytics', 'facebook.com/tr',
    'assets/_images/logos/', 'e-paper.webp', 'bell-icon.webp', 'gg-pref.gif',
    'andhra-pradesh-logo.webp', 'telangana-logo.webp', 'eenadu.webp',
    'assets/images/logos/'
];

/**
 * Determines whether an image URL is a generic logo, banner, or placeholder.
 * @param {string} url 
 * @returns {boolean}
 */
function isGenericImage(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') return true;
    const lowerUrl = url.toLowerCase().trim();

    // Default Alfa News placeholder logo
    if (lowerUrl.includes('alfa-news') || lowerUrl.includes('bg.png') || lowerUrl.includes('70bb37fd-c13d-4f97-84e1-11fb6c0d1061') || lowerUrl.includes('alfanews.app/logo')) {
        return true;
    }

    // Vector icons or animations are never news photos
    if (lowerUrl.endsWith('.svg') || lowerUrl.endsWith('.gif') || lowerUrl.includes('.svg?') || lowerUrl.includes('.gif?')) {
        return true;
    }

    // Exact or partial logo file name match
    if (/(?:logo|brand|masthead|watermark|banner_logo)[-_a-z0-9]*\.(?:png|jpg|jpeg|webp)/i.test(lowerUrl)) {
        return true;
    }

    // Directory-level logo assets
    if (/\/(?:logos|branding|placeholders|watermarks|brand_assets)\//i.test(lowerUrl)) {
        return true;
    }

    // ETV / ETV Bharat specifics (channel logos, default mastheads)
    if (lowerUrl.includes('etvbharat') || lowerUrl.includes('etv.co.in') || lowerUrl.includes('etv-bharat') || lowerUrl.includes('etv_bharat')) {
        if (lowerUrl.includes('logo') || lowerUrl.includes('default') || lowerUrl.includes('placeholder') || lowerUrl.includes('brand') || lowerUrl.includes('channel') || lowerUrl.includes('bharat_logo') || lowerUrl.includes('etv_logo')) {
            return true;
        }
    }

    // Eenadu specifics: reject known header/brand assets, but accept all article media
    if (lowerUrl.includes('eenadu.net')) {
        if (lowerUrl.includes('_assets/_images/logos') || 
            lowerUrl.includes('e-paper.webp') || 
            lowerUrl.includes('bell-icon.webp') || 
            lowerUrl.includes('eenadu.webp') || 
            lowerUrl.includes('andhra-pradesh-logo') || 
            lowerUrl.includes('telangana-logo') ||
            lowerUrl.includes('eenadu_sun') ||
            lowerUrl.includes('eenadu_header') ||
            lowerUrl.includes('eenadu_logo')) {
            return true;
        }
        // Genuine article media across Eenadu CDN paths
        const isActualArticleImage = lowerUrl.includes('/featureimages/') ||
                                     lowerUrl.includes('/article_multiple_images/') ||
                                     lowerUrl.includes('/article_images/') ||
                                     lowerUrl.includes('/video_images/') ||
                                     lowerUrl.includes('/metaimages/') ||
                                     lowerUrl.includes('/districts/') || 
                                     lowerUrl.includes('/uploads/') || 
                                     lowerUrl.includes('/photos/') || 
                                     lowerUrl.includes('/stories/') || 
                                     lowerUrl.includes('/news/') || 
                                     lowerUrl.includes('_1.jpg') || 
                                     lowerUrl.includes('_1.webp') ||
                                     /\d{6,}/.test(lowerUrl);
        if (isActualArticleImage) return false;
    }

    // Check generic blacklist patterns
    if (GENERIC_IMAGE_PATTERNS.some(p => lowerUrl.includes(p))) {
        // Exception: actual article image with specific folder paths
        if (lowerUrl.includes('article_images/') || 
            lowerUrl.includes('article_multiple_images/') || 
            lowerUrl.includes('/uploads/') || 
            lowerUrl.includes('/featureimages/')) {
            return false;
        }
        return true;
    }

    return false;
}

/**
 * Sanitizes Telugu text by converting any bled Kannada Unicode characters (0x0C80-0x0CFF)
 * and Devanagari/Hindi Unicode characters (0x0900-0x097F) to Telugu, removing orphaned matras,
 * broken placeholder glyphs, and zero-width spaces, ensuring 100% pure Telugu script purity.
 */
function sanitizeTeluguText(text) {
    if (!text) return "";
    return text
        // 1. Map any bled Kannada Unicode characters (0x0C80-0x0CFF) to Telugu Unicode (0x0C00-0x0C7F)
        .replace(/[\u0C80-\u0CFF]/g, (char) => {
            const code = char.charCodeAt(0) - 0x0080;
            return (code >= 0x0C00 && code <= 0x0C7F) ? String.fromCharCode(code) : '';
        })
        // 2. Map any bled Devanagari / Hindi Unicode characters (0x0900-0x097F) to Telugu Unicode (0x0C00-0x0C7F)
        .replace(/[\u0900-\u097F]/g, (char) => {
            const code = char.charCodeAt(0) + 0x0300;
            return (code >= 0x0C00 && code <= 0x0C7F) ? String.fromCharCode(code) : '';
        })
        // 3. Strip any residual unmapped Kannada or Hindi characters to guarantee 0% Kannada/Hindi
        .replace(/[\u0900-\u097F\u0C80-\u0CFF]/g, '')
        // 4. Remove dotted circle characters used as fallback for broken combining marks
        .replace(/\u25CC/g, '')
        // 5. Remove invisible zero-width spaces that break Telugu word joining
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        // 6. Fix spaces before Telugu combining vowel marks / virama
        .replace(/\s+([\u0C01-\u0C03\u0C3E-\u0C4D\u0C55\u0C56\u0C62\u0C63])/g, '$1')
        .trim();
}

// ============================================================================
// ARTICLE LINK DETECTOR & FILTER
// ============================================================================
const SPAM_URL_PATTERNS = [
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'youtube.com',
    'whatsapp.com', 'telegram.me', 'linkedin.com',
    '/tag/', '/tags/', '/author/', '/category/', '/categories/', '/section/',
    '/topic/', '/about', '/contact', '/privacy', '/terms', '/disclaimer',
    '/login', '/register', '/subscribe', '/search', '/profile', '/epaper',
    'javascript:', 'mailto:', 'tel:', '#'
];

/**
 * Checks if an extracted URL is a genuine news article (not a category or nav link).
 * @param {string} href 
 * @param {string} sourceUrl 
 * @returns {boolean}
 */
function isArticleLink(href, sourceUrl) {
    if (!href || typeof href !== 'string' || href.length < 15) return false;

    let targetUrl;
    let sourceBaseUrl;
    try {
        targetUrl = new URL(href, sourceUrl);
        sourceBaseUrl = new URL(sourceUrl);
    } catch (e) {
        return false;
    }

    // 1. Same domain check
    const sourceDomain = sourceBaseUrl.hostname.replace(/^www\./, '');
    const targetDomain = targetUrl.hostname.replace(/^www\./, '');
    if (!targetDomain.endsWith(sourceDomain)) {
        return false;
    }

    // 2. Reject exact source URL or root
    if (targetUrl.href === sourceBaseUrl.href || targetUrl.pathname === '/' || targetUrl.pathname === '') {
        return false;
    }

    const path = targetUrl.pathname.toLowerCase();

    // 3. Reject known non-article / spam patterns
    if (SPAM_URL_PATTERNS.some(p => path.includes(p) || targetUrl.href.includes(p))) {
        return false;
    }

    // 4. Reject pure category pagination e.g. /page/2, /telangana/page/2
    if (/\/page\/\d+/i.test(path)) {
        return false;
    }

    // 5. Positive article markers:
    // A. Long numeric ID (typical for Eenadu, Sakshi, NTNews, TV9, News18, Andhra Jyothy)
    const hasArticleId = /\d{5,}/.test(path) || /-\d+\.html$/i.test(path);

    // B. News sub-paths with a slug:
    const hasNewsPath = path.includes('/news/') ||
                        path.includes('/telugu-news/') ||
                        path.includes('/article/') ||
                        path.includes('/stories/') ||
                        path.includes('/national/') ||
                        path.includes('/international/') ||
                        path.includes('/telangana/') ||
                        path.includes('/andhra-pradesh/') ||
                        path.includes('/districts/');

    const pathSegments = path.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1] || '';

    // If it's a section like "/telangana/hyderabad" with no ID and short name, it's a subcategory page
    if (!hasArticleId && pathSegments.length <= 2 && lastSegment.length < 25) {
        return false;
    }

    // If it has an article ID or has a long descriptive news slug
    if (hasArticleId || (hasNewsPath && lastSegment.length > 20 && lastSegment.includes('-'))) {
        return true;
    }

    return false;
}

/**
 * Extracts and filters all valid article links from a source HTML page.
 * @param {string} html 
 * @param {string} sourceUrl 
 * @returns {string[]}
 */
function extractArticleLinks(html, sourceUrl) {
    if (!html) return [];
    const $ = cheerio.load(html);
    const links = [];

    // Extract district keyword if sourceUrl is a district specific page
    const sourceObj = new URL(sourceUrl);
    const rawSegments = sourceObj.pathname.split('/').filter(Boolean);
    // Ignore generic segment names like 'districts', 'telugu-news', 'andhra-pradesh', 'telangana'
    const genericSegments = ['districts', 'district', 'telugu-news', 'news', 'andhra-pradesh', 'telangana', 'ap', 'ts', 'page', 'index'];
    const specificKeyword = rawSegments.reverse().find(s => {
        const clean = s.replace(/\.html|\.php/g, '').toLowerCase();
        return clean.length > 2 && !genericSegments.includes(clean);
    });

    $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        try {
            const absoluteUrl = href.startsWith('http') ? href : new URL(href, sourceUrl).href;
            if (isArticleLink(absoluteUrl, sourceUrl)) {
                // If a specific district keyword exists (e.g. 'nellore'), prioritize matching links
                if (specificKeyword) {
                    const cleanKeyword = specificKeyword.replace(/\.html|\.php/g, '').toLowerCase();
                    if (absoluteUrl.toLowerCase().includes(cleanKeyword)) {
                        links.push(absoluteUrl);
                        return;
                    }
                }
                links.push(absoluteUrl);
            }
        } catch (e) {}
    });

    return [...new Set(links)];
}

// ============================================================================
// MULTI-TIER ARTICLE DATA EXTRACTOR (JSON-LD + DOM + FALLBACK)
// ============================================================================
const MODERN_BODY_SELECTORS = [
    // Sakshi Drupal
    '.news-story-body', '.news-story-content', '.sak-article-content',
    // Namasthe Telangana (NT News)
    '.detailBody', '.single-post-content', '.post-details',
    // Andhra Jyothy
    '.category_desc', '.article-body', '.story-details',
    // TV9 Telugu
    '.ArticleBodyCont', '.article-content', '.story_content',
    // News18 Telugu
    '._article_body', '.articleBody', '.content-wrapper',
    // Eenadu
    '.story-full-text', '.full-story', '.story-details',
    // General CMS standard selectors
    'article .story-content', 'article .entry-content', 'article .post-content',
    '[itemprop="articleBody"]', 'div[data-articlebody]', '._3WlLe',
    '.art_content', '.content-body', '.artical-content', '.news-content',
    '.main-content', '.story-full-text', '.td-post-content'
];

/**
 * Extracts clean article data (headline, body, image, date) using JSON-LD and modern DOM selectors.
 * @param {string} html 
 * @param {string} articleUrl 
 * @returns {object} { headline, body, image, date }
 */
function extractArticleData(html, articleUrl) {
    if (!html) return { headline: '', body: '', image: null, date: null };

    const $ = cheerio.load(html);

    let jsonLdHeadline = '';
    let jsonLdBody = '';
    let jsonLdImage = '';
    let jsonLdDate = null;

    // 1. Check all JSON-LD scripts
    $('script[type="application/ld+json"]').each((i, el) => {
        try {
            const raw = $(el).html();
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);

            for (const item of items) {
                const type = item['@type'];
                if (type === 'NewsArticle' || type === 'Article' || type === 'BlogPosting' || type === 'Report') {
                    if (item.headline && !jsonLdHeadline) {
                        jsonLdHeadline = String(item.headline).trim();
                    }
                    if (item.articleBody && !jsonLdBody) {
                        jsonLdBody = String(item.articleBody).replace(/<[^>]*>?/gm, '').trim();
                    }
                    if (item.image && !jsonLdImage) {
                        if (typeof item.image === 'string') jsonLdImage = item.image;
                        else if (item.image.url) jsonLdImage = item.image.url;
                        else if (Array.isArray(item.image) && item.image.length > 0) {
                            jsonLdImage = typeof item.image[0] === 'string' ? item.image[0] : (item.image[0]?.url || '');
                        }
                    }
                    if (item.datePublished && !jsonLdDate) {
                        jsonLdDate = parseArticleDate(item.datePublished);
                    }
                }
            }
        } catch (e) {}
    });

    // 2. Strip noise elements, tickers, related stories, and logo tags from DOM
    $('nav, header, footer, script, style, .ads, .sidebar, .comments, aside, #sidebar, .related, .trending, .popular, .latest-news, .logo, .site-logo, .brand, .header-logo, .menu, .navigation, .social-share, .footer-tags, .tags, .widget, .promo, .about-us, .author-bio, [role="complementary"], .breadcrumb, .taboola, .outbrain, .google_ads_wrap_in_image, .next-article, .infinite-scroll, .related-stories, .side-bar, .more-news, .also-read, .trending-news, .other-news, .story-related, .news-ticker, .ticker, .scroll-news, .news-strip, .breaking-strip').remove();
    $('img[src*="logo" i], img[class*="logo" i], img[id*="logo" i], img[alt*="logo" i], img[alt*="ETV" i], img[alt*="Sakshi" i], img[alt*="Eenadu" i], img[src*="etvbharat" i], img[src*="etv-bharat" i]').remove();

    // 3. Extract DOM Article Body
    let domBody = '';
    for (const selector of MODERN_BODY_SELECTORS) {
        const container = $(selector);
        if (container.length > 0) {
            let text = '';
            // Try p tags first
            const pTags = container.find('p');
            if (pTags.length > 0) {
                pTags.each((_, p) => {
                    const t = $(p).text().trim();
                    if (t.length > 20 && !t.includes('Copyright') && !t.includes('All rights reserved')) {
                        text += t + ' ';
                    }
                });
            } else {
                text = container.text().trim();
            }

            if (text.length > 150) {
                domBody = text.replace(/\s+/g, ' ').trim();
                break; // Found strong match
            }
        }
    }

    // Fallback: search general <article p> or <main p>
    if (domBody.length < 150) {
        let fallbackText = '';
        $('article p, main p, [role="main"] p').each((_, p) => {
            const t = $(p).text().trim();
            if (t.length > 30 && !t.includes('Copyright') && !t.includes('Read Also')) {
                fallbackText += t + ' ';
            }
        });
        if (fallbackText.length > 150) {
            domBody = fallbackText.replace(/\s+/g, ' ').trim();
        }
    }

    // Final Body Decision: prefer whichever is cleaner and longer (> 200 chars)
    let finalBody = domBody;
    if (jsonLdBody && jsonLdBody.length >= 200) {
        if (!domBody || domBody.length < 200 || jsonLdBody.length > domBody.length * 0.8) {
            finalBody = jsonLdBody;
        }
    }
    finalBody = finalBody.replace(/\s+/g, ' ').trim();

    // 4. Headline Extraction
    let finalHeadline = jsonLdHeadline;
    if (!finalHeadline) {
        finalHeadline = $('meta[property="og:title"]').attr('content') ||
                        $('meta[name="twitter:title"]').attr('content') ||
                        $('h1').first().text().trim() || '';
    }
    finalHeadline = finalHeadline.replace(/\s+/g, ' ').trim();

    // 5. Image Extraction
    let candidateImage = null;
    if (jsonLdImage && !isGenericImage(jsonLdImage)) {
        candidateImage = jsonLdImage;
    }

    if (!candidateImage) {
        const metaImg = $('meta[property="og:image"]').attr('content') || 
                       $('meta[name="twitter:image"]').attr('content') ||
                       $('meta[name="twitter:image:src"]').attr('content') ||
                       $('meta[property="twitter:image"]').attr('content') ||
                       $('link[rel="image_src"]').attr('href');
        if (metaImg && !isGenericImage(metaImg)) {
            candidateImage = metaImg;
        }
    }

    if (!candidateImage) {
        $('article img, main img, figure img, picture source, picture img, .news-story-body img, .detailBody img, .category_desc img, .ArticleBodyCont img, ._article_body img, .story-details img').each((_, el) => {
            const raw = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original') || $(el).attr('data-lazy-src') || $(el).attr('data-hi-res-src') || $(el).attr('srcset');
            if (raw && typeof raw === 'string') {
                let clean = raw.trim();
                if (clean.includes(',')) {
                    // Extract highest resolution or first URL from srcset
                    const sources = clean.split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
                    clean = sources[sources.length - 1] || sources[0];
                }
                if (clean.startsWith('data:image')) return; // Skip inline base64 placeholders

                try {
                    const resolved = clean.startsWith('http') ? clean : new URL(clean, articleUrl).href;
                    if (resolved && resolved.startsWith('http') && !isGenericImage(resolved)) {
                        candidateImage = resolved;
                        return false;
                    }
                } catch (e) {}
            }
        });
    }

    // Resolve relative image URLs if candidateImage wasn't already absolute
    if (candidateImage && !candidateImage.startsWith('http')) {
        try {
            candidateImage = new URL(candidateImage, articleUrl).href;
        } catch (e) {
            candidateImage = null;
        }
    }

    // 6. Date Extraction
    let finalDate = jsonLdDate;
    if (!finalDate) {
        const dateMetaSelectors = [
            'meta[property="article:published_time"]',
            'meta[property="og:published_time"]',
            'meta[name="pubdate"]',
            'meta[name="publish-date"]',
            'meta[name="dc.date"]',
            'meta[name="date"]',
            'meta[itemprop="datePublished"]',
            'time[datetime]'
        ];
        for (const selector of dateMetaSelectors) {
            const val = $(selector).attr('content') || $(selector).attr('datetime');
            if (val) {
                const parsed = parseArticleDate(val);
                if (parsed) {
                    finalDate = parsed;
                    break;
                }
            }
        }
    }

    return {
        headline: finalHeadline,
        body: finalBody,
        image: candidateImage,
        date: finalDate
    };
}

// ============================================================================
// TWITTER / X HELPER UTILITIES
// ============================================================================
/**
 * Decodes the exact creation timestamp from a Twitter/X Snowflake ID down to the millisecond.
 * @param {string} tweetId 
 * @returns {Date}
 */
function getTweetTimestamp(tweetId) {
    if (!tweetId) return new Date();
    try {
        const timeMs = Number((BigInt(tweetId) >> 22n) + 1288834974657n);
        const date = new Date(timeMs);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2020 && date.getTime() <= Date.now() + 86400000) {
            return date;
        }
    } catch (e) {}
    return new Date();
}

/**
 * Cleans raw tweet text by stripping leading metadata (e.g. "Pinned", "11h", "Sep 2")
 * and trailing metric counters.
 * @param {string} rawText 
 * @returns {string}
 */
function cleanTweetText(rawText) {
    if (!rawText) return '';
    let text = rawText.replace(/\s+/g, ' ').trim();

    // Strip leading Pinned/Reposted/Retweeted
    text = text.replace(/^(Pinned|Retweeted|Reposted|REPLAY)\s*/i, '');

    // Strip leading time indicators like "11h ", "2m ", "Sep 2 ", "Aug 22, 2026 "
    text = text.replace(/^\d+[smhdwy]\s+/i, '');
    text = text.replace(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(,\s*\d{4})?\s*/i, '');

    // Strip trailing metrics like "15 98 1.3K 31K" or "Show more"
    text = text.replace(/\bShow more\b/gi, '');
    text = text.replace(/\s+\d+(\.\d+)?[KMB]?\s+\d+(\.\d+)?[KMB]?\s+\d+(\.\d+)?[KMB]?\s*$/i, '');
    text = text.replace(/\s+\d+(\.\d+)?[KMB]?\s*$/i, '');

    return text.trim();
}

/**
 * Detects thread markers in a tweet such as:
 * "1/4", "(1/4)", "[1/4]", "1/n", "(1/n)", "1/1", "1/2", "1/3", "1/4", etc.
 * @param {string} text 
 * @returns {{part: number, total: number|null, raw: string}|null}
 */
function extractThreadMarker(text) {
    if (!text) return null;
    const match = text.match(/(?:^|[\s\(\[\{])(\d+)\s*[/／]\s*(\d+|n)(?:[\s\)\]\}.,:]|$)/i);
    if (match) {
        const part = parseInt(match[1], 10);
        const total = match[2].toLowerCase() === 'n' ? null : parseInt(match[2], 10);
        return { part, total, raw: match[0].trim() };
    }
    return null;
}

/**
 * Strips thread numbering markers from tweet text for clean summarization.
 * @param {string} text 
 * @returns {string}
 */
function cleanThreadMarker(text) {
    if (!text) return '';
    return text.replace(/(?:^|[\s\(\[\{])\d+\s*[/／]\s*(?:\d+|n)(?:[\s\)\]\}.,:]|$)/gi, ' ')
               .replace(/\s+/g, ' ')
               .trim();
}

/**
 * Identifies multi-part threaded tweets (e.g. 1/4, 2/4, 3/4, 4/4 or 1/1, 1/2, 1/3, 1/4)
 * posted by the same handle, and stitches them into a single comprehensive news story.
 * Preserves all constituent URLs so they are all marked as processed.
 * @param {Array} tweets 
 * @returns {Array} Array of grouped/stitched tweet stories
 */
function groupTweetsIntoThreads(tweets) {
    if (!tweets || tweets.length === 0) return [];

    // Sort chronologically (oldest first so 1/4 -> 2/4 -> 3/4 -> 4/4)
    const sorted = [...tweets].sort((a, b) => a.date.getTime() - b.date.getTime());

    const result = [];
    const usedIndices = new Set();

    for (let i = 0; i < sorted.length; i++) {
        if (usedIndices.has(i)) continue;

        const current = sorted[i];
        const marker = extractThreadMarker(current.text);

        if (marker) {
            const threadGroup = [current];
            usedIndices.add(i);

            let lastTime = current.date.getTime();
            let lastPart = marker.part;

            for (let j = i + 1; j < sorted.length; j++) {
                if (usedIndices.has(j)) continue;
                const candidate = sorted[j];
                const cMarker = extractThreadMarker(candidate.text);
                const timeDiff = candidate.date.getTime() - lastTime;

                // Belong to same thread if within 45 minutes and has thread marker
                if (timeDiff >= 0 && timeDiff <= 45 * 60 * 1000 && cMarker) {
                    const isSequential = cMarker.part > lastPart || (marker.total && cMarker.total === marker.total);
                    if (isSequential) {
                        threadGroup.push(candidate);
                        usedIndices.add(j);
                        lastTime = candidate.date.getTime();
                        lastPart = cMarker.part;
                    }
                }
            }

            if (threadGroup.length > 1) {
                const allUrls = threadGroup.map(t => t.url);
                const combinedText = threadGroup.map(t => cleanThreadMarker(t.text)).filter(Boolean).join('\n\n');
                
                // Pick best media across the thread (first valid image/video)
                const mediaItem = threadGroup.find(t => t.mediaUrl && t.mediaUrl.startsWith('http'));

                result.push({
                    id: current.id,
                    url: current.url, // Primary URL is part 1
                    allUrls: allUrls, // All URLs in thread to mark as processed
                    text: combinedText,
                    mediaUrl: mediaItem ? mediaItem.mediaUrl : current.mediaUrl,
                    mediaType: mediaItem ? mediaItem.mediaType : current.mediaType,
                    avatarUrl: current.avatarUrl,
                    date: current.date,
                    isThread: true,
                    threadCount: threadGroup.length
                });
                continue;
            }
        }

        // Single tweet
        usedIndices.add(i);
        result.push({
            ...current,
            allUrls: [current.url],
            isThread: false,
            threadCount: 1
        });
    }

    // Return in reverse chronological order (newest first)
    return result.sort((a, b) => b.date.getTime() - a.date.getTime());
}

// ============================================================================
// FIRESTORE DATA SANITIZER (Zero undefined values, preserves FieldValue/Timestamp)
// ============================================================================
function isPlainObject(val) {
    if (val === null || typeof val !== 'object') return false;
    const proto = Object.getPrototypeOf(val);
    return proto === Object.prototype || proto === null;
}

/**
 * Recursively removes undefined fields or replaces with appropriate defaults to prevent Firestore batch errors.
 * Preserves Firestore FieldValue (e.g. serverTimestamp, increment) and Timestamp instances.
 * @param {object} obj 
 * @returns {object}
 */
function sanitizeFirestoreData(obj) {
    if (obj === undefined) return undefined;
    if (obj === null) return null;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeFirestoreData(item)).filter(item => item !== undefined);
    }
    // If it's a special object like FieldValue or Timestamp, do NOT treat as plain object
    if (!isPlainObject(obj)) {
        return obj;
    }

    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) {
            continue; // Skip undefined
        }
        if (value !== null && typeof value === 'object') {
            if (Array.isArray(value)) {
                clean[key] = value.map(item => sanitizeFirestoreData(item)).filter(item => item !== undefined);
            } else if (isPlainObject(value)) {
                const nested = sanitizeFirestoreData(value);
                if (nested !== undefined) {
                    clean[key] = nested;
                }
            } else {
                clean[key] = value;
            }
        } else {
            clean[key] = value;
        }
    }
    return clean;
}

// ============================================================================
// URL NORMALIZATION & TEXT SIMILARITY
// ============================================================================
/**
 * Normalizes an article or social media URL by removing tracking query parameters,
 * hash anchors, and trailing slashes for robust duplicate detection.
 * @param {string} rawUrl 
 * @returns {string}
 */
function normalizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
        const u = new URL(rawUrl.trim());
        const searchParams = new URLSearchParams(u.search);
        const trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'ref', 'source', 'fbclid', 'gclid', 'tkfog2', 'amp', 'origin', 'ncid'
        ];
        trackingParams.forEach(p => searchParams.delete(p));
        u.search = searchParams.toString() ? `?${searchParams.toString()}` : '';
        u.hash = '';
        let clean = u.href;
        if (clean.endsWith('/') && u.pathname !== '/') {
            clean = clean.slice(0, -1);
        }
        return clean;
    } catch (e) {
        return rawUrl.trim();
    }
}

/**
 * Calculates string similarity using Jaccard similarity on Telugu word tokens.
 * Used for headline deduplication across different news sources.
 * @param {string} text1 
 * @param {string} text2 
 * @returns {number} 0.0 to 1.0
 */
function calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    const tokens1 = new Set(text1.toLowerCase().replace(/[^\u0C00-\u0C7F0-9a-zA-Z]/g, ' ').split(/\s+/).filter(w => w.length > 2));
    const tokens2 = new Set(text2.toLowerCase().replace(/[^\u0C00-\u0C7F0-9a-zA-Z]/g, ' ').split(/\s+/).filter(w => w.length > 2));
    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    let intersection = 0;
    for (const t of tokens1) {
        if (tokens2.has(t)) intersection++;
    }
    const union = new Set([...tokens1, ...tokens2]).size;
    return union > 0 ? (intersection / union) : 0;
}

/**
 * Extracts thread marker info like 1/4, (1/4), [1/4], 1/4:, 1/1, 1/2, 1/3, (1/n) from tweet text.
 * @param {string} text 
 * @returns {{part: number, total: number|null, raw: string}|null}
 */
function extractThreadMarker(text) {
    if (!text) return null;
    const match = text.match(/(?:^|[\s\(\[\{])(\d+)\s*[/／]\s*(\d+|n)(?:[\s\)\]\}.,:]|$)/i);
    if (match) {
        const part = parseInt(match[1], 10);
        const total = match[2].toLowerCase() === 'n' ? null : parseInt(match[2], 10);
        return { part, total, raw: match[0].trim() };
    }
    return null;
}

/**
 * Removes thread markers (e.g. 1/4, 2/4, [3/4]) from tweet text for clean news presentation.
 * @param {string} text 
 * @returns {string}
 */
function cleanThreadMarker(text) {
    if (!text) return '';
    return text.replace(/(?:^|[\s\(\[\{])\d+\s*[/／]\s*(?:\d+|n)(?:[\s\)\]\}.,:]|$)/gi, ' ')
               .replace(/\s+/g, ' ')
               .trim();
}

/**
 * Groups multi-part tweets (e.g. 1/4, 2/4, 3/4, 4/4 or 1/1, 1/2, 1/3, 1/4) from the same author
 * posted within 45 minutes into a single unified news story.
 * Gathers all URLs into `allUrls` so all constituent tweets get marked as processed.
 * @param {Array<Object>} tweets 
 * @returns {Array<Object>}
 */
function groupTweetsIntoThreads(tweets) {
    if (!tweets || tweets.length === 0) return [];

    // Sort chronologically (oldest first: 1/4 -> 2/4 -> 3/4 -> 4/4)
    const sorted = [...tweets].sort((a, b) => a.date.getTime() - b.date.getTime());

    const result = [];
    const usedIndices = new Set();

    for (let i = 0; i < sorted.length; i++) {
        if (usedIndices.has(i)) continue;

        const current = sorted[i];
        const marker = extractThreadMarker(current.text);

        if (marker) {
            const threadGroup = [current];
            usedIndices.add(i);

            let lastTime = current.date.getTime();
            let lastPart = marker.part;

            for (let j = i + 1; j < sorted.length; j++) {
                if (usedIndices.has(j)) continue;
                const candidate = sorted[j];
                const cMarker = extractThreadMarker(candidate.text);
                const timeDiff = candidate.date.getTime() - lastTime;

                // Belong to same thread if:
                // 1. Candidate is within 45 minutes of previous part
                // 2. Candidate has a thread marker
                // 3. Candidate part number is greater (or next in sequence) OR same total
                if (timeDiff >= 0 && timeDiff <= 45 * 60 * 1000 && cMarker) {
                    const isSequential = cMarker.part > lastPart || (marker.total && cMarker.total === marker.total);
                    if (isSequential) {
                        threadGroup.push(candidate);
                        usedIndices.add(j);
                        lastTime = candidate.date.getTime();
                        lastPart = cMarker.part;
                    }
                }
            }

            if (threadGroup.length > 1) {
                // Multi-part thread detected! Combine all parts into single story
                const allUrls = threadGroup.map(t => t.url);
                const combinedText = threadGroup.map(t => cleanThreadMarker(t.text)).filter(Boolean).join('\n\n');
                
                // Pick best media across the thread (first image or video)
                const mediaItem = threadGroup.find(t => t.mediaUrl && t.mediaUrl.startsWith('http'));

                result.push({
                    id: current.id,
                    url: current.url, // Primary URL is part 1
                    allUrls: allUrls, // All constituent URLs to mark as processed
                    text: combinedText,
                    mediaUrl: mediaItem ? mediaItem.mediaUrl : current.mediaUrl,
                    mediaType: mediaItem ? mediaItem.mediaType : current.mediaType,
                    avatarUrl: current.avatarUrl,
                    date: current.date,
                    isThread: true,
                    threadCount: threadGroup.length
                });
                continue;
            }
        }

        // Single stand-alone tweet
        usedIndices.add(i);
        result.push({
            ...current,
            allUrls: [current.url],
            isThread: false,
            threadCount: 1
        });
    }

    // Return in reverse chronological order (newest first)
    return result.sort((a, b) => b.date.getTime() - a.date.getTime());
}

module.exports = {
    parseArticleDate,
    isGenericImage,
    isArticleLink,
    extractArticleLinks,
    extractArticleData,
    sanitizeFirestoreData,
    getTweetTimestamp,
    cleanTweetText,
    normalizeUrl,
    calculateTextSimilarity,
    extractThreadMarker,
    cleanThreadMarker,
    groupTweetsIntoThreads
};
