require('dotenv').config();
const admin = require('firebase-admin');
const cron = require('node-cron');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const axios = require('axios');
const { classifyScraperNotification } = require('./notificationClassifier');
const {
    EDITIONS_CONFIG,
    ALL_NEWS_COLLECTIONS,
    getLanguageMeta,
    isTargetLanguageScript,
    cleanGenericHeadline,
    sanitizeGenericText,
    resolveScraperTarget,
    parseScraperStatesFilter,
    doesSourceMatchStateFilter,
    buildLocalizedTextMap,
    getReporterForLanguage,
    detectExpansionDistrict
} = require('./editionsConfig');
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
        this.cooldowns = new Map(); // proxyUrl -> expiresAtMs
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

    getNextProxy({ onlyHealthy = false } = {}) {
        if (this.proxies.length === 0) return null;
        const now = Date.now();
        const total = this.proxies.length;

        // Prefer a proxy not currently in cooldown
        for (let i = 0; i < total; i++) {
            const idx = (this.currentIndex + i) % total;
            const candidate = this.proxies[idx];
            const cooldownUntil = this.cooldowns.get(candidate) || 0;
            if (cooldownUntil <= now) {
                if (cooldownUntil > 0) this.cooldowns.delete(candidate);
                this.currentIndex = (idx + 1) % total;
                return candidate;
            }
        }

        if (onlyHealthy) return null;

        // All proxies are cooling down: pick the one expiring soonest instead of permanently emptying pool
        let bestIdx = 0;
        let earliestExpiry = Infinity;
        for (let i = 0; i < total; i++) {
            const exp = this.cooldowns.get(this.proxies[i]) || 0;
            if (exp < earliestExpiry) {
                earliestExpiry = exp;
                bestIdx = i;
            }
        }
        this.currentIndex = (bestIdx + 1) % total;
        return this.proxies[bestIdx];
    }

    getEarliestCooldownWaitMs() {
        if (this.proxies.length === 0) return 0;
        const now = Date.now();
        let earliestExpiry = Infinity;
        for (const p of this.proxies) {
            const exp = this.cooldowns.get(p) || 0;
            if (exp <= now) return 0;
            if (exp < earliestExpiry) earliestExpiry = exp;
        }
        return earliestExpiry === Infinity ? 0 : Math.max(0, earliestExpiry - now);
    }

    markCooldownProxy(proxyUrl, durationMs = 5 * 60 * 1000, reason = 'rate-limit') {
        if (!proxyUrl || !this.proxies.includes(proxyUrl)) return;
        const clean = proxyUrl.includes('@') ? proxyUrl.split('@')[1] : proxyUrl;
        this.cooldowns.set(proxyUrl, Date.now() + durationMs);
        console.warn(`[PROXY] ⏳ Cooldown proxy ${clean} for ${Math.round(durationMs / 1000)}s (${reason}). Healthy: ${this.getHealthyProxyCount()}/${this.proxies.length}`);
    }

    markBadProxy(proxyUrl) {
        if (!proxyUrl) return;
        const initialCount = this.proxies.length;
        this.proxies = this.proxies.filter(p => p !== proxyUrl);
        this.cooldowns.delete(proxyUrl);
        if (this.proxies.length < initialCount) {
            const clean = proxyUrl.includes('@') ? proxyUrl.split('@')[1] : proxyUrl;
            console.warn(`[PROXY] 🚫 Quarantined bad auth proxy ${clean}. Remaining active proxies: ${this.proxies.length}`);
            if (this.currentIndex >= this.proxies.length) {
                this.currentIndex = 0;
            }
        }
    }

    getHealthyProxyCount() {
        const now = Date.now();
        return this.proxies.filter(p => (this.cooldowns.get(p) || 0) <= now).length;
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
    'dummy.jpg', 'dummy.png', 'share_image', 'og_default', 'fb_share', 'twitter_share',
    'header_sun', 'eenadu_sun', 'eenadu_header', 'eenadu_red', 'eenadu_logo',
    'toi_logo', 'toi-logo', 'timesofindia_logo', 'sakshi_logo', 'sakshi-logo',
    'aj_logo', 'ntnews_logo', 'tv9_logo', 'v6_logo', 'abp_logo', 'abp_live',
    'etv_logo', 'bharat_logo', 'hmtv_logo', 'mahaa_logo', '10tv_logo', 'ap7am_logo',
    'telugustop_logo', 'tv5_logo', 'ntv_logo', 'aajtak_logo', 'news18_logo',
    'greatandhra_logo', 'gulte_logo', 'thehindu_logo', 'deccanchronicle_logo', 'watermark', 'banner_logo',
    'static.toiimg.com/photo/108381831', 'static.toiimg.com/photo/4752938',
    'scorecardresearch.com', 'google-analytics', 'facebook.com/tr',
    'assets/_images/logos/', 'assets/_images/banners/', '_site.webp', 'e-paper.webp', 'bell-icon.webp', 'gg-pref.gif',
    'andhra-pradesh-logo.webp', 'telangana-logo.webp', 'eenadu.webp',
    'assets/images/logos/', 'assets/images/logo.webp', 'assets/avif_logos/'
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

    // Vector icons, animations, tracking pixels, or favicons
    if (lowerUrl.endsWith('.svg') || lowerUrl.endsWith('.gif') || lowerUrl.endsWith('.ico') || 
        lowerUrl.includes('.svg?') || lowerUrl.includes('.gif?') || lowerUrl.includes('.ico?') ||
        lowerUrl.includes('favicon') || lowerUrl.includes('tracking') || lowerUrl.includes('1x1') || lowerUrl.includes('blank.png')) {
        return true;
    }

    // Exact or partial logo file name match
    if (/(?:logo|brand_logo|masthead|watermark|banner_logo|site_logo|sitelogo|header_logo|header-logo|footer_logo|footer-logo|app_logo|app-logo)[-_a-z0-9]*\.(?:png|jpg|jpeg|webp|avif)/i.test(lowerUrl)) {
        return true;
    }

    // Directory-level logo/banner assets
    if (/\/(?:logos|branding|placeholders|watermarks|brand_assets|avif_logos|site_logos|_images\/banners)\//i.test(lowerUrl)) {
        return true;
    }

    // ETV / ETV Bharat specifics: reject known logo/banner assets, but accept all article media
    if (lowerUrl.includes('etvbharat') || lowerUrl.includes('etv.co.in')) {
        if (lowerUrl.includes('/logo') || lowerUrl.includes('_logo') || lowerUrl.includes('-logo') || lowerUrl.includes('default_image') || lowerUrl.includes('placeholder')) {
            return true;
        }
        // Genuine ETV Bharat article media
        if (lowerUrl.includes('/prod-images/') || lowerUrl.includes('/article/') || lowerUrl.includes('/photos/') || lowerUrl.includes('/news/')) {
            return false;
        }
    }

    // Eenadu specifics: reject known header/brand/ad-banner assets, accept all real article media
    if (lowerUrl.includes('eenadu.net')) {
        if (lowerUrl.includes('_assets/_images/logos') ||
            lowerUrl.includes('_assets/_images/banners') ||
            lowerUrl.includes('/_assets/') ||
            lowerUrl.includes('_site.webp') ||
            lowerUrl.includes('e-paper.webp') || 
            lowerUrl.includes('bell-icon.webp') || 
            lowerUrl.includes('gg-pref') ||
            lowerUrl.includes('eenadu.webp') || 
            lowerUrl.includes('andhra-pradesh-logo') || 
            lowerUrl.includes('telangana-logo') ||
            lowerUrl.includes('eenadu_sun') ||
            lowerUrl.includes('eenadu_header') ||
            lowerUrl.includes('eenadu_logo')) {
            return true;
        }
        // Genuine article media across Eenadu CDN paths
        const isActualArticleImage = lowerUrl.includes('/article_img/') ||
                                     lowerUrl.includes('/article_multiple_images/') ||
                                     lowerUrl.includes('/article_images/') ||
                                     lowerUrl.includes('/featureimages/') ||
                                     lowerUrl.includes('/video_images/') ||
                                     lowerUrl.includes('/metaimages/') ||
                                     lowerUrl.includes('/districts/') || 
                                     lowerUrl.includes('/uploads/') || 
                                     lowerUrl.includes('/photos/') || 
                                     lowerUrl.includes('/stories/') || 
                                     lowerUrl.includes('/news/') || 
                                     lowerUrl.includes('_1.jpg') || 
                                     lowerUrl.includes('_1.webp');
        if (isActualArticleImage) return false;
    }

    // Check generic blacklist patterns
    if (GENERIC_IMAGE_PATTERNS.some(p => lowerUrl.includes(p))) {
        // Exception: actual article image with specific folder paths
        if (lowerUrl.includes('/article_img/') ||
            lowerUrl.includes('article_images/') || 
            lowerUrl.includes('article_multiple_images/') || 
            lowerUrl.includes('/uploads/') || 
            lowerUrl.includes('/featureimages/') ||
            lowerUrl.includes('/prod-images/') ||
            lowerUrl.includes('/photogallery/')) {
            return false;
        }
        return true;
    }

    return false;
}

const NEWS_AGGREGATOR_PATTERNS = [
    'teluguscribe', 'telugu scribe', 'greatandhra', 'great andhra', 'ap7am', 'gulte',
    'samayam', 'eenadu', 'sakshi', 'andhrajyothy', 'andhra jyothy', 'abntelugu', 'abn',
    'tv9', 'ntv', 'tv5', '10tv', 'v6news', 'v6 news', 'hmtv', 'abpdesam', 'abp desam',
    'news18', 'etvbharat', 'etv bharat', 'bigtv', 'mahaanews', 'mahaa news', 'way2news',
    'telugu360', 'tupaki', 'mirchi9', 'm9news', 'indiaglitz', 'telugustop', '123telugu',
    'chitrajyothy', 'namasthetelangana', 'telanganatoday', 'thehansindia', 'hansindia',
    'deccanchronicle', 'thehindu', 'timesofindia', 'hindustantimes', 'indianexpress',
    'siasat', 'dishadaily', 'prajasakti', 'vaartha', 'oneindia', 'filmibeat', 'ani', 'pti',
    'telugubulletin', 'teluguglobal', 'ntnews', 'tnews', 'rtvlive', 'prime9', 'cvrnews',
    'manatelangana', 'andhraprabha', 'visalaandhra', 'navatelangana', 'bhaarat', 'newsmeter'
];

/**
 * Identifies whether a social account / source name is a news portal, TV channel, or aggregator.
 * Aggregators must NEVER be credited as the speaker ("తెలుగు స్క్రైబ్ వెల్లడించింది") and
 * their profile avatars must NEVER be used as fallback news photos.
 */
function isNewsAggregatorOrPortal(authorName = '', handle = '') {
    const combined = `${authorName || ''} ${handle || ''}`.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const compact = combined.replace(/\s+/g, '');
    return NEWS_AGGREGATOR_PATTERNS.some(p => {
        const cleanP = p.replace(/\s+/g, '');
        if (cleanP.length <= 3) {
            // Exact word/handle match for short tokens like ani, pti, ntv, tv9, tv5, abn, abp
            return new RegExp(`(?:^|\\s)${cleanP}(?:$|\\s|telugu|news|live|digital)`).test(combined) || compact === cleanP;
        }
        return compact.includes(cleanP);
    });
}

/**
 * Strips accidental external news portal / aggregator attribution phrases so articles always
 * read cleanly in Alfa News's own original newsroom voice.
 */
function stripAggregatorAttribution(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/(?:తెలుగు\s*స్క్రైబ్|గ్రేట్\s*ఆంధ్ర|ఏపీ\s*7\s*ఏఎం|గుల్టే|సమయం\s*తెలుగు|సమయం|ఈనాడు|సాక్షి|ఆంధ్రజ్యోతి|ఏబీఎన్|టీవీ\s*9|ఎన్టీవీ|టీవీ\s*5|10\s*టీవీ|వీ\s*6|హెచ్‌ఎంటీవీ|ఏబీపీ\s*దేశం|న్యూస్\s*18|ఈటీవీ\s*భారత్|వే2న్యూస్|తెలుగు\s*360|తుపాకీ|ఏఎన్ఐ|పీటీఐ)\s*(?:వెల్లడించింది|వెల్లడించారు|తెలిపింది|తెలిపారు|పేర్కొంది|పేర్కొన్నారు|నివేదించింది|ట్వీట్\s*చేసింది|ప్రకటించింది|ప్రకారం)[.,]?\s*/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Validates that a downloaded buffer is a genuine raster image (not HTML/403/1x1 pixel).
 */
function isValidImageBuffer(buffer, contentType = '') {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4000) return false;
    const ct = String(contentType || '').toLowerCase();
    if (ct && (ct.includes('text/html') || ct.includes('application/json') || ct.includes('image/svg') || ct.includes('image/gif'))) {
        return false;
    }
    // Check magic bytes: JPEG (FF D8 FF), PNG (89 50 4E 47), WebP (RIFF....WEBP), AVIF/HEIC (ftyp)
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isWebp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    const isAvif = buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp';
    return isJpeg || isPng || isWebp || isAvif;
}

/**
 * Downloads and validates an image buffer with 3-tier fallback:
 * 1. Direct fetch with smart domain Referer
 * 2. Direct fetch without Referer
 * 3. wsrv.nl edge proxy (bypasses Cloudflare/hotlink blocks)
 */
async function fetchValidatedImageBuffer(url, { maxWidth = null, timeout = 12000 } = {}) {
    if (!url || !url.startsWith('http') || isGenericImage(url)) return null;

    let referer = 'https://www.google.com/';
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname.includes('eenadu.net')) referer = 'https://www.eenadu.net/';
        else if (parsedUrl.hostname.includes('sakshi.com')) referer = 'https://www.sakshi.com/';
        else referer = `${parsedUrl.protocol}//${parsedUrl.hostname}/`;
    } catch (e) {}

    const baseHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/jpeg,image/png,image/*;q=0.8'
    };

    const normalizeMime = (buf, headerCt) => {
        if (buf[0] === 0x89 && buf[1] === 0x50) return { contentType: 'image/png', extension: 'png' };
        if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { contentType: 'image/webp', extension: 'webp' };
        if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') return { contentType: 'image/avif', extension: 'avif' };
        if (buf[0] === 0xFF && buf[1] === 0xD8) return { contentType: 'image/jpeg', extension: 'jpg' };
        const ct = String(headerCt || '').toLowerCase();
        if (ct.includes('png')) return { contentType: 'image/png', extension: 'png' };
        if (ct.includes('webp')) return { contentType: 'image/webp', extension: 'webp' };
        if (ct.includes('avif')) return { contentType: 'image/avif', extension: 'avif' };
        return { contentType: 'image/jpeg', extension: 'jpg' };
    };

    const attempts = [
        () => axios.get(url, { responseType: 'arraybuffer', timeout, headers: { ...baseHeaders, Referer: referer } }),
        () => axios.get(url, { responseType: 'arraybuffer', timeout, headers: baseHeaders }),
        () => {
            const widthParam = maxWidth ? `&w=${maxWidth}` : '';
            const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}${widthParam}&output=webp&q=80`;
            return axios.get(proxyUrl, { responseType: 'arraybuffer', timeout });
        }
    ];

    for (const attempt of attempts) {
        try {
            const res = await attempt();
            const buf = Buffer.from(res.data);
            const ct = res.headers?.['content-type'] || '';
            if (isValidImageBuffer(buf, ct)) {
                const { contentType, extension } = normalizeMime(buf, ct);
                return { buffer: buf, contentType, extension };
            }
        } catch (e) {
            // Try next fallback
        }
    }
    return null;
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
        
        // 7. Safe fixes for genuinely clumped compound loanwords
        .replace(/క్లాస్రూమ్/gu, 'క్లాస్ రూమ్')
        .replace(/బెడ్రూమ్/gu, 'బెడ్ రూమ్')
        .replace(/లివింగ్రూమ్/gu, 'లివింగ్ రూమ్')
        .replace(/షోరూమ్/gu, 'షో రూమ్')
        .replace(/బంజారాహిల్స్/gu, 'బంజారా హిల్స్')
        .replace(/జూబ్లీహిల్స్/gu, 'జూబ్లీ హిల్స్')

        // 8. Rejoin unnatural splits of native Telugu 'ల్లో' and 'ట్లో'
        .replace(/ల్\s+లో(?=[\s\p{P}]|$)/gu, 'ల్లో')
        .replace(/(ఇం|కం|నో|ఒం|గొం|పుం|తుం|పెం|చో|చె|కో)ట్\s+లో(?=[\s\p{P}]|$)/gu, '$1ట్లో')

        // 8.1 Fix numbers & currencies glued to words (e.g. 'రూ.100కోట్లు' -> 'రూ. 100 కోట్లు')
        .replace(/(రూ\.|రూ)(?=\d)/gu, 'రూ. ')
        .replace(/(\d+)(కోట్లు|కోట్ల|లక్షలు|లక్షల|వేలు|వేల|మంది|శాతం|శాతానికి|కిలోమీటర్ల?|గంటల?|రోజుల?|నెలల?|సంవత్సరాల?|ఏళ్ల|మందికి|మందితో)(?=[\s\p{P}]|$)/gu, '$1 $2')

        // 8.2 Fix punctuation glued to Telugu words without space (e.g. 'జరిగింది.దీనిపై' -> 'జరిగింది. దీనిపై')
        .replace(/([\u0C00-\u0C7F])([.,:;!?])([\u0C00-\u0C7F])/gu, '$1$2 $3')

        // 8.3 Fix conflicting collocations in positive Telugu news
        .replace(/తీవ్రంగా\s+స్పందిస్తూ(?=\s+(?:[^\s.,;]+\s+){0,4}(?:అభినంది|ప్రశంసి|హర్షం|స్వాగతి|మురిసి|జైకొ|మెచ్చుకు))/gu, 'ప్రశంసల వర్షం కురిపిస్తూ')
        .replace(/తీవ్రంగా\s+స్పందించి(?=\s+(?:[^\s.,;]+\s+){0,4}(?:అభినంది|ప్రశంసి|హర్షం|స్వాగతి|మురిసి|జైకొ|మెచ్చుకు))/gu, 'ప్రశంసల వర్షం కురిపించి')
        .replace(/తీవ్రంగా\s+స్పందించిన(?=\s+(?:[^\s.,;]+\s+){0,4}(?:అభినంది|ప్రశంసి|హర్షం|స్వాగతి|మురిసి|జైకొ|మెచ్చుకు))/gu, 'హర్షం వ్యక్తం చేసిన')
        .replace(/తీవ్రంగా\s+స్పందించారు(?=\s+[.,;]?\s*(?:అభినంది|ప్రశంసి|హర్షం|స్వాగతి))/gu, 'హర్షం వ్యక్తం చేశారు')

        // 9. Normalize multi-spaces
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

    // 2. Strip colons, semicolons, and ellipses for one clean flowing headline (aligned with backend)
    clean = clean.replace(/\s*[:;]\s*/g, ' ');
    clean = clean.replace(/\.{2,}/g, ' ');

    // 3. Remove leading or trailing punctuation
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
 * 🏛️ TOP TELUGU LEADERS (AP & TS CMs and Opposition Leaders)
 * Statements made directly by them or quoting them MUST DEFINITELY be BREAKING NEWS.
 * Leaders: Chandrababu Naidu, Revanth Reddy, Y.S. Jagan Mohan Reddy, KCR, Pawan Kalyan, Nara Lokesh, KTR
 */
