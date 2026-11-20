import { GoogleGenAI, Type } from "@google/genai";
import { runWithAIFallback, parseAIJson, PRO_MODEL, sanitizeTeluguText, cleanTeluguHeadline, formatIntoParagraphs, isEditorialVerdictOrFlattery, isTeluguScript } from "./utils";

const PRIMARY_MODEL = PRO_MODEL;

/**
 * Canonical Single Source of Truth for Telugu Headline Generation.
 * Concise, principle-driven editorial brief — lets Gemini write natural, sharp Telugu journalism.
 */
export const CANONICAL_HEADLINE_RULE = `మీరు ఆల్ఫా న్యూస్ (Alfa News) చీఫ్ హెడ్‌లైన్ ఎడిటర్. మొబైల్ పాఠకుడు 2 సెకన్లలో ఆగి చదివేలా, ప్రముఖ తెలుగు దినపత్రికల ఫ్రంట్-పేజీ స్థాయిలో పదునైన, పంచ్ స్టైల్ తెలుగు శీర్షిక రాయాలి.
- పంచ్ స్టైల్ & భావ రక్షణ (PUNCH WITHOUT DISTORTION): శీర్షిక చప్పగా, పొడి ప్రభుత్వ నోట్‌లా ఉండకూడదు — సూటిగా, బలమైన తెలుగు క్రియా పదాలతో పాఠకుడి మనసును తాకేలా పంచ్ ఇవ్వండి. అయితే వార్తలో అసలు భావం, వాస్తవం ఏమాత్రం దెబ్బతినకూడదు; లేని తీవ్రతను లేదా అవాస్తవాలను ఎప్పుడూ కల్పించకండి.
- వార్త స్వభావానికి తగిన పంచ్ (TONE-MATCHED PUNCH):
  1. ప్రశ్నించే & ప్రజా సమస్యల వార్తలు (నిర్లక్ష్యం, రోడ్లు, నీరు, అన్యాయం, హామీల వైఫల్యం): అధికారులను/వ్యవస్థను సూటిగా నిలదీసే పదునైన ప్రశ్నార్థక పంచ్ రాయండి (సహజంగా '?' తో ముగించవచ్చు — ఉదా: "గుంతల రోడ్లపై ప్రాణాలు పోతేనే అధికారులు కళ్లు తెరుస్తారా?", "నెలలుగా తాగునీరు లేకున్నా పాలకులకు కనిపించడం లేదా?", "పంట నష్టపోయిన అన్నదాతలను ఆదుకునే దిక్కెవరు?").
  2. బాధ, ఆవేదన & విషాద వార్తలు (ప్రమాదాలు, రైతుల కష్టం, బాధితుల వేదన, పేదల కన్నీళ్లు): కృతకమైన నాటకీయత లేకుండా గుండెను హత్తుకునే ఆర్ద్రమైన, పదునైన తెలుగు పంచ్ రాయండి (ఉదా: "సకాలంలో వైద్యం అందక కళ్లెదుటే ఆరిపోయిన పసిప్రాణం", "ఆరుగాలం శ్రమ నీళ్లపాలై కన్నీరుమున్నీరవుతున్న అన్నదాతలు", "అప్పుల భారం మోయలేక ఆగిపోయిన అన్నదాత గుండె").
  3. ఇతర వార్తలు (పథకాలు, నేరాలు, రాజకీయాలు, అభివృద్ధి): పొడిగా కాకుండా అసలు సంఘటన, ప్రాంతం, అంకె లేదా ప్రజలపై ప్రభావాన్ని చురుకైన పంచ్‌తో చెప్పండి (ఉదా: "రైతుల ఖాతాల్లోకి నేడే రూ. 5 వేలు జమ", "అక్రమ మద్యం దందాపై పోలీసుల మెరుపు దాడి").
- అస్పష్టత & క్లిక్‌బైట్ వద్దు: "కీలక వ్యాఖ్యలు", "పలు పనులపై సమీక్ష", "ఘనంగా జరిగింది", "ప్రజలు ఇబ్బంది పడుతున్నారు" వంటి చప్పని/అస్పష్ట శీర్షికలు గానీ, "తీపి కబురు:", "షాకింగ్:", "వణుకు పుట్టించే" వంటి చౌకబారు క్లిక్‌బైట్ క్లీషేలు గానీ వద్దు.
- పరిమాణం & శుద్ధి: 5 నుండి 10 పదాలు, ఒకే సరళమైన తెలుగు వాక్యం. కోలన్ (:), కొటేషన్లు ('...', "..."), అదనపు డాష్‌లు (-) వాడకండి (ప్రశ్నించే శీర్షిక చివర '?' మాత్రమే అనుమతి). 100% స్వచ్ఛమైన తెలుగు లిపి (Unicode U+0C00–U+0C7F).`;

