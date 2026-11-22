/**
 * Alfa News Multi-State VPS Scraper Edition Configuration (9 States × 5 Languages)
 * Strict State-Bound Languages — zero cross-state translation:
 *  - AP, TS      -> te, en     -> collection 'news' (100% untouched legacy behavior)
 *  - UP, UK, HP  -> hi, en     -> 'news_hi' (or 'news_en')
 *  - PB          -> pa, hi, en -> 'news_pa' (or 'news_hi' / 'news_en')
 *  - GJ          -> gu, en     -> 'news_gu' (or 'news_en')
 *  - GA, MN      -> en, hi     -> 'news_en' (or 'news_hi')
 */

const EDITIONS_CONFIG = {
  AP: { stateCode: 'AP', nameEn: 'Andhra Pradesh', nativeName: 'ఆంధ్రప్రదేశ్', primaryLanguage: 'te', supportedLanguages: ['te', 'en'], collection: 'news' },
  TS: { stateCode: 'TS', nameEn: 'Telangana', nativeName: 'తెలంగాణ', primaryLanguage: 'te', supportedLanguages: ['te', 'en'], collection: 'news' },
  UP: { stateCode: 'UP', nameEn: 'Uttar Pradesh', nativeName: 'उत्तर प्रदेश', primaryLanguage: 'hi', supportedLanguages: ['hi', 'en'], collection: 'news_hi' },
  PB: { stateCode: 'PB', nameEn: 'Punjab', nativeName: 'ਪੰਜਾਬ', primaryLanguage: 'pa', supportedLanguages: ['pa', 'hi', 'en'], collection: 'news_pa' },
  UK: { stateCode: 'UK', nameEn: 'Uttarakhand', nativeName: 'उत्तराखंड', primaryLanguage: 'hi', supportedLanguages: ['hi', 'en'], collection: 'news_hi' },
  GA: { stateCode: 'GA', nameEn: 'Goa', nativeName: 'Goa', primaryLanguage: 'en', supportedLanguages: ['en', 'hi'], collection: 'news_en' },
  MN: { stateCode: 'MN', nameEn: 'Manipur', nativeName: 'Manipur', primaryLanguage: 'en', supportedLanguages: ['en', 'hi'], collection: 'news_en' },
  HP: { stateCode: 'HP', nameEn: 'Himachal Pradesh', nativeName: 'हिमाचल प्रदेश', primaryLanguage: 'hi', supportedLanguages: ['hi', 'en'], collection: 'news_hi' },
  GJ: { stateCode: 'GJ', nameEn: 'Gujarat', nativeName: 'ગુજરાત', primaryLanguage: 'gu', supportedLanguages: ['gu', 'en'], collection: 'news_gu' },
};

const ALL_NEWS_COLLECTIONS = ['news', 'news_hi', 'news_pa', 'news_gu', 'news_en'];

const STATE_ALIAS_TO_CODE = {
  ap: 'AP', 'andhra pradesh': 'AP', andhra: 'AP', 'ఆంధ్రప్రదేశ్': 'AP', 'ఆంధ్ర ప్రదేశ్': 'AP',
  ts: 'TS', tg: 'TS', telangana: 'TS', 'తెలంగాణ': 'TS',
  up: 'UP', 'uttar pradesh': 'UP', 'उत्तर प्रदेश': 'UP',
  pb: 'PB', punjab: 'PB', 'ਪੰਜਾਬ': 'PB', 'पंजाब': 'PB',
  uk: 'UK', ut: 'UK', uttarakhand: 'UK', 'उत्तराखंड': 'UK', 'उत्तराखण्ड': 'UK',
  ga: 'GA', goa: 'GA', 'गोवा': 'GA',
  mn: 'MN', manipur: 'MN', 'मणिपुर': 'MN',
  hp: 'HP', 'himachal pradesh': 'HP', himachal: 'HP', 'हिमाचल प्रदेश': 'HP',
  gj: 'GJ', gujarat: 'GJ', 'ગુજરાત': 'GJ', 'गुजरात': 'GJ',
};

