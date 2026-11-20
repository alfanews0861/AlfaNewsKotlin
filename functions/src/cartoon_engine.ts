/**
 * Editorial Political Satire Cartoon Engine (Pure Logic Module)
 *
 * Responsibilities:
 * 1. Select strictly FRESH (<= 48h, max 72h) state-specific political & social news
 *    for Andhra Pradesh and Telangana — eliminating stale 2-3 year old topics.
 * 2. Enforce Fourth Estate / Watchdog journalism editorial stance:
 *    satire MUST punch UP at the ruling government, administration, policies,
 *    or current public hardships — NEVER target opposition parties or former regimes.
 * 3. Validate AI-generated cartoon drafts against anti-opposition, freshness,
 *    and Telugu script guardrails before image generation.
 * 4. Build policy-safe, vivid Indian newspaper editorial CARICATURE image prompts
 *    (stripping real politician/party names & civic-filter triggers) with multi-tier
 *    caricature fallbacks so Gemini image generation succeeds reliably.
 */

export type CartoonState = "Andhra Pradesh" | "Telangana";

export interface RawNewsItem {
    id?: string;
    type?: string;
    category?: string;
    categories?: string[];
    location?: string;
    district?: string;
    state?: string;
    headline?: { telugu?: string; english?: string } | string;
    content?: { telugu?: string; english?: string } | string;
    timestampMs: number;
}

export interface FreshCartoonNewsItem {
    index: number;
    headlineTe: string;
    summaryTe: string;
    category: string;
    location: string;
    ageHours: number;
    score: number;
}

export interface CartoonDraft {
    topic?: string;
    basedOnNewsHeadline?: string;
    targetEntity?: string;
    visualPrompt?: string;
    safeFallbackVisualPrompt?: string;
    teluguPunchline?: string;
    teluguHeadline?: string;
}

export interface CartoonValidationResult {
    valid: boolean;
    reason?: string;
}

const EXCLUDED_POST_TYPES = new Set([
    "cartoon",
    "greeting",
    "quote",
    "history",
    "ad",
    "survey",
    "classified"
]);

const EXCLUDED_CATEGORIES = [
    "సినిమా", "వినోదం", "క్రీడలు", "రాశి", "జ్యోతిష్యం", "భక్తి", "ఆధ్యాత్మిక",
    "జీవనశైలి", "ఫ్యాషన్", "ఆరోగ్యం", "టెక్నాలజీ", "కార్టూన్", "పండుగలు", "ప్రేరణ", "చరిత్ర",
    "cinema", "entertainment", "movie", "sports", "cricket", "astrology", "horoscope",
    "spiritual", "devotional", "lifestyle", "fashion", "tech", "cartoon", "greeting", "history"
];

const HIGH_PRIORITY_POLITICAL_SOCIAL_KEYWORDS = [
    // Governance & Politics
    "ప్రభుత్వం", "ప్రభుత్వ", "సీఎం", "ముఖ్యమంత్రి", "మంత్రి", "మంత్రులు", "క్యాబినెట్",
    "అసెంబ్లీ", "శాసనసభ", "ఎమ్మెల్యే", "ఎంపీ", "రాజకీయ", "రాజకీయం", "హామీ", "హామీలు",
    "పథకం", "పథకాలు", "బడ్జెట్", "నిధులు", "అప్పులు", "పన్ను", "పన్నులు", "జిఎస్టీ",
    "చంద్రబాబు", "పవన్ కళ్యాణ్", "లోకేష్", "కూటమి", "టీడీపీ", "జనసేన",
    "రేవంత్", "రేవంత్ రెడ్డి", "కాంగ్రెస్", "భట్టి", "ఉత్తమ్", "కేటీఆర్", "హరీష్",
    // Public & Social Issues
    "రైతు", "రైతులు", "ధాన్యం", "పంట", "రుణమాఫీ", "ధరలు", "ధరల", "పెట్రోల్", "గ్యాస్",
    "కరెంట్", "విద్యుత్", "బిల్లు", "తాగునీరు", "నీటి", "రోడ్లు", "గుంతలు", "ట్రాఫిక్",
    "నిరుద్యోగ", "ఉద్యోగ", "నోటిఫికేషన్", "డీఎస్సీ", "గ్రూప్స్", "ఫీజు", "పాఠశాల",
    "ఆసుపత్రి", "వైద్యం", "పెన్షన్", "రేషన్", "ఇళ్లు", "ఇసుక", "మద్యం", "భూమి",
    "ప్రజలు", "సామాన్యుడు", "నిరసన", "ధర్నా", "ఆందోళన", "సమస్య", "సమస్యలు",
    "government", "politics", "cm ", "minister", "cabinet", "assembly", "budget",
    "farmer", "price", "inflation", "power", "water", "roads", "unemployment", "jobs", "welfare"
];