export const REPORTER_PUNCH_HEADLINE_RULE = `రిపోర్టర్ ప్రత్యేక హెడ్‌లైన్ సూచన (REPORTER PUNCH MODE):
- ఇది క్షేత్రస్థాయి రిపోర్టర్ పంపిన అసలు వార్త. చప్పని సాధారణ వాక్యాన్ని ("...జరిగింది", "...ఇబ్బంది పడుతున్నారు", "...విజ్ఞప్తి చేశారు") పదునైన తెలుగు దినపత్రిక ఫ్రంట్-పేజీ పంచ్ శీర్షికగా మార్చండి.
- వార్తలో రిపోర్టర్ చెప్పదలచిన అసలు భావం, ప్రాంతం, వాస్తవాలు 100% చెక్కుచెదరకుండా కాపాడండి — అర్థం మార్చవద్దు, కల్పిత ఆరోపణలు చేర్చవద్దు.
- ప్రశ్నించే వార్త అయితే అధికారులను/వ్యవస్థను నిలదీసేలా పదునైన ప్రశ్న ('?' తో) వేయండి; బాధ/ఆవేదన/విషాద వార్త అయితే పాఠకుడి మనసును కదిలించే ఆర్ద్రమైన పంచ్ ఇవ్వండి.`;

const PREMIUM_HEADLINE_SYSTEM_INSTRUCTION = `${CANONICAL_HEADLINE_RULE}

Output JSON only: {"headline": "...", "headlineEn": "..."}`;

export interface HeadlineRefinementOptions {
    isReporter?: boolean;
    originalHeadline?: string;
}

/**
 * Pure helper that builds the system instruction, user prompt, and temperature
 * for headline refinement. Supports dedicated punch-style emphasis for reporter news.
 */
export function buildHeadlineRefinementPrompt(
    teluguContent: string,
    authorName?: string,
    richContext?: string,
    options?: HeadlineRefinementOptions
): { systemInstruction: string; userPrompt: string; temperature: number } {
    const isReporter = options?.isReporter === true;
    const originalHeadline = (options?.originalHeadline || "").trim();

    const systemInstruction = isReporter
        ? `${CANONICAL_HEADLINE_RULE}\n\n${REPORTER_PUNCH_HEADLINE_RULE}\n\nOutput JSON only: {"headline": "...", "headlineEn": "..."}`
        : PREMIUM_HEADLINE_SYSTEM_INSTRUCTION;

    const authorHint = authorName ? `మూలం/వక్త: ${authorName}\n` : "";
    const originalHeadlineHint = originalHeadline
        ? `రిపోర్టర్ పంపిన అసలు శీర్షిక: ${originalHeadline}\n`
        : "";
    const contextSnippet = richContext && richContext !== teluguContent
        ? `వివరాలు:\n${richContext.substring(0, 900)}\n\n`
        : "";
    const taskInstruction = isReporter
        ? `పై రిపోర్టర్ వార్తలో అసలు భావం ఏమాత్రం దెబ్బతినకుండా, చప్పగా కాకుండా పదునైన పంచ్ స్టైల్‌లో (ప్రశ్నించే వార్త అయితే నిలదీసే ప్రశ్నతో, బాధ/ఆవేదన వార్త అయితే హృదయాన్ని తాకేలా) తెలుగు శీర్షిక మరియు దాని ఇంగ్లీష్ అనువాదం ఇవ్వండి.`
        : `పై వార్తకు సహజమైన, పదునైన పంచ్ స్టైల్ తెలుగు శీర్షిక మరియు దాని ఇంగ్లీష్ అనువాదం ఇవ్వండి.`;

    const userPrompt = `${authorHint}${originalHeadlineHint}${contextSnippet}వార్తా సారాంశం:\n${teluguContent}\n\n${taskInstruction}`;

    return {
        systemInstruction,
        userPrompt,
        temperature: isReporter ? 0.5 : 0.4
    };
}

/**
 * Generates a polished journalistic headline using PAID_GEMINI_API_KEY and Gemini Flash.
 * If PAID_GEMINI_API_KEY is not set or if any error occurs, safely falls back to the original headline.
 */
