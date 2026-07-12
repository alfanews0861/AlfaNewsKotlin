/**
 * Canonical Categories Configuration
 * Single source of truth for all news categories
 * Used by: Backend AI, Mobile Filters, Web App
 */

export const CANONICAL_CATEGORIES = {
    POLITICS: {
        telugu: "రాజకీయం",
        english: "Politics",
        aliases: ["రాజకీయ సమాచారం", "పలిటిక్‌", "రాజకీయ", "ఎన్నికలు", "elections", "political", "government", "ప్రభుత్వం", "అసెంబ్లీ", "లోక సభ", "పార్లమెంట్", "राजनीति"]
    },
    CRIME: {
        telugu: "క్రైమ్",
        english: "Crime",
        aliases: ["అపరాధం", "న్యాయ సమాచారం", "crime", "court", "కోర్టు", "న్యాయ", "చట్టం", "పోలీస్", "police", "murder", "theft", "accident", "ప్రమాదం"]
    },
    ENTERTAINMENT: {
        telugu: "వినోదం",
        english: "Entertainment",
        aliases: ["సినిమా", "movie", "cinema", "films", "tv", "OTT", "ఓటిటి", "actor", "తారకం", "సంగీత", "music", "డ్యాన్స్", "comedy", "సీరీస్", "సిరీజ్"]
    },
    SPORTS: {
        telugu: "క్రీడలు",
        english: "Sports",
        aliases: ["క్రీడ వార్త", "sports", "cricket", "football", "tennis", "బ్యాడ్‌మింటన్", "కబడ్డి", "hockey", "బాస్‌కెట్‌బాల్", "IPL", "ఐపిఎల్", "ఊటీక్రిక్", "cricket news"]
    },
    BUSINESS: {
        telugu: "వ్యాపారం",
        english: "Business",
        aliases: ["ఆర్థికత", "వ్యాపార సమాచారం", "business", "economy", "stock", "స్టాక్‌", "bull market", "బంగారం", "gold", "ధరలు", "prices", "డॉलర్", "rupee"]
    },
    TECHNOLOGY: {
        telugu: "టెక్నాలజీ",
        english: "Technology",
        aliases: ["సాఫ్ట్‌వేర్", "AI", "కృత్రిమ", "tech", "artificial intelligence", "machine learning", "గూగుల్", "ఫేస్‌బుక్", "గ్యాడ్జెట్", "mobile", "ఫోన్", "laptop"]
    },
    HEALTH: {
        telugu: "ఆరోగ్యం",
        english: "Health",
        aliases: ["వైద్య సమాచారం", "health", "medical", "hospital", "చికిత్స", "డాక్టర్", "నర్సు", "కరోనా", "COVID", "దవా", "medicine", "జ్వరం"]
    },
    EDUCATION: {
        telugu: "విద్య",
        english: "Education",
        aliases: ["ఉద్యోగాలు", "education", "school", "college", "university", "పరీక్ష", "exam", "examination", "NEET", "JEE", "SSC", "ఉద్యోగ దరఖాస్తు", "jobs", "నోటిఫికేషన్"]
    },
    SPIRITUAL: {
        telugu: "భక్తి",
        english: "Spiritual",
        aliases: ["ధర్ములు", "ఆధ్యాత్మిక", "spiritual", "religion", "temple", "దేవాలయం", "పూజ", "మందిరం", "చర్చ్", "పవిత్ర", "భగవాన్", "దేవుడు", "రాశి ఫలాలు", "astrology", "జ్యోతిష్"]
    },
    AGRICULTURE: {
        telugu: "వ్యవసాయం",
        english: "Agriculture",
        aliases: ["రైతు సమాచారం", "agriculture", "farm", "farmer", "పంట", "నేల", "సేద", "నీటిపానం", "వర్షం", "rain", "harvest", "урожай"]
    },
    NATIONAL: {
        telugu: "జాతీయం",
        english: "National",
        aliases: ["జాతీయ సమాచారం", "భారతదేశం", "national", "india", "indian", "దేశీయ", "కేంద్ర", "centre", "センター"]
    },
    INTERNATIONAL: {
        telugu: "ప్రపంచం",
        english: "International",
        aliases: ["ప్రపంచ సమాచారం", "అంతర్జాతీయ", "international", "world", "usa", "uk", "china", "ఛైనా", "అమెరికా", "యూరోప్", "global"]
    },
    LIFESTYLE: {
        telugu: "జీవనశైలి",
        english: "Lifestyle",
        aliases: ["ఫ్యాషన్", "fashion", "ఆహారం", "food", "recipe", "ఫిట్‌నెస్", "fitness", "healthy", "సౌందర్యం", "beauty", "makeup", "clothing"]
    },
    // ✅ ADDED DISTRICTS TO PREVENT STRIPPING IN NORMALIZATION
    DISTRICTS: {
        telugu: "జిల్లా వార్త",
        english: "District",
        aliases: [
            "ఆదిలాబాద్", "భద్రాద్రి కొత్తగూడెం", "హన్మకొండ", "హైదరాబాద్", "జగిత్యాల", "జనగాం", "జయశంకర్ భూపాలపల్లి",
            "జోగులాంబ గద్వాల", "కామారెడ్డి", "కరీంనగర్", "ఖమ్మం", "కుమ్రం భీమ్ ఆసిఫాబాద్", "మహబూబాబాద్", "మహబూబ్ నగర్",
            "మంచిర్యాల", "మెదక్", "మేడ్చల్ మల్కాజిగిరి", "ములుగు", "నాగర్ కర్నూల్", "నల్గొండ", "నారాయణపేట", "నిర్మల్",
            "నిజామాబాద్", "పెద్దపల్లి", "రాజన్న సిరిసిల్ల", "రంగారెడ్డి", "సంగారెడ్డి", "సిద్దిపేట", "సూర్యాపేట",
            "వికారాబాద్", "వనపర్తి", "వరంగల్", "యాదాద్రి భువనగిరి", "అల్లూరి సీతారామరాజు", "అనకాపల్లి", "అనంతపురం",
            "అన్నమయ్య", "బాపట్ల", "చిత్తూరు", "కోనసీమ", "తూర్పు గోదావరి", "ఏలూరు", "గుంటూరు", "కాకినాడ", "కృష్ణా",
            "కర్నూలు", "నంద్యాల", "ఎన్టీఆర్", "పల్నాడు", "పార్వతీపురం మన్యం", "ప్రకాశం", "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు",
            "శ్రీ సత్యసాయి", "శ్రీకాకుళం", "తిరుపతి", "విశాఖపట్నం", "విజయనగరం", "పశ్చిమ గోదావరి", "వైఎస్ఆర్ కడప"
        ]
    }
};

