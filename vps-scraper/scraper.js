require('dotenv').config();
const admin = require('firebase-admin');
const cron = require('node-cron');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const axios = require('axios');

puppeteerExtra.use(StealthPlugin());
const rssParser = new Parser({
    timeout: 15000 // 15 seconds timeout to prevent hanging
});

// Catch unhandled rejections and exceptions so the process doesn't crash silently
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize Firebase Admin SDK
// Make sure to download your service account key and save it as firebase-service-account.json
try {
    const serviceAccount = require('./firebase-service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: "alfa-news-31bf7.firebasestorage.app" // Updated to the newer default format
    });
    console.log("Firebase Admin Initialized Successfully.");
} catch (error) {
    console.error("Failed to initialize Firebase Admin. Please ensure firebase-service-account.json exists.", error);
    process.exit(1);
}

const db = admin.firestore();

// ============================================================================
// IN-MEMORY CACHE FOR FIRESTORE READ OPTIMIZATION
// ============================================================================
const scannedUrlMemoryCache = new Set();
const storyFingerprintMemoryCache = new Set();
let isCachePrewarmed = false;

async function prewarmScraperCache() {
    if (isCachePrewarmed) return;
    try {
        console.log("Pre-warming in-memory URL & fingerprint caches to save Firestore reads...");
        // 1. Load recent scanned URLs (up to 3000)
        const recentUrlsSnap = await db.collection('scanned_urls')
            .orderBy('scannedAt', 'desc')
            .limit(3000)
            .get();
        recentUrlsSnap.forEach(doc => {
            const data = doc.data();
            if (data.url) scannedUrlMemoryCache.add(data.url);
        });

        // 2. Load recent story fingerprints (last 48 hours)
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const recentNewsSnap = await db.collection('news')
            .where('timestamp', '>', twoDaysAgo)
            .limit(1000)
            .get();
        recentNewsSnap.forEach(doc => {
            const data = doc.data();
            if (data.sourceUrl) scannedUrlMemoryCache.add(data.sourceUrl);
            if (data.storyFingerprint) storyFingerprintMemoryCache.add(data.storyFingerprint);
        });

        isCachePrewarmed = true;
        console.log(`Cache pre-warmed: ${scannedUrlMemoryCache.size} URLs, ${storyFingerprintMemoryCache.size} fingerprints in memory.`);
    } catch (e) {
        console.warn("Failed to prewarm cache (will continue without prewarm):", e.message);
    }
}

// ============================================================================
// GEMINI API RATE LIMITING & KEY ROTATION SETUP
// ============================================================================
const geminiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
    process.env.GEMINI_API_KEY_7,
    process.env.GEMINI_API_KEY_8,
    process.env.GEMINI_API_KEY_9,
    process.env.GEMINI_API_KEY_10
].filter(k => k && k.trim() !== '');

if (geminiKeys.length === 0) {
    console.error("CRITICAL: No Gemini API keys found. Please add GEMINI_API_KEY_1, etc. in .env");
}

let currentGeminiKeyIndex = 0;
let requestCountForCurrentKey = 0;
const MAX_REQUESTS_PER_KEY_PER_DAY = 1500;
let lastGeminiRequestTime = 0;
// Limit to 14 requests per minute: (60 seconds / 14) * 1000 = ~4285ms.
// Round up to 4500ms to be safe (approx 13.3 requests per minute).
const MIN_DELAY_BETWEEN_GEMINI_REQUESTS = 4500; 

// ============================================================================
// MEDIA STORAGE UTILS
// ============================================================================
async function uploadMediaToStorage(url, folder = 'news-media') {
    if (!url || !url.startsWith('http')) return null;
    try {
        const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 15000, // 15 seconds timeout to prevent hanging
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Referer': url
            }
        });
        const buffer = Buffer.from(response.data, 'binary');
        const contentType = response.headers['content-type'] || 'image/jpeg';
        const extension = contentType.split('/')[1] || 'jpg';
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
        const file = admin.storage().bucket().file(fileName);

        const savePromise = file.save(buffer, {
            metadata: { contentType },
            public: true
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase Storage Upload Timeout')), 30000));
        await Promise.race([savePromise, timeoutPromise]);

        // Construct the public URL (Firebase Storage format)
        return `https://firebasestorage.googleapis.com/v0/b/${admin.storage().bucket().name}/o/${encodeURIComponent(fileName)}?alt=media`;
    } catch (error) {
        console.error(`Failed to upload media to storage: ${error.message}`);
        return null;
    }
}

// ============================================================================
// PUPPETEER OPTIMIZATION (Memory & Speed)
// ============================================================================
const reporters = [
    { id: 'rep1', name: 'శ్రీనివాస్' },
    { id: 'rep2', name: 'రమేష్' },
    { id: 'rep3', name: 'వెంకట్' },
    { id: 'rep4', name: 'సురేష్' },
    { id: 'rep5', name: 'కృష్ణ' },
    { id: 'rep6', name: 'రాము' },
    { id: 'rep7', name: 'శివ' },
    { id: 'rep8', name: 'ప్రసాద్' },
    { id: 'rep9', name: 'మహేష్' },
    { id: 'rep10', name: 'అశోక్' },
    { id: 'rep11', name: 'కిరణ్' },
    { id: 'rep12', name: 'రాజేష్' },
    { id: 'rep13', name: 'సునీల్' },
    { id: 'rep14', name: 'ప్రవీణ్' },
    { id: 'rep15', name: 'సతీష్' },
    { id: 'rep16', name: 'నరేష్' },
    { id: 'rep17', name: 'భాస్కర్' },
    { id: 'rep18', name: 'గోపి' },
    { id: 'rep19', name: 'హరి' },
    { id: 'rep20', name: 'విజయ్' }
];

function getRandomReporter() {
    return reporters[Math.floor(Math.random() * reporters.length)];
}

async function fetchHtmlOptimized(url) {
    let browser = null;
    try {
        // First try simple fetch (fastest, lowest memory)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            return await response.text();
        }
    } catch (e) {
        console.log(`Fetch failed for ${url}, falling back to Puppeteer...`);
    }

    // Fallback to Puppeteer with extreme memory optimization
    const hardTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Puppeteer Hard Timeout')), 45000));
    
    const runPuppeteer = async () => {
        try {
            browser = await puppeteerExtra.launch({
                headless: 'new',
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage', 
                    '--disable-gpu', 
                    '--no-zygote', 
                    '--disable-extensions'
                ],
                timeout: 30000 // 30 seconds timeout for browser launch
            });

            const page = await browser.newPage();
            
            // Block images, CSS, fonts, and media to save RAM and bandwidth
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                if (['image', 'stylesheet', 'font', 'media', 'other'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            
            // Add a strict timeout to page.goto to prevent hanging
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            const html = await page.content();
            return html;
        } finally {
            if (browser) {
                try {
                    const browserProcess = browser.process();
                    await browser.close();
                    if (browserProcess) browserProcess.kill('SIGKILL');
                } catch (e) {
                    console.error("Error closing browser:", e.message);
                }
            }
        }
    };

    try {
        return await Promise.race([runPuppeteer(), hardTimeout]);
    } catch (err) {
        console.error(`Puppeteer failed for ${url}:`, err.message);
        if (browser) {
            try {
                const browserProcess = browser.process();
                await browser.close();
                if (browserProcess) browserProcess.kill('SIGKILL');
            } catch (e) {}
        }
        return null;
    }
}

