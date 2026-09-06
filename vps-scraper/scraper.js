require('dotenv').config();
const admin = require('firebase-admin');
const cron = require('node-cron');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const axios = require('axios');
const {
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
    groupTweetsIntoThreads
} = require('./extractor');

puppeteerExtra.use(StealthPlugin());
const rssParser = new Parser({
    timeout: 15000 // 15 seconds timeout
});

// Catch unhandled rejections and exceptions so the service never crashes silently
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============================================================================
// FIREBASE ADMIN INITIALIZATION
// ============================================================================
try {
    const serviceAccount = require('./firebase-service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: "alfa-news-31bf7.firebasestorage.app"
    });
    console.log("Firebase Admin Initialized Successfully.");
} catch (error) {
    console.error("Failed to initialize Firebase Admin. Please ensure firebase-service-account.json exists.", error.message);
    process.exit(1);
}

const db = admin.firestore();

// ============================================================================
// IN-MEMORY CACHE FOR FIRESTORE READ OPTIMIZATION & FAST DEDUPLICATION
// ============================================================================
const scannedUrlMemoryCache = new Set();
const storyFingerprintMemoryCache = new Set();
const recentHeadlinesMemoryCache = [];
let isCachePrewarmed = false;

async function prewarmScraperCache() {
    if (isCachePrewarmed) return;
    try {
        console.log("Pre-warming in-memory URL, fingerprint & headline caches to save Firestore reads...");
        // 1. Load recent scanned URLs (up to 3000)
        const recentUrlsSnap = await db.collection('scanned_urls')
            .orderBy('scannedAt', 'desc')
            .limit(3000)
            .get();
        recentUrlsSnap.forEach(doc => {
            const data = doc.data();
            if (data.url) scannedUrlMemoryCache.add(normalizeUrl(data.url));
        });

        // 2. Load recent published news (last 2000 ordered by timestamp DESC for accurate today/yesterday dedup)
        const recentNewsSnap = await db.collection('news')
            .orderBy('timestamp', 'desc')
            .limit(2000)
            .get();
        recentNewsSnap.forEach(doc => {
            const data = doc.data();
            if (data.sourceUrl) scannedUrlMemoryCache.add(normalizeUrl(data.sourceUrl));
            if (data.originalUrl) scannedUrlMemoryCache.add(normalizeUrl(data.originalUrl));
            if (data.storyFingerprint) storyFingerprintMemoryCache.add(data.storyFingerprint);
            const teTitle = data.headline?.telugu || (typeof data.headline === 'string' ? data.headline : '');
            if (teTitle && teTitle.length > 5) {
                recentHeadlinesMemoryCache.push(teTitle);
            }
        });

        isCachePrewarmed = true;
        console.log(`Cache pre-warmed: ${scannedUrlMemoryCache.size} URLs, ${storyFingerprintMemoryCache.size} fingerprints, ${recentHeadlinesMemoryCache.length} headlines in memory.`);
    } catch (e) {
        console.warn("Failed to prewarm cache (will continue without prewarm):", e.message);
    }
}

// ============================================================================
// GEMINI API RATE LIMITING, MODEL FALLBACK & KEY ROTATION SETUP
// ============================================================================
const fallbackKeys = [
    "AIzaSyC4-d1zC4G6WgUmIDZ0eKPm9WOtGGz5xJ0",
    "AIzaSyCJsdsvzB9nVU_-gORRTZgsvvhXSUXTdYU",
    "AIzaSyA6sIISFcNNPkJdrnDCv7zqg4Fkiw_LcSs",
    "AIzaSyChpVoZ7pfMyxCmVkW1298hXXS5snOp9dA",
    "AIzaSyA6kEVXrWHz_EtPsHTPWFa08ZyY04l1M08",
    "AIzaSyA4lAySqfR15dDI2MgdgxtbiANExEIyE1w",
    "AIzaSyCg2fje2zPwmOCaQUvBX1n-DHNbHqdk1W0",
    "AIzaSyDqlH1_n1dKPfOivV0ePzgUm6FoXuVVw_M",
    "AIzaSyCydnUw8oNZgzMhyc8h6_o33hd7t1NF0So"
];

const rawKeyPool = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
    process.env.GEMINI_API_KEY_7,
    process.env.GEMINI_API_KEY_8,
    process.env.GEMINI_API_KEY_9,
    process.env.GEMINI_API_KEY_10,
    process.env.GEMINI_API_KEY,
    ...fallbackKeys
];