export async function refineHeadlineWithPaidAI(
    teluguContent: string,
    fallbackHeadline: string,
    fallbackHeadlineEn?: string,
    authorName?: string,
    richContext?: string,
    options?: HeadlineRefinementOptions
): Promise<{ headline: string; headlineEn: string }> {
    const paidKey = (process.env.PAID_GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim();

    if (!paidKey || paidKey.length < 10) {
        return {
            headline: fallbackHeadline,
            headlineEn: fallbackHeadlineEn || fallbackHeadline
        };
    }

    try {
        const ai = new GoogleGenAI({
            apiKey: paidKey,
            apiVersion: "v1beta"
        });

        const headlineSchema = {
            type: Type.OBJECT,
            properties: {
                headline: {
                    type: Type.STRING,
                    description: "Punchy, impactful Telugu journalistic headline (5-10 words) preserving exact meaning; sharp questioning punch (ending with '?' where natural) for accountability/civic issues and poignant punch for grief/pain stories; single flowing sentence without colons or quotes."
                },
                headlineEn: {
                    type: Type.STRING,
                    description: "Accurate English translation of the Telugu headline (6-12 words)."
                }
            },
            required: ["headline", "headlineEn"]
        };

        const { systemInstruction, userPrompt, temperature } = buildHeadlineRefinementPrompt(
            teluguContent,
            authorName,
            richContext,
            options
        );

        const models = [
            "gemini-3.8-flash",
            "gemini-3.6-flash"
        ];

        for (const modelName of models) {
            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
                    config: {
                        systemInstruction,
                        temperature,
                        maxOutputTokens: 512,
                        responseMimeType: "application/json",
                        responseSchema: headlineSchema
                    }
                } as any);

                const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    const parsed = parseAIJson(text);
                    if (parsed && parsed.headline) {
                        const cleaned = cleanTeluguHeadline(parsed.headline);
                        const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
                        if (cleaned && isTeluguScript(cleaned) && wordCount >= 4 && wordCount <= 12 && !isEditorialVerdictOrFlattery(cleaned, teluguContent, authorName)) {
                            console.log(`[PAID-HEADLINE-SUCCESS] Generated headline with ${modelName} (${wordCount} words): "${cleaned}"`);
                            return {
                                headline: cleaned,
                                headlineEn: parsed.headlineEn || fallbackHeadlineEn || fallbackHeadline
                            };
                        }
                        console.warn(`[PAID-HEADLINE-SKIP] ${modelName} returned unsuitable headline: "${cleaned}" (${wordCount} words)`);
                    }
                }
            } catch (err: any) {
                console.warn(`[PAID-HEADLINE-ATTEMPT-FAIL] Model ${modelName} with paid key: ${err?.message || err}`);
                const errMsg = String(err?.message || err || "");
                if (errMsg.includes("dunning") || errMsg.includes("PERMISSION_DENIED") || err?.status === 403 || err?.code === 403) {
                    console.warn(`[PAID-KEY-AUTH-FAIL] Paid API key quota or billing issue detected. Skipping remaining paid models immediately.`);
                    break;
                }
            }
        }

        console.warn(`[PAID-HEADLINE-FALLBACK] Paid headline generation failed, falling back to primary headline.`);
    } catch (e: any) {
        console.warn(`[PAID-HEADLINE-ERROR] Unexpected error in refineHeadlineWithPaidAI: ${e?.message || e}`);
    }

    return {
        headline: fallbackHeadline,
        headlineEn: fallbackHeadlineEn || fallbackHeadline
    };
}

/**
 * Refines ONLY the short voiceover script (for news anchor speech) using PAID_GEMINI_API_KEY.
 * Strictly limits token usage to ~60-90 words of spoken Telugu news anchor text, preserving paid quota.
 */