// ============================================================================
// GEMINI AI PROCESSING
// ============================================================================
async function processWithGemini(text, prompt, imageUrl = null, retries = 5) {
    if (geminiKeys.length === 0) {
        console.error("No Gemini API keys configured. Cannot process.");
        return null;
    }

    // టోకెన్లు ఆదా చేయడానికి టెక్స్ట్ ని 2000 క్యారెక్టర్లకు ట్రిమ్ చేస్తున్నాను
    const truncatedText = text ? text.substring(0, 2000) : "";
    if (truncatedText.length < 100) return null; // చాలా చిన్న టెక్స్ట్ అయితే AI కి పంపవద్దు

    let imagePart = null;
    if (imageUrl && !isGenericImage(imageUrl)) {
        try {
            const imgRes = await axios.get(imageUrl, { 
                responseType: 'arraybuffer', 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Referer': 'https://www.google.com/'
                }
            });
            let mimeType = imgRes.headers['content-type'] || 'image/jpeg';
            if (mimeType.includes('image/webp')) mimeType = 'image/webp';
            else if (mimeType.includes('image/png')) mimeType = 'image/png';
            else mimeType = 'image/jpeg';
            
            imagePart = { 
                inlineData: { 
                    mimeType: mimeType, 
                    data: Buffer.from(imgRes.data, 'binary').toString('base64') 
                } 
            };
        } catch (e) {
            console.log(`[GEMINI] Failed to fetch image for AI check (${imageUrl}): ${e.message}`);
        }
    }

    for (let i = 0; i < retries; i++) {
        try {
            if (requestCountForCurrentKey >= MAX_REQUESTS_PER_KEY_PER_DAY) {
                console.log(`[GEMINI] Key ${currentGeminiKeyIndex + 1} reached limit of ${MAX_REQUESTS_PER_KEY_PER_DAY}. Rotating to next key.`);
                currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % geminiKeys.length;
                requestCountForCurrentKey = 0;
            }

            // Enforce minimum delay to stay strictly under 14 RPM globally
            const now = Date.now();
            const timeSinceLast = now - lastGeminiRequestTime;
            if (timeSinceLast < MIN_DELAY_BETWEEN_GEMINI_REQUESTS) {
                const sleepTime = MIN_DELAY_BETWEEN_GEMINI_REQUESTS - timeSinceLast;
                await new Promise(r => setTimeout(r, sleepTime));
            }
            lastGeminiRequestTime = Date.now();
            requestCountForCurrentKey++;

            const currentKey = geminiKeys[currentGeminiKeyIndex];
            
            // Using v1beta API with gemini-3.5-flash-lite for vision and content generation
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${currentKey}`;
            
            const parts = [{ text: `${prompt}\n\nText:\n${truncatedText}` }];
            if (imagePart) parts.push(imagePart);

            const payload = {
                contents: [{ parts }],
                generationConfig: {
                    temperature: 0.3
                }
            };

            const response = await axios.post(url, payload, { timeout: 60000 });

            
            if (response.data && response.data.candidates && response.data.candidates.length > 0) {
                return response.data.candidates[0].content.parts[0].text.trim();
            }
            return null;
        } catch (error) {
            const errorMsg = (error.response?.data?.error?.message || error.message || "").toUpperCase();
            
            // Auto rotate on quota exhaustion or explicit 429
            if (errorMsg.includes('QUOTA') || errorMsg.includes('RESOURCE_EXHAUSTED') || (error.response && error.response.status === 429)) {
                console.log(`[GEMINI] Key ${currentGeminiKeyIndex + 1} hit quota or rate limit. Rotating immediately.`);
                currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % geminiKeys.length;
                requestCountForCurrentKey = 0;
            }

            const isRetryable = errorMsg.includes('503') || 
                               errorMsg.includes('OVERLOADED') || 
                               errorMsg.includes('HIGH DEMAND') || 
                               errorMsg.includes('UNAVAILABLE') || 
                               errorMsg.includes('429') || 
                               errorMsg.includes('QUOTA') ||
                               errorMsg.includes('RESOURCE_EXHAUSTED') ||
                               errorMsg.includes('TIMEOUT') ||
                               errorMsg.includes('ECONNRESET');

            if (isRetryable) {
                const delay = Math.pow(2, i) * 6000 + (Math.random() * 3000); 
                console.log(`[GEMINI] Busy/Rate limited (${errorMsg.substring(0, 50)}), retry ${i + 1}/${retries} after ${Math.round(delay/1000)}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            console.error("Gemini API Critical Error:", errorMsg);
            return null;
        }
    }
    return null;
}

// ============================================================================
// UTILS: Image & Date Filtering
// ============================================================================
function isGenericImage(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') return true;
    const lowerUrl = url.toLowerCase().trim();
    
    // Default Alfa News placeholder logo
    if (lowerUrl.includes('alfa-news') || lowerUrl.includes('bg.png') || lowerUrl.includes('70bb37fd-c13d-4f97-84e1-11fb6c0d1061')) {
        return true;
    }

    // Common generic logo & placeholder terms across Telugu / National Media
    const genericPatterns = [
        'logo', 'default', 'placeholder', 'banner', 'icon', 'avatar', 
        'generic', 'fallback', 'no-image', 'noimage', 'loading', 'blank',
        'masthead', 'emblem', 'brand', 'watermark', 'sitelogo', 'site_logo',
        'site-logo', 'app_logo', 'app-logo', 'nav_logo', 'header_logo', 
        'footer_logo', 'favicon', 'dummy', 'share_image', 'og_default', 
        'fb_share', 'twitter_share', 'social_share', 'site_header', 'site_banner',
        'header_sun', 'eenadu_sun', 'eenadu_header', 'eenadu_red', 'eenadu_main',
        'eenadu_share', 'eenadu_site', 'eenadustorage', 'cloudfront.net/images',
        'd2308c07823.cloudfront.net', 'img.eenadu.net/includes',
        'toi_logo', 'toi-logo', 'timesofindia', 'toi_share', 'toi_default', 
        'toi_header', 'times_of_india', 'toi_logo_default', 'static.toiimg.com/photo/108381831',
        'sakshi_logo', 'sakshi-logo', 'sakshiling', 'sakshi_header', 'sakshi_share',
        'andhrajyothy', 'andhrajajyothy', 'jyothy_logo', 'aj_logo', 
        'ntnews_logo', 'namasthetelangana', 'tv9_logo', 'v6_logo', 't_news_logo', 
        'abp_logo', 'thehindu_logo', 'indianexpress_logo'
    ];
    
    // Check for common logo patterns
    if (genericPatterns.some(pattern => lowerUrl.includes(pattern))) {
        return true;
    }

    // Specifically target Eenadu's logo and header patterns:
    if (lowerUrl.includes('eenadu.net') || lowerUrl.includes('cloudfront.net') || lowerUrl.includes('eenadu')) {
        const isActualArticleImage = lowerUrl.includes('/districts/') || 
                                     lowerUrl.includes('/uploads/') || 
                                     lowerUrl.includes('/photos/') || 
                                     lowerUrl.includes('/stories/') || 
                                     lowerUrl.includes('/news/') || 
                                     lowerUrl.includes('_1.jpg') || 
                                     lowerUrl.includes('_1.jpeg') || 
                                     lowerUrl.includes('_1.png') || 
                                     lowerUrl.includes('_1.webp') ||
                                     /\d{8,}_\d+/.test(lowerUrl);
        if (!isActualArticleImage) {
            return true;
        }
    }

    // Specifically target Times of India (TOI) default photo IDs:
    if (lowerUrl.includes('toiimg.com') || lowerUrl.includes('timesofindia')) {
        if (lowerUrl.includes('108381831') || lowerUrl.includes('4752938') || lowerUrl.includes('photo/50')) {
            const isToiArticleImage = lowerUrl.includes('/thumb/msid-') && !lowerUrl.includes('108381831') && !lowerUrl.includes('4752938');
            if (!isToiArticleImage) {
                return true;
            }
        }
    }

    // File extensions that are typically non-photographic graphics
    if (lowerUrl.endsWith('.svg') || lowerUrl.endsWith('.gif')) {
        return true;
    }

    return false;
}

