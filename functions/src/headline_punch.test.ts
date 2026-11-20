/**
 * Unit Tests for Punch-Style Telugu Headlines (Reporter News, Questioning & Grief/Pain Stories)
 * Run with: npx --yes tsx --test functions/src/headline_punch.test.ts
 */

import test, { before } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

// Stub optional native 'sharp' binary if absent in lightweight test environments
const originalLoad = (Module as any)._load;
(Module as any)._load = function (request: string, parent: any, isMain: boolean) {
    if (request === "sharp") {
        try {
            return originalLoad.call(this, request, parent, isMain);
        } catch {
            return () => ({});
        }
    }
    return originalLoad.call(this, request, parent, isMain);
};

let cleanTeluguHeadline: typeof import("./utils").cleanTeluguHeadline;
let isEditorialVerdictOrFlattery: typeof import("./utils").isEditorialVerdictOrFlattery;
let isTeluguScript: typeof import("./utils").isTeluguScript;
let CANONICAL_HEADLINE_RULE: typeof import("./geminiService").CANONICAL_HEADLINE_RULE;
let REPORTER_PUNCH_HEADLINE_RULE: typeof import("./geminiService").REPORTER_PUNCH_HEADLINE_RULE;
let buildHeadlineRefinementPrompt: typeof import("./geminiService").buildHeadlineRefinementPrompt;
let getCategorySystemInstruction: typeof import("./categories").getCategorySystemInstruction;

before(async () => {
    const utils = await import("./utils");
    const gemini = await import("./geminiService");
    const categories = await import("./categories");

    cleanTeluguHeadline = utils.cleanTeluguHeadline;
    isEditorialVerdictOrFlattery = utils.isEditorialVerdictOrFlattery;
    isTeluguScript = utils.isTeluguScript;
    CANONICAL_HEADLINE_RULE = gemini.CANONICAL_HEADLINE_RULE;
    REPORTER_PUNCH_HEADLINE_RULE = gemini.REPORTER_PUNCH_HEADLINE_RULE;
    buildHeadlineRefinementPrompt = gemini.buildHeadlineRefinementPrompt;
    getCategorySystemInstruction = categories.getCategorySystemInstruction;
});

test("cleanTeluguHeadline preserves trailing '?' on punchy questioning Telugu headlines", () => {
    const input = "గుంతల రోడ్లపై ప్రాణాలు పోతేనే అధికారులు కళ్లు తెరుస్తారా?";
    assert.equal(cleanTeluguHeadline(input), input);
});

test("cleanTeluguHeadline normalizes multiple trailing question marks or mixed '?!' to a single '?'", () => {
    assert.equal(
        cleanTeluguHeadline("నెలలుగా తాగునీరు లేకున్నా పాలకులకు కనిపించడం లేదా???"),
        "నెలలుగా తాగునీరు లేకున్నా పాలకులకు కనిపించడం లేదా?"
    );
    assert.equal(
        cleanTeluguHeadline("పంట నష్టపోయిన అన్నదాతలను ఆదుకునే దిక్కెవరు?! "),
        "పంట నష్టపోయిన అన్నదాతలను ఆదుకునే దిక్కెవరు?"
    );
    assert.equal(
        cleanTeluguHeadline("ప్రజల గోడు అధికారులకు వినిపించడం లేదా ?"),
        "ప్రజల గోడు అధికారులకు వినిపించడం లేదా?"
    );
});

test("cleanTeluguHeadline strips quotes, colons, dashes, and trailing periods/exclamation marks while keeping '?'", () => {
    assert.equal(
        cleanTeluguHeadline(`"రైతుల ఆక్రందన: పాలకులకు కనిపించడం లేదా?"`),
        "రైతుల ఆక్రందన పాలకులకు కనిపించడం లేదా?"
    );
    assert.equal(
        cleanTeluguHeadline("సకాలంలో వైద్యం అందక కళ్లెదుటే ఆరిపోయిన పసిప్రాణం."),
        "సకాలంలో వైద్యం అందక కళ్లెదుటే ఆరిపోయిన పసిప్రాణం"
    );
    assert.equal(
        cleanTeluguHeadline("ఆరుగాలం శ్రమ నీళ్లపాలై కన్నీరుమున్నీరవుతున్న అన్నదాతలు!"),
        "ఆరుగాలం శ్రమ నీళ్లపాలై కన్నీరుమున్నీరవుతున్న అన్నదాతలు"
    );
});