const LANGUAGE_META = {
  te: {
    code: 'te',
    nameEn: 'Telugu',
    scriptName: 'Telugu script (Unicode U+0C00-U+0C7F)',
    scriptRegex: /[\u0C00-\u0C7F]/g,
    minScriptChars: 6,
    exampleHeadlines: '"విజయవాడ హైవేపై లారీ ఢీకొని ముగ్గురు మృతి"',
  },
  hi: {
    code: 'hi',
    nameEn: 'Hindi',
    scriptName: 'Devanagari script (Unicode U+0900-U+097F)',
    scriptRegex: /[\u0900-\u097F]/g,
    minScriptChars: 6,
    exampleHeadlines: '"लखनऊ एक्सप्रेसवे पर सड़क हादसे में तीन लोगों की मौत", "किसानों के खाते में आज आएगी सम्मान निधि की किस्त"',
  },
  pa: {
    code: 'pa',
    nameEn: 'Punjabi',
    scriptName: 'Gurmukhi script (Unicode U+0A00-U+0A7F)',
    scriptRegex: /[\u0A00-\u0A7F]/g,
    minScriptChars: 6,
    exampleHeadlines: '"ਲੁਧਿਆਣਾ ਹਾਈਵੇ ਤੇ ਭਿਆਨਕ ਹਾਦਸੇ ਵਿੱਚ ਤਿੰਨ ਮੌਤਾਂ", "ਪੰਜਾਬ ਸਰਕਾਰ ਨੇ ਕਿਸਾਨਾਂ ਲਈ ਨਵੀਂ ਮੁਆਵਜ਼ਾ ਰਾਸ਼ੀ ਜਾਰੀ ਕੀਤੀ"',
  },
  gu: {
    code: 'gu',
    nameEn: 'Gujarati',
    scriptName: 'Gujarati script (Unicode U+0A80-U+0AFF)',
    scriptRegex: /[\u0A80-\u0AFF]/g,
    minScriptChars: 6,
    exampleHeadlines: '"અમદાવાદ હાઇવે પર અકસ્માતમાં ત્રણના મોત", "ખેડૂતોના ખાતામાં આજે સહાયની રકમ જમા થશે"',
  },
  en: {
    code: 'en',
    nameEn: 'English',
    scriptName: 'standard clear English',
    scriptRegex: /[A-Za-z]/g,
    minScriptChars: 12,
    exampleHeadlines: '"Three killed in highway collision near Panaji", "State approves new drinking water project for Imphal"',
  },
};

function resolveStateCode(rawState) {
  if (!rawState || typeof rawState !== 'string') return null;
  const clean = rawState.trim();
  if (EDITIONS_CONFIG[clean.toUpperCase()]) return clean.toUpperCase();
  return STATE_ALIAS_TO_CODE[clean.toLowerCase()] || null;
}

function validateLanguageForState(stateCode, requestedLang) {
  const ed = EDITIONS_CONFIG[stateCode] || EDITIONS_CONFIG.AP;
  const candidate = String(requestedLang || '').toLowerCase().trim();
  if (ed.supportedLanguages.includes(candidate)) return candidate;
  return ed.primaryLanguage;
}

function getLanguageMeta(language) {
  const code = String(language || 'te').toLowerCase().trim();
  return LANGUAGE_META[code] || LANGUAGE_META.te;
}

/**
 * Validates that text is genuinely written in the target language script.
 * Prevents cross-language contamination (e.g. Telugu text entering news_hi/news_gu).
 */
function isTargetLanguageScript(text, language = 'te') {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 6) return false;
  const meta = getLanguageMeta(language);
  const matches = trimmed.match(meta.scriptRegex) || [];
  if (matches.length < meta.minScriptChars) return false;
  // Reject Telugu leakage in non-Telugu targets
  if (meta.code !== 'te' && /[\u0C00-\u0C7F]{3,}/.test(trimmed)) return false;
  return true;
}

/**
 * Cleans headlines for Hindi, Punjabi, Gujarati, and English (no quotes, colons, trailing punctuation).
 */