function extractArticleDate($) {
    // Common meta tags for publication date
    const selectors = [
        'meta[property="article:published_time"]',
        'meta[property="og:published_time"]',
        'meta[name="pubdate"]',
        'meta[name="publish-date"]',
        'meta[name="dc.date"]',
        'meta[name="dc.date.issued"]',
        'meta[name="date"]',
        'meta[property="og:updated_time"]',
        'meta[itemprop="datePublished"]',
        'meta[name="parsely-pub-date"]'
    ];

    for (const selector of selectors) {
        const content = $(selector).attr('content');
        if (content) {
            const date = new Date(content);
            if (!isNaN(date.getTime())) return date;
        }
    }

    // JSON-LD backup
    const ldJson = $('script[type="application/ld+json"]');
    if (ldJson.length > 0) {
        for (let i = 0; i < ldJson.length; i++) {
            try {
                const data = JSON.parse($(ldJson[i]).html());
                const dateStr = data.datePublished || data.uploadDate || data.dateCreated;
                if (dateStr) {
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) return date;
                }
            } catch (e) {}
        }
    }

    return null;
}

async function markUrlAsProcessed(url) {
    if (!url) return;
    scannedUrlMemoryCache.add(url);
    try {
        await db.collection('scanned_urls').doc(Buffer.from(url).toString('base64').substring(0, 50)).set({
            url: url,
            scannedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        // Reduced logging noise for processed URLs
    }
}

async function isUrlAlreadyScanned(urls) {
    if (!urls || urls.length === 0) return new Set();
    const seen = new Set();
    const urlsToQuery = [];

    // 1. 🚀 Check in-memory cache first (Zero Firestore Reads!)
    for (const u of urls) {
        if (scannedUrlMemoryCache.has(u)) {
            seen.add(u);
        } else {
            urlsToQuery.push(u);
        }
    }

    if (urlsToQuery.length === 0) {
        return seen; // All found in memory cache!
    }

    // 2. Query Firestore only for URLs not found in memory cache
    // Check news collection
    for (let i = 0; i < urlsToQuery.length; i += 10) {
        const batch = urlsToQuery.slice(i, i + 10);
        try {
            const snapshot = await db.collection('news').where('sourceUrl', 'in', batch).get();
            snapshot.forEach(doc => {
                const sUrl = doc.data().sourceUrl;
                if (sUrl) {
                    seen.add(sUrl);
                    scannedUrlMemoryCache.add(sUrl);
                }
            });
        } catch (e) {
            console.error("Error querying news for sourceUrl batch:", e.message);
        }
    }
    
    // Check scanned_urls collection
    for (let i = 0; i < urlsToQuery.length; i += 10) {
        const batch = urlsToQuery.slice(i, i + 10);
        try {
            const snapshot = await db.collection('scanned_urls').where('url', 'in', batch).get();
            snapshot.forEach(doc => {
                const sUrl = doc.data().url;
                if (sUrl) {
                    seen.add(sUrl);
                    scannedUrlMemoryCache.add(sUrl);
                }
            });
        } catch (e) {
            console.error("Error querying scanned_urls for url batch:", e.message);
        }
    }
    
    return seen;
}

// ============================================================================
// SCRAPING LOGIC: WEB SOURCES (Sakshi, Eenadu, etc.)
// ============================================================================
// TODO: Replace with the actual URL of the Alfa News logo
const ALFA_NEWS_LOGO = "https://firebasestorage.googleapis.com/v0/b/alfa-news-31bf7.firebasestorage.app/o/news-media%2Fbg.png?alt=media&token=70bb37fd-c13d-4f97-84e1-11fb6c0d1061";

async function processSingleWebSource(doc) {
    const source = doc.data();
    // console.log(`Processing Web Source: ${source.siteName}`);
        
        try {
            const html = await fetchHtmlOptimized(source.url);
            if (!html) return;

            const $ = cheerio.load(html);
            const links = [];
            
            // Extract keyword from source URL (e.g., 'karimnagar' from 'https://www.ntnews.com/karimnagar')
            const sourceUrlObj = new URL(source.url);
            const pathSegments = sourceUrlObj.pathname.split('/').filter(Boolean);
            const keyword = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1].toLowerCase() : '';

            $('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href && href.length > 15) {
                    const absoluteUrl = href.startsWith('http') ? href : new URL(href, source.url).href;
                    
                    let absoluteUrlObj;
                    try {
                        absoluteUrlObj = new URL(absoluteUrl);
                    } catch (e) {
                        return; // Ignore invalid URLs
                    }

                    // Must belong to the same domain
                    if (absoluteUrlObj.hostname.endsWith(sourceUrlObj.hostname.replace('www.', ''))) {
                        // Must contain the keyword if present in source URL
                        if (!keyword || absoluteUrl.toLowerCase().includes(keyword)) {
                            // Must not be the exact source URL
                            if (absoluteUrl !== source.url && absoluteUrl !== source.url + '/') {
                                links.push(absoluteUrl);
                            }
                        }
                    }
                }
            });

            const uniqueLinks = [...new Set(links)];
            
            // Domain blacklist for low-value content
            const blacklist = ['massimo.love', 'advice.com', 'tips.com'];
            
            // Batch check URLs to reduce Reads and ensure we only process new links
            const filteredLinks = uniqueLinks.filter(link => !blacklist.some(domain => link.includes(domain)));
            const existingUrls = await isUrlAlreadyScanned(filteredLinks);
            
            const newLinks = filteredLinks.filter(link => !existingUrls.has(link));
            
            console.log(`[WEB] Found ${uniqueLinks.length} total valid links for ${source.siteName} (${newLinks.length} new)`);

            const linksToProcess = newLinks.slice(0, 15);
            const batch = db.batch();
            let batchCount = 0;
            const threshold = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
            
            for (const link of linksToProcess) {
                if (batchCount >= 5) break;

                // console.log(`Scraping article: ${link}`);
                
                // Add a timeout to the entire article processing to prevent hanging on one bad link
                const articlePromise = async () => {
                    const articleHtml = await fetchHtmlOptimized(link);
                    if (!articleHtml) {
                        await markUrlAsProcessed(link);
                        return;
                    }

                    const $article = cheerio.load(articleHtml);

                    // --- TIME FILTERING ---
                    const articleDate = extractArticleDate($article);
                    if (articleDate && articleDate.getTime() < threshold) {
                        console.log(`[WEB] Skipping stale article (${articleDate.toISOString()}): ${link}`);
                        await markUrlAsProcessed(link);
                        return;
                    }
                    
                    // 1. Strip noise FIRST to avoid picking up images from sidebars, headers, footers, logos
                    $article('nav, header, footer, script, style, .ads, .sidebar, .comments, aside, #sidebar, .related, .trending, .popular, .latest-news, .logo, .site-logo, .brand, .header-logo').remove();

                    let candidateImage = null;

                    // 2. Extract potential main image from meta tags
                    const metaImg = $article('meta[property="og:image"]').attr('content') || 
                                   $article('meta[name="twitter:image"]').attr('content') ||
                                   $article('link[rel="image_src"]').attr('href') ||
                                   $article('article img').attr('src');
                    
                    if (metaImg && !isGenericImage(metaImg)) {
                        candidateImage = metaImg;
                    }

                    if (!candidateImage) {
                        // Try to find the first real news photo in the CLEANED article body
                        $article('img').each((i, img) => {
                            const src = $article(img).attr('src');
                            const dataSrc = $article(img).attr('data-src') || $article(img).attr('data-lazy-src') || $article(img).attr('data-original');
                            const actualSrc = dataSrc || src;
                            
                            const width = parseInt($article(img).attr('width') || '0');
                            const height = parseInt($article(img).attr('height') || '0');

                            if (actualSrc && actualSrc.startsWith('http') && !isGenericImage(actualSrc)) {
                                if ((width > 200 && height > 150) || !candidateImage) {
                                    candidateImage = actualSrc;
                                    if (width > 500) return false; // Found main image
                                }
                            }
                        });
                    }

                    // Final safety filter
                    if (candidateImage && isGenericImage(candidateImage)) {
                        candidateImage = null;
                    }

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
                    
                    $article(selectors.join(', ')).each((i, el) => {
                        const txt = $article(el).text().trim();
                        if (txt.length > 30) bodyText += txt + ' ';
                    });

                    if (bodyText.length < 200) {
                        let pCount = 0;
                        $article('main p, #main p, .main p, article p, [role="main"] p').each((i, el) => {
                            if (pCount >= 5) return;
                            const txt = $article(el).text().trim();
                            if (txt.length > 60 && !txt.includes('Copyright') && !txt.includes('All rights reserved') && !txt.includes('Read Also')) {
                                bodyText += txt + ' ';
                                pCount++;
                            }
                        });
                    }

                    const articleText = bodyText.replace(/\s+/g, ' ').trim().substring(0, 4000);

                    if (articleText.length < 200) return;

                    const prompt = `You are a Senior Journalist.
                    1. Evaluate if this news article is a valid news update. 
                       - REJECT articles that are generic blog posts, general advice, "how-to" guides, or relationship/psychological tips.
                       - REJECT "evergreen" content that is not tied to a specific, timely event (something that happened today or yesterday).
                       - REJECT announcements that "research was done" or "experts say" without stating a SPECIFIC, NEW, and TIMELY finding.
                       - EXCEPTION: Greetings or celebratory posts for major political party formation days (e.g., TDP Formation Day), national holidays, or major public events ARE considered news and should be accepted.
                       - If it is research/study, you MUST include the actual results/findings in the summary. If no specific findings are present, set isRelevant to false.
                    2. Constraints: వచ్చిన కంటెంట్ లోని వ్యక్తులు, ప్రాంతం మిస్ అవ్వకుండా, వార్త యొక్క భావం మారకుండా, ఒక సీనియర్ న్యూస్ ఎడిటర్ మాదిరిగా ఒకే పేరాగ్రాఫ్ లో వార్త రాయాలి. Content must be approximately 60 words in Telugu.
                       CRITICAL TONE & PUNCH LOGIC (పంచ్ డైలాగ్స్ రూల్): వచ్చిన వార్త కంటెంట్ లో ఉన్న సంచలన వ్యాఖ్యలు, రాజకీయ విమర్శలు, నాయకులు వాడిన బలమైన లేదా ఘాటైన పంచ్ డైలాగులు (punchy political criticisms, emotional/sensational dialogues, and strong statements) ఎట్టి పరిస్థితుల్లోనూ వదిలిపెట్టవద్దు. వార్తను సాదాసీదాగా లేదా చప్పగా మార్చవద్దు! ఆ సంచలన పంచ్ డైలాగులను/వ్యాఖ్యలను వార్త సారాంశం (Telugu content summary) మరియు హెడ్లైన్ (headline) లలో చాలా స్పష్టంగా, ఉత్తేజకరంగా మరియు ఆకర్షణీయంగా ఉండేలా యథాతథంగా లేదా మరింత పదునుగా హైలైట్ చేయాలి. చదువరులను ఆకట్టుకునేలా వార్త ఘాటుగా ఉండాలి కానీ చప్పగా ఉండకూడదు.
                    CRITICAL: Write as if YOU are the reporter breaking the news. State the facts directly.
                    3. Headline must be a PUNCHY single sentence around 6-10 words in Telugu.
                    4. Identify the primary location of the news. 
                       - If it's a district in Telangana or Andhra Pradesh, use the district name in Telugu from this list: [ఆదిలాబాద్, భద్రాద్రి కొత్తగూడెం, హన్మకొండ, హైదరాబాద్, జగిత్యాల, జనగాం, జయశంకర్ భూపాలపల్లి, జోగులాంబ గద్వాల, కామారెడ్డి, కరీంనగర్, ఖమ్మం, కుమ్రం భీమ్ ఆసిఫాబాద్, మహబూబాబాద్, మహబూబ్ నగర్, మంచిర్యాల, మెదక్, మేడ్చల్ మల్కాజిగిరి, ములుగు, నాగర్ కర్నూల్, నల్గొండ, నారాయణపేట, నిర్మల్, నిజామాబాద్, పెద్దపల్లి, రాజన్న సిరిసిల్ల, రంగారెడ్డి, సంగారెడ్డి, సిద్దిపేట, సూర్యాపేట, వికారాబాద్, వనపర్తి, వరంగల్, యాదాద్రి భువనగిరి, అల్లూరి సీతారామరాజు, అనకాపల్లి, అనంతపురం, అన్నమయ్య, బాపట్ల, చిత్తూరు, కోనసీమ, తూర్పు గోదావరి, ఏలూరు, గుంటూరు, కాకినాడ, కృష్ణా, కర్నూలు, నందయాల, ఎన్టీఆర్, పల్నాడు, పార్వతీపురం మన్యం, ప్రకాశం, శ్రీ పొట్టి శ్రీరాములు నెల్లూరు, శ్రీ సత్యసాయి, శ్రీకాకుళం, తిరుపతి, విశాఖపట్నం, విజయనగరం, పశ్చిమ గోదావరి, వైఎస్ఆర్ కడప].
                       - If it's state-wide news, use the state name (Andhra Pradesh or Telangana).
                       - If it's National news (India), use 'India'.
                       - If it's International news, use the specific country name or 'World'.
                       - Use 'General' only for generic topics (e.g., health tips, advice) that don't belong to any geography.
                    5. Create a unique storyFingerprint based on the core fact. 
                       - It must be EXACTLY 3-4 words joined by hyphens.
                       - Focus ONLY on the 'Who' and 'What happened' (e.g., "modi-visit-bhutan", "accident-hyderabad-road").
                       - The fingerprint MUST be the same for any article covering the same event, regardless of wording.
                       - Use standard English names for people and places in the fingerprint (e.g., "revanth-reddy" not "cm-revanth").
                       - Avoid generic words like "news", "update", "report", "research", "expert", "analysis", "study", "tips".
                       - This is used for deduplication, so be extremely consistent and deterministic.
                    6. Classification & Tagging:
                       - refinedCategory: Classify into EXACTLY ONE of: Politics, Crime, Sports, Cinema, Business, Health, Education, Technology, Agriculture, Local, National, International.
                         * Use 'International' for news outside India (e.g., Iran War, USA Elections).
                         * Use 'National' for major news across India (e.g., Central Govt decisions, National sports).
                         * Use 'Local' for news specific to a district or town.
                         * Use 'Sports', 'Cinema', etc., ONLY if it's the primary focus.
                       - tags: Extract 3-5 relevant keywords in Telugu.
                       - entities: Identify People (వ్యక్తులు), Organizations (సంస్థలు), and Locations (ప్రాంతాలు) mentioned in the news.
                    7. Media Verification & Rejection Rules:
                       I have attached the candidate image (if available) or provided the URL: ${candidateImage || 'None'}.
                       - CRITICAL TASK: Visually inspect the attached image (or URL) to determine if it is a real news photo.
                       - REJECT AS LOGO/GENERIC (Set mediaUrl to "") IF:
                         1. The image is a newspaper, TV channel, or news website logo (e.g., "ఈనాడు", "Eenadu" red sun logo, "Times of India" / "TOI" logo, "Sakshi" logo, "NT News", "Andhra Jyothy", "TV9", "V6", "ABP").
                         2. The image is a generic brand emblem, header banner, channel icon, watermark graphic, or default site placeholder.
                         3. The image does NOT depict actual people, places, or events directly related to the news article.
                       - IF IT IS A LOGO, BRAND GRAPHIC, HEADER, OR DEFAULT PLACEHOLDER, YOU MUST SET mediaUrl TO "".
                       - ONLY set mediaUrl to "${candidateImage || ''}" IF it is an authentic, real news photo of the event or topic.
                       - If no valid candidate image was attached or provided, set mediaUrl to "".
                    8. Output JSON only. Format as JSON: {"isRelevant": true, "headline": "Telugu Title", "content": "Telugu Summary", "headlineEn": "English Title", "contentEn": "English Summary", "location": "Location", "storyFingerprint": "finger-print-here", "refinedCategory": "Category", "tags": ["tag1", "tag2"], "entities": {"people": [], "organizations": [], "locations": []}, "mediaUrl": "image-url-here", "mediaType": "image|video", "isWide": true|false}`;
                    const aiResult = await processWithGemini(articleText, prompt, candidateImage);
                    
                    if (aiResult) {
                        try {
                            const parsed = JSON.parse(aiResult.replace(/```json|```/g, '').trim());
                            if (!parsed.isRelevant) {
                                return;
                            }
                            if (parsed.isRelevant && parsed.headline && parsed.content) {
                                // console.log(`[GEMINI] Generated Fingerprint: ${parsed.storyFingerprint}`);
                                // Deduplication check using storyFingerprint
                                if (parsed.storyFingerprint) {
                                    if (storyFingerprintMemoryCache.has(parsed.storyFingerprint)) {
                                        console.log(`Skipping duplicate story (memory cache hit): ${parsed.storyFingerprint}`);
                                        return;
                                    }
                                    const duplicate = await db.collection('news')
                                        .where('storyFingerprint', '==', parsed.storyFingerprint)
                                        .where('timestamp', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
                                        .limit(1)
                                        .get();
                                    
                                    if (!duplicate.empty) {
                                        storyFingerprintMemoryCache.add(parsed.storyFingerprint);
                                        console.log(`Skipping duplicate story: ${parsed.storyFingerprint}`);
                                        return;
                                    }
                                    storyFingerprintMemoryCache.add(parsed.storyFingerprint);
                                }

                                const reporter = getRandomReporter();
                                
                                // Map Telugu categories from UI to English IDs if AI fallback fails
                                const categoryMap = {
                                    'రాజకీయం': 'Politics',
                                    'క్రీడలు': 'Sports',
                                    'వినోదం': 'Cinema',
                                    'సినిమా': 'Cinema',
                                    'ఆరోగ్యం': 'Health',
                                    'వ్యాపారం': 'Business',
                                    'టెక్నాలజీ': 'Technology',
                                    'విద్య/ఉద్యోగాలు': 'Education',
                                    'వ్యవసాయం': 'Agriculture',
                                    'క్రైమ్': 'Crime',
                                    'జాతీయం': 'National',
                                    'అంతర్జాతీయం': 'International',
                                    'తెలంగాణ': 'Telangana',
                                    'ఆంధ్ర ప్రదేశ్': 'AndhraPradesh',
                                    'భక్తి': 'Devotional',
                                    'లైఫ్ స్టైల్': 'Lifestyle'
                                };

                                let category = parsed.refinedCategory;
                                if (!category || category === 'Local') {
                                    category = categoryMap[source.category] || source.category || 'Local';
                                }

                                // Determine finalDistrict for filtering
                                let finalDistrict = "General";
                                const globalCategories = ["Sports", "Health", "Technology", "Business", "Cinema", "National", "International", "Politics", "Crime", "Education", "Agriculture", "Devotional", "Lifestyle", "AndhraPradesh", "Telangana"];
                                
                                if (globalCategories.includes(category)) {
                                    finalDistrict = category;
                                } else if (source.district) {
                                    finalDistrict = source.district;
                                }
                                
                                const categoriesList = [source.siteName, category];
                                if (finalDistrict !== "General" && !globalCategories.includes(finalDistrict)) {
                                    categoriesList.push("Local");
                                    categoriesList.push(finalDistrict);
                                }
                                
                                const docRef = db.collection('news').doc();
                                
                                // Default to Alfa News Logo if no image found
                                let finalMediaUrl = ALFA_NEWS_LOGO;
                                let mediaType = 'image';
                                let postFormat = '9:16';

                                // Validate mediaUrl from Gemini
                                if (parsed.mediaUrl && isGenericImage(parsed.mediaUrl)) {
                                    parsed.mediaUrl = '';
                                }

                                if (parsed.mediaUrl && parsed.mediaUrl.trim() !== '' && parsed.mediaUrl.startsWith('http')) {
                                    if (parsed.mediaType === 'video') {
                                        finalMediaUrl = parsed.mediaUrl; // Hotlink for videos
                                        mediaType = 'video';
                                        postFormat = parsed.isWide ? '16:9' : '9:16';
                                    } else {
                                        // It's an image
                                        if (parsed.isWide) {
                                            // Upload wide image to our own storage
                                            const uploadedUrl = await uploadMediaToStorage(parsed.mediaUrl);
                                            if (uploadedUrl) {
                                                finalMediaUrl = uploadedUrl;
                                                postFormat = '16:9';
                                            } else {
                                                finalMediaUrl = `https://wsrv.nl/?url=${encodeURIComponent(parsed.mediaUrl)}&output=webp`;
                                            }
                                        } else {
                                            finalMediaUrl = `https://wsrv.nl/?url=${encodeURIComponent(parsed.mediaUrl)}&output=webp`;
                                        }
                                    }
                                }

                                batch.set(docRef, {
                                    headline: { telugu: parsed.headline, english: parsed.headlineEn || '' },
                                    content: { telugu: parsed.content, english: parsed.contentEn || '' },
                                    sourceUrl: link,
                                    originalUrl: link,
                                    sourceName: source.siteName,
                                    category: category,
                                    categories: [...new Set([...categoriesList, category])].filter(Boolean),
                                    tags: parsed.tags || [],
                                    entities: parsed.entities || { people: [], organizations: [], locations: [] },
                                    district: finalDistrict,
                                    state: null,
                                    mandal: null,
                                    location: parsed.location || 'General',
                                    storyFingerprint: parsed.storyFingerprint || '',
                                    mediaUrl: finalMediaUrl,
                                    mediaType: mediaType,
                                    postFormat: postFormat,
                                    language: 'te',
                                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                                    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                    status: 'published',
                                    approved: true,
                                    viewCount: 0,
                                    likes: Math.floor(Math.random() * 150) + 50,
                                    comments: 0,
                                    shares: Math.floor(Math.random() * 40) + 10,
                                    reporter: { id: reporter.id, name: reporter.name }
                                });
                                batchCount++;
                            }
                        } catch (e) {
                            // Suppressed parsing error log
                        }
                    }
                };

                try {
                    await Promise.race([
                        articlePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Article Processing Timeout')), 180000)) 
                    ]);
                } catch (e) {
                    // Suppressed timeout log
                }
            }
            
            if (batchCount > 0) {
                await batch.commit();
                console.log(`[WEB] Commited ${batchCount} articles for ${source.siteName}`);
            }
            
            await doc.ref.update({ lastFetchTime: admin.firestore.FieldValue.serverTimestamp() });
        } catch (error) {
            console.error(`Error processing ${source.siteName}:`, error.message);
        }
}