const AP_INDICATORS = [
    "andhra", "andhra pradesh", "ap ", "ఆంధ్ర", "ఆంధ్రప్రదేశ్", "ఏపీ",
    "అమరావతి", "amaravati", "విజయవాడ", "vijayawada", "విశాఖ", "విశాఖపట్నం", "visakhapatnam", "vizag",
    "గుంటూరు", "guntur", "తిరుపతి", "tirupati", "నెల్లూరు", "nellore", "కర్నూలు", "kurnool",
    "కడప", "kadapa", "అనంతపురం", "anantapur", "చిత్తూరు", "chittoor", "కాకినాడ", "kakinada",
    "రాజమండ్రి", "rajahmundry", "తూర్పు గోదావరి", "పశ్చిమ గోదావరి", "ఏలూరు", "eluru",
    "కృష్ణా", "krishna", "ప్రకాశం", "prakasam", "ఒంగోలు", "ongole", "శ్రీకాకుళం", "srikakulam",
    "విజయనగరం", "vizianagaram", "అనకాపల్లి", "anakapalli", "కోనసీమ", "konaseema",
    "బాపట్ల", "bapatla", "పల్నాడు", "palnadu", "నంద్యాల", "nandyal", "అన్నమయ్య", "annamayya",
    "సత్యసాయి", "sathya sai", "ఎన్టీఆర్", "ntr district", "పార్వతీపురం", "అల్లూరి", "పోలవరం",
    "చంద్రబాబు", "chandrababu", "పవన్ కళ్యాణ్", "pawan kalyan", "లోకేష్", "lokesh",
    "కూటమి", "టీడీపీ", "tdp", "జనసేన", "janasena", "వైసీపీ", "ysrcp", "జగన్", "jagan"
];

const TS_INDICATORS = [
    "telangana", "ts ", "tg ", "తెలంగాణ", "టీజీ", "టీఎస్",
    "హైదరాబాద్", "hyderabad", "సికింద్రాబాద్", "secunderabad", "వరంగల్", "warangal",
    "హన్మకొండ", "hanumakonda", "కరీంనగర్", "karimnagar", "ఖమ్మం", "khammam",
    "నల్గొండ", "nalgonda", "నిజామాబాద్", "nizamabad", "ఆదిలాబాద్", "adilabad",
    "మహబూబ్", "mahabubnagar", "మహబూబాబాద్", "mahabubabad", "సంగారెడ్డి", "sangareddy",
    "సిద్దిపేట", "siddipet", "సూర్యాపేట", "suryapet", "మెదక్", "medak", "మేడ్చల్", "medchal",
    "రంగారెడ్డి", "rangareddy", "కామారెడ్డి", "kamareddy", "జగిత్యాల", "jagtial",
    "పెద్దపల్లి", "peddapalli", "నిర్మల్", "nirmal", "మంచిర్యాల", "mancherial",
    "యాదాద్రి", "yadadri", "వికారాబాద్", "vikarabad", "వనపర్తి", "wanaparthy",
    "గద్వాల", "gadwal", "నాగర్ కర్నూల్", "nagarkurnool", "సిరిసిల్ల", "sircilla",
    "ములుగు", "mulugu", "భద్రాద్రి", "bhadradri", "జనగాం", "jangaon", "భూపాలపల్లి", "నారాయణపేట",
    "రేవంత్", "revanth", "భట్టి", "bhatti", "ఉత్తమ్", "uttam", "కోమటిరెడ్డి",
    "కేసీఆర్", "kcr", "కేటీఆర్", "ktr", "హరీష్ రావు", "harish rao", "బీఆర్ఎస్", "brs", "టీజీఆర్టీసీ", "tgrtc", "హైడ్రా", "hydraa"
];

