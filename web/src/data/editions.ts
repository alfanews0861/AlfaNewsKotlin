/**
 * Alfa News — Unified 9-State × 5-Language Edition Registry
 *
 * Strict Rules:
 * 1. AP & TS are strictly separated (own state + National/Universal only).
 * 2. Strict State-Bound Languages: NO cross-state translation (e.g. Gujarat only gu/en; AP/TS only te/en).
 * 3. Collection Partitioning:
 *    - `news`    -> Telugu (AP, TS) [100% UNTOUCHED for 98,000+ legacy articles]
 *    - `news_hi` -> Hindi (UP, UK, HP)
 *    - `news_pa` -> Punjabi (PB)
 *    - `news_gu` -> Gujarati (GJ)
 *    - `news_en` -> English (GA, MN & non-Telugu English editions)
 * 4. Rounded Ek Type Display + Short Body Fonts with ZERO BOLD anywhere.
 */

import { AP_DISTRICTS, TS_DISTRICTS, MANDAL_DATA, Language } from '../types.ts';
import { EXPANSION_LOCATIONS, type ExpansionStateCode } from './expansionLocations.ts';

export type StateCode = 'AP' | 'TS' | 'UP' | 'UK' | 'HP' | 'PB' | 'GJ' | 'GA' | 'MN';
export type LanguageCode = 'te' | 'hi' | 'pa' | 'gu' | 'en';
export type NewsCollectionName = 'news' | 'news_hi' | 'news_pa' | 'news_gu' | 'news_en';
export const ALL_NEWS_COLLECTIONS: NewsCollectionName[] = ['news', 'news_hi', 'news_pa', 'news_gu', 'news_en'];

export interface EditionConfig {
  code: StateCode;
  name: string;
  nativeName: string;
  nameEn: string;
  nameNative: string;
  primaryLanguage: LanguageCode;
  supportedLanguages: LanguageCode[];
  collectionName: NewsCollectionName;
  subDistrictLabel: string;
  subDistrictNativeLabel: string;
  districts: string[];
  stateAliases: string[];
  /** Strong state-specific keywords used to block cross-state bleed (e.g., AP vs TS) */
  stateIdentifiers: string[];
  /** Approximate geographic bounds for initial GPS suggestion only */
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  capitalCity: string;
}