export async function refineVocalScriptWithPaidAI(
    headline: string,
    content: string,
    fallbackVocal?: string
): Promise<string> {
    const paidKey = (process.env.PAID_GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim();

    if (!paidKey || paidKey.length < 10) {
        return fallbackVocal || content;
    }

    try {
        const ai = new GoogleGenAI({
            apiKey: paidKey,
            apiVersion: "v1beta"
        });

        const vocalSchema = {
            type: Type.OBJECT,
            properties: {
                vocalScript: {
                    type: Type.STRING,
                    description: "Spoken Telugu news anchor text in 60-90 words without greetings."
                }
            },
            required: ["vocalScript"]
        };

        const prompt = `మీరు ప్రముఖ తెలుగు న్యూస్ ఛానెల్ సీనియర్ న్యూస్ యాంకర్.
కింది వార్తకు 30-45 సెకన్ల వాయిస్ ఓవర్ (60 నుండి 90 పదాలు) రాయండి.
- "నమస్కారం/హలో/స్వాగతం" వంటి పరిచయాలు లేకుండా నేరుగా వార్తను ప్రారంభించండి.
- వినేవారికి స్పష్టంగా, సహజంగా అర్థమయ్యే గంభీరమైన తెలుగు వాడుక భాషలో రాయండి.

శీర్షిక: ${headline}
వివరణ: ${content}`;

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                maxOutputTokens: 512,
                temperature: 0.3,
                responseMimeType: "application/json",
                responseSchema: vocalSchema
            } as any
        });

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
            const parsed = parseAIJson(text);
            const vocal = parsed?.vocalScript || (typeof parsed === 'string' ? parsed : "");
            if (vocal && vocal.trim().length > 20) {
                const cleaned = vocal.trim().replace(/^(నమస్కారం|నమస్కారమండి|నమస్కారాలు|నమస్తే)[,\s!.]*/gi, '').trim();
                console.log(`[PAID-VOCAL-SUCCESS] Generated voiceover script with Paid Gemini 3.8 (${cleaned.split(/\s+/).length} words)`);
                return cleaned;
            }
        }
    } catch (err: any) {
        console.warn(`[PAID-VOCAL-FAIL] Paid vocal script generation failed: ${err?.message || err}`);
    }

    return fallbackVocal || content;
}