const OPPOSITION_TARGET_PATTERNS: Record<CartoonState, RegExp[]> = {
    "Andhra Pradesh": [
        /వైసీపీ/i, /వై\.?ఎస్\.?ఆర్\.?సి\.?పి/i, /ysrcp/i, /ycp/i,
        /జగన్/i, /jagan/i, /గత\s*ప్రభుత్వం/i, /మాజీ\s*సీఎం/i, /ప్రతిపక్షం/i, /ప్రతిపక్ష/i
    ],
    "Telangana": [
        /బీఆర్ఎస్/i, /బి\.?ఆర్\.?ఎస్/i, /brs/i, /టీఆర్ఎస్/i, /trs/i,
        /కేసీఆర్/i, /kcr/i, /కేటీఆర్/i, /ktr/i, /హరీష్\s*రావు/i, /harish\s*rao/i,
        /గులాబీ\s*పార్టీ/i, /కారు\s*పార్టీ/i, /గత\s*ప్రభుత్వం/i, /మాజీ\s*సీఎం/i, /ప్రతిపక్షం/i, /ప్రతిపక్ష/i
    ]
};

const RULING_ACCOUNTABILITY_PATTERNS: Record<CartoonState, RegExp[]> = {
    "Andhra Pradesh": [
        /ప్రభుత్వం/i, /ప్రభుత్వ/i, /కూటమి/i, /సర్కార్/i, /పాలకులు/i, /మంత్రులు/i, /మంత్రి/i,
        /సీఎం/i, /చంద్రబాబు/i, /పవన్/i, /అధికారులు/i, /హామీ/i, /ధరలు/i, /రైతు/i, /ప్రజలు/i
    ],
    "Telangana": [
        /ప్రభుత్వం/i, /ప్రభుత్వ/i, /కాంగ్రెస్/i, /సర్కార్/i, /పాలకులు/i, /మంత్రులు/i, /మంత్రి/i,
        /సీఎం/i, /రేవంత్/i, /అధికారులు/i, /హామీ/i, /గ్యారంటీ/i, /ధరలు/i, /రైతు/i, /ప్రజలు/i
    ]
};

function getTextValue(field?: { telugu?: string; english?: string } | string): string {
    if (!field) return "";
    if (typeof field === "string") return field.trim();
    return (field.telugu || field.english || "").trim();
}

function getAllCategoriesText(item: RawNewsItem): string {
    const parts: string[] = [];
    if (item.category) parts.push(item.category);
    if (Array.isArray(item.categories)) parts.push(...item.categories);
    return parts.join(" ").toLowerCase();
}

function detectStateRelevance(item: RawNewsItem, targetState: CartoonState): { matchesTarget: boolean; matchesOther: boolean } {
    const combined = [
        item.state || "",
        item.district || "",
        item.location || "",
        getTextValue(item.headline),
        getTextValue(item.content).slice(0, 260)
    ].join(" ").toLowerCase();

    const isAP = AP_INDICATORS.some(k => combined.includes(k));
    const isTS = TS_INDICATORS.some(k => combined.includes(k));

    if (targetState === "Andhra Pradesh") {
        return { matchesTarget: isAP, matchesOther: isTS && !isAP };
    }
    return { matchesTarget: isTS, matchesOther: isAP && !isTS };
}

/**
 * Selects strictly FRESH (<= 48h, max 72h fallback) state-relevant political and public-interest
 * news articles from Firestore documents, excluding entertainment/greetings/cartoons.
 */
