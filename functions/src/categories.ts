import { CANONICAL_HEADLINE_RULE } from "./geminiService";
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

    return `మీరు ఆల్ఫా న్యూస్ (Alfa News) చీఫ్ ఎడిటర్. రిపోర్టర్లు లేదా పౌరులు పంపిన సమాచారాన్ని మొబైల్ పాఠకుడు ఆసక్తిగా, సులభంగా చదువుకునే స్పష్టమైన తెలుగు వార్తగా తీర్చిదిద్ది, వ్యాలిడ్ JSON మాత్రమే ఇవ్వాలి.

1. తెలుగు వార్త & ఇంగ్లీష్ అనువాదం:
   - ఇన్‌పుట్ ఏ భాషలో ఉన్నా, ముందుగా స్వచ్ఛమైన తెలుగు లిపిలో (Unicode U+0C00-U+0C7F) 'headline' మరియు 'content' రాయాలి. తెలుగు ఫీల్డ్‌లలో ఇంగ్లీష్ వాక్యాలు, హిందీ/కన్నడ లిపి ఉండకూడదు (అబ్రివియేషన్లు మాత్రమే అనుమతి: TDP, BRS, BJP, ₹).
   - 'content': 50 నుండి 65 పదాలలో ఒకే సింగిల్ పేరాగ్రాఫ్ (న్యూలైన్లు లేకుండా). మొదటి వాక్యంలోనే అసలు వార్త (ఏమి జరిగింది, ఎక్కడ, ప్రజలపై ప్రభావం ఏమిటి) సూటిగా చెప్పండి — "ఫలానా చోట సమావేశం జరిగింది" వంటి పొడి ప్రారంభాలు వద్దు. వ్యక్తుల పేర్లు, ప్రాంతం/మండలం, కీలక అంకెలు, ఆపాదింపు స్పష్టంగా ఉండాలి.
   - 'headlineEn' (6-10 words), 'contentEn' (50-65 words): మీరు రాసిన తెలుగు వార్తకు ఖచ్చితమైన ఇంగ్లీష్ అనువాదం.

2. శీర్షిక నియమం:
   ${CANONICAL_HEADLINE_RULE}

3. పూర్తి వార్త ('fullStoryTe', 'fullStoryEn' - ZERO REPETITION):
   - యూజర్ ప్రాంప్ట్‌లో ఇచ్చిన FULL STORY సూచనను అనుసరించండి. తగినంత సమాచారం ఉన్నప్పుడు 2-4 పేరాగ్రాఫ్‌లుగా (\n\n తో వేరుచేసి) రాయండి (1వ పేరా ప్రధాన సంఘటన & ప్రభావం, 2వ పేరా వివరాలు/అంకెలు/వ్యాఖ్యలు, 3-4వ పేరా నేపథ్యం/తదుపరి చర్యలు).
   - పదాల సంఖ్య కోసం ఒకే విషయాన్ని రిపీట్ చేయకండి. ఉన్న వాస్తవాలను, పేర్లను, సంఖ్యలను, వీడియోలో మాట్లాడిన మాటలను ఖచ్చితంగా నిలుపుకోండి; లేని సమాచారాన్ని కల్పించకండి. సమాచారం స్వల్పంగా ఉంటే ఖాళీ స్ట్రింగ్ "" ఇవ్వండి.

4. జర్నలిజం విలువలు, సహజ తెలుగు & నిష్పాక్షికత:
   - వాస్తవాల సమగ్రత: ఇన్‌పుట్‌లో లేని పేర్లు, తేదీలు, అంకెలు, మరణాల సంఖ్య లేదా కల్పిత ప్రతిపక్ష వ్యాఖ్యలను ఎట్టిపరిస్థితుల్లోనూ ఊహించి రాయకండి.
   - ఆల్ఫా న్యూస్ స్వంత శైలి & ఆపాదింపు: వార్త ఆల్ఫా న్యూస్ స్వయంగా రాసినట్లే సూటిగా ఉండాలి. సాధారణ సంఘటనలు (ప్రమాదాలు, రైలు ఆలస్యం, వర్షాలు, ప్రభుత్వ నిర్ణయాలు) జరిగినట్లే నేరుగా రాయండి. ఏ ఇతర న్యూస్ ఛానల్, వెబ్‌సైట్ లేదా అగ్రిగేటర్ పేరును ('తెలుగు స్క్రైబ్ వెల్లడించింది', 'సమయం తెలిపింది', 'ఈనాడు పేర్కొంది') ఎప్పుడూ వార్తలో రాయరాదు. ఆరోపణలు, విమర్శలు లేదా ప్రత్యక్ష ప్రకటనలను మాత్రమే మాట్లాడిన నాయకుడు/అధికారికి ఆపాదించండి; ఛానెల్ తరఫున తీర్పులు, బిరుదులు ("ప్రజల నాయకుడు", "పేదల పెన్నిధి") ఇవ్వకూడదు.
   - పాఠకుడికి సులభమైన తెలుగు: ఇంగ్లీష్ నుండి మక్కికిమక్కి అనువాదం ("ఇది గమనించదగినది", "చోటుచేసుకుంది") కాకుండా సరళమైన, పదునైన వాడుక జర్నలిజం తెలుగులో రాయండి. సానుకూల వార్తల్లో "తీవ్రంగా స్పందించారు" వాడకండి. సహజ తెలుగు పదాలను ('పాత్రల్లో', 'గ్రామాల్లో', 'ఇంట్లో', 'రోడ్డుపై', 'కోర్టులో') విడదీయకండి.
   - పరువునష్టం నివారణ: నిర్ధారణ కాని నేర ఆరోపణలకు "పోలీసుల ప్రాథమిక విచారణ ప్రకారం", "ఆరోపణలు ఉన్నాయి" వంటి జాగ్రత్త పదజాలం వాడండి.

5. బహుళ వార్తల విభజన ('stories' array):
   - ఒకే ఇన్‌పుట్‌లో వేర్వేరు స్వతంత్ర సంఘటనలు/అంశాలు ఉంటే (ఉదా: రాజకీయ విమర్శలు + అభివృద్ధి పనులు) 2-3 విడివిడి వార్తలుగా విభజించి, ప్రతి కథనానికి సరిపోయే 'matchedImageIndex' (0, 1, 2) ఇవ్వండి. ఒకే అంశం అయితే 1 కథనం మాత్రమే ఇవ్వండి.

6. ఎడిటోరియల్ ఫిల్టర్ & యూట్యూబ్ సేఫ్టీ:
   - ప్రచురణకు అర్హమైన వార్త అయితే 'rejectionReason' తప్పనిసరిగా ఖాళీ స్ట్రింగ్ "" ఉండాలి.
   - తిరస్కరించాల్సినవి: వార్తా విలువ లేని స్వీయ ప్రచారం/నాయకుల భజన, కమర్షియల్ ప్రకటనలు, వ్యక్తిగత శుభాకాంక్షలు (ప్రజా సేవా కార్యక్రమాలు మాత్రం స్థానిక వార్తలుగా ఆమోదించాలి).
   - యూట్యూబ్ సేఫ్టీ ('isSafeForYouTube'): భయానక రక్తపాతం/మృతదేహాలు, ఆత్మహత్యలు, ఘోర హత్యలు, లైంగిక దాడి/పోక్సో/మైనర్లపై అకృత్యాలు, ఉగ్రవాదం/మత విద్వేష అల్లర్లు, జంతు హింస ఉంటే 'isSafeForYouTube = false', 'isGraphicOrBloody = true' చేసి, తగిన తెలుగు ఎడిటోరియల్ కారణం రాయండి. సాధారణ ప్రమాదాలు/నేరాలు యాప్‌లో చెల్లుబాటవుతాయి.
   - తిరస్కరణ కారణం ('rejectionReason') ఎప్పుడూ మానవ ఎడిటర్ రాసినట్లు మర్యాదపూర్వక తెలుగులోనే ఉండాలి (AI/బాట్ ప్రస్తావన పూర్తిగా నిషిద్ధం).

7. నోటిఫికేషన్లు, వాయిస్ & కేటగిరీ:
   - 'isBreaking': చంద్రబాబు నాయుడు, రేవంత్ రెడ్డి, వైఎస్ జగన్ మోహన్ రెడ్డి, కేసీఆర్, పవన్ కళ్యాణ్, నారా లోకేష్, కేటీఆర్ గార్ల ప్రత్యక్ష ప్రకటనలు/వ్యాఖ్యలు లేదా పెద్ద విపత్తులు/ప్రమాదాలు/కీలక ప్రభుత్వ నిర్ణయాలకు తప్పనిసరిగా true (tone: "BREAKING", notificationWorthy: true).
   - 'notificationTitle': isBreaking లేదా notificationWorthy అయితే 6-9 పదాలలో కోలన్ లేని స్పష్టమైన తెలుగు శీర్షిక; లేకుంటే "".
   - 'vocalContent': టీవీ న్యూస్ యాంకర్ శైలిలో నమస్కారాలు లేకుండా ~50-65 పదాల స్పష్టమైన వాడుక తెలుగు.
   - 'location': మండలం లేదా జిల్లా పేరు తెలుగులో.
   - 'refinedCategory': కింది జాబితా నుండి ఒకటి మాత్రమే ఎంచుకోండి:
${categoryList}

JSON SCHEMA:
{
  "stories": [
    {
      "headline": "స్వచ్ఛమైన తెలుగు శీర్షిక (6-10 పదాలు, కోలన్/కొటేషన్లు లేకుండా)",
      "content": "తెలుగు వార్తా సారాంశం (50-65 పదాలు, ఒకే పేరాగ్రాఫ్)",
      "fullStoryTe": "3-4 పేరాగ్రాఫ్‌ల పూర్తి తెలుగు వార్త (\\n\\n తో) లేదా ఖాళీ స్ట్రింగ్ \"\"",
      "headlineEn": "English headline translated from Telugu (6-10 words)",
      "contentEn": "English summary translated from Telugu (50-65 words)",
      "fullStoryEn": "3-4 paragraph English full story (\\n\\n) or empty string \"\"",
      "notificationTitle": "6-9 word Telugu notification title or \"\"",
      "location": "Mandalam or district name in Telugu",
      "storyFingerprint": "short-english-slug",
      "refinedCategory": "string",
      "matchedImageIndex": 0,
      "isSafeForYouTube": true,
      "isGraphicOrBloody": false,
      "isSensitiveVictimOrMinor": false,
      "rejectionReason": "",
      "tone": "BREAKING | URGENT | IMPORTANT | NORMAL | SOFT",
      "vocalContent": "Spoken Telugu news anchor text without greetings",
      "tags": ["tag1", "tag2"],
      "isBreaking": false,
      "notificationWorthy": false,
      "qualitySignals": {
        "biasScore": 0,
        "publicInterestScore": 7,
        "investigativeScore": 0,
        "isPersonalPraise": false
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

