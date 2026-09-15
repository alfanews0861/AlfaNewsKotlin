"use strict";
/**
 * Canonical Categories Configuration
 * Single source of truth for all news categories
 * Used by: Backend AI, Mobile Filters, Web App
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GLOBAL_CATEGORY_KEYWORDS = exports.CATEGORY_LIST = exports.CANONICAL_CATEGORIES = void 0;
exports.normalizeCategory = normalizeCategory;
exports.normalizeCategories = normalizeCategories;
exports.getCategorySystemInstruction = getCategorySystemInstruction;
exports.CANONICAL_CATEGORIES = {
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
exports.CATEGORY_LIST = Object.keys(exports.CANONICAL_CATEGORIES).map(key => ({
    key,
    telugu: exports.CANONICAL_CATEGORIES[key].telugu,
    english: exports.CANONICAL_CATEGORIES[key].english
}));
/**
 * Normalize a category string to canonical form
 * Handles typos, aliases, and variations
 */
function normalizeCategory(input) {
    if (!input)
        return "OTHER";
    const cleaned = input.trim().toLowerCase();
    for (const [key, config] of Object.entries(exports.CANONICAL_CATEGORIES)) {
        const canConfig = config;
        // Check exact match first
        if (cleaned === canConfig.telugu.toLowerCase() || cleaned === canConfig.english.toLowerCase()) {
            return canConfig.telugu;
        }
        // Check aliases
        if (canConfig.aliases.some((alias) => cleaned === alias.toLowerCase())) {
            // IF IT'S A DISTRICT, RETURN THE EXACT ALIAS (THE DISTRICT NAME) INSTEAD OF "District"
            if (key === "DISTRICTS")
                return input.trim();
            return canConfig.telugu;
        }
        // Check if input contains any alias (partial match)
        if (canConfig.aliases.some((alias) => cleaned.includes(alias.toLowerCase()) || alias.toLowerCase().includes(cleaned))) {
            if (key === "DISTRICTS")
                return input.trim();
            return canConfig.telugu;
        }
    }
    return "OTHER";
}
/**
 * Normalize an array of categories
 */
function normalizeCategories(categories) {
    return Array.from(new Set(categories
        .map(cat => normalizeCategory(cat))
        .filter(cat => cat && cat !== "OTHER")));
}
/**
 * Get system instruction for Gemini with category list
 */
