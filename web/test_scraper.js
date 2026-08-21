require('dotenv').config();
const admin = require('firebase-admin');
const cron = require('node-cron');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');
const { exec } = require('child_process');

puppeteerExtra.use(StealthPlugin());
const rssParser = new Parser();

// Initialize Firebase Admin SDK
try {
    const serviceAccount = require('./firebase-service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: "alfa-news-31bf7.appspot.com"
    });
    console.log("Firebase Admin Initialized Successfully.");
} catch (error) {
    console.error("Failed to initialize Firebase Admin. Please ensure firebase-service-account.json exists.", error);
    process.exit(1);
}

const db = admin.firestore();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============================================================================
// UTILITIES & CLEANUP
// ============================================================================
function forceCleanTempFiles() {
    exec('rm -rf /tmp/puppeteer* && pkill -f "chrome"', (err) => {
        if (err) {
            return;
        }
        console.log('Cleaned up temp files and zombie chrome processes.');
    });
}

async function updateStats(sourceName, stats) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const statRef = db.collection('scraping_stats').doc(`${sourceName}_${today}`);
        await statRef.set({
            sourceName,
            date: today,
            found: admin.firestore.FieldValue.increment(stats.found || 0),
            newLinks: admin.firestore.FieldValue.increment(stats.newLinks || 0),
            saved: admin.firestore.FieldValue.increment(stats.saved || 0),
            errors: admin.firestore.FieldValue.increment(stats.errors || 0),
            lastRun: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error('Error updating stats:', e);
    }
}

function isInvalidImage(url) {
    if (!url) return true;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('logo') || lowerUrl.includes('default') || lowerUrl.includes('icon') || lowerUrl.includes('avatar')) {
        return true;
    }
    if (lowerUrl.endsWith('.svg') || lowerUrl.endsWith('.gif')) {
        return true;
    }
    return false;
}

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

// ============================================================================
// PUPPETEER OPTIMIZATION (Memory & Speed)
// ============================================================================
async function fetchHtmlOptimized(url) {
    let browser = null;
    try {
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

    try {
        browser = await puppeteerExtra.launch({
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--disable-gpu', 
                '--no-zygote', 
                '--single-process',
                '--disable-extensions'
            ]
        });

        const page = await browser.newPage();
        
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
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const html = await page.content();
        return html;
    } catch (err) {
        console.error(`Puppeteer failed for ${url}:`, err.message);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

// ============================================================================
// GEMINI AI PROCESSING
// ============================================================================
async function processWithGemini(text, prompt, retries = 3) {
    // 429 Quota Exceeded ఎర్రర్ రాకుండా ఉండటానికి ప్రతి రిక్వెస్ట్ కి ముందు 4 సెకన్ల గ్యాప్ (నిమిషానికి 15 రిక్వెస్ట్ ల లిమిట్ కోసం)
    await new Promise(resolve => setTimeout(resolve, 4000));

    for (let i = 0; i < retries; i++) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `${prompt}\n\nText:\n${text}`,
                config: {
                    temperature: 0.4,
                }
            });
            return response.text.trim();
        } catch (error) {
            const errorMsg = error.message || "";
            if (errorMsg.includes('503') || errorMsg.includes('overloaded') || errorMsg.includes('high demand') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
                console.log(`Gemini busy or rate limited (429/503), retry ${i + 1}/${retries} after delay...`);
                await new Promise(resolve => setTimeout(resolve, 5000 * (i + 1)));
                continue;
            }
            console.error("Gemini API Error:", error.message);
            return null;
        }
    }
    return null;
}