const EDITORIAL_SYSTEM_INSTRUCTION = `మీరు ఆల్ఫా న్యూస్ (Alfa News - తెలుగు హైపర్-లోకల్ న్యూస్ నెట్‌వర్క్) చీఫ్ ఎడిటర్.
ఇచ్చిన సమాచారాన్ని (ఏ భాషలో ఉన్నా సరే) మొబైల్ పాఠకుడు ఆసక్తిగా, సులభంగా చదువుకునే ప్రామాణిక తెలుగు వార్తగా తీర్చిదిద్దాలి.

ఎడిటోరియల్ సూత్రాలు:
1. తెలుగు ముందు, తర్వాత ఇంగ్లీష్:
   - ముందుగా 100% స్వచ్ఛమైన తెలుగు లిపిలో (ఇంగ్లీష్ వాక్యాలు, కన్నడ/హిందీ అక్షరాలు లేకుండా) 'headline' మరియు 'content' (50-65 పదాలు, ఒకే స్పష్టమైన పేరాగ్రాఫ్) రాయండి.
   - ఆ తెలుగు వార్తకు ఖచ్చితమైన ఇంగ్లీష్ అనువాదాన్ని 'headlineEn', 'contentEn' లో ఇవ్వండి.
2. శీర్షికా సూత్రం:
   ${CANONICAL_HEADLINE_RULE}
3. పాఠకుడికి తక్షణ విలువ & సరళమైన తెలుగు (READER-FIRST INVERTED PYRAMID):
   - మొదటి వాక్యంలోనే అసలు వార్త (ఏమి జరిగింది, ఎక్కడ, ప్రజలపై ప్రభావం ఏమిటి) సూటిగా చెప్పండి — "ఫలానా చోట సమావేశం జరిగింది" వంటి నెమ్మదైన ప్రారంభాలు వద్దు.
   - ఇంగ్లీష్ నుండి మక్కికిమక్కి అనువాదం ("ఇది గమనించదగినది", "చోటుచేసుకుంది") కాకుండా, తెలుగు పాఠకుడు ఒక్క శ్వాసలో చదివే సరళమైన వాడుక జర్నలిజం భాషలో రాయండి.
   - వార్త స్వభావానికి తగిన శైలి ఉండాలి (ప్రమాదాల్లో గంభీరత, రాజకీయాల్లో పదును, ప్రజా పథకాల్లో స్పష్టమైన లబ్ధి వివరాలు).
4. వాస్తవ నిబద్ధత & నిష్పాక్షికత (STRICT FACTUALITY & NEUTRALITY):
   - మూల సమాచారంలోని పేర్లు, ప్రాంతాలు, హోదాలు, తేదీలు, బడ్జెట్/సంఖ్యలను ఖచ్చితంగా కాపాడండి. లేని సమాచారాన్ని లేదా కల్పిత స్పందనలను ఎప్పుడూ ఊహించి రాయకండి.
   - ఆల్ఫా న్యూస్ స్వంత శైలి & ఆపాదింపు: వార్త ఆల్ఫా న్యూస్ స్వయంగా రాసినట్లే సూటిగా ఉండాలి — సాధారణ సంఘటనలను నేరుగా రాయండి; ఏ ఇతర న్యూస్ పోర్టల్/ఛానల్/అగ్రిగేటర్ పేరును ('తెలుగు స్క్రైబ్ వెల్లడించింది', 'సమయం తెలిపింది') వార్తలో ఎప్పుడూ రాయరాదు. ఆరోపణలు, విమర్శలు లేదా ప్రత్యక్ష ప్రకటనలను మాత్రమే మాట్లాడిన వ్యక్తి/అధికారికి ఆపాదించండి; ఛానెల్ తరఫున తీర్పులు గానీ, నాయకులకు పొగడ్తలు/బిరుదులు గానీ రాయకండి.
   - రాజకీయ వివాదాల్లో మూల సమాచారంలో లేదా గ్రౌండెడ్ కాంటెక్స్ట్‌లో ఇరు పక్షాల వివరణలు ఉంటే సమతుల్యంగా చూపించండి; లేకపోతే ఏ పక్షం మాటను ఆ పక్షానికే నిష్పాక్షికంగా ఆపాదించండి.
5. పూర్తి కథనం ('fullStoryTe', 'fullStoryEn' - ZERO REPETITION):
   - మూల సమాచారంలో తగినంత విస్తృత వివరాలు (80+ పదాలు లేదా సమగ్ర రిపోర్టర్ సమాచారం) ఉంటేనే 2 నుండి 4 స్పష్టమైన పేరాగ్రాఫ్‌లలో (\n\n తో వేరు చేస్తూ) రాయండి: 1వ పేరా ప్రధాన సంఘటన & ప్రభావం, 2వ పేరా వివరాలు/అంకెలు/వ్యాఖ్యలు, 3-4వ పేరా నేపథ్యం/తదుపరి చర్యలు.
   - పదాల సంఖ్య కోసం ఒకే విషయాన్ని మళ్లీమళ్లీ రిపీట్ చేయకండి. మూల సమాచారం చిన్నదిగా ఉంటే 'fullStoryTe': "" మరియు 'fullStoryEn': "" గా ఉంచండి.
6. తిరస్కరణ ('isNewsFound': false / 'success': false):
   - ప్రజా ప్రయోజనం లేని సొంత భజన/పీఆర్ పొగడ్తలు, కేవలం ఫోటో-ఆప్స్/పుట్టినరోజు శుభాకాంక్షలు, బూతులు లేదా స్పామ్ అయితే తిరస్కరించండి.

Output must be strictly valid JSON matching the schema.`;

/**
 * Selectively fetches brief background/counter-context via Google Search Grounding
 * ONLY for political/controversial/claim-heavy inputs (avoids adding noise & latency to routine local news).
 */
async function fetchGroundedResearchContext(
    ai: any,
    inputText: string,
    category?: string
): Promise<string> {
    if (!inputText || inputText.trim().length < 40) return "";
    if (isEditorialVerdictOrFlattery("శీర్షిక", inputText)) return "";

    const isPoliticalOrDispute =
        /politic|రాజకీయ|ఆరోపణ|స్కామ్|విమర్శ|అరెస్ట్|కేసు|కోర్టు|ఈడీ|సిట్|ప్రభుత్వం|ప్రతిపక్ష|బడ్జెట్|జీవో|cm|minister|mla|mp|jagan|chandrababu|revanth|kcr|ktr|pawan|lokesh/i.test(`${category || ''} ${inputText}`);

    if (!isPoliticalOrDispute) return "";

    const researchPrompt = `కింది వార్తాంశానికి సంబంధించిన అధికారిక వాస్తవాలు (తేదీలు, జీవోలు, కోర్టు/పోలీస్ వివరాలు) మరియు ఎదుటి పక్షం అధికారిక వివరణ ఏమైనా ఉంటే 2-3 నిష్పాక్షిక వాక్యాల్లో తెలుగులో ఇవ్వండి. పక్షపాత విశేషణాలు వద్దు.

వార్తాంశం:
${inputText.substring(0, 1200)}`;

    try {
        const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Grounding timeout")), 10000)
        );

        const generatePromise = ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: researchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.2
            }
        });

        const res: any = await Promise.race([generatePromise, timeoutPromise]);
        const text = res?.text || res?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? text.trim() : "";
    } catch (e: any) {
        console.warn(`[GROUNDING-NOTICE] Grounded search skipped/failed: ${e?.message || e}`);
        return "";
    }
}