export const LANGUAGE_LABELS: Record<LanguageCode, { name: string; nativeName: string }> = {
  te: { name: 'Telugu', nativeName: 'తెలుగు' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी' },
  pa: { name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  gu: { name: 'Gujarati', nativeName: 'ગુજરાતી' },
  en: { name: 'English', nativeName: 'English' },
};

function getExpansionDistrictNames(code: ExpansionStateCode): string[] {
  return EXPANSION_LOCATIONS[code].map((d) => d.name);
}

export const EDITIONS: Record<StateCode, EditionConfig> = {
  AP: {
    code: 'AP',
    name: 'Andhra Pradesh',
    nativeName: 'ఆంధ్రప్రదేశ్',
    nameEn: 'Andhra Pradesh',
    nameNative: 'ఆంధ్రప్రదేశ్',
    primaryLanguage: 'te',
    supportedLanguages: ['te', 'en'],
    collectionName: 'news',
    subDistrictLabel: 'Mandal',
    subDistrictNativeLabel: 'మండలం',
    districts: AP_DISTRICTS,
    stateAliases: ['ap', 'andhra pradesh', 'andhrapradesh', 'andhra', 'ఆంధ్రప్రదేశ్', 'ఆంధ్ర', 'ఏపీ'],
    stateIdentifiers: [
      'ఆంధ్రప్రదేశ్', 'ఆంధ్ర', 'ఏపీ', 'అమరావతి', 'విజయవాడ', 'విశాఖ', 'వైజాగ్',
      'తిరుపతి', 'గుంటూరు', 'నెల్లూరు', 'కర్నూలు', 'కడప', 'కాకినాడ', 'రాజమండ్రి',
      'వైసీపీ', 'వైఎస్ఆర్సిపి', 'టిడిపి', 'జనసేన', 'కూటమి', 'చంద్రబాబు', 'పవన్ కళ్యాణ్', 'జగన్', 'లోకేష్',
      'andhra pradesh', 'amaravati', 'ysrcp', 'tdp', 'janasena', 'chandrababu',
    ],
    bounds: { minLat: 12.6, maxLat: 19.2, minLng: 76.7, maxLng: 84.8 },
    capitalCity: 'Amaravati',
  },
  TS: {
    code: 'TS',
    name: 'Telangana',
    nativeName: 'తెలంగాణ',
    nameEn: 'Telangana',
    nameNative: 'తెలంగాణ',
    primaryLanguage: 'te',
    supportedLanguages: ['te', 'en'],
    collectionName: 'news',
    subDistrictLabel: 'Mandal',
    subDistrictNativeLabel: 'మండలం',
    districts: TS_DISTRICTS,
    stateAliases: ['ts', 'tg', 'telangana', 'telangana state', 'తెలంగాణ', 'టీఎస్', 'టిజి'],
    stateIdentifiers: [
      'తెలంగాణ', 'హైదరాబాద్', 'సికింద్రాబాద్', 'వరంగల్', 'ఖమ్మం', 'కరీంనగర్', 'నిజామాబాద్', 'నల్గొండ',
      'రేవంత్', 'రేవంత్ రెడ్డి', 'బిఆర్ఎస్', 'టీఆర్ఎస్', 'కెసిఆర్', 'కేసీఆర్', 'కేటీఆర్', 'హరీష్ రావు', 'భట్టి విక్రమార్క',
      'telangana', 'hyderabad', 'secunderabad', 'revanth reddy', 'brs', 'kcr', 'ktr',
    ],
    bounds: { minLat: 15.8, maxLat: 19.9, minLng: 77.2, maxLng: 81.3 },
    capitalCity: 'Hyderabad',
  },
  UP: {
    code: 'UP',
    name: 'Uttar Pradesh',
    nativeName: 'उत्तर प्रदेश',
    nameEn: 'Uttar Pradesh',
    nameNative: 'उत्तर प्रदेश',
    primaryLanguage: 'hi',
    supportedLanguages: ['hi', 'en'],
    collectionName: 'news_hi',
    subDistrictLabel: 'Tehsil',
    subDistrictNativeLabel: 'तहसील',
    districts: getExpansionDistrictNames('UP'),
    stateAliases: ['up', 'uttar pradesh', 'uttarpradesh', 'उत्तर प्रदेश', 'यूपी'],
    stateIdentifiers: [
      'उत्तर प्रदेश', 'यूपी', 'लखनऊ', 'नोएडा', 'वाराणसी', 'प्रयागराज', 'अयोध्या', 'कानपुर', 'गोरखपुर', 'आगरा',
      'योगी आदित्यनाथ', 'अखिलेश यादव', 'सपा', 'बसपा', 'uttar pradesh', 'lucknow', 'yogi adityanath',
    ],
    bounds: { minLat: 23.8, maxLat: 30.4, minLng: 77.0, maxLng: 84.7 },
    capitalCity: 'Lucknow',
  },
  PB: {
    code: 'PB',
    name: 'Punjab',
    nativeName: 'ਪੰਜਾਬ',
    nameEn: 'Punjab',
    nameNative: 'ਪੰਜਾਬ',
    primaryLanguage: 'pa',
    supportedLanguages: ['pa', 'hi', 'en'],
    collectionName: 'news_pa',
    subDistrictLabel: 'Tehsil',
    subDistrictNativeLabel: 'ਤਹਿਸੀਲ',
    districts: getExpansionDistrictNames('PB'),
    stateAliases: ['pb', 'punjab', 'ਪੰਜਾਬ', 'पंजाब'],
    stateIdentifiers: [
      'ਪੰਜਾਬ', 'पंजाब', 'ਅੰਮ੍ਰਿਤਸਰ', 'ਲੁਧਿਆਣਾ', 'ਜਲੰਧਰ', 'ਪਟਿਆਲਾ', 'ਮੋਹਾਲੀ', 'ਭਗਵੰਤ ਮਾਨ',
      'punjab', 'amritsar', 'ludhiana', 'jalandhar', 'patiala', 'bhagwant mann',
    ],
    bounds: { minLat: 29.5, maxLat: 32.6, minLng: 73.8, maxLng: 76.9 },
    capitalCity: 'Chandigarh',
  },
  UK: {
    code: 'UK',
    name: 'Uttarakhand',
    nativeName: 'उत्तराखंड',
    nameEn: 'Uttarakhand',
    nameNative: 'उत्तराखंड',
    primaryLanguage: 'hi',
    supportedLanguages: ['hi', 'en'],
    collectionName: 'news_hi',
    subDistrictLabel: 'Tehsil',
    subDistrictNativeLabel: 'तहसील',
    districts: getExpansionDistrictNames('UK'),
    stateAliases: ['uk', 'ua', 'uttarakhand', 'उत्तराखंड', 'उत्तराखण्ड'],
    stateIdentifiers: [
      'उत्तराखंड', 'उत्तराखण्ड', 'देहरादून', 'हरिद्वार', 'नैनीताल', 'हल्द्वानी', 'केदारनाथ', 'बद्रीनाथ', 'पुष्कर सिंह धामी',
      'uttarakhand', 'dehradun', 'haridwar', 'nainital', 'pushkar singh dhami',
    ],
    bounds: { minLat: 28.7, maxLat: 31.5, minLng: 77.5, maxLng: 81.1 },
    capitalCity: 'Dehradun',
  },
  GA: {
    code: 'GA',
    name: 'Goa',
    nativeName: 'Goa',
    nameEn: 'Goa',
    nameNative: 'Goa',
    primaryLanguage: 'en',
    supportedLanguages: ['en', 'hi'],
    collectionName: 'news_en',
    subDistrictLabel: 'Taluka',
    subDistrictNativeLabel: 'Taluka',
    districts: getExpansionDistrictNames('GA'),
    stateAliases: ['ga', 'goa', 'गोवा'],
    stateIdentifiers: ['goa', 'panaji', 'panjim', 'margao', 'mapusa', 'pramod sawant', 'गोवा', 'पणजी'],
    bounds: { minLat: 14.8, maxLat: 15.8, minLng: 73.6, maxLng: 74.4 },
    capitalCity: 'Panaji',
  },
  MN: {
    code: 'MN',
    name: 'Manipur',
    nativeName: 'Manipur',
    nameEn: 'Manipur',
    nameNative: 'Manipur',
    primaryLanguage: 'en',
    supportedLanguages: ['en', 'hi'],
    collectionName: 'news_en',
    subDistrictLabel: 'Sub-Division',
    subDistrictNativeLabel: 'Sub-Division',
    districts: getExpansionDistrictNames('MN'),
    stateAliases: ['mn', 'manipur', 'मणिपुर'],
    stateIdentifiers: ['manipur', 'imphal', 'churachandpur', 'thoubal', 'bishnupur', 'ukhrul', 'मणिपुर', 'इंफाल'],
    bounds: { minLat: 23.8, maxLat: 25.7, minLng: 93.0, maxLng: 94.8 },
    capitalCity: 'Imphal',
  },
  HP: {
    code: 'HP',
    name: 'Himachal Pradesh',
    nativeName: 'हिमाचल प्रदेश',
    nameEn: 'Himachal Pradesh',
    nameNative: 'हिमाचल प्रदेश',
    primaryLanguage: 'hi',
    supportedLanguages: ['hi', 'en'],
    collectionName: 'news_hi',
    subDistrictLabel: 'Tehsil',
    subDistrictNativeLabel: 'तहसील',
    districts: getExpansionDistrictNames('HP'),
    stateAliases: ['hp', 'himachal pradesh', 'himachal', 'हिमाचल प्रदेश', 'हिमाचल'],
    stateIdentifiers: [
      'हिमाचल प्रदेश', 'हिमाचल', 'शिमला', 'धर्मशाला', 'मनाली', 'कुल्लू', 'कांगड़ा', 'मंडी', 'सुखविंदर सिंह सुक्खू',
      'himachal pradesh', 'shimla', 'dharamshala', 'manali', 'kullu', 'sukhvinder singh sukhu',
    ],
    bounds: { minLat: 30.3, maxLat: 33.3, minLng: 75.5, maxLng: 79.1 },
    capitalCity: 'Shimla',
  },
  GJ: {
    code: 'GJ',
    name: 'Gujarat',
    nativeName: 'ગુજરાત',
    nameEn: 'Gujarat',
    nameNative: 'ગુજરાત',
    primaryLanguage: 'gu',
    supportedLanguages: ['gu', 'en'],
    collectionName: 'news_gu',
    subDistrictLabel: 'Taluka',
    subDistrictNativeLabel: 'તાલુકો',
    districts: getExpansionDistrictNames('GJ'),
    stateAliases: ['gj', 'gujarat', 'ગુજરાત', 'गुजरात'],
    stateIdentifiers: [
      'ગુજરાત', 'અમદાવાદ', 'સુરત', 'વડોદરા', 'રાજકોટ', 'ગાંધીનગર', 'ભાવનગર', 'જામનગર', 'ભૂપેન્દ્ર પટેલ',
      'gujarat', 'ahmedabad', 'surat', 'vadodara', 'rajkot', 'gandhinagar', 'bhupendra patel', 'गुजरात',
    ],
    bounds: { minLat: 20.1, maxLat: 24.7, minLng: 68.1, maxLng: 74.5 },
    capitalCity: 'Gandhinagar',
  },
};

export const ALL_STATE_CODES: StateCode[] = ['AP', 'TS', 'UP', 'PB', 'UK', 'GA', 'MN', 'HP', 'GJ'];

export const ALL_EDITIONS_LIST: EditionConfig[] = ALL_STATE_CODES.map((c) => EDITIONS[c]);

// Build O(1) lookup maps for districts, aliases, and tehsils/mandals across ALL 9 states
const DISTRICT_TO_STATE = new Map<string, StateCode>();
const EXPANSION_DISTRICT_ALIASES: Record<string, string[]> = {};
const EXPANSION_MANDAL_MAP: Record<string, string[]> = {};
const EXPANSION_CONSTITUENCY_BY_MANDAL = new Map<string, string>();
const EXPANSION_DISTRICT_NATIVE: Record<string, string> = {};

for (const d of AP_DISTRICTS) {
  DISTRICT_TO_STATE.set(d.trim().toLowerCase(), 'AP');
}
for (const d of TS_DISTRICTS) {
  DISTRICT_TO_STATE.set(d.trim().toLowerCase(), 'TS');
}

for (const stateCode of Object.keys(EXPANSION_LOCATIONS) as ExpansionStateCode[]) {
  for (const entry of EXPANSION_LOCATIONS[stateCode]) {
    const keyLow = entry.name.trim().toLowerCase();
    DISTRICT_TO_STATE.set(keyLow, stateCode);
    DISTRICT_TO_STATE.set(entry.nativeName.trim().toLowerCase(), stateCode);
    EXPANSION_DISTRICT_NATIVE[entry.name] = entry.nativeName;
    const allAliases = Array.from(new Set([entry.name, entry.nativeName, ...entry.aliases]));
    EXPANSION_DISTRICT_ALIASES[entry.name] = allAliases;
    for (const alias of allAliases) {
      DISTRICT_TO_STATE.set(alias.trim().toLowerCase(), stateCode);
    }

    const tehsils: string[] = [];
    for (const [constName, subList] of Object.entries(entry.constituencies)) {
      for (const sub of subList) {
        tehsils.push(sub);
        EXPANSION_CONSTITUENCY_BY_MANDAL.set(`${keyLow}::${sub.trim().toLowerCase()}`, constName);
      }
    }
    EXPANSION_MANDAL_MAP[entry.name] = Array.from(new Set(tehsils));
  }
}

export function getExpansionDistrictAliases(): Record<string, string[]> {
  return EXPANSION_DISTRICT_ALIASES;
}

export function getDistrictDisplayName(district: string, language?: LanguageCode | Language): string {
  if (!district) return '';
  if (language === 'en') return district;
  return EXPANSION_DISTRICT_NATIVE[district] || district;
}

const STATE_ALIAS_TO_CODE = new Map<string, StateCode>();
for (const code of ALL_STATE_CODES) {
  const ed = EDITIONS[code];
  STATE_ALIAS_TO_CODE.set(code.toLowerCase(), code);
  STATE_ALIAS_TO_CODE.set(ed.name.toLowerCase(), code);
  STATE_ALIAS_TO_CODE.set(ed.nativeName.toLowerCase(), code);
  for (const alias of ed.stateAliases) {
    STATE_ALIAS_TO_CODE.set(alias.toLowerCase(), code);
  }
}

const RESOLVE_STATE_CACHE = new Map<string, StateCode | null>();

function resolveSingleStateToken(raw?: string | null): StateCode | null {
  if (!raw || !raw.trim()) return null;
  const clean = raw.trim().toLowerCase();

  const cached = RESOLVE_STATE_CACHE.get(clean);
  if (cached !== undefined) return cached;

  // O(1) Direct state code, state alias, or exact district match
  const direct = STATE_ALIAS_TO_CODE.get(clean) || DISTRICT_TO_STATE.get(clean);
  if (direct) {
    if (RESOLVE_STATE_CACHE.size < 2000) RESOLVE_STATE_CACHE.set(clean, direct);
    return direct;
  }

  // Substring fallback on aliases
  let matched: StateCode | null = null;
  for (const [alias, code] of DISTRICT_TO_STATE.entries()) {
    if (alias.length >= 4 && (clean.includes(alias) || alias.includes(clean))) {
      matched = code;
      break;
    }
  }

  if (RESOLVE_STATE_CACHE.size < 2000) RESOLVE_STATE_CACHE.set(clean, matched);
  return matched;
}

export function resolveStateCode(raw?: string | null, rawDistrict?: string | null): StateCode | null {
  return resolveSingleStateToken(raw) || resolveSingleStateToken(rawDistrict);
}

export function getEdition(stateCode?: StateCode | string | null): EditionConfig {
  const resolved = resolveStateCode(stateCode) || 'TS';
  return EDITIONS[resolved];
}

/**
 * STRICT STATE-BOUND LANGUAGE VALIDATION:
 * Ensures a user in Gujarat can ONLY choose Gujarati or English (never Telugu for Gujarat news).
 * A Telugu user anywhere can choose Telangana/AP -> Telugu/English.
 */
export function validateLanguageForState(stateCode: StateCode, requestedLang?: string | null): LanguageCode {
  const ed = EDITIONS[stateCode] || EDITIONS.TS;
  const normalized = (requestedLang || '').trim().toLowerCase() as LanguageCode;
  if (ed.supportedLanguages.includes(normalized)) {
    return normalized;
  }
  return ed.primaryLanguage;
}

/**
 * Resolves the exact Firestore news collection for a given state + language.
 * - AP & TS ALWAYS read from `news` (both Telugu & English fields live on `news` docs — 100% untouched legacy!).
 * - UP, UK, HP -> `news_hi` (or `news_en` when English selected)
 * - PB -> `news_pa` (or `news_hi` / `news_en` if switched within Punjab's supported languages)
 * - GJ -> `news_gu` (or `news_en` when English selected)
 * - GA, MN -> `news_en` (or `news_hi` if Hindi selected)
 */
export function getCollectionForEdition(stateCode: StateCode, language?: LanguageCode | Language): NewsCollectionName {
  if (stateCode === 'AP' || stateCode === 'TS') {
    return 'news';
  }
  const effectiveLang = validateLanguageForState(stateCode, language);
  switch (effectiveLang) {
    case 'hi':
      return 'news_hi';
    case 'pa':
      return 'news_pa';
    case 'gu':
      return 'news_gu';
    case 'en':
      return 'news_en';
    case 'te':
    default:
      return 'news';
  }
}

export function getMandalsForDistrict(district?: string | null): string[] {
  if (!district) return [];
  if (MANDAL_DATA[district]) return MANDAL_DATA[district];
  if (EXPANSION_MANDAL_MAP[district]) return EXPANSION_MANDAL_MAP[district];
  const low = district.trim().toLowerCase();
  const matchedKey = Object.keys(EXPANSION_MANDAL_MAP).find((k) => k.toLowerCase() === low);
  return matchedKey ? EXPANSION_MANDAL_MAP[matchedKey] : [];
}

export function getConstituencyForSubDistrict(district?: string | null, mandal?: string | null): string | null {
  if (!district || !mandal) return null;
  const distLow = district.trim().toLowerCase();
  const mandalLow = mandal.trim().toLowerCase();
  const exact = EXPANSION_CONSTITUENCY_BY_MANDAL.get(`${distLow}::${mandalLow}`);
  if (exact) return exact;
  const prefix = `${distLow}::`;
  for (const [k, constName] of EXPANSION_CONSTITUENCY_BY_MANDAL.entries()) {
    if (!k.startsWith(prefix)) continue;
    const sub = k.slice(prefix.length);
    if (sub.includes(mandalLow) || mandalLow.includes(sub)) {
      return constName;
    }
  }
  return null;
}

export function getSiblingMandalsInConstituency(district?: string | null, mandal?: string | null): string[] {
  if (!district || !mandal) return [];
  const stateCode = resolveStateCode(district);
  if (!stateCode || stateCode === 'AP' || stateCode === 'TS') return [];
  const entries = EXPANSION_LOCATIONS[stateCode as ExpansionStateCode] || [];
  const distEntry = entries.find(
    (e) =>
      e.name.toLowerCase() === district.trim().toLowerCase() ||
      e.nativeName.toLowerCase() === district.trim().toLowerCase()
  );
  if (!distEntry) return [];
  const targetConst = getConstituencyForSubDistrict(distEntry.name, mandal);
  if (!targetConst) return [];
  return distEntry.constituencies[targetConst] || [];
}

export interface LocalizedTextMap {
  telugu?: string;
  english?: string;
  local?: string;
  hi?: string;
  pa?: string;
  gu?: string;
  te?: string;
  en?: string;
}

/**
 * Backward-compatible localized text resolver across all 5 languages.
 * Safely reads legacy `{ telugu, english }` docs AND new `{ local, hi, pa, gu, english }` docs.
 */
export function getLocalizedText(
  field: LocalizedTextMap | string | undefined | null,
  language: LanguageCode | Language = 'te'
): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  const lang = String(language || 'te').toLowerCase();
  if (lang === 'te') {
    return field.telugu || field.te || field.local || field.english || field.en || '';
  }
  if (lang === 'en') {
    return field.english || field.en || field.local || field.telugu || '';
  }
  if (lang === 'hi') {
    return field.hi || field.local || field.english || field.telugu || '';
  }
  if (lang === 'pa') {
    return field.pa || field.local || field.hi || field.english || field.telugu || '';
  }
  if (lang === 'gu') {
    return field.gu || field.local || field.english || field.telugu || '';
  }
  return field.local || field.telugu || field.english || '';
}

/**
 * Script-specific rounded Ek Type heading font classes (ZERO BOLD).
 * Matches Ramabhadra aesthetic across all 5 scripts.
 */
export function getHeadlineFontClass(language: LanguageCode | Language = 'te'): string {
  switch (String(language || 'te').toLowerCase()) {
    case 'hi':
      return 'font-headline-hi';
    case 'pa':
      return 'font-headline-pa';
    case 'gu':
      return 'font-headline-gu';
    case 'en':
      return 'font-headline-en';
    case 'te':
    default:
      return 'font-ramabhadra';
  }
}

/**
 * Script-specific compact rounded body font classes (ZERO BOLD).
 * Matches Mallanna aesthetic across all 5 scripts.
 */
export function getBodyFontClass(language: LanguageCode | Language = 'te'): string {
  switch (String(language || 'te').toLowerCase()) {
    case 'hi':
      return 'font-body-hi';
    case 'pa':
      return 'font-body-pa';
    case 'gu':
      return 'font-body-gu';
    case 'en':
      return 'font-body-en';
    case 'te':
    default:
      return 'font-mallanna';
  }
}

/**
 * Approximate GPS bounding-box suggestion (used ONLY as initial suggestion during onboarding).
 * Users anywhere can override manually to their home state.
 */
export function suggestStateFromCoords(lat: number, lng: number): StateCode | null {
  // Check smaller/specific states first to avoid overlap with neighboring bounding boxes
  const ordered: StateCode[] = ['GA', 'MN', 'UK', 'HP', 'PB', 'GJ', 'TS', 'AP', 'UP'];
  for (const code of ordered) {
    const { minLat, maxLat, minLng, maxLng } = EDITIONS[code].bounds;
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      return code;
    }
  }
  return null;
}

export function getStateFirestoreAliases(stateCode: StateCode): string[] {
  const ed = EDITIONS[stateCode];
  if (!ed) return [];
  const core = [ed.code, ed.name, ed.nativeName];
  if (stateCode === 'TS') core.push('TG');
  if (stateCode === 'AP') core.push('Andhra');
  return Array.from(new Set(core)).slice(0, 10);
}

export function getStoredStateCode(): StateCode {
  try {
    const savedState = localStorage.getItem('user_selected_state');
    const resolvedSaved = resolveStateCode(savedState);
    if (resolvedSaved) return resolvedSaved;

    const savedDistrict = localStorage.getItem('user_local_district');
    const resolvedDist = resolveStateCode(savedDistrict);
    if (resolvedDist) return resolvedDist;
  } catch {}
  return 'TS';
}