// ============================================================================
// TWITTER SCRAPING VIA RAPIDAPI
// ============================================================================
async function fetchTweetsFromRapidAPI(handle) {
    const apiKey = process.env.TWITTER_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY;
    if (!apiKey) {
        console.error('[TWITTER] Error: TWITTER_RAPIDAPI_KEY or RAPIDAPI_KEY is not configured in environment variables.');
        return [];
    }

    const host = process.env.TWITTER_RAPIDAPI_HOST || 'twitter-api45.p.rapidapi.com';
    console.log(`[TWITTER] Fetching tweets for @${handle} using RapidAPI host: ${host}`);

    try {
        let url = '';
        let params = {};

        // Support popular RapidAPI Twitter endpoints automatically
        if (host.includes('twitter-api45')) {
            // twitter-api45: timeline.php
            url = `https://${host}/timeline.php`;
            params = { screenname: handle };
        } else if (host.includes('twitter-api64')) {
            url = `https://${host}/user/tweets`;
            params = { screenname: handle };
        } else if (host.includes('twitter-api135')) {
            url = `https://${host}/v1/user/tweets`;
            params = { username: handle };
        } else {
            // Generic fallback
            url = `https://${host}/timeline.php`;
            params = { screenname: handle };
        }

        const response = await axios.get(url, {
            params: params,
            headers: {
                'x-rapidapi-key': apiKey,
                'x-rapidapi-host': host
            },
            timeout: 30000
        });

        const data = response.data;
        if (!data) return [];

        let rawTweets = [];
        // Support direct array or nested keys (tweets, timeline, results, data, items, etc.)
        if (Array.isArray(data)) {
            rawTweets = data;
        } else if (data.tweets && Array.isArray(data.tweets)) {
            rawTweets = data.tweets;
        } else if (data.timeline && Array.isArray(data.timeline)) {
            rawTweets = data.timeline;
        } else if (data.results && Array.isArray(data.results)) {
            rawTweets = data.results;
        } else if (data.data && Array.isArray(data.data)) {
            rawTweets = data.data;
        } else if (data.items && Array.isArray(data.items)) {
            rawTweets = data.items;
        } else if (typeof data === 'object') {
            for (const key of Object.keys(data)) {
                if (Array.isArray(data[key])) {
                    rawTweets = data[key];
                    break;
                }
            }
        }

        console.log(`[TWITTER] Received ${rawTweets.length} raw tweets from RapidAPI for @${handle}`);

        const parsedTweets = [];
        for (const item of rawTweets) {
            // Extract text
            const text = item.text || item.full_text || item.tweet_text || item.body || item.desc || item.title || '';
            
            // Extract ID
            const tweetId = item.tweet_id || item.id_str || item.id || item.status_id || '';
            if (!tweetId) continue;

            const tweetUrl = `https://x.com/${handle}/status/${tweetId}`;

            // Extract Date
            let date = new Date();
            const dateVal = item.created_at || item.createdAt || item.timestamp || item.pubDate || item.date;
            if (dateVal) {
                if (typeof dateVal === 'number') {
                    date = new Date(dateVal * (dateVal < 10000000000 ? 1000 : 1));
                } else {
                    date = new Date(dateVal);
                }
            }

            // Extract Media URL and Media Type
            let mediaUrl = null;
            let mediaType = 'image';

            if (item.media && Array.isArray(item.media) && item.media.length > 0) {
                const firstMedia = item.media[0];
                if (typeof firstMedia === 'string') {
                    mediaUrl = firstMedia;
                } else if (typeof firstMedia === 'object') {
                    mediaUrl = firstMedia.url || firstMedia.media_url_https || firstMedia.media_url || firstMedia.thumbUrl;
                    if (firstMedia.type === 'video' || firstMedia.type === 'animated_gif') {
                        mediaType = 'video';
                    }
                }
            } else {
                mediaUrl = item.media_url || item.media_url_https || item.image || item.photo || item.thumbnail || null;
            }

            if (item.video_link || item.video_url || item.video) {
                mediaUrl = item.video_link || item.video_url || item.video;
                mediaType = 'video';
            }

            // Skip Retweets
            const isRetweet = item.is_retweet === true || text.startsWith('RT @') || text.startsWith('R to @');
            if (isRetweet) continue;

            parsedTweets.push({
                text: text,
                url: tweetUrl,
                mediaUrl: mediaUrl,
                mediaType: mediaType,
                date: date
            });
        }

        return parsedTweets;
    } catch (error) {
        console.error(`[TWITTER] RapidAPI request failed for @${handle}:`, error.message);
        if (error.response && error.response.data) {
            console.error('[TWITTER] Error response details:', JSON.stringify(error.response.data));
        }
        return [];
    }
}