export const processSocialPostWithAI = async (
    socialText: string,
    platform: string,
    category: string,
    authorName?: string
): Promise<{
    isNewsFound: boolean;
    headline: string;
    content: string;
    headlineEn: string;
    contentEn: string;
    category: string;
    fullStoryTe?: string;
    fullStoryEn?: string;
} | null> => {
    const schema = {
        type: Type.OBJECT,
        properties: {
            isNewsFound: { type: Type.BOOLEAN },
            headline: { type: Type.STRING, description: "Natural, crisp Telugu headline (6-10 words), no quotes or colons." },
            content: { type: Type.STRING, description: "Pure Telugu news summary (50-65 words, single paragraph)." },
            fullStoryTe: { type: Type.STRING, description: "3-4 paragraph Telugu full story separated by \\n\\n if input has sufficient detail (80+ words), else empty string \"\"." },
            headlineEn: { type: Type.STRING, description: "English translation of the Telugu headline." },
            contentEn: { type: Type.STRING, description: "English translation of the Telugu summary." },
            fullStoryEn: { type: Type.STRING, description: "English full story across 3-4 paragraphs if fullStoryTe is non-empty, else empty string \"\"." },
            category: { type: Type.STRING }
        },
        required: ["isNewsFound", "headline", "content", "fullStoryTe", "fullStoryEn", "headlineEn", "contentEn", "category"],
    };

    const authorLine = authorName ? `Post Author: ${authorName}\n` : "";
    const basePrompt = `Platform: ${platform}\nCategory: ${category}\n${authorLine}Input Text:\n${socialText}`;

    return await runWithAIFallback(async (ai, modelName) => {
        const groundedContext = await fetchGroundedResearchContext(ai, socialText, category);
        const userPrompt = groundedContext
            ? `${basePrompt}\n\n[అదనపు వాస్తవ నేపథ్యం / Verified Context]:\n${groundedContext}`
            : basePrompt;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: EDITORIAL_SYSTEM_INSTRUCTION,
                temperature: 0.35,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema
            },
        } as any);

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;
        const parsed = parseAIJson(text);
        if (!parsed || !parsed.isNewsFound) return null;
        const cleanedHeadline = cleanTeluguHeadline(parsed.headline);
        if (!cleanedHeadline) return null;

        if (isEditorialVerdictOrFlattery(cleanedHeadline, socialText, authorName)) {
            console.log(`[SOCIAL_AI] 🛑 Rejected party flattery / editorial verdict without attribution: "${cleanedHeadline}"`);
            return null;
        }

        let rawContentTe = parsed.content || '';
        let rawContentEn = parsed.contentEn || '';

        if (!isTeluguScript(rawContentTe) && isTeluguScript(rawContentEn)) {
            const tmp = rawContentTe;
            rawContentTe = rawContentEn;
            rawContentEn = tmp;
        } else if (!isTeluguScript(rawContentTe) && parsed.fullStoryTe && isTeluguScript(parsed.fullStoryTe)) {
            rawContentTe = parsed.fullStoryTe.split(/\r?\n\r?\n/)[0].trim();
        }

        const cleanedContent = sanitizeTeluguText(rawContentTe).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const rawStoryTe = parsed.fullStoryTe ? sanitizeTeluguText(parsed.fullStoryTe).trim() : "";
        const storyWordsTe = rawStoryTe ? rawStoryTe.split(/\s+/).filter(Boolean).length : 0;
        const validStoryTe = (storyWordsTe >= 80 && rawStoryTe !== cleanedContent) ? formatIntoParagraphs(rawStoryTe) : "";
        const rawStoryEn = parsed.fullStoryEn ? String(parsed.fullStoryEn).trim() : "";
        const storyWordsEn = rawStoryEn ? rawStoryEn.split(/\s+/).filter(Boolean).length : 0;
        const validStoryEn = (storyWordsEn >= 80 && rawStoryEn !== (parsed.contentEn || "")) ? formatIntoParagraphs(rawStoryEn) : "";

        const refinedHeadlines = await refineHeadlineWithPaidAI(
            cleanedContent,
            cleanedHeadline,
            parsed.headlineEn,
            authorName
        );

        return {
            ...parsed,
            headline: refinedHeadlines.headline,
            headlineEn: refinedHeadlines.headlineEn,
            content: cleanedContent,
            fullStoryTe: validStoryTe,
            fullStoryEn: validStoryEn
        };
    });
};