const TOP_TELUGU_LEADERS = [
    {
        id: "cbn",
        nameTe: "చంద్రబాబు నాయుడు",
        nameEn: "Chandrababu Naidu",
        patterns: [
            /(?:చంద్రబాబు\s*నాయుడు|నారా\s*చంద్రబాబు|చంద్రబాబునాయుడు|సీఎం\s*చంద్రబాబు|సిఎం\s*చంద్రబాబు|ముఖ్యమంత్రి\s*చంద్రబాబు|చంద్రబాబు)/i,
            /(?:chandrababu|cbn|nara\s*chandrababu)/i
        ],
        handles: [/ncbn/i]
    },
    {
        id: "revanth",
        nameTe: "రేవంత్ రెడ్డి",
        nameEn: "Revanth Reddy",
        patterns: [
            /(?:రేవంత్\s*రెడ్డి|రేవంత్‌రెడ్డి|అనుముల\s*రేవంత్|సీఎం\s*రేవంత్|సిఎం\s*రేవంత్|ముఖ్యమంత్రి\s*రేవంత్)/i,
            /(?:revanth\s*reddy|revanthreddy|cm\s*revanth)/i
        ],
        handles: [/revanth_anumula/i]
    },
    {
        id: "jagan",
        nameTe: "వైఎస్ జగన్ మోహన్ రెడ్డి",
        nameEn: "YS Jagan Mohan Reddy",
        patterns: [
            /(?:జగన్\s*మోహన్\s*రెడ్డి|జగన్‌మోహన్‌రెడ్డి|వైఎస్\s*జగన్|వైఎస్సార్సీపీ\s*అధినేత|మాజీ\s*సీఎం\s*జగన్)/i,
            /(?:jagan\s*mohan\s*reddy|jaganmohan\s*reddy|ys\s*jagan|ysjagan)/i
        ],
        handles: [/ysjagan/i]
    },
    {
        id: "kcr",
        nameTe: "కేసీఆర్",
        nameEn: "K. Chandrashekar Rao (KCR)",
        patterns: [
            /(?:కేసీఆర్|కేసిఆర్|చంద్రశేఖర్\s*రావు|చంద్రశేఖరరావు|కల్వకుంట్ల\s*చంద్రశేఖర్|బిఆర్ఎస్\s*అధినేత\s*కేసీఆర్|బీఆర్ఎస్\s*అధినేత\s*కేసీఆర్|మాజీ\s*సీఎం\s*కేసీఆర్)/i,
            /(?:kcr|k\.\s*chandrashekar\s*rao|chandrasekhar\s*rao|kalvakuntla\s*chandrashekar)/i
        ],
        handles: [/kcrbrspresident/i]
    },
    {
        id: "pawan",
        nameTe: "పవన్ కళ్యాణ్",
        nameEn: "Pawan Kalyan",
        patterns: [
            /(?:పవన్\s*కళ్యాణ్|పవన్\s*కల్యాణ్|పవన్‌కళ్యాణ్|డిప్యూటీ\s*సీఎం\s*పవన్|ఉప\s*ముఖ్యమంత్రి\s*పవన్|జనసేనాని|జనసేన\s*అధినేత)/i,
            /(?:pawan\s*kalyan|pawankalyan|deputy\s*cm\s*pawan|janasenani)/i
        ],
        handles: [/pawankalyan/i]
    },
    {
        id: "lokesh",
        nameTe: "నారా లోకేష్",
        nameEn: "Nara Lokesh",
        patterns: [
            /(?:నారా\s*లోకేష్|నారా\s*లోకేశ్|మంత్రి\s*లోకేష్|మంత్రి\s*లోకేశ్)/i,
            /(?:nara\s*lokesh|minister\s*lokesh)/i
        ],
        handles: [/naralokesh/i]
    },
    {
        id: "ktr",
        nameTe: "కేటీఆర్",
        nameEn: "K.T. Rama Rao (KTR)",
        patterns: [
            /(?:కేటీఆర్|కేటిఆర్|తారక\s*రామారావు|తారకరామారావు|కల్వకుంట్ల\s*తారక|బిఆర్ఎస్\s*వర్కింగ్\s*ప్రెసిడెంట్|బీఆర్ఎస్\s*వర్కింగ్\s*ప్రెసిడెంట్)/i,
            /(?:ktr|kt\s*rama\s*rao|taraka\s*rama\s*rao)/i
        ],
        handles: [/ktrbrs/i]
    }
];

const ROUTINE_GREETING_INDICATORS = [
    "శుభాకాంక్షలు", "దినోత్సవ", "పుట్టినరోజు", "వర్ధంతి", "జయంతి", "నివాళులు", "సంతాపం",
    "గ్రీటింగ్స్", "హ్యాపీ", "wishes", "greetings", "condolences", "tribute", "birth anniversary", "death anniversary"
];

const STATEMENT_AND_QUOTE_INDICATORS = [
    "ప్రకటన", "ప్రకటించ", "వ్యాఖ్య", "వ్యాఖ్యానించ", "అన్నారు", "అని అన్నారు", "అంటూ",
    "తెలిపారు", "స్పష్టం", "స్పందించ", "వెల్లడించ", "ధ్వజమెత్త", "నిలదీశ", "డిమాండ్",
    "విమర్శించ", "హెచ్చరించ", "ఫైర్", "కౌంటర్", "సవాల్", "ఆగ్రహం", "పిలుపు", "హామీ",
    "నిర్ణయం", "ఆదేశించ", "ట్వీట్", "పోస్ట్", "ప్రెస్‌మీట్", "సమావేశం", "ప్రసంగం",
    "ఉటంకిస్తూ", "మాటల్లో", "పేర్కొన్న", "చెప్పిన", "వివరించిన", "స్పష్టత", "ప్రశ్నించ",
    "ఆరోపణ", "నిప్పులు", "తీవ్రంగా", "విరుచుకుపడ్డ", "మండిపడ్డ",
    "said", "remarked", "stated", "declared", "slammed", "lashed out", "demanded",
    "warned", "criticized", "tweeted", "posted", "announced", "reacted", "press meet",
    "speech", "quoted", "urged", "countered", "alleged", "clarified"
];

function isTopTeluguLeaderStatement(text = '', headline = '', authorOrSource = '') {
    const res = detectTopTeluguLeader(headline, text, authorOrSource);
    return res.isTopLeaderNews;
}

function detectTopTeluguLeader(headline = '', content = '', authorOrSource = '') {
    const h = (headline || '').trim();
    const c = (content || '').trim();
    const a = (authorOrSource || '').trim();
    const hLower = h.toLowerCase();
    const cLower = c.toLowerCase();
    const combined = `${h} ${c} ${a}`.toLowerCase();

    // 🛑 Exclude routine greetings, wishes, condolences
    const isRoutineGreeting = ROUTINE_GREETING_INDICATORS.some(g => {
        const gLower = g.toLowerCase();
        return hLower.includes(gLower) || cLower.slice(0, 180).includes(gLower);
    });
    if (isRoutineGreeting) {
        return {
            isTopLeaderNews: false,
            leaderName: '',
            isAuthor: false,
            inHeadline: false,
            isQuotedOrStatement: false
        };
    }

    for (const leader of TOP_TELUGU_LEADERS) {
        const isAuthor = leader.handles.some(rgx => rgx.test(a) || rgx.test(combined)) ||
                         leader.patterns.some(rgx => rgx.test(a));
        const inHeadline = leader.patterns.some(rgx => rgx.test(h));
        const inText = leader.patterns.some(rgx => rgx.test(combined));
        const hasStatementIndicator = STATEMENT_AND_QUOTE_INDICATORS.some(ind => {
            const indLower = ind.toLowerCase();
            return hLower.includes(indLower) || cLower.includes(indLower);
        });

        if (isAuthor || ((inHeadline || inText) && hasStatementIndicator)) {
            return {
                isTopLeaderNews: true,
                leaderName: leader.nameTe,
                isAuthor,
                inHeadline,
                isQuotedOrStatement: isAuthor || hasStatementIndicator
            };
        }
    }

    return {
        isTopLeaderNews: false,
        leaderName: '',
        isAuthor: false,
        inHeadline: false,
        isQuotedOrStatement: false
    };
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

    const specificLinks = [];
    const genericLinks = [];

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
                        specificLinks.push(absoluteUrl);
                        return;
                    }
                }
                genericLinks.push(absoluteUrl);
            }
        } catch (e) {}
    });

    const combined = (specificKeyword && specificLinks.length > 0)
        ? [...new Set([...specificLinks, ...genericLinks])]
        : [...new Set(genericLinks)];
    return combined;
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
    '.text-justify', '.story-full-text', '.full-story', '.story-details',
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
                        else if (item.image.contentUrl) jsonLdImage = item.image.contentUrl;
                        else if (Array.isArray(item.image) && item.image.length > 0) {
                            jsonLdImage = typeof item.image[0] === 'string' ? item.image[0] : (item.image[0]?.url || item.image[0]?.contentUrl || '');
                        }
                    }
                    if (item.datePublished && !jsonLdDate) {
                        jsonLdDate = parseArticleDate(item.datePublished);
                    }
                }
            }
        } catch (e) {}
    });

    // 2. Strip noise elements, tickers, related stories, and logo/banner tags from DOM (NEVER strip genuine Eenadu/Sakshi/ETV article photos!)
    $('nav, header, footer, script, style, .ads, .sidebar, .comments, aside, #sidebar, .related, .trending, .popular, .latest-news, .logo, .site-logo, .brand, .header-logo, .menu, .navigation, .social-share, .footer-tags, .tags, .widget, .promo, .about-us, .author-bio, [role="complementary"], .breadcrumb, .taboola, .outbrain, .google_ads_wrap_in_image, .next-article, .infinite-scroll, .related-stories, .side-bar, .more-news, .also-read, .trending-news, .other-news, .story-related, .news-ticker, .ticker, .scroll-news, .news-strip, .breaking-strip').remove();
    $('img[src*="logo" i], img[class*="logo" i], img[id*="logo" i], img[alt="logo" i], img[alt*="site logo" i], img[src*="_assets/_images/logos" i], img[src*="_assets/_images/banners" i], figure#dist-logo2, figure.nd-logo, figure.thumb').remove();

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

    // 5. Multi-Candidate Image Extraction (Clean in-article photos FIRST, social og:image as fallback)
    const candidateImages = [];
    const seenImgUrls = new Set();

    const addCandidateImage = (rawUrl) => {
        if (!rawUrl || typeof rawUrl !== 'string') return;
        let clean = rawUrl.trim();
        if (!clean || clean.startsWith('data:image') || clean.startsWith('blob:')) return;
        try {
            const resolved = clean.startsWith('http') ? clean : new URL(clean, articleUrl).href;
            if (!resolved || !resolved.startsWith('http')) return;
            if (isGenericImage(resolved)) return;
            // Skip UI asset icons, author avatars, social share buttons, or video play overlays (never reject news slugs mentioning social platforms)
            if (/(?:\/avatars?\/|\/icons?\/|\/emojis?\/|\/sprites?\/|\/banners?\/|\/badges?\/|play[-_]?btn|share[-_]?(?:icon|btn)|(?:whatsapp|telegram|facebook|twitter|youtube)[-_]?(?:icon|logo|share|btn)|(?:loading|loader|spinner|blank|spacer|1x1|pixel)\.(?:png|jpg|jpeg|webp|gif)|gg-pref)/i.test(resolved)) return;
            if (!seenImgUrls.has(resolved)) {
                seenImgUrls.add(resolved);
                candidateImages.push(resolved);
            }
        } catch (e) {}
    };

    const pickBestSrcsetUrl = (srcsetStr) => {
        if (!srcsetStr || typeof srcsetStr !== 'string') return '';
        // Split ONLY on comma+space followed by a URL so CDN params like w_800,q_80,f_auto are never corrupted
        const entries = srcsetStr.trim().split(/,\s+(?=https?:|\/)/);
        let bestUrl = '';
        let bestScore = -1;
        for (const entry of entries) {
            const parts = entry.trim().split(/\s+/);
            const u = parts[0];
            if (!u) continue;
            const descriptor = parts[1] || '';
            const score = descriptor.endsWith('w') ? parseInt(descriptor, 10) || 0
                        : descriptor.endsWith('x') ? Math.round((parseFloat(descriptor) || 1) * 1000)
                        : 1;
            if (score >= bestScore) {
                bestScore = score;
                bestUrl = u;
            }
        }
        return bestUrl || srcsetStr.trim().split(/\s+/)[0];
    };

    const collectDomImages = (selectorStr, maxCount = 4) => {
        $(selectorStr).each((_, el) => {
            if (candidateImages.length >= maxCount) return false;
            const w = parseInt($(el).attr('width') || '0', 10);
            const h = parseInt($(el).attr('height') || '0', 10);
            if ((w > 0 && w < 200) || (h > 0 && h < 120)) return;
            const cls = `${$(el).attr('class') || ''} ${$(el).attr('alt') || ''}`.toLowerCase();
            if (/(?:author|avatar|logo|icon|badge|emoji|ad-banner|promo)/.test(cls)) return;

            // Prefer lazy-load high-res attributes BEFORE src (src is often a 1x1 blank/loading placeholder)
            const lazyCandidates = [
                $(el).attr('data-hi-res-src'),
                $(el).attr('data-original'),
                $(el).attr('data-lazy-src'),
                $(el).attr('data-src'),
                $(el).attr('data-url'),
                $(el).attr('data-srcset') ? pickBestSrcsetUrl($(el).attr('data-srcset')) : null,
                $(el).attr('srcset') ? pickBestSrcsetUrl($(el).attr('srcset')) : null,
                $(el).attr('src')
            ];
            for (const c of lazyCandidates) {
                if (c && typeof c === 'string' && !c.trim().startsWith('data:image')) {
                    // Skip Eenadu's small related-story listing thumbnails (365X255) in favor of the actual article photo
                    if (/eenadu\.net\/featureimages\/365x255\//i.test(c)) continue;
                    const beforeLen = candidateImages.length;
                    addCandidateImage(c);
                    if (candidateImages.length > beforeLen) break;
                }
            }
        });
    };

    // Priority 1A: Exact editorial body photos first (Eenadu .text-justify / image-editor / article_img, Sakshi, NT, AJ, TV9, News18)
    collectDomImages('.text-justify img, img.image-editor, img[src*="/article_img/"], img[src*="/article_multiple_images/"], .news-story-body img, .detailBody img, .category_desc img, .ArticleBodyCont img, ._article_body img, .story-details img, .article-image img, .article-page__img-cmpnt, .story-image img, .featured-image img, .post-thumbnail img', 3);

    // Priority 1B: Broader article/figure/picture/main images if fewer than 3 found
    if (candidateImages.length < 3) {
        collectDomImages('article img, figure:not(.thumb) img, picture source, picture img, main img', 4);
    }

    // Priority 2: JSON-LD and OpenGraph / Twitter meta images as fallback candidates
    addCandidateImage(jsonLdImage);
    const metaSelectors = [
        'meta[property="og:image"]',
        'meta[property="og:image:secure_url"]',
        'meta[property="og:image:url"]',
        'meta[name="twitter:image"]',
        'meta[name="twitter:image:src"]',
        'meta[property="twitter:image"]',
        'meta[itemprop="image"]'
    ];
    for (const sel of metaSelectors) {
        if (candidateImages.length >= 5) break;
        addCandidateImage($(sel).attr('content'));
    }
    addCandidateImage($('link[rel="image_src"]').attr('href'));

    const candidateImage = candidateImages[0] || null;

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
        images: candidateImages,
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
try {
    db.settings({
        preferRest: true,
        ignoreUndefinedProperties: true
    });
    console.log("[FIRESTORE] Configured with preferRest: true (Eliminates gRPC DEADLINE_EXCEEDED).");
} catch (e) {
    console.warn("[FIRESTORE] Could not set db.settings:", e.message);
}

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

        // 2. Load recent published news across active collections (bounded .limit() per collection)
        const activeStateFilter = parseScraperStatesFilter();
        const collectionsToPrewarm = ALL_NEWS_COLLECTIONS.filter(col => {
            if (!activeStateFilter) return true;
            if (col === 'news') return activeStateFilter.has('AP') || activeStateFilter.has('TS') || activeStateFilter.has('NATIONAL');
            if (col === 'news_hi') return activeStateFilter.has('UP') || activeStateFilter.has('UK') || activeStateFilter.has('HP') || activeStateFilter.has('PB') || activeStateFilter.has('GA') || activeStateFilter.has('MN') || activeStateFilter.has('NATIONAL');
            if (col === 'news_pa') return activeStateFilter.has('PB') || activeStateFilter.has('NATIONAL');
            if (col === 'news_gu') return activeStateFilter.has('GJ') || activeStateFilter.has('NATIONAL');
            if (col === 'news_en') return true;
            return true;
        });

        for (const colName of collectionsToPrewarm) {
            try {
                const colLimit = colName === 'news' ? 2000 : 500;
                const recentNewsSnap = await db.collection(colName)
                    .orderBy('timestamp', 'desc')
                    .limit(colLimit)
                    .get();
                recentNewsSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.sourceUrl) scannedUrlMemoryCache.add(normalizeUrl(data.sourceUrl));
                    if (data.originalUrl) scannedUrlMemoryCache.add(normalizeUrl(data.originalUrl));
                    if (data.storyFingerprint) storyFingerprintMemoryCache.add(data.storyFingerprint);
                    const rawTitle = data.headline?.local || data.headline?.telugu || data.headline?.hi || data.headline?.pa || data.headline?.gu || data.headline?.english || (typeof data.headline === 'string' ? data.headline : '');
                    if (rawTitle && rawTitle.length > 5) {
                        const cleaned = colName === 'news' ? cleanTeluguHeadline(rawTitle) : cleanGenericHeadline(rawTitle);
                        if (cleaned) recentHeadlinesMemoryCache.push(cleaned);
                    }
                });
            } catch (colErr) {
                console.warn(`Prewarm skipped for ${colName}:`, colErr.message);
            }
        }

        isCachePrewarmed = true;
        console.log(`Cache pre-warmed (${collectionsToPrewarm.join(', ')}): ${scannedUrlMemoryCache.size} URLs, ${storyFingerprintMemoryCache.size} fingerprints, ${recentHeadlinesMemoryCache.length} headlines in memory.`);
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

