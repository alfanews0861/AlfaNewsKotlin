require('dotenv').config();
const admin = require('firebase-admin');
const cron = require('node-cron');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const axios = require('axios');
let HttpsProxyAgent = null;
try {
    HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;
} catch (e) {
    try {
        HttpsProxyAgent = require('https-proxy-agent');
    } catch (e2) {}
}

// ============================================================================
// PROXY POOL & USER-AGENT ROTATION (Option A + C: Anti-Bot & Stealth System)
// ============================================================================
const USER_AGENTS = [
    // Windows Chrome
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    // Windows Edge
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
    // macOS Chrome & Safari
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
    // Windows Firefox
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
    // Linux Chrome
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    // Mobile Devices
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
];

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function parseProxyString(raw) {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    if (/^[a-zA-Z0-9]+:\/\//.test(trimmed)) {
        return trimmed;
    }

    // Format: IP:Port:User:Pass (Webshare standard export format)
    const parts = trimmed.split(':');
    if (parts.length === 4) {
        const [ip, port, user, pass] = parts;
        return `http://${user}:${pass}@${ip}:${port}`;
    }
    if (parts.length === 2) {
        return `http://${parts[0]}:${parts[1]}`;
    }
    return `http://${trimmed}`;
}

function extractProxyAuth(proxyUrl) {
    if (!proxyUrl) return null;
    try {
        const parsed = new URL(proxyUrl);
        if (parsed.username && parsed.password) {
            return {
                username: decodeURIComponent(parsed.username),
                password: decodeURIComponent(parsed.password),
                host: parsed.hostname,
                port: parsed.port
            };
        }
    } catch (e) {}
    return null;
}

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.init();
    }

    init() {
        const raw = process.env.WEBSHARE_PROXIES || process.env.PROXY_LIST || process.env.WEBSHARE_PROXY_URL || process.env.PROXY_URL || '';
        if (!raw.trim()) {
            this.proxies = [];
            return;
        }

        const entries = raw.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
        this.proxies = entries.map(parseProxyString).filter(Boolean);

        if (this.proxies.length > 0) {
            console.log(`[PROXY] 🌐 Initialized ${this.proxies.length} rotating proxies.`);
        }
    }

    getNextProxy() {
        if (this.proxies.length === 0) return null;
        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
    }

    getProxyCount() {
        return this.proxies.length;
    }
}

const proxyManager = new ProxyManager();

// ============================================================================
// INLINED EXTRACTION & TEXT UTILITIES (SELF-CONTAINED STANDALONE)
// ============================================================================
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
 * Robustly sanitizes Telugu text to guarantee 100% pure Telugu script purity (Unicode U+0C00-U+0C7F).
 * Completely strips Arabic/Urdu, Devanagari/Hindi, Kannada, Tamil, Malayalam, and all other non-Telugu Indic scripts,
 * while preserving valid Telugu letters, ASCII alphanumeric characters, numbers, and standard punctuation.
 */