function getCategorySystemInstruction() {
    const categoryList = exports.CATEGORY_LIST
        .map(c => `- ${c.telugu} (${c.english})`)
        .join('\n');
    return `మీరు ఆల్ఫా న్యూస్ (Alfa News - తెలుగు ప్రముఖ హైపర్-లోకల్ న్యూస్ నెట్‌వర్క్) కు చీఫ్ ఎడిటర్ మరియు సీనియర్ జర్నలిస్ట్.
రిపోర్టర్లు పంపే ముడి సమాచారాన్ని (Raw reporter notes) ప్రజలను ఆకట్టుకునేలా, జర్నలిస్టిక్ విలువలతో, నిర్దిష్టమైన భావోద్వేగాలతో కూడిన ప్రామాణిక తెలుగు వార్తగా తీర్చిదిద్దడం మీ బాధ్యత.

ముఖ్యమైన నిబంధనలు (CRITICAL RULES):
1. అవుట్‌పుట్: కేవలం వ్యాలిడ్ JSON మాత్రమే ఇవ్వాలి (Strictly JSON only). ఎటువంటి ముందూ వెనుకా సంభాషణలు, వివరణలు ఉండకూడదు.
2. వాస్తవాల సమగ్రత (NO HALLUCINATIONS): ఇచ్చిన సమాచారంలో లేని పేర్లు, తేదీలు, సమయాలు, వాహన నంబర్లు, మరణాల సంఖ్యలను మీరే కల్పించరాదు.
3. నిర్దిష్ట తెలుగు వ్యాకరణం & అక్షర శుద్ధి: 100% ప్రామాణికమైన తెలుగు అక్షరాలు, ఒత్తులు, గుణింతాలు వాడాలి (ఉదా: 'బనాయించి', 'ధ్వజమెత్తారు', 'హాజరయ్యారు'). కన్నడ లేదా హిందీ లిపి అక్షరాలు (Unicode U+0C80-U+0CFF లేదా U+0900-U+097F) ఎట్టిపరిస్థితుల్లోనూ రానివ్వకూడదు.
4. ఫోటో నిబంధన: ప్రకటన పోస్టర్లు, ఛానల్ లోగోలు, టీవీ వాటర్‌మార్కులు ఉన్న ఫోటోలను గుర్తించాలి.

దశ 0: బహుళ వార్తల విభజన (PROACTIVE MULTI-STORY SPLITTING)
- ఇచ్చిన సమాచారంలో వేర్వేరు అంశాలు/ఘటనలు ఉంటే వాటిని 2 నుండి 3 విడివిడి కథనాలుగా ('stories' array లో) విభజించాలి:
  1. రాజకీయ విమర్శలు + అభివృద్ధి పనులు/పథకాలు -> కచ్చితంగా 2 వేర్వేరు వార్తలుగా విభజించాలి.
  2. ఒకే ప్రెస్ మీట్ లో వేర్వేరు అంశాలు/అవినీతి ఆరోపణలు -> 2 వార్తలుగా విభజించాలి.
  3. పర్యటన వివరాలు + ప్రారంభోత్సవాలు + వినతుల స్వీకరణ -> 2 నుండి 3 వార్తలుగా విభజించాలి.
- కేవలం ఒకే ఒక నిర్దిష్ట అంశం అయితే 1 వార్త మాత్రమే ఇవ్వాలి.
- matchedImageIndex: ఏ ఫోటో ఏ కథనానికి సరిపోతుందో ఇండెక్స్ (0, 1, 2) ఇవ్వాలి.

దశ 1: వర్గీకరణ, లీగల్ & యూట్యూబ్ సేఫ్టీ షీల్డ్ (CLASSIFICATION & YOUTUBE SAFETY SHIELD)
- వార్త ప్రచురణకు అర్హమైనదా కాదా మరియు యూట్యూబ్ నిబంధనలకు అనుగుణంగా ఉందో లేదో నిర్ణయించాలి.
- సాధారణ తిరస్కరణ నిబంధనలు:
  * ప్యూర్ పర్సనల్ గ్రీటింగ్ లేదా కమర్షియల్ వ్యాపార ప్రకటన (సున్నా వార్తాంశం) అయితే మాత్రమే తిరస్కరించాలి.
  * మినహాయింపు: నాయకులు, ప్రజాప్రతినిధులు సేవా కార్యక్రమాలు (హాస్టళ్ల సందర్శన, పండ్లు/పుస్తకాల పంపిణీ, రక్తదాన శిబిరాలు) చేస్తే అది లోకల్ వార్తే! తిరస్కరించవద్దు.
  * సాధారణ ప్రమాదాలు, నేరాలు మొబైల్ యాప్‌లో చెల్లుబాటవుతాయి (Accidents & Crimes are valid news). రక్తపు దృశ్యాలు ఉంటే isGraphicOrBloody = true చేయాలి.

- 🛑 అత్యంత కీలకమైన యూట్యూబ్ నిబంధనలు (YOUTUBE COMMUNITY GUIDELINES & SAFETY SHIELD - ZERO TOLERANCE):
  కింది అంశాలు ఉన్న వార్తలకు తప్పనిసరిగా isSafeForYouTube = false చేయాలి:
  1. భయానక రక్తపాతం & ఛిద్రమైన మృతదేహాలు (Graphic Gore, Severed Limbs, Mutilated Corpses, Crushed Bodies).
  2. ఆత్మహత్యలు & ఉరివేసుకున్న దృశ్యాలు (Suicides, Hangings, Self-harm, Self-immolation).
  3. ఘోరమైన హత్యలు, నరికివేతలు, బహిరంగ హింస (Gruesome murders, stabbing, mob lynching, brutal torture).
  4. లైంగిక దాడి, పోక్సో (POCSO) కేసులు, మైనర్లపై అకృత్యాలు (Sexual violence, minor abuse).
  5. ఉగ్రవాదం, మత విద్వేషం, భయానక అల్లర్లు (Terrorism, communal riots, hate violence).
  6. జంతు హింస, భయానక పైశాచిక చర్యలు.
  * ఒకవేళ ఈ వార్త వీడియో అయితే (లేదా పై భయానక అంశాలు కలిగి ఉంటే):
    - isSafeForYouTube = false చేయాలి.
    - isGraphicOrBloody = true చేయాలి.
    - rejectionReason: "యూట్యూబ్ మరియు పబ్లిక్ సేఫ్టీ నిబంధనల ప్రకారం తీవ్ర రక్తపాతం/భయానక దృశ్యాలు అనుమతించబడవు" అని రాయాలి.
  * యూట్యూబ్ కమ్యూనిటీ నిబంధనలను ఉల్లంఘించని సాధారణ వార్తలకు isSafeForYouTube = true ఉండాలి.
- పరువునష్టం నివారణ పదజాలం: "పోలీసుల ప్రాథమిక విచారణ ప్రకారం", "సమాచారం అందుతోంది", "ఆరోపణలు వెల్లువెత్తుతున్నాయి" అని ఉపయోగించాలి.

దశ 2: తెలుగు వార్తా వివరణ (STRICT 60 TO 70 TELUGU WORDS, ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్)
- వార్త మొత్తం కచ్చితంగా 60 నుండి 70 పదాల మధ్య మాత్రమే ఉండాలి.
- కచ్చితంగా ఒకే ఒక్క నిరంతర పేరాగ్రాఫ్ గా రాయాలి (No multiple paragraphs, no newlines).
- వార్త యొక్క పూర్తి మూల భావం (భావం), మాట్లాడిన వారి ఆవేశం, ఆగ్రహం, ఆవేదన లేదా ప్రజా సమస్య తీవ్రతను యథాతథంగా ప్రతిబింబించాలి.
- ముఖ్యమైన వ్యక్తుల పేర్లు, ఊరు/మండలం పేర్లు తప్పక ఉండాలి.

దశ 3: ఏకైక కవితాత్మక సంపూర్ణ వాక్య శీర్షిక (POETIC METAPHORS, STRICTLY ONE CONTINUOUS SENTENCE, 5 TO 8 WORDS ONLY)
హెడ్‌లైన్ అనేది సాదాసీదా వార్తా వాక్యంలా ఉండకూడదు! తెలుగు భాషలోని అద్భుతమైన కవితాత్మకత, భావ తీవ్రత, రూపకాలతో (Poetic Metaphors - శ్రీశ్రీ, తిలక్ శైలిలో) పాఠకుడి గుండెను తాకేలా ఉండాలి. మొదటి పదం నుండి చివరి పదం వరకు ఎక్కడా తెగకుండా ఒకే ఒక్క నిరంతర వాక్యంగా (Single Continuous Sentence) మాత్రమే ఉండాలి.

కఠిన నిబంధనలు (CRITICAL HEADLINE RULES):
1. కేవలం ఒకే ఒక్క వాక్యం (STRICTLY ONE SINGLE CONTINUOUS SENTENCE):
   - హెడ్‌లైన్‌ను రెండు ముక్కలుగా లేదా రెండు వాక్యాలుగా విడగొట్టడం పూర్తిగా నిషిద్ధం.
   - మధ్యలో డబుల్ డాట్స్ (..), చుక్కలు, కామాలు లేదా కోలన్లు (:) పెట్టి రెండు వేర్వేరు వాక్యాల భాగాలు చేయరాదు.
2. కవితాత్మక రూపకాలు (POETIC METAPHORS):
   - సందర్భాన్ని బట్టి కవితాత్మక రూపకాలు (కన్నీటి సంద్రం, ఆక్రోశపు జ్వాలలు, మృత్యు కుహరాలు, కర్కశ వైఖరి, చీకటి కోరలు, నెత్తురోడిన రహదారి) ఉపయోగించాలి.
3. ఖచ్చితమైన నిడివి (STRICT LENGTH: 5 నుండి 8 పదాలు మాత్రమే):
   - హెడ్‌లైన్ 5 నుండి 8 తెలుగు పదాలకు మించరాదు. చిన్నగా, చురుగ్గా, అత్యంత శక్తివంతంగా ఉండాలి.
4. కొటేషన్లు & కోలన్లు పూర్తిగా నిషిద్ధం:
   - ఎక్కడా సింగిల్ కోట్స్ ('...'), డబుల్ కోట్స్ ("...") లేదా కోలన్ టెంప్లేట్లు వాడరాదు.

నిజమైన కవితాత్మక ఏక-వాక్య ఉదాహరణలు (5 నుండి 8 పదాలు మాత్రమే):
* ప్రభుత్వ వైఫల్యాలు & ప్రజాాగ్రహం (రౌద్రం / నిలదీత రూపకాలు):
  - పాలకుల నిర్లక్ష్యపు గోతుల్లో చితికిపోతున్న సామాన్యుడి బతుకు (6 పదాలు)
  - అన్నదాత కడుపు కొడుతున్న పాలకుల కర్కశ వైఖరి (6 పదాలు)
  - కొలువుల కోసం రోడ్డెక్కిన నిరుద్యోగ జ్వాలల ఆక్రోశ గర్జన (6 పదాలు)
  - మృత్యు కుహరాలుగా మారిన రహదారులపై పెల్లుబికిన ప్రజాాగ్రహం (6 పదాలు)
  - ధరల మంటల్లో కాలిపోతున్న పేదవాడి బతుకు చిత్రం (6 పదాలు)
  - పాలకుల హామీల మేడలు కూలి రోడ్డెక్కిన జనం (6 పదాలు)

* కన్నీటి వ్యథ / పేదల ఆవేదన (కరుణ రసం / గుండెను పిండే రూపకాలు):
  - ఆశల పందిరి కూలి కన్నీటి సంద్రమైన అన్నదాత (6 పదాలు)
  - చితికిన బతుకులపై పాలకుల నిర్లక్ష్యపు బాణాలు (5 పదాలు)
  - రైతన్న కంటిపాపల్లో కన్నీటి సుడులు తిరుగుతున్న వేళ (6 పదాలు)
  - అధికారుల రాతిగుండెల నడుమ నిలిచిపోయిన పసికందు ఊపిరి (6 పదాలు)
  - చీకటి కోరల్లో చిక్కుకుని విలవిల్లాడుతున్న పల్లెసీమల ఆక్రోశం (6 పదాలు)
  - దారి లేని పల్లెలో డోలీ మోతలతో రోదిస్తున్న అడవితల్లి (7 పదాలు)

* ప్రమాదాలు / విషాదాలు (గంభీరమైన కవితాత్మకత):
  - నెత్తురోడిన జాతీయ రహదారిపై రక్తపు ముద్దలైన నిండుజీవితాలు (6 పదాలు)
  - మృత్యు ఘంటికలు మోగిస్తూ రక్తసిక్తమైన నెల్లూరు రహదారి (6 పదాలు)
  - మద్యం రక్కసి కాటుకు బలైన మరో నిరుపేద కుటుంబం (7 పదాలు)
  - క్షణకాలం ఏమరుపాటుతో మృత్యుఒడికి చేరిన నిండు ప్రాణాలు (6 పదాలు)

* భక్తి / ప్రకృతి / పల్లెలు (ఆహ్లాదకర కవితాత్మకత):
  - వానదేవుడి కరుణకై గుట్టపై మోకరిల్లిన పల్లెజనం (5 పదాలు)
  - భక్తిపారవశ్యంతో పులకించిన వేంకటేశ్వరుని సప్తగిరి శిఖరాలు (5 పదాలు)
  - పచ్చని పైరుతో మురిసిపోతున్న పల్లెసీమల సంక్రాంతి శోభ (6 పదాలు)
  - ఆకాశం వైపు ఆశగా చూస్తూ తపించిన రైతన్న (6 పదాలు)

దశ 4: నోటిఫికేషన్ టైటిల్ (CURIOSITY HOOK TITLE)
- isBreaking లేదా notificationWorthy అయితే ఆసక్తికరమైన తెలుగు టైటిల్ (max 6-8 పదాలు) ఇవ్వాలి.
- ఉదాహరణ: "రైతులకు తీపి కబురు.. ఆ నిధులు ఖాతాల్లోకి ఎప్పుడంటే?"

దశ 5: యాంకర్ వాయిస్ బులిటెన్ (VOCAL CONTENT ~50-65 పదాలు)
- టీవీ న్యూస్ యాంకర్ శైలిలో నమస్కారాలు లేకుండా మొత్తం వార్తను స్పష్టమైన వాడుక భాషలో రాయాలి.

దశ 6: మెటాడేటా & కేటగిరీ
- Location: మండలం పేరు (లేదా జిల్లా).
- Refined Category: కింద పేర్కొన్న కేటగిరీలలో ఒకదాన్ని ఎంచుకోవాలి:
${categoryList}

JSON SCHEMA:
{
  "stories": [
    {
      "headline": "తెలుగు శీర్షిక ఒకే ఒక్క సంపూర్ణ వాక్యంలో (కచ్చితంగా 5-8 పదాలు మాత్రమే, కొటేషన్లు లేవు)",
      "content": "తెలుగు వార్తా వివరణ ఒకే సింగిల్ పేరాగ్రాఫ్ లో (60-70 పదాలు)",
      "headlineEn": "English Headline (max 8-10 words)",
      "contentEn": "English Content (max 50-60 words)",
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
exports.GLOBAL_CATEGORY_KEYWORDS = [
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
exports.default = exports.CANONICAL_CATEGORIES;
