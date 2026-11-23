import assert from "node:assert/strict";
import {
    RawNewsItem,
    buildCaricatureImagePrompt,
    buildCartoonConceptPrompt,
    getGuaranteedSafeCaricaturePrompt,
    sanitizeForCaricatureImagePrompt,
    selectFreshStateNewsForCartoon,
    validateCartoonDraft
} from "./cartoon_engine";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

test("selectFreshStateNewsForCartoon strictly rejects stale news (2-3 years old or >72h) and excludes non-civic categories", () => {
    const now = Date.parse("2026-11-19T06:00:00+05:30");

    const pool: RawNewsItem[] = [
        // 2.5 years old AP political news -> MUST BE REJECTED
        {
            id: "old-ap",
            type: "news",
            category: "రాజకీయం",
            state: "Andhra Pradesh",
            headline: { telugu: "2024 ఎన్నికల హామీలపై అసెంబ్లీలో పాత చర్చ" },
            content: { telugu: "రెండేళ్ల క్రితం నాటి రాజకీయ వార్త." },
            timestampMs: now - 800 * DAY_MS
        },
        // Cinema post from 2 hours ago -> MUST BE EXCLUDED
        {
            id: "cinema-ap",
            type: "news",
            category: "సినిమా",
            state: "Andhra Pradesh",
            headline: { telugu: "విజయవాడలో కొత్త సినిమా ప్రీ రిలీజ్ వేడుక" },
            content: { telugu: "అభిమానులు భారీగా తరలివచ్చారు." },
            timestampMs: now - 2 * HOUR_MS
        },
        // Previous cartoon post -> MUST BE EXCLUDED
        {
            id: "old-cartoon",
            type: "cartoon",
            category: "కార్టూన్",
            state: "Andhra Pradesh",
            headline: { telugu: "ఆంధ్రప్రదేశ్ కార్టూన్: పాత వ్యంగ్యం" },
            timestampMs: now - 24 * HOUR_MS
        },
        // Telangana political news -> MUST NOT APPEAR IN AP SELECTION
        {
            id: "fresh-ts",
            type: "news",
            category: "రాజకీయం",
            district: "హైదరాబాద్",
            headline: { telugu: "తెలంగాణలో రైతు భరోసా నిధులపై ప్రభుత్వ సమీక్ష" },
            content: { telugu: "హైదరాబాద్‌లో సీఎం రేవంత్ రెడ్డి అధికారులతో భేటీ అయ్యారు." },
            timestampMs: now - 3 * HOUR_MS
        },
        // Fresh AP governance/public issue news (5h ago) -> MUST BE SELECTED #1
        {
            id: "fresh-ap-1",
            type: "news",
            category: "రాజకీయం",
            district: "గుంటూరు",
            headline: { telugu: "ఏపీలో నిత్యావసర ధరల పెరుగుదలపై ప్రజల ఆగ్రహం, ప్రభుత్వ హామీలపై ప్రశ్నలు" },
            content: { telugu: "విజయవాడ, గుంటూరు మార్కెట్లలో కూరగాయలు, నూనె ధరలు భగ్గుమంటున్నాయి." },
            timestampMs: now - 5 * HOUR_MS
        },
        // Fresh AP farmer issue (10h ago) -> MUST BE SELECTED #2
        {
            id: "fresh-ap-2",
            type: "news",
            category: "వ్యవసాయం",
            district: "కర్నూలు",
            headline: { telugu: "కర్నూలులో ధాన్యం కొనుగోలు కేంద్రాల్లో జాప్యం, రైతుల ఆందోళన" },
            content: { telugu: "ప్రభుత్వ అధికారులు స్పందించడం లేదని రైతులు వాపోతున్నారు." },
            timestampMs: now - 10 * HOUR_MS
        }
    ];

    const apSelected = selectFreshStateNewsForCartoon(pool, "Andhra Pradesh", now, 8);
    assert.equal(apSelected.length, 2);
    assert.ok(apSelected[0].headlineTe.includes("నిత్యావసర ధరల"));
    assert.ok(apSelected[1].headlineTe.includes("ధాన్యం కొనుగోలు"));
    assert.ok(apSelected.every(item => item.ageHours <= 48));

    const tsSelected = selectFreshStateNewsForCartoon(pool, "Telangana", now, 8);
    assert.equal(tsSelected.length, 1);
    assert.ok(tsSelected[0].headlineTe.includes("తెలంగాణలో రైతు భరోసా"));
});