async function uploadMediaToStorage(url, folder = 'news-media', preFetched = null) {
    if (!url || !url.startsWith('http')) return null;
    let buffer = null;
    let contentType = 'image/jpeg';
    let extension = 'jpg';

    const fetched = (preFetched && preFetched.buffer) ? preFetched : await fetchValidatedImageBuffer(url, { timeout: 15000 });
    if (!fetched) {
        console.error(`Failed to download valid image for storage: ${url}`);
        return null;
    }
    buffer = fetched.buffer;
    contentType = fetched.contentType;
    extension = fetched.extension;

    for (let uploadAttempt = 0; uploadAttempt < 2; uploadAttempt++) {
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
            console.error(`Failed to upload media to storage (attempt ${uploadAttempt + 1}/2): ${error.message}`);
            if (uploadAttempt === 0) {
                await new Promise(r => setTimeout(r, 1500));
            }
        }
    }
    return null;
}

// ============================================================================
// SINGLETON PUPPETEER BROWSER POOL (Memory & Speed Optimized)
// ============================================================================
let sharedBrowser = null;
let browserLaunchPromise = null;
let browserPageCount = 0;
let activeBrowserPages = 0;
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
    // Wait for any in-flight launch to prevent spawning multiple Chrome instances simultaneously
    if (browserLaunchPromise) {
        return await browserLaunchPromise;
    }

    if (sharedBrowser && sharedBrowser.isConnected()) {
        // Only recycle when no other tab is actively using the shared browser
        if (browserPageCount >= MAX_PAGES_BEFORE_BROWSER_RESTART && activeBrowserPages === 0) {
            console.log("[PUPPETEER] Recycling browser instance to release memory...");
            const oldBrowser = sharedBrowser;
            sharedBrowser = null;
            browserPageCount = 0;
            try {
                await oldBrowser.close();
            } catch (e) {}
        } else {
            return sharedBrowser;
        }
    }

    browserLaunchPromise = (async () => {
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
    })();

    try {
        return await browserLaunchPromise;
    } finally {
        browserLaunchPromise = null;
    }
}

async function closeSharedBrowser(force = false) {
    if (browserLaunchPromise) {
        try { await browserLaunchPromise; } catch (e) {}
    }
    if (!force && activeBrowserPages > 0) {
        return;
    }
    if (sharedBrowser) {
        const oldBrowser = sharedBrowser;
        sharedBrowser = null;
        browserPageCount = 0;
        try {
            await oldBrowser.close();
        } catch (e) {}
    }
}

async function fetchHtmlOptimized(url, signal = null, { isListingPage = false } = {}) {
    if (signal?.aborted) return null;

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
            maxRedirects: 5,
            signal: signal || undefined
        });

        if (response.status === 200 && response.data && typeof response.data === 'string' && response.data.length > 500) {
            // Skip Cloudflare / JS interstitial challenge pages on axios so Puppeteer can render them
            const lowerHtml = response.data.substring(0, 4000).toLowerCase();
            const isChallengePage = lowerHtml.includes('just a moment...') || lowerHtml.includes('cf-browser-verification') || lowerHtml.includes('enable javascript and cookies to continue');
            if (!isChallengePage) {
                return response.data;
            }
        }
    } catch (e) {
        if (signal?.aborted) return null;
        // Fall through to Puppeteer
    }

    if (signal?.aborted) return null;

    // 2. Fallback to Singleton Puppeteer instance (with safe active-page tracking and one-shot Target.createTarget recovery)
    let page = null;
    activeBrowserPages++;
    try {
        let browser = await getSharedBrowser();
        if (!browser || signal?.aborted) return null;

        try {
            page = await browser.newPage();
        } catch (tabErr) {
            if (signal?.aborted) return null;
            // Recover once if browser died/recycled just before newPage()
            if (activeBrowserPages <= 1) {
                await closeSharedBrowser(true);
            }
            browser = await getSharedBrowser();
            if (!browser || signal?.aborted) return null;
            page = await browser.newPage();
        }
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
                req.abort().catch(() => {});
            } else {
                req.continue().catch(() => {});
            }
        });

        await page.setUserAgent(getRandomUserAgent());
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        if (signal?.aborted) return null;

        // On JS-hydrated news listing pages (e.g. Sakshi), give client scripts a short window to populate article links
        if (isListingPage) {
            await page.waitForFunction(
                () => document.querySelectorAll('a[href]').length >= 25,
                { timeout: 6000 }
            ).catch(() => {});
        }

        const html = await page.content();
        return html;
    } catch (err) {
        if (!signal?.aborted) {
            console.error(`[PUPPETEER] Fetch failed for ${url}: ${err.message}`);
        }
        // Only recycle shared browser on true CDP/connection failures (not simple per-page navigation timeouts)
        const isBrowserBroken = err.message.includes('Target closed') ||
                                err.message.includes('Protocol error') ||
                                err.message.includes('Session closed') ||
                                err.message.includes('Connection closed');
        if (isBrowserBroken && activeBrowserPages <= 1) {
            await closeSharedBrowser(true);
        }
        return null;
    } finally {
        if (page) {
            try {
                await page.close();
            } catch (e) {}
        }
        activeBrowserPages = Math.max(0, activeBrowserPages - 1);
    }
}

// ============================================================================
// GEMINI AI PROCESSING
// ============================================================================
function buildEditorialPrompt({
    mode,
    hasSubstantialSource,
    sourceWords,
    imageUrl = '',
    authorDisplayName = '',
    handleTag = '',
    designation = '',
    district = '',
    isAggregator = false,
    targetLanguage = 'te',
    targetStateCode = ''
}) {
    const lang = String(targetLanguage || 'te').toLowerCase().trim();
    const isSocial = mode === 'social';

    // Non-Telugu multi-state editorial prompt (Hindi / Punjabi / Gujarati / English)
    if (lang !== 'te') {
        const langMeta = getLanguageMeta(lang);
        const stateName = (targetStateCode && EDITIONS_CONFIG[targetStateCode])
            ? EDITIONS_CONFIG[targetStateCode].nameEn
            : 'India';
        const regionLabel = district ? `${district}, ${stateName}` : stateName;

        const nonTeHeader = isSocial
            ? (isAggregator
                ? `Source: Independent news report (news aggregator post — NEVER mention any aggregator/portal/channel name in the story).\nRegion: ${regionLabel}\n`
                : `Post Author Details:\n- Author: ${authorDisplayName} (${handleTag})\n- Role / Category: ${designation || 'Political / Social Update'}\n- Region: ${regionLabel}\n`)
            : `Source: Web news article (ignore sidebar tickers, ads, and unrelated links; focus only on the main story; NEVER mention any external website/channel name).\nRegion: ${regionLabel}\n`;

        const nonTeFullStoryRule = hasSubstantialSource
            ? `- 'fullStoryLocal' and matching 'fullStoryEn': Write 2-4 crisp paragraphs separated by \\n\\n based strictly on facts present in the source (Para 1: core event & public impact; Para 2: key numbers/quotes; Para 3-4: background/next steps). Never repeat points or invent facts.`
            : `- Source is short (${sourceWords} words). Do NOT invent facts; leave 'fullStoryLocal': "" and 'fullStoryEn': "", and write only the 50-65 word summary.`;

        const nonTeAttribution = isSocial && !isAggregator
            ? `- Original Alfa Newsroom Voice & Attribution: Write directly as Alfa News. Attribute political statements/criticism/allegations to the speaker; if a press note/order image is attached, read key facts and figures from it.`
            : `- Original Alfa Newsroom Voice: Write directly as Alfa News. Never mention competing outlets (e.g. Amar Ujala, Dainik Bhaskar, Jagbani, Divya Bhaskar, O Heraldo, Sangai Express, NDTV, ANI, PTI, etc.). Attribute only direct quotes/allegations to the named leader/official.`;

        const langSpecificInstruction = lang === 'en'
            ? `- Write 'headline' (6-10 words) and 'contentLocal' (50-65 words, single paragraph, no newlines) in crisp, natural Indian journalism English. Set 'headlineEn' equal to 'headline' and 'contentEn' equal to 'contentLocal'.`
            : `- Regardless of input language, write 'headline' (6-10 words) and 'contentLocal' (50-65 words, single paragraph, no newlines) in pure, natural journalistic ${langMeta.nameEn} using ${langMeta.scriptName} ONLY (do NOT use Telugu or other unrelated scripts; standard abbreviations like BJP, INC, AAP, ₹ are allowed).\n   - Write 'headlineEn' (6-10 words) and 'contentEn' (50-65 words) as an accurate English translation of your ${langMeta.nameEn} copy.`;

        return `You are the Chief Editor of Alfa News. Transform the provided information into a clear, mobile-first ${langMeta.nameEn} news report and return STRICT VALID JSON ONLY.

${nonTeHeader}
Core Rules:
1. Language, Headline & Summary (READER-FIRST):
   ${langSpecificInstruction}
   - 'headline': 6-10 words, one punchy sentence stating the exact event, location, figure, or public impact (examples: ${langMeta.exampleHeadlines}). NO colons (:), semicolons (;), quotes, or clickbait prefixes like "Breaking:" / "Shocking:".
   - 'contentLocal': 50-65 words in a single paragraph. Lead with the core news & impact in sentence 1; keep exact names, places, and figures.
   ${nonTeFullStoryRule}

2. Neutrality & Editorial Standards:
   - Strictly preserve facts, numbers, funds, names, and locations from the input; never fabricate details.
   - Zero flattery or partisan verdicts from our newsroom.
   ${nonTeAttribution}

3. Editorial Filter ('isRelevant'):
   - isRelevant = false: PR self-promotion, birthday greetings, photo-op ribbon cuttings without news value, memes/trolls, ads, horoscopes.
   - isRelevant = true: Government decisions, welfare schemes, infrastructure, budgets, major political statements, civic issues, accidents, crime, sports, cinema, education/jobs.

4. Image Logo/Watermark Visual Check (STRICT VISUAL CHECK ONLY):
   - Inspect pixels ONLY if an image is attached; if no image is attached, ALWAYS return "hasLogo": false.
   - Return "hasLogo": true if the image has news channel logos, website URLs/watermarks, TV ticker bars, or red-circle/arrow thumbnail overlays.
   - Return "hasLogo": false for clean real photos (people, roads, buildings, official press notes).

5. Metadata & Score:
   - location: Specific district, tehsil/taluka/sub-division, or city in ${stateName}.
   - refinedCategory: Pick ONE from [Politics, Crime, Sports, Cinema, Business, Health, Education, Technology, Agriculture, Local, National, International].
   - storyFingerprint: 3-4 English lowercase words joined by hyphens (e.g. ${(targetStateCode || 'in').toLowerCase()}-highway-accident-three).
   - qualityScore (0.0-10.0): 9-10 major policy/disaster/public impact; 6-8 standard news; 1-4 filler.

Strict JSON Output ONLY:
{"isRelevant": true, "qualityScore": 8.0, "headline": "6-10 word ${langMeta.nameEn} headline", "contentLocal": "50-65 word single-paragraph ${langMeta.nameEn} summary", "fullStoryLocal": "${hasSubstantialSource ? `2-4 paragraph ${langMeta.nameEn} full story (\\\\n\\\\n)` : ""}", "headlineEn": "6-10 word English headline", "contentEn": "50-65 word English summary", "fullStoryEn": "${hasSubstantialSource ? "2-4 paragraph English full story (\\\\n\\\\n)" : ""}", "location": "Location", "storyFingerprint": "short-english-slug", "refinedCategory": "Category", "tags": [], "entities": {"people": [], "organizations": [], "locations": []}, "hasLogo": false, "mediaUrl": "${imageUrl}", "mediaType": "image", "isWide": false}`;
    }

    const contextHeader = isSocial
        ? (isAggregator
            ? `మూలం: స్వతంత్ర వార్తా నివేదిక (ఇది న్యూస్ అగ్రిగేటర్ పోస్ట్ — అగ్రిగేటర్/పోర్టల్ పేరును వార్తలో ఎక్కడా రాయకండి).
ప్రాంతం: ${district || 'Andhra Pradesh / Telangana'}
`
            : `పోస్ట్ ఖాతా వివరాలు:
- Post Author: ${authorDisplayName} (${handleTag})
- కేటగిరీ / హోదా: ${designation || 'Political / Social Update'}
- ప్రాంతం: ${district || 'Andhra Pradesh / Telangana'}
`)
        : `మూలం: వెబ్ ఆర్టికల్ (సైడ్ టిక్కర్లు, ప్రకటనలు, సంబంధం లేని లింకులు విస్మరించి ప్రధాన వార్తపైనే దృష్టి పెట్టండి; ఏ వెబ్‌సైట్/ఛానల్ పేరునూ వార్తలో రాయకండి).
`;

    const fullStoryRule = hasSubstantialSource
        ? `- 'fullStoryTe' మరియు దానికి సరిపోయే 'fullStoryEn': ఉన్న వాస్తవాలకు తగ్గట్టు 2-4 స్పష్టమైన పేరాగ్రాఫ్‌లుగా (\\n\\n తో వేరుచేసి) రాయండి (1వ పేరా ప్రధాన సంఘటన & ప్రభావం, 2వ పేరా వివరాలు/అంకెలు/వ్యాఖ్యలు, 3-4వ పేరా నేపథ్యం/తదుపరి చర్యలు). పదాల కోసం ఒకే విషయాన్ని రిపీట్ చేయకండి; లేని వివరాలు లేదా కల్పిత ప్రతిపక్ష వ్యాఖ్యలు ఊహించకండి.`
        : `- మూల సమాచారం స్వల్పంగా ఉంది (${sourceWords} పదాలు). లేని సమాచారాన్ని కల్పించకుండా 'fullStoryTe': "" మరియు 'fullStoryEn': "" గానే ఉంచి, 'contentTe' (50-65 పదాలు) మాత్రమే రాయండి.`;

    const attributionRule = isSocial && !isAggregator
        ? `- ఆల్ఫా న్యూస్ స్వంత శైలి & ఆపాదింపు: వార్త ఆల్ఫా న్యూస్ స్వయంగా రాసినట్లే సూటిగా ఉండాలి. రాజకీయ నాయకుడి స్వంత ప్రకటన/విమర్శ/ఆరోపణ అయితే ఆ నాయకుడికే ఆపాదించండి; వేరొకరి గురించి ట్వీట్ చేస్తే ఆ నాయకుడి స్పందనగా రాయండి; కోట్ ట్వీట్ అయితే మూల సంఘటన మరియు స్పందనను వేరు చేసి రాయండి; "— [Name]" కోట్ ఉంటే ఆ స్పీకర్‌కే ఆపాదించండి; ప్రెస్ నోట్/జీవో ఇమేజ్ ఉంటే అందులోని ముఖ్యాంశాలు, అంకెలు చదివి వార్తలో చేర్చండి.`
        : `- ఆల్ఫా న్యూస్ స్వంత శైలి (ORIGINAL NEWSROOM VOICE): వార్త ఆల్ఫా న్యూస్ స్వయంగా రాసినట్లే ఉండాలి! సాధారణ సంఘటనలు (ప్రమాదాలు, రైలు ఆలస్యం, వర్షాలు, ప్రభుత్వ నిర్ణయాలు, పరీక్షలు) జరిగినట్లే నేరుగా రాయండి. ఏ ఇతర న్యూస్ పోర్టల్, ఛానల్ లేదా అగ్రిగేటర్ పేరును ('తెలుగు స్క్రైబ్ వెల్లడించింది', 'సమయం తెలిపింది', 'ఈనాడు పేర్కొంది', 'సోషల్ మీడియాలో వెల్లడైంది') ఎట్టిపరిస్థితుల్లోనూ రాయరాదు! కేవలం ఒక నాయకుడు లేదా అధికారి ప్రత్యక్షంగా చేసిన ఆరోపణ/విమర్శ/ప్రకటనను మాత్రమే ఆ వ్యక్తి/శాఖకు ఆపాదించండి.`;

    return `మీరు ఆల్ఫా న్యూస్ (Alfa News) చీఫ్ ఎడిటర్. ఇచ్చిన సమాచారాన్ని మొబైల్ పాఠకుడు ఆసక్తిగా, సులభంగా చదువుకునే ప్రామాణిక తెలుగు వార్తగా మార్చి వ్యాలిడ్ JSON మాత్రమే ఇవ్వండి.

${contextHeader}
ప్రధాన నియమాలు:
1. భాష, హెడ్‌లైన్ & సారాంశం (READER-FIRST):
   - ఇన్‌పుట్ ఏ భాషలో ఉన్నా, ముందుగా స్వచ్ఛమైన తెలుగు లిపిలో (Unicode U+0C00-U+0C7F) 'headline' మరియు 'contentTe' రాయండి (ఇంగ్లీష్ వాక్యాలు, హిందీ/కన్నడ/ఉర్దూ లిపి ఉండకూడదు; అబ్రివియేషన్లు మాత్రమే అనుమతి: TDP, BRS, BJP, ₹).
   - 'headline': పాఠకుడు 2 సెకన్లలో ఆగి చదివేలా 6 నుండి 10 పదాలలో ఒకే సరళమైన తెలుగు వాక్యం. అసలు సంఘటన, ప్రాంతం, అంకె లేదా ప్రజలపై ప్రభావాన్ని సూటిగా చెప్పండి (ఉదా: "విజయవాడ హైవేపై లారీ ఢీకొని ముగ్గురు మృతి", "రైతుల ఖాతాల్లోకి నేడే రూ. 5 వేలు జమ చేయనున్న ప్రభుత్వం"). కోలన్ (:), సెమీకోలన్ (;), కొటేషన్లు, "కీలక వ్యాఖ్యలు/సమీక్ష" లాంటి అస్పష్టత, "తీపి కబురు:/షాకింగ్:" లాంటి క్లీషేలు వద్దు.
   - 'contentTe': 50 నుండి 65 పదాలలో ఒకే సింగిల్ పేరాగ్రాఫ్ (న్యూలైన్లు లేకుండా). మొదటి వాక్యంలోనే అసలు వార్త & ప్రజలపై ప్రభావం సూటిగా చెప్పండి ("ఫలానా చోట సమావేశం జరిగింది" వంటి పొడి ప్రారంభాలు వద్దు). వ్యక్తుల పేర్లు, ప్రాంతం, బడ్జెట్/అంకెలు స్పష్టంగా ఉండాలి.
   - 'headlineEn' (6-10 words), 'contentEn' (50-65 words): మీరు రాసిన తెలుగు వార్తకు ఖచ్చితమైన ఇంగ్లీష్ అనువాదం.
   ${fullStoryRule}

2. నిష్పాక్షికత & సహజ తెలుగు:
   - వాస్తవాల సమగ్రత: ఇన్‌పుట్‌లో ఉన్న అంకెలు, నిధులు, పేర్లు, ప్రదేశాలను ఖచ్చితంగా నిలుపుకోండి; లేని వాస్తవాలు లేదా కల్పిత వివాదాలను సృష్టించకండి.
   - తీర్పులు/బిరుదులు నిషిద్ధం: మన ఛానెల్ స్వయంగా ఏ నాయకుడినీ పొగడకూడదు ("ప్రజల నాయకుడు", "పేదల పెన్నిధి") లేదా విమర్శలను మన తీర్పుగా రాయకూడదు.
   ${attributionRule}
   - సరళమైన వాడుక తెలుగు: ఇంగ్లీష్ నుండి మక్కికిమక్కి అనువాదం ("ఇది గమనించదగినది", "చోటుచేసుకుంది") కాకుండా, తెలుగు పాఠకుడు ఒక్క శ్వాసలో చదివే సరళమైన జర్నలిజం భాషలో రాయండి. సానుకూల వార్తల్లో "తీవ్రంగా స్పందించారు" వాడకండి. సహజ తెలుగు పదాలను ('పాత్రల్లో', 'గ్రామాల్లో', 'ఇంట్లో', 'రోడ్డుపై', 'కోర్టులో') విడదీయకండి.

3. ఎడిటోరియల్ ఫిల్టర్ ('isRelevant'):
   - isRelevant = false: వార్తా విలువ లేని స్వీయ ప్రచారం/నాయకుల భజన/పీఆర్ రీల్స్, కేవలం పోస్టర్ ఆవిష్కరణలు/పుష్పగుచ్ఛాల ఫోటో-ఆప్స్, వ్యక్తిగత పుట్టినరోజు శుభాకాంక్షలు, బూతులు/ట్రోల్ మీమ్స్, కమర్షియల్ ప్రకటనలు, రాశిఫలాలు.
   - isRelevant = true: ప్రభుత్వ నిర్ణయాలు, సంక్షేమ పథకాలు, బడ్జెట్, అభివృద్ధి పనులు, నిర్దిష్ట రాజకీయ ప్రకటనలు/ప్రెస్ మీట్లు, ప్రజా సమస్యలు, ప్రమాదాలు, నేరాలు, క్రీడలు, సినిమా, విద్య/ఉద్యోగాలు.

4. ఫోటో లోగో/వాటర్‌మార్క్ దృశ్య పరిశీలన (STRICT VISUAL CHECK ONLY):
   - జతచేసిన చిత్రం (attached image) ఉన్నప్పుడు మాత్రమే దాని పిక్సెల్స్ పరిశీలించండి. చిత్రం జతచేయబడకపోతే ఎప్పుడూ "hasLogo": false ఇవ్వండి (URL చూసి ఊహించకండి).
   - "hasLogo": true ఎప్పుడు ఇవ్వాలి: చిత్రంపై ఎక్కడైనా న్యూస్ ఛానల్ లోగో, వెబ్‌సైట్ URL/క్రెడిట్ టెక్స్ట్ (ఉదా: "Source: ...", ".com", TV9, NTV, Samayam, Eenadu, Sakshi, ABN, Telugu Scribe), టీవీ న్యూస్ టిక్కర్ బార్, ఎడిట్ చేసిన ఎర్ర వృత్తాలు/బాణాలు (red circle/arrow overlays) లేదా థంబ్‌నెయిల్ టెక్స్ట్ బ్యానర్ ఉంటే ఖచ్చితంగా "hasLogo": true ఇవ్వండి!
   - "hasLogo": false ఎప్పుడు ఇవ్వాలి: క్లీన్ అసలు ఫోటో (మనుషులు, నాయకులు, రైళ్లు, రోడ్లు, భవనాలు, అధికారిక ప్రెస్ నోట్/జీవో) అయితే — బ్యాక్‌గ్రౌండ్‌లో సహజంగా ఉన్న ప్రభుత్వ ఫ్లెక్సీ/షాప్ బోర్డు వల్ల తప్పుగా తిరస్కరించకుండా "hasLogo": false ఇవ్వండి!

5. మెటాడేటా & స్కోర్:
   - location: AP/TS జిల్లా లేదా మండలం పేరు.
   - refinedCategory: [Politics, Crime, Sports, Cinema, Business, Health, Education, Technology, Agriculture, Local, National, International] లో ఒకటి మాత్రమే.
   - storyFingerprint: 3-4 English words joined by hyphens (e.g. ap-farmer-aid-released).
   - qualityScore (0.0-10.0): 9-10 major policy/public impact/disaster/top leader news; 6-8 standard news; 1-4 filler/gossip.

JSON అవుట్‌పుట్ (Strict JSON only):
{"isRelevant": true, "qualityScore": 8.0, "headline": "6-10 పదాల నిర్దిష్టమైన సహజ తెలుగు శీర్షిక", "contentTe": "50-65 పదాల తెలుగు వార్త (మొదటి వాక్యంలోనే ప్రధాన వార్త, ఒకే పేరా)", "fullStoryTe": "${hasSubstantialSource ? "2-4 పేరాగ్రాఫ్‌ల పూర్తి తెలుగు వార్త (\\\\n\\\\n తో, రిపీట్ లేకుండా)" : ""}", "headlineEn": "6-10 word English headline", "contentEn": "50-65 word English summary", "fullStoryEn": "${hasSubstantialSource ? "2-4 paragraph English full story (\\\\n\\\\n)" : ""}", "location": "Location", "storyFingerprint": "short-english-slug", "refinedCategory": "Category", "tags": [], "entities": {"people": [], "organizations": [], "locations": []}, "hasLogo": false, "mediaUrl": "${imageUrl}", "mediaType": "image", "isWide": false}`;
}