// ============================================================================
// SCRAPING LOGIC: TWITTER / SOCIAL FEEDS using free syndication
// ============================================================================
async function processSingleTwitterFeed(doc) {
    const feed = doc.data();
    if (feed.platform !== 'Twitter' && feed.platform !== 'X') {
        return;
    }
    
    let handle = feed.url.trim();
    if (handle.startsWith('@')) handle = handle.substring(1);
    else if (handle.includes('twitter.com/')) handle = handle.split('twitter.com/')[1].split('/')[0].split('?')[0];
    else if (handle.includes('x.com/')) handle = handle.split('x.com/')[1].split('/')[0].split('?')[0];

    try {
        let fetchedItems = await fetchTweetsFromRapidAPI(handle);
        
        // Filter tweets strictly to the past 24 hours and ensure valid dates
        const now = Date.now();
        const past24Hours = 24 * 60 * 60 * 1000;
        
        let validFetchedItems = fetchedItems.filter(item => {
            if (!item.date) return false;
            
            const parsedDate = new Date(item.date);
            const timeMs = parsedDate.getTime();
            if (isNaN(timeMs)) return false;
            
            const diff = now - timeMs;
            // Keep if strictly within last 24 hours, and up to 1hr future timezone difference grace
            if (diff > past24Hours || diff < -1 * 60 * 60 * 1000) {
                return false;
            }
            
            if (item.text?.startsWith('RT @') || item.text?.startsWith('R to @')) {
                return false;
            }
            
            return true;
        });

        // Sort newest first
        validFetchedItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        fetchedItems = validFetchedItems.slice(0, 5); // take top 5 newest valid tweets
        
        if (fetchedItems.length > 0) {
            const tweetUrls = fetchedItems.map(item => item.url).filter(Boolean);
            const seenUrls = await isUrlAlreadyScanned(tweetUrls);
            
            const batch = db.batch();
            let batchCount = 0;
            
            for (const item of fetchedItems) {
                if (batchCount >= 3) break; 
                
                const tweetUrl = item.url;
                if (!tweetUrl || seenUrls.has(tweetUrl)) continue;

                // Process new tweet
                let mediaUrl = item.mediaUrl;
                let mediaType = item.mediaType;
                const textContent = item.text;

                const prompt = `You are a Senior Journalist.
                1. Evaluate if this social media post is a valid news update.
                2. Constraints: వచ్చిన కంటెంట్ లోని వ్యక్తులు, ప్రాంతం మిస్ అవ్వకుండా, వార్త యొక్క భావం మారకుండా, ఒక సీనియర్ న్యూస్ ఎడిటర్ మాదిరిగా ఒకే పేరాగ్రాఫ్ లో వార్త రాయాలి. Content must be approximately 60 words in Telugu.
                   CRITICAL TONE & PUNCH LOGIC (పంచ్ డైలాగ్స్ రూల్): వచ్చిన వార్త కంటెంట్ లో ఉన్న సంచలన వ్యాఖ్యలు, రాజకీయ విమర్శలు, నాయకులు వాడిన బలమైన లేదా ఘాటైన పంచ్ డైలాగులు (punchy political criticisms, emotional/sensational dialogues, and strong statements) ఎట్టి పరిస్థితుల్లోనూ వదిలిపెట్టవద్దు. వార్తను సాదాసీదాగా లేదా చప్పగా మార్చవద్దు! ఆ సంచలన పంచ్ డైలాగులను/వ్యాఖ్యలను వార్త సారాంశం (Telugu content summary) మరియు హెడ్లైన్ (headline) లలో చాలా స్పష్టంగా, ఉత్తేజకరంగా మరియు ఆకర్షణీయంగా ఉండేలా యథాతథంగా లేదా మరింత పదునుగా హైలైట్ చేయాలి. చదువరులను ఆకట్టుకునేలా వార్త ఘాటుగా ఉండాలి కానీ చప్పగా ఉండకూడదు.
                CRITICAL: Write as if YOU are the reporter breaking the news. DO NOT use phrases like "ఈ పోస్ట్ ప్రకారం", "ఈ ట్వీట్ చెబుతోంది", "వీరు తెలిపారు", "తెలియజేస్తుంది". State the facts directly.
                3. Headline must be a PUNCHY single sentence around 6-10 words in Telugu.
                4. Identify the primary location of the news. 
                5. Create a unique storyFingerprint based on the core fact. It must be EXACTLY 3-4 words joined by hyphens, focusing ONLY on the main subject and action.
                6. Classification & Tagging:
                   - refinedCategory: Classify into one of: Politics, Crime, Sports, Cinema, Business, Health, Education, Technology, Agriculture, Local, National, International.
                   - tags: Extract 3-5 relevant keywords in Telugu.
                   - entities: Identify People, Organizations, and Locations mentioned.
                7. CRITICAL REJECTION CRITERIA: 
                   - If it's a personal/social meeting (e.g., meeting with family, casual greetings, birthday wishes), it is NOT news.
                   - If it's a quote like "Good Morning", repost or shared content without new value, it is NOT news.
                8. Media: I have attached the candidate image (if any) or provided the URL: ${mediaUrl || 'None'}. 
                   - Is the attached image an actual news photo showing people, places, or events?
                   - IF IT IS A LOGO, GENERIC ICON OR IRRELEVANT, YOU MUST SET mediaUrl TO EMPTY STRING "".
                   - If it is a real news image relate to the article, set mediaUrl to "${mediaUrl || ''}".
                9. Output JSON only. Format as JSON: {"isRelevant": true, "headline": "Telugu Title", "content": "Telugu Summary", "headlineEn": "English Title", "contentEn": "English Summary", "location": "Location", "storyFingerprint": "finger-print-here", "refinedCategory": "Category", "tags": ["tag1", "tag2"], "entities": {"people": [], "organizations": [], "locations": []}, "mediaUrl": "image-url-here", "mediaType": "image|video", "isWide": true|false}`;
                
                const aiResult = await processWithGemini(textContent, prompt, mediaUrl);
                
                if (aiResult) {
                    try {
                        const parsed = JSON.parse(aiResult.replace(/```json|```/g, '').trim());
                        if (parsed.isRelevant) {
                            console.log(`[TWITTER] Relevant tweet! Headline: ${parsed.headline}`);
                        } else {
                            console.log(`[TWITTER] Tweet rejected as not relevant by AI: ${tweetUrl}`);
                        }
                        if (parsed.isRelevant && parsed.headline && parsed.content) {
                            if (parsed.storyFingerprint) {
                                if (storyFingerprintMemoryCache.has(parsed.storyFingerprint)) {
                                    console.log(`[TWITTER] Skipping duplicate story (memory cache hit): ${parsed.storyFingerprint}`);
                                    continue;
                                }
                                const duplicate = await db.collection('news')
                                    .where('storyFingerprint', '==', parsed.storyFingerprint)
                                    .where('timestamp', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
                                    .limit(1)
                                    .get();
                                
                                if (!duplicate.empty) {
                                    storyFingerprintMemoryCache.add(parsed.storyFingerprint);
                                    console.log(`[TWITTER] Skipping duplicate story: ${parsed.storyFingerprint}`);
                                    continue;
                                }
                                storyFingerprintMemoryCache.add(parsed.storyFingerprint);
                            }

                            const reporter = getRandomReporter();
                            const category = parsed.refinedCategory || feed.category || 'Social';
                            
                            const globalCategories = ["Sports", "Health", "Technology", "Business", "Cinema", "National", "International", "Politics", "Crime", "Education", "Agriculture", "Devotional", "Lifestyle", "AndhraPradesh", "Telangana"];
                            
                            let finalDistrict = "General";
                            if (globalCategories.includes(category)) {
                                finalDistrict = category;
                            } else if (feed.district) {
                                finalDistrict = feed.district;
                            } else if (category === 'స్థానిక' && feed.district) {
                                finalDistrict = feed.district;
                            }
                            
                            const categoriesList = [feed.sourceName || `X (@${handle})`, category, "Social"];
                            if (finalDistrict !== "General" && !globalCategories.includes(finalDistrict)) {
                                categoriesList.push("Local");
                                categoriesList.push(finalDistrict);
                            }
                            
                            let finalMediaUrl = ALFA_NEWS_LOGO;
                            let finalMediaType = 'image';
                            let postFormat = '16:9';

                            if (parsed.mediaUrl && !isGenericImage(parsed.mediaUrl) && parsed.mediaUrl.startsWith('http')) {
                                if (mediaType === 'video') {
                                    finalMediaUrl = mediaUrl;
                                    finalMediaType = 'video';
                                    postFormat = '16:9';
                                } else {
                                    finalMediaUrl = `https://wsrv.nl/?url=${encodeURIComponent(parsed.mediaUrl)}&output=webp`;
                                }
                            }
                            
                            const docRef = db.collection('news').doc();
                            batch.set(docRef, {
                                headline: { telugu: parsed.headline, english: parsed.headlineEn || '' },
                                content: { telugu: parsed.content, english: parsed.contentEn || '' },
                                sourceUrl: tweetUrl,
                                originalUrl: tweetUrl,
                                sourceName: feed.sourceName || `X (@${handle})`,
                                category: category,
                                categories: [...new Set([...categoriesList, category])].filter(Boolean),
                                tags: parsed.tags || [],
                                entities: parsed.entities || { people: [], organizations: [], locations: [] },
                                district: finalDistrict,
                                state: feed.state || null,
                                mandal: feed.mandal || null,
                                location: parsed.location || feed.district || 'General',
                                storyFingerprint: parsed.storyFingerprint || '',
                                mediaUrl: finalMediaUrl,
                                mediaType: finalMediaType,
                                postFormat: postFormat,
                                language: 'te',
                                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                                publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                status: 'published',
                                approved: true,
                                viewCount: 0,
                                likes: Math.floor(Math.random() * 150) + 50,
                                comments: 0,
                                shares: Math.floor(Math.random() * 40) + 10,
                                reporter: { id: reporter.id, name: reporter.name }
                            });
                            batchCount++;
                        }
                    } catch (e) {
                        console.error("[TWITTER] Failed to parse Tweet Gemini JSON:", e.message);
                    }
                }
            }
            if (batchCount > 0) {
                await batch.commit();
                console.log(`[TWITTER] Successfully committed batch of ${batchCount} tweets for ${handle}`);
            }
        } else {
             console.log(`[TWITTER] No items found for ${handle}`);
        }
        await doc.ref.update({ lastFetchTime: admin.firestore.FieldValue.serverTimestamp() });
    } catch (error) {
        console.error(`Error processing Twitter ${handle}:`, error.message);
    }
}

// ============================================================================
// SCHEDULER (QUEUE SYSTEM)
// ============================================================================
// We use a queue system to ensure only one heavy task runs at a time, saving RAM.

let isScraping = false;
let lastScrapeStartTime = 0;

async function runScraperQueue() {
    if (isScraping) {
        // If it's been stuck for more than 45 minutes, forcefully reset it
        if (Date.now() - lastScrapeStartTime > 45 * 60 * 1000) {
            console.log("Scraping seems to be stuck for over 45 minutes. Force resetting...");
            isScraping = false;
        } else {
            console.log("Scraping already in progress. Skipping this cycle.");
            return;
        }
    }
    
    isScraping = true;
    lastScrapeStartTime = Date.now();
    try {
        await prewarmScraperCache();
        console.log("Fetching sources for interleaved scraping...");
        const webSnapshot = await db.collection('scraping_sources').where('isPaused', '==', false).get();
        const webDocs = [...webSnapshot.docs];

        const twitterSnapshot = await db.collection('social_feeds').orderBy('lastFetchTime', 'asc').limit(15).get();
        const twitterDocs = [...twitterSnapshot.docs];

        console.log(`Found ${webDocs.length} Web sources and ${twitterDocs.length} Twitter feeds.`);

        while (webDocs.length > 0 || twitterDocs.length > 0) {
            
            // Process 1 Twitter feed
            if (twitterDocs.length > 0) {
                const tDoc = twitterDocs.shift();
                try {
                    await Promise.race([
                        processSingleTwitterFeed(tDoc),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Twitter Source Processing Timeout')), 300000))
                    ]);
                } catch (e) {
                    console.error(`Timeout or error processing twitter source ${tDoc.id}:`, e.message);
                }
            }

            // Process 2 Web sources
            if (webDocs.length > 0) {
                const wDoc1 = webDocs.shift();
                try {
                    await Promise.race([
                        processSingleWebSource(wDoc1),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Web Source Processing Timeout')), 300000)) // 5 min timeout
                    ]);
                } catch (e) {
                    console.error(`Timeout or error processing web source ${wDoc1.id}:`, e.message);
                }
            }
            if (webDocs.length > 0) {
                const wDoc2 = webDocs.shift();
                try {
                    await Promise.race([
                        processSingleWebSource(wDoc2),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Web Source Processing Timeout')), 300000)) // 5 min timeout
                    ]);
                } catch (e) {
                    console.error(`Timeout or error processing web source ${wDoc2.id}:`, e.message);
                }
            }
        }
        console.log("Finished Interleaved Scraping Queue.");
    } catch (error) {
        console.error("Queue Error:", error);
    } finally {
        isScraping = false;
    }
}

// Schedule to run every 2 hours, only between 4:00 AM and 10:00 PM IST
cron.schedule('0 4-22/2 * * *', () => {
    console.log("Cron triggered runScraperQueue (IST 4AM-10PM Every 2h)");
    runScraperQueue();
}, {
    timezone: "Asia/Kolkata"
});

console.log("VPS Scraper Started. Waiting for cron schedule...");
// Run once immediately on startup, ONLY if within the allowed IST hours (4 AM to 10 PM)
const currentISTHour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: 'numeric', hour12: false }));
if (currentISTHour >= 4 && currentISTHour <= 22) {
    console.log(`Starting initial scraper run (Current IST Hour: ${currentISTHour})`);
    runScraperQueue();
} else {
    console.log(`Skipping initial run. Outside allowed IST hours (Current IST Hour: ${currentISTHour})`);
}