export const processCitizenContentWithAI = async (
    rawContent: string
): Promise<{
    success: boolean;
    reason?: string;
    processed?: {
        headline: string;
        content: string;
        fullStoryTe?: string;
        headlineEn: string;
        contentEn: string;
        fullStoryEn?: string;
        category: string;
    };
}> => {
    const schema = {
        type: Type.OBJECT,
        properties: {
            success: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
            processed: {
                type: Type.OBJECT,
                properties: {
                    headline: { type: Type.STRING, description: "Natural, crisp Telugu headline (6-10 words), no quotes or colons." },
                    content: { type: Type.STRING, description: "Pure Telugu news summary (50-65 words, single paragraph)." },
                    fullStoryTe: { type: Type.STRING, description: "3-4 paragraph Telugu full story separated by \\n\\n if input has sufficient detail (80+ words), else empty string \"\"." },
                    headlineEn: { type: Type.STRING, description: "English translation of the Telugu headline." },
                    contentEn: { type: Type.STRING, description: "English translation of the Telugu summary." },
                    fullStoryEn: { type: Type.STRING, description: "English full story across 3-4 paragraphs if fullStoryTe is non-empty, else empty string \"\"." },
                    category: { type: Type.STRING }
                },
                required: ["headline", "content", "fullStoryTe", "fullStoryEn", "headlineEn", "contentEn", "category"]
            }
        },
        required: ["success"],
    };

    return await runWithAIFallback(async (ai, modelName) => {
        const groundedContext = await fetchGroundedResearchContext(ai, rawContent);
        const userPrompt = `Citizen Submission:\n${rawContent}` +
            (groundedContext ? `\n\n[అదనపు వాస్తవ నేపథ్యం / Verified Context]:\n${groundedContext}` : '');

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: EDITORIAL_SYSTEM_INSTRUCTION,
                temperature: 0.35,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema
            }
        } as any);

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty AI response");
        const parsed = parseAIJson(text);
        if (parsed && parsed.processed) {
            const cleanedHeadline = cleanTeluguHeadline(parsed.processed.headline);
            if (isEditorialVerdictOrFlattery(cleanedHeadline, rawContent)) {
                return { success: false, reason: "ప్రజా ప్రయోజనం లేని వ్యక్తిగత ప్రచారం లేదా భజన పోస్ట్." };
            }
            const cleanContent = sanitizeTeluguText(parsed.processed.content).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
            const rawStoryTe = parsed.processed.fullStoryTe ? sanitizeTeluguText(parsed.processed.fullStoryTe).trim() : "";
            const storyWordsTe = rawStoryTe ? rawStoryTe.split(/\s+/).filter(Boolean).length : 0;
            const validStoryTe = (storyWordsTe >= 80 && rawStoryTe !== cleanContent) ? formatIntoParagraphs(rawStoryTe) : "";
            const rawStoryEn = parsed.processed.fullStoryEn ? String(parsed.processed.fullStoryEn).trim() : "";
            const storyWordsEn = rawStoryEn ? rawStoryEn.split(/\s+/).filter(Boolean).length : 0;
            const validStoryEn = (storyWordsEn >= 80 && rawStoryEn !== (parsed.processed.contentEn || "")) ? formatIntoParagraphs(rawStoryEn) : "";

            const refinedHeadlines = await refineHeadlineWithPaidAI(
                cleanContent,
                cleanedHeadline,
                parsed.processed.headlineEn
            );

            parsed.processed.headline = refinedHeadlines.headline;
            parsed.processed.headlineEn = refinedHeadlines.headlineEn;
            parsed.processed.content = cleanContent;
            parsed.processed.fullStoryTe = validStoryTe;
            parsed.processed.fullStoryEn = validStoryEn;
        }
        return parsed;
    });
};