export const CATEGORY_LIST = Object.keys(CANONICAL_CATEGORIES).map(key => ({
    key,
    telugu: CANONICAL_CATEGORIES[key as keyof typeof CANONICAL_CATEGORIES].telugu,
    english: CANONICAL_CATEGORIES[key as keyof typeof CANONICAL_CATEGORIES].english
}));

/**
 * Normalize a category string to canonical form
 * Handles typos, aliases, and variations
 */
export function normalizeCategory(input: string): string {
    if (!input) return "OTHER";

    const cleaned = input.trim().toLowerCase();

    for (const [key, config] of Object.entries(CANONICAL_CATEGORIES)) {
        const canConfig = config as any;

        // Check exact match first
        if (cleaned === canConfig.telugu.toLowerCase() || cleaned === canConfig.english.toLowerCase()) {
            return canConfig.telugu;
        }

        // Check aliases
        if (canConfig.aliases.some((alias: string) => cleaned === alias.toLowerCase())) {
            // IF IT'S A DISTRICT, RETURN THE EXACT ALIAS (THE DISTRICT NAME) INSTEAD OF "District"
            if (key === "DISTRICTS") return input.trim();
            return canConfig.telugu;
        }

        // Check if input contains any alias (partial match)
        if (canConfig.aliases.some((alias: string) => cleaned.includes(alias.toLowerCase()) || alias.toLowerCase().includes(cleaned))) {
            if (key === "DISTRICTS") return input.trim();
            return canConfig.telugu;
        }
    }

    return "OTHER";
}

/**
 * Normalize an array of categories
 */
export function normalizeCategories(categories: string[]): string[] {
    return Array.from(new Set(
        categories
            .map(cat => normalizeCategory(cat))
            .filter(cat => cat && cat !== "OTHER")
    ));
}

/**
 * Get system instruction for Gemini with category list
 */