// ============================================================================
// SCRAPING LOGIC: WEB SOURCES
// ============================================================================
async function processSingleWebSource(doc) {
    const source = doc.data();
    console.log(`Processing Web Source: ${source.siteName}`);
        let stats = { found: 0, newLinks: 0, saved: 0, errors: 0 };
        
        try {
            const html = await fetchHtmlOptimized(source.url);
            if (!html) {
                stats.errors++;
                await updateStats(source.siteName, stats);
                return;
            }

            const $ = cheerio.load(html);
            const links = [];
            
            const sourceUrlObj = new URL(source.url);
            const pathSegments = sourceUrlObj.pathname.split('/').filter(Boolean);
            const keyword = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1].toLowerCase() : '';

            $('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href && href.length > 15) {
                    try {
                        const absoluteUrl = href.startsWith('http') ? href : new URL(href, source.url).href;
                        
                        if (absoluteUrl.includes(sourceUrlObj.hostname.replace('www.', ''))) {
                            if (!keyword || absoluteUrl.toLowerCase().includes(keyword)) {
                                if (absoluteUrl !== source.url && absoluteUrl !== source.url + '/') {
                                    links.push(absoluteUrl);
                                }
                            }
                        }
                    } catch (e) {}
                }
            });

            const uniqueLinks = [...new Set(links)];
            stats.found = uniqueLinks.length;
            
            const newLinks = [];
            for (const link of uniqueLinks) {
                const existing = await db.collection('news').where('sourceUrl', '==', link).limit(1).get();
                if (existing.empty) {
                    newLinks.push(link);
                }
            }
            stats.newLinks = newLinks.length;
            
            console.log(`[WEB] Found ${uniqueLinks.length} total valid links on page for ${source.siteName}`);
            console.log(`[WEB] ${newLinks.length} are new. Processing up to 10 articles.`);

            const linksToProcess = newLinks.slice(0, 10);
            
            for (const link of linksToProcess) {
                console.log(`Scraping article: ${link}`);
                const articleHtml = await fetchHtmlOptimized(link);
                if (!articleHtml) {
                    stats.errors++;
                    continue;
                }

                const $article = cheerio.load(articleHtml);
                
                // Image Validation
                let imageUrl = $article('meta[property="og:image"]').attr('content') || $article('img').first().attr('src');
                if (imageUrl && !imageUrl.startsWith('http')) {
                    try {
                        imageUrl = new URL(imageUrl, link).href;
                    } catch (e) {}
                }

                if (isInvalidImage(imageUrl)) {
                    console.log(`Skipping article due to invalid/missing image: ${link}`);
                    continue;
                }

                // Age Validation
                const publishedTime = $article('meta[property="article:published_time"]').attr('content') || $article('time').attr('datetime');
                if (publishedTime) {
                    const pubDate = new Date(publishedTime);
                    const now = new Date();
                    const diffHours = (now - pubDate) / (1000 * 60 * 60);
                    if (diffHours > 24) {
                        console.log(`Skipping old article: ${link}`);
                        continue;
                    }
                }

                $article('nav, header, footer, script, style, .ads, .sidebar, .comments, .related, .tags, aside, .widget, .promo').remove();
                
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

                if (articleText.length < 200) continue;

                const prompt = `You are a Senior Journalist.
                1. Evaluate if this news article is a valid news update.
                2. Constraints: వచ్చిన కంటెంట్ లోని వ్యక్తులు, ప్రాంతం మిస్ అవ్వకుండా, వార్త యొక్క భావం మారకుండా, ఒక సీనియర్ న్యూస్ ఎడిటర్ మాదిరిగా ఒకే పేరాగ్రాఫ్ లో వార్త రాయాలి. Content must be approximately 60 words in Telugu.
                   CRITICAL TONE & PUNCH LOGIC (పంచ్ డైలాగ్స్ రూల్): వచ్చిన వార్త కంటెంట్ లో ఉన్న సంచలన వ్యాఖ్యలు, రాజకీయ విమర్శలు, నాయకులు వాడిన బలమైన లేదా ఘాటైన పంచ్ డైలాగులు (punchy political criticisms, emotional/sensational dialogues, and strong statements) ఎట్టి పరిస్థితుల్లోనూ వదిలిపెట్టవద్దు. వార్తను సాదాసీదాగా లేదా చప్పగా మార్చవద్దు! ఆ సంచలన పంచ్ డైలాగులను/వ్యాఖ్యలను వార్త సారాంశం (Telugu content summary) మరియు హెడ్లైన్ (headline) లలో చాలా స్పష్టంగా, ఉత్తేజకరంగా మరియు ఆకర్షణీయంగా ఉండేలా యథాతథంగా లేదా మరింత పదునుగా హైలైట్ చేయాలి. చదువరులను ఆkట్టుకునేలా వార్త ఘాటుగా ఉండాలి కానీ చప్పగా ఉండకూడదు.
                CRITICAL: Write as if YOU are the reporter breaking the news. State the facts directly.
                3. Headline must be a PUNCHY single sentence around 6-10 words in Telugu.
                4. Identify the primary location of the news. If no specific city is found, use a relevant state or 'General'.
                5. Create a unique storyFingerprint based on the core fact (e.g., "eric-dane-death"). It must be EXACTLY 3 words joined by hyphens, focusing ONLY on the main subject and action.
                6. Classification & Tagging:
                   - refinedCategory: Classify into one of: Politics, Crime, Sports, Entertainment, Business, Health, Education, Technology, Agriculture, Local.
                   - tags: Extract 3-5 relevant keywords in Telugu.
                   - entities: Identify People (వ్యక్తులు), Organizations (సంస్థలు), and Locations (ప్రాంతాలు) mentioned in the news.
                7. Output JSON only. Format as JSON: {"isRelevant": true, "headline": "Telugu Title", "content": "Telugu Summary", "headlineEn": "English Title", "contentEn": "English Summary", "location": "Location", "storyFingerprint": "finger-print-here", "refinedCategory": "Category", "tags": ["tag1", "tag2"], "entities": {"people": [], "organizations": [], "locations": []}}`;
                
                const aiResult = await processWithGemini(articleText, prompt);
                
                if (aiResult) {
                    try {
                        const parsed = JSON.parse(aiResult.replace(/```json|```/g, '').trim());
                        if (parsed.isRelevant && parsed.headline && parsed.content) {
                            const reporter = getRandomReporter();
                            const category = parsed.refinedCategory || source.category || 'General';
                            let finalDistrict = ["Cinema", "Sports", "Health", "Food", "National", "International"].includes(category) ? category : "General";
                            
                            const categoriesList = [source.siteName, category];
                            
                            await db.collection('news').add({
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
                                mediaUrl: imageUrl,
                                mediaType: 'image',
                                postFormat: '16:9',
                                language: 'te',
                                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                                publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                status: 'published',
                                viewCount: 0,
                                likes: 0,
                                comments: 0,
                                shares: 0,
                                reporter: { id: reporter.id, name: reporter.name }
                            });
                            console.log(`Saved: ${parsed.headline}`);
                            stats.saved++;
                        }
                    } catch (e) {
                        console.error("Failed to parse Gemini JSON:", e.message);
                        stats.errors++;
                    }
                }
            }
            
            await doc.ref.update({ lastFetchTime: admin.firestore.FieldValue.serverTimestamp() });
            await updateStats(source.siteName, stats);
        } catch (error) {
            console.error(`Error processing ${source.siteName}:`, error.message);
            stats.errors++;
            await updateStats(source.siteName, stats);
        }
}