function repairMalformedJson(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    // 1. Escape unescaped raw control characters inside JSON string literals
    let out = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (inString) {
            if (escaped) {
                out += ch;
                escaped = false;
            } else if (ch === '\\') {
                out += ch;
                escaped = true;
            } else if (ch === '"') {
                out += ch;
                inString = false;
            } else if (ch === '\n') {
                out += '\\n';
            } else if (ch === '\r') {
                out += '\\r';
            } else if (ch === '\t') {
                out += '\\t';
            } else if (ch.charCodeAt(0) < 0x20) {
                out += ' ';
            } else {
                out += ch;
            }
        } else {
            if (ch === '"') {
                inString = true;
            }
            out += ch;
        }
    }

    // 2. Fix bare minus signs in value positions (e.g. "qualityScore": -, -> "qualityScore": 0,)
    out = out.replace(/(:\s*)-(?=\s*[,}\]])/g, '$10');
    // 3. Remove trailing commas before closing object/array braces
    out = out.replace(/,\s*([}\]])/g, '$1');
    return out;
}

function parseAIJson(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Empty AI JSON response');
    }
    let cleanText = text.trim();

    // 1. Strip markdown code fences if present
    if (cleanText.includes('```')) {
        const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
            cleanText = match[1].trim();
        } else {
            cleanText = cleanText.replace(/```json|```/g, '').trim();
        }
    }

    // 2. Extract JSON object bounds if preamble/postamble text exists
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }

    try {
        return JSON.parse(cleanText);
    } catch (firstErr) {
        try {
            const repaired = repairMalformedJson(cleanText);
            return JSON.parse(repaired);
        } catch (secondErr) {
            const posMatch = String(firstErr.message || '').match(/position\s+(\d+)/i);
            if (posMatch) {
                const pos = parseInt(posMatch[1], 10);
                const snippet = cleanText.substring(Math.max(0, pos - 30), Math.min(cleanText.length, pos + 30)).replace(/\s+/g, ' ');
                throw new Error(`${firstErr.message} (near: "${snippet}")`);
            }
            throw firstErr;
        }
    }
}

async function checkImageCleanWithGemini(imageUrl, signal = null) {
    if (!imageUrl || geminiKeys.length === 0 || signal?.aborted) return { ok: false, hasLogo: true, fetched: null };
    const fetched = await fetchValidatedImageBuffer(imageUrl, { maxWidth: 1024, timeout: 10000 });
    if (!fetched || signal?.aborted) return { ok: false, hasLogo: false, fetched: null };

    const checkPrompt = `Inspect this photograph strictly for overlaid media branding or edited graphics.
Return JSON only: {"hasLogo": true|false, "isWide": true|false}
- Set hasLogo = true ONLY if there is an overlaid TV channel logo, website URL/credit watermark (e.g. "Source: ...", ".com", TV9, NTV, Samayam, Eenadu, Sakshi, ABN, Telugu Scribe), TV news ticker bar, or edited red circle/arrow/text banner overlay.
- Set hasLogo = false for a clean real photograph (do NOT reject natural real-world signs or stage banners in the background).`;

    const result = await processWithGemini("Check image", checkPrompt, null, 2, fetched, { signal });
    if (!result) return { ok: true, hasLogo: false, fetched };
    try {
        const parsed = parseAIJson(result);
        return { ok: true, hasLogo: parsed.hasLogo === true, isWide: parsed.isWide === true, fetched };
    } catch (e) {
        return { ok: true, hasLogo: false, fetched };
    }
}