function cleanGenericHeadline(headline) {
  if (!headline || typeof headline !== 'string') return '';
  let clean = headline.trim();
  clean = clean.replace(/^["'“”‘’«»`]+|["'“”‘’«»`]+$/g, '');
  clean = clean.replace(/["'“”‘’]/g, '');
  clean = clean.replace(/^(BREAKING|FLASH|UPDATE|WATCH|EXCLUSIVE|ब्रेकिंग|बड़ी खबर|ताजा खबर|ਤਾਜ਼ਾ ਖ਼ਬਰ|બ્રેકિંગ)\s*[:\-–—|]*\s*/i, '');
  clean = clean.replace(/\s*[:;–—|]\s*/g, ' ');
  clean = clean.replace(/\.{2,}/g, ' ');
  clean = clean.replace(/\s+/g, ' ').trim();
  clean = clean.replace(/[।|.,:;!?-]+$/, '').trim();
  return clean;
}

/**
 * Sanitizes body/full-story text for Hindi, Punjabi, Gujarati, and English.
 */
function sanitizeGenericText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Resolves the target Firestore collection and language for a scraping source.
 * Existing AP/TS sources with no explicit stateCode/language continue writing to 'news' with 'te'.
 */
function resolveScraperTarget(source = {}, fallbackState = '') {
  const rawState = source.stateCode || source.state || fallbackState || '';
  const stateCode = resolveStateCode(rawState);

  // If no state (e.g. National feed) but explicit language is set (hi/pa/gu/en), route by language!
  if (!stateCode) {
    const reqLang = String(source.language || '').toLowerCase().trim();
    if (reqLang === 'hi') return { stateCode: '', language: 'hi', collectionName: source.targetCollection || 'news_hi' };
    if (reqLang === 'pa') return { stateCode: '', language: 'pa', collectionName: source.targetCollection || 'news_pa' };
    if (reqLang === 'gu') return { stateCode: '', language: 'gu', collectionName: source.targetCollection || 'news_gu' };
    if (reqLang === 'en') return { stateCode: '', language: 'en', collectionName: source.targetCollection || 'news_en' };
    return {
      stateCode: fallbackState === 'TS' ? 'TS' : fallbackState === 'AP' ? 'AP' : '',
      language: 'te',
      collectionName: source.targetCollection || 'news',
    };
  }

  if (stateCode === 'AP' || stateCode === 'TS') {
    return {
      stateCode,
      language: source.language === 'en' ? 'en' : 'te',
      collectionName: source.targetCollection || 'news',
    };
  }

  const language = validateLanguageForState(stateCode, source.language);
  let collectionName = source.targetCollection || EDITIONS_CONFIG[stateCode].collection;
  if (!source.targetCollection) {
    if (language === 'hi') collectionName = 'news_hi';
    else if (language === 'pa') collectionName = 'news_pa';
    else if (language === 'gu') collectionName = 'news_gu';
    else if (language === 'en') collectionName = 'news_en';
  }

  return { stateCode, language, collectionName };
}

/**
 * Parses optional SCRAPER_STATES env var (e.g., "AP,TS" or "UP,UK,HP,PB,GJ,GA,MN")
 * so admins can run isolated PM2 workers per region without slowing down Telugu scraping.
 * Returns null if unset (meaning process all states).
 */
function parseScraperStatesFilter(envValue = process.env.SCRAPER_STATES) {
  if (!envValue || !String(envValue).trim()) return null;
  const codes = String(envValue)
    .split(/[\s,]+/)
    .map((s) => resolveStateCode(s) || (s.trim().toUpperCase() === 'NATIONAL' ? 'NATIONAL' : null))
    .filter(Boolean);
  return codes.length > 0 ? new Set(codes) : null;
}

function doesSourceMatchStateFilter(source = {}, allowedStatesSet = null) {
  if (!allowedStatesSet) return true;
  const target = resolveScraperTarget(source);
  if (target.stateCode) {
    return allowedStatesSet.has(target.stateCode);
  }
  // Unassigned / National sources: match NATIONAL, or default Telugu national feeds to AP/TS workers
  if (allowedStatesSet.has('NATIONAL')) return true;
  if (target.language === 'te' && (allowedStatesSet.has('AP') || allowedStatesSet.has('TS'))) return true;
  if (target.language === 'hi' && (allowedStatesSet.has('UP') || allowedStatesSet.has('UK') || allowedStatesSet.has('HP'))) return true;
  if (target.language === 'pa' && allowedStatesSet.has('PB')) return true;
  if (target.language === 'gu' && allowedStatesSet.has('GJ')) return true;
  if (target.language === 'en' && (allowedStatesSet.has('GA') || allowedStatesSet.has('MN'))) return true;
  return false;
}

/**
 * Builds backward-compatible localized text maps for all 5 scripts.
 */
function buildLocalizedTextMap(primaryText, englishText, language) {
  const map = {
    telugu: language === 'te' ? (primaryText || '') : '',
    english: language === 'en' ? (primaryText || englishText || '') : (englishText || ''),
    local: primaryText || englishText || '',
  };
  if (language === 'hi' || language === 'pa' || language === 'gu') {
    map[language] = primaryText || '';
  }
  return map;
}

const { EXPANSION_DISTRICT_MAPPING } = require('./expansionDistricts');

const EXPANSION_REPORTERS_BY_LANG = {
  hi: [
    { id: 'rep_hi_1', name: 'राजेश शर्मा' },
    { id: 'rep_hi_2', name: 'अमित वर्मा' },
    { id: 'rep_hi_3', name: 'संदीप तिवारी' },
    { id: 'rep_hi_4', name: 'विकास सिंह' },
    { id: 'rep_hi_5', name: 'प्रदीप मिश्रा' },
    { id: 'rep_hi_6', name: 'नीरज पांडे' },
    { id: 'rep_hi_7', name: 'दीपक यादव' },
    { id: 'rep_hi_8', name: 'मनीष शुक्ला' },
    { id: 'rep_hi_9', name: 'राहुल गुप्ता' },
    { id: 'rep_hi_10', name: 'सुरेश चौहान' },
    { id: 'rep_hi_11', name: 'अंकित जोशी' },
    { id: 'rep_hi_12', name: 'रवि रावत' },
  ],
  pa: [
    { id: 'rep_pa_1', name: 'ਹਰਪ੍ਰੀਤ ਸਿੰਘ' },
    { id: 'rep_pa_2', name: 'ਗੁਰਪ੍ਰੀਤ ਕੌਰ' },
    { id: 'rep_pa_3', name: 'ਮਨਦੀਪ ਸਿੰਘ' },
    { id: 'rep_pa_4', name: 'ਜਸਵਿੰਦਰ ਸਿੰਘ' },
    { id: 'rep_pa_5', name: 'ਸੁਖਵਿੰਦਰ ਸਿੰਘ' },
    { id: 'rep_pa_6', name: 'ਅਮਨਦੀਪ ਸਿੰਘ' },
    { id: 'rep_pa_7', name: 'ਰਮਨਦੀਪ ਕੌਰ' },
    { id: 'rep_pa_8', name: 'ਕੁਲਦੀਪ ਸਿੰਘ' },
    { id: 'rep_pa_9', name: 'ਬਲਜੀਤ ਸਿੰਘ' },
    { id: 'rep_pa_10', name: 'ਨਵਜੋਤ ਸਿੰਘ' },
  ],
  gu: [
    { id: 'rep_gu_1', name: 'રાજેશ પટેલ' },
    { id: 'rep_gu_2', name: 'અમિત શાહ' },
    { id: 'rep_gu_3', name: 'જયેશ મહેતા' },
    { id: 'rep_gu_4', name: 'કિરણ દેસાઈ' },
    { id: 'rep_gu_5', name: 'નિલેશ જોશી' },
    { id: 'rep_gu_6', name: 'મનીષ પરમાર' },
    { id: 'rep_gu_7', name: 'દીપક પંડ્યા' },
    { id: 'rep_gu_8', name: 'સંદીપ ચૌહાણ' },
    { id: 'rep_gu_9', name: 'હર્ષદ ઠાકોર' },
    { id: 'rep_gu_10', name: 'વિપુલ સોલંકી' },
  ],
  en: [
    { id: 'rep_en_1', name: 'Rohan Naik' },
    { id: 'rep_en_2', name: 'Vikram Deshmukh' },
    { id: 'rep_en_3', name: 'Ananya Sharma' },
    { id: 'rep_en_4', name: 'Karan Singh' },
    { id: 'rep_en_5', name: 'Neha Kapoor' },
    { id: 'rep_en_6', name: 'Siddharth Rao' },
    { id: 'rep_en_7', name: 'Priya Fernandes' },
    { id: 'rep_en_8', name: 'Arjun Meitei' },
    { id: 'rep_en_9', name: 'Ritu Verma' },
    { id: 'rep_en_10', name: 'Nikhil Kamat' },
  ],
};

/**
 * Returns a culturally native local reporter persona for non-Telugu editions.
 * Returns null for 'te' so existing Telugu reporter selection remains 100% untouched.
 */
function getReporterForLanguage(language = 'te') {
  const code = String(language || 'te').toLowerCase().trim();
  const pool = EXPANSION_REPORTERS_BY_LANG[code];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Detects any of the 174 expansion-state districts (UP, PB, UK, HP, GJ, GA, MN)
 * from location string or article text, prioritizing stateCodeHint when provided.
 */
function detectExpansionDistrict(location, text, stateCodeHint = '') {
  const hint = resolveStateCode(stateCodeHint) || '';
  const prioritized = hint
    ? EXPANSION_DISTRICT_MAPPING.filter((item) => item.state === hint)
    : EXPANSION_DISTRICT_MAPPING;
  const fallbackPool = hint
    ? EXPANSION_DISTRICT_MAPPING.filter((item) => item.state !== hint)
    : [];

  const searchPools = fallbackPool.length > 0 ? [prioritized, fallbackPool] : [prioritized];

  const loc = String(location || '').toLowerCase().trim();
  if (loc && loc !== 'general' && loc !== 'none') {
    for (const pool of searchPools) {
      for (const item of pool) {
        if (
          item.keywords.some((k) => {
            const kl = String(k).toLowerCase();
            if (kl.length < 3) return false;
            return loc === kl || loc.includes(kl) || (loc.length >= 4 && kl.includes(loc));
          })
        ) {
          return item;
        }
      }
    }
  }

  const body = String(text || '').toLowerCase();
  if (body.length > 5) {
    for (const pool of searchPools) {
      for (const item of pool) {
        if (
          item.keywords.some((k) => {
            const kl = String(k).toLowerCase();
            if (kl.length < 4) return false;
            return body.includes(kl);
          })
        ) {
          return item;
        }
      }
    }
  }

  return null;
}

/**
 * Starter multi-state RSS source registry for the 7 expansion states.
 * Admins can also add/manage sources dynamically in Firestore `scraping_sources` with `stateCode` and `language`.
 */
const EXPANSION_STARTER_SOURCES = [
  { siteName: 'Amar Ujala UP', stateCode: 'UP', language: 'hi', targetCollection: 'news_hi', category: 'Politics' },
  { siteName: 'Dainik Bhaskar UP', stateCode: 'UP', language: 'hi', targetCollection: 'news_hi', category: 'General' },
  { siteName: 'Jagbani Punjab', stateCode: 'PB', language: 'pa', targetCollection: 'news_pa', category: 'General' },
  { siteName: 'Ajit Punjab', stateCode: 'PB', language: 'pa', targetCollection: 'news_pa', category: 'Politics' },
  { siteName: 'Amar Ujala Uttarakhand', stateCode: 'UK', language: 'hi', targetCollection: 'news_hi', category: 'General' },
  { siteName: 'O Heraldo Goa', stateCode: 'GA', language: 'en', targetCollection: 'news_en', category: 'General' },
  { siteName: 'Sangai Express Manipur', stateCode: 'MN', language: 'en', targetCollection: 'news_en', category: 'General' },
  { siteName: 'Divya Himachal', stateCode: 'HP', language: 'hi', targetCollection: 'news_hi', category: 'General' },
  { siteName: 'Divya Bhaskar Gujarat', stateCode: 'GJ', language: 'gu', targetCollection: 'news_gu', category: 'General' },
  { siteName: 'Gujarat Samachar', stateCode: 'GJ', language: 'gu', targetCollection: 'news_gu', category: 'Politics' },
];

module.exports = {
  EDITIONS_CONFIG,
  ALL_NEWS_COLLECTIONS,
  EXPANSION_STARTER_SOURCES,
  EXPANSION_DISTRICT_MAPPING,
  EXPANSION_REPORTERS_BY_LANG,
  resolveStateCode,
  validateLanguageForState,
  getLanguageMeta,
  isTargetLanguageScript,
  cleanGenericHeadline,
  sanitizeGenericText,
  resolveScraperTarget,
  parseScraperStatesFilter,
  doesSourceMatchStateFilter,
  buildLocalizedTextMap,
  getReporterForLanguage,
  detectExpansionDistrict,
};