// ============================================================================
// DYNAMIC NITTER & RSSHUB MONITORING AND RETRIEVAL
// ============================================================================
async function getWorkingTwitterInstances() {
    const defaultRsshub = [
        'https://rsshub.rssbuddy.xyz',
        'https://rsshub.moeyy.cn',
        'https://rsshub.atest.fans',
        'https://rsshub.app',
        'https://rsshub.rssforever.com',
        'https://rsshub.mxd.moe'
    ];
    const defaultNitter = [
        'https://nitter.privacydev.net',
        'https://nitter.cx',
        'https://nitter.cz',
        'https://nitter.poast.org',
        'https://nitter.unixfox.eu',
        'https://nitter.projectsegfaut.im',
        'https://nitter.no-logs.com',
        'https://nitter.rawbit.ninja',
        'https://nitter.altgr.xyz',
        'https://nitter.esmailelbob.xyz',
        'https://nitter.manasiwibhute.com'
    ];

    try {
        const docRef = db.collection('settings').doc('twitter_scraper');
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            const lastUpdated = data.last_updated ? data.last_updated.toDate().getTime() : 0;
            // Cache for 45 minutes
            if (Date.now() - lastUpdated < 45 * 60 * 1000 && data.rsshub_instances?.length > 0 && data.nitter_instances?.length > 0) {
                console.log('[TWITTER] Using cached working instances from Firestore.');
                return {
                    rsshub: data.rsshub_instances,
                    nitter: data.nitter_instances
                };
            }
        }
    } catch (e) {
        console.error('[TWITTER] Firestore cache lookup failed:', e.message);
    }

    console.log('[TWITTER] Firestore cache outdated/empty. Testing Nitter and RSSHub instances dynamically...');
    const rsshubResults = [];
    const nitterResults = [];

    // Run RSSHub tests in parallel
    const rsshubPromises = defaultRsshub.map(async (url) => {
        try {
            const res = await axios.get(url, {
                timeout: 3000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                validateStatus: (status) => status >= 200 && status < 400
            });
            if (res.status >= 200 && res.status < 400) {
                rsshubResults.push(url);
            }
        } catch (err) {
            // Suppressed
        }
    });

    // Run Nitter tests in parallel
    const nitterPromises = defaultNitter.map(async (url) => {
        try {
            const res = await axios.get(url, {
                timeout: 3000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                validateStatus: (status) => status >= 200 && status < 400
            });
            if (res.status >= 200 && res.status < 400) {
                nitterResults.push(url);
            }
        } catch (err) {
            // Suppressed
        }
    });

    await Promise.all([...rsshubPromises, ...nitterPromises]);

    // Ensure we have at least some fallbacks
    const finalRsshub = rsshubResults.length > 0 ? rsshubResults : defaultRsshub.slice(0, 3);
    const finalNitter = nitterResults.length > 0 ? nitterResults : defaultNitter.slice(0, 3);

    console.log(`[TWITTER] Verified instances dynamically. RSSHub active: ${rsshubResults.length}, Nitter active: ${nitterResults.length}`);

    try {
        await db.collection('settings').doc('twitter_scraper').set({
            rsshub_instances: finalRsshub,
            nitter_instances: finalNitter,
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error('[TWITTER] Failed to save verified instances to Firestore:', e.message);
    }

    return {
        rsshub: finalRsshub,
        nitter: finalNitter
    };
}

// ============================================================================
// SCRAPING LOGIC: TWITTER / SOCIAL FEEDS using Apify
// ============================================================================
async function processSingleTwitterFeed(doc) {
    const feed = doc.data();
    if (feed.platform !== 'Twitter' && feed.platform !== 'X') {
        return;
    }
    console.log(`Processing Twitter Feed via free syndication: ${feed.sourceName || feed.url}`);
    let stats = { found: 0, newLinks: 0, saved: 0, errors: 0 };
        
    let handle = feed.url.trim();
    if (handle.startsWith('@')) handle = handle.substring(1);
    else if (handle.includes('twitter.com/')) handle = handle.split('twitter.com/')[1].split('/')[0].split('?')[0];
    else if (handle.includes('x.com/')) handle = handle.split('x.com/')[1].split('/')[0].split('?')[0];

    try {
        let fetchedItems = [];
        let fetchSuccess = false;

        // Fetch dynamic working instances
        const { rsshub: mirrors, nitter: nitters } = await getWorkingTwitterInstances();

        // Alternate RSSHub and Nitter to prioritize and distribute the load gracefully
        const allInstancesTest = [];
        const maxLength = Math.max(mirrors.length, nitters.length);
        for (let idx = 0; idx < maxLength; idx++) {
            if (idx < mirrors.length) {
                allInstancesTest.push({ type: 'rsshub', url: mirrors[idx] });
            }
            if (idx < nitters.length) {
                allInstancesTest.push({ type: 'nitter', url: nitters[idx] });
            }
        }

        // Loop through the alternating pool of working RSSHub mirrors and Nitter instances
        for (const instance of allInstancesTest) {
            try {
                if (instance.type === 'rsshub') {
                    const feedUrl = `${instance.url}/twitter/user/${handle}`;
                    console.log(`[TWITTER] Trying RSSHub mirror for ${handle}: ${feedUrl}`);
                    
                    const rssFeed = await rssParser.parseURL(feedUrl);
                    if (rssFeed && rssFeed.items && rssFeed.items.length > 0) {
                        console.log(`[TWITTER] Successfully structuralized ${rssFeed.items.length} items from RSSHub: ${instance.url}`);
                        
                        for (const item of rssFeed.items) {
                            const tweetUrl = item.link || '';
                            if (!tweetUrl) continue;
                            
                            const contentHtml = item.content || item['content:encoded'] || '';
                            const $ = cheerio.load(contentHtml);
                            
                            $('img').each((_, el) => {
                                const src = $(el).attr('src') || '';
                                if (src.includes('twemoji') || src.includes('profile_images')) {
                                    $(el).remove();
                                }
                            });
                            
                            const text = $.text().trim() || item.title || "";
                            let mediaUrl = null;
                            let mediaType = 'image';
                            
                            const videoElement = $('video');
                            const imgElement = $('img');
                            
                            if (videoElement.length > 0 && videoElement.attr('src')) {
                                mediaUrl = videoElement.attr('src');
                                mediaType = 'video';
                            } else if (imgElement.length > 0 && imgElement.attr('src')) {
                                mediaUrl = imgElement.attr('src');
                                mediaType = 'image';
                            }
                            
                            fetchedItems.push({
                                text: text,
                                url: tweetUrl,
                                mediaUrl,
                                mediaType,
                                date: item.pubDate ? new Date(item.pubDate) : new Date()
                            });
                        }
                        
                        if (fetchedItems.length > 0) {
                            fetchSuccess = true;
                            break;
                        }
                    }
                } else if (instance.type === 'nitter') {
                    const feedUrl = `${instance.url}/${handle}/rss`;
                    console.log(`[TWITTER] Trying Nitter instance for ${handle}: ${feedUrl}`);
                    
                    const rssFeed = await rssParser.parseURL(feedUrl);
                    if (rssFeed && rssFeed.items && rssFeed.items.length > 0) {
                        console.log(`[TWITTER] Successfully structuralized ${rssFeed.items.length} items from Nitter: ${instance.url}`);
                        
                        for (const item of rssFeed.items) {
                            let tweetUrl = item.link || '';
                            if (!tweetUrl) continue;
                            
                            // Reconstruct pure standard x.com/twitter status URL from Nitter URL
                            if (tweetUrl.includes('/status/')) {
                                const parts = tweetUrl.split('/status/');
                                if (parts.length === 2 && parts[0].includes('//')) {
                                    const domainParts = parts[0].split('//')[1].split('/');
                                    const username = domainParts[domainParts.length - 1] || handle;
                                    const statusId = parts[1].split('#')[0].split('?')[0];
                                    tweetUrl = `https://x.com/${username}/status/${statusId}`;
                                }
                            }
                            
                            const contentHtml = item.content || item['content:encoded'] || '';
                            const $ = cheerio.load(contentHtml);
                            
                            let mediaUrl = null;
                            let mediaType = 'image';
                            
                            const imgElements = $('img');
                            if (imgElements.length > 0) {
                                const firstImg = imgElements.first();
                                const src = firstImg.attr('src') || '';
                                if (src && !src.includes('profile_images') && !src.includes('twemoji')) {
                                    // Reconstruct original Twitter CDN image
                                    if (src.includes('/pic/media%2F') || src.includes('/pic/media/')) {
                                        const mediaPart = src.split(/\/pic\/media%2F|\/pic\/media\//)[1];
                                        if (mediaPart) {
                                            mediaUrl = `https://pbs.twimg.com/media/${decodeURIComponent(mediaPart.split('?')[0].split('&')[0])}`;
                                        }
                                    } else if (src.includes('/pic/orig%2F') || src.includes('/pic/orig/')) {
                                        const origPart = src.split(/\/pic\/orig%2F|\/pic\/orig\//)[1];
                                        if (origPart) {
                                            mediaUrl = `https://pbs.twimg.com/media/${decodeURIComponent(origPart.split('?')[0].split('&')[0])}`;
                                        }
                                    } else if (src.startsWith('http')) {
                                        mediaUrl = src;
                                    }
                                }
                            }
                            
                            $('img').remove();
                            const text = $.text().trim() || item.title || "";
                            
                            fetchedItems.push({
                                text: text,
                                url: tweetUrl,
                                mediaUrl,
                                mediaType,
                                date: item.pubDate ? new Date(item.pubDate) : new Date()
                            });
                        }
                        
                        if (fetchedItems.length > 0) {
                            fetchSuccess = true;
                            break;
                        }
                    }
                }
            } catch (err) {
                // Highly suppressed error logs to minimize cloud logging bills as requested
            }
        }

        // Method 2: Fall back to standard Twitter syndication if mirrors failed
        if (!fetchSuccess) {
            try {
                console.log(`[TWITTER] RSSHub and Nitter mirrors yielded no result for @${handle}. Falling back to syndication.`);
                const timelineUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`;
                const synRes = await fetch(timelineUrl, {
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
                    }
                });

                if (synRes.ok) {
                    const html = await synRes.text();
                    const $ = cheerio.load(html);
                    const nextData = $('#__NEXT_DATA__').html();
                    if (nextData) {
                        const synData = JSON.parse(nextData);
                        const entries = synData?.props?.pageProps?.timeline?.entries || [];
                        
                        for (const entry of entries) {
                            if (entry.type === 'tweet') {
                                const tweet = entry.content?.tweet;
                                if (tweet) {
                                    let mediaUrl = null;
                                    let mediaType = 'image';

                                    if (tweet.entities?.media?.[0]) {
                                        const media = tweet.entities.media[0];
                                        if (media.type === 'video' || media.type === 'animated_gif') {
                                            mediaType = 'video';
                                            const variants = media.video_info?.variants?.filter((v) => v.content_type === 'video/mp4') || [];
                                            if (variants.length > 0) {
                                                mediaUrl = variants.sort((a,b) => (b.bitrate||0) - (a.bitrate||0))[0].url;
                                            }
                                        } else {
                                            mediaUrl = media.media_url_https;
                                        }
                                    }

                                    fetchedItems.push({
                                        text: tweet.full_text || tweet.text || "",
                                        url: `https://x.com/${handle}/status/${tweet.id_str}`,
                                        mediaUrl,
                                        mediaType,
                                        date: new Date(tweet.created_at)
                                    });
                                }
                            }
                        }
                        if (fetchedItems.length > 0) {
                            fetchSuccess = true;
                        }
                    }
                }
            } catch (err) {
                // Highly suppressed error logs to minimize cloud logging bills as requested
            }
        }

        // Method 3: Fall back to Apify as premium option if everything else failed
        if (!fetchSuccess && process.env.APIFY_API_TOKEN) {
            try {
                console.log(`[TWITTER] Syndication failed for @${handle}. Requesting via Apify.`);
                const response = await axios.post(`https://api.apify.com/v2/acts/apidojo~tweet-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_API_TOKEN}`, {
                    twitterHandles: [handle],
                    maxItems: 5,
                    sort: "Latest"
                }, {
                    timeout: 120000 
                });

                const items = response.data;
                if (items && Array.isArray(items) && items.length > 0) {
                    for (const item of items) {
                        const tweetUrl = item.url;
                        if (!tweetUrl) continue;
                        
                        let mediaUrl = null;
                        let mediaType = 'image';
                        
                        if (item.extendedEntities && item.extendedEntities.media && item.extendedEntities.media.length > 0) {
                            const mediaInfo = item.extendedEntities.media[0];
                            if (mediaInfo.type === 'video' || mediaInfo.type === 'animated_gif') {
                                mediaType = 'video';
                                if (mediaInfo.video_info && mediaInfo.video_info.variants) {
                                    const variants = mediaInfo.video_info.variants.filter(v => v.content_type === 'video/mp4');
                                    if (variants.length > 0) {
                                        mediaUrl = variants[0].url;
                                    }
                                }
                            } else if (mediaInfo.type === 'photo') {
                                mediaType = 'image';
                                mediaUrl = mediaInfo.media_url_https;
                            }
                        }
                        
                        fetchedItems.push({
                            text: item.fullText || item.text || "",
                            url: tweetUrl,
                            mediaUrl,
                            mediaType,
                            date: item.createdAt ? new Date(item.createdAt) : new Date()
                        });
                    }
                    if (fetchedItems.length > 0) {
                        fetchSuccess = true;
                    }
                }
            } catch (apifyErr) {
                // Highly suppressed error logs to minimize cloud logging bills as requested
            }
        }
        
        // Sort newest first
        fetchedItems.sort((a, b) => new Date(b.date) - new Date(a.date));
        fetchedItems = fetchedItems.slice(0, 3); // max 3
        
        if (fetchedItems.length > 0) {
            stats.found = fetchedItems.length;
            
            for (const item of fetchedItems) {
                const tweetUrl = item.url;
                if (!tweetUrl) continue;

                const existing = await db.collection('news').where('sourceUrl', '==', tweetUrl).limit(1).get();
                if (!existing.empty) continue;
                stats.newLinks++;

                let mediaUrl = item.mediaUrl;
                let mediaType = item.mediaType;
                if (isInvalidImage(mediaUrl)) mediaUrl = null;

                const textContent = item.text;

                const prompt = `You are a Senior Journalist.
                1. Evaluate if this social media post is a valid news update.
                2. Constraints: వచ్చిన కంటెంట్ లోని వ్యక్తులు, ప్రాంతం మిస్ అవ్వకుండా, వార్త యొక్క భావం మారకుండా, ఒక సీనియర్ న్యూస్ ఎడిటర్ మాదిరిగా ఒకే పేరాగ్రాఫ్ లో వార్త రాయాలి. Content must be approximately 60 words in Telugu.
                   CRITICAL TONE & PUNCH LOGIC (పంచ్ డైలాగ్స్ రూల్): వచ్చిన వార్త కంటెంట్ లో ఉన్న సంచలన వ్యాఖ్యలు, రాజకీయ విమర్శలు, నాయకులు వాడిన బలమైన లేదా ఘాటైన పంచ్ డైలాగులు (punchy political criticisms, emotional/sensational dialogues, and strong statements) ఎట్టి పరిస్థితుల్లోనూ వదిలిపెట్టవద్దు. వార్తను సాదాసీదాగా లేదా చప్పగా మార్చవద్దు! ఆ సంచలన పంచ్ డైలాగులను/వ్యాఖ్యలను వార్త సారాంశం (Telugu content summary) మరియు హెడ్లైన్ (headline) లలో చాలా స్పష్టంగా, ఉత్తేజకరంగా మరియు ఆకర్షణీయంగా ఉండేలా యథాతథంగా లేదా మరింత పదునుగా హైలైట్ చేయాలి. చదువరులను ఆకట్టుకునేలా వార్త ఘాటుగా ఉండాలి కానీ చప్పగా ఉండకూడదు.
                CRITICAL: Write as if YOU are the reporter breaking the news. DO NOT use phrases like "ఈ పోస్ట్ ప్రకారం", "ఈ ట్వీట్ చెబుతోంది". State the facts directly.
                3. Headline must be a PUNCHY single sentence around 6-10 words in Telugu.
                4. Identify the primary location of the news. If no specific city is found, use a relevant state or 'General'.
                5. Create a unique storyFingerprint based on the core fact. It must be EXACTLY 3 words joined by hyphens, focusing ONLY on the main subject and action.
                6. Classification & Tagging:
                   - refinedCategory: Classify into one of: Politics, Crime, Sports, Entertainment, Business, Health, Education, Technology, Agriculture, Local.
                   - tags: Extract 3-5 relevant keywords in Telugu.
                   - entities: Identify People, Organizations, and Locations mentioned.
                7. CRITICAL REJECTION CRITERIA: 
                   - If it's a personal/social meeting (e.g., meeting with family, casual greetings), it is NOT news.
                   - If it's a repost or shared content without new value, it is NOT news.
                8. Media: attached URL: ${mediaUrl || 'None'}. IF IT IS A LOGO, GENERIC ICON OR IRRELEVANT, SET mediaUrl TO "".
                9. Output JSON only. Format as JSON: {"isRelevant": true, "headline": "Telugu Title", "content": "Telugu Summary", "headlineEn": "English Title", "contentEn": "English Summary", "location": "Location", "storyFingerprint": "finger-print-here", "refinedCategory": "Category", "tags": ["tag1", "tag2"], "entities": {"people": [], "organizations": [], "locations": []}, "mediaUrl": "url", "mediaType": "image|video"}`;
                
                const aiResult = await processWithGemini(textContent, prompt);
                
                if (aiResult) {
                    try {
                        const parsed = JSON.parse(aiResult.replace(/```json|```/g, '').trim());
                        if (parsed.isRelevant && parsed.headline && parsed.content) {
                            
                            if (parsed.storyFingerprint) {
                                const duplicate = await db.collection('news')
                                    .where('storyFingerprint', '==', parsed.storyFingerprint)
                                    .where('timestamp', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
                                    .limit(1)
                                    .get();
                                if (!duplicate.empty) continue;
                            }

                            const reporter = getRandomReporter();
                            const category = parsed.refinedCategory || feed.category || 'Social';
                            let finalDistrict = ["Cinema", "Sports", "Health", "Food", "National", "International"].includes(category) ? category : "General";
                            if (category === 'స్థానిక' && feed.district) {
                                finalDistrict = feed.district;
                            }
                            
                            const categoriesList = [feed.sourceName || `X (@${handle})`, category, "Social"];
                            if (category === 'స్థానిక') {
                                categoriesList.push("Local");
                                if (feed.district) categoriesList.push(feed.district);
                                if (feed.state) categoriesList.push(feed.state);
                                if (feed.mandal) categoriesList.push(feed.mandal);
                            }
                            
                            let finalMediaUrl = null;
                            let finalMediaType = 'image';
                            if (parsed.mediaUrl && !isGenericImage(parsed.mediaUrl) && parsed.mediaUrl.startsWith('http')) {
                                finalMediaUrl = mediaType === 'video' ? mediaUrl : parsed.mediaUrl;
                                finalMediaType = mediaType;
                            }

                            await db.collection('news').add({
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
                                postFormat: '16:9',
                                language: 'te',
                                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                                publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                status: 'published',
                                approved: true,
                                viewCount: 0,
                                likes: 0,
                                comments: 0,
                                shares: 0,
                                reporter: { id: reporter.id, name: reporter.name }
                            });
                            console.log(`Saved Tweet: ${parsed.headline}`);
                            stats.saved++;
                        }
                    } catch (e) {
                        console.error("Failed to parse Tweet Gemini JSON:", e.message);
                        stats.errors++;
                    }
                }
            }
        }
        await doc.ref.update({ lastFetchTime: admin.firestore.FieldValue.serverTimestamp() });
        await updateStats(feed.sourceName || `X (@${handle})`, stats);
    } catch (error) {
        console.error(`Error processing Twitter ${handle}:`, error.message);
        stats.errors++;
        await updateStats(feed.sourceName || `X (@${handle})`, stats);
    }
}