async function sleepWithAbort(ms, signal = null) {
    if (!ms || ms <= 0 || signal?.aborted) return;
    await new Promise((resolve) => {
        const timer = setTimeout(() => {
            if (signal) signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            resolve();
        };
        if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
}

async function processWithGemini(text, prompt, imageUrl = null, retries = 4, preFetchedImage = null, options = {}) {
    const signal = options?.signal || null;
    const temperature = typeof options?.temperature === 'number' ? options.temperature : 0.35;

    if (signal?.aborted) return null;
    if (geminiKeys.length === 0) {
        console.error("No Gemini API keys configured. Cannot process.");
        return null;
    }

    const truncatedText = text ? text.substring(0, 4500) : "";
    if (truncatedText.length < 5) return null;

    let imagePart = null;
    if (preFetchedImage && preFetchedImage.buffer) {
        imagePart = {
            inlineData: {
                mimeType: preFetchedImage.contentType || 'image/jpeg',
                data: preFetchedImage.buffer.toString('base64')
            }
        };
    } else if (imageUrl && !isGenericImage(imageUrl)) {
        const fetched = await fetchValidatedImageBuffer(imageUrl, { maxWidth: 1024, timeout: 12000 });
        if (signal?.aborted) return null;
        if (fetched) {
            imagePart = {
                inlineData: {
                    mimeType: fetched.contentType,
                    data: fetched.buffer.toString('base64')
                }
            };
        }
    }

    const imageStatusNote = imagePart
        ? "\n[IMAGE ATTACHED: Visually inspect the attached image for overlaid logos, website URLs/watermarks like 'Source: ...', red arrows/circles, or news banners and set hasLogo accurately.]"
        : "\n[NO IMAGE ATTACHED: Set hasLogo to false.]";

    const maxAttempts = Math.min(Math.max(geminiKeys.length + 2, 4), 8);
    const maxTransientRetries = Math.min(Math.max(retries || 3, 2), 4);
    let transientErrorCount = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (signal?.aborted) return null;
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
                await sleepWithAbort(sleepTime, signal);
                if (signal?.aborted) return null;
            }
            lastGeminiRequestTime = Date.now();
            requestCountForCurrentKey++;

            const currentKey = geminiKeys[currentGeminiKeyIndex];
            const activeModel = GEMINI_MODELS[currentModelIndex % GEMINI_MODELS.length];
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${currentKey}`;
            
            const parts = [{ text: `${prompt}${imageStatusNote}\n\nText:\n${truncatedText}` }];
            if (imagePart) parts.push(imagePart);

            const payload = {
                contents: [{ parts }],
                generationConfig: {
                    temperature,
                    responseMimeType: "application/json"
                }
            };

            const response = await axios.post(url, payload, { timeout: 35000, signal: signal || undefined });
            
            if (response.data && response.data.candidates && response.data.candidates.length > 0) {
                return response.data.candidates[0].content.parts[0].text.trim();
            }
            return null;
        } catch (error) {
            if (signal?.aborted || error.code === 'ERR_CANCELED' || error.name === 'CanceledError') {
                return null;
            }
            const errorMsg = (error.response?.data?.error?.message || error.message || "").toUpperCase();
            const status = error.response?.status;
            const activeModel = GEMINI_MODELS[currentModelIndex % GEMINI_MODELS.length];
            
            // If model not found or deprecated, switch model
            if (errorMsg.includes('NOT_FOUND') || errorMsg.includes('IS NOT SUPPORTED') || errorMsg.includes('NO LONGER AVAILABLE')) {
                console.log(`[GEMINI] Model ${activeModel} not supported. Falling back to next model.`);
                currentModelIndex = (currentModelIndex + 1) % GEMINI_MODELS.length;
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

            const isRetryable = status === 503 ||
                               status === 502 ||
                               status === 504 ||
                               errorMsg.includes('503') || 
                               errorMsg.includes('OVERLOADED') || 
                               errorMsg.includes('HIGH DEMAND') || 
                               errorMsg.includes('UNAVAILABLE') || 
                               errorMsg.includes('TIMEOUT') || 
                               errorMsg.includes('ECONNRESET');

            if (isRetryable && transientErrorCount < maxTransientRetries && attempt < maxAttempts - 1) {
                transientErrorCount++;
                // After 2 consecutive transient failures on one model, rotate to the fallback Lite model
                if (transientErrorCount === 2 && GEMINI_MODELS.length > 1) {
                    currentModelIndex = (currentModelIndex + 1) % GEMINI_MODELS.length;
                    console.warn(`[GEMINI] Switching to fallback model ${GEMINI_MODELS[currentModelIndex]} after repeated transient errors on ${activeModel}.`);
                }
                const delay = 1500 + (Math.random() * 1500);
                const reasonLabel = status ? `HTTP ${status}` : errorMsg.substring(0, 45);
                console.log(`[GEMINI] Temporary service issue on ${activeModel} (${reasonLabel}), retrying in ${Math.round(delay/1000)}s...`);
                await sleepWithAbort(delay, signal);
                continue;
            }
            console.error(`Gemini API Error (${activeModel}):`, errorMsg);
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
    if (scannedUrlMemoryCache.size > 5000) {
        const oldKeys = Array.from(scannedUrlMemoryCache).slice(0, 1000);
        oldKeys.forEach(k => scannedUrlMemoryCache.delete(k));
    }
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

async function isUrlAlreadyScanned(urls, targetCollection = 'news') {
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

    // 2. Query Firestore target news collection
    for (let i = 0; i < urlsToQuery.length; i += 10) {
        const batch = urlsToQuery.slice(i, i + 10);
        const batchUrls = [...new Set(batch.map(b => b.clean).concat(batch.map(b => b.raw)))];
        try {
            const snapshot = await db.collection(targetCollection || 'news').where('sourceUrl', 'in', batchUrls).limit(20).get();
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
            const snapshot = await db.collection('scanned_urls').where('url', 'in', batchUrls).limit(20).get();
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
    "AndhraPradesh", "Telangana",
    "UttarPradesh", "Punjab", "Uttarakhand", "Goa", "Manipur", "HimachalPradesh", "Gujarat"
];

// Pure universal/global categories that must NEVER be tagged as a local district news
const PURE_GLOBAL_CATEGORIES = [
    "Sports", "Cinema", "National", "International"
];

const DISTRICT_MAPPING = [
    // --- ANDHRA PRADESH DISTRICTS ---
    { canonical: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", state: "AP", keywords: ["nellore", "నెల్లూరు", "spsr", "సర్వేపల్లి", "sarvepalli", "కావలి", "kavali", "కోవూరు", "kovur", "కందుకూరు", "kandukur", "గూడూరు", "gudur", "ఆత్మకూరు", "atmakur", "ఉదయగిరి", "udayagiri", "బుచ్చిరెడ్డిపాలెం", "వెంకటాచలం", "పొదలకూరు", "podalakur", "ఇందుకూరుపేట"] },
    { canonical: "అల్లూరి సీతారామరాజు", state: "AP", keywords: ["alluri", "asr district", "అల్లూరి", "సీతారామరాజు", "పాడేరు", "paderu", "అరకు", "araku", "రంపచోడవరం", "rampachodavaram", "చింతపల్లి"] },
    { canonical: "అనకాపల్లి", state: "AP", keywords: ["anakapalli", "anakapalle", "అనకాపల్లి", "నర్సీపట్నం", "narsipatnam", "చోడవరం", "chodavaram", "దేవరాపల్లి", "బుచ్చయ్యపేట"] },
    { canonical: "అనంతపురం", state: "AP", keywords: ["anantapur", "ananthapur", "anantapuramu", "అనంతపురం", "అనంతపురము", "రాప్తాడు", "raptadu", "గుంతకల్లు", "guntakal", "తాడిపత్రి", "tadipatri"] },
    { canonical: "అన్నమయ్య", state: "AP", keywords: ["annamayya", "అన్నమయ్య", "రాయచోటి", "rayachoti", "రాజంపేట", "rajampet", "పీలేరు", "pileru", "మదనపల్లె"] },
    { canonical: "బాపట్ల", state: "AP", keywords: ["bapatla", "బాపట్ల", "చీరాల", "chirala", "రేపల్లె", "repalle", "అద్దంకి", "addanki", "వేమూరు"] },
    { canonical: "చిత్తూరు", state: "AP", keywords: ["chittoor", "చిత్తూరు", "కుప్పం", "kuppam", "పలమనేరు", "palamaner", "పుంగనూరు", "punganur", "నగరి", "nagari", "గంగాధర నెల్లూరు"] },
    { canonical: "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ", state: "AP", keywords: ["konaseema", "కోనసీమ", "అమలాపురం", "amalapuram", "రాజోలు", "razole", "రావులపాలెం", "ravulapalem", "రామచంద్రపురం", "ముమ్మిడివరం"] },
    { canonical: "తూర్పు గోదావరి", state: "AP", keywords: ["east godavari", "తూర్పు గోదావరి", "తూర్పుగోదావరి", "రాజమండ్రి", "rajahmundry", "రాజమహేంద్రవరం", "కొవ్వూరు", "kovvur", "నిడదవోలు", "అనపర్తి"] },
    { canonical: "ఏలూరు", state: "AP", keywords: ["eluru", "ఏలూరు", "కైకలూరు", "kaikaluru", "నూజివీడు", "nuzvid", "జీలుగుమిల్లి", "jeelugumilli", "జంగారెడ్డిగూడెం", "jangareddigudem", "చింతలపూడి", "పోలవరం"] },
    { canonical: "గుంటూరు", state: "AP", keywords: ["guntur", "గుంటూరు", "తెనాలి", "tenali", "మంగళగిరి", "mangalagiri", "పొన్నూరు", "ponnur", "ప్రత్తిపాడు", "తాడికొండ"] },
    { canonical: "కాకినాడ", state: "AP", keywords: ["kakinada", "కాకినాడ", "పిఠాపురం", "pithapuram", "తుని", "tuni", "పెద్దాపురం", "peddapuram", "సామర్లకోట", "ప్రత్తిపాడు-కాకినాడ", "జగ్గంపేట"] },
    { canonical: "కృష్ణా", state: "AP", keywords: ["krishna", "కృష్ణా", "మచిలీపట్నం", "machilipatnam", "గుడివాడ", "gudiwada", "ఉయ్యూరు", "uyyuru", "పెడన", "పామర్రు", "అవనిగడ్డ"] },
    { canonical: "కర్నూలు", state: "AP", keywords: ["kurnool", "కర్నూలు", "ఆదోని", "adoni", "ఎమ్మిగనూరు", "yemmiganur", "ఆలూరు", "alur", "పత్తికొండ", "pattikonda", "కోడుమూరు", "మంత్రాలయం"] },
    { canonical: "నంద్యాల", state: "AP", keywords: ["nandyal", "నంద్యాల", "ఆళ్లగడ్డ", "allagadda", "డోన్", "dhone", "బనగానపల్లె", "banaganapalle", "నందికొట్కూరు", "శ్రీశైలం"] },
    { canonical: "ఎన్టీఆర్", state: "AP", keywords: ["ntr", "ఎన్టీఆర్", "విజయవాడ", "vijayawada", "జగ్గయ్యపేట", "jaggayyapet", "నందిగామ", "nandigama", "మైలవరం", "mylavaram", "తిరువూరు"] },
    { canonical: "పల్నాడు", state: "AP", keywords: ["palnadu", "పల్నాడు", "నరసరావుపేట", "narasaraopet", "సత్తెనపల్లి", "sattenapalli", "గురజాల", "gurazala", "మాచర్ల", "macherla", "వినుకొండ", "vinukonda", "చిలకలూరిపేట"] },
    { canonical: "పార్వతీపురం మన్యం", state: "AP", keywords: ["parvathipuram", "manyam", "పార్వతీపురం", "మన్యం", "పాలకొండ", "palakonda", "సాలూరు", "salur", "కురుపాం"] },
    { canonical: "ప్రకాశం", state: "AP", keywords: ["prakasam", "ప్రకాశం", "ఒంగోలు", "ongole", "చీమకుర్తి", "దర్శి", "కనిగిరి", "యర్రగొండపాలెం", "గిద్దలూరు", "మార్కాపురం"] },
    { canonical: "శ్రీ సత్యసాయి", state: "AP", keywords: ["sri sathya sai", "sathyasai", "శ్రీ సత్యసాయి", "సత్యసాయి", "పుట్టపర్తి", "puttaparthi", "ధర్మవరం", "dharmavaram", "కదిరి", "kadiri", "పెనుకొండ", "penukonda", "హిందూపురం", "hindupur", "మడకశిర"] },
    { canonical: "శ్రీకాకుళం", state: "AP", keywords: ["srikakulam", "శ్రీకాకుళం", "పలాస", "palasa", "టెక్కలి", "tekkali", "ఇచ్ఛాపురం", "ichchapuram", "ఆమదాలవలస", "amadalavalasa", "నరసన్నపేట", "రణస్థలం", "సోంపేట"] },
    { canonical: "తిరుపతి", state: "AP", keywords: ["tirupati", "తిరుపతి", "తిరుమల", "tirumala", "శ్రీకాళహస్తి", "srikalahasti", "చంద్రగిరి", "chandragiri", "సూళ్లూరుపేట", "sullurpeta", "వెంకటగిరి", "నాయుడుపేట", "గూడూరు-తిరుపతి"] },
    { canonical: "విశాఖపట్నం", state: "AP", keywords: ["visakhapatnam", "vizag", "విశాఖపట్నం", "వైజాగ్", "విశాఖ", "గాజువాక", "gajuwaka", "భీమిలి", "bheemili", "పెందుర్తి"] },
    { canonical: "విజయనగరం", state: "AP", keywords: ["vizianagaram", "విజయనగరం", "బొబ్బిలి", "bobbili", "చీపురుపల్లి", "cheepurupalli", "గజపతినగరం", "శృంగవరపుకోట", "నెల్లిమర్ల"] },
    { canonical: "పశ్చిమ గోదావరి", state: "AP", keywords: ["west godavari", "పశ్చిమ గోదావరి", "పశ్చిమగోదావరి", "భీమవరం", "bhimavaram", "తాడేపల్లిగూడెం", "tadepalligudem", "పాలకొల్లు", "palakollu", "నరసాపురం", "narasapuram", "తణుకు", "tanuku", "ఆకివీడు"] },
    { canonical: "వైఎస్ఆర్ కడప", state: "AP", keywords: ["kadapa", "కడప", "ysr kadapa", "వైఎస్ఆర్ కడప", "వైఎస్సార్ కడప", "ప్రొద్దుటూరు", "proddatur", "పులివెందుల", "pulivendula", "జమ్మలమడుగు", "బద్వేలు", "కమలాపురం"] },

    // --- TELANGANA DISTRICTS ---
    { canonical: "ఆదిలాబాద్", state: "TS", keywords: ["adilabad", "ఆదిలాబాద్", "బోథ్", "బేల", "ఉట్నూరు"] },
    { canonical: "భద్రాద్రి కొత్తగూడెం", state: "TS", keywords: ["bhadradri", "kothagudem", "భద్రాద్రి", "కొత్తగూడెం", "భద్రాచలం", "bhadrachalam", "ఇల్లందు", "మణుగూరు", "పాల్వంచ"] },
    { canonical: "హన్మకొండ", state: "TS", keywords: ["hanumakonda", "hanmakonda", "హన్మకొండ", "హనుమకొండ", "వరంగల్ అర్బన్", "కాజీపేట", "kazipet"] },
    { canonical: "హైదరాబాద్", state: "TS", keywords: ["hyderabad", "హైదరాబాద్", "సైబరాబాద్", "cyberabad", "సికింద్రాబాద్", "secunderabad", "చార్మినార్", "బంజారాహిల్స్", "జూబ్లీహిల్స్"] },
    { canonical: "జగిత్యాల", state: "TS", keywords: ["jagtial", "జగిత్యాల", "కోరుట్ల", "korutla", "మెట్‌పల్లి", "metpally", "ధర్మపురి"] },
    { canonical: "జనగాం", state: "TS", keywords: ["jangaon", "జనగాం", "స్టేషన్ ఘన్‌పూర్", "పాలకుర్తి"] },
    { canonical: "జయశంకర్ భూపాలపల్లి", state: "TS", keywords: ["bhupalpally", "భూపాలపల్లి", "జయశంకర్"] },
    { canonical: "జోగులాంబ గద్వాల", state: "TS", keywords: ["gadwal", "గద్వాల", "జోగులాంబ", "అలంపూర్", "alampur"] },
    { canonical: "కామారెడ్డి", state: "TS", keywords: ["kamareddy", "కామారెడ్డి", "బాన్సువాడ", "banswada", "ఎల్లారెడ్డి"] },
    { canonical: "కరీంనగర్", state: "TS", keywords: ["karimnagar", "కరీంనగర్", "హుజూరాబాద్", "huzurabad", "చొప్పదండి", "మానాకొండూరు", "తిమ్మాపూర్"] },
    { canonical: "ఖమ్మం", state: "TS", keywords: ["khammam", "ఖమ్మం", "సత్తుపల్లి", "sathupalli", "మధిర", "madhira", "వైరా", "wyra", "పాలేరు"] },
    { canonical: "కుమ్రం భీమ్ ఆసిఫాబాద్", state: "TS", keywords: ["asifabad", "ఆసిఫాబాద్", "కుమ్రం భీమ్", "కాగజ్‌నగర్", "kagaznagar", "సిర్పూర్"] },
    { canonical: "మహబూబాబాద్", state: "TS", keywords: ["mahabubabad", "మహబూబాబాద్", "మానూకోట", "తొర్రూరు", "డోర్నకల్"] },
    { canonical: "మహబూబ్ నగర్", state: "TS", keywords: ["mahabubnagar", "మహబూబ్ నగర్", "మహబూబ్‌నగర్", "జడ్చర్ల", "jadcherla", "దేవరకద్ర"] },
    { canonical: "మంచిర్యాల", state: "TS", keywords: ["mancherial", "మంచిర్యాల", "బెల్లంపల్లి", "bellampalli", "మందమర్రి", "mandamarri", "చెన్నూర్", "chennur", "జన్నారం"] },
    { canonical: "మెదక్", state: "TS", keywords: ["medak", "మెదక్", "తూప్రాన్", "నర్సాపూర్"] },
    { canonical: "మేడ్చల్ మల్కాజిగిరి", state: "TS", keywords: ["medchal", "malkajgiri", "మేడ్చల్", "మల్కాజిగిరి", "ఉప్పల్", "కూకట్‌పల్లి", "కుత్బుల్లాపూర్", "ఘట్‌కేసర్"] },
    { canonical: "ములుగు", state: "TS", keywords: ["mulugu", "ములుగు", "మేడారం", "medaram", "తాడ్వాయి", "ఏటూరునాగారం"] },
    { canonical: "నాగర్ కర్నూల్", state: "TS", keywords: ["nagarkurnool", "నాగర్ కర్నూల్", "కల్వకుర్తి", "kalwakurthy", "అచ్చంపేట", "కొల్లాపూర్"] },
    { canonical: "నల్గొండ", state: "TS", keywords: ["nalgonda", "నల్గొండ", "మిర్యాలగూడ", "miryalaguda", "దేవరకొండ", "నాగార్జునసాగర్", "నకిరేకల్"] },
    { canonical: "నారాయణపేట", state: "TS", keywords: ["narayanpet", "నారాయణపేట", "మక్తల్", "makthal", "మద్దూరు"] },
    { canonical: "నిర్మల్", state: "TS", keywords: ["nirmal", "నిర్మల్", "భైంసా", "bhainsa", "ఖానాపూర్", "కడెం"] },
    { canonical: "నిజామాబాద్", state: "TS", keywords: ["nizamabad", "నిజామాబాద్", "బోధన్", "bodhan", "ఆర్మూర్", "armoor", "బాల్కొండ"] },
    { canonical: "పెద్దపల్లి", state: "TS", keywords: ["peddapalli", "పెద్దపల్లి", "రామగుండం", "ramagundam", "గోదావరిఖని", "godavarikhani", "సుల్తానాబాద్", "మంథని"] },
    { canonical: "రాజన్న సిరిసిల్ల", state: "TS", keywords: ["sircilla", "సిరిసిల్ల", "రాజన్న సిరిసిల్ల", "వేములవాడ", "vemulawada"] },
    { canonical: "రంగారెడ్డి", state: "TS", keywords: ["rangareddy", "రంగారెడ్డి", "శంషాబాద్", "shamshabad", "ఇబ్రహీంపట్నం", "రాజేంద్రనగర్", "మహేశ్వరం", "చేవెళ్ల", "షాద్‌నగర్"] },
    { canonical: "సంగారెడ్డి", state: "TS", keywords: ["sangareddy", "సంగారెడ్డి", "పటాన్‌చెరు", "patancheru", "జహీరాబాద్", "zaheerabad", "ఆందోల్", "నారాయణఖేడ్"] },
    { canonical: "సిద్దిపేట", state: "TS", keywords: ["siddipet", "సిద్దిపేట", "గజ్వేల్", "gajwel", "దుబ్బాక", "dubbaka", "హుస్నాబాద్"] },
    { canonical: "సూర్యాపేట", state: "TS", keywords: ["suryapet", "సూర్యాపేట", "కోదాడ", "kodad", "హుజూర్‌నగర్", "huzurnagar", "తుంగతుర్తి"] },
    { canonical: "వికారాబాద్", state: "TS", keywords: ["vikarabad", "వికారాబాద్", "తాండూరు", "tandur", "పరిగి", "parigi", "కొడంగల్"] },
    { canonical: "వనపర్తి", state: "TS", keywords: ["wanaparthy", "వనపర్తి", "పెబ్బేరు", "కొత్తకోట", "ఆత్మకూరు-వనపర్తి"] },
    { canonical: "వరంగల్", state: "TS", keywords: ["warangal", "వరంగల్", "నర్సంపేట", "narsampet", "వర్ధన్నపేట", "రాయపర్తి", "వరంగల్ రూరల్"] },
    { canonical: "యాదాద్రి భువనగిరి", state: "TS", keywords: ["yadadri", "bhuvanagiri", "bhongir", "యాదాద్రి", "భువనగిరి", "చౌటుప్పల్", "choutuppal", "ఆలేరు", "aler", "మోత్కూరు", "యాదగిరిగుట్ట"] },

    // --- STATE / CAPITAL / REGIONAL ---
    { canonical: "AndhraPradesh", state: "AP", keywords: ["amaravati", "అమరావతి", "andhra pradesh", "andhrapradesh", "ఆంధ్రప్రదేశ్", "ఆంధ్ర ప్రదేశ్", "ఆంధ్ర", "ap news", "ap state"] },
    { canonical: "Telangana", state: "TS", keywords: ["telangana", "telangana state", "తెలంగాణ", "తెలంగాణా", "ts news", "tg news"] }
];

function detectDistrict(location, text, stateCodeHint = '') {
    const hintUpper = String(stateCodeHint || '').toUpperCase().trim();
    const isExpansionHint = ['UP', 'PB', 'UK', 'GA', 'MN', 'HP', 'GJ'].includes(hintUpper);

    // If explicitly scraping an expansion state, prioritize the 174 expansion districts first
    if (isExpansionHint) {
        const expMatch = detectExpansionDistrict(location, text, hintUpper);
        if (expMatch) return expMatch;
    }

    const loc = (location || '').toLowerCase().trim();
    if (loc && loc !== 'general' && loc !== 'none') {
        for (const item of DISTRICT_MAPPING) {
            if (item.keywords.some(k => {
                const kl = k.toLowerCase();
                return loc === kl || loc.includes(kl) || kl.includes(loc);
            })) {
                return item;
            }
        }
    }
    const body = (text || '').toLowerCase();
    if (body.length > 5) {
        for (const item of DISTRICT_MAPPING) {
            if (item.keywords.some(k => {
                const kl = k.toLowerCase();
                if (kl.length < 4) return false;
                return body.includes(kl);
            })) {
                return item;
            }
        }
    }

    // Fallback to expansion districts for untagged or national sources mentioning expansion-state cities
    if (!isExpansionHint && hintUpper !== 'AP' && hintUpper !== 'TS') {
        const expFallback = detectExpansionDistrict(location, text, hintUpper);
        if (expFallback) return expFallback;
    }

    return null;
}

// ============================================================================
// SCRAPING LOGIC: WEB SOURCES
// ============================================================================
async function processSingleWebSource(doc, signal = null) {
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

        if (signal?.aborted) return;

        // HTML link extraction fallback
        if (uniqueLinks.length === 0) {
            const html = await fetchHtmlOptimized(source.url, signal, { isListingPage: true });
            if (signal?.aborted) return;
            if (!html) {
                throw new Error(`Failed to load landing page HTML for ${source.siteName}`);
            }
            uniqueLinks = extractArticleLinks(html, source.url);
        }

        if (signal?.aborted) return;

        const earlySourceTarget = resolveScraperTarget(source);
        const existingUrls = await isUrlAlreadyScanned(uniqueLinks, earlySourceTarget.collectionName);
        const newLinks = uniqueLinks.filter(link => !existingUrls.has(link));

        console.log(`[WEB] Found ${uniqueLinks.length} total valid links for ${source.siteName} [${earlySourceTarget.stateCode || 'GLOBAL'}/${earlySourceTarget.language}->${earlySourceTarget.collectionName}] (${newLinks.length} new)`);

        const linksToProcess = newLinks.slice(0, 12);
        const batch = db.batch();
        let batchCount = 0;
        const staleThreshold = Date.now() - (24 * 60 * 60 * 1000); // 24 hours

        for (const link of linksToProcess) {
            if (batchCount >= 5 || signal?.aborted) break;

            const articleController = new AbortController();
            const onSourceAbort = () => articleController.abort();
            if (signal) signal.addEventListener('abort', onSourceAbort, { once: true });
            const articleSignal = articleController.signal;

            const articlePromise = async () => {
                if (articleSignal.aborted) return;
                const articleHtml = await fetchHtmlOptimized(link, articleSignal);
                if (articleSignal.aborted) return;
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

                // Pre-fetch the best downloadable article image ONCE (reused for Gemini Vision + Firebase Storage upload)
                let activePrimaryImageUrl = extracted.image || null;
                let preFetchedPrimaryImage = null;
                const primaryImageCandidates = (extracted.images && extracted.images.length > 0)
                    ? extracted.images
                    : (extracted.image ? [extracted.image] : []);
                for (const imgCandidate of primaryImageCandidates.slice(0, 3)) {
                    if (articleSignal.aborted) return;
                    if (!imgCandidate || isGenericImage(imgCandidate)) continue;
                    const fetched = await fetchValidatedImageBuffer(imgCandidate, { maxWidth: 1024, timeout: 12000 });
                    if (fetched) {
                        activePrimaryImageUrl = imgCandidate;
                        preFetchedPrimaryImage = fetched;
                        break;
                    }
                }

                if (articleSignal.aborted) return;

                const prompt = buildEditorialPrompt({
                    mode: 'web',
                    hasSubstantialSource,
                    sourceWords,
                    imageUrl: activePrimaryImageUrl || '',
                    district: source.district || '',
                    targetLanguage: earlySourceTarget.language,
                    targetStateCode: earlySourceTarget.stateCode
                });

                const webInputText = extracted.headline
                    ? `Title: ${extracted.headline}\n\nArticle:\n${extracted.body}`
                    : extracted.body;
                let aiResult = await processWithGemini(webInputText, prompt, activePrimaryImageUrl, 4, preFetchedPrimaryImage, { signal: articleSignal });
                if (!aiResult || articleSignal.aborted) {
                    if (!articleSignal.aborted) failedCount++;
                    return;
                }

                try {
                    let parsed;
                    try {
                        parsed = parseAIJson(aiResult);
                    } catch (initialParseErr) {
                        if (articleSignal.aborted) return;
                        console.warn(`[WEB] Malformed JSON on first attempt (${initialParseErr.message}). Retrying once at low temperature...`);
                        const retryResult = await processWithGemini(webInputText, prompt, activePrimaryImageUrl, 2, preFetchedPrimaryImage, { signal: articleSignal, temperature: 0.1 });
                        if (!retryResult || articleSignal.aborted) throw initialParseErr;
                        parsed = parseAIJson(retryResult);
                    }
                    const targetLang = earlySourceTarget.language;
                    const validContent = targetLang === 'te'
                        ? (parsed.contentTe || parsed.contentLocal || parsed.content || '')
                        : (parsed.contentLocal || parsed.contentTe || parsed.content || (targetLang === 'en' ? parsed.contentEn : '') || '');
                    if (!parsed.isRelevant || !parsed.headline || !validContent) {
                        await markUrlAsProcessed(link);
                        return;
                    }
                    parsed.content = validContent;

                    // Clean headline immediately in target language script
                    parsed.headline = targetLang === 'te'
                        ? cleanTeluguHeadline(stripAggregatorAttribution(parsed.headline))
                        : cleanGenericHeadline(stripAggregatorAttribution(parsed.headline));
                    if (parsed.headlineEn) {
                        parsed.headlineEn = cleanEnglishHeadline(parsed.headlineEn);
                    }
                    const isHeadlineScriptValid = targetLang === 'te'
                        ? isTeluguScript(parsed.headline)
                        : isTargetLanguageScript(parsed.headline, targetLang);
                    if (!parsed.headline || !isHeadlineScriptValid) {
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

                        // Query Firestore target collection using single-field index on storyFingerprint
                        const duplicate = await db.collection(earlySourceTarget.collectionName)
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

                    const reporter = getReporterForLanguage(targetLang) || getRandomReporter();
                    let category = parsed.refinedCategory;
                    if (!category || category === 'Local') {
                        category = TELUGU_CATEGORY_MAP[source.category] || source.category || 'Local';
                    }

                    // 🎯 SMART DISTRICT RESOLUTION:
                    // When scanning district pages, if sports, cinema, national or another district's news appears,
                    // do NOT tag it with the source's district! Assign its actual location/district or General.
                    const detected = detectDistrict(parsed.location, (parsed.headline || '') + ' ' + (extracted.body || ''), earlySourceTarget.stateCode);

                    let finalDistrict = "General";
                    let finalState = earlySourceTarget.stateCode || source.state || null;

                    if (PURE_GLOBAL_CATEGORIES.includes(category)) {
                        finalDistrict = "General";
                    } else if (detected) {
                        finalDistrict = detected.canonical;
                        if (detected.state) finalState = detected.state;
                    } else if (source.district) {
                        finalDistrict = source.district;
                    }

                    const categoriesList = [source.siteName, category];
                    if (finalDistrict !== "General" && !GLOBAL_CATEGORIES.includes(finalDistrict)) {
                        categoriesList.push("Local");
                        categoriesList.push(finalDistrict);
                    }

                    // Media URL handling: Strict Logo Rejection & Multi-Candidate Clean Fallback
                    let chosenMediaUrl = null;
                    let preFetchedImageForUpload = null;
                    let detectedIsWide = parsed.isWide === true;

                    if (parsed.hasLogo !== true) {
                        if (activePrimaryImageUrl && activePrimaryImageUrl.startsWith('http') && !isGenericImage(activePrimaryImageUrl)) {
                            chosenMediaUrl = activePrimaryImageUrl;
                            preFetchedImageForUpload = preFetchedPrimaryImage;
                        } else if (parsed.mediaUrl && parsed.mediaUrl.startsWith('http') && !parsed.mediaUrl.includes('"') && parsed.mediaUrl !== 'url' && !isGenericImage(parsed.mediaUrl)) {
                            chosenMediaUrl = parsed.mediaUrl;
                        } else if (extracted.image && extracted.image.startsWith('http') && !isGenericImage(extracted.image)) {
                            chosenMediaUrl = extracted.image;
                        }
                    } else {
                        console.log(`[IMAGE] 🛑 AI detected a logo/watermark on primary image for "${parsed.headline}". Checking fallback candidates...`);
                        const fallbackCandidates = (extracted.images || []).filter(u => u && u !== activePrimaryImageUrl && !isGenericImage(u)).slice(0, 2);
                        for (const candidateUrl of fallbackCandidates) {
                            if (articleSignal.aborted) return;
                            const checkRes = await checkImageCleanWithGemini(candidateUrl, articleSignal);
                            if (checkRes.ok && !checkRes.hasLogo) {
                                chosenMediaUrl = candidateUrl;
                                preFetchedImageForUpload = checkRes.fetched || null;
                                detectedIsWide = checkRes.isWide === true;
                                console.log(`[IMAGE] ✅ Found clean fallback candidate image for "${parsed.headline}".`);
                                break;
                            }
                        }
                    }

                    let finalMediaUrl = ALFA_NEWS_LOGO;
                    let mediaType = 'image';
                    let postFormat = '9:16';

                    if (chosenMediaUrl) {
                        if (parsed.mediaType === 'video') {
                            finalMediaUrl = chosenMediaUrl;
                            mediaType = 'video';
                            postFormat = detectedIsWide ? '16:9' : '9:16';
                        } else {
                            const uploadedUrl = await uploadMediaToStorage(chosenMediaUrl, 'news-media', preFetchedImageForUpload);
                            if (uploadedUrl) {
                                finalMediaUrl = uploadedUrl;
                                postFormat = detectedIsWide ? '16:9' : '9:16';
                            } else if (chosenMediaUrl.toLowerCase().includes('eenadu.net')) {
                                // Eenadu CDN returns HTTP 404 to wsrv.nl proxy, so keep direct external Eenadu CDN URL on storage fallback
                                finalMediaUrl = chosenMediaUrl;
                                postFormat = detectedIsWide ? '16:9' : '9:16';
                            } else {
                                finalMediaUrl = `https://wsrv.nl/?url=${encodeURIComponent(chosenMediaUrl)}&output=webp`;
                                postFormat = detectedIsWide ? '16:9' : '9:16';
                            }
                        }
                    }

                    // Enforce target script purity & Single Paragraph (100% legacy Telugu path for 'te', native script path for 'hi'/'pa'/'gu'/'en')
                    const cleanedHeadline = parsed.headline;
                    let rawContentLocal = targetLang === 'te'
                        ? (parsed.contentTe || parsed.contentLocal || parsed.content || '')
                        : (parsed.contentLocal || parsed.contentTe || parsed.content || (targetLang === 'en' ? parsed.contentEn : '') || '');
                    let rawContentEn = parsed.contentEn || (targetLang === 'en' ? rawContentLocal : '');
                    const rawFullStoryField = parsed.fullStoryLocal || parsed.fullStoryTe || '';

                    let cleanedContent = '';
                    let cleanedFullStoryTe = "";
                    let cleanedFullStoryEn = "";

                    if (targetLang === 'te') {
                        // Exact legacy Telugu enforcement
                        if (!isTeluguScript(rawContentLocal) && isTeluguScript(rawContentEn)) {
                            console.log(`[WEB] 🔄 Swapping English/Telugu content fields for ${source.siteName}`);
                            const tmp = rawContentLocal;
                            rawContentLocal = rawContentEn;
                            rawContentEn = tmp;
                        } else if (!isTeluguScript(rawContentLocal)) {
                            if (!rawContentEn && rawContentLocal) rawContentEn = rawContentLocal;
                            if (rawFullStoryField && isTeluguScript(rawFullStoryField)) {
                                rawContentLocal = rawFullStoryField.split(/\r?\n\r?\n/)[0].trim();
                                console.log(`[WEB] ✅ Recovered Telugu content from fullStoryTe first paragraph.`);
                            }
                        }

                        cleanedContent = sanitizeTeluguText(stripAggregatorAttribution(rawContentLocal)).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
                        if (!isTeluguScript(cleanedContent)) {
                            console.warn(`[WEB] 🛑 Skipping article with non-Telugu summary for ${source.siteName}: "${cleanedHeadline}"`);
                            await markUrlAsProcessed(link);
                            return;
                        }

                        if (hasSubstantialSource && rawFullStoryField && isTeluguScript(rawFullStoryField)) {
                            const rawStory = sanitizeTeluguText(stripAggregatorAttribution(rawFullStoryField)).trim();
                            const storyWords = rawStory.split(/\s+/).filter(Boolean).length;
                            if (storyWords >= 60 && rawStory !== cleanedContent && rawStory.length > cleanedContent.length + 30) {
                                cleanedFullStoryTe = formatIntoParagraphs(rawStory);
                            }
                        }
                    } else {
                        // Native script validation for Hindi (hi), Punjabi (pa), Gujarati (gu), English (en)
                        if (!isTargetLanguageScript(rawContentLocal, targetLang) && rawFullStoryField && isTargetLanguageScript(rawFullStoryField, targetLang)) {
                            rawContentLocal = rawFullStoryField.split(/\r?\n\r?\n/)[0].trim();
                        }
                        cleanedContent = sanitizeGenericText(stripAggregatorAttribution(rawContentLocal)).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
                        if (!isTargetLanguageScript(cleanedContent, targetLang)) {
                            console.warn(`[WEB] 🛑 Skipping article with invalid ${targetLang} script summary for ${source.siteName}: "${cleanedHeadline}"`);
                            await markUrlAsProcessed(link);
                            return;
                        }

                        if (hasSubstantialSource && rawFullStoryField && isTargetLanguageScript(rawFullStoryField, targetLang)) {
                            const rawStory = sanitizeGenericText(stripAggregatorAttribution(rawFullStoryField)).trim();
                            const storyWords = rawStory.split(/\s+/).filter(Boolean).length;
                            if (storyWords >= 50 && rawStory !== cleanedContent && rawStory.length > cleanedContent.length + 30) {
                                cleanedFullStoryTe = formatIntoParagraphs(rawStory);
                            }
                        }
                    }

                    if (hasSubstantialSource && parsed.fullStoryEn) {
                        const rawStoryEn = String(parsed.fullStoryEn).trim();
                        if (rawStoryEn.split(/\s+/).filter(Boolean).length >= 55 && rawStoryEn.length > (rawContentEn || '').length + 30) {
                            cleanedFullStoryEn = formatIntoParagraphs(rawStoryEn);
                        }
                    }

                    const leaderDetect = targetLang === 'te'
                        ? detectTopTeluguLeader(cleanedHeadline, `${cleanedHeadline} ${cleanedContent}`, source.siteName)
                        : { isTopLeaderNews: false, leaderName: '' };
                    const isTopLeaderNews = leaderDetect.isTopLeaderNews;
                    if (isTopLeaderNews) {
                        console.log(`[SCRAPER_TOP_LEADER] Detected statement/quote for ${leaderDetect.leaderName}: "${cleanedHeadline}". Flagging BREAKING!`);
                    }

                    const notifMeta = classifyScraperNotification({
                        parsed,
                        cleanedHeadline,
                        cleanedContent,
                        isTopLeaderNews,
                    });

                    const scraperTarget = resolveScraperTarget(source, finalState);
                    const docRef = db.collection(scraperTarget.collectionName).doc();
                    const newsPayload = sanitizeFirestoreData({
                        headline: buildLocalizedTextMap(cleanedHeadline, parsed.headlineEn || '', scraperTarget.language),
                        content: buildLocalizedTextMap(cleanedContent, rawContentEn || parsed.contentEn || '', scraperTarget.language),
                        fullStory: buildLocalizedTextMap(cleanedFullStoryTe, cleanedFullStoryEn, scraperTarget.language),
                        sourceUrl: link,
                        originalUrl: link,
                        sourceName: source.siteName,
                        category: category,
                        categories: [...new Set([...categoriesList, category])].filter(Boolean),
                        tags: parsed.tags || [],
                        entities: parsed.entities || { people: [], organizations: [], locations: [] },
                        district: finalDistrict,
                        state: finalState || scraperTarget.stateCode,
                        stateCode: scraperTarget.stateCode || finalState,
                        mandal: (finalDistrict === source.district ? (source.mandal || null) : null),
                        location: parsed.location || (finalDistrict !== 'General' ? finalDistrict : (source.district || 'General')),
                        storyFingerprint: parsed.storyFingerprint || '',
                        mediaUrl: finalMediaUrl,
                        mediaType: mediaType,
                        postFormat: postFormat,
                        language: scraperTarget.language,
                        isReporter: true,
                        isCitizen: false,
                        aiProcessed: true,
                        tone: notifMeta.tone,
                        isBreaking: notifMeta.isBreaking,
                        notificationWorthy: notifMeta.notificationWorthy,
                        notificationTitle: notifMeta.notificationTitle,
                        isGlobal: isTopLeaderNews || (finalDistrict === 'General'),
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        status: 'published',
                        approved: true,
                        qualityScore: notifMeta.qualityScore,
                        viewCount: 0,
                        likes: Math.floor(Math.random() * 150) + 50,
                        comments: 0,
                        shares: Math.floor(Math.random() * 40) + 10,
                        reporter: { id: reporter.id, name: reporter.name }
                    });

                    batch.set(docRef, newsPayload);
                    await markUrlAsProcessed(link);
                    if (parsed.headline) {
                        recentHeadlinesMemoryCache.push(parsed.headline);
                        if (recentHeadlinesMemoryCache.length > 500) {
                            recentHeadlinesMemoryCache.splice(0, recentHeadlinesMemoryCache.length - 500);
                        }
                    }
                    batchCount++;
                    processedCount++;
                    console.log(`[WEB] Prepared article: ${parsed.headline}`);
                } catch (parseErr) {
                    console.error("[WEB] JSON parse error:", parseErr.message);
                    failedCount++;
                }
            };

            let articleTimer = null;
            try {
                await Promise.race([
                    articlePromise(),
                    new Promise((_, reject) => {
                        articleTimer = setTimeout(() => {
                            articleController.abort();
                            reject(new Error('Article Processing Timeout'));
                        }, 55000);
                    })
                ]);
            } catch (timeoutErr) {
                if (!signal?.aborted) {
                    console.error(`[WEB] Timeout processing article: ${link}`);
                    failedCount++;
                }
            } finally {
                if (articleTimer) clearTimeout(articleTimer);
                if (signal) signal.removeEventListener('abort', onSourceAbort);
            }
        }

        if (batchCount > 0) {
            await Promise.race([
                batch.commit(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Batch commit timeout (15s)')), 15000))
            ]);
            console.log(`[WEB] Committed ${batchCount} articles successfully for ${source.siteName}${signal?.aborted ? ' (before source timeout)' : ''}`);
        }
        if (signal?.aborted) return;

        // Update scraping_sources with metrics
        await Promise.race([
            doc.ref.update(sanitizeFirestoreData({
                lastStatus: 'active',
                lastError: null,
                lastFetchTime: admin.firestore.FieldValue.serverTimestamp(),
                lastProcessedCount: processedCount,
                lastFailedCount: failedCount,
                processed24h: admin.firestore.FieldValue.increment(processedCount),
                failed24h: admin.firestore.FieldValue.increment(failedCount),
                totalProcessedCount: admin.firestore.FieldValue.increment(processedCount),
                totalFailedCount: admin.firestore.FieldValue.increment(failedCount)
            })),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Update source stats timeout (10s)')), 10000))
        ]).catch(err => console.warn(`Could not update stats for ${source.siteName}:`, err.message));
    } catch (error) {
        lastError = error.message;
        console.error(`Error processing ${source.siteName}:`, error.message);
        try {
            await Promise.race([
                doc.ref.update(sanitizeFirestoreData({
                    lastStatus: 'error',
                    lastError: error.message,
                    lastFetchTime: admin.firestore.FieldValue.serverTimestamp(),
                    lastFailedCount: admin.firestore.FieldValue.increment(1),
                    failed24h: admin.firestore.FieldValue.increment(1)
                })),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Update source error stats timeout (10s)')), 10000))
            ]).catch(() => {});
        } catch (e) {}
    }
}