export function selectFreshStateNewsForCartoon(
    items: RawNewsItem[],
    state: CartoonState,
    nowMs: number = Date.now(),
    maxItems: number = 8
): FreshCartoonNewsItem[] {
    const pickWithinWindow = (maxAgeHours: number): FreshCartoonNewsItem[] => {
        const seenHeadlines = new Set<string>();
        const scored: Omit<FreshCartoonNewsItem, "index">[] = [];

        for (const item of items) {
            const typeLower = String(item.type || "news").toLowerCase();
            if (EXCLUDED_POST_TYPES.has(typeLower)) continue;

            if (!item.timestampMs || item.timestampMs <= 0) continue;
            const ageHours = Math.max(0, (nowMs - item.timestampMs) / (1000 * 60 * 60));
            if (ageHours > maxAgeHours) continue;

            const headlineTe = getTextValue(item.headline);
            if (headlineTe.length < 10) continue;

            const normHeadline = headlineTe.toLowerCase().replace(/\s+/g, " ").trim();
            if (seenHeadlines.has(normHeadline)) continue;

            const catText = getAllCategoriesText(item);
            const isExcludedCategory = EXCLUDED_CATEGORIES.some(c => catText.includes(c));
            if (isExcludedCategory) continue;

            const { matchesTarget, matchesOther } = detectStateRelevance(item, state);
            if (matchesOther) continue;

            const summaryTe = getTextValue(item.content).replace(/\s+/g, " ").slice(0, 180);
            const fullText = `${headlineTe} ${summaryTe} ${catText}`.toLowerCase();

            const keywordHits = HIGH_PRIORITY_POLITICAL_SOCIAL_KEYWORDS.reduce(
                (acc, kw) => (fullText.includes(kw) ? acc + 1 : acc),
                0
            );

            const isPoliticalCategory =
                catText.includes("రాజకీయం") ||
                catText.includes("రాజకీయ") ||
                catText.includes("politics") ||
                catText.includes("వ్యవసాయం") ||
                catText.includes("వ్యాపారం") ||
                catText.includes("విద్య") ||
                catText.includes("జాతీయం");

            // Require either state relevance OR strong civic/political signal
            if (!matchesTarget && !isPoliticalCategory && keywordHits === 0) continue;

            let score = 0;
            if (matchesTarget) score += 40;
            if (isPoliticalCategory) score += 25;
            score += Math.min(keywordHits * 8, 32);
            // Recency boost: fresher stories (last 12-24h) rank higher
            score += Math.max(0, 24 - Math.floor(ageHours / 2));

            seenHeadlines.add(normHeadline);
            scored.push({
                headlineTe,
                summaryTe,
                category: item.category || (item.categories?.[0] ?? "తాజా వార్త"),
                location: item.district || item.location || state,
                ageHours: Math.round(ageHours),
                score
            });
        }

        scored.sort((a, b) => b.score - a.score || a.ageHours - b.ageHours);

        // Prefer strictly state-matched stories first, then fill with top common civic/national public issues if sparse
        return scored.slice(0, maxItems).map((entry, idx) => ({
            ...entry,
            index: idx + 1
        }));
    };

    // Strict 48-hour live window first; relax to 72 hours ONLY if fewer than 2 live articles matched
    const fresh48h = pickWithinWindow(48);
    if (fresh48h.length >= 2) return fresh48h;

    return pickWithinWindow(72);
}

/**
 * Builds the editorial cartoonist prompt grounded strictly in TODAY's live news
 * and Fourth Estate watchdog journalism (holding the ruling government accountable).
 */