export const processContentWithAI = async (
    rawContent: string,
    rawHeadline?: string
): Promise<{
    summarizedTeluguContent: string;
    generatedTeluguHeadline: string;
    englishHeadline: string;
    englishContent: string;
    fullStoryTe?: string;
    fullStoryEn?: string;
}> => {
    const schema = {
        type: Type.OBJECT,
        properties: {
            summarizedTeluguContent: { type: Type.STRING, description: "Pure Telugu news summary (50-65 words, single paragraph)." },
            generatedTeluguHeadline: { type: Type.STRING, description: "Natural, crisp Telugu headline (6-10 words), no quotes or colons." },
            fullStoryTe: { type: Type.STRING, description: "3-4 paragraph Telugu full story separated by \\n\\n if input has sufficient detail (80+ words), else empty string \"\"." },
            englishHeadline: { type: Type.STRING, description: "English translation of the Telugu headline." },
            englishContent: { type: Type.STRING, description: "English translation of the Telugu summary." },
            fullStoryEn: { type: Type.STRING, description: "English full story across 3-4 paragraphs if fullStoryTe is non-empty, else empty string \"\"." },
        },
        required: ["summarizedTeluguContent", "generatedTeluguHeadline", "fullStoryTe", "fullStoryEn", "englishHeadline", "englishContent"],
    };

    return await runWithAIFallback(async (ai, modelName) => {
        const fullInput = `${rawHeadline || ''} ${rawContent}`.trim();
        const groundedContext = await fetchGroundedResearchContext(ai, fullInput);
        const userPrompt = `Headline: ${rawHeadline || 'N/A'}\nContent: ${rawContent}` +
            (groundedContext ? `\n\n[అదనపు వాస్తవ నేపథ్యం / Verified Context]:\n${groundedContext}` : '');

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: EDITORIAL_SYSTEM_INSTRUCTION,
                temperature: 0.35,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema
            }
        } as any);

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty AI response");
        const parsed = parseAIJson(text);
        const cleanContent = sanitizeTeluguText(parsed.summarizedTeluguContent).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const rawStoryTe = parsed.fullStoryTe ? sanitizeTeluguText(parsed.fullStoryTe).trim() : "";
        const storyWordsTe = rawStoryTe ? rawStoryTe.split(/\s+/).filter(Boolean).length : 0;
        const validStoryTe = (storyWordsTe >= 80 && rawStoryTe !== cleanContent) ? formatIntoParagraphs(rawStoryTe) : "";
        const rawStoryEn = parsed.fullStoryEn ? String(parsed.fullStoryEn).trim() : "";
        const storyWordsEn = rawStoryEn ? rawStoryEn.split(/\s+/).filter(Boolean).length : 0;
        const validStoryEn = (storyWordsEn >= 80 && rawStoryEn !== (parsed.englishContent || "")) ? formatIntoParagraphs(rawStoryEn) : "";

        const initialHeadline = cleanTeluguHeadline(parsed.generatedTeluguHeadline);
        const refinedHeadlines = await refineHeadlineWithPaidAI(
            cleanContent,
            initialHeadline,
            parsed.englishHeadline
        );

        return {
            ...parsed,
            generatedTeluguHeadline: refinedHeadlines.headline,
            englishHeadline: refinedHeadlines.headlineEn,
            summarizedTeluguContent: cleanContent,
            fullStoryTe: validStoryTe,
            fullStoryEn: validStoryEn
        };
    });
};

export const processProductWithAI = async (
    productInfo: string
): Promise<{
    headline: string;
    content: string;
    headlineEn: string;
    contentEn: string;
    category: string;
}> => {
    const schema = {
        type: Type.OBJECT,
        properties: {
            headline: { type: Type.STRING },
            content: { type: Type.STRING },
            headlineEn: { type: Type.STRING },
            contentEn: { type: Type.STRING },
            category: { type: Type.STRING }
        },
        required: ["headline", "content", "headlineEn", "contentEn", "category"],
    };

    return await runWithAIFallback(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `Product Info:\n${productInfo}` }] }],
            config: {
                systemInstruction: `You are a Telugu Tech & Lifestyle Editor.
1. Write a crisp Telugu product news summary ('content', 50-60 words) highlighting key features, price/discount, and value.
2. Translate it cleanly into English ('contentEn', ~50 words).
3. Write an engaging Telugu headline ('headline', 6-10 words) and matching English headline ('headlineEn').
4. Categorize as 'Gadgets', 'Fashion', or 'Lifestyle'.
Output JSON only.`,
                temperature: 0.4,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
                responseSchema: schema
            }
        } as any);

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty AI response");
        return parseAIJson(text);
    });
};