// ============================================================================
// TWITTER / X SYNDICATION API (Zero Browser, Zero Cost, 100% Reliable & Fast)
// ============================================================================
async function fetchTweetsSyndication(handle, signal = null) {
    const timelineUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`;
    const userAgent = getRandomUserAgent();
    const proxyCount = proxyManager.getProxyCount();
    let maxAttempts = proxyCount > 0 ? Math.min(Math.max(proxyCount, 2), 6) : 2;
    let lastError = 'Unknown syndication error';

    if (signal?.aborted) return { ok: false, tweets: [], error: 'Aborted' };

    // Protect proxy pool when all proxies are already cooling down from 429s
    if (proxyCount > 0 && proxyManager.getHealthyProxyCount() === 0) {
        const waitMs = proxyManager.getEarliestCooldownWaitMs();
        if (waitMs > 0 && waitMs <= 12000) {
            console.log(`[PROXY] ⏳ All proxies cooling down; waiting ${Math.ceil(waitMs / 1000)}s for next proxy recovery before @${handle}...`);
            await sleepWithAbort(waitMs + 300, signal);
        } else {
            // Avoid hammering already-cooled proxies 6-8 times and re-extending their 300s cooldowns
            maxAttempts = 2;
        }
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (signal?.aborted) return { ok: false, tweets: [], error: 'Aborted' };
        const proxyUrl = proxyManager.getNextProxy();
        try {
            const config = {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Referer': 'https://platform.twitter.com/',
                    'Accept-Language': 'en-US,en;q=0.9,te;q=0.8'
                },
                timeout: 12000,
                signal: signal || undefined,
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
            if (res.status === 407) {
                lastError = 'HTTP 407 (Proxy auth required)';
                console.warn(`[PROXY] ❌ Proxy Authentication Required (407). Quarantining proxy...`);
                if (proxyUrl) proxyManager.markBadProxy(proxyUrl);
                continue;
            }
            if (res.status === 404) {
                lastError = 'HTTP 404 (Handle not found or suspended)';
                console.warn(`[X-SYNDICATION] Handle @${handle} returned HTTP 404 (not found/suspended).`);
                return { ok: false, tweets: [], error: lastError };
            }
            if (res.status === 429) {
                lastError = 'HTTP 429 (Syndication rate limit exceeded)';
                if (proxyUrl) {
                    proxyManager.markCooldownProxy(proxyUrl, 5 * 60 * 1000, '429');
                }
                const healthyLeft = proxyManager.getHealthyProxyCount();
                console.warn(`[X-SYNDICATION] Rate limit (429) on @${handle} ${proxyUrl ? 'via proxy' : 'direct'} (attempt ${attempt + 1}/${maxAttempts}). ${healthyLeft > 0 ? 'Rotating...' : 'No healthy proxies left.'}`);
                if (proxyCount > 0 && healthyLeft === 0) {
                    const nextWaitMs = proxyManager.getEarliestCooldownWaitMs();
                    if (nextWaitMs > 0 && nextWaitMs <= 10000 && attempt < maxAttempts - 1) {
                        await sleepWithAbort(nextWaitMs + 300, signal);
                        continue;
                    }
                    // Stop burning through cooling proxies so their 300s timers aren't endlessly reset
                    return { ok: false, tweets: [], error: lastError };
                }
                await sleepWithAbort(800 + (attempt * 450), signal);
                continue;
            }
            if (res.status !== 200 || !res.data) {
                lastError = `HTTP ${res.status || 'empty'} response`;
                if (attempt === maxAttempts - 1) return { ok: false, tweets: [], error: lastError };
                await sleepWithAbort(500, signal);
                continue;
            }

            const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
            const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
            if (!match) {
                lastError = 'Missing __NEXT_DATA__ payload';
                if (attempt === maxAttempts - 1) return { ok: false, tweets: [], error: lastError };
                continue;
            }

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
            return { ok: true, tweets: parsedTweets, error: null };
        } catch (e) {
            lastError = e.message || 'Syndication request error';
            if (proxyUrl) {
                if (lastError.includes('407')) {
                    proxyManager.markBadProxy(proxyUrl);
                } else if (lastError.includes('ECONNREFUSED') || lastError.includes('ETIMEDOUT') || lastError.includes('ECONNRESET') || lastError.includes('timeout')) {
                    // Temporary 10-min cooldown instead of permanent deletion so transient glitches never drain the proxy pool to 0
                    proxyManager.markCooldownProxy(proxyUrl, 10 * 60 * 1000, 'timeout/conn');
                }
            }
            console.error(`[X-SYNDICATION] Attempt ${attempt + 1} failed for @${handle}:`, lastError);
            if (attempt === maxAttempts - 1) return { ok: false, tweets: [], error: lastError };
        }
    }
    return { ok: false, tweets: [], error: lastError };
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
let directStealthFailuresInCurrentCycle = 0;

async function fetchTweetsDirectStealth(handle, signal = null) {
    if (signal?.aborted) return { ok: false, tweets: [], error: 'Aborted' };
    let page = null;
    activeBrowserPages++;
    try {
        const browser = await getSharedBrowser();
        if (!browser || signal?.aborted) return { ok: false, tweets: [], error: 'Browser unavailable' };

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
        if (parsedTweets.length === 0) {
            return { ok: false, tweets: [], error: 'X.com login wall / 0 tweets rendered' };
        }
        return { ok: true, tweets: parsedTweets, error: null };
    } catch (e) {
        if (!signal?.aborted) {
            console.error(`[X-DIRECT] Direct stealth crawl failed for @${handle}:`, e.message);
        }
        // Only recycle shared browser on true CDP/connection failures when no other tab is active
        const isBrowserBroken = e.message.includes('Target closed') ||
                                e.message.includes('Protocol error') ||
                                e.message.includes('Session closed');
        if (isBrowserBroken && activeBrowserPages <= 1) {
            await closeSharedBrowser(true);
        }
        return { ok: false, tweets: [], error: e.message };
    } finally {
        if (page) {
            try { await page.close(); } catch (e) {}
        }
        activeBrowserPages = Math.max(0, activeBrowserPages - 1);
    }
}

// ============================================================================
// TWITTER SCRAPING VIA RAPIDAPI (Fallback)
// ============================================================================
async function fetchTweetsFromRapidAPI(handle) {
    const apiKey = process.env.TWITTER_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY;
    if (!apiKey) return { ok: false, tweets: [], error: null, skipped: true };

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
        if (!data) return { ok: false, tweets: [], error: 'RapidAPI empty response' };

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
        return { ok: true, tweets: parsedTweets, error: null };
    } catch (error) {
        console.error(`[TWITTER] RapidAPI request failed for @${handle}:`, error.message);
        return { ok: false, tweets: [], error: `RapidAPI: ${error.message}` };
    }
}

// ============================================================================
// SCRAPING LOGIC: TWITTER / SOCIAL FEEDS
// ============================================================================
async function processSingleTwitterFeed(doc, signal = null) {
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
        let anyFetchSucceeded = false;
        let lastFetchError = null;

        // 1. Primary Method: Twitter Syndication (Zero browser, Zero RAM, ultra fast & reliable with rotating proxies)
        const synRes = await fetchTweetsSyndication(handle, signal);
        if (signal?.aborted) return;
        let fetchedItems = synRes.tweets || [];
        if (synRes.ok) {
            anyFetchSucceeded = true;
        } else if (synRes.error) {
            lastFetchError = synRes.error;
        }

        // 2. Secondary Fallback: Direct Stealth Puppeteer ONLY when syndication actually failed (not when syndication succeeded with 0 original tweets)
        if (!synRes.ok && fetchedItems.length === 0 && directStealthFailuresInCurrentCycle < 3 && !signal?.aborted) {
            const stealthRes = await fetchTweetsDirectStealth(handle, signal);
            if (stealthRes.ok && stealthRes.tweets.length > 0) {
                fetchedItems = stealthRes.tweets;
                anyFetchSucceeded = true;
                directStealthFailuresInCurrentCycle = 0;
            } else {
                directStealthFailuresInCurrentCycle++;
                if (!lastFetchError && stealthRes.error) lastFetchError = stealthRes.error;
                if (directStealthFailuresInCurrentCycle >= 3) {
                    console.warn(`[X-STEALTH] ⚠️ Direct stealth browser crawl hit 3 consecutive blocks/failures. Skipping direct stealth for rest of this cycle to protect RAM.`);
                }
            }
        }

        // 3. Tertiary Fallback: RapidAPI if configured and previous methods returned 0 items
        if (fetchedItems.length === 0) {
            const rapidRes = await fetchTweetsFromRapidAPI(handle);
            if (!rapidRes.skipped) {
                if (rapidRes.ok) {
                    fetchedItems = rapidRes.tweets || [];
                    anyFetchSucceeded = true;
                } else if (rapidRes.error) {
                    lastFetchError = lastFetchError ? `${lastFetchError} | ${rapidRes.error}` : rapidRes.error;
                }
            }
        }

        const now = Date.now();
        // 36-hour freshness window prevents tweets from being dropped across overnight pause (10 PM - 4 AM IST) or multi-hour queue rotation
        const past36Hours = 36 * 60 * 60 * 1000;

        let validFetchedItems = fetchedItems.filter(item => {
            if (!item.date) return false;
            const diff = now - item.date.getTime();
            return diff <= past36Hours && diff >= -3600000;
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
            const earlySocialTarget = resolveScraperTarget(feed);
            const seenUrls = await isUrlAlreadyScanned(allTweetUrlsToCheck, earlySocialTarget.collectionName);

            const batch = db.batch();

            for (const item of fetchedItems) {
                if (batchCount >= 3 || signal?.aborted) break;
                // If main URL or all thread parts were already scanned, skip
                if (seenUrls.has(item.url) || (item.allUrls && item.allUrls.every(u => seenUrls.has(u)))) continue;

                const authorDisplayName = item.authorName || feed.sourceName || feed.authorName || feed.title || feed.name || `@${handle}`;
                const handleTag = `@${handle}`;
                const district = feed.district || '';
                const designation = feed.designation || feed.role || feed.party || feed.category || '';

                const tweetText = (item.text || '').trim();
                const tweetWords = tweetText.split(/\s+/).filter(Boolean).length;
                const hasSubstantialTweet = tweetWords >= 50;
                const isAggregator = isNewsAggregatorOrPortal(authorDisplayName, handle);

                const prompt = buildEditorialPrompt({
                    mode: 'social',
                    hasSubstantialSource: hasSubstantialTweet,
                    sourceWords: tweetWords,
                    imageUrl: '',
                    authorDisplayName,
                    handleTag,
                    designation,
                    district,
                    isAggregator,
                    targetLanguage: earlySocialTarget.language,
                    targetStateCode: earlySocialTarget.stateCode
                });

                const markItemUrls = async (tItem) => {
                    const urls = tItem.allUrls && tItem.allUrls.length > 0 ? tItem.allUrls : [tItem.url];
                    for (const u of urls) {
                        await markUrlAsProcessed(u);
                    }
                };

                const speakerFromText = extractSpeakerFromTweet(item.text);
                let postInputText = isAggregator
                    ? `NEWS REPORT TEXT:\n`
                    : `POST SOURCE / AUTHOR: ${authorDisplayName} (${handleTag})\n`;
                if (speakerFromText) {
                    postInputText += `MANDATORY SPEAKER / STATEMENT GIVER: ${speakerFromText}\n`;
                }
                if (!isAggregator) {
                    postInputText += `POST TEXT:\n`;
                }
                postInputText += item.text;

                // Vision inspection: Pass genuine attached tweet photos (never profile avatars) so Gemini can
                // detect channel logos/watermarks accurately and read press notes/GOs when present.
                const hasGenuineTweetPhoto = Boolean(
                    item.mediaUrl &&
                    item.mediaUrl.startsWith('http') &&
                    item.mediaType !== 'video' &&
                    !isGenericImage(item.mediaUrl) &&
                    !item.mediaUrl.includes('profile_images')
                );
                const imageToProcess = hasGenuineTweetPhoto ? item.mediaUrl : null;
                const aiResult = await processWithGemini(postInputText, prompt, imageToProcess, 4, null, { signal });
                if (!aiResult || signal?.aborted) continue;

                try {
                    let parsed;
                    try {
                        parsed = parseAIJson(aiResult);
                    } catch (initialParseErr) {
                        if (signal?.aborted) break;
                        console.warn(`[TWITTER] Malformed JSON for @${handle} (${initialParseErr.message}). Retrying once at low temperature...`);
                        const retryResult = await processWithGemini(postInputText, prompt, imageToProcess, 2, null, { signal, temperature: 0.1 });
                        if (!retryResult || signal?.aborted) throw initialParseErr;
                        parsed = parseAIJson(retryResult);
                    }
                    const socialLang = earlySocialTarget.language;
                    const validContent = socialLang === 'te'
                        ? (parsed.contentTe || parsed.contentLocal || parsed.content || '')
                        : (parsed.contentLocal || parsed.contentTe || parsed.content || (socialLang === 'en' ? parsed.contentEn : '') || '');
                    if (!parsed.isRelevant || !parsed.headline || !validContent) {
                        console.log(`[TWITTER] ⏭️ Filtered out non-news/satirical post for @${handle}: "${(item.text || '').substring(0, 45).replace(/\n/g, ' ')}..."`);
                        await markItemUrls(item);
                        continue;
                    }
                    parsed.content = validContent;

                    // Clean headline immediately in target language script
                    parsed.headline = socialLang === 'te'
                        ? cleanTeluguHeadline(stripAggregatorAttribution(parsed.headline))
                        : cleanGenericHeadline(stripAggregatorAttribution(parsed.headline));
                    if (parsed.headlineEn) {
                        parsed.headlineEn = cleanEnglishHeadline(parsed.headlineEn);
                    }
                    const isSocialHeadlineValid = socialLang === 'te'
                        ? isTeluguScript(parsed.headline)
                        : isTargetLanguageScript(parsed.headline, socialLang);
                    if (!parsed.headline || !isSocialHeadlineValid) {
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

                        // Query Firestore target collection using single-field index on storyFingerprint
                        const duplicate = await db.collection(earlySocialTarget.collectionName)
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

                    const reporter = getReporterForLanguage(socialLang) || getRandomReporter();
                    const category = parsed.refinedCategory || feed.category || 'Politics';
                    const detected = detectDistrict(parsed.location, (parsed.headline || '') + ' ' + (item.text || ''), earlySocialTarget.stateCode);

                    // Canonicalize explicit district assigned to this feed (e.g. "Nellore" / "నెల్లూరు" -> "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు")
                    const rawFeedDistrict = (feed.district || '').trim();
                    const feedDistrictMatch = rawFeedDistrict ? detectDistrict(rawFeedDistrict, '', earlySocialTarget.stateCode) : null;
                    const hasSpecificFeedDistrict = Boolean(
                        rawFeedDistrict &&
                        !['general', 'all', 'andhrapradesh', 'andhra pradesh', 'telangana', 'uttarpradesh', 'uttar pradesh', 'punjab', 'uttarakhand', 'goa', 'manipur', 'himachalpradesh', 'himachal pradesh', 'gujarat', 'ap', 'ts', 'up', 'pb', 'uk', 'ga', 'mn', 'hp', 'gj', 'national', 'international'].includes(rawFeedDistrict.toLowerCase()) &&
                        (!feedDistrictMatch || !['AndhraPradesh', 'Telangana', 'UttarPradesh', 'Punjab', 'Uttarakhand', 'Goa', 'Manipur', 'HimachalPradesh', 'Gujarat'].includes(feedDistrictMatch.canonical))
                    );
                    const canonicalFeedDistrict = hasSpecificFeedDistrict
                        ? (feedDistrictMatch ? feedDistrictMatch.canonical : rawFeedDistrict)
                        : null;
                    const canonicalFeedState = (feedDistrictMatch && feedDistrictMatch.state) ? feedDistrictMatch.state : (earlySocialTarget.stateCode || feed.state || null);

                    let finalDistrict = "General";
                    let finalState = canonicalFeedState || earlySocialTarget.stateCode || feed.state || null;

                    if (PURE_GLOBAL_CATEGORIES.includes(category)) {
                        finalDistrict = "General";
                    } else if (!isAggregator && canonicalFeedDistrict) {
                        // Preserve district for district-specific leaders & officials (e.g. SP Nellore, Anam Ramanarayana Reddy, Somireddy)
                        // so mentions of Amaravati/AP/Tirumala/Hyderabad never steal their updates out of their district's Local News feed.
                        finalDistrict = canonicalFeedDistrict;
                        if (canonicalFeedState) finalState = canonicalFeedState;
                    } else if (detected) {
                        finalDistrict = detected.canonical;
                        if (detected.state) finalState = detected.state;
                    } else if (canonicalFeedDistrict) {
                        finalDistrict = canonicalFeedDistrict;
                        if (canonicalFeedState) finalState = canonicalFeedState;
                    } else if (rawFeedDistrict) {
                        finalDistrict = rawFeedDistrict;
                    }

                    let finalMediaUrl = ALFA_NEWS_LOGO;
                    let usedAvatarFallback = false;
                    let rawMedia = null;
                    if (parsed.hasLogo === true && hasGenuineTweetPhoto) {
                        console.log(`[TWITTER-IMAGE] 🛑 AI detected logo/watermark on tweet photo for @${handle}: "${parsed.headline}". Rejecting photo.`);
                    } else if (item.mediaUrl && item.mediaUrl.startsWith('http') && !isGenericImage(item.mediaUrl)) {
                        rawMedia = item.mediaUrl;
                    }

                    // Allow profile avatar fallback ONLY for real individual/official handles (NEVER news portals/aggregators!)
                    if (!rawMedia && !isAggregator && item.avatarUrl && item.avatarUrl.startsWith('http') && !isGenericImage(item.avatarUrl)) {
                        rawMedia = item.avatarUrl;
                        usedAvatarFallback = true;
                    }

                    if (rawMedia && !isGenericImage(rawMedia)) {
                        const uploadedUrl = await uploadMediaToStorage(rawMedia);
                        if (uploadedUrl) {
                            finalMediaUrl = uploadedUrl;
                        } else {
                            finalMediaUrl = `https://wsrv.nl/?url=${encodeURIComponent(rawMedia)}&output=webp`;
                        }
                    }

                    // Enforce target script purity & Single Paragraph (legacy Telugu path for 'te', native script for 'hi'/'pa'/'gu'/'en')
                    const cleanedHeadline = parsed.headline;
                    let rawContentLocal = socialLang === 'te'
                        ? (parsed.contentTe || parsed.contentLocal || parsed.content || '')
                        : (parsed.contentLocal || parsed.contentTe || parsed.content || (socialLang === 'en' ? parsed.contentEn : '') || '');
                    let rawContentEn = parsed.contentEn || (socialLang === 'en' ? rawContentLocal : '');
                    const rawSocialFullStory = parsed.fullStoryLocal || parsed.fullStoryTe || '';

                    let cleanedContent = '';
                    let cleanedFullStoryTe = "";
                    let cleanedFullStoryEn = "";

                    if (socialLang === 'te') {
                        if (!isTeluguScript(rawContentLocal) && isTeluguScript(rawContentEn)) {
                            console.log(`[TWITTER] 🔄 Swapping English/Telugu content fields for @${handle}`);
                            const tmp = rawContentLocal;
                            rawContentLocal = rawContentEn;
                            rawContentEn = tmp;
                        } else if (!isTeluguScript(rawContentLocal)) {
                            console.warn(`[TWITTER] ⚠️ content was returned in English for @${handle}. Checking fullStoryTe fallback...`);
                            if (!rawContentEn && rawContentLocal) rawContentEn = rawContentLocal;
                            if (rawSocialFullStory && isTeluguScript(rawSocialFullStory)) {
                                rawContentLocal = rawSocialFullStory.split(/\r?\n\r?\n/)[0].trim();
                                console.log(`[TWITTER] ✅ Recovered Telugu content from fullStoryTe first paragraph.`);
                            }
                        }

                        cleanedContent = sanitizeTeluguText(stripAggregatorAttribution(rawContentLocal)).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
                        if (!isTeluguScript(cleanedContent)) {
                            console.warn(`[TWITTER] 🛑 Skipping tweet with non-Telugu summary for @${handle}: "${cleanedHeadline}"`);
                            await markItemUrls(item);
                            continue;
                        }

                        if (hasSubstantialTweet && rawSocialFullStory && isTeluguScript(rawSocialFullStory)) {
                            const rawStory = sanitizeTeluguText(stripAggregatorAttribution(rawSocialFullStory)).trim();
                            const storyWords = rawStory.split(/\s+/).filter(Boolean).length;
                            if (storyWords >= 60 && rawStory !== cleanedContent && rawStory.length > cleanedContent.length + 30) {
                                cleanedFullStoryTe = formatIntoParagraphs(rawStory);
                            }
                        }
                    } else {
                        if (!isTargetLanguageScript(rawContentLocal, socialLang) && rawSocialFullStory && isTargetLanguageScript(rawSocialFullStory, socialLang)) {
                            rawContentLocal = rawSocialFullStory.split(/\r?\n\r?\n/)[0].trim();
                        }
                        cleanedContent = sanitizeGenericText(stripAggregatorAttribution(rawContentLocal)).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
                        if (!isTargetLanguageScript(cleanedContent, socialLang)) {
                            console.warn(`[TWITTER] 🛑 Skipping tweet with invalid ${socialLang} script summary for @${handle}: "${cleanedHeadline}"`);
                            await markItemUrls(item);
                            continue;
                        }

                        if (hasSubstantialTweet && rawSocialFullStory && isTargetLanguageScript(rawSocialFullStory, socialLang)) {
                            const rawStory = sanitizeGenericText(stripAggregatorAttribution(rawSocialFullStory)).trim();
                            const storyWords = rawStory.split(/\s+/).filter(Boolean).length;
                            if (storyWords >= 50 && rawStory !== cleanedContent && rawStory.length > cleanedContent.length + 30) {
                                cleanedFullStoryTe = formatIntoParagraphs(rawStory);
                            }
                        }
                    }

                    if (hasSubstantialTweet && parsed.fullStoryEn) {
                        const rawStoryEn = String(parsed.fullStoryEn).trim();
                        if (rawStoryEn.split(/\s+/).filter(Boolean).length >= 55 && rawStoryEn.length > (rawContentEn || '').length + 30) {
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
                    if (usedAvatarFallback) {
                        postFormat = '1:1';
                    }

                    const leaderDetect = socialLang === 'te'
                        ? detectTopTeluguLeader(cleanedHeadline, `${cleanedHeadline} ${cleanedContent}`, feed.sourceName || handle)
                        : { isTopLeaderNews: false, leaderName: '' };
                    const isTopLeaderNews = leaderDetect.isTopLeaderNews;
                    if (isTopLeaderNews) {
                        console.log(`[SCRAPER_TOP_LEADER] Detected statement/quote for ${leaderDetect.leaderName} in tweet @${handle}: "${cleanedHeadline}". Flagging BREAKING!`);
                    }

                    const isPoliticalCategory = category === 'Politics' || category === 'రాజకీయం' || feed.category === 'Politics' || feed.category === 'రాజకీయం';
                    const socialNotifMeta = classifyScraperNotification({
                        parsed,
                        cleanedHeadline,
                        cleanedContent,
                        isTopLeaderNews,
                    });

                    const socialTarget = resolveScraperTarget(feed, finalState);
                    const docRef = db.collection(socialTarget.collectionName).doc();
                    const newsPayload = sanitizeFirestoreData({
                        headline: buildLocalizedTextMap(cleanedHeadline, parsed.headlineEn || '', socialTarget.language),
                        content: buildLocalizedTextMap(cleanedContent, rawContentEn || parsed.contentEn || '', socialTarget.language),
                        fullStory: buildLocalizedTextMap(cleanedFullStoryTe, cleanedFullStoryEn, socialTarget.language),
                        sourceUrl: item.url,
                        originalUrl: item.url,
                        sourceName: feed.sourceName || `X (@${handle})`,
                        category: category,
                        categories: [...new Set([
                            feed.sourceName || `X (@${handle})`, 
                            category, 
                            "Social", 
                            ...(isPoliticalCategory ? ["రాజకీయం"] : []), 
                            "ముఖ్యాంశాలు",
                            ...(finalDistrict !== "General" && !GLOBAL_CATEGORIES.includes(finalDistrict) ? ["Local", finalDistrict] : [])
                        ])].filter(Boolean),
                        tags: cleanedTags,
                        entities: finalEntities,
                        district: finalDistrict || "General",
                        state: finalState || socialTarget.stateCode,
                        stateCode: socialTarget.stateCode || finalState,
                        mandal: (finalDistrict === feed.district ? (feed.mandal || null) : null),
                        location: parsed.location || (finalDistrict !== 'General' ? finalDistrict : (feed.district || 'General')),
                        storyFingerprint: parsed.storyFingerprint || '',
                        mediaUrl: finalMediaUrl,
                        mediaType: finalMediaType,
                        postFormat: postFormat,
                        language: socialTarget.language,
                        type: 'news',
                        isGlobal: true,
                        isReporter: true,
                        isCitizen: false,
                        aiProcessed: true,
                        tone: socialNotifMeta.tone,
                        isBreaking: socialNotifMeta.isBreaking,
                        notificationWorthy: socialNotifMeta.notificationWorthy,
                        notificationTitle: socialNotifMeta.notificationTitle,
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        status: 'published',
                        approved: true,
                        qualityScore: socialNotifMeta.qualityScore,
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
                    if (parsed.headline) {
                        recentHeadlinesMemoryCache.push(parsed.headline);
                        if (recentHeadlinesMemoryCache.length > 500) {
                            recentHeadlinesMemoryCache.splice(0, recentHeadlinesMemoryCache.length - 500);
                        }
                    }
                    if (parsed.storyFingerprint) {
                        if (storyFingerprintMemoryCache.size > 3000) {
                            const oldFp = Array.from(storyFingerprintMemoryCache).slice(0, 500);
                            oldFp.forEach(k => storyFingerprintMemoryCache.delete(k));
                        }
                        storyFingerprintMemoryCache.add(parsed.storyFingerprint);
                    }
                    batchCount++;
                } catch (e) {
                    console.error(`[TWITTER] JSON/processing error for @${handle}:`, e.message);
                }
            }

            if (batchCount > 0) {
                await Promise.race([
                    batch.commit(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Batch commit timeout (15s)')), 15000))
                ]);
                console.log(`[TWITTER] Committed ${batchCount} tweets for @${handle}`);
            }
        }
        if (!anyFetchSucceeded) {
            const errText = String(lastFetchError || 'All Twitter fetch methods failed').substring(0, 200);
            console.warn(`[TWITTER] ❌ All fetch methods failed for @${handle}: ${errText}`);
            await Promise.race([
                doc.ref.update({
                    lastFetchTime: admin.firestore.FieldValue.serverTimestamp(),
                    lastStatus: 'error',
                    lastError: errText,
                    totalFailedCount: admin.firestore.FieldValue.increment(1)
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Update error stats timeout (10s)')), 10000))
            ]).catch(err => console.warn(`Could not update error stats for @${handle}:`, err.message));
        } else {
            await Promise.race([
                doc.ref.update({
                    lastFetchTime: admin.firestore.FieldValue.serverTimestamp(),
                    lastStatus: 'active',
                    lastError: null,
                    totalProcessedCount: admin.firestore.FieldValue.increment(batchCount),
                    todayProcessedCount: admin.firestore.FieldValue.increment(batchCount)
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Update stats timeout (10s)')), 10000))
            ]).catch(err => console.warn(`Could not update stats for @${handle}:`, err.message));
        }
    } catch (error) {
        console.error(`Error processing Twitter @${handle}:`, error.message);
        await Promise.race([
            doc.ref.update({
                lastFetchTime: admin.firestore.FieldValue.serverTimestamp(),
                lastStatus: 'error',
                lastError: error.message,
                totalFailedCount: admin.firestore.FieldValue.increment(1)
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Update error stats timeout (10s)')), 10000))
        ]).catch(() => {});
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
            console.warn("[QUEUE] ⚠️ Scraping stuck for over 45 mins. Closing browsers and force resetting lock...");
            await closeSharedBrowser(true).catch(() => {});
            isScraping = false;
        } else {
            console.log("[QUEUE] Scraping cycle already in progress. Skipping this cycle.");
            return;
        }
    }
    
    isScraping = true;
    lastScrapeStartTime = Date.now();
    directStealthFailuresInCurrentCycle = 0;
    try {
        // ✅ Daily counter reset (IST midnight దాటితే)
        await resetDailyCountersIfNeeded();
        await prewarmScraperCache();
        
        const allowedStatesSet = parseScraperStatesFilter();
        const getLastFetchMillis = (d) => {
            const t = d.data().lastFetchTime;
            if (!t) return 0;
            if (t.toMillis) return t.toMillis();
            if (t._seconds) return t._seconds * 1000;
            return new Date(t).getTime() || 0;
        };

        const webSnapshot = await db.collection('scraping_sources').get();
        const allActiveWebDocs = webSnapshot.docs.filter(doc => {
            const data = doc.data();
            if (data.isPaused === true) return false;
            return doesSourceMatchStateFilter(data, allowedStatesSet);
        });
        // Rotate oldest-first so adding 100-300+ multi-state URLs never overflows an hourly VPS cycle
        allActiveWebDocs.sort((a, b) => getLastFetchMillis(a) - getLastFetchMillis(b));
        const MAX_WEB_SOURCES_PER_CYCLE = parseInt(process.env.MAX_WEB_SOURCES_PER_CYCLE, 10) || 60;
        const webDocs = allActiveWebDocs.slice(0, MAX_WEB_SOURCES_PER_CYCLE);

        const twitterSnapshot = await db.collection('social_feeds').get();
        const twitterDocs = twitterSnapshot.docs.filter(doc => {
            const data = doc.data();
            if (data.isPaused === true) return false;
            const platform = (data.platform || '').toLowerCase();
            if (platform && platform !== 'twitter' && platform !== 'x') return false;
            return doesSourceMatchStateFilter(data, allowedStatesSet);
        });

        // Prioritize feeds that have never been fetched (null/missing lastFetchTime) or were fetched longest ago
        twitterDocs.sort((a, b) => getLastFetchMillis(a) - getLastFetchMillis(b));

        // Bounded cycle: Process up to MAX_WEB_SOURCES_PER_CYCLE web sources + MAX_TWITTER_FEEDS_PER_CYCLE Twitter feeds.
        const MAX_TWITTER_FEEDS_PER_CYCLE = parseInt(process.env.MAX_TWITTER_FEEDS_PER_CYCLE, 10) || 75;
        const cycleTwitterDocs = twitterDocs.slice(0, MAX_TWITTER_FEEDS_PER_CYCLE);

        const workerScopeLabel = allowedStatesSet ? `States=[${Array.from(allowedStatesSet).join(',')}]` : 'States=[ALL]';
        console.log(`[QUEUE] Starting Cycle (${workerScopeLabel}): ${webDocs.length}/${allActiveWebDocs.length} Web sources + ${cycleTwitterDocs.length}/${twitterDocs.length} Twitter feeds (Oldest first).`);

        while (webDocs.length > 0 || cycleTwitterDocs.length > 0) {
            // Cutoff guard: Stop immediately if clock strikes 10:00 PM IST (22:00)
            if (!isOperatingHours()) {
                const currentIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
                console.log(`[SCHEDULE] 🛑 10:00 PM IST cutoff reached! Halting scraper queue immediately (Current IST: ${currentIST}).`);
                break;
            }

            // Process 1 Twitter feed
            if (cycleTwitterDocs.length > 0) {
                const tDoc = cycleTwitterDocs.shift();
                const tController = new AbortController();
                let tTimer = null;
                try {
                    await Promise.race([
                        processSingleTwitterFeed(tDoc, tController.signal),
                        new Promise((_, reject) => {
                            tTimer = setTimeout(() => {
                                tController.abort();
                                reject(new Error('Twitter Timeout'));
                            }, 90000);
                        })
                    ]);
                } catch (e) {
                    console.error(`Error processing twitter ${tDoc.id}:`, e.message);
                } finally {
                    if (tTimer) clearTimeout(tTimer);
                }

                // Option C: Smart Jitter Delay between Twitter feeds
                // If there are no web sources left to interleave (or between consecutive feeds),
                // wait a polite delay so Twitter/X never detects a burst pattern; extend slightly when proxies are low
                if (webDocs.length === 0 && cycleTwitterDocs.length > 0) {
                    const lowProxies = proxyManager.getProxyCount() > 0 && proxyManager.getHealthyProxyCount() <= 2;
                    const minDelay = lowProxies ? 4000 : (parseInt(process.env.TWITTER_DELAY_MIN_MS, 10) || 2000);
                    const maxDelay = lowProxies ? 6500 : (parseInt(process.env.TWITTER_DELAY_MAX_MS, 10) || 4000);
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
                const wController = new AbortController();
                let wTimer = null;
                try {
                    await Promise.race([
                        processSingleWebSource(wDoc, wController.signal),
                        new Promise((_, reject) => {
                            wTimer = setTimeout(() => {
                                wController.abort();
                                reject(new Error('Web Timeout'));
                            }, 120000);
                        })
                    ]);
                } catch (e) {
                    console.error(`Error processing web source ${wDoc.id}:`, e.message);
                } finally {
                    if (wTimer) clearTimeout(wTimer);
                }
            }
        }
        const durationSec = Math.round((Date.now() - lastScrapeStartTime) / 1000);
        console.log(`[QUEUE] ✅ Finished Interleaved Scraping Cycle in ${durationSec}s. Next run in next hourly cron.`);
    } catch (error) {
        console.error("Queue Error:", error);
    } finally {
        isScraping = false;
        // Clean up any idle shared browser to release memory
        await closeSharedBrowser(true).catch(() => {});
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