export function buildCartoonConceptPrompt(params: {
    state: CartoonState;
    todayStr: string;
    freshNews: FreshCartoonNewsItem[];
    recentCartoonHeadlines?: string[];
    correctionFeedback?: string;
}): string {
    const { state, todayStr, freshNews, recentCartoonHeadlines = [], correctionFeedback } = params;

    const governingReality = state === "Andhra Pradesh"
        ? `CURRENT RULING GOVERNMENT IN ANDHRA PRADESH (WHO HOLDS POWER TODAY):
- Ruling Coalition in Power: NDA Government (TDP + Jana Sena + BJP), Chief Minister Chandrababu Naidu, Deputy CM Pawan Kalyan, and State Ministers/Administration.
- Opposition (NOT in power — DO NOT TARGET): YSRCP / YS Jagan Mohan Reddy.`
        : `CURRENT RULING GOVERNMENT IN TELANGANA (WHO HOLDS POWER TODAY):
- Ruling Party in Power: Indian National Congress Government, Chief Minister Revanth Reddy, and State Ministers/Administration.
- Opposition (NOT in power — DO NOT TARGET): BRS (KCR, KTR, Harish Rao) and BJP.`;

    const newsBlock = freshNews.length > 0
        ? freshNews
            .map(n => `[${n.index}] (${n.ageHours}h ago | ${n.category} | ${n.location}) ${n.headlineTe}${n.summaryTe ? ` — ${n.summaryTe}` : ""}`)
            .join("\n")
        : `(No state-specific political article was matched in the last 48h — pick a universal CURRENT day-to-day governance & common-man issue in ${state} today such as rising household prices, civic infrastructure/roads/power/water delays, bureaucratic red tape, or gap between ruling government claims and ground reality.)`;

    const avoidRepeatsBlock = recentCartoonHeadlines.length > 0
        ? `\nRECENT CARTOONS ALREADY PUBLISHED (DO NOT REPEAT THESE TOPICS):\n- ${recentCartoonHeadlines.join("\n- ")}\n`
        : "";

    const correctionBlock = correctionFeedback
        ? `\n⚠️ CRITICAL CORRECTION FROM CHIEF EDITOR (MUST OBEY):\n${correctionFeedback}\n`
        : "";

    return `You are a legendary independent Telugu newspaper editorial cartoonist (in the fearless watchdog tradition of R.K. Laxman, Sridhar, and Shankar).
State: ${state}
Today's Exact Date: ${todayStr}

${governingReality}

TODAY'S LIVE NEWS IN ${state} (LAST 24–48 HOURS — YOUR SOLE FACTUAL SOURCE):
${newsBlock}
${avoidRepeatsBlock}${correctionBlock}

MANDATORY JOURNALISTIC & EDITORIAL CONSTITUTION (NON-NEGOTIABLE):
1. FRESHNESS ONLY — ZERO 2-3 YEAR OLD TOPICS:
   - Base the cartoon STRICTLY on ONE specific live news story from TODAY'S LIVE NEWS list above (last 24–48 hours).
   - NEVER dig up 2–3 year old incidents, old election slogans from 2023/2024, or previous governments' past terms.
   - Set "basedOnNewsHeadline" to the exact headline from the list above that inspired this cartoon.
2. SPEAKING TRUTH TO POWER (PUNCH UP AT THE RULING GOVERNMENT — NEVER AT THE OPPOSITION):
   - In a democracy, newspapers and editorial cartoonists hold the CURRENT RULING GOVERNMENT, ruling ministers, administration, and state policies accountable from the common citizen's point of view.
   - Aim sharp, witty, clever satire at the CURRENT RULING GOVERNMENT's promises vs ground reality, administrative delays, rising public burdens, civic failures, or ironic ruling-party statements in today's news.
   - STRICTLY FORBIDDEN: NEVER mock, attack, ridicule, or make the OPPOSITION party or opposition leaders the target of the cartoon! (In AP, NEVER target YSRCP/Jagan. In Telangana, NEVER target BRS/KCR/KTR.)
   - Set "targetEntity" to "ruling_government" (if satirizing ruling leaders/administration/policies) or "public_issue_governance" (if satirizing civic/social burdens under current governance). NEVER set it to "opposition".
3. PURE CARICATURE ART DIRECTION (100% POLICY-SAFE FOR IMAGE GENERATION):
   - To comply with image generation safety rules and deliver authentic Telugu newspaper humor, design BOTH "visualPrompt" and "safeFallbackVisualPrompt" in CLASSIC INDIAN NEWSPAPER CARICATURE STYLE.
   - CRITICAL IMAGE SAFETY RULES:
     * NEVER write any real politician's name (no Chandrababu, Pawan, Revanth, Jagan, KCR, KTR, Modi, etc.) or real party name/logo in visualPrompt or safeFallbackVisualPrompt.
     * Instead, use expressive FICTIONAL CARICATURE ARCHETYPES:
       - A pompous, theatrical cartoon ruling minister/official caricature (exaggerated smug expression, crisp white khadi kurta, oversized marigold garland, dramatic hand wave, perched on an ornate cushioned chair/podium).
       - An expressive Indian Common Man caricature (R.K. Laxman style everyday citizen with round spectacles, checkered shirt or dhoti, bewildered/wry face, holding an empty wallet, utility bill, grocery basket, or farmer's towel).
     * Use clever visual comic metaphors (giant hot-air balloon of promises, towering stack of red-tape files, tiny toy umbrella in heavy rain, cracked road with a grand red-ribbon scissors ceremony, giant weighing scale tilted unfairly, empty water pot next to a grand banner).
     * STRICTLY NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO SIGNBOARDS, NO SPEECH BUBBLES anywhere inside the visual descriptions.
   - "safeFallbackVisualPrompt": Write an even simpler, whimsical, 100% family-friendly 2D comic caricature scene of a baffled Indian common man with spectacles looking at an overconfident cartoon official demonstrating a funny symbolic prop (zero political/civic trigger words).
4. AUTHENTIC TELUGU PUNCHLINE & HEADLINE:
   - "teluguPunchline": 1–2 crisp, razor-sharp, naturally funny Telugu lines spoken from the common man's perspective (pure Telugu Unicode script U+0C00–U+0C7F, witty newspaper satire, NO personal abuse/defamation, NO mention of AI/bot).
   - "teluguHeadline": Short, catchy Telugu cartoon title (max 45 characters, pure Telugu script, no colons).

Output strict JSON only.`;
}