// Deduplicate, sanitize, and exclude known invalid keys
const geminiKeys = Array.from(new Set(
    rawKeyPool
        .map(k => k ? k.trim().replace(/^['"]|['"]$/g, '') : '')
        .filter(k => k && k.length > 10 && k !== 'AIzaSyA8-YNKtCIRWLyGo6cnRTzblpD4fBBVdo0' && k !== 'AIzaSyAzmrl2_vOhQOhr_YUlS4EsvCriZP1OBxo')
));

if (geminiKeys.length === 0) {
    console.error("CRITICAL: No valid Gemini API keys found. Please check .env");
} else {
    console.log(`[GEMINI] Loaded ${geminiKeys.length} API keys into rotation pool.`);
}

let currentGeminiKeyIndex = 0;
let requestCountForCurrentKey = 0;
const MAX_REQUESTS_PER_KEY_PER_DAY = 1500;
let lastGeminiRequestTime = 0;
// Limit to <= 13.3 requests per minute (4500ms delay) to avoid free tier 429 quota exhaustion
const MIN_DELAY_BETWEEN_GEMINI_REQUESTS = 4500; 

// Resilient fallback chain for active models
const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite'
];
let currentModelIndex = 0;

// ============================================================================
// MEDIA STORAGE UTILS
// ============================================================================
const ALFA_NEWS_LOGO = "https://alfanews.app/logo.png";

async function uploadMediaToStorage(url, folder = 'news-media') {
    if (!url || !url.startsWith('http')) return null;
    try {
        const response = await axios.get(url, { 
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Referer': 'https://www.google.com/'
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

        return `https://firebasestorage.googleapis.com/v0/b/${admin.storage().bucket().name}/o/${encodeURIComponent(fileName)}?alt=media`;
    } catch (error) {
        console.error(`Failed to upload media to storage: ${error.message}`);
        return null;
    }
}

// ============================================================================
// SINGLETON PUPPETEER BROWSER POOL (Memory & Speed Optimized)
// ============================================================================
let sharedBrowser = null;
let browserPageCount = 0;
const MAX_PAGES_BEFORE_BROWSER_RESTART = 40;

function findInstalledChrome() {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    const systemPaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ];
    for (const p of systemPaths) {
        if (fs.existsSync(p)) return p;
    }
    
    try {
        const cacheBase = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
        if (fs.existsSync(cacheBase)) {
            const versions = fs.readdirSync(cacheBase);
            for (const v of versions) {
                const chromeBin = path.join(cacheBase, v, 'chrome-linux64', 'chrome');
                if (fs.existsSync(chromeBin)) {
                    console.log(`[PUPPETEER] Found installed Chrome at: ${chromeBin}`);
                    return chromeBin;
                }
            }
        }
    } catch (e) {}
    return null;
}

async function getSharedBrowser() {
    if (sharedBrowser && sharedBrowser.isConnected()) {
        if (browserPageCount >= MAX_PAGES_BEFORE_BROWSER_RESTART) {
            console.log("[PUPPETEER] Recycling browser instance to release memory...");
            try {
                await sharedBrowser.close();
            } catch (e) {}
            sharedBrowser = null;
            browserPageCount = 0;
        } else {
            return sharedBrowser;
        }
    }

    try {
        const systemChrome = findInstalledChrome();
        const launchOptions = {
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--disable-gpu', 
                '--no-zygote', 
                '--disable-extensions'
            ],
            timeout: 30000
        };

        if (systemChrome) {
            launchOptions.executablePath = systemChrome;
        }

        sharedBrowser = await puppeteerExtra.launch(launchOptions);
        browserPageCount = 0;
        return sharedBrowser;
    } catch (err) {
        console.error("[PUPPETEER] Failed to launch browser:", err.message);
        sharedBrowser = null;
        return null;
    }
}

async function closeSharedBrowser() {
    if (sharedBrowser) {
        try {
            await sharedBrowser.close();
        } catch (e) {}
        sharedBrowser = null;
        browserPageCount = 0;
    }
}

async function fetchHtmlOptimized(url) {
    // 1. First try fast HTTP fetch with realistic desktop browser headers
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,te;q=0.8',
                'Referer': 'https://www.google.com/'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            return await response.text();
        }
    } catch (e) {
        // Fall through to Puppeteer
    }

    // 2. Fallback to Singleton Puppeteer instance
    let page = null;
    try {
        const browser = await getSharedBrowser();
        if (!browser) return null;

        page = await browser.newPage();
        browserPageCount++;

        // Block media and font downloads to save memory and network bandwidth
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        const html = await page.content();
        return html;
    } catch (err) {
        console.error(`[PUPPETEER] Fetch failed for ${url}: ${err.message}`);
        return null;
    } finally {
        if (page) {
            try {
                await page.close();
            } catch (e) {}
        }
    }
}

// ============================================================================
// GEMINI AI PROCESSING
// ============================================================================
async function processWithGemini(text, prompt, imageUrl = null, retries = 4) {
    if (geminiKeys.length === 0) {
        console.error("No Gemini API keys configured. Cannot process.");
        return null;
    }

    const truncatedText = text ? text.substring(0, 2500) : "";
    if (truncatedText.length < 100) return null;

    let imagePart = null;
    if (imageUrl && !isGenericImage(imageUrl)) {
        try {
            const imgRes = await axios.get(imageUrl, { 
                responseType: 'arraybuffer', 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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
            // Image fetch error is non-fatal; proceed with text
        }
    }

    const maxAttempts = Math.max(geminiKeys.length * 2, 6);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            if (requestCountForCurrentKey >= MAX_REQUESTS_PER_KEY_PER_DAY) {
                console.log(`[GEMINI] Key ${currentGeminiKeyIndex + 1} reached limit. Rotating.`);
                currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % geminiKeys.length;
                requestCountForCurrentKey = 0;
            }

            // Enforce minimum delay between requests
            const now = Date.now();
            const timeSinceLast = now - lastGeminiRequestTime;
            if (timeSinceLast < MIN_DELAY_BETWEEN_GEMINI_REQUESTS) {
                const sleepTime = MIN_DELAY_BETWEEN_GEMINI_REQUESTS - timeSinceLast;
                await new Promise(r => setTimeout(r, sleepTime));
            }
            lastGeminiRequestTime = Date.now();
            requestCountForCurrentKey++;

            const currentKey = geminiKeys[currentGeminiKeyIndex];
            const activeModel = GEMINI_MODELS[currentModelIndex % GEMINI_MODELS.length];
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${currentKey}`;
            
            const parts = [{ text: `${prompt}\n\nText:\n${truncatedText}` }];
            if (imagePart) parts.push(imagePart);

            const payload = {
                contents: [{ parts }],
                generationConfig: {
                    temperature: 0.3
                }
            };

            const response = await axios.post(url, payload, { timeout: 45000 });
            
            if (response.data && response.data.candidates && response.data.candidates.length > 0) {
                return response.data.candidates[0].content.parts[0].text.trim();
            }
            return null;
        } catch (error) {
            const errorMsg = (error.response?.data?.error?.message || error.message || "").toUpperCase();
            const status = error.response?.status;
            
            // If model not found, switch model
            if (errorMsg.includes('NOT_FOUND') || errorMsg.includes('IS NOT SUPPORTED')) {
                console.log(`[GEMINI] Model ${GEMINI_MODELS[currentModelIndex % GEMINI_MODELS.length]} not supported. Falling back to next model.`);
                currentModelIndex++;
                continue;
            }

            // Key-specific issues: Invalid key, disabled key, quota exhaustion, 429, 400 Bad Request, 403 Forbidden
            const isKeyIssue = errorMsg.includes('API KEY NOT VALID') || 
                               errorMsg.includes('API_KEY_INVALID') || 
                               errorMsg.includes('INVALID_ARGUMENT') || 
                               errorMsg.includes('QUOTA') || 
                               errorMsg.includes('RESOURCE_EXHAUSTED') || 
                               status === 429 || 
                               status === 400 || 
                               status === 403;

            if (isKeyIssue) {
                console.log(`[GEMINI] Key ${currentGeminiKeyIndex + 1}/${geminiKeys.length} failed (${errorMsg.substring(0, 50)}). Rotating immediately to next key...`);
                currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % geminiKeys.length;
                requestCountForCurrentKey = 0;
                // Immediately retry with next key in the pool!
                continue;
            }

            const isRetryable = errorMsg.includes('503') || 
                               errorMsg.includes('OVERLOADED') || 
                               errorMsg.includes('HIGH DEMAND') || 
                               errorMsg.includes('UNAVAILABLE') || 
                               errorMsg.includes('TIMEOUT') || 
                               errorMsg.includes('ECONNRESET');

            if (isRetryable && attempt < maxAttempts - 1) {
                const delay = 3000 + (Math.random() * 2000); 
                console.log(`[GEMINI] Temporary service issue, retrying in ${Math.round(delay/1000)}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            console.error("Gemini API Error:", errorMsg);
            // Move to next key for the next call so we don't get stuck on the failing key
            currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % geminiKeys.length;
            return null;
        }
    }
    return null;
}