// ============================================================================
// SCHEDULER (QUEUE SYSTEM)
// ============================================================================
let isScraping = false;

async function runScraperQueue() {
    if (isScraping) {
        console.log("Scraping already in progress. Skipping this cycle.");
        return;
    }
    
    isScraping = true;
    try {
        forceCleanTempFiles(); // Clean up before starting
        
        console.log("Fetching sources for interleaved scraping...");
        const webSnapshot = await db.collection('scraping_sources').where('isPaused', '==', false).get();
        const webDocs = [...webSnapshot.docs];
        
        const twitterSnapshot = await db.collection('social_feeds').orderBy('lastFetchTime', 'asc').limit(20).get();
        const twitterDocs = [...twitterSnapshot.docs];

        console.log(`Found ${twitterDocs.length} Twitter feeds and ${webDocs.length} Web sources.`);

        while (twitterDocs.length > 0 || webDocs.length > 0) {
            // Process 1 Twitter feed
            if (twitterDocs.length > 0) {
                const tDoc = twitterDocs.shift();
                await processSingleTwitterFeed(tDoc);
            }
            
            // Process 2 Web sources
            if (webDocs.length > 0) {
                const wDoc1 = webDocs.shift();
                await processSingleWebSource(wDoc1);
            }
            if (webDocs.length > 0) {
                const wDoc2 = webDocs.shift();
                await processSingleWebSource(wDoc2);
            }
        }
        console.log("Finished Interleaved Scraping Queue.");
    } catch (error) {
        console.error("Queue Error:", error);
    } finally {
        forceCleanTempFiles(); // Clean up after finishing
        isScraping = false;
    }
}

// Schedule to run every 30 minutes
cron.schedule('*/30 * * * *', () => {
    console.log("Cron triggered runScraperQueue");
    runScraperQueue();
});

console.log("VPS Scraper Started. Waiting for cron schedule...");
runScraperQueue();
