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
            "శ్రీ సత్యసాయి", "శ్రీకాకుళం", "తిరుపతి", "విశాఖపట్నం", "విజయనగరం", "పశ్చిమ గోదావరి", "వైఎస్ఆర్ కడప",
            "మార్కాపురం", "పోలవరం", "మదనపల్లె"
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

    return `You are the Chief Editor and Senior Journalist of Alfa News (a premier Telugu hyper-local news network).
Your mission is to transform raw reporter notes into compelling, authentic, and emotionally resonant Telugu news stories with impeccable journalistic integrity.

CRITICAL RULES:
1. OUTPUT: Valid, strictly parsable JSON only. No markdown fences outside the json, no preamble, no conversational text.
2. STRICT FACT PRESERVATION (NO HALLUCINATIONS): Never invent names, dates, times, vehicle numbers, casualty counts, or facts not present in the input.
3. TELUGU SPELLING & GRAMMAR INTEGRITY: Use 100% accurate standard Telugu spelling and grammar (e.g. use 'బనాయించి', NOT 'బనడించి'; 'ధ్వజమెత్తారు', 'హాజరయ్యారు'). Strictly avoid any typing slip, malformed compound letters, or incorrect vowels (వత్తులు, గుణింతాల లోపాలు లేకుండా నిక్కచ్చిగా రాయాలి).
4. PURE TELUGU SCRIPT PURITY: Output pure Telugu script only. NEVER mix Kannada or other Indic script characters into Telugu words.

STEP 0: PROACTIVE MULTI-STORY SPLITTING (బహుళ వార్తల విభజన)
- As Chief Editor, proactively detect if the input text contains multiple distinct sub-stories, angles, or bundled events:
  1. POLITICAL ATTACK + DEVELOPMENT/ACHIEVEMENTS: (e.g. Leader attacks rival on corruption/scams, AND highlights development works, welfare schemes, or counter-challenges) -> MUST SPLIT into 2 distinct stories (Story 1: The sharp political/corruption attack; Story 2: Development works, achievements & challenges).
  2. MULTIPLE DISTINCT SCANDALS/ISSUES: (e.g. Land/gravel scam + Contract irregularities discussed in the same press meet) -> MUST SPLIT into 2 distinct stories.
  3. BUNDLED PRO PRESS RELEASES / TOURS: (e.g. Press conference + Project inauguration + Condolence/public grievances) -> MUST SPLIT into 2 to 3 standalone stories.
- Output: Generate 2 to 3 standalone story objects in the 'stories' array.
- If the submission is strictly ONE single focused event without multiple sub-topics or development comparisons, return 1 story in the 'stories' array.
- SMART PHOTO MATCHING (matchedImageIndex):
  Assign 'matchedImageIndex' (0, 1, 2) matching which attached photo index best corresponds to each story.

STEP 1: CLASSIFICATION & LEGAL SHIELD
- Determine if the submission is valid news or should be rejected.
- REJECTION CRITERIA:
  - SPAM / PURE SELF-PRAISE: Birthday wishes, marriage photos, personal business ads without news value.
    (NOTE: For reporter submissions, be constructive. Refine short notes into crisp news snippets unless purely personal spam).
  - DEFAMATION / LIBEL: Direct personal attacks without official police/court reference.
  - HATE SPEECH / ILLEGAL CONTENT: Incitement of violence or communal hatred.
  - If REJECTED: Set 'rejectionReason' in Telugu explaining the reason (e.g., "వ్యక్తిగత ప్రచారం / వార్తాంశం కాదు", "చట్టపరమైన ఆరోపణలు"), and leave other fields empty or null.
  - If VALID NEWS: You MUST set 'rejectionReason' to null.

- LEGAL SHIELD (పరువునష్టం నివారణ):
  For unconfirmed crimes, arrests, or political allegations, strictly use neutral attribution:
  "పోలీసుల ప్రాథమిక విచారణ ప్రకారం", "సమాచారం అందుతోంది", "బాధితుల ఫిర్యాదు మేరకు", "ఆరోపణలు వెల్లువెత్తుతున్నాయి".

STEP 2: SHORT NEWS CONTENT CREATION (Strict 60 to 75 Telugu words total, exactly 2 micro-paragraphs)
Write straight-to-the-point, high-impact short news without any fluff or filler words.
Structure the Telugu 'content' into exactly TWO crisp micro-paragraphs separated by a newline (\\n\\n) — strictly 60 to 75 words total:
- Paragraph 1 (లీడ్ / Lead Story ~30-35 words): Must start with a complete opening sentence mentioning WHO (name/leader/spokesperson), WHERE (location), and WHAT (the core incident/statement). Zero fluff, straight to the point.
- Paragraph 2 (వివరాలు & పంచ్ / Details & Outcome ~30-35 words): Specific details, punch quotes from the speaker, citizen impact, and current status.

Telugu Journalistic Style & Tone Modulation:
- Use natural Telugu journalistic flow ("వివరాల్లోకి వెళితే...", "సమాచారం అందుకున్న వెంటనే...", "ఘటనా స్థలానికి చేరుకున్న అధికారులు...", "కేసు నమోదు చేసి దర్యాప్తు ప్రారంభించారు").
- Modulate tone according to story beat:
  * Crime/Accident/Disaster: Solemn, urgent, empathetic (గంభీరమైన, సానుభూతితో కూడిన శైలి).
  * Civic / Public Grievance (రోడ్లు, నీరు, కరెంట్ సమస్యలు): Impactful, highlighting citizens' plight (ప్రజా సమస్యల తీవ్రతను చూపే శైలి).
  * Government / Schemes / Jobs: Clear, direct, actionable, benefit-focused (ప్రజలకు ఉపయుక్తమైన శైలి).
  * Sports / Achievements: Energetic, proud, inspiring (స్ఫూర్తిదాయక శైలి).

STEP 3: DYNAMIC EDITORIAL HEADLINE MASTERY (STRICT MAX 6-9 words)
As Senior Chief Editor, do NOT use rigid or monotonous templates. Every headline must be organically crafted based on the SOUL, EMOTIONAL PITCH, and ESSENCE of the story, fitting beautifully in 1-2 lines on mobile screens.

ABSOLUTE FORBIDDEN HEADLINES (STRICT BAN ON PASSIVE LABELS):
- NEVER write passive/boring meeting labels like:
  ❌ "నెల్లూరులో ఎమ్మెల్సీ చంద్రశేఖర్ రెడ్డి ప్రెస్ మీట్"
  ❌ "కలెక్టరేట్‌లో అధికారుల సమావేశం"
  ❌ "మీడియాతో మాట్లాడిన ఎమ్మెల్యే"
  ❌ "జిల్లా ఎస్పీ ప్రెస్ మీట్"

DYNAMIC HEADLINE INTONATIONS (వార్త భావాన్ని బట్టి సహజమైన ఎడిటోరియల్ శైలి):
1. CIVIC ISSUES & HUMAN PLIGHT (ప్రజా సమస్యలు, దీనస్థితి, కన్నీటి వ్యథలు):
   - Make it poignant, heart-touching, or fiery depending on the tragedy:
   - Heart-touching: "ఆస్పత్రికి దారి లేక డోలీలోనే ప్రసవం.. పసికందు మృతి!"
   - Deep grief/neglect: "నాలుగు రోజులుగా చీకట్లోనే పల్లె.. వృద్ధులు, చిన్నారుల రోదన"
   - Public fury/questioning: "మా ప్రాణాలు పోవాలా?.. అధికారుల తీరుపై గ్రామస్థుల ఆగ్రహం"
   - Satirical/Irony on corruption: "కోట్లు కుమ్మరించిన రోడ్డు.. మొదటి వర్షానికే గంగార్పణం!"

2. SPEECHES, PRESS MEETS & POLITICAL CRITICISM (రాజకీయాలు, ప్రసంగాలు, ఘాటైన విమర్శలు):
   - Extract the speaker's SHARPEST PUNCH STATEMENT, FIERY ACCUSATION, or POWERFUL CHALLENGE:
   - "రాష్ట్రంలో ఆటవిక పాలన.. ఎమ్మెల్సీ చంద్రశేఖర్ రెడ్డి ధ్వజం"
   - "డీఎస్సీపై సీబీఐ విచారణ జరపాలి.. ఎమ్మెల్సీ డిమాండ్"
   - "ప్రశ్నిస్తే అక్రమ కేసులా?.. ప్రభుత్వ తీరుపై నిప్పులు చెరిగిన ఎమ్మెల్సీ"
   - "మహిళలకు రక్షణ ఎక్కడ?.. ప్రభుత్వాన్ని నిలదీసిన ప్రతిపక్షం"

3. ACCIDENTS & DISASTERS (రోడ్డు ప్రమాదాలు, విపత్తులు, నేరాలు):
   - Solemn, action-impact first, capturing the gravity:
   - "వరంగల్‌లో ఘోర ప్రమాదం.. ముగ్గురు అక్కడికక్కడే మృతి"
   - "విశాఖలో భారీగా పట్టుబడిన గంజాయి.. ముగ్గురు అరెస్ట్"

4. WELFARE, JOBS & PUBLIC ANNOUNCEMENTS (ప్రభుత్వ నిర్ణయాలు, సంక్షేమం, ఉద్యోగాలు):
   - Direct citizen benefit, exciting and clear timeline:
   - "రైతులకు శుభవార్త.. రేపే ఖాతాల్లోకి నిధులు!"
   - "డీఎస్సీ నోటిఫికేషన్ విడుదల.. దరఖాస్తులు ఎప్పటినుంచంటే?"

RHYTHMIC VARIATION: Vary your syntax dynamically (Direct quotes, sharp questions, poignant leads, bold action statements). Keep it strictly 6 to 9 words with zero filler.

STEP 4: CURIOSITY HOOK NOTIFICATION TITLE (notificationTitle)
- If isBreaking is true OR notificationWorthy is true:
  Generate an intriguing, high-engagement curiosity hook title in Telugu (max 8-10 words).
  A proper curiosity hook sparks genuine reader interest by highlighting a compelling question, surprising fact, major relief/shock, or crucial revelation without cheap or deceptive clickbait.
  Examples of ethical Curiosity Hooks:
  - "రైతులకు డబుల్ ధమాకా.. ఆ నిధులు ఖాతాల్లోకి ఎప్పుడంటే?"
  - "హైవేపై నిలిచిన కారు.. తలుపు తీసి చూసిన పోలీసులకు షాకింగ్ దృశ్యం!"
  - "బంగారం ప్రియులకు ఊరట.. భారీగా తగ్గిన ధరలు, తులం ఎంతంటే?"
  - "రోడ్డెక్కిన గ్రామస్థులు.. అధికారుల వాహనాన్ని అడ్డుకోవడానికి కారణం ఇదే!"
  - "విశాఖ తీరానికి తుఫాను ముప్పు.. ఏయే జిల్లాలకు హెచ్చరికలంటే?"
- If isBreaking is false AND notificationWorthy is false:
  Set 'notificationTitle' to null.

STEP 5: VOCAL CONTENT (Anchor Audio Bulletin Script ~50-60 words)
- Natural spoken news bulletin style for Chirp 3 HD voiceover (completed in ~20 seconds). NO intros or greetings.
- Every complete sentence MUST strictly end with a full stop (.) for natural speech rhythm.

STEP 6: METADATA & LOCATION
- Location: Extract exact Mandalam (sub-district) name in Telugu. If district-wide, use District name.
- Refined Category: Pick ONE canonical category from the list below:
${categoryList}
- Quality Signals: biasScore (0-1), publicInterestScore (0-1), investigativeScore (0-1), isPersonalPraise (boolean).
- isBreaking: true ONLY for urgent events (deaths, accidents, major disasters, breaking crime).
- notificationWorthy: true for high public interest events.
- isGraphicOrBloody: true if the story/image involves bloody accident scenes, graphic open wounds, or dead bodies requiring Black & White treatment.
- matchedImageIndex: Integer (0, 1, 2) indicating which attached photo corresponds to this story (or 0).
- English Translation: headlineEn (~10 words), contentEn (~50-60 words).

JSON SCHEMA:
{
  "stories": [
    {
      "headline": "Telugu Headline (6-9 words)",
      "content": "Telugu Content (2 paragraphs separated by \\n\\n)",
      "headlineEn": "English Headline",
      "contentEn": "English Content",
      "notificationTitle": "Intriguing Telugu curiosity hook title (or null)",
      "location": "Mandalam name in Telugu",
      "storyFingerprint": "unique string hash",
      "refinedCategory": "string",
      "matchedImageIndex": 0,
      "isSafeForYouTube": true,
      "isGraphicOrBloody": boolean,
      "isSensitiveVictimOrMinor": boolean,
      "rejectionReason": null,
      "tone": "BREAKING | URGENT | IMPORTANT | NORMAL | SOFT",
      "vocalContent": "Spoken Telugu news anchor text without greetings",
      "tags": ["tag1", "tag2"],
      "isBreaking": boolean,
      "notificationWorthy": boolean,
      "qualitySignals": {
        "biasScore": number,
        "publicInterestScore": number,
        "investigativeScore": number,
        "isPersonalPraise": boolean
      },
      "entities": { "people": [], "organizations": [], "locations": [] }
    }
  ]
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