/**
 * Validates that a generated cartoon draft obeys all journalistic & quality rules:
 * - Does NOT target the opposition
 * - Contains real Telugu headline & punchline
 * - Contains usable visual prompt
 */
export function validateCartoonDraft(
    draft: CartoonDraft,
    state: CartoonState
): CartoonValidationResult {
    const target = String(draft.targetEntity || "").toLowerCase().trim();
    if (target === "opposition" || target.includes("opposition") || target.includes("ప్రతిపక్ష")) {
        return {
            valid: false,
            reason: `Cartoon targeted opposition (targetEntity=${draft.targetEntity}). Must hold the current ruling government in ${state} accountable instead.`
        };
    }

    const headline = String(draft.teluguHeadline || "").trim();
    const punchline = String(draft.teluguPunchline || "").trim();
    const topic = String(draft.topic || "").trim();

    if (!headline || !punchline) {
        return { valid: false, reason: "Missing teluguHeadline or teluguPunchline." };
    }

    const teluguChars = ((headline + " " + punchline).match(/[\u0C00-\u0C7F]/g) || []).length;
    if (teluguChars < 12) {
        return { valid: false, reason: "Headline/punchline does not contain sufficient Telugu script." };
    }

    const combinedTelugu = `${topic} ${headline} ${punchline}`;
    const oppositionPatterns = OPPOSITION_TARGET_PATTERNS[state];
    const hitsOpposition = oppositionPatterns.some(rx => rx.test(combinedTelugu));

    if (hitsOpposition) {
        // Reject if it mentions opposition terms without clearly targeting the ruling government,
        // OR if the headline/punchline directly names opposition party/leaders as the subject.
        const rulingPatterns = RULING_ACCOUNTABILITY_PATTERNS[state];
        const mentionsRuling = rulingPatterns.some(rx => rx.test(combinedTelugu));
        const headlineHitsOpposition = oppositionPatterns.some(rx => rx.test(headline));

        if (headlineHitsOpposition || !mentionsRuling) {
            return {
                valid: false,
                reason: `Cartoon text appears to target opposition in ${state}. Satire must focus strictly on the current ruling government or public governance issues.`
            };
        }
    }

    const visual = String(draft.visualPrompt || "").trim();
    if (visual.length < 20) {
        return { valid: false, reason: "visualPrompt is too short or missing." };
    }

    return { valid: true };
}

const IMAGE_PROMPT_REPLACEMENTS: Array<[RegExp, string]> = [
    // Real politicians -> safe fictional caricature archetypes
    [/\b(chandrababu\s*naidu|cbn|naidu)\b/gi, "a theatrical veteran cartoon official in white khadi kurta and spectacles"],
    [/\b(pawan\s*kalyan)\b/gi, "an energetic dramatic cartoon deputy in white kurta and scarf"],
    [/\b(nara\s*lokesh|lokesh)\b/gi, "a young cartoon official holding a sleek tablet"],
    [/\b(revanth\s*reddy|revanth)\b/gi, "a confident cartoon leader in crisp white kurta and marigold garland"],
    [/\b(jagan\s*mohan\s*reddy|ys\s*jagan|jagan)\b/gi, "a cartoon figure in white shirt"],
    [/\b(kcr|chandrashekar\s*rao|ktr|harish\s*rao)\b/gi, "a cartoon figure in traditional attire"],
    [/\b(narendra\s*modi|modi|amit\s*shah|rahul\s*gandhi)\b/gi, "a grand cartoon VIP in ceremonial kurta"],
    // Political party names -> neutral caricature descriptors
    [/\b(tdp|ysrcp|ycp|brs|trs|bjp|congress|jana\s*sena|nda|india\s*bloc)\b/gi, "the ruling administration"],
    // Safety-filter trigger words -> whimsical comic satire equivalents
    [/\b(political|politician|politicians)\b/gi, "theatrical cartoon official"],
    [/\b(election|elections|vote|voting|ballot)\b/gi, "grand public promise show"],
    [/\b(corrupt|corruption|bribe|scam|fraud)\b/gi, "bureaucratic red-tape comedy"],
    [/\b(demolition|bulldozer|violence|violent|riot|attack|fight|blood|weapon)\b/gi, "comical slapstick chaos"],
    [/\b(protest|strike|agitation)\b/gi, "baffled citizens expressing humorous disbelief"]
];