test("cleanTeluguHeadline strips leading question marks and returns empty string for punctuation-only input", () => {
    assert.equal(
        cleanTeluguHeadline("?? గుంతల రోడ్లపై అధికారుల నిర్లక్ష్యం"),
        "గుంతల రోడ్లపై అధికారుల నిర్లక్ష్యం"
    );
    assert.equal(cleanTeluguHeadline("???"), "");
    assert.equal(cleanTeluguHeadline("   ?  "), "");
});

test("CANONICAL_HEADLINE_RULE enforces punch style, meaning preservation, questioning, and grief/pain", () => {
    assert.match(CANONICAL_HEADLINE_RULE, /పంచ్ స్టైల్/);
    assert.match(CANONICAL_HEADLINE_RULE, /భావం/);
    assert.match(CANONICAL_HEADLINE_RULE, /ప్రశ్నించే/);
    assert.match(CANONICAL_HEADLINE_RULE, /బాధ/);
    assert.match(CANONICAL_HEADLINE_RULE, /\?/);
});

test("getCategorySystemInstruction embeds updated CANONICAL_HEADLINE_RULE", () => {
    const sysPrompt = getCategorySystemInstruction();
    assert.ok(sysPrompt.includes(CANONICAL_HEADLINE_RULE));
    assert.ok(sysPrompt.includes("పంచ్ స్టైల్"));
});

test("buildHeadlineRefinementPrompt activates REPORTER_PUNCH_HEADLINE_RULE and preserves reporter headline for reporter posts", () => {
    const result = buildHeadlineRefinementPrompt(
        "వర్షాలతో పంట నష్టపోయి రైతులు తీవ్ర ఆవేదన వ్యక్తం చేస్తున్నారు.",
        "రమేష్",
        undefined,
        {
            isReporter: true,
            originalHeadline: "పంట నష్టంతో రైతుల కన్నీరు"
        }
    );

    assert.ok(result.systemInstruction.includes(CANONICAL_HEADLINE_RULE));
    assert.ok(result.systemInstruction.includes(REPORTER_PUNCH_HEADLINE_RULE));
    assert.ok(result.userPrompt.includes("రిపోర్టర్ పంపిన అసలు శీర్షిక: పంట నష్టంతో రైతుల కన్నీరు"));
    assert.ok(result.userPrompt.includes("పంచ్ స్టైల్"));
    assert.ok(result.userPrompt.includes("భావం"));
    assert.equal(result.temperature, 0.5);
});

test("buildHeadlineRefinementPrompt keeps standard non-reporter prompt clean when isReporter is omitted", () => {
    const result = buildHeadlineRefinementPrompt(
        "రాష్ట్రంలో కొత్త మెట్రో మార్గానికి అనుమతి లభించింది."
    );

    assert.ok(result.systemInstruction.includes(CANONICAL_HEADLINE_RULE));
    assert.ok(!result.systemInstruction.includes(REPORTER_PUNCH_HEADLINE_RULE));
    assert.ok(!result.userPrompt.includes("రిపోర్టర్ పంపిన అసలు శీర్షిక"));
    assert.equal(result.temperature, 0.4);
});

test("valid punch headlines pass script, word-count, and flattery safeguards with zero false positives", () => {
    const validPunchHeadlines = [
        "గుంతల రోడ్లపై ప్రాణాలు పోతేనే అధికారులు కళ్లు తెరుస్తారా?",
        "నెలలుగా తాగునీరు లేకున్నా పాలకులకు కనిపించడం లేదా?",
        "సకాలంలో వైద్యం అందక కళ్లెదుటే ఆరిపోయిన పసిప్రాణం",
        "ఆరుగాలం శ్రమ నీళ్లపాలై కన్నీరుమున్నీరవుతున్న అన్నదాతలు",
        "అప్పుల భారం మోయలేక ఆగిపోయిన అన్నదాత గుండె"
    ];

    for (const headline of validPunchHeadlines) {
        const cleaned = cleanTeluguHeadline(headline);
        const wordCount = cleaned.split(/\s+/).filter(Boolean).length;

        assert.equal(cleaned, headline);
        assert.equal(isTeluguScript(cleaned), true);
        assert.ok(wordCount >= 4 && wordCount <= 12, `Unexpected word count ${wordCount} for: ${cleaned}`);
        assert.equal(isEditorialVerdictOrFlattery(cleaned, cleaned), false);
    }

    // Zero regression: actual unattributed flattery slogans are still rejected
    assert.equal(isEditorialVerdictOrFlattery("పేదల పెన్నిధిగా నిలిచిన స్థానిక నాయకుడు"), true);
});