// ============================================================================
// URL TRACKING & PREVENTING DUPLICATES
// ============================================================================
async function markUrlAsProcessed(url) {
    if (!url) return;
    const cleanUrl = normalizeUrl(url);
    scannedUrlMemoryCache.add(cleanUrl);
    scannedUrlMemoryCache.add(url);
    try {
        const docId = Buffer.from(cleanUrl).toString('base64').replace(/[/+=]/g, '_').substring(0, 50);
        await db.collection('scanned_urls').doc(docId).set({
            url: cleanUrl,
            rawUrl: url,
            scannedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {}
}

async function isUrlAlreadyScanned(urls) {
    if (!urls || urls.length === 0) return new Set();
    const seen = new Set();
    const urlsToQuery = [];

    // 1. Check in-memory cache first (both clean and raw)
    for (const u of urls) {
        const clean = normalizeUrl(u);
        if (scannedUrlMemoryCache.has(clean) || scannedUrlMemoryCache.has(u)) {
            seen.add(u);
        } else {
            urlsToQuery.push({ raw: u, clean: clean });
        }
    }

    if (urlsToQuery.length === 0) {
        return seen;
    }

    // 2. Query Firestore news collection
    for (let i = 0; i < urlsToQuery.length; i += 10) {
        const batch = urlsToQuery.slice(i, i + 10);
        const batchUrls = [...new Set(batch.map(b => b.clean).concat(batch.map(b => b.raw)))];
        try {
            const snapshot = await db.collection('news').where('sourceUrl', 'in', batchUrls).get();
            snapshot.forEach(doc => {
                const sUrl = doc.data().sourceUrl;
                if (sUrl) {
                    scannedUrlMemoryCache.add(sUrl);
                    scannedUrlMemoryCache.add(normalizeUrl(sUrl));
                    batch.forEach(item => {
                        if (item.raw === sUrl || item.clean === normalizeUrl(sUrl)) {
                            seen.add(item.raw);
                        }
                    });
                }
            });
        } catch (e) {}
    }
    
    // 3. Query scanned_urls collection
    for (let i = 0; i < urlsToQuery.length; i += 10) {
        const batch = urlsToQuery.slice(i, i + 10);
        const batchUrls = [...new Set(batch.map(b => b.clean).concat(batch.map(b => b.raw)))];
        try {
            const snapshot = await db.collection('scanned_urls').where('url', 'in', batchUrls).get();
            snapshot.forEach(doc => {
                const sUrl = doc.data().url;
                if (sUrl) {
                    scannedUrlMemoryCache.add(sUrl);
                    scannedUrlMemoryCache.add(normalizeUrl(sUrl));
                    batch.forEach(item => {
                        if (item.raw === sUrl || item.clean === normalizeUrl(sUrl)) {
                            seen.add(item.raw);
                        }
                    });
                }
            });
        } catch (e) {}
    }
    
    return seen;
}

// ============================================================================
// REPORTER PERSONAS
// ============================================================================
const reporters = [
    { id: 'rep1', name: 'శ్రీనివాస్' }, { id: 'rep2', name: 'రమేష్' },
    { id: 'rep3', name: 'వెంకట్' }, { id: 'rep4', name: 'సురేష్' },
    { id: 'rep5', name: 'కృష్ణ' }, { id: 'rep6', name: 'రాము' },
    { id: 'rep7', name: 'శివ' }, { id: 'rep8', name: 'ప్రసాద్' },
    { id: 'rep9', name: 'మహేష్' }, { id: 'rep10', name: 'అశోక్' },
    { id: 'rep11', name: 'కిరణ్' }, { id: 'rep12', name: 'రాజేష్' },
    { id: 'rep13', name: 'సునీల్' }, { id: 'rep14', name: 'ప్రవీణ్' },
    { id: 'rep15', name: 'సతీష్' }, { id: 'rep16', name: 'నరేష్' },
    { id: 'rep17', name: 'భాస్కర్' }, { id: 'rep18', name: 'గోపి' },
    { id: 'rep19', name: 'హరి' }, { id: 'rep20', name: 'విజయ్' }
];

function getRandomReporter() {
    return reporters[Math.floor(Math.random() * reporters.length)];
}

const TELUGU_CATEGORY_MAP = {
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

const GLOBAL_CATEGORIES = [
    "Sports", "Health", "Technology", "Business", "Cinema", 
    "National", "International", "Politics", "Crime", 
    "Education", "Agriculture", "Devotional", "Lifestyle", 
    "AndhraPradesh", "Telangana"
];

// ============================================================================
// SCRAPING LOGIC: WEB SOURCES
// ============================================================================
async function processSingleWebSource(doc) {
    const source = doc.data();
    console.log(`[WEB] Processing Source: ${source.siteName} (${source.url})`);
    
    let processedCount = 0;
    let failedCount = 0;
    let lastError = null;

    try {
        let uniqueLinks = [];

        // Check if source URL is an RSS feed
        if (source.url.includes('rss') || source.url.includes('.xml') || source.url.endsWith('/feed')) {
            try {
                const feed = await rssParser.parseURL(source.url);
                if (feed && feed.items && feed.items.length > 0) {
                    uniqueLinks = feed.items.map(item => item.link).filter(Boolean);
                    console.log(`[WEB-RSS] Successfully retrieved ${uniqueLinks.length} items from RSS feed for ${source.siteName}`);
                }
            } catch (rssErr) {
                console.log(`[WEB-RSS] RSS parsing failed for ${source.siteName}, falling back to HTML extraction.`);
            }
        }

        // HTML link extraction fallback
        if (uniqueLinks.length === 0) {
            const html = await fetchHtmlOptimized(source.url);
            if (!html) {
                throw new Error(`Failed to load landing page HTML for ${source.siteName}`);
            }
            uniqueLinks = extractArticleLinks(html, source.url);
        }

        const existingUrls = await isUrlAlreadyScanned(uniqueLinks);
        const newLinks = uniqueLinks.filter(link => !existingUrls.has(link));

        console.log(`[WEB] Found ${uniqueLinks.length} total valid links for ${source.siteName} (${newLinks.length} new)`);

        const linksToProcess = newLinks.slice(0, 12);
        const batch = db.batch();
        let batchCount = 0;
        const staleThreshold = Date.now() - (24 * 60 * 60 * 1000); // 24 hours

        for (const link of linksToProcess) {
            if (batchCount >= 5) break;

            const articlePromise = async () => {
                const articleHtml = await fetchHtmlOptimized(link);
                if (!articleHtml) {
                    await markUrlAsProcessed(link);
                    failedCount++;
                    return;
                }

                const extracted = extractArticleData(articleHtml, link);

                // Skip stale articles
                if (extracted.date && extracted.date.getTime() < staleThreshold) {
                    await markUrlAsProcessed(link);
                    return;
                }

                if (!extracted.body || extracted.body.length < 180) {
                    await markUrlAsProcessed(link);
                    failedCount++;
                    return;
                }

                const prompt = `You are a Senior Telugu News Editor.
1. Evaluate if this article is timely and valid news:
   - REJECT generic blog posts, relationship tips, horoscopes, evergreen general advice.
   - EXCEPTION: Major political party formation days, national holidays, or public events ARE valid news.
2. Constraints:
   - Do not miss people, locations, or the true meaning of the news.
   - Summary must be approximately 60 words in Telugu.
   - PUNCH LOGIC: Retain powerful political statements, emotional reactions, and punch dialogues faithfully.
   - Write in direct breaking news tone without phrases like "ఈ నివేదిక ప్రకారం".
3. Headline must be a punchy single sentence of 6-10 words in Telugu.
4. Identify location: District name in Telugu if in TS/AP, state name, 'India', or 'World'.
5. Generate deterministic storyFingerprint: EXACTLY 3-4 words joined by hyphens in English (e.g. "konda-surekha-resignation", "accident-hyderabad-road").
6. Classification:
   - refinedCategory: Exactly one of [Politics, Crime, Sports, Cinema, Business, Health, Education, Technology, Agriculture, Local, National, International].
   - tags: 3-5 Telugu keywords.
   - entities: { "people": [], "organizations": [], "locations": [] }.
7. Media: Attached or candidate URL: ${extracted.image || 'None'}.
   - If image is a logo, masthead, or generic graphic, set mediaUrl to "".
   - If image is a real news photo, set mediaUrl to "${extracted.image || ''}".
8. Output JSON only:
{"isRelevant": true, "headline": "Telugu Title", "content": "Telugu Summary", "headlineEn": "English Title", "contentEn": "English Summary", "location": "Location", "storyFingerprint": "finger-print", "refinedCategory": "Category", "tags": [], "entities": {"people":[], "organizations":[], "locations":[]}, "mediaUrl": "${extracted.image || ''}", "mediaType": "image|video", "isWide": true|false}`;

                const aiResult = await processWithGemini(extracted.body, prompt, extracted.image);
                if (!aiResult) {
                    failedCount++;
                    return;
                }

                try {
                    const parsed = JSON.parse(aiResult.replace(/```json|```/g, '').trim());
                    if (!parsed.isRelevant || !parsed.headline || !parsed.content) {
                        await markUrlAsProcessed(link);
                        return;
                    }

                    // 1. Headline similarity deduplication
                    if (parsed.headline) {
                        const isDupHeadline = recentHeadlinesMemoryCache.some(cachedHeadline => {
                            return calculateTextSimilarity(parsed.headline, cachedHeadline) >= 0.70;
                        });
                        if (isDupHeadline) {
                            console.log(`[DEDUP] Duplicate story (headline similarity hit): "${parsed.headline}"`);
                            await markUrlAsProcessed(link);
                            return;
                        }
                    }

                    // 2. Deduplication via storyFingerprint
                    if (parsed.storyFingerprint) {
                        if (storyFingerprintMemoryCache.has(parsed.storyFingerprint)) {
                            console.log(`[DEDUP] Duplicate story (in-memory hit): ${parsed.storyFingerprint}`);
                            await markUrlAsProcessed(link);
                            return;
                        }

                        // Query Firestore using single-field index on storyFingerprint (no composite index needed)
                        const duplicate = await db.collection('news')
                            .where('storyFingerprint', '==', parsed.storyFingerprint)
                            .limit(1)
                            .get();

                        if (!duplicate.empty) {
                            storyFingerprintMemoryCache.add(parsed.storyFingerprint);
                            console.log(`[DEDUP] Duplicate story (Firestore hit): ${parsed.storyFingerprint}`);
                            await markUrlAsProcessed(link);
                            return;
                        }
                        storyFingerprintMemoryCache.add(parsed.storyFingerprint);
                    }

                    const reporter = getRandomReporter();
                    let category = parsed.refinedCategory;
                    if (!category || category === 'Local') {
                        category = TELUGU_CATEGORY_MAP[source.category] || source.category || 'Local';
                    }

                    let finalDistrict = "General";
                    if (GLOBAL_CATEGORIES.includes(category)) {
                        finalDistrict = category;
                    } else if (source.district) {
                        finalDistrict = source.district;
                    }

                    const categoriesList = [source.siteName, category];
                    if (finalDistrict !== "General" && !GLOBAL_CATEGORIES.includes(finalDistrict)) {
                        categoriesList.push("Local");
                        categoriesList.push(finalDistrict);
                    }

                    // Media URL handling: Never drop the extracted image if Gemini returned empty or placeholder
                    let chosenMediaUrl = null;
                    if (parsed.mediaUrl && parsed.mediaUrl.startsWith('http') && !parsed.mediaUrl.includes('"') && parsed.mediaUrl !== 'url' && !isGenericImage(parsed.mediaUrl)) {
                        chosenMediaUrl = parsed.mediaUrl;
                    } else if (extracted.image && extracted.image.startsWith('http') && !isGenericImage(extracted.image)) {
                        chosenMediaUrl = extracted.image;
                    }

                    let finalMediaUrl = ALFA_NEWS_LOGO;
                    let mediaType = 'image';
                    let postFormat = '9:16';

                    if (chosenMediaUrl) {
                        if (parsed.mediaType === 'video') {
                            finalMediaUrl = chosenMediaUrl;
                            mediaType = 'video';
                            postFormat = parsed.isWide ? '16:9' : '9:16';
                        } else {
                            if (parsed.isWide) {
                                const uploadedUrl = await uploadMediaToStorage(chosenMediaUrl);
                                if (uploadedUrl) {
                                    finalMediaUrl = uploadedUrl;
                                    postFormat = '16:9';
                                } else {
                                    finalMediaUrl = `https://wsrv.nl/?url=${encodeURIComponent(chosenMediaUrl)}&output=webp`;
                                }
                            } else {
                                finalMediaUrl = `https://wsrv.nl/?url=${encodeURIComponent(chosenMediaUrl)}&output=webp`;
                            }
                        }
                    }

                    const docRef = db.collection('news').doc();
                    const newsPayload = sanitizeFirestoreData({
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
                        state: source.state || null,
                        mandal: source.mandal || null,
                        location: parsed.location || source.district || 'General',
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

                    batch.set(docRef, newsPayload);
                    await markUrlAsProcessed(link);
                    if (parsed.headline) recentHeadlinesMemoryCache.push(parsed.headline);
                    batchCount++;
                    processedCount++;
                    console.log(`[WEB] Prepared article: ${parsed.headline}`);
                } catch (parseErr) {
                    console.error("[WEB] JSON parse error:", parseErr.message);
                    failedCount++;
                }
            };

            try {
                await Promise.race([
                    articlePromise(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Article Processing Timeout')), 180000))
                ]);
            } catch (timeoutErr) {
                console.error(`[WEB] Timeout processing article: ${link}`);
                failedCount++;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
            console.log(`[WEB] Committed ${batchCount} articles successfully for ${source.siteName}`);
        }

        // Update scraping_sources with metrics
        await doc.ref.update(sanitizeFirestoreData({
            lastStatus: 'active',
            lastError: null,
            lastFetchTime: admin.firestore.FieldValue.serverTimestamp(),
            lastProcessedCount: processedCount,
            lastFailedCount: failedCount,
            processed24h: admin.firestore.FieldValue.increment(processedCount),
            failed24h: admin.firestore.FieldValue.increment(failedCount),
            totalProcessedCount: admin.firestore.FieldValue.increment(processedCount),
            totalFailedCount: admin.firestore.FieldValue.increment(failedCount)
        }));
    } catch (error) {
        lastError = error.message;
        console.error(`Error processing ${source.siteName}:`, error.message);
        try {
            await doc.ref.update(sanitizeFirestoreData({
                lastStatus: 'error',
                lastError: error.message,
                lastFetchTime: admin.firestore.FieldValue.serverTimestamp(),
                lastFailedCount: admin.firestore.FieldValue.increment(1),
                failed24h: admin.firestore.FieldValue.increment(1)
            }));
        } catch (e) {}
    }
}

// ============================================================================
// DIRECT STEALTH TWITTER / X SCRAPING (Zero External API, Zero Cost)
// ============================================================================
async function fetchTweetsDirectStealth(handle) {
    let page = null;
    try {
        const browser = await getSharedBrowser();
        if (!browser) return [];

        page = await browser.newPage();
        browserPageCount++;

        await page.setViewport({ width: 1280, height: 900 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        
        console.log(`[X-DIRECT] Navigating stealthily to https://x.com/${handle}...`);
        await page.goto(`https://x.com/${handle}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForFunction(() => document.querySelectorAll('article').length > 0, { timeout: 12000 }).catch(() => {});

        const rawTweets = await page.$$eval('article', (articles, userHandle) => {
            const results = [];
            for (const el of articles) {
                // Find status link
                const statusLinkEl = el.querySelector('a[href*="/status/"]');
                if (!statusLinkEl) continue;
                const href = statusLinkEl.getAttribute('href') || '';
                const match = href.match(/\/status\/(\d+)/);
                if (!match) continue;
                const tweetId = match[1];
                const tweetUrl = `https://x.com/${userHandle}/status/${tweetId}`;

                // Extract text
                let text = '';
                const tweetTextEl = el.querySelector('[data-testid="tweetText"]');
                if (tweetTextEl) {
                    text = tweetTextEl.innerText.trim();
                }
                
                if (!text || text.length < 10) {
                    const fullText = el.innerText || '';
                    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
                    const contentLines = lines.filter(line => {
                        if (line.includes('@' + userHandle)) return false;
                        if (/^(Pinned|Retweeted|Reposted|Show more|Show this thread|REPLAY)$/i.test(line)) return false;
                        if (/^\d+(\.\d+)?[KMB]?\s*(views|reposts|quotes|likes|bookmarks)?$/i.test(line)) return false;
                        if (/^[·•]\s*\d+[smhdwy]$/i.test(line)) return false;
                        return true;
                    });
                    text = contentLines.slice(1, -1).join(' ').trim() || contentLines.join(' ').trim();
                }

                if (!text || text.length < 15) continue;

                // Extract image
                let mediaUrl = null;
                let mediaType = 'image';
                const imgEl = el.querySelector('img[src*="pbs.twimg.com/media"]') || el.querySelector('[data-testid="tweetPhoto"] img');
                if (imgEl) {
                    let src = imgEl.getAttribute('src') || '';
                    if (src.includes('&name=')) {
                        src = src.replace(/&name=[^&]+/, '&name=large');
                    }
                    mediaUrl = src;
                }

                // Extract video poster image if no direct photo was found
                const videoEl = el.querySelector('video');
                if (videoEl && !mediaUrl) {
                    const poster = videoEl.getAttribute('poster');
                    if (poster && poster.startsWith('http')) {
                        mediaUrl = poster;
                    }
                }

                // Extract author profile photo as fallback for text-only tweets
                let avatarUrl = null;
                const avatarEl = el.querySelector('[data-testid="Tweet-User-Avatar"] img') || el.querySelector('img[src*="pbs.twimg.com/profile_images"]');
                if (avatarEl) {
                    let aSrc = avatarEl.getAttribute('src') || '';
                    if (aSrc) {
                        avatarUrl = aSrc.replace(/_normal\./, '_400x400.').replace(/_bigger\./, '_400x400.');
                    }
                }

                results.push({
                    id: tweetId,
                    url: tweetUrl,
                    text: text,
                    mediaUrl: mediaUrl,
                    avatarUrl: avatarUrl,
                    mediaType: mediaType
                });

                if (results.length >= 12) break;
            }
            return results;
        }, handle);

        const parsedTweets = rawTweets.map(item => {
            const tweetDate = getTweetTimestamp(item.id);
            const cleanedText = cleanTweetText(item.text);
            return {
                id: item.id,
                url: item.url,
                text: cleanedText,
                mediaUrl: item.mediaUrl,
                avatarUrl: item.avatarUrl,
                mediaType: item.mediaType,
                date: tweetDate
            };
        }).filter(t => t.text && t.text.length >= 15);

        console.log(`[X-DIRECT] Successfully extracted ${parsedTweets.length} primary direct tweets for @${handle}`);
        return parsedTweets;
    } catch (e) {
        console.error(`[X-DIRECT] Direct stealth crawl failed for @${handle}:`, e.message);
        return [];
    } finally {
        if (page) {
            try { await page.close(); } catch (e) {}
        }
    }
}

// ============================================================================
// TWITTER SCRAPING VIA RAPIDAPI (Fallback)
// ============================================================================
async function fetchTweetsFromRapidAPI(handle) {
    const apiKey = process.env.TWITTER_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY;
    if (!apiKey) return [];

    const host = process.env.TWITTER_RAPIDAPI_HOST || 'twitter-api45.p.rapidapi.com';

    try {
        let url = `https://${host}/timeline.php`;
        let params = { screenname: handle };

        if (host.includes('twitter-api64')) {
            url = `https://${host}/user/tweets`;
        } else if (host.includes('twitter-api135')) {
            url = `https://${host}/v1/user/tweets`;
            params = { username: handle };
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
        if (Array.isArray(data)) rawTweets = data;
        else if (Array.isArray(data.tweets)) rawTweets = data.tweets;
        else if (Array.isArray(data.timeline)) rawTweets = data.timeline;
        else if (Array.isArray(data.results)) rawTweets = data.results;
        else if (Array.isArray(data.data)) rawTweets = data.data;

        const parsedTweets = [];
        for (const item of rawTweets) {
            const text = item.text || item.full_text || item.tweet_text || '';
            const tweetId = item.tweet_id || item.id_str || item.id || '';
            if (!tweetId) continue;

            const tweetUrl = `https://x.com/${handle}/status/${tweetId}`;
            let date = item.created_at ? new Date(item.created_at) : getTweetTimestamp(tweetId);

            let mediaUrl = null;
            let mediaType = 'image';

            const mediaList = item.extended_entities?.media || item.entities?.media || item.media || [];
            if (Array.isArray(mediaList) && mediaList.length > 0) {
                const first = mediaList[0];
                mediaUrl = typeof first === 'string' ? first : (first.media_url_https || first.media_url || first.url || null);
                if (first.type === 'video' || first.type === 'animated_gif') mediaType = 'video';
            } else {
                mediaUrl = item.media_url || item.media_url_https || null;
            }

            if (item.is_retweet === true || text.startsWith('RT @')) continue;

            parsedTweets.push({
                id: tweetId,
                text: cleanTweetText(text),
                url: tweetUrl,
                mediaUrl,
                mediaType,
                date
            });
        }
        return parsedTweets;
    } catch (error) {
        console.error(`[TWITTER] RapidAPI request failed for @${handle}:`, error.message);
        return [];
    }
}

// ============================================================================
// SCRAPING LOGIC: TWITTER / SOCIAL FEEDS
// ============================================================================
async function processSingleTwitterFeed(doc) {
    const feed = doc.data();
    if (feed.isPaused === true) return;

    const platform = (feed.platform || '').toLowerCase();
    if (platform && platform !== 'twitter' && platform !== 'x') return;

    let rawUrl = (feed.url || feed.handle || '').trim();
    if (!rawUrl) return;
    let handle = rawUrl;
    if (handle.includes('twitter.com/')) handle = handle.split('twitter.com/')[1].split('/')[0].split('?')[0];
    else if (handle.includes('x.com/')) handle = handle.split('x.com/')[1].split('/')[0].split('?')[0];
    handle = handle.replace(/^@+/, '').trim();
    if (!handle) return;

    try {
        let batchCount = 0;
        // 1. Primary Method: Direct Stealth Crawling (Zero API key, direct live tweets)
        let fetchedItems = await fetchTweetsDirectStealth(handle);

        // 2. Secondary Fallback: RapidAPI if configured and direct crawl had 0 items
        if (fetchedItems.length === 0) {
            fetchedItems = await fetchTweetsFromRapidAPI(handle);
        }

        const now = Date.now();
        const past16Hours = 16 * 60 * 60 * 1000; // Strictly 16 hours cutoff (replaces 48 hours)

        let validFetchedItems = fetchedItems.filter(item => {
            if (!item.date) return false;
            const diff = now - item.date.getTime();
            return diff <= past16Hours && diff >= -3600000;
        });

        // Combine multi-part threads (e.g. 1/4, 2/4, 3/4, 4/4 or 1/1, 1/2, 1/3, 1/4) into single unified news stories
        validFetchedItems = groupTweetsIntoThreads(validFetchedItems);

        validFetchedItems.sort((a, b) => b.date.getTime() - a.date.getTime());
        fetchedItems = validFetchedItems.slice(0, 5);

        if (fetchedItems.length > 0) {
            const allTweetUrlsToCheck = [];
            for (const item of fetchedItems) {
                if (item.allUrls && item.allUrls.length > 0) {
                    allTweetUrlsToCheck.push(...item.allUrls);
                } else {
                    allTweetUrlsToCheck.push(item.url);
                }
            }
            const seenUrls = await isUrlAlreadyScanned(allTweetUrlsToCheck);

            const batch = db.batch();

            for (const item of fetchedItems) {
                if (batchCount >= 3) break;
                // If main URL or all thread parts were already scanned, skip
                if (seenUrls.has(item.url) || (item.allUrls && item.allUrls.every(u => seenUrls.has(u)))) continue;

                const prompt = `You are a Senior Telugu Journalist and Political News Editor for a reputed mainstream news network.
Evaluate this social media post from a political leader or official handle:

EDITORIAL FILTER RULES:
1. ACCEPT & PRIORITIZE (Set "isRelevant": true):
   - Political Allegations & Counter-Allegations (రాజకీయ ఆరోపణలు, ప్రత్యారోపణలు, విమర్శలు, సవాళ్లు, కౌంటర్లు): Criticisms leveled by leaders against governments, rival parties, or policy decisions (e.g. corruption charges, budget/debts, scheme implementation, farmer issues, governance failures).
   - Government decisions, cabinet meetings, welfare schemes, development projects, official GOs.
   - Public statements, press meets, crisis responses (floods, law & order, public welfare), or official party decisions.

2. REJECT (Set "isRelevant": false) ONLY IF:
   - Contains vulgar abuse, unparliamentary/filthy language, or purely cheap personal slander with zero public context.
   - Pure internet troll memes, morphed photos, or anonymous parody jokes with no official statement.
   - Purely routine personal greetings ("Happy Birthday bro", casual wishes without any public or social message).
   - Commercial ads, product promotions, spam.

WRITING RULES (CRITICAL EDITORIAL STYLE):
1. PRESERVE ORIGINAL INTENSITY & EMOTION (ట్వీట్లోని భావాన్ని, ఇంటెన్సిటీని ఏమాత్రం తగ్గించవద్దు):
   - Do NOT water down or dilute the leader's fighting spirit, anger, sarcasm, challenge, or intensity.
   - Capture the exact emotion (ఘాటు విమర్శ, ఆగ్రహం, నిలదీత, సవాల్, ఆవేదన, హెచ్చరిక) faithfully in Telugu.
2. PUNCH DIALOGUE IN HEADLINE (ట్వీట్లోని పంచ్ డైలాగ్‌నే హెడ్‌లైన్‌గా మార్చు):
   - Identify the sharpest, most powerful punch line, quote, or rhetorical question from the tweet.
   - Format the Telugu headline to lead with this punch dialogue in quotes or as the central hook:
     Examples:
     * "'సూపర్ సిక్స్ ఏమైంది?.. ప్రజలను దగా చేశారు': కూటమి సర్కార్‌పై జగన్ ఫైర్"
     * "'నోరు అదుపులో పెట్టుకోకపోతే ఖబడ్దార్!': వైసీపీ నేతలకు లోకేష్ స్ట్రాంగ్ వార్నింగ్"
     * "'హామీలు గాల్లో కలిపేశారు.. ఇదేనా మీ మార్పు?': రేవంత్ సర్కార్‌పై కేటీఆర్ ఘాటు వ్యాఖ్యలు"
   - Headline length: 6-12 words in Telugu, high-voltage, sensational yet authentic to the tweet.
3. SUMMARY (సారాంశం):
   - Approx 60 words in crisp, powerful Telugu preserving the exact arguments, punch points, and context.

Output JSON only:
{"isRelevant": true|false, "headline": "Telugu Title", "content": "Telugu Summary", "headlineEn": "English Title", "contentEn": "English Summary", "location": "Location", "storyFingerprint": "subject-action-words", "refinedCategory": "Category", "tags": [], "entities": {"people":[], "organizations":[], "locations":[]}, "mediaUrl": "url", "mediaType": "image", "isWide": false}`;

                const aiResult = await processWithGemini(item.text, prompt, item.mediaUrl);
                if (!aiResult) continue;

                try {
                    const parsed = JSON.parse(aiResult.replace(/```json|```/g, '').trim());
                    if (!parsed.isRelevant || !parsed.headline || !parsed.content) {
                        console.log(`[TWITTER] ⏭️ Filtered out non-news/satirical post for @${handle}: "${(item.text || '').substring(0, 45).replace(/\n/g, ' ')}..."`);
                        await markUrlAsProcessed(item.url);
                        continue;
                    }

                    // 1. Headline similarity deduplication
                    if (parsed.headline) {
                        const isDupHeadline = recentHeadlinesMemoryCache.some(cachedHeadline => {
                            return calculateTextSimilarity(parsed.headline, cachedHeadline) >= 0.70;
                        });
                        if (isDupHeadline) {
                            console.log(`[TWITTER] ⏭️ Duplicate story (headline similarity hit) for @${handle}: "${parsed.headline}"`);
                            await markUrlAsProcessed(item.url);
                            continue;
                        }
                    }

                    // 2. Deduplication via storyFingerprint
                    if (parsed.storyFingerprint) {
                        if (storyFingerprintMemoryCache.has(parsed.storyFingerprint)) {
                            console.log(`[TWITTER] ⏭️ Duplicate story (memory hit): ${parsed.storyFingerprint}`);
                            await markUrlAsProcessed(item.url);
                            continue;
                        }

                        // Query Firestore using single-field index on storyFingerprint (no composite index needed)
                        const duplicate = await db.collection('news')
                            .where('storyFingerprint', '==', parsed.storyFingerprint)
                            .limit(1)
                            .get();

                        if (!duplicate.empty) {
                            storyFingerprintMemoryCache.add(parsed.storyFingerprint);
                            console.log(`[TWITTER] ⏭️ Duplicate story (Firestore hit): ${parsed.storyFingerprint}`);
                            await markUrlAsProcessed(item.url);
                            continue;
                        }
                        storyFingerprintMemoryCache.add(parsed.storyFingerprint);
                    }

                    const reporter = getRandomReporter();
                    const category = parsed.refinedCategory || feed.category || 'Politics';
                    let finalDistrict = GLOBAL_CATEGORIES.includes(category) ? category : (feed.district || "General");

                    let finalMediaUrl = ALFA_NEWS_LOGO;
                    const rawMedia = (item.mediaUrl && item.mediaUrl.startsWith('http')) ? item.mediaUrl : 
                                     ((item.avatarUrl && item.avatarUrl.startsWith('http')) ? item.avatarUrl : 
                                     ((parsed.mediaUrl && parsed.mediaUrl.startsWith('http')) ? parsed.mediaUrl : null));
                    if (rawMedia && !isGenericImage(rawMedia)) {
                        finalMediaUrl = `https://wsrv.nl/?url=${encodeURIComponent(rawMedia)}&output=webp`;
                    }

                    const docRef = db.collection('news').doc();
                    const newsPayload = sanitizeFirestoreData({
                        headline: { telugu: parsed.headline, english: parsed.headlineEn || '' },
                        content: { telugu: parsed.content, english: parsed.contentEn || '' },
                        sourceUrl: item.url,
                        originalUrl: item.url,
                        sourceName: feed.sourceName || `X (@${handle})`,
                        category: category,
                        categories: [...new Set([feed.sourceName || `X (@${handle})`, category, "Social", "రాజకీయం", "ముఖ్యాంశాలు"])].filter(Boolean),
                        tags: parsed.tags || [],
                        entities: parsed.entities || { people: [], organizations: [], locations: [] },
                        district: finalDistrict || "General",
                        state: feed.state || null,
                        mandal: feed.mandal || null,
                        location: parsed.location || feed.district || 'General',
                        storyFingerprint: parsed.storyFingerprint || '',
                        mediaUrl: finalMediaUrl,
                        mediaType: item.mediaType || 'image',
                        postFormat: '16:9',
                        language: 'te',
                        type: 'news',
                        isGlobal: true,
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

                    batch.set(docRef, newsPayload);
                    console.log(`[TWITTER] 🐦 Prepared ${item.isThread ? `thread (${item.threadCount} parts)` : 'tweet'} for @${handle}: "${parsed.headline}"`);
                    const urlsToMark = item.allUrls && item.allUrls.length > 0 ? item.allUrls : [item.url];
                    for (const u of urlsToMark) {
                        await markUrlAsProcessed(u);
                    }
                    if (parsed.headline) recentHeadlinesMemoryCache.push(parsed.headline);
                    if (parsed.storyFingerprint) storyFingerprintMemoryCache.add(parsed.storyFingerprint);
                    batchCount++;
                } catch (e) {}
            }

            if (batchCount > 0) {
                await batch.commit();
                console.log(`[TWITTER] Committed ${batchCount} tweets for @${handle}`);
            }
        }
        await doc.ref.update({
            lastFetchTime: admin.firestore.FieldValue.serverTimestamp(),
            lastStatus: 'active',
            lastError: null,
            totalProcessedCount: admin.firestore.FieldValue.increment(batchCount),
            todayProcessedCount: admin.firestore.FieldValue.increment(batchCount)
        }).catch(err => console.warn(`Could not update stats for @${handle}:`, err.message));
    } catch (error) {
        console.error(`Error processing Twitter @${handle}:`, error.message);
        await doc.ref.update({
            lastFetchTime: admin.firestore.FieldValue.serverTimestamp(),
            lastStatus: 'error',
            lastError: error.message,
            totalFailedCount: admin.firestore.FieldValue.increment(1)
        }).catch(() => {});
    }
}

// ============================================================================
// OPERATING HOURS & NIGHT CUTOFF (IST 4:00 AM to 10:00 PM)
// ============================================================================
function isOperatingHours() {
    const kolkataStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const kolkataDate = new Date(kolkataStr);
    const hour = kolkataDate.getHours();
    // Strictly allowed from 04:00 AM to 22:00 (10:00 PM) IST.
    // At or after 22:00 (10:00 PM), and before 04:00 (4:00 AM), the scraper MUST NOT run.
    return hour >= 4 && hour < 22;
}

// ============================================================================
// SCHEDULER (QUEUE SYSTEM)
// ============================================================================
let isScraping = false;
let lastScrapeStartTime = 0;

async function runScraperQueue() {
    if (!isOperatingHours()) {
        const currentIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        console.log(`[SCHEDULE] 🛑 Outside operating hours (04:00 AM to 10:00 PM IST). Current IST: ${currentIST}. Scraper is halted for the night.`);
        return;
    }

    if (isScraping) {
        if (Date.now() - lastScrapeStartTime > 45 * 60 * 1000) {
            console.log("Scraping seems stuck for over 45 mins. Force resetting...");
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
        console.log("Fetching active sources for interleaved scraping...");
        
        const webSnapshot = await db.collection('scraping_sources').where('isPaused', '==', false).get();
        const webDocs = [...webSnapshot.docs];

        const twitterSnapshot = await db.collection('social_feeds').get();
        const twitterDocs = twitterSnapshot.docs.filter(doc => {
            const data = doc.data();
            if (data.isPaused === true) return false;
            const platform = (data.platform || '').toLowerCase();
            return !platform || platform === 'twitter' || platform === 'x';
        });

        // Prioritize feeds that have never been fetched (null/missing lastFetchTime) or were fetched longest ago
        twitterDocs.sort((a, b) => {
            const timeA = a.data().lastFetchTime ? (a.data().lastFetchTime.toMillis ? a.data().lastFetchTime.toMillis() : (a.data().lastFetchTime._seconds ? a.data().lastFetchTime._seconds * 1000 : 0)) : 0;
            const timeB = b.data().lastFetchTime ? (b.data().lastFetchTime.toMillis ? b.data().lastFetchTime.toMillis() : (b.data().lastFetchTime._seconds ? b.data().lastFetchTime._seconds * 1000 : 0)) : 0;
            return timeA - timeB;
        });

        console.log(`Found ${webDocs.length} Web sources and ${twitterDocs.length} Twitter feeds.`);

        while (webDocs.length > 0 || twitterDocs.length > 0) {
            // Cutoff guard: Stop immediately if clock strikes 10:00 PM IST (22:00)
            if (!isOperatingHours()) {
                const currentIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
                console.log(`[SCHEDULE] 🛑 10:00 PM IST cutoff reached! Halting scraper queue immediately (Current IST: ${currentIST}).`);
                break;
            }

            // Process 1 Twitter feed
            if (twitterDocs.length > 0) {
                const tDoc = twitterDocs.shift();
                try {
                    await Promise.race([
                        processSingleTwitterFeed(tDoc),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Twitter Timeout')), 300000))
                    ]);
                } catch (e) {
                    console.error(`Error processing twitter ${tDoc.id}:`, e.message);
                }
            }

            // Process 2 Web sources
            for (let i = 0; i < 2 && webDocs.length > 0; i++) {
                // Cutoff guard check before each web source
                if (!isOperatingHours()) {
                    const currentIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
                    console.log(`[SCHEDULE] 🛑 10:00 PM IST cutoff reached! Halting scraper queue immediately (Current IST: ${currentIST}).`);
                    break;
                }

                const wDoc = webDocs.shift();
                try {
                    await Promise.race([
                        processSingleWebSource(wDoc),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Web Timeout')), 300000))
                    ]);
                } catch (e) {
                    console.error(`Error processing web source ${wDoc.id}:`, e.message);
                }
            }
        }
        console.log("Finished Interleaved Scraping Queue.");
    } catch (error) {
        console.error("Queue Error:", error);
    } finally {
        isScraping = false;
        // Clean up any idle shared browser to release memory
        await closeSharedBrowser();
    }
}

// Schedule to run every 2 hours between 4:00 AM and 8:00 PM IST (Cutoff at 10:00 PM IST)
// Cron triggers at: 04:00, 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00 IST
cron.schedule('0 4-20/2 * * *', () => {
    console.log("Cron triggered runScraperQueue (IST 4AM-8PM Every 2h)");
    runScraperQueue();
}, {
    timezone: "Asia/Kolkata"
});

console.log("VPS Scraper Started. Waiting for cron schedule...");

// Run once on startup if strictly within IST 4 AM - 10 PM
if (isOperatingHours()) {
    const currentIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    console.log(`Starting initial scraper run (Current IST: ${currentIST})`);
    runScraperQueue();
} else {
    const currentIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    console.log(`Skipping initial run. Outside allowed IST hours (04:00 AM - 10:00 PM IST, Current IST: ${currentIST})`);
}

module.exports = {
    runScraperQueue,
    processSingleWebSource,
    processSingleTwitterFeed,
    isOperatingHours
};