/**
 * Sanitizes a visual description so it NEVER triggers real-person likeness or
 * civic/political safety filters during image generation.
 */
export function sanitizeForCaricatureImagePrompt(rawScene: string): string {
    let cleaned = String(rawScene || "").trim();
    for (const [pattern, replacement] of IMAGE_PROMPT_REPLACEMENTS) {
        cleaned = cleaned.replace(pattern, replacement);
    }
    // Remove any quoted text/dialogue that might trick the model into rendering garbled words
    cleaned = cleaned.replace(/["'“”‘’][^"'“”‘’]{1,80}["'“”‘’]/g, " ");
    // Collapse whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    return cleaned || "A humorous Indian common man with round spectacles looking in comic disbelief at an overconfident cartoon official standing on a towering pile of paper files";
}

/**
 * Builds an authentic Indian newspaper editorial CARICATURE art prompt
 * optimized for Gemini image generation models (9:16 vertical mobile card layout).
 */
export function buildCaricatureImagePrompt(
    sceneDescription: string,
    tier: "primary" | "ultra_safe" = "primary"
): string {
    const safeScene = sanitizeForCaricatureImagePrompt(sceneDescription);

    if (tier === "ultra_safe") {
        return `A charming, lighthearted 2D hand-drawn Indian newspaper comic caricature illustration.
Scene: ${safeScene}.
Style: Classic Indian editorial comic strip caricature art in pen-and-ink outlines with warm watercolor wash on cream-tinted paper, exaggerated expressive cartoon faces, humorous visual storytelling, cheerful satirical tone.
Composition: Vertical 9:16 framing with characters centered in the upper two-thirds and clean uncluttered warm background space in the lower third.
STRICT RULE: Pure artwork only. Absolutely NO text, NO words, NO letters, NO numbers, NO speech bubbles, NO captions, NO signs, NO logos anywhere in the image.`;
    }

    return `A masterpiece colorful 2D Indian newspaper editorial caricature illustration in the iconic hand-drawn style of classic Indian cartoonists.
Scene: ${safeScene}.
Caricature Art Direction: Bold black ink pen linework with lively cross-hatching, vibrant hand-painted watercolor wash on lightly textured off-white newsprint paper, delightfully exaggerated caricature proportions and hilarious expressive faces, unmistakable everyday South Indian setting and attire.
Composition: Clean vertical 9:16 layout with the main comedic action clearly framed in the upper 70% of the canvas and subtle softer background space at the bottom for clean framing.
CRITICAL MANDATORY RULE: Pure visual caricature illustration only. STRICTLY ZERO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO SPEECH BUBBLES, NO BANNERS WITH WRITING, NO SIGNBOARDS WITH TEXT anywhere in the image.`;
}

/**
 * Guaranteed-safe 3rd-tier editorial caricature prompt used only if both primary
 * and AI-drafted fallback prompts are refused by image safety filters.
 */
export function getGuaranteedSafeCaricaturePrompt(state: CartoonState): string {
    const backdrop = state === "Andhra Pradesh"
        ? "a sunny South Indian town square with palm trees and a grand ceremonial ribbon stage"
        : "a bustling Deccan city street with heritage arches and a grand ceremonial podium";

    return buildCaricatureImagePrompt(
        `In ${backdrop}, a pompous fictional cartoon official wearing a crisp white khadi kurta and a giant marigold garland proudly inflates a huge colorful balloon shaped like a luxury palace while sitting on a stack of tangled red-tape files; beside him, an expressive Indian common man caricature in a checkered shirt and round spectacles scratches his head while holding a tiny empty wallet and a leaky umbrella in humorous disbelief`,
        "ultra_safe"
    );
}