function sanitizeTeluguText(text) {
    if (!text) return "";
    return text
        // 0. Decode and eliminate HTML entities & zero-width non-joiners
        .replace(/&zwnj;/gi, '')
        .replace(/&zwj;/gi, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#\d+;/g, '')
        .replace(/&#x[0-9a-fA-F]+;/gi, '')
        
        // 1. Strip Arabic / Urdu / Persian / Hebrew scripts completely
        .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/g, '')
        
        // 2. Strip all non-Telugu Indic scripts (Devanagari/Hindi, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Kannada, Malayalam, Sinhala, etc.)
        .replace(/[\u0900-\u0BFF\u0C80-\u0DFF\u0E00-\u109F]/g, '')
        
        // 3. Remove dotted circle placeholder glyphs (U+25CC) and Unicode replacement characters (U+FFFD)
        .replace(/[\u25CC\uFFFD]/g, '')
        
        // 4. Remove invisible zero-width spaces that break Telugu word joining
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        
        // 5. Clean up any orphaned Telugu combining marks/matras at word start or immediately following spaces/punctuation
        .replace(/(?:^|[\s.,;:!?'"“”‘’\(\)\[\]\{\}\-\/])[\u0C01-\u0C03\u0C3E-\u0C4D\u0C55\u0C56\u0C62\u0C63]+/g, ' ')
        
        // 6. Fix any accidental spaces before valid Telugu combining marks
        .replace(/\s+([\u0C01-\u0C03\u0C3E-\u0C4D\u0C55\u0C56\u0C62\u0C63])/g, '$1')
        
        // 7. Normalize multi-spaces
        .replace(/[ \t]+/g, ' ')
        .trim();
}

/**
 * Validates if the text contains predominantly Telugu Unicode script (U+0C00 - U+0C7F).
 * @param {string} text
 * @returns {boolean}
 */
function isTeluguScript(text) {
    if (!text || typeof text !== 'string') return false;
    const teluguChars = (text.match(/[\u0C00-\u0C7F]/g) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    return teluguChars > englishChars && teluguChars >= 10;
}

/**
 * Sanitizes and cleans Telugu headlines:
 * 1. Strictly eliminates all quotation marks ('...', "...", ‘...’, “...”, `...`, \", \').
 * 2. Eliminates colon templates and multiple dots (..) to ensure ONE single continuous sentence.
 * 3. Removes leading/trailing punctuation and trims whitespace.
 * 4. Ensures 100% pure Telugu script purity via sanitizeTeluguText.
 */
function cleanTeluguHeadline(headline) {
    if (!headline || typeof headline !== 'string') return "";
    let clean = headline.trim();

    // 0. Decode and strip HTML entities
    clean = clean
        .replace(/&zwnj;/gi, '')
        .replace(/&zwj;/gi, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '')
        .replace(/&#39;|&apos;/gi, '')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#\d+;/g, '')
        .replace(/&#x[0-9a-fA-F]+;/gi, '');

    // 1. Strip all quotation marks (single, double, smart/curly quotes, backticks, backslashes)
    clean = clean.replace(/['"“‘”’`\\/]/g, '');

    // 2. Replace colons, semicolons, and multiple dots (..) with a space to prevent split clauses
    clean = clean.replace(/\s*[:;]\s*/g, ' ');
    clean = clean.replace(/\.{2,}/g, ' ');

    // 3. Remove leading or trailing hyphens, dashes, commas, dots, colons, or spaces
    clean = clean.replace(/^[\s.,:;!?'"“”‘’\-\—]+|[\s.,:;!?'"“”‘’\-\—]+$/g, '');

    // 4. Normalize multiple whitespace
    clean = clean.replace(/\s+/g, ' ').trim();

    return sanitizeTeluguText(clean);
}

/**
 * Strips quotes and colons from English headline
 */
function cleanEnglishHeadline(headline) {
    if (!headline || typeof headline !== 'string') return "";
    let clean = headline.trim();
    clean = clean.replace(/['"“‘”’`\\/]/g, '');
    clean = clean.replace(/\s*[:;]\s*/g, ' ');
    clean = clean.replace(/\.{2,}/g, ' ');
    clean = clean.replace(/^[\s.,:;!?'"“”‘’\-\—]+|[\s.,:;!?'"“”‘’\-\—]+$/g, '');
    return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Detects whether a headline or post is pure party flattery / sycophancy / verdict without attribution.
 */
function isEditorialVerdictOrFlattery(headline, text = '', authorName = '') {
    if (!headline || typeof headline !== 'string') return false;
    const h = headline.trim();
    const t = (text || '').trim();
    const a = (authorName || '').trim();

    // 1. Common flattery / self-praise / title phrases in headline
    const flatteryPhrases = [
        /ప్రజల పక్షాన నిలిచి? పోరాడే/i,
        /ప్రజల పక్షాన నిలిచే నాయక/i,
        /పేదల పెన్నిధి/i,
        /పేదల ఆశాజ్యోతి/i,
        /అభివృద్ధి ప్రదాత/i,
        /రియల్ హీరో/i,
        /ప్రజల కోసం ప్రశ్నించే గొంతు/i,
        /మా నాయకుడే/i
    ];

    const hasFlatteryInHeadline = flatteryPhrases.some(pattern => pattern.test(h));

    // Attribution markers in Telugu
    const attributionWords = [
        'అన్న', 'అని', 'పేర్కొన్న', 'చెప్పిన', 'విమర్శించిన', 'నిలదీసిన',
        'డిమాండ్ చేసిన', 'స్పష్టం చేసిన', 'హెచ్చరించిన', 'ఆగ్రహం', 'ధ్వజం',
        'సవాల్', 'వెల్లడి', 'ప్రకటన', 'ట్వీట్'
    ];
    const hasAttribution = attributionWords.some(w => h.includes(w));

    // If headline contains praise/title and lacks attribution, it's an editorial verdict!
    if (hasFlatteryInHeadline && !hasAttribution) {
        return true;
    }

    // 2. Pure PR hype / promotional slogans from political party accounts
    const isPartySource = /inc|tdp|ysrcp|brs|bjp|congress|jana\s*sena|వైసీపీ|టిడిపి|బిజెపి|కాంగ్రెస్/i.test(a) ||
                          /inc|tdp|ysrcp|brs|bjp|congress/i.test(t);
    const hasSycophancySlogans = /(?:ప్రశ్నించే గొంతు|పోరాడే నిబద్ధత|ప్రజల పక్షాన నిలిచే నాయకత్వం|మా నాయకుడే మా భవిష్యత్తు|నాయకత్వ పటిమ)/i.test(t);
    const hasRealNewsKeywords = /(?:నిర్ణయం|పథకం|బడ్జెట్|కేటాయింపు|రూపాయల|కోట్ల|హామీ|సమీక్ష|అరెస్ట్|కేసు|దాడులు|ప్రమాదం|మృతి|మరణం|ఉత్తర్వులు|జీవో|నోటిఫికేషన్|పోలీస్|రైతు|ధరలు)/i.test(t);

    if (isPartySource && hasSycophancySlogans && !hasRealNewsKeywords) {
        return true;
    }

    return false;
}

/**
 * Formats a story text into strictly 3 to 4 distinct paragraphs separated by \n\n.
 * If already separated by paragraphs, preserves them.
 * If provided as a single block or clump, intelligently splits by sentence boundaries
 * into 3 to 4 balanced paragraphs.
 */
function formatIntoParagraphs(text, targetCount = 4) {
    if (!text || typeof text !== 'string' || !text.trim()) return "";
    const clean = text.trim();

    // 1. Check if already split by double newlines (\n\n)
    const doubleNewlineParas = clean.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
    if (doubleNewlineParas.length >= 2) {
        return doubleNewlineParas.join('\n\n');
    }

    // 2. Check if split by single newlines
    const singleNewlineParas = clean.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
    if (singleNewlineParas.length >= 2) {
        return singleNewlineParas.join('\n\n');
    }

    // 3. Single text clump: split into sentences and balance into 2, 3, or strictly 4 paragraphs
    const sentences = clean.split(/(?<=[.!?।])\s*/).map(s => s.trim()).filter(s => s.length > 0);
    if (sentences.length >= 4) {
        const k = 4;
        const chunks = [];
        const baseSize = Math.floor(sentences.length / k);
        const remainder = sentences.length % k;
        let start = 0;
        for (let i = 0; i < k; i++) {
            const chunkSize = baseSize + (i < remainder ? 1 : 0);
            if (chunkSize > 0 && start < sentences.length) {
                chunks.push(sentences.slice(start, start + chunkSize).join(' '));
                start += chunkSize;
            }
        }
        return chunks.length > 0 ? chunks.join('\n\n') : clean;
    } else if (sentences.length === 3) {
        return sentences.join('\n\n');
    } else if (sentences.length === 2) {
        return sentences.join('\n\n');
    } else if (sentences.length === 1 && sentences[0].length > 180) {
        const clauses = sentences[0].split(/(?<=[,;—–])\s+/).map(c => c.trim()).filter(Boolean);
        if (clauses.length >= 3) {
            const k = 3;
            const chunks = [];
            const baseSize = Math.floor(clauses.length / k);
            const remainder = clauses.length % k;
            let start = 0;
            for (let i = 0; i < k; i++) {
                const chunkSize = baseSize + (i < remainder ? 1 : 0);
                if (chunkSize > 0 && start < clauses.length) {
                    chunks.push(clauses.slice(start, start + chunkSize).join(' '));
                    start += chunkSize;
                }
            }
            return chunks.join('\n\n');
        } else if (clauses.length === 2) {
            return clauses.join('\n\n');
        }
    }

    return clean;
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
 * Detects if a tweet text is truncated by Twitter (e.g. ends with ellipsis or Show more).
 * @param {string} text 
 * @returns {boolean}
 */
function isTruncatedTweetText(text) {
    if (!text) return false;
    const clean = text.trim();
    return clean.endsWith('…') || clean.endsWith('...') || /\bShow more\b/i.test(text) || /మరింత/i.test(text);
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
 * Extracts explicit statement giver / speaker from quote lines like:
 * "— Dr. @sambitswaraj", "-- Shri @AmitShah", "— @RahulGandhi", "- మంత్రి నారాయణ", etc.
 * @param {string} text 
 * @returns {string|null}
 */
function extractSpeakerFromTweet(text) {
    if (!text) return null;
    const dashMatch = text.match(/(?:—|--|–|-)\s*(?:Dr\.|Shri|Smt\.|Smt|Sri|Hon'ble|మంత్రి|ఎంపీ|ఎమ్మెల్యే)?\s*([@\w\u0C00-\u0C7F\s.]+?)(?:\s*(?:Watch|http|\n|$))/i);
    if (dashMatch && dashMatch[1]) {
        let speaker = dashMatch[1].trim();
        speaker = speaker.replace(/[.,:;]+$/, '').trim();
        if (speaker.toLowerCase().includes('sambitswaraj')) return 'డాక్టర్ సంబిత్ పాత్రా (@sambitswaraj)';
        if (speaker.toLowerCase().includes('amitshah')) return 'అమిత్ షా (@AmitShah)';
        if (speaker.toLowerCase().includes('rahulgandhi')) return 'రాహుల్ గాంధీ (@RahulGandhi)';
        if (speaker.toLowerCase().includes('narendramodi')) return 'నరేంద్ర మోదీ (@narendramodi)';
        if (speaker.toLowerCase().includes('ncbn')) return 'నారా చంద్రబాబు నాయుడు (@ncbn)';
        if (speaker.toLowerCase().includes('ysjagan')) return 'వైఎస్ జగన్ మోహన్ రెడ్డి (@ysjagan)';
        if (speaker.toLowerCase().includes('naralokesh')) return 'నారా లోకేష్ (@naralokesh)';
        if (speaker.toLowerCase().includes('pawankalyan')) return 'పవన్ కళ్యాణ్ (@PawanKalyan)';
        if (speaker.toLowerCase().includes('ktrbrs')) return 'కేటీఆర్ (@KTRBRS)';
        if (speaker.length >= 2 && speaker.length <= 40 && !speaker.startsWith('http')) {
            return speaker;
        }
    }
    return null;
}

/**
 * Checks if a tweet ends abruptly or with continuation punctuation.
 */
function isSentenceIncomplete(text) {
    if (!text) return false;
    const trimmed = text.trim();
    return trimmed.endsWith('...') || 
           trimmed.endsWith('…') || 
           trimmed.endsWith(',') || 
           trimmed.endsWith('-') || 
           trimmed.endsWith(':') || 
           trimmed.endsWith('(') ||
           !/[.!?।॥”"']$/.test(trimmed);
}

/**
 * Checks if a tweet begins as a continuation of previous thought.
 */
function isContinuation(text) {
    if (!text) return false;
    const trimmed = text.trim();
    return trimmed.startsWith('...') || 
           trimmed.startsWith('…') || 
           trimmed.startsWith('-') || 
           trimmed.startsWith(',') ||
           trimmed.startsWith('మరియు') ||
           trimmed.startsWith('అలాగే') ||
           /^[a-z]/.test(trimmed);
}

/**
 * Identifies multi-part threaded tweets (explicit 1/4 markers, direct self-replies,
 * sentence continuations with commas/dots, or consecutive related tweets within 15 mins)
 * posted by the same handle, and stitches them into a single comprehensive news story.
 * Preserves all constituent URLs so they are all marked as processed.
 * @param {Array} tweets 
 * @returns {Array} Array of grouped/stitched tweet stories
 */
function groupTweetsIntoThreads(tweets) {
    if (!tweets || tweets.length === 0) return [];

    // Sort chronologically (oldest first)
    const sorted = [...tweets].sort((a, b) => a.date.getTime() - b.date.getTime());

    const result = [];
    const usedIndices = new Set();

    for (let i = 0; i < sorted.length; i++) {
        if (usedIndices.has(i)) continue;

        const current = sorted[i];
        const marker = extractThreadMarker(current.text);
        const threadGroup = [current];
        usedIndices.add(i);

        let lastTime = current.date.getTime();
        let lastText = current.text;
        let lastId = current.id;
        let lastPart = marker ? marker.part : 1;

        for (let j = i + 1; j < sorted.length; j++) {
            if (usedIndices.has(j)) continue;
            const candidate = sorted[j];
            const cMarker = extractThreadMarker(candidate.text);
            const timeDiff = candidate.date.getTime() - lastTime;

            let isThreadContinuation = false;

            if (timeDiff >= 0 && timeDiff <= 30 * 60 * 1000) {
                if (cMarker && marker) {
                    if (cMarker.part > lastPart || (marker.total && cMarker.total === marker.total)) {
                        isThreadContinuation = true;
                    }
                } else if (candidate.replyToId && (candidate.replyToId === lastId || candidate.replyToId === current.id)) {
                    isThreadContinuation = true;
                } else if (isSentenceIncomplete(lastText) || isContinuation(candidate.text)) {
                    isThreadContinuation = true;
                } else if (timeDiff <= 15 * 60 * 1000) {
                    const bothHaveCabinet = (lastText.includes('క్యాబినెట్') || lastText.includes('మంత్రివర్గ')) && 
                                           (candidate.text.includes('క్యాబినెట్') || candidate.text.includes('మంత్రివర్గ') || candidate.text.includes('పెట్టుబడుల') || candidate.text.includes('నిర్ణయాల'));
                    if (bothHaveCabinet) {
                        isThreadContinuation = true;
                    }
                }
            }

            if (isThreadContinuation) {
                threadGroup.push(candidate);
                usedIndices.add(j);
                lastTime = candidate.date.getTime();
                lastText = candidate.text;
                lastId = candidate.id;
                if (cMarker) lastPart = cMarker.part;
            }
        }

        if (threadGroup.length > 1) {
            const allUrls = threadGroup.map(t => t.url);
            const combinedText = threadGroup.map(t => cleanThreadMarker(t.text)).filter(Boolean).join('\n\n');
            const mediaItem = threadGroup.find(t => t.mediaUrl && t.mediaUrl.startsWith('http'));

            result.push({
                id: current.id,
                url: current.url, // Primary URL is part 1
                allUrls: allUrls, // All URLs in thread to mark as processed
                text: combinedText,
                mediaUrl: mediaItem ? mediaItem.mediaUrl : current.mediaUrl,
                mediaType: mediaItem ? mediaItem.mediaType : current.mediaType,
                avatarUrl: current.avatarUrl,
                authorName: current.authorName,
                date: current.date,
                isThread: true,
                threadCount: threadGroup.length
            });
            continue;
        }

        // Single stand-alone tweet
        result.push({
            ...current,
            allUrls: [current.url],
            isThread: false,
            threadCount: 1
        });
    }

    // Return newest first
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
                recentHeadlinesMemoryCache.push(cleanTeluguHeadline(teTitle));
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
    process.env.GEMINI_API_KEY
];

// Deduplicate and sanitize keys from .env
const geminiKeys = Array.from(new Set(
    rawKeyPool
        .map(k => k ? k.trim().replace(/^['"]|['"]$/g, '') : '')
        .filter(k => k && k.length > 10)
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

// Strict Scraper Lite Models ONLY:
// 1. Primary: gemini-3.5-flash-lite
// 2. Fallback: gemini-3.1-flash-lite (Used only if 3.5 fails)
const GEMINI_MODELS = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite'
];
let currentModelIndex = 0;

// ============================================================================
// MEDIA STORAGE UTILS
// ============================================================================
const ALFA_NEWS_LOGO = "https://alfanews.app/logo.png";

async function uploadMediaToStorage(url, folder = 'news-media') {
    if (!url || !url.startsWith('http')) return null;
    let buffer = null;
    let contentType = 'image/jpeg';
    let extension = 'jpg';

    // 1. First attempt: Direct fetch
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
        buffer = Buffer.from(response.data, 'binary');
        contentType = response.headers['content-type'] || 'image/jpeg';
        extension = contentType.split('/')[1] || 'jpg';
    } catch (directErr) {
        // 2. Fallback: Proxy fetch via wsrv.nl to bypass 403/hotlink blocks (e.g. Times of India, Eenadu)
        try {
            const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=webp`;
            const proxyRes = await axios.get(proxyUrl, {
                responseType: 'arraybuffer',
                timeout: 15000
            });
            buffer = Buffer.from(proxyRes.data, 'binary');
            contentType = 'image/webp';
            extension = 'webp';
        } catch (proxyErr) {
            console.error(`Failed to download media for storage (direct: ${directErr.message}, proxy: ${proxyErr.message})`);
            return null;
        }
    }

    if (!buffer) return null;

    try {
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
    const { execSync } = require('child_process');
    
    // 1. Explicit env var
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // 2. Common system binary paths across Linux distributions
    const systemPaths = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/opt/google/chrome/google-chrome',
        '/opt/google/chrome/chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
        '/usr/lib/chromium-browser/chromium-browser',
        '/usr/lib/chromium/chromium'
    ];
    for (const p of systemPaths) {
        if (fs.existsSync(p)) return p;
    }

    // 3. Dynamic lookup via `which` command on Linux
    if (os.platform() === 'linux') {
        const candidates = ['google-chrome-stable', 'google-chrome', 'chromium-browser', 'chromium', 'chrome'];
        for (const cmd of candidates) {
            try {
                const bin = execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf8' }).trim();
                if (bin && fs.existsSync(bin)) {
                    console.log(`[PUPPETEER] Found Chrome via which: ${bin}`);
                    return bin;
                }
            } catch (e) {}
        }
    }
    
    // 4. Puppeteer cache locations (User home, PM2 alfanews0861 user, ~/chrome, and root fallback)
    const cacheBases = [
        path.join(os.homedir(), '.cache', 'puppeteer', 'chrome'),
        path.join(os.homedir(), 'chrome'),
        '/home/alfanews0861/chrome',
        '/home/alfanews0861/.cache/puppeteer/chrome',
        '/root/.cache/puppeteer/chrome'
    ];

    for (const cacheBase of cacheBases) {
        try {
            if (fs.existsSync(cacheBase)) {
                const findChromeRecursive = (dir, depth = 0) => {
                    if (depth > 4) return null;
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isFile() && (entry.name === 'chrome' || entry.name === 'chrome.exe')) {
                            return fullPath;
                        }
                        if (entry.isDirectory()) {
                            const found = findChromeRecursive(fullPath, depth + 1);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                const chromeBin = findChromeRecursive(cacheBase);
                if (chromeBin) {
                    console.log(`[PUPPETEER] Auto-detected installed Chrome at: ${chromeBin}`);
                    return chromeBin;
                }
            }
        } catch (e) {}
    }
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
                '--disable-software-rasterizer',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--mute-audio',
                '--no-first-run'
            ],
            timeout: 45000,
            protocolTimeout: 60000
        };

        if (systemChrome) {
            console.log(`[PUPPETEER] Launching browser using executable: ${systemChrome}`);
            launchOptions.executablePath = systemChrome;
        } else {
            console.warn("[PUPPETEER] No system Chrome path detected, falling back to bundled Puppeteer cache...");
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
    // 1. First try fast HTTP fetch via axios (handles brotli/gzip, 10x faster than browser)
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,te;q=0.8',
                'Referer': 'https://www.google.com/'
            },
            timeout: 12000,
            maxRedirects: 5
        });

        if (response.status === 200 && response.data && typeof response.data === 'string' && response.data.length > 500) {
            return response.data;
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

        // Aggressively block images, fonts, media, stylesheets, and ad/tracking domains to prevent page timeouts
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            const reqUrl = req.url().toLowerCase();
            if (['image', 'font', 'media', 'stylesheet'].includes(resourceType) ||
                reqUrl.includes('google-analytics') || 
                reqUrl.includes('googlesyndication') || 
                reqUrl.includes('doubleclick') ||
                reqUrl.includes('taboola') || 
                reqUrl.includes('outbrain') ||
                reqUrl.includes('scorecardresearch') ||
                reqUrl.includes('adnxs') ||
                reqUrl.includes('criteo') ||
                reqUrl.includes('facebook') ||
                reqUrl.includes('adsystem')) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent(getRandomUserAgent());
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        const html = await page.content();
        return html;
    } catch (err) {
        console.error(`[PUPPETEER] Fetch failed for ${url}: ${err.message}`);
        // If target closed or connection severed, recycle shared browser immediately so subsequent pages don't cascade fail
        if (err.message.includes('Target closed') || err.message.includes('Protocol error') || err.message.includes('timeout')) {
            await closeSharedBrowser();
        }
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
    if (truncatedText.length < 25) return null;

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
            
            // If model not found or deprecated, switch model
            if (errorMsg.includes('NOT_FOUND') || errorMsg.includes('IS NOT SUPPORTED') || errorMsg.includes('NO LONGER AVAILABLE')) {
                console.log(`[GEMINI] Model ${GEMINI_MODELS[currentModelIndex % GEMINI_MODELS.length]} not supported. Falling back to next model.`);
                currentModelIndex++;
                continue;
            }

            // Key-specific issues: Invalid key, leaked key, disabled key, quota exhaustion, 429, 400 Bad Request, 403 Forbidden
            const isKeyIssue = errorMsg.includes('API KEY NOT VALID') || 
                               errorMsg.includes('API_KEY_INVALID') || 
                               errorMsg.includes('INVALID_ARGUMENT') || 
                               errorMsg.includes('REPORTED AS LEAKED') || 
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

                const rawBodyText = (extracted.body || '').trim();
                const sourceWords = rawBodyText.split(/\s+/).filter(Boolean).length;
                const hasSubstantialSource = sourceWords >= 45;

                const prompt = `మీరు ఆల్ఫా న్యూస్ (Alfa News - తెలుగు ప్రముఖ హైపర్-లోకల్ న్యూస్ నెట్‌వర్క్) కు చీఫ్ ఎడిటర్ మరియు సీనియర్ జర్నలిస్ట్.
వెబ్ కథనాల నుండి సేకరించిన సమాచారాన్ని ప్రజలను ఆకట్టుకునేలా, జర్నలిస్టిక్ విలువలతో, నిర్దిష్టమైన భావోద్వేగాలతో కూడిన ప్రామాణిక తెలుగు వార్తగా తీర్చిదిద్దడం మీ బాధ్యత.

ముఖ్యమైన నిబంధనలు (CRITICAL EDITORIAL RULES):

0. 🎯 అత్యున్నత ప్రాథమిక సూత్రం & ప్రాసెసింగ్ క్రమం (FOUNDATIONAL BASE RULE - 70 TELUGU WORDS FIRST, THEN ENGLISH):
   ఇన్‌పుట్ వెబ్ కథనం/ఆర్టికల్ ఏ భాషలో ఉన్నప్పటికీ (ఇంగ్లీష్, తెలుగు, లేదా ఇతర ఏ భాషలో ఉన్నా సరే):
   - దశ 1 (ముందుగా తెలుగు వార్త - STEP 1: PURE TELUGU NEWS FIRST):
     * ఇన్‌పుట్ కథనం ఏ భాషలో ఉన్నా, అందులోని వాస్తవాలను, ప్రధాన సంఘటనను మాత్రమే ఆధారం చేసుకొని, ముందుగా 100% స్వచ్ఛమైన తెలుగు లిపిలో (Unicode U+0C00-U+0C7F) కచ్చితంగా 60 నుండి 70 పదాల ప్రామాణిక జర్నలిస్టిక్ వార్తను రూపొందించాలి ('contentTe').
     * అలాగే శీర్షికను కూడా ముందుగా స్వచ్ఛమైన తెలుగులోనే 6 నుండి 8 పదాల సంపూర్ణ ఏక వాక్యంగా రాయాలి ('headline').
     * ⚠️ అత్యంత కఠిన నిబంధన: 'contentTe' మరియు 'headline' లలో ఒక్క ఇంగ్లీష్ వాక్యం లేదా పదం కూడా ఉండకూడదు! ఇన్‌పుట్ మొత్తం ఇంగ్లీష్ లో ఉన్నప్పటికీ, దానిని పూర్తిగా స్వచ్ఛమైన తెలుగు వార్తగా మార్చాలి.
   - దశ 2 (తెలుగు వార్త ఆధారంగా ఇంగ్లీష్ అనువాదం - STEP 2: TRANSLATE TELUGU NEWS TO ENGLISH):
     * మీరు దశ 1 లో రాసిన 'contentTe' (తెలుగు వార్త) ని మాత్రమే ఆధారంగా చేసుకుని, దానిని స్పష్టమైన ఇంగ్లీష్ వార్తా సారాంశంగా ('contentEn', 50-60 పదాలు) అనువదించి రాయాలి!
     * అలాగే దశ 1 లో రాసిన 'headline' (తెలుగు శీర్షిక) ఆధారంగానే ఇంగ్లీష్ శీర్షిక ('headlineEn') రాయాలి.
     * ఇంగ్లీష్ ఫీల్డ్‌లు కేవలం ఆ తెలుగు వార్తకు ఖచ్చితమైన అనువాదం మాత్రమే!

1. ఏకైక ప్రధాన అంశంపై దృష్టి & ఎడిటోరియల్ తిరస్కరణలు (PRIMARY CORE INCIDENT & EDITORIAL REJECTIONS):
   - వెబ్ ఆర్టికల్ టెక్స్ట్ లో సైడ్ టిక్కర్లు, సంబంధం లేని ఇతర లింకులు, ప్రకటనలు ఉండవచ్చు. వాటిని పూర్తిగా విస్మరించి, ప్రధాన వార్తాంశంపై మాత్రమే దృష్టి పెట్టండి.
   - తిరస్కరణలు (isRelevant: false - సున్నా వార్తా విలువ / ప్రజోపయోగం లేనివి):
     * 🛑 స్వీయ ప్రచారం, భజన, సొంత డబ్బా, నాయకుల పొగడ్తలు, పీఆర్ ఆర్టికల్స్ (SELF-PRAISE, LEADER GLORIFICATION & SYCOPHANCY): ఏ నాయకుడి గురించైనా లేదా పార్టీ గురించైనా కేవలం పొగడ్తలు, ప్రశంసలు, భజన చేసే ఆర్టికల్స్ వార్తలు కావు. ఇందులో ప్రజలకు ఉపయోగపడే పాలసీ లేదా ప్రయోజనం ఏమీ ఉండదు. ఖచ్చితంగా తిరస్కరించాలి (isRelevant: false).
     * 🛑 రొటీన్ ఫోటో-ఆప్స్, సాధారణ సమీక్షలు, పుస్తక/పోస్టర్ ఆవిష్కరణలు (ROUTINE PHOTO-OPS & CASUAL MEETINGS - ZERO NEWS VALUE): ప్రజా ప్రయోజనం, కొత్త పాలసీ లేదా బడ్జెట్ కేటాయింపులు ఏమీ లేకుండా కేవలం కలెక్టర్ లేదా ప్రజాప్రతినిధి ఒక పోస్టర్‌ను ఆవిష్కరించడం, సాధారణ పరిచయ సమీక్ష నిర్వహించడం, పుష్పగుచ్ఛాలు ఇవ్వడం, కేవలం జ్యోతి ప్రజ్వలనలు వంటివి వార్తలు కావు! ఖచ్చితంగా తిరస్కరించాలి (isRelevant: false).
     * సాధారణ బ్లాగ్ పోస్టులు, నిత్య జీవిత సలహాలు, రాశిఫలాలు, వ్యక్తిగత పుట్టినరోజు పోస్టులు వార్తలు కావు (isRelevant: false).
   - ఆమోదం (isRelevant: true): ప్రభుత్వ నిర్ణయాలు, కొత్త సంక్షేమ పథకాలు, అభివృద్ధి ప్రాజెక్టులు, బడ్జెట్, నిర్దిష్ట రాజకీయ విమర్శలు/ప్రెస్ మీట్లు, ప్రజా సమస్యలు, ప్రమాదాలు, నేరాలు మాత్రమే వార్తలు.

2. సారాంశం (STRICT 60 TO 70 TELUGU WORDS, ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్):
   - 'contentTe': వార్త మొత్తం కచ్చితంగా 60 నుండి 70 పదాల మధ్య మాత్రమే ఉండాలి.
   - కచ్చితంగా ఒకే ఒక్క నిరంతర పేరాగ్రాఫ్ గా రాయాలి (No multiple paragraphs, no newlines \n).
   - వార్త యొక్క పూర్తి మూల భావం (భావం), మాట్లాడిన వారి ఆవేశం, ఆగ్రహం, ఆవేదన లేదా ప్రజా సమస్య తీవ్రతను యథాతథంగా ప్రతిబింబించాలి.
   - మొదటి వాక్యంగా మాట్లాడిన వారి పేరు, పదవి లేదా పోస్ట్ రచయిత వివరాలు తప్పనిసరిగా ఉండాలి ("...అని ముఖ్యమంత్రి వెల్లడించారు", "...అని అధికారులు తెలిపారు").
   - ముఖ్యమైన వ్యక్తుల పేర్లు, ఊరు/మండలం/జిల్లా పేర్లు తప్పక ఉండాలి. ఎట్టిపరిస్థితుల్లోనూ పేర్లు లేదా ప్రాంతాలను విడిచిపెట్టరాదు!

3. పూర్తి వార్తా కథన నిబంధన (FULL STORY RULES - మూల సమాచారం ఆధారంగా):
${hasSubstantialSource ? `   - 'fullStoryTe': మూల కథనంలో తగినంత సమాచారం (${sourceWords} పదాలు, 120+ కంటే ఎక్కువ) ఉంది కాబట్టి, సీనియర్ ఎడిటర్ శైలిలో 3 నుండి 4 విడివిడి పేరాగ్రాఫ్‌లలో (\\n\\n తో) పూర్తి కథనం రాయాలి.
   - 3-4 విడివిడి పేరాగ్రాఫ్‌లు తప్పనిసరి (STRICTLY 3-4 PARAGRAPHS SEPARATED BY \\n\\n):
     * ❌ ఒకే ముద్దగా (single clump) రాయడం పూర్తిగా నిషిద్ధం!
     * ✅ కథనాన్ని స్పష్టంగా 3 నుండి 4 పేరాగ్రాఫ్‌లుగా విభజించాలి. ప్రతి పేరాగ్రాఫ్‌ మధ్య రెండు న్యూలైన్‌లు (\\n\\n) తప్పనిసరిగా ఉండాలి.
     * 1వ పేరా (ఆసక్తికర హుక్ & మూల సంఘటన - ~60-80 పదాలు): పాఠకుడిని వెంటనే కట్టిపడేసే ఓపెనింగ్, ప్రధాన సంఘటన/కీలక ప్రకటన/ఘాటైన పంచ్ డైలాగ్, మాట్లాడిన వ్యక్తికి స్పష్టమైన ఆపాదింపు.
     * 2వ పేరా (నేపథ్యం, సంఖ్యలు & పూర్వాపరాలు - ~80-100 పదాలు): సంఘటన లేదా నిర్ణయం నేపథ్యం, గణాంకాలు, కేటాయింపులు, చారిత్రక లేదా గత పరిణామాలు.
     * 3వ పేరా (360° సమతుల్యత & ప్రత్యర్థి వాదన / క్షేత్రస్థాయి వాస్తవాలు - ~70-90 పదాలు): రాజకీయ విమర్శల వార్త అయితే ఎదుటి పక్షం/ప్రతిపక్షం వివరణ, వారి సమర్థన లేదా ఆరోపణలను తిప్పికొట్టిన విధానం; ప్రభుత్వ పథకమైతే క్షేత్రస్థాయి సవాళ్లు లేదా ప్రజా సమస్య తీవ్రత.
     * 4వ పేరా (తాజా పరిస్థితి & భవిష్యత్ పరిణామాలు - ~50-70 పదాలు): ప్రస్తుత పరిస్థితి, అధికారులు చేపట్టిన లేదా చేపట్టాల్సిన చర్యలు, తదుపరి పరిణామాలు లేదా ప్రజల డిమాండ్లు.
   - నిబంధనలు:
     * కల్పితాలు వద్దు (NO HALLUCINATIONS): మూల సమాచారంలో లేని వివరాలను ఊహించవద్దు. ఉన్న సమాచారాన్నే లోతైన జర్నలిజం భాషలో, సమగ్రమైన పేరాగ్రాఫ్‌లుగా రాయండి.
     * వాస్తవాల రక్షణ: వ్యక్తుల పేర్లు, సంస్థలు, ప్రాంతాలు, పదవులు, తేదీలు, అంకెలను ఎట్టిపరిస్థితుల్లోనూ మార్చవద్దు, మిస్ చేయవద్దు.
   - 'fullStoryEn': English Full Story across 3-4 paragraphs separated by \\n\\n.` : `   - మూల కథనం చిన్నదిగా ఉంది (${sourceWords} పదాలు, 120 పదాల లోపే). దీనిపై ఊహించుకుని, అదనపు వివరాలు కల్పించి లేదా పొడిగించి రాయవలసిన అవసరం ఏమాత్రం లేదు (NO HALLUCINATIONS)!
   - అందువల్ల 'fullStoryTe': "" (పూర్తి ఖాళీ స్ట్రింగ్) గానే ఉంచాలి.
   - అలాగే 'fullStoryEn': "" (పూర్తి ఖాళీ స్ట్రింగ్) గానే ఉంచాలి.
   - కార్డు కోసం 'contentTe' (60-70 పదాలు, ఒకే పేరా) మాత్రమే స్పష్టంగా రాస్తే సరిపోతుంది.`}

4. 🌟 ఆసక్తికర ప్రారంభం & నాన్‌-బోరింగ్ హుక్ (IMPACT-FIRST READER ENGAGEMENT):
   - రొటీన్, యాంత్రికమైన బోరింగ్ ప్రారంభాలు పూర్తిగా నిషిద్ధం! (ఉదా: "ఫలానా చోట సమావేశం జరిగింది", "ఫలానా నేత మాట్లాడారు", "ఫలానా విషయాన్ని వెల్లడించారు" అని నీరసంగా మొదలుపెట్టరాదు).
   - ప్రారంభ వాక్యమే పాఠకుడిని కట్టిపడేసేలా (Gripping Hook) అసలు ఏమి జరిగింది? ప్రజలపై దాని ప్రభావం ఏమిటి? ఆ ప్రకటన వెనుక ఉన్న తీవ్ర సంచలనం లేదా వివాదం ఏమిటి? అనే కీలక అంశంతో సూటిగా ప్రారంభం కావాలి.

5. ⚖️ 360° సమతుల్యత & అందరి వాయిస్ (CONTEXTUAL MULTI-VOICE BALANCE & STRICT NEUTRALITY):
   - ఆల్ఫా న్యూస్ నిష్పాక్షిక వార్తా సంస్థ. మన ఛానెల్ ఎవరి పక్షానా నిలబడదు. ఏ ఒక్క పక్షం ప్రచారానికో లేదా ఏకపక్ష ఆరోపణలకో పరిమితం కాకుండా అందరి గొంతులనూ (All Voices) నిష్పాక్షికంగా వినిపించాలి.
   - ⚠️ సందర్భోచిత సమతుల్యత నిబంధన (CRITICAL APPLICABILITY):
     * ✅ రాజకీయ విమర్శలు, సవాళ్లు, ఆరోపణలు, వివాదాస్పద అంశాల వార్తలకు మాత్రమే: 3వ పేరాలో తప్పనిసరిగా ఎదుటి పక్షం/ప్రతిపక్షం యొక్క వివరణ, వారి సమర్థన లేదా ప్రభుత్వం/అధికారుల వివరణను చేర్చి సమతుల్యతను తీసుకురావాలి.
     * 🛑 వివాద రహిత అధికారిక వార్తలు (NO ARTIFICIAL DISPUTES): ప్రభుత్వ అధికారిక సంక్షేమ నిధుల విడుదల (రైతు భరోసా, పింఛన్లు), ఉద్యోగ నోటిఫికేషన్లు (డీఎస్సీ, గ్రూప్స్), అభివృద్ధి పనుల శంకుస్థాపనలు, క్రీడా విజయాలు, సహజ విపత్తులు/ప్రమాదాలు, లేదా సంతాప సందేశాలకు బలవంతంగా కృత్రిమ రాజకీయ వివాదాన్ని లేదా సంబంధం లేని విమర్శలను సృష్టించడం పూర్తిగా నిషిద్ధం! అటువంటి వాటికి ఆ పథకం లబ్ధి లేదా క్షేత్రస్థాయి వాస్తవాలనే 3వ పేరాలో నిష్పాక్షికంగా రాయాలి.

5.1 🛡️ మీడియా మాఫియా పక్షపాత రక్షణ కవచం & హార్డ్ రికార్డులు (PARTISAN MEDIA BIAS SHIELD & HARD DATA ONLY):
   - తెలుగు రాష్ట్రాల్లోని ప్రధాన మీడియా వర్గాలు (ఈనాడు, ఆంధ్రజ్యోతి/ABN, టీవీ5, సాక్షి మొదలైనవి) తీవ్ర రాజకీయ పక్షపాతంతో, ఒక వర్గానికి అనుకూలంగా కథనాలను పదేపదే ప్రచారం చేస్తాయి.
   - గూగుల్ సెర్చ్ లేదా ఇంటర్నెట్‌లో ఒక పక్షం ఆరోపణలు ఎన్ని వేల వెబ్‌సైట్లలో కనిపించినా, వాటిని నిర్ధారిత సత్యాలుగా (Established Facts) భావించరాదు!
   - హార్డ్ రికార్డులు మాత్రమే ఫ్యాక్ట్స్: ప్రభుత్వ జీవోలు (GOs), గెజిట్లు, బడ్జెట్ అంకెలు, కోర్టు ఆదేశాలు, ఈడీ/సిట్ ఎఫ్‌ఐఆర్ కాపీలు, ఎన్నికల సంఘం ఉత్తర్వులను మాత్రమే వాస్తవాలుగా పరిగణించాలి.
   - పక్షపాత విశేషణాల బహిష్కరణ: "చరిత్రలోనే అతిపెద్ద స్కామ్", "ప్రజాగ్రహం కట్టలు తెంచుకుంది", "కుదేలైన సర్కార్", "నిలువునా ముంచేశారు" వంటి రాజకీయ అజెండా విశేషణాలను కథనంలో వాడరాదు.
   - ద్వైపాక్షిక సమతుల్యత: మీడియాలో ఒక వర్గం ఆరోపణ ఎంత బలంగా ఉన్నా, 3వ పేరాలో తప్పనిసరిగా ఎదుటి పక్షం/ప్రభుత్వం/బాధితుల వివరణను లేదా కౌంటర్ వాదనను సమాన ప్రాధాన్యతతో చేర్చాలి. ఆల్ఫా న్యూస్ ఎవరికీ క్లీన్ చిట్ ఇవ్వదు, ఎవరినీ దోషిగా తేల్చదు.

6. 🔥 వార్తా రస రక్షణ & భావోద్వేగ తీవ్రత (TONE & EMOTIONAL INTENSITY FIDELITY):
   - వార్తలోని వాస్తవ రసాన్ని, తీవ్రతను, మూల భావోద్వేగాన్ని (Tone & Intensity) యథాతథంగా కాపాడాలి. వార్తను చప్పగా లేదా నిర్జీవంగా మార్చరాదు.
   - రాజకీయ సవాళ్లు/పోరాటాల్లో ఆ వాడి, వేడి, ఘాటు అలాగే ఉండాలి.
   - రైతుల కష్టాలు, పేదల ఆవేదన, బాధితుల గోడులో కరుణ రసం, వారి గుండెకోత, కన్నీటి వ్యథ ప్రతిధ్వనించాలి.
   - ప్రమాదాలు, ప్రకృతి విపత్తుల్లో గంభీరమైన వాస్తవికత, ప్రాణనష్టం, క్షతగాత్రుల పరిస్థితి తీవ్రతను నిక్కచ్చిగా తెలపాలి.
   - అవినీతి, మోసాలు, నేరాల్లో పదునైన పరిశోధనా శైలి ఉండాలి.

7. ⚡ సజీవ జర్నలిస్టిక్ క్రియా పదాలు (DYNAMIC ACTION VERBS - BAN MONOTONY):
   - ప్రతి వాక్యానికీ "అన్నారు... తెలిపారు... పేర్కొన్నారు" వంటి రొటీన్, యాంత్రిక క్రియా పదాలను పదేపదే వాడటం పూర్తిగా నిషిద్ధం!
   - సందర్భానికి తగిన శక్తివంతమైన తెలుగు క్రియా పదాలను వాడాలి:
     * ఘాటైన ఆరోపణలు/పోరాటం: "ధ్వజమెత్తారు", "నిలదీశారు", "తీవ్రస్థాయిలో విరుచుకుపడ్డారు", "మండిపడ్డారు", "ఆగ్రహం వ్యక్తం చేశారు".
     * కరాఖండి నిర్ణయాలు/హెచ్చరికలు: "తేల్చిచెప్పారు", "హెచ్చరించారు", "స్పష్టం చేశారు", "సవాల్ విసిరారు", "ఖరాఖండీగా ప్రకటించారు".
     * రైతాంగం/బాధితుల వేదన: "ఆవేదన వ్యక్తం చేశారు", "కన్నీటిపర్యంతమయ్యారు", "గోడు వెళ్లబోసుకున్నారు", "వాపోయారు".
     * అధికారిక వివరణలు/రక్షణ: "స్పందించారు", "వివరణ ఇచ్చారు", "సమర్థించుకున్నారు", "స్పష్టతనిచ్చారు", "హామీ ఇచ్చారు".

8. ⚠️ ఆపాదింపు నిబంధన - కథనం బాడీలోనే తప్పనిసరి (MANDATORY ATTRIBUTION IN BODY - ZERO EDITORIAL VERDICTS):
   - ఆల్ఫా న్యూస్ నిష్పాక్షిక వార్తా సంస్థ. ఏ రాజకీయ నాయకుడిపై ప్రశంసలను గానీ, విమర్శలను గానీ మన ఛానెల్ స్వయంగా ఇచ్చినట్లు, ధ్రువీకరించినట్లు లేదా తీర్పు ఇచ్చినట్లు ఎప్పుడూ రాయరాదు!
   - ❌ పొగడ్తలు/బిరుదుల తీర్పులు పూర్తిగా నిషిద్ధం (ZERO EDITORIAL TITLES / FLATTERY): "ప్రజల పక్షాన నిలిచి పోరాడే నాయకురాలు ఫలానా", "పేదల పెన్నిధి ఫలానా నేత", "అభివృద్ధి ప్రదాత ఫలానా నాయకుడు" అని రాయడం అత్యంత ఘోరమైన తప్పు! మన ఛానెల్ ఎవరికీ 'ప్రజల నాయకుడు/నాయకురాలు' అనే బిరుదులు ఇవ్వదు, సర్టిఫై చేయదు.
   - ❌ విమర్శల తీర్పులు కూడా నిషిద్ధం: "కూటమి సర్కార్ ప్రజలను నిలువునా ముంచేసింది", "బీజేపీ విఫలమైంది" అని ఛానెల్ నిర్ధారించరాదు.
   - ✅ తప్పనిసరి ఆపాదింపు బాడీ (Content) మొదటి వాక్యంలో: మాట్లాడిన వారి పేరు లేదా అధికారి వివరాలు కథనం (contentTe) లోని మొదటి వాక్యంగా తప్పనిసరిగా ఉండాలి (ఉదా: "...అని ముఖ్యమంత్రి వెల్లడించారు", "...అని అధికారులు పేర్కొన్నారు").
   - ⚠️ హెడ్‌లైన్‌లో ఆపాదింపు తొలగింపు (NO FORCED ATTRIBUTION IN HEADLINES):
     * సాధారణ వార్తలు, ప్రభుత్వ సంక్షేమం, బడ్జెట్, రోడ్లు/ప్రాజెక్టులు, ఉద్యోగాలు/ఫలితాలు, నేరాలు, ప్రమాదాలు, విపత్తులకు శీర్షిక (Headline) లో వ్యక్తుల పేర్లు, ఆపాదింపులు ("...అన్న సీఎం", "...తెలిపిన కలెక్టర్") పూర్తిగా నిషిద్ధం! ప్రధాన సంఘటన, చర్య లేదా ప్రభావం మాత్రమే శీర్షికలో రావాలి.
     * రాజకీయ విమర్శలు, సవాళ్ల వార్తలకైతే నాయకుడి పేరు కర్తగా ఉండి నేరుగా క్రియా పదంతో ముగియాలి (ఉదా: "కేంద్ర ఎన్నికల సంఘం నిర్ణయంపై రాహుల్ గాంధీ నిప్పులు"). పాసివ్ ముగింపులు ("...విమర్శించిన రాహుల్ గాంధీ", "...విమర్శలు") నిషిద్ధం!
   - ⚠️ వ్యక్తుల మార్పిడి నిషిద్ధం (PERSON ATTRIBUTION SWAP - STRICTLY FORBIDDEN): వార్తలో ఒకరి గురించి రాస్తూ మరొకరు చెప్పిన మాటలు, వ్యాఖ్యలను మొదటి వ్యక్తికి ఆపాదించరాదు. ఎవరు అన్నారో వారి పేరే కథనంలో ఉండాలి.

9. 🏆 అత్యున్నత ప్రాధాన్యత: సందర్భానుసార శీర్షిక & పంచ్ డైలాగ్ నిబంధన (CONTEXT-AWARE HEADLINES & PUNCH DIALOGUE - ABSOLUTE FIRST PRIORITY):
   హెడ్‌లైన్ చదివేటప్పుడు ఎక్కడా బ్రేక్ లేకుండా, మొదటి పదం నుండి చివరి పదం వరకు ఒకే తాటిపై నడిచే స్వచ్ఛమైన ఏక వాక్యంగా (Single Unbroken Flow) ఉండాలి. వార్తలోని మూల స్వభావానికి (Context) తగినట్లుగా శీర్షిక ఉండాలి:

   ఎ. సందర్భానుసార శీర్షిక (Context-Aware Headlines):

   * 1. రాజకీయ విమర్శలు, సవాళ్లు, ఆరోపణలు (POLITICAL CHARGES & CLASHES):
      - ఘాటైన పంచ్ డైలాగ్ + స్పష్టమైన ఆపాదింపు (Attribution) ఉండాలి.
      - మాట్లాడిన వారి ప్రసంగం లేదా ప్రకటనలోని అత్యంత పదునైన, ఘాటైన పంచ్ డైలాగ్‌ను / ప్రధాన ఆరోపణనే హెడ్‌లైన్‌లో ప్రధాన భాగంగా తీసుకోవాలి!
      - చప్పని పదాలు ("సమీక్ష", "స్పందన", "సమావేశం", "విమర్శలు", "ప్రకటన") పూర్తిగా నిషిద్ధం!
      - వాక్య నిర్మాణం: [ఘాటైన పంచ్ డైలాగ్ / ఆరోపణ సారాంశం] అంటూ/అని [ఎవరిపై] [నాయకుడి పేరు] [తీవ్ర ఆగ్రహం / ధ్వజం / సవాల్ / నిప్పులు].
      - ఉదాహరణ: "ప్రజలను దగా చేశారంటూ కూటమి సర్కార్పై జగన్ తీవ్ర ఆగ్రహం" (8 పదాలు)
      - ఉదాహరణ: "అక్రమ కేసులతో బెదిరించలేరంటూ కాంగ్రెస్ సర్కార్‌కు కేటీఆర్ సవాల్" (7 పదాలు)
      - ఉదాహరణ: "కేంద్ర ఎన్నికల సంఘం నిర్ణయంపై రాహుల్ గాంధీ నిప్పులు" (7 పదాలు)

   * 2. రైతాంగ వ్యథ, పేదల ఆవేదన, ప్రజా సమస్యలు (FARMERS, POOR & PUBLIC AGONY):
      - హృదయాన్ని కదిలించే కరుణ రసం, రూపకాలు ఉండాలి.
      - ఉదాహరణ: "ఆశల పందిరి కూలి కన్నీటి సంద్రమైన అన్నదాత బతుకు చిత్రం" (8 పదాలు)
      - ఉదాహరణ: "గిట్టుబాటు ధర లేక పంటను రోడ్డుపై పారబోసిన మిర్చి రైతులు" (8 పదాలు)

   * 3. ప్రమాదాలు, విషాదాలు, విపత్తులు (ACCIDENTS, TRAGEDIES & DISASTERS):
      - గంభీరమైన, వాస్తవికతతో కూడిన శైలి (కవిత్వాలు, పంచ్లు లేకుండా).
      - ఉదాహరణ: "నెత్తురోడిన జాతీయ రహదారిపై లారీ ఢీకొని నలుగురు దుర్మరణం" (7 పదాలు)
      - ఉదాహరణ: "కొండచరియలు విరిగిపడి సీలేరు రహదారిలో స్తంభించిన రాకపోకలు" (7 పదాలు)
      - ఉదాహరణ: "వరద ఉధృతిలో కొట్టుకుపోయిన కారుతో ఇద్దరు గల్లంతు" (6 పదాలు)

   * 4. ప్రభుత్వ పథకాలు, అభివృద్ధి పనులు, శుభవార్తలు (GOVT SCHEMES & DEVELOPMENT):
      - ఉత్తేజభరితమైన, ప్రజలకు కలిగే ప్రత్యక్ష ప్రయోజనాన్ని సూటిగా తెలిపే శైలి (వ్యక్తుల ఆపాదింపు లేకుండా).
      - ఉదాహరణ: "రైతుల ఖాతాల్లోకి నేడే రైతు భరోసా నిధుల జమ" (7 పదాలు)
      - ఉదాహరణ: "రాయలసీమలో లక్ష కోట్లతో మెగా హార్టికల్చర్ హబ్" (7 పదాలు)
      - ఉదాహరణ: "రాష్ట్రంలో పదివేల ఉపాధ్యాయ పోస్టుల భర్తీకి గ్రీన్ సిగ్నల్" (7 పదాలు)

   * 5. నేరాలు, దోపిడీలు, పోలీస్ దాడులు (CRIMES & POLICE RAIDS):
      - పదునైన క్రైమ్ రిపోర్టింగ్.
      - ఉదాహరణ: "సికింద్రాబాద్‌లో సినీ ఫక్కీలో భారీ దోపిడీ.. అంతర్రాష్ట్ర ముఠా అరెస్ట్" (లేదా "సికింద్రాబాద్‌లో సినీ ఫక్కీలో భారీ దోపిడీకి పాల్పడ్డ ముఠా అరెస్ట్")

   * 6. విద్య, ఉద్యోగాలు, పరీక్ష ఫలితాలు:
      - శైలి: సూటిగా స్పష్టమైన అప్‌డేట్.
      - ఉదాహరణ: "వైద్య విద్య ప్రవేశాల నీట్ పీజీ ఫలితాలు విడుదల" (6 పదాలు)
   
   - కఠిన సార్వత్రిక నిబంధనలు (UNIVERSAL RULES FOR ALL HEADLINES):
      1. ఖచ్చితంగా 6 నుండి 8 పదాలు మాత్రమే, సంపూర్ణ అర్ధవంతమైన వాక్యం (STRICTLY 6 TO 8 WORDS, COMPACT & CRISP).
      2. మొదటి పదం నుండి చివరి పదం వరకు కేవలం ఒకే ఒక్క నిరంతర సంపూర్ణ వాక్యం (STRICTLY ONE CONTINUOUS SENTENCE) - కొటేషన్లు ('...', "..."), కోలన్లు (:) పూర్తిగా నిషిద్ధం! ఎక్కడా రెండు ముక్కలుగా విరగ్గొట్టరాదు.
      3. 🛑 చప్పని నామవాచక ముగింపులు మరియు పాసివ్ శైలి పూర్తిగా నిషిద్ధం:
         - వాక్యం చివర '...విమర్శలు', '...ప్రకటన', '...నిలిపివేత', '...సమీక్ష', '...స్పందన', '...వేడుకలు', '...పర్యటన' వంటి చప్పని నామవాచకాలతో లేదా '...చేసిన ఫలానా' వంటి పాసివ్ ముగింపులతో ఎట్టిపరిస్థితుల్లోనూ ముగించరాదు!
         - సజీవమైన ప్రభావం లేదా కార్యాచరణను తెలిపే పదాలతో మాత్రమే ముగియాలి.

10. స్వచ్ఛమైన తెలుగు లిపి & కఠిన భాషా విభజన (100% PURE TELUGU SCRIPT - STRICT NO ENGLISH IN TELUGU FIELDS):
   - 'headline', 'contentTe', 'fullStoryTe' ఫీల్డ్‌లు తప్పనిసరిగా 100% స్వచ్ఛమైన తెలుగు లిపిలోనే (Unicode U+0C00-U+0C7F) ఉండాలి. ఒక్క ఇంగ్లీష్ వాక్యం కూడా వీటిలో రాకూడదు!
   - అబ్రివియేషన్లకు మాత్రమే ఇంగ్లీష్/నంబర్లు (ఉదా: TDP, BRS, BJP, ₹).
   - 'headlineEn', 'contentEn', 'fullStoryEn' మాత్రమే ఇంగ్లీష్‌లో ఉండాలి.
   - కన్నడ, హిందీ/దేవనాగరి, ఉర్దూ, తమిళం లేదా మలయాళం అక్షరాలు ఎట్టిపరిస్థితుల్లోనూ రానివ్వకూడదు.
   - హిందీ/ఇతర భాషల పేర్లను స్వచ్ఛమైన తెలుగులోకి లిప్యంతరీకరించాలి (ఉదా: 'నరేంద్ర మోదీ', 'రాహుల్ గాంధీ', 'ఒవైసీ', 'వక్ఫ్').

11. చిత్రాలు & లోగోల పరిశీలన (STRICT LOGO REJECTION):
   - చిత్రం: ${extracted.image || 'None'}.
   - ఒకవేళ చిత్రంలో టీవీ ఛానల్ లోగో (ETV, TV9, Sakshi, Eenadu, ABN, NTV, V6, 10TV, HMTV, Zee మొదలైనవి), వెబ్‌సైట్ లోగో, వాటర్‌మార్క్, మైక్ చిహ్నం, డిజిటల్ టైటిల్ కార్డ్ ఉంటే తప్పనిసరిగా తిరస్కరించాలి! ("hasLogo": true, "mediaUrl": "").
   - నిజమైన వాస్తవ సంఘటన ఫోటో అయితే మాత్రమే "hasLogo": false, "mediaUrl": "${extracted.image || ''}" ఇవ్వాలి.

12. లొకేషన్ & వర్గీకరణ:
   - location: తెలంగాణ/ఆంధ్రప్రదేశ్‌లోని జిల్లా పేరు (లేదా మండలం).
   - refinedCategory: Exactly one of [Politics, Crime, Sports, Cinema, Business, Health, Education, Technology, Agriculture, Local, National, International].
   - storyFingerprint: EXACTLY 3-4 words joined by hyphens in English (e.g. jagan-fires-alliance-govt).

13. అవుట్‌పుట్ ఫార్మాట్ (Strict JSON only):
{"isRelevant": true|false, "headline": "దశ 1: స్వచ్ఛమైన తెలుగు శీర్షిక (కచ్చితంగా తెలుగులో, 6-8 పదాలు, ఒకే నిరంతర వాక్యం, కొటేషన్లు/కోలన్లు లేవు, ఆకర్షణీయమైన యాక్టివ్ శైలి)", "contentTe": "దశ 1: స్వచ్ఛమైన తెలుగు సారాంశం (ఇన్‌పుట్ ఏ భాషలో ఉన్నా సరే ఇక్కడ 100% తెలుగు లిపిలోనే, 60-70 పదాలు, ఒకే పేరాగ్రాఫ్, మొదటి వాక్యంలో ఆపాదింపుతో)", "fullStoryTe": "${hasSubstantialSource ? "పూర్తి వార్త - సీనియర్ ఎడిటర్ కథనం (3-4 విడివిడి పేరాగ్రాఫ్‌లు \\\\n\\\\n తో)" : ""}", "headlineEn": "దశ 2: English Headline translated from Telugu headline (6-8 words)", "contentEn": "దశ 2: English Summary translated from contentTe (50-60 words)", "fullStoryEn": "${hasSubstantialSource ? "English Full Story in 3-4 paragraphs separated by \\\\n\\\\n" : ""}", "location": "Location", "storyFingerprint": "subject-action-words", "refinedCategory": "Category", "tags": [], "entities": {"people":[], "organizations":[], "locations":[]}, "hasLogo": false, "mediaUrl": "${extracted.image || ''}", "mediaType": "image|video", "isWide": true|false}`;

                const aiResult = await processWithGemini(extracted.body, prompt, extracted.image);
                if (!aiResult) {
                    failedCount++;
                    return;
                }

                try {
                    const parsed = JSON.parse(aiResult.replace(/```json|```/g, '').trim());
                    const validContent = parsed.contentTe || parsed.content || '';
                    if (!parsed.isRelevant || !parsed.headline || !validContent) {
                        await markUrlAsProcessed(link);
                        return;
                    }
                    parsed.content = validContent;

                    // Clean headline immediately (strictly remove all quotes, colons, double-dots)
                    parsed.headline = cleanTeluguHeadline(parsed.headline);
                    if (parsed.headlineEn) {
                        parsed.headlineEn = cleanEnglishHeadline(parsed.headlineEn);
                    }
                    if (!parsed.headline) {
                        await markUrlAsProcessed(link);
                        return;
                    }

                    // Check for party flattery / sycophancy or editorial verdict without attribution
                    if (isEditorialVerdictOrFlattery(parsed.headline, extracted.body, '')) {
                        console.log(`[WEB] 🛑 Rejected party flattery / editorial verdict without attribution: "${parsed.headline}"`);
                        await markUrlAsProcessed(link);
                        return;
                    }

                    // 1. Headline similarity deduplication with Entity/Speaker Awareness
                    if (parsed.headline) {
                        const isDupHeadline = recentHeadlinesMemoryCache.some(cachedHeadline => {
                            const similarity = calculateTextSimilarity(parsed.headline, cachedHeadline);
                            if (similarity >= 0.70) {
                                // Check if person entity is different (e.g. Jagan vs KTR vs Harish Rao)
                                const currentPerson = parsed.entities?.people?.[0] || '';
                                if (currentPerson && currentPerson.length > 2 && !cachedHeadline.includes(currentPerson)) {
                                    return false; // Different person speaking, NOT a duplicate!
                                }
                                return true;
                            }
                            return false;
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

                    // Media URL handling: Strict Logo Rejection & Never override AI logo decision
                    let chosenMediaUrl = null;
                    if (parsed.hasLogo !== true && parsed.mediaUrl && parsed.mediaUrl.startsWith('http') && !parsed.mediaUrl.includes('"') && parsed.mediaUrl !== 'url' && !isGenericImage(parsed.mediaUrl)) {
                        chosenMediaUrl = parsed.mediaUrl;
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
                            const uploadedUrl = await uploadMediaToStorage(chosenMediaUrl);
                            if (uploadedUrl) {
                                finalMediaUrl = uploadedUrl;
                                postFormat = parsed.isWide ? '16:9' : '9:16';
                            } else {
                                finalMediaUrl = `https://wsrv.nl/?url=${encodeURIComponent(chosenMediaUrl)}&output=webp`;
                                postFormat = parsed.isWide ? '16:9' : '9:16';
                            }
                        }
                    }

                    // Enforce pure Telugu script & Single Paragraph
                    const cleanedHeadline = parsed.headline;
                    let rawContentTe = parsed.contentTe || parsed.content || '';
                    let rawContentEn = parsed.contentEn || '';

                    // Check if content was swapped or generated in English
                    if (!isTeluguScript(rawContentTe) && isTeluguScript(rawContentEn)) {
                        console.log(`[WEB] 🔄 Swapping English/Telugu content fields for ${source.siteName}`);
                        const tmp = rawContentTe;
                        rawContentTe = rawContentEn;
                        rawContentEn = tmp;
                    } else if (!isTeluguScript(rawContentTe)) {
                        if (!rawContentEn && rawContentTe) rawContentEn = rawContentTe;
                        if (parsed.fullStoryTe && isTeluguScript(parsed.fullStoryTe)) {
                            rawContentTe = parsed.fullStoryTe.split(/\r?\n\r?\n/)[0].trim();
                            console.log(`[WEB] ✅ Recovered Telugu content from fullStoryTe first paragraph.`);
                        }
                    }

                    const cleanedContent = sanitizeTeluguText(rawContentTe).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
                    let cleanedFullStoryTe = "";
                    let cleanedFullStoryEn = "";

                    if (hasSubstantialSource && parsed.fullStoryTe && isTeluguScript(parsed.fullStoryTe)) {
                        const rawStory = sanitizeTeluguText(parsed.fullStoryTe).trim();
                        const storyWords = rawStory.split(/\s+/).filter(Boolean).length;
                        if (storyWords >= 80 && rawStory !== cleanedContent) {
                            cleanedFullStoryTe = formatIntoParagraphs(rawStory);
                        }
                    }

                    if (hasSubstantialSource && parsed.fullStoryEn) {
                        const rawStoryEn = String(parsed.fullStoryEn).trim();
                        if (rawStoryEn.split(/\s+/).filter(Boolean).length >= 80) {
                            cleanedFullStoryEn = formatIntoParagraphs(rawStoryEn);
                        }
                    }

                    const docRef = db.collection('news').doc();
                    const newsPayload = sanitizeFirestoreData({
                        headline: { telugu: cleanedHeadline, english: parsed.headlineEn || '' },
                        content: { telugu: cleanedContent, english: rawContentEn || parsed.contentEn || '' },
                        fullStory: { telugu: cleanedFullStoryTe, english: cleanedFullStoryEn },
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
                        isReporter: true,
                        isCitizen: false,
                        aiProcessed: true,
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
// TWITTER / X SYNDICATION API (Zero Browser, Zero Cost, 100% Reliable & Fast)
// ============================================================================
async function fetchTweetsSyndication(handle) {
    const timelineUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`;
    const userAgent = getRandomUserAgent();
    const proxyCount = proxyManager.getProxyCount();
    const maxAttempts = proxyCount > 0 ? 2 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const proxyUrl = proxyManager.getNextProxy();
        try {
            const config = {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Referer': 'https://platform.twitter.com/',
                    'Accept-Language': 'en-US,en;q=0.9,te;q=0.8'
                },
                timeout: 15000,
                validateStatus: (status) => status < 500
            };

            if (proxyUrl && HttpsProxyAgent) {
                try {
                    config.httpsAgent = new HttpsProxyAgent(proxyUrl);
                    config.httpAgent = new HttpsProxyAgent(proxyUrl);
                } catch (e) {
                    console.warn('[PROXY] HttpsProxyAgent error:', e.message);
                }
            }

            const res = await axios.get(timelineUrl, config);
            if (res.status === 429) {
                console.warn(`[X-SYNDICATION] Rate limit (429) on @${handle} ${proxyUrl ? 'via proxy' : 'direct'}. Retrying with next proxy...`);
                continue;
            }
            if (res.status !== 200 || !res.data) {
                if (attempt === maxAttempts - 1) return [];
                continue;
            }

            const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
            const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
            if (!match) return [];

            const data = JSON.parse(match[1]);
            const entries = data?.props?.pageProps?.timeline?.entries || [];
            const parsedTweets = [];

            for (const entry of entries) {
                if (entry.type !== 'tweet') continue;
                const tweet = entry.content?.tweet;
                if (!tweet) continue;

                const tweetId = tweet.id_str;
                // 1. Skip pure retweets to prevent attribution swap errors
                if (tweet.retweeted_status || tweet.retweeted_status_result) {
                    continue;
                }

                // Support modern X Note Tweets / long form posts (prevents 280-char cutoff)
                let rawText = tweet.note_tweet?.note_tweet_results?.result?.text
                    || tweet.note_tweet?.text
                    || tweet.note_tweet?.note_tweet_results?.result?.richtext?.text
                    || tweet.article?.article_results?.result?.text
                    || tweet.extended_tweet?.full_text
                    || tweet.full_text
                    || tweet.text
                    || '';
                if (!tweetId || !rawText) continue;

                // Skip if text starts with RT @
                if (rawText.trim().startsWith('RT @')) continue;

                // 2. Extract Quote Tweet context if present
                const quote = tweet.quoted_status || tweet.quoted_status_result?.result;
                let quoteContext = '';
                if (quote) {
                    const qUser = quote.user?.name || quote.user?.screen_name || quote.core?.user_results?.result?.legacy?.name || '';
                    const qHandle = quote.user?.screen_name || quote.core?.user_results?.result?.legacy?.screen_name || '';
                    const qRawText = quote.note_tweet?.note_tweet_results?.result?.text
                        || quote.note_tweet?.text
                        || quote.full_text
                        || quote.text
                        || quote.legacy?.full_text
                        || '';
                    const qClean = cleanTweetText(qRawText);
                    if (qClean) {
                        quoteContext = `\n\n[కోట్ చేసిన పోస్ట్ / మూల సందర్భం - ${qUser ? `${qUser} (@${qHandle})` : `@${qHandle}`}]:\n${qClean}`;
                    }
                }

                // Extract media (photos / videos)
                let mediaUrl = null;
                let mediaType = 'image';
                if (tweet.entities?.media && tweet.entities.media.length > 0) {
                    mediaUrl = tweet.entities.media[0].media_url_https;
                    // Note: Even for videos, syndication provides image poster. Keep mediaType as image unless mp4
                    if (tweet.entities.media[0].type === 'video' || tweet.entities.media[0].type === 'animated_gif') {
                        mediaType = 'image'; // Prevent app video player from choking on image URL
                    }
                } else if (tweet.photos && tweet.photos.length > 0) {
                    mediaUrl = tweet.photos[0].url;
                } else if (tweet.video?.poster) {
                    mediaUrl = tweet.video.poster;
                }

                // If main tweet has no direct media, check quoted tweet
                if (!mediaUrl && quote) {
                    if (quote.entities?.media && quote.entities.media.length > 0) {
                        mediaUrl = quote.entities.media[0].media_url_https;
                    } else if (quote.photos && quote.photos.length > 0) {
                        mediaUrl = quote.photos[0].url;
                    } else if (quote.video?.poster) {
                        mediaUrl = quote.video.poster;
                    }
                }

                const avatarUrl = tweet.user?.profile_image_url_https?.replace('_normal.', '_400x400.') || null;
                const authorName = tweet.user?.name || null;
                const tweetDate = tweet.created_at ? new Date(tweet.created_at) : getTweetTimestamp(tweetId);
                const cleanedText = cleanTweetText(rawText) + quoteContext;
                const replyToId = tweet.in_reply_to_status_id_str || tweet.parent?.id_str || null;
                const conversationId = tweet.conversation_id_str || null;

                if (cleanedText && cleanedText.length >= 15) {
                    parsedTweets.push({
                        id: tweetId,
                        url: `https://x.com/${handle}/status/${tweetId}`,
                        text: cleanedText,
                        authorName: authorName,
                        mediaUrl: mediaUrl,
                        avatarUrl: avatarUrl,
                        mediaType: mediaType,
                        date: tweetDate,
                        replyToId: replyToId,
                        conversationId: conversationId
                    });
                }
                if (parsedTweets.length >= 15) break;
            }

            console.log(`[X-SYNDICATION] Successfully extracted ${parsedTweets.length} live tweets for @${handle} ${proxyUrl ? `(via proxy)` : ''}`);
            return parsedTweets;
        } catch (e) {
            console.error(`[X-SYNDICATION] Attempt ${attempt + 1} failed for @${handle}:`, e.message);
            if (attempt === maxAttempts - 1) return [];
        }
    }
    return [];
}

/**
 * Visits a single tweet status page to fetch complete un-truncated text for Note Tweets.
 * @param {object} page Puppeteer page
 * @param {string} tweetUrl Full tweet URL
 * @returns {Promise<string|null>}
 */
async function fetchFullTweetTextFromStatus(page, tweetUrl) {
    if (!page || !tweetUrl) return null;
    try {
        console.log(`[X-DIRECT] 🔍 Expanding full status text for long tweet: ${tweetUrl}`);
        await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
        await page.waitForFunction(() => !!document.querySelector('[data-testid="tweetText"]'), { timeout: 6000 }).catch(() => {});

        // Click show more on status page if present
        await page.evaluate(() => {
            const btn = document.querySelector('[data-testid="tweet-text-show-more-link"], [data-testid="tweetText"] [role="button"]');
            if (btn) try { btn.click(); } catch (e) {}
        });
        await new Promise(r => setTimeout(r, 400));

        const fullText = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="tweetText"]');
            return el ? el.innerText.trim() : null;
        });
        return fullText;
    } catch (e) {
        return null;
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

        // Aggressively block media, fonts, stylesheets, and tracking scripts to prevent X.com from timing out
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            const reqUrl = req.url().toLowerCase();
            if (['image', 'font', 'media', 'stylesheet'].includes(resourceType) ||
                reqUrl.includes('analytics') || 
                reqUrl.includes('telemetry') || 
                reqUrl.includes('doubleclick') ||
                reqUrl.includes('ads-twitter')) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setViewport({ width: 1280, height: 900 });
        const ua = getRandomUserAgent();
        await page.setUserAgent(ua);

        const currentProxy = proxyManager.getNextProxy();
        if (currentProxy) {
            const auth = extractProxyAuth(currentProxy);
            if (auth && auth.username) {
                await page.authenticate({ username: auth.username, password: auth.password }).catch(() => {});
            }
        }
        
        console.log(`[X-DIRECT] Navigating stealthily to https://x.com/${handle}...`);
        await page.goto(`https://x.com/${handle}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForFunction(() => document.querySelectorAll('article').length > 0, { timeout: 8000 }).catch(() => {});

        // Expand all "Show more" / "మరింత చూపించు" buttons across the timeline to reveal full text of long tweets
        await page.evaluate(() => {
            const showMoreElements = document.querySelectorAll(
                '[data-testid="tweet-text-show-more-link"], [data-testid="tweetText"] [role="button"], article [role="button"]'
            );
            for (const el of showMoreElements) {
                const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
                if (txt.includes('show more') || txt.includes('మరింత') || txt.includes('చూపించు')) {
                    try { el.click(); } catch(e) {}
                }
            }
        });
        await new Promise(r => setTimeout(r, 600));

        const rawTweets = await page.$$eval('article', (articles, userHandle) => {
            const results = [];
            for (const el of articles) {
                // 1. Skip pure reposts / retweets to prevent attribution swap
                const socialContextEl = el.querySelector('[data-testid="socialContext"]');
                if (socialContextEl) {
                    const sTxt = (socialContextEl.innerText || '').toLowerCase();
                    if (sTxt.includes('reposted') || sTxt.includes('retweeted')) {
                        continue;
                    }
                }

                // Find status link
                const statusLinkEl = el.querySelector('a[href*="/status/"]');
                if (!statusLinkEl) continue;
                const href = statusLinkEl.getAttribute('href') || '';
                const match = href.match(/\/status\/(\d+)/);
                if (!match) continue;
                const tweetId = match[1];
                const tweetUrl = `https://x.com/${userHandle}/status/${tweetId}`;

                // Extract replyToId if replying to a thread
                let replyToId = null;
                const replyLinks = el.querySelectorAll('a[href*="/status/"]');
                for (const rl of replyLinks) {
                    const rHref = rl.getAttribute('href') || '';
                    const rMatch = rHref.match(/\/status\/(\d+)/);
                    if (rMatch && rMatch[1] !== tweetId) {
                        replyToId = rMatch[1];
                        break;
                    }
                }

                // Extract author display name
                let authorDisplayName = '';
                const userNameEl = el.querySelector('[data-testid="User-Name"]');
                if (userNameEl) {
                    const firstSpan = userNameEl.querySelector('span');
                    authorDisplayName = (firstSpan ? firstSpan.innerText : userNameEl.innerText).split('\n')[0].trim();
                }

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

                // 2. Extract Quote Tweet text if present
                const quoteTweetEl = el.querySelector('[data-testid="quoteTweet"]') || el.querySelector('div[role="link"] [data-testid="tweetText"]');
                if (quoteTweetEl) {
                    const qText = (quoteTweetEl.innerText || '').trim();
                    if (qText && !text.includes(qText)) {
                        text += `\n\n[కోట్ చేసిన పోస్ట్ / మూల సందర్భం]:\n${qText}`;
                    }
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
                    authorName: authorDisplayName || null,
                    mediaUrl: mediaUrl,
                    avatarUrl: avatarUrl,
                    mediaType: mediaType,
                    replyToId: replyToId
                });

                if (results.length >= 12) break;
            }
            return results;
        }, handle);

        const parsedTweets = [];
        for (const item of rawTweets) {
            const tweetDate = getTweetTimestamp(item.id);
            let cleanedText = cleanTweetText(item.text);

            // If text is still truncated (ends with ellipsis or is a truncated note tweet), visit status URL directly
            if (isTruncatedTweetText(item.text) || cleanedText.endsWith('…') || cleanedText.endsWith('...')) {
                try {
                    const fullTextFromStatus = await fetchFullTweetTextFromStatus(page, item.url);
                    if (fullTextFromStatus && fullTextFromStatus.length > cleanedText.length) {
                        cleanedText = cleanTweetText(fullTextFromStatus);
                    }
                } catch (e) {}
            }

            if (cleanedText && cleanedText.length >= 15) {
                parsedTweets.push({
                    id: item.id,
                    url: item.url,
                    text: cleanedText,
                    authorName: item.authorName || null,
                    mediaUrl: item.mediaUrl,
                    avatarUrl: item.avatarUrl,
                    mediaType: item.mediaType,
                    date: tweetDate,
                    replyToId: item.replyToId || null
                });
            }
        }

        console.log(`[X-DIRECT] Successfully extracted ${parsedTweets.length} primary direct tweets for @${handle}`);
        return parsedTweets;
    } catch (e) {
        console.error(`[X-DIRECT] Direct stealth crawl failed for @${handle}:`, e.message);
        // If target closed or connection severed, recycle shared browser immediately so subsequent pages don't cascade fail
        if (e.message.includes('Target closed') || e.message.includes('Protocol error') || e.message.includes('timeout')) {
            await closeSharedBrowser();
        }
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
            const text = item.note_tweet?.note_tweet_results?.result?.text 
                || item.note_tweet?.text 
                || item.full_text 
                || item.text 
                || item.tweet_text 
                || '';
            const tweetId = item.tweet_id || item.id_str || item.id || '';
            if (!tweetId) continue;

            const tweetUrl = `https://x.com/${handle}/status/${tweetId}`;
            let date = item.created_at ? new Date(item.created_at) : getTweetTimestamp(tweetId);
            const authorName = item.user?.name || null;

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
                authorName: authorName,
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
        // 1. Primary Method: Twitter Syndication (Zero browser, Zero RAM, ultra fast & reliable)
        let fetchedItems = await fetchTweetsSyndication(handle);

        // 2. Secondary Fallback: Direct Stealth Puppeteer (if syndication had 0 items)
        if (fetchedItems.length === 0) {
            fetchedItems = await fetchTweetsDirectStealth(handle);
        }

        // 3. Tertiary Fallback: RapidAPI if configured and direct crawl had 0 items
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

                const authorDisplayName = item.authorName || feed.sourceName || feed.authorName || feed.title || feed.name || `@${handle}`;
                const handleTag = `@${handle}`;
                const district = feed.district || '';
                const designation = feed.designation || feed.role || feed.party || feed.category || '';

                const tweetText = (item.text || '').trim();
                const tweetWords = tweetText.split(/\s+/).filter(Boolean).length;
                const hasSubstantialTweet = tweetWords >= 80;

                const prompt = `మీరు ఆల్ఫా న్యూస్ (Alfa News - తెలుగు ప్రముఖ హైపర్-లోకల్ న్యూస్ నెట్‌వర్క్) కు చీఫ్ ఎడిటర్ మరియు సీనియర్ జర్నలిస్ట్.
సోషల్ మీడియా / ట్విట్టర్ (X) పోస్టులను ప్రజలను ఆకట్టుకునేలా, జర్నలిస్టిక్ విలువలతో, నిర్దిష్టమైన భావోద్వేగాలతో కూడిన ప్రామాణిక తెలుగు వార్తగా తీర్చిదిద్దడం మీ బాధ్యత.

పోస్ట్ ఖాతా & సందర్భ వివరాలు (POST ACCOUNT & CONTEXT METADATA):
- పోస్ట్ రచయిత / ఖాతా (Post Author): ${authorDisplayName} (${handleTag})
- కేటగిరీ / హోదా / పార్టీ: ${designation || 'Political / Social Update'}
- ప్రాంతం / సందర్భం: ${district || "Andhra Pradesh / Telangana"}

ముఖ్యమైన నిబంధనలు (CRITICAL EDITORIAL RULES):

0. 🎯 అత్యున్నత ప్రాథమిక సూత్రం & ప్రాసెసింగ్ క్రమం (FOUNDATIONAL BASE RULE - 70 TELUGU WORDS FIRST, THEN ENGLISH):
   ఇన్‌పుట్ ట్వీట్/పోస్ట్ ఏ భాషలో ఉన్నప్పటికీ (ఇంగ్లీష్, తెలుగు, లేదా ఇతర ఏ భాషలో ఉన్నా సరే):
   - దశ 1 (ముందుగా తెలుగు వార్త - STEP 1: PURE TELUGU NEWS FIRST):
     * ఇన్‌పుట్ ఏ భాషలో ఉన్నా, అందులోని వాస్తవాలను, సంఘటనను మాత్రమే ఆధారం చేసుకొని, ముందుగా 100% స్వచ్ఛమైన తెలుగు లిపిలో (Unicode U+0C00-U+0C7F) కచ్చితంగా 60 నుండి 70 పదాల ప్రామాణిక జర్నలిస్టిక్ వార్తను రూపొందించాలి ('contentTe').
     * అలాగే శీర్షికను కూడా ముందుగా స్వచ్ఛమైన తెలుగులోనే 7 నుండి 9 పదాల సంపూర్ణ ఏక వాక్యంగా రాయాలి ('headline').
     * ⚠️ అత్యంత కఠిన నిబంధన: 'contentTe' మరియు 'headline' లలో ఒక్క ఇంగ్లీష్ వాక్యం లేదా పదం కూడా ఉండకూడదు! ఇన్‌పుట్ మొత్తం ఇంగ్లీష్ లో ఉన్నప్పటికీ, దానిని పూర్తిగా స్వచ్ఛమైన తెలుగు వార్తగా మార్చాలి.
   - దశ 2 (తెలుగు వార్త ఆధారంగా ఇంగ్లీష్ అనువాదం - STEP 2: TRANSLATE TELUGU NEWS TO ENGLISH):
     * మీరు దశ 1 లో రాసిన 'contentTe' (తెలుగు వార్త) ని మాత్రమే ఆధారంగా చేసుకుని, దానిని స్పష్టమైన ఇంగ్లీష్ వార్తా సారాంశంగా ('contentEn', 50-60 పదాలు) అనువదించి రాయాలి!
     * అలాగే దశ 1 లో రాసిన 'headline' (తెలుగు శీర్షిక) ఆధారంగానే ఇంగ్లీష్ శీర్షిక ('headlineEn') రాయాలి.
     * ఇంగ్లీష్ ఫీల్డ్‌లు కేవలం ఆ తెలుగు వార్తకు ఖచ్చితమైన అనువాదం మాత్రమే!

1. ⚠️ ఆపాదింపు నిబంధన - కథనం బాడీలోనే తప్పనిసరి (MANDATORY ATTRIBUTION IN BODY - ZERO EDITORIAL VERDICTS):
   - ఆల్ఫా న్యూస్ నిష్పాక్షిక వార్తా సంస్థ. ఏ రాజకీయ నాయకుడిపై ప్రశంసలను గానీ, విమర్శలను గానీ మన ఛానెల్ స్వయంగా ఇచ్చినట్లు, ధ్రువీకరించినట్లు లేదా తీర్పు ఇచ్చినట్లు ఎప్పుడూ రాయరాదు!
   - ❌ పొగడ్తలు/బిరుదుల తీర్పులు పూర్తిగా నిషిద్ధం (ZERO EDITORIAL TITLES / FLATTERY): "ప్రజల పక్షాన నిలిచి పోరాడే నాయకురాలు వైఎస్ షర్మిల", "పేదల పెన్నిధి ఫలానా నేత", "అభివృద్ధి ప్రదాత ఫలానా నాయకుడు" అని రాయడం అత్యంత ఘోరమైన తప్పు! మన ఛానెల్ ఎవరికీ 'ప్రజల నాయకుడు/నాయకురాలు' అనే బిరుదులు ఇవ్వదు, సర్టిఫై చేయదు.
   - ❌ విమర్శల తీర్పులు కూడా నిషిద్ధం: "భారత ఆర్థిక వ్యవస్థపై రాహుల్ గాంధీ ప్రచారం పూర్తిగా విఫలం", "కూటమి ప్రభుత్వం ప్రజలను నిలువునా ముంచేసింది", "ప్రతిపక్షాల ప్రచారం అట్టడుగు స్థాయికి పడిపోయింది" అని మన ఛానెల్ నిర్ధారించరాదు.
   - ✅ తప్పనిసరి ఆపాదింపు బాడీ (contentTe) మొదటి వాక్యంలో: పోస్ట్ రచయిత (Post Author: ${authorDisplayName}) లేదా మాట్లాడిన వారి పేరు, పూర్తి వివరాలు కథనం (contentTe) లోని మొదటి వాక్యంగా తప్పనిసరిగా ఉండాలి (ఉదా: "...అని ${authorDisplayName} వెల్లడించారు", "...అని పేర్కొంటూ ${authorDisplayName} ట్వీట్ చేశారు").
   - ⚠️ హెడ్‌లైన్‌లో ఆపాదింపు తొలగింపు (NO FORCED ATTRIBUTION IN HEADLINES):
     * సాధారణ వార్తలు, ప్రభుత్వ సంక్షేమం, బడ్జెట్, రోడ్లు/ప్రాజెక్టులు, ఉద్యోగాలు/ఫలితాలు, నేరాలు, ప్రమాదాలు, విపత్తులు, అధికారుల ఏర్పాట్ల వార్తలకు శీర్షిక (Headline) లో వ్యక్తుల పేర్లు, ఆపాదింపులు ("...అన్న సీఎం", "...తెలిపిన కలెక్టర్", "...పేర్కొన్న ఎస్పీ") పూర్తిగా నిషిద్ధం! ప్రధాన సంఘటన, చర్య లేదా ప్రభావం మాత్రమే శీర్షికలో రావాలి.
     * రాజకీయ విమర్శలు, సవాళ్ల వార్తలకైతే నాయకుడి పేరు కర్తగా ఉండి నేరుగా క్రియా పదంతో ముగియాలి (ఉదా: "కేంద్ర ఎన్నికల సంఘం నిర్ణయంపై రాహుల్ గాంధీ నిప్పులు"). పాసివ్ ముగింపులు ("...విమర్శించిన రాహుల్ గాంధీ", "...రాహుల్ గాంధీ విమర్శలు") నిషిద్ధం!
   - "విశ్లేషకులు అంటున్నారు", "నివేదికలు స్పష్టం చేస్తున్నాయి", "సర్వత్రా వ్యక్తమవుతోంది", "నిరూపితమైంది" వంటి కల్పిత ధ్రువీకరణలు పూర్తిగా నిషిద్ధం!

1.1 ⚠️ కోట్ ట్వీట్లు & రియాక్షన్ పోస్టుల నిబంధన (QUOTE TWEETS & REACTIONS ATTRIBUTION):
   - ఒక నాయకుడు లేదా అధికారిక ఖాతా వేరొకరి ట్వీట్‌ను లేదా వీడియోను కోట్ చేస్తూ ("Quoted Tweet") స్పందించినప్పుడు:
     * కోట్ చేసిన మూల సంఘటన ఏమిటి? మరియు దానిపై ఈ నాయకుడి స్పందన/విమర్శ ఏమిటి? అనే రెండింటినీ స్పష్టంగా వేరు చేసి చూపించాలి.
     * మూల పోస్ట్‌లోని వ్యక్తులు వేరు, ఈ స్పందన రాసిన నేత వేరు. ఒకరి వ్యాఖ్యలను మరొకరికి ఆపాదించరాదు.
     * శీర్షికలో స్పందించిన నాయకుడి పేరు మరియు వారి అసలు రియాక్షన్ నేరుగా క్రియా పదంతో ఉండాలి ("కేంద్రంపై నిప్పులు చెరిగిన నేత").

2. ⚠️ వ్యక్తుల మార్పిడి నిషిద్ధం (PERSON ATTRIBUTION SWAP - STRICTLY FORBIDDEN):
   - పోస్ట్/ట్వీట్‌లో ఒకరి గురించి రాస్తూ మరొకరు చెప్పిన మాటలు, వ్యాఖ్యలను మొదటి వ్యక్తికి ఆపాదించరాదు. ఎవరు అన్నారో వారి పేరే కథనంలో ఉండాలి.

3. ⚠️ ఖాతాదారుల రకం & ఆపాదింపు విధానం (ACCOUNT TAXONOMY: A1, A2, B, C, D):
   - A1) రాజకీయ నేత తన స్వంత ప్రకటన/విమర్శ/నిర్ణయం ట్వీట్ చేసినప్పుడు: నేరుగా ఆ నేతకే ఆపాదించాలి ("కేటీఆర్ నిలదీశారు", "లోకేష్ స్పష్టం చేశారు", "జగన్ ఆరోపించారు").
   - A2) రాజకీయ నేత వేరొకరి కార్యక్రమాలు/విషయాల గురించి ట్వీట్ చేసినప్పుడు: ఆ విషయాన్ని ప్రస్తావిస్తూనే, ఆ ట్వీట్ చేసిన నాయకుడిని కథనం మొదటి వాక్యంలో తప్పక క్రెడిట్ చేయాలి.
   - B) న్యూస్ అగ్రిగేటర్లు (Telugu Scribe, Great Andhra, AP7AM, ANI, Gulte మొదలైనవి): అగ్రిగేటర్ హ్యాండిల్ పేరుతో ఆపాదించరాదు! ట్వీట్ లోపల అసలు మాట్లాడిన నాయకుడు లేదా అధికారికి ఆపాదించాలి.
   - C) అధికారిక విభాగాలు (I&PR AP, పోలీస్, ఆర్టీసీ, విపత్తు నిర్వహణ, ప్రభుత్వం): ప్రభుత్వ నిర్ణయాలను, మంత్రివర్గ తీర్మానాలను స్పష్టంగా రాయాలి.
   - D) జర్నలిస్టులు, కార్యకర్తలు, సాధారణ పౌరులు: పోస్ట్ రాసిన వారు సాక్షి/మూలం మాత్రమే. అసలు సంఘటనలోని వ్యక్తులను, పోస్ట్ రాసిన వారిని తారుమారు చేయరాదు.

3.1 ⚠️ స్పీకర్ కొటేషన్ ఆపాదింపు నిబంధన (QUOTED SPEAKER ATTRIBUTION):
   - ట్వీట్ లేదా పోస్ట్‌లో ఒక నిర్దిష్ట ప్రకటన కింద "— Dr. @sambitswaraj" లేదా "— Shri @..." లేదా "- [నాయకుడి పేరు]" అని కోట్ రూపంలో ఇచ్చినప్పుడు: ఆ వ్యాఖ్యలు, ప్రకటన ఆ నిర్దిష్ట స్పీకర్‌కే చెందుతాయి! కథనం బాడీలో వారి పేరే ఆపాదించాలి.

3.2 ⚠️ మొదటి పురుష (FIRST-PERSON) కార్యక్రమాల ఆపాదింపు:
   - వెరిఫైడ్ నాయకుడి ఖాతాలో మొదటి పురుషలో (ఉదా: "శంకుస్థాపన చేశాను", "పాల్గొన్నాను") ఉంటే: ఆ పనిని స్వయంగా చేసింది నేరుగా Post Author (${authorDisplayName}) మాత్రమే!

3.3 ⚠️ సంఖ్యలు, నిధులు & హార్డ్ ఫ్యాక్ట్స్ రక్షణ (HARD NUMBERS & FACTS PRESERVATION - STRICT ZERO OMISSION):
   - పోస్ట్‌లోని ప్రతి నిర్దిష్ట సంఖ్య, బడ్జెట్ అంకె (ఉదా: రూ.380 కోట్లు, రూ.240 కోట్లు, రూ.140 కోట్లు, రూ.22,177 కోట్లు), పనుల సంఖ్య (ఉదా: 62 పనులు), ఉద్యోగాల సంఖ్య (ఉదా: 19,739 ఉద్యోగాలు), స్కీమ్/మోడల్ పేరు (ఉదా: HAM మోడల్), మున్సిపాలిటీలు/పట్టణాల పేర్లు తప్పనిసరిగా తెలుగు శీర్షిక మరియు వార్తలో ఉండాలి!
   - ❌ "పలు అభివృద్ధి పనులు", "వివిధ కార్యక్రమాలు", "కొత్త నిర్ణయాలు" వంటి గాల్లో తేలే బోరింగ్ సాధారణ పదాలతో అసలు సంఖ్యలను ఎగరగొట్టడం పూర్తిగా నిషిద్ధం! పక్కా అంకెలు, నిధుల వివరాలే వార్తకు ప్రాణం.

4. 🌟 ఆసక్తికర ప్రారంభం & నాన్‌-బోరింగ్ హుక్ (IMPACT-FIRST READER ENGAGEMENT):
   - రొటీన్, యాంత్రికమైన బోరింగ్ ప్రారంభాలు పూర్తిగా నిషిద్ధం! (ఉదా: "ఫలానా చోట సమావేశం జరిగింది", "ఫలానా నేత మాట్లాడారు", "ఫలానా విషయాన్ని వెల్లడించారు" అని నీరసంగా మొదలుపెట్టరాదు).
   - ప్రారంభ వాక్యమే పాఠకుడిని కట్టిపడేసేలా (Gripping Hook) అసలు ఏమి జరిగింది? ప్రజలపై దాని ప్రభావం ఏమిటి? ఆ ప్రకటన వెనుక ఉన్న తీవ్ర సంచలనం లేదా వివాదం ఏమిటి? అనే కీలక అంశంతో సూటిగా ప్రారంభం కావాలి.

5. ⚖️ 360° సమతుల్యత & అందరి వాయిస్ (CONTEXTUAL MULTI-VOICE BALANCE & STRICT NEUTRALITY):
   - ఆల్ఫా న్యూస్ నిష్పాక్షిక వార్తా సంస్థ. మన ఛానెల్ ఎవరి పక్షానా నిలబడదు. ఏ ఒక్క పక్షం ప్రచారానికో లేదా ఏకపక్ష ఆరోపణలకో పరిమితం కాకుండా అందరి గొంతులనూ (All Voices) నిష్పాక్షికంగా వినిపించాలి.
   - ⚠️ సందర్భోచిత సమతుల్యత నిబంధన (CRITICAL APPLICABILITY):
     * ✅ రాజకీయ విమర్శలు, సవాళ్లు, ఆరోపణలు, వివాదాస్పద అంశాల వార్తలకు మాత్రమే: 3వ పేరాలో తప్పనిసరిగా ఎదుటి పక్షం/ప్రతిపక్షం యొక్క వివరణ, వారి సమర్థన లేదా ప్రభుత్వం/అధికారుల వివరణను చేర్చి సమతుల్యతను తీసుకురావాలి.
     * 🛑 వివాద రహిత అధికారిక వార్తలు (NO ARTIFICIAL DISPUTES): ప్రభుత్వ అధికారిక సంక్షేమ నిధుల విడుదల (రైతు భరోసా, పింఛన్లు), ఉద్యోగ నోటిఫికేషన్లు (డీఎస్సీ, గ్రూప్స్), అభివృద్ధి పనుల శంకుస్థాపనలు, క్రీడా విజయాలు, సహజ విపత్తులు/ప్రమాదాలు, లేదా సంతాప సందేశాలకు బలవంతంగా కృత్రిమ రాజకీయ వివాదాన్ని లేదా సంబంధం లేని విమర్శలను సృష్టించడం పూర్తిగా నిషిద్ధం! అటువంటి వాటికి ఆ పథకం లబ్ధి లేదా క్షేత్రస్థాయి వాస్తవాలనే 3వ పేరాలో నిష్పాక్షికంగా రాయాలి.

5.1 🛡️ మీడియా మాఫియా పక్షపాత రక్షణ కవచం & హార్డ్ రికార్డులు (PARTISAN MEDIA BIAS SHIELD & HARD DATA ONLY):
   - తెలుగు రాష్ట్రాల్లోని ప్రధాన మీడియా వర్గాలు (ఈనాడు, ఆంధ్రజ్యోతి/ABN, టీవీ5, సాక్షి మొదలైనవి) తీవ్ర రాజకీయ పక్షపాతంతో, ఒక వర్గానికి అనుకూలంగా కథనాలను పదేపదే ప్రచారం చేస్తాయి.
   - గూగుల్ సెర్చ్ లేదా ఇంటర్నెట్‌లో ఒక పక్షం ఆరోపణలు ఎన్ని వేల వెబ్‌సైట్లలో కనిపించినా, వాటిని నిర్ధారిత సత్యాలుగా (Established Facts) భావించరాదు!
   - హార్డ్ రికార్డులు మాత్రమే ఫ్యాక్ట్స్: ప్రభుత్వ జీవోలు (GOs), గెజిట్లు, బడ్జెట్ అంకెలు, కోర్టు ఆదేశాలు, ఈడీ/సిట్ ఎఫ్‌ఐఆర్ కాపీలు, ఎన్నికల సంఘం ఉత్తర్వులను మాత్రమే వాస్తవాలుగా పరిగణించాలి.
   - పక్షపాత విశేషణాల బహిష్కరణ: "చరిత్రలోనే అతిపెద్ద స్కామ్", "ప్రజాగ్రహం కట్టలు తెంచుకుంది", "కుదేలైన సర్కార్", "నిలువునా ముంచేశారు" వంటి రాజకీయ అజెండా విశేషణాలను కథనంలో వాడరాదు.
   - ద్వైపాక్షిక సమతుల్యత: మీడియాలో ఒక వర్గం ఆరోపణ ఎంత బలంగా ఉన్నా, 3వ పేరాలో తప్పనిసరిగా ఎదుటి పక్షం/ప్రభుత్వం/బాధితుల వివరణను లేదా కౌంటర్ వాదనను సమాన ప్రాధాన్యతతో చేర్చాలి. ఆల్ఫా న్యూస్ ఎవరికీ క్లీన్ చిట్ ఇవ్వదు, ఎవరినీ దోషిగా తేల్చదు.

6. 🔥 వార్తా రస రక్షణ & భావోద్వేగ తీవ్రత (TONE & EMOTIONAL INTENSITY FIDELITY):
   - వార్తలోని వాస్తవ రసాన్ని, తీవ్రతను, మూల భావోద్వేగాన్ని (Tone & Intensity) యథాతథంగా కాపాడాలి. వార్తను చప్పగా లేదా నిర్జీవంగా మార్చరాదు.
   - రాజకీయ సవాళ్లు/పోరాటాల్లో ఆ వాడి, వేడి, ఘాటు అలాగే ఉండాలి.
   - రైతుల కష్టాలు, పేదల ఆవేదన, బాధితుల గోడులో కరుణ రసం, వారి గుండెకోత, కన్నీటి వ్యథ ప్రతిధ్వనించాలి.
   - ప్రమాదాలు, ప్రకృతి విపత్తుల్లో గంభీరమైన వాస్తవికత, ప్రాణనష్టం, క్షతగాత్రుల పరిస్థితి తీవ్రతను నిక్కచ్చిగా తెలపాలి.
   - అవినీతి, మోసాలు, నేరాల్లో పదునైన పరిశోధనా శైలి ఉండాలి.

7. ⚡ సజీవ జర్నలిస్టిక్ క్రియా పదాలు (DYNAMIC ACTION VERBS - BAN MONOTONY):
   - ప్రతి వాక్యానికీ "అన్నారు... తెలిపారు... పేర్కొన్నారు" వంటి రొటీన్, యాంత్రిక క్రియా పదాలను పదేపదే వాడటం పూర్తిగా నిషిద్ధం!
   - సందర్భానికి తగిన శక్తివంతమైన తెలుగు క్రియా పదాలను వాడాలి:
     * ఘాటైన ఆరోపణలు/పోరాటం: "ధ్వజమెత్తారు", "నిలదీశారు", "తీవ్రస్థాయిలో విరుచుకుపడ్డారు", "మండిపడ్డారు", "ఆగ్రహం వ్యక్తం చేశారు".
     * కరాఖండి నిర్ణయాలు/హెచ్చరికలు: "తేల్చిచెప్పారు", "హెచ్చరించారు", "స్పష్టం చేశారు", "సవాల్ విసిరారు", "ఖరాఖండీగా ప్రకటించారు".
     * రైతాంగం/బాధితుల వేదన: "ఆవేదన వ్యక్తం చేశారు", "కన్నీటిపర్యంతమయ్యారు", "గోడు వెళ్లబోసుకున్నారు", "వాపోయారు".
     * అధికారిక వివరణలు/రక్షణ: "స్పందించారు", "వివరణ ఇచ్చారు", "సమర్థించుకున్నారు", "స్పష్టతనిచ్చారు", "హామీ ఇచ్చారు".

8. 🏆 అత్యున్నత ప్రాధాన్యత: సందర్భానుసార శీర్షిక & పంచ్ డైలాగ్ నిబంధన (CONTEXT-AWARE HEADLINES & PUNCH DIALOGUE - ABSOLUTE FIRST PRIORITY):
   హెడ్‌లైన్ చదివేటప్పుడు ఎక్కడా బ్రేక్ లేకుండా, మొదటి పదం నుండి చివరి పదం వరకు ఒకే తాటిపై నడిచే స్వచ్ఛమైన ఏక వాక్యంగా (Single Unbroken Flow) ఉండాలి. వార్తలోని మూల స్వభావానికి (Context) తగినట్లుగా శీర్షిక ఉండాలి:

   ఎ. సందర్భానుసార శీర్షిక (Context-Aware Headlines):

   * 1. రాజకీయ విమర్శలు, సవాళ్లు, ఆరోపణలు (POLITICAL CHARGES & CLASHES):
      - ఘాటైన పంచ్ డైలాగ్ + స్పష్టమైన ఆపాదింపు (Attribution) ఉండాలి.
      - మాట్లాడిన వారి ప్రసంగం లేదా ప్రకటనలోని అత్యంత పదునైన, ఘాటైన పంచ్ డైలాగ్‌ను / ప్రధాన ఆరోపణనే హెడ్‌లైన్‌లో ప్రధాన భాగంగా తీసుకోవాలి!
      - చప్పని పదాలు ("సమీక్ష", "స్పందన", "సమావేశం", "విమర్శలు", "ప్రకటన") పూర్తిగా నిషిద్ధం!
      - వాక్య నిర్మాణం: [ఘాటైన పంచ్ డైలాగ్ / ఆరోపణ సారాంశం] అంటూ/అని [ఎవరిపై] [నాయకుడి పేరు] [తీవ్ర ఆగ్రహం / ధ్వజం / సవాల్ / నిప్పులు].
      - ఉదాహరణ: "ప్రజలను దగా చేశారంటూ కూటమి సర్కార్పై జగన్ తీవ్ర ఆగ్రహం" (8 పదాలు)
      - ఉదాహరణ: "అక్రమ కేసులతో బెదిరించలేరంటూ కాంగ్రెస్ సర్కార్‌కు కేటీఆర్ సవాల్" (7 పదాలు)
      - ఉదాహరణ: "కేంద్ర ఎన్నికల సంఘం నిర్ణయంపై రాహుల్ గాంధీ నిప్పులు" (7 పదాలు)

   * 2. రైతాంగ వ్యథ, పేదల ఆవేదన, ప్రజా సమస్యలు (FARMERS, POOR & PUBLIC AGONY):
      - హృదయాన్ని కదిలించే కరుణ రసం, రూపకాలు ఉండాలి.
      - ఉదాహరణ: "ఆశల పందిరి కూలి కన్నీటి సంద్రమైన అన్నదాత బతుకు చిత్రం" (8 పదాలు)
      - ఉదాహరణ: "గిట్టుబాటు ధర లేక పంటను రోడ్డుపై పారబోసిన మిర్చి రైతులు" (8 పదాలు)

   * 3. ప్రమాదాలు, విషాదాలు, విపత్తులు (ACCIDENTS, TRAGEDIES & DISASTERS):
      - గంభీరమైన, వాస్తవికతతో కూడిన శైలి (కవిత్వాలు, పంచ్లు లేకుండా).
      - ఉదాహరణ: "నెత్తురోడిన జాతీయ రహదారిపై లారీ ఢీకొని నలుగురు దుర్మరణం" (7 పదాలు)
      - ఉదాహరణ: "కొండచరియలు విరిగిపడి సీలేరు రహదారిలో స్తంభించిన రాకపోకలు" (7 పదాలు)
      - ఉదాహరణ: "వరద ఉధృతిలో కొట్టుకుపోయిన కారుతో ఇద్దరు గల్లంతు" (6 పదాలు)

   * 4. ప్రభుత్వ పథకాలు, అభివృద్ధి పనులు, శుభవార్తలు (GOVT SCHEMES & DEVELOPMENT):
      - ఉత్తేజభరితమైన, ప్రజలకు కలిగే ప్రత్యక్ష ప్రయోజనాన్ని సూటిగా తెలిపే శైలి (వ్యక్తుల ఆపాదింపు లేకుండా).
      - ఉదాహరణ: "రైతుల ఖాతాల్లోకి నేడే రైతు భరోసా నిధుల జమ" (7 పదాలు)
      - ఉదాహరణ: "రాయలసీమలో లక్ష కోట్లతో మెగా హార్టికల్చర్ హబ్" (7 పదాలు)
      - ఉదాహరణ: "రాష్ట్రంలో పదివేల ఉపాధ్యాయ పోస్టుల భర్తీకి గ్రీన్ సిగ్నల్" (7 పదాలు)

   * 5. నేరాలు, దోపిడీలు, పోలీస్ దాడులు (CRIMES & POLICE RAIDS):
      - పదునైన క్రైమ్ రిపోర్టింగ్.
      - ఉదాహరణ: "సికింద్రాబాద్‌లో సినీ ఫక్కీలో భారీ దోపిడీ.. అంతర్రాష్ట్ర ముఠా అరెస్ట్" (లేదా "సికింద్రాబాద్‌లో సినీ ఫక్కీలో భారీ దోపిడీకి పాల్పడ్డ ముఠా అరెస్ట్")

   * 6. విద్య, ఉద్యోగాలు, పరీక్ష ఫలితాలు:
      - శైలి: సూటిగా స్పష్టమైన అప్‌డేట్.
      - ఉదాహరణ: "వైద్య విద్య ప్రవేశాల నీట్ పీజీ ఫలితాలు విడుదల" (6 పదాలు)
   
   - కఠిన సార్వత్రిక నిబంధనలు (UNIVERSAL RULES FOR ALL HEADLINES):
      1. ఖచ్చితంగా 6 నుండి 8 పదాలు మాత్రమే, సంపూర్ణ అర్ధవంతమైన వాక్యం (STRICTLY 6 TO 8 WORDS, COMPACT & CRISP).
      2. మొదటి పదం నుండి చివరి పదం వరకు కేవలం ఒకే ఒక్క నిరంతర సంపూర్ణ వాక్యం (STRICTLY ONE CONTINUOUS SENTENCE) - కొటేషన్లు ('...', "..."), కోలన్లు (:) పూర్తిగా నిషిద్ధం! ఎక్కడా రెండు ముక్కలుగా విరగ్గొట్టరాదు.
      3. 🛑 చప్పని నామవాచక ముగింపులు మరియు పాసివ్ శైలి పూర్తిగా నిషిద్ధం:
         - వాక్యం చివర '...విమర్శలు', '...ప్రకటన', '...నిలిపివేత', '...సమీక్ష', '...స్పందన', '...వేడుకలు', '...పర్యటన' వంటి చప్పని నామవాచకాలతో లేదా '...చేసిన ఫలానా' వంటి పాసివ్ ముగింపులతో ఎట్టిపరిస్థితుల్లోనూ ముగించరాదు!
         - సజీవమైన ప్రభావం లేదా కార్యాచరణను తెలిపే పదాలతో మాత్రమే ముగియాలి.

9. సారాంశం (SUMMARY / CONTENT - STRICTLY 60 TO 70 WORDS, ఒకే సింగిల్ పేరాగ్రాఫ్):
   - కచ్చితంగా 60 నుండి 70 పదాల మధ్య మాత్రమే ఉండాలి.
   - ఒకే ఒక్క నిరంతర సింగిల్ పేరాగ్రాఫ్ (No multiple paragraphs, no newlines \n).
   - మాట్లాడిన వారి పేరు (Post Author), అసలు వాదనలు, కీలక నిర్ణయాలు, సంఖ్యలతో కూడిన స్పష్టమైన వార్త. కథనం మొదటి వాక్యంగా Post Author పేరు మరియు వివరాలు తప్పనిసరి.

10. పూర్తి వార్తా కథన నిబంధన (FULL STORY RULES - ట్వీట్ సమాచారం ఆధారంగా):
${hasSubstantialTweet ? `   - 'fullStoryTe': మూల ట్వీట్/పోస్ట్‌లో తగినంత విస్తృత సమాచారం (${tweetWords} పదాలు, 80+ కంటే ఎక్కువ) ఉంది కాబట్టి, ఉన్న వాస్తవాల ఆధారంగా మాత్రమే 3-4 విడివిడి పేరాగ్రాఫ్‌లలో (\\n\\n తో) పూర్తి కథనం రాయండి. కల్పితాలు వద్దు (NO HALLUCINATIONS).
   - 3-4 విడివిడి పేరాగ్రాఫ్‌ల విభజన (\\n\\n తప్పనిసరి, ❌ ఒకే ముద్దగా రాయడం నిషిద్ధం):
     * 1వ పేరా (ఆసక్తికర హుక్ & మూల సంఘటన - ~60-80 పదాలు): ప్రధాన సంఘటన, కీలక ప్రకటన, మాట్లాడిన వ్యక్తికి స్పష్టమైన ఆపాదింపు.
     * 2వ పేరా (నేపథ్యం, సంఖ్యలు & పూర్వాపరాలు - ~80-100 పదాలు): నిర్ణయం నేపథ్యం, గణాంకాలు, కేటాయింపులు, వాస్తవ వివరాలు.
     * 3వ పేరా (సందర్భోచిత సమతుల్యత - ~70-90 పదాలు): రాజకీయ వివాదమైతే ప్రత్యర్థి వాదన/స్పందన; ప్రభుత్వ పథకమైతే క్షేత్రస్థాయి పరిశీలన.
     * 4వ పేరా (తాజా పరిస్థితి & భవిష్యత్ పరిణామాలు - ~50-70 పదాలు): ప్రస్తుత పరిస్థితి, అధికారులు చేపట్టిన చర్యలు.
   - 'fullStoryEn': English Full Story across 3-4 paragraphs separated by \\n\\n.` : `   - మూల ట్వీట్ చిన్నదిగా ఉంది (${tweetWords} పదాలు, 80 పదాల లోపే). ట్వీట్‌లో లేని కొత్త విషయాలను, కల్పితాలను ఏమాత్రం ఊహించవద్దు (STRICT ZERO HALLUCINATIONS)!
   - అందువల్ల 'fullStoryTe': "" (పూర్తి ఖాళీ స్ట్రింగ్) మరియు 'fullStoryEn': "" (పూర్తి ఖాళీ స్ట్రింగ్) గా ఉంచాలి.
   - కార్డు కోసం 'contentTe' (కచ్చితంగా 100% తెలుగులో మాత్రమే, 60-70 పదాలు, ఒకే పేరా) మాత్రమే స్పష్టంగా రాస్తే సరిపోతుంది.`}

11. ఎడిటోరియల్ ఫిల్టర్ నిబంధనలు (EDITORIAL FILTER RULES):
   - ఆమోదం (isRelevant: true): ప్రభుత్వ అధికారిక నిర్ణయాలు, కొత్త సంక్షేమ పథకాలు, బడ్జెట్ కేటాయింపులు, అభివృద్ధి ప్రాజెక్టులు, నిర్దిష్ట ఆధారాలతో కూడిన రాజకీయ విమర్శలు, సవాళ్లు, ప్రెస్ మీట్ వివరాలు, ప్రజా సమస్యలు, ప్రమాదాలు, నేరాలు.
   - తిరస్కరణ (isRelevant: false - సున్నా వార్తా విలువ / ప్రజోపయోగం లేనివి):
     * 🛑 స్వీయ ప్రచారం, భజన, సొంత డబ్బా, నాయకుల పొగడ్తలు, పీఆర్ రీల్స్ (SELF-PRAISE, LEADER GLORIFICATION & PARTY SYCOPHANCY):
       - ఒక పార్టీ లేదా నాయకుడు తమని తాము లేదా తమ అధినేతను పొగుడుకుంటూ వేసిన పోస్టులు/ట్వీట్లు/వీడియోలు (ఉదా: "ప్రజల కోసం ప్రశ్నించే గొంతు... ప్రజా సమస్యల కోసం పోరాడే నిబద్ధత... వైఎస్ షర్మిల రెడ్డి గారు — ప్రజల పక్షాన నిలిచే నాయకత్వం", "మా నాయకుడే మా భవిష్యత్తు", "పేదల ఆశాజ్యోతి ఫలానా నేత", ర్యాలీ విజువల్స్ పీఆర్ రీల్స్, పార్టీ గీతాలు, ప్రచార నినాదాలు).
       - ఇటువంటి పోస్టులలో కొత్త ప్రభుత్వ నిర్ణయం, కొత్త పథకం, బడ్జెట్ లేదా పాలసీ సమాచారం ఏమీ ఉండదు. కేవలం సొంత భజన మాత్రమే. దీనిలో ప్రజలకు ఎలాంటి ఉపయోగం (Public Utility) గానీ, వార్తా ఆసక్తి (Public Interest) గానీ లేవు. అసలు దీనిని వార్తాంశంగా స్వీకరించాల్సిన పనేలేదు! ఖచ్చితంగా తిరస్కరించాలి (isRelevant: false).
     * 🛑 రొటీన్ ఫోటో-ఆప్స్, సాధారణ సమీక్షలు, పుస్తక/పోస్టర్ ఆవిష్కరణలు (ROUTINE PHOTO-OPS & CASUAL MEETINGS - ZERO NEWS VALUE):
       - ప్రజా ప్రయోజనం, కొత్త పాలసీ నిర్ణయం లేదా బడ్జెట్ కేటాయింపులు ఏమీ లేకుండా కేవలం కలెక్టర్ లేదా ప్రజాప్రతినిధి ఒక పోస్టర్‌ను ఆవిష్కరించడం (ఉదా: "వయోవృద్ధుల దినోత్సవ పోస్టర్ ఆవిష్కరణ"), సాధారణ పరిచయ సమీక్ష నిర్వహించడం, పుష్పగుచ్ఛాలు ఇవ్వడం, కేవలం జ్యోతి ప్రజ్వలనలు వంటివి వార్తలు కావు! ఖచ్చితంగా తిరస్కరించాలి (isRelevant: false).
     * అసభ్యకరమైన తిట్లు, బూతులు, వ్యక్తిగత దూషణలు, ఇంటర్నెట్ ట్రోల్ మీమ్స్ (isRelevant: false).
     * కేవలం క్యాజువల్ వ్యక్తిగత పుట్టినరోజు శుభాకాంక్షలు, రొటీన్ పండుగ విషెస్ (ఎటువంటి సేవా కార్యక్రమాలు లేదా అభివృద్ధి పనులు లేనివి) (isRelevant: false).
     * కమర్షియల్ వ్యాపార ప్రకటనలు, ప్రమోషనల్ స్పాన్సర్డ్ లింకులు (isRelevant: false).

11.1 📰 అధికారిక ప్రెస్ నోట్ / లెటర్ హెడ్ పరిశీలన (OFFICIAL PRESS NOTE OCR):
   - ఒకవేళ జతచేసిన చిత్రంలో అధికారిక ప్రెస్ నోట్, ప్రభుత్వ జీవో లేదా లెటర్ హెడ్ ఉన్నట్లయితే: ఆ పత్రంలోని ముఖ్యాంశాలు, అంకెలు, ప్రకటనలను శ్రద్ధగా చదివి వార్తలో చేర్చండి.

12. స్వచ్ఛమైన తెలుగు లిపి & కఠిన భాషా విభజన (100% PURE TELUGU SCRIPT - STRICT NO ENGLISH IN TELUGU FIELDS):
   - 'headline', 'contentTe', 'fullStoryTe' ఫీల్డ్‌లు తప్పనిసరిగా 100% స్వచ్ఛమైన తెలుగు లిపిలోనే (Unicode U+0C00-U+0C7F) ఉండాలి. ఒక్క ఇంగ్లీష్ వాక్యం కూడా వీటిలో రాకూడదు!
   - అబ్రివియేషన్లకు మాత్రమే ఇంగ్లీష్/నంబర్లు (ఉదా: TDP, BRS, BJP, ₹).
   - 'headlineEn', 'contentEn', 'fullStoryEn' మాత్రమే ఇంగ్లీష్‌లో ఉండాలి.
   - కన్నడ, హిందీ/దేవనాగరి, ఉర్దూ, తమిళం లేదా మలయాళం అక్షరాలు రాకూడదు.
   - ఇతర భాషల పేర్లను స్వచ్ఛమైన తెలుగులోకి లిప్యంతరీకరించాలి (ఉదా: 'నరేంద్ర మోదీ', 'రాహుల్ గాంధీ', 'నారా లోకేష్', 'ఒవైసీ', 'వక్ఫ్').

13. మీడియా & లోగోల తిరస్కరణ:
   - మీడియా కేవలం లోగో, ఛానల్ చిహ్నం లేదా బ్రాండ్ కార్డ్ అయితే mediaUrl ని "" గా ఉంచాలి.

14. అవుట్‌పుట్ ఫార్మాట్ (Strict JSON only):
{"isRelevant": true|false, "headline": "దశ 1: స్వచ్ఛమైన తెలుగు శీర్షిక (కచ్చితంగా తెలుగులో, 7-9 పదాలు, సంపూర్ణ వాక్యం, కొటేషన్లు లేవు, ఆపాదింపుతో)", "contentTe": "దశ 1: స్వచ్ఛమైన తెలుగు సారాంశం (ఇన్‌పుట్ ఏ భాషలో ఉన్నా సరే ఇక్కడ 100% తెలుగు లిపిలోనే, 60-70 పదాలు, ఒకే పేరాగ్రాఫ్, ఆపాదింపుతో)", "fullStoryTe": "${hasSubstantialTweet ? "పూర్తి వార్త - సీనియర్ ఎడిటర్ కథనం (3-4 విడివిడి పేరాగ్రాఫ్‌లు \\\\n\\\\n తో, ఆపాదింపుతో)" : ""}", "headlineEn": "దశ 2: English Headline translated from Telugu headline (7-9 words)", "contentEn": "దశ 2: English Summary translated from contentTe (50-60 words)", "fullStoryEn": "${hasSubstantialTweet ? "English Full Story in 2-4 paragraphs separated by \\\\n\\\\n" : ""}", "location": "Location", "storyFingerprint": "subject-action-words", "refinedCategory": "Category", "tags": [], "entities": {"people":[], "organizations":[], "locations":[]}, "mediaUrl": "url", "mediaType": "image", "isWide": false}`;

                const markItemUrls = async (tItem) => {
                    const urls = tItem.allUrls && tItem.allUrls.length > 0 ? tItem.allUrls : [tItem.url];
                    for (const u of urls) {
                        await markUrlAsProcessed(u);
                    }
                };

                const speakerFromText = extractSpeakerFromTweet(item.text);
                let postInputText = `POST SOURCE / AUTHOR: ${authorDisplayName} (${handleTag})\n`;
                if (speakerFromText) {
                    postInputText += `MANDATORY SPEAKER / STATEMENT GIVER: ${speakerFromText}\n`;
                }
                postInputText += `POST TEXT:\n${item.text}`;

                // Selective Vision OCR: If tweet text is very short (< 60 chars) but has an attached genuine image,
                // it is likely an official press statement / letterhead / GO. Pass image to Gemini Vision!
                // If tweet text is already long (> 60 chars) or media is just an avatar, pass null to prevent hallucinations.
                const isShortTextWithImage = item.text.length < 60 && item.mediaUrl && !isGenericImage(item.mediaUrl) && !item.mediaUrl.includes('profile_images');
                const imageToProcess = isShortTextWithImage ? item.mediaUrl : null;
                const aiResult = await processWithGemini(postInputText, prompt, imageToProcess);
                if (!aiResult) continue;

                try {
                    const parsed = JSON.parse(aiResult.replace(/```json|```/g, '').trim());
                    const validContent = parsed.contentTe || parsed.content || '';
                    if (!parsed.isRelevant || !parsed.headline || !validContent) {
                        console.log(`[TWITTER] ⏭️ Filtered out non-news/satirical post for @${handle}: "${(item.text || '').substring(0, 45).replace(/\n/g, ' ')}..."`);
                        await markItemUrls(item);
                        continue;
                    }
                    parsed.content = validContent;

                    // Clean headline immediately (strictly remove all quotes, colons, double-dots)
                    parsed.headline = cleanTeluguHeadline(parsed.headline);
                    if (parsed.headlineEn) {
                        parsed.headlineEn = cleanEnglishHeadline(parsed.headlineEn);
                    }
                    if (!parsed.headline) {
                        await markItemUrls(item);
                        continue;
                    }

                    // Check for party flattery / sycophancy or editorial verdict without attribution
                    if (isEditorialVerdictOrFlattery(parsed.headline, item.text, authorDisplayName)) {
                        console.log(`[TWITTER] 🛑 Rejected party flattery / editorial verdict without attribution for @${handle}: "${parsed.headline}"`);
                        await markItemUrls(item);
                        continue;
                    }

                    // 1. Headline similarity deduplication with Entity/Speaker Awareness
                    if (parsed.headline) {
                        const isDupHeadline = recentHeadlinesMemoryCache.some(cachedHeadline => {
                            const similarity = calculateTextSimilarity(parsed.headline, cachedHeadline);
                            if (similarity >= 0.70) {
                                // Check if person entity is different (e.g. Jagan vs KTR vs Harish Rao)
                                const currentPerson = parsed.entities?.people?.[0] || '';
                                if (currentPerson && currentPerson.length > 2 && !cachedHeadline.includes(currentPerson)) {
                                    return false; // Different person speaking, NOT a duplicate!
                                }
                                return true;
                            }
                            return false;
                        });
                        if (isDupHeadline) {
                            console.log(`[TWITTER] ⏭️ Duplicate story (headline similarity hit) for @${handle}: "${parsed.headline}"`);
                            await markItemUrls(item);
                            continue;
                        }
                    }

                    // 2. Deduplication via storyFingerprint
                    if (parsed.storyFingerprint) {
                        if (storyFingerprintMemoryCache.has(parsed.storyFingerprint)) {
                            console.log(`[TWITTER] ⏭️ Duplicate story (memory hit): ${parsed.storyFingerprint}`);
                            await markItemUrls(item);
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
                            await markItemUrls(item);
                            continue;
                        }
                        storyFingerprintMemoryCache.add(parsed.storyFingerprint);
                    }

                    const reporter = getRandomReporter();
                    const category = parsed.refinedCategory || feed.category || 'Politics';
                    let finalDistrict = "General";
                    if (feed.district) {
                        finalDistrict = feed.district;
                    } else if (GLOBAL_CATEGORIES.includes(category)) {
                        finalDistrict = category;
                    }

                    let finalMediaUrl = ALFA_NEWS_LOGO;
                    const rawMedia = (item.mediaUrl && item.mediaUrl.startsWith('http')) ? item.mediaUrl : 
                                     ((item.avatarUrl && item.avatarUrl.startsWith('http')) ? item.avatarUrl : 
                                     ((parsed.mediaUrl && parsed.mediaUrl.startsWith('http')) ? parsed.mediaUrl : null));
                    if (rawMedia && !isGenericImage(rawMedia)) {
                        const uploadedUrl = await uploadMediaToStorage(rawMedia);
                        if (uploadedUrl) {
                            finalMediaUrl = uploadedUrl;
                        } else {
                            finalMediaUrl = `https://wsrv.nl/?url=${encodeURIComponent(rawMedia)}&output=webp`;
                        }
                    }

                    // Enforce pure Telugu script & Single Paragraph
                    const cleanedHeadline = parsed.headline;
                    let rawContentTe = parsed.contentTe || parsed.content || '';
                    let rawContentEn = parsed.contentEn || '';

                    // Check if content was swapped or generated in English
                    if (!isTeluguScript(rawContentTe) && isTeluguScript(rawContentEn)) {
                        console.log(`[TWITTER] 🔄 Swapping English/Telugu content fields for @${handle}`);
                        const tmp = rawContentTe;
                        rawContentTe = rawContentEn;
                        rawContentEn = tmp;
                    } else if (!isTeluguScript(rawContentTe)) {
                        console.warn(`[TWITTER] ⚠️ content was returned in English for @${handle}. Checking fullStoryTe fallback...`);
                        if (!rawContentEn && rawContentTe) rawContentEn = rawContentTe;
                        if (parsed.fullStoryTe && isTeluguScript(parsed.fullStoryTe)) {
                            rawContentTe = parsed.fullStoryTe.split(/\r?\n\r?\n/)[0].trim();
                            console.log(`[TWITTER] ✅ Recovered Telugu content from fullStoryTe first paragraph.`);
                        }
                    }

                    const cleanedContent = sanitizeTeluguText(rawContentTe).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
                    let cleanedFullStoryTe = "";
                    let cleanedFullStoryEn = "";

                    if (hasSubstantialTweet && parsed.fullStoryTe && isTeluguScript(parsed.fullStoryTe)) {
                        const rawStory = sanitizeTeluguText(parsed.fullStoryTe).trim();
                        const storyWords = rawStory.split(/\s+/).filter(Boolean).length;
                        if (storyWords >= 80 && rawStory !== cleanedContent) {
                            cleanedFullStoryTe = formatIntoParagraphs(rawStory);
                        }
                    }

                    if (hasSubstantialTweet && parsed.fullStoryEn) {
                        const rawStoryEn = String(parsed.fullStoryEn).trim();
                        if (rawStoryEn.split(/\s+/).filter(Boolean).length >= 80) {
                            cleanedFullStoryEn = formatIntoParagraphs(rawStoryEn);
                        }
                    }

                    const cleanedTags = [...new Set([
                        ...(parsed.tags || []),
                        feed.district ? `#${feed.district.replace(/\s+/g, '_')}` : null
                    ])].filter(Boolean);

                    const finalEntities = parsed.entities || { people: [], organizations: [], locations: [] };

                    // Fix mediaType: Twitter syndication supplies static thumbnail JPGs for videos.
                    // Keep mediaType as 'video' ONLY if the URL is an actual playable video stream (mp4/m3u8),
                    // otherwise keep as 'image' to prevent app video player from choking on a static JPEG.
                    let finalMediaType = 'image';
                    if (item.mediaType === 'video' && item.mediaUrl && (item.mediaUrl.endsWith('.mp4') || item.mediaUrl.includes('.m3u8'))) {
                        finalMediaType = 'video';
                    }

                    // Fix postFormat: 1:1 for profile avatars, 16:9 for landscape photos
                    let postFormat = '16:9';
                    if (!item.mediaUrl && item.avatarUrl) {
                        postFormat = '1:1';
                    }

                    const docRef = db.collection('news').doc();
                    const newsPayload = sanitizeFirestoreData({
                        headline: { telugu: cleanedHeadline, english: parsed.headlineEn || '' },
                        content: { telugu: cleanedContent, english: rawContentEn || parsed.contentEn || '' },
                        fullStory: { telugu: cleanedFullStoryTe, english: cleanedFullStoryEn },
                        sourceUrl: item.url,
                        originalUrl: item.url,
                        sourceName: feed.sourceName || `X (@${handle})`,
                        category: category,
                        categories: [...new Set([
                            feed.sourceName || `X (@${handle})`, 
                            category, 
                            "Social", 
                            "రాజకీయం", 
                            "ముఖ్యాంశాలు",
                            ...(feed.district ? ["Local", feed.district] : [])
                        ])].filter(Boolean),
                        tags: cleanedTags,
                        entities: finalEntities,
                        district: finalDistrict || "General",
                        state: feed.state || null,
                        mandal: feed.mandal || null,
                        location: feed.district || parsed.location || 'General',
                        storyFingerprint: parsed.storyFingerprint || '',
                        mediaUrl: finalMediaUrl,
                        mediaType: finalMediaType,
                        postFormat: postFormat,
                        language: 'te',
                        type: 'news',
                        isGlobal: true,
                        isReporter: true,
                        isCitizen: false,
                        aiProcessed: true,
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

// ✅ Daily reset: IST date మారినప్పుడు social_feeds + scraping_sources లో todayProcessedCount = 0 reset
async function resetDailyCountersIfNeeded() {
    try {
        const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
        const stateRef = db.collection('scraper_state').doc('daily_reset');
        const stateDoc = await stateRef.get();
        const lastResetDate = stateDoc.exists ? stateDoc.data().lastResetDate : null;

        if (lastResetDate === todayIST) {
            console.log(`[DAILY RESET] Already reset for ${todayIST}. Skipping.`);
            return;
        }

        console.log(`[DAILY RESET] New day detected (${lastResetDate} → ${todayIST}). Resetting todayProcessedCount...`);

        const [socialSnap, scrapingSnap] = await Promise.all([
            db.collection('social_feeds').get(),
            db.collection('scraping_sources').get()
        ]);

        const batchReset = db.batch();
        socialSnap.docs.forEach(doc => batchReset.update(doc.ref, { todayProcessedCount: 0 }));
        scrapingSnap.docs.forEach(doc => batchReset.update(doc.ref, { todayProcessedCount: 0 }));
        await batchReset.commit();

        await stateRef.set({ lastResetDate: todayIST, resetAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        console.log(`[DAILY RESET] ✅ Reset complete — ${socialSnap.size} social feeds + ${scrapingSnap.size} scraping sources.`);
    } catch (err) {
        console.error('[DAILY RESET] Error:', err.message);
    }
}

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
        // ✅ Daily counter reset (IST midnight దాటితే)
        await resetDailyCountersIfNeeded();
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

                // Option C: Smart Jitter Delay between Twitter feeds
                // If there are no web sources left to interleave (or between consecutive feeds),
                // wait a polite 2 to 4 seconds random delay so Twitter/X never detects a burst pattern
                if (webDocs.length === 0 && twitterDocs.length > 0) {
                    const minDelay = parseInt(process.env.TWITTER_DELAY_MIN_MS, 10) || 2000;
                    const maxDelay = parseInt(process.env.TWITTER_DELAY_MAX_MS, 10) || 4000;
                    const jitterMs = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
                    await new Promise(resolve => setTimeout(resolve, jitterMs));
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

// Schedule to run every 1 hour between 4:00 AM and 9:00 PM IST (Cutoff at 10:00 PM IST)
// Cron triggers hourly at: 04:00, 05:00, 06:00, ..., 21:00 IST (18 runs per day)
cron.schedule('0 4-21 * * *', () => {
    console.log("Cron triggered runScraperQueue (IST 4AM-9PM Hourly)");
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