test("buildCartoonConceptPrompt enforces ruling-government accountability, forbids opposition targeting, and removes stale 2024 hardcoded topics", () => {
    const promptAP = buildCartoonConceptPrompt({
        state: "Andhra Pradesh",
        todayStr: "2026-11-19",
        freshNews: [
            {
                index: 1,
                headlineTe: "ఏపీలో విద్యుత్ ఛార్జీల పెంపుపై సామాన్యుల ఆవేదన",
                summaryTe: "కొత్త బిల్లులు చూసి వినియోగదారులు షాక్ అవుతున్నారు.",
                category: "రాజకీయం",
                location: "విజయవాడ",
                ageHours: 4,
                score: 95
            }
        ],
        recentCartoonHeadlines: ["ఆంధ్రప్రదేశ్ కార్టూన్: గత వారం రోడ్ల పరిస్థితి"]
    });

    assert.ok(promptAP.includes("2026-11-19"));
    assert.ok(promptAP.includes("ఏపీలో విద్యుత్ ఛార్జీల పెంపుపై సామాన్యుల ఆవేదన"));
    assert.ok(promptAP.includes("PUNCH UP AT THE RULING GOVERNMENT"));
    assert.ok(promptAP.includes("NEVER target YSRCP/Jagan"));
    assert.ok(promptAP.includes("CLASSIC INDIAN NEWSPAPER CARICATURE STYLE"));
    // Ensure old hardcoded 2024 stale topics are GONE
    assert.equal(promptAP.includes("Deepam free gas cylinders"), false);
    assert.equal(promptAP.includes("HYDRAA demolitions"), false);

    const promptTS = buildCartoonConceptPrompt({
        state: "Telangana",
        todayStr: "2026-11-19",
        freshNews: []
    });
    assert.ok(promptTS.includes("Indian National Congress Government"));
    assert.ok(promptTS.includes("NEVER target BRS/KCR/KTR"));
    assert.equal(promptTS.includes("Musi riverfront project"), false);
});

test("validateCartoonDraft rejects opposition-targeting drafts in AP and TS and accepts ruling-government satire", () => {
    // 1. Rejects explicit targetEntity = opposition
    const oppTarget = validateCartoonDraft({
        targetEntity: "opposition",
        teluguHeadline: "ప్రతిపక్షం కొత్త నాటకం",
        teluguPunchline: "ఎన్నికల తర్వాత ప్రతిపక్షం నిద్రలేచింది!",
        visualPrompt: "A humorous caricature of a puzzled common man watching an empty chair"
    }, "Andhra Pradesh");
    assert.equal(oppTarget.valid, false);

    // 2. Rejects AP cartoon mocking YSRCP / Jagan
    const apOppMock = validateCartoonDraft({
        targetEntity: "ruling_government",
        teluguHeadline: "జగన్ పాత హామీల కథ",
        teluguPunchline: "వైసీపీ హయాంలో జరిగిన తప్పులు ఇంకా గుర్తున్నాయి!",
        visualPrompt: "A classic Indian newspaper caricature of a citizen holding a calendar"
    }, "Andhra Pradesh");
    assert.equal(apOppMock.valid, false);

    // 3. Rejects Telangana cartoon mocking BRS / KCR / KTR
    const tsOppMock = validateCartoonDraft({
        targetEntity: "ruling_government",
        teluguHeadline: "బీఆర్ఎస్ నేతల కొత్త విమర్శలు",
        teluguPunchline: "కేసీఆర్, కేటీఆర్ మాటలు జనం నమ్మడం లేదు!",
        visualPrompt: "A classic Indian newspaper caricature of a citizen looking puzzled"
    }, "Telangana");
    assert.equal(tsOppMock.valid, false);

    // 4. Accepts valid AP ruling-government accountability cartoon
    const validAP = validateCartoonDraft({
        targetEntity: "ruling_government",
        teluguHeadline: "బిల్లు చూస్తేనే షాక్ కొడుతోంది!",
        teluguPunchline: "కరెంట్ కోతలు తగ్గలేదు కానీ, ప్రభుత్వ బిల్లులు మాత్రం రాకెట్ వేగంతో ఎగురుతున్నాయి!",
        visualPrompt: "An expressive Indian common man in spectacles fainting while holding an oversized electricity bill as a smug cartoon official in white khadi cuts a ribbon"
    }, "Andhra Pradesh");
    assert.equal(validAP.valid, true);

    // 5. Accepts valid TS ruling-government accountability cartoon
    const validTS = validateCartoonDraft({
        targetEntity: "public_issue_governance",
        teluguHeadline: "హామీల గొడుగుకు చిల్లులు!",
        teluguPunchline: "ధరల వర్షంలో సామాన్యుడు తడుస్తుంటే, పాలకులు కాగితపు గొడుగు చూపిస్తున్నారు!",
        visualPrompt: "A funny caricature of a pompous official holding a tiny paper umbrella over an Indian common man soaked in pouring rain"
    }, "Telangana");
    assert.equal(validTS.valid, true);
});

test("sanitizeForCaricatureImagePrompt strips real politician names, parties, quotes, and safety trigger words", () => {
    const unsafe = `Chandrababu Naidu and Revanth Reddy arguing about TDP Congress election corruption scam saying "Free promises!" during a demolition protest`;
    const sanitized = sanitizeForCaricatureImagePrompt(unsafe);

    assert.equal(/chandrababu|revanth|tdp|congress|election|corruption|scam|demolition|protest/i.test(sanitized), false);
    assert.equal(sanitized.includes("Free promises"), false);
    assert.ok(sanitized.includes("cartoon official") || sanitized.includes("cartoon leader"));

    const primaryPrompt = buildCaricatureImagePrompt(unsafe, "primary");
    assert.ok(primaryPrompt.includes("caricature"));
    assert.ok(primaryPrompt.includes("STRICTLY ZERO TEXT"));

    const fallbackPrompt = buildCaricatureImagePrompt(unsafe, "ultra_safe");
    assert.ok(fallbackPrompt.includes("comic caricature"));
    assert.ok(fallbackPrompt.includes("NO speech bubbles"));

    const guaranteedTS = getGuaranteedSafeCaricaturePrompt("Telangana");
    assert.ok(guaranteedTS.includes("Deccan city"));
    assert.ok(guaranteedTS.includes("common man caricature"));
});