export function getCategorySystemInstruction(): string {
    const categoryList = CATEGORY_LIST
        .map(c => `- ${c.telugu} (${c.english})`)
        .join('\n');

    return `You are a Senior News Editor and Data Architect.
CRITICAL: You must output valid, parsable JSON only. No preamble, no explanation, no conversational text.

STEP 1: CLASSIFICATION & LEGAL SAFETY
Determine if the input is valid NEWS or should be REJECTED.
REJECTION CRITERIA:
- PERSONAL/SPAM: Birthdays, marriages, self-praise, simple greetings (unrelated to festivals), or content lacking public value.
  NOTE: If the input has 'isReporter: true', be more lenient. Act as an EDITOR: refine even short notes or greetings into professional news snippets unless they are pure spam.
- LIBEL/DEFAMATION: Direct accusations of crime or immoral behavior against individuals without referencing official sources (police, court).
- HATE SPEECH: Content inciting violence, discrimination, or hatred based on religion, caste, gender, or community.
- ILLEGAL CONTENT: Promotion of illegal acts or extremely graphic violence.
- If REJECTED: Set 'rejectionReason' in Telugu explaining the specific reason (e.g., "వ్యక్తిగత ప్రశంసలు", "చట్టపరమైన చిక్కులు ఉండవచ్చు"), and leave other fields empty or null.
- If VALID NEWS: You MUST set 'rejectionReason' to null. Do not use "null" as a string, "N/A", or "None".

STEP 2: ENHANCEMENT (If VALID NEWS)
- Location: Extract the exact Mandalam (sub-district) name in Telugu. This is CRITICAL. If the news is about a village, identify its parent Mandalam. If it's district-wide, use the District name.
- Content: Detailed paragraph in Telugu (500-600 characters, ~65 words) AND a paragraph in English (~70 words).
  STRICT PERSONA: You are a Senior Reporter. Capture the emotional essence (bhaavam) and include ALL names/locations.
  LEGAL COMPLIANCE: Use objective, neutral language. For accusations, use terms like "reportedly" (సమాచారం అందుతోంది), "allegedly" (ఆరోపణలు వస్తున్నాయి), or "according to police" (పోలీసుల సమాచారం ప్రకారం). Avoid definitive judgments of guilt.
- Headline: Strong punch style (balamgaa) single sentence in Telugu (max 10 words) AND in English (~12 words).
- Vocal Content: A concise news anchor script in Telugu (approx 70 words). Sound natural and professional. Use [[STRESS]]term[[/STRESS]] for emphasis.
- Tone: SERIOUS, URGENT, NORMAL, INQUISITIVE, or SHOCKING.
- Category: Pick ONE from this list:
${categoryList}
- OTHER (Last resort only)

JSON SCHEMA (STRICTLY FLAT):
{
  "headline": "Telugu Headline",
  "content": "Telugu Content",
  "headlineEn": "English Headline",
  "contentEn": "English Content",
  "location": "string",
  "storyFingerprint": "string",
  "refinedCategory": "string",
  "isSafeForYouTube": boolean,
  "rejectionReason": "string (null if news)",
  "tone": "string",
  "vocalContent": "string",
  "tags": ["string"],
  "qualitySignals": {
    "biasScore": number,
    "publicInterestScore": number,
    "investigativeScore": number,
    "isPersonalPraise": boolean
  },
  "entities": { "people": [], "organizations": [], "locations": [] }
}

STEP 3: METADATA
- storyFingerprint: Unique hash for this event.
- qualitySignals: Evaluate the news quality:
    - biasScore: 0 to 1 (0=Neutral, 1=Highly Biased/One-sided).
    - publicInterestScore: 0 to 1 (Does this impact many people? e.g., weather, policy, local problems).
    - investigativeScore: 0 to 1 (Is this a deep report or crime investigation? 1=High value investigative news).
    - isPersonalPraise: true if the content is mainly praising an individual (birthday, greeting, political flattery).
- entities: Extract people, organizations, locations.
- tags: Relevant keywords.
- isSafeForYouTube: Boolean.

JSON SCHEMA:
{
  "headline": "string",
  "content": "string",
  "headlineEn": "string",
  "contentEn": "string",
  "location": "string",
  "storyFingerprint": "string",
  "refinedCategory": "string",
  "isSafeForYouTube": boolean,
  "rejectionReason": "string (null if news)",
  "tone": "string",
  "vocalContent": "string",
  "tags": ["string"],
  "entities": { "people": [], "organizations": [], "locations": [] }
}`;
}

/**
 * Global categories that should always appear in home feed (not domain-specific)
 */
export const GLOBAL_CATEGORY_KEYWORDS = [
    "సినిమా", "cinema", "movie", "films", "tv", "వినోదం", "entertainment", "OTT", "ఓటిటి",
    "స్పోర్ట్స్", "sports", "cricket", "football", "tennis", "క్రీడలు",
    "జాతీయం", "national", "అంతర్జాతీయం", "international", "world", "ప్రపంచం", "ఢిల్లీ", "delhi",
    "రాజకీయం", "politics", "elections", "government", "ప్రభుత్వం", "అసెంబ్లీ", "పార్లమెంట్",
    "క్రైమ్", "crime", "court", "కోర్టు", "న్యాయ", "చట్టం", "పోలీస్", "police",
    "వ్యాపారం", "business", "economy", "gold", "బంగారం", "ధరలు",
    "టెక్నాలజీ", "technology", "tech", "AI", "గ్యాడ్జెట్స్",
    "ఆరోగ్యం", "health", "medical", "hospital", "చికిత్స", "డాక్టర్",
    "విద్య", "education", "school", "college", "ఉద్యోగాలు", "jobs", "నోటిఫికేషన్",
    "భక్తి", "spiritual", "religion", "temple", "దేవాలయం", "రాశి ఫలాలు",
    "వ్యవసాయం", "agriculture", "రైతు", "farm",
    "State", "Andhra Pradesh", "Telangana", "AP", "TS", "ఆంధ్రప్రదేశ్", "తెలంగాణ", "india",
    "రాష్ట్ర", "రాష్ట్ర వార్తలు", "ముఖ్యాంశాలు", "బ్రేకింగ్", "Breaking", "వైరల్", "Viral", "తాజా వార్తలు"
];

export default CANONICAL_CATEGORIES;

