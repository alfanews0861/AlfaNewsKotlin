"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processProductWithAI = exports.processContentWithAI = exports.processCitizenContentWithAI = exports.processSocialPostWithAI = void 0;
const genai_1 = require("@google/genai");
const utils_1 = require("./utils");
const PRIMARY_MODEL = utils_1.PRO_MODEL;
const EDITORIAL_SYSTEM_INSTRUCTION = `మీరు ఆల్ఫా న్యూస్ (Alfa News - తెలుగు ప్రముఖ హైపర్-లోకల్ న్యూస్ నెట్‌వర్క్) కు చీఫ్ ఎడిటర్.
రిపోర్టర్లు/సోషల్ మీడియా/పౌరులు పంపే సమాచారాన్ని ప్రజలను ఆకట్టుకునేలా, జర్నలిస్టిక్ విలువలతో కూడిన ప్రామాణిక తెలుగు వార్తగా తీర్చిదిద్దాలి.

ముఖ్యమైన ఎడిటోరియల్ నిబంధనలు (CRITICAL EDITORIAL RULES):
1. సారాంశం (content / summarizedTeluguContent): కచ్చితంగా 60 నుండి 70 పదాల మధ్య ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్ (No multiple paragraphs, no newlines). వార్త పూర్తి మూల భావం, భావోద్వేగం ఏమాత్రం తగ్గకూడదు.
2. పూర్తి వార్తా కథనం (fullStoryTe): సీనియర్ ఎడిటర్ శైలిలో కనీసం 250 నుండి 320 పదాల సమగ్రమైన కథనం రాయాలి.
   - 3 నుండి 4 విడివిడి పేరాగ్రాఫ్‌లు తప్పనిసరి (STRICTLY 3-4 PARAGRAPHS SEPARATED BY \\n\\n):
     * ❌ ఒకే ముద్దగా (single clump) రాయరాదు!
     * ✅ ప్రతి పేరాగ్రాఫ్ మధ్య రెండు న్యూలైన్‌లు (\\n\\n) తప్పనిసరిగా ఉండాలి.
     * 1వ పేరా: ప్రధాన సారాంశం, కీలక ప్రకటన లేదా పంచ్ డైలాగ్, స్పష్టమైన ఆపాదింపుతో ప్రారంభం (~60-80 పదాలు).
     * 2వ పేరా: నేపథ్యం, సంఖ్యలు, కేటాయింపులు లేదా నిర్ణయాల పూర్వాపరాలు (~80-100 పదాలు).
     * 3వ పేరా: రాజకీయ విమర్శలు, సవాళ్లు, ప్రతిస్పందనలు లేదా ప్రజా సమస్య తీవ్రత (~70-90 పదాలు).
     * 4వ పేరా: ప్రస్తుత పరిస్థితి, రాబోయే పరిణామాలు, స్థానిక ప్రజల డిమాండ్లు లేదా చేపట్టాల్సిన చర్యలు (~50-70 పదాలు).
   - చిన్న ట్వీట్లు/వార్తలకు వివరాలు తక్కువగా ఉంటే లేనివి ఊహించరాదు (NO HALLUCINATIONS).

3. ⚠️ ఆపాదింపు తప్పనిసరి - మనమే తీర్పులు ఇవ్వరాదు (MANDATORY ATTRIBUTION - ZERO EDITORIAL VERDICTS) ⚠️:
   - ఆల్ఫా న్యూస్ నిష్పాక్షిక వార్తా సంస్థ. ఏ రాజకీయ నాయకుడు లేదా పార్టీ విమర్శలను మనమే ధ్రువీకరించినట్లు లేదా తీర్పు ఇచ్చినట్లు రాయకూడదు.
   - ఆరోపణలు, విమర్శలను కచ్చితంగా మాట్లాడిన వ్యక్తికి లేదా పార్టీకి ఆపాదించాలి (ఉదా: "...అన్న బీజేపీ", "...అంటూ వైసీపీ ధ్వజం").
   - "విశ్లేషకులు అంటున్నారు", "నివేదికలు స్పష్టం చేస్తున్నాయి" వంటి కల్పిత సమర్థనలు పూర్తిగా నిషిద్ధం.
   - ⚠️ CRITICAL - వ్యక్తుల మార్పిడి నిషిద్ధం (PERSON ATTRIBUTION SWAP - STRICTLY FORBIDDEN): పోస్ట్/ట్వీట్‌లో ఒకరి గురించి రాస్తూ మరొకరు చెప్పిన మాటలు, వ్యాఖ్యలు ఆ ఒకరికి ఆపాదించరాదు. ఉదా: "A గురించి రాసిన ట్వీట్‌లో B అన్నారు" అంటే - B మాట B కే చెందుతుంది, A కి కాదు. శీర్షికలో కూడా ఎవరు అన్నారో వారి పేరే వాడాలి.
   - ⚠️ SOCIAL MEDIA ATTRIBUTION RULE (CRITICAL): సోషల్ మీడియా పోస్ట్/ట్వీట్ ఆధారంగా వార్త రాసేటప్పుడు - input లో "Post Author" గా స్పష్టంగా ఇవ్వబడిన వ్యక్తి పేరుని వార్తలో మరియు headline లో తప్పనిసరిగా వాడాలి. "... అన్న [Author Name]", "... అని [Author Name] ట్వీట్ చేశారు", "... అంటూ [Author Name] ఆగ్రహం" వంటి ఆపాదింపు ఉండాలి. ఆ author చెప్పిన మాటలను మనమే fact గా confirm చేసినట్లు రాయరాదు - అది వారి వ్యక్తిగత అభిప్రాయం/ఆరోపణ మాత్రమే.

4. సందర్భానుసార శీర్షిక (CONTEXT-AWARE HEADLINE - STRICTLY 7-8 WORDS, ONE SINGLE CONTINUOUS SENTENCE):
   హెడ్‌లైన్ అన్ని వార్తలకూ ఒకేలా ఉండకూడదు! వార్త స్వభావాన్ని బట్టి సరైన శైలిని ఎంచుకోవాలి:
   - రాజకీయ విమర్శలు, సవాళ్లు, ప్రెస్ మీట్లు: ఘాటైన పంచ్ డైలాగ్ + స్పష్టమైన ఆపాదింపు (ఉదా: "ప్రజలను దగా చేశారంటూ కూటమి సర్కార్‌పై జగన్ తీవ్ర ఆగ్రహం").
   - రైతాంగ వ్యథ, పేదల కష్టాలు: హృదయాన్ని కదిలించే కరుణ రసం / కవితాత్మక రూపకాలు (ఉదా: "ఆశల పందిరి కూలి కన్నీటి సంద్రమైన అన్నదాత బతుకు చిత్రం").
   - ప్రమాదాలు, విపత్తులు: గంభీరమైన వాస్తవికత (కవిత్వాలు, పంచ్ డైలాగులు నిషిద్ధం! ఉదా: "నెత్తురోడిన జాతీయ రహదారిపై లారీ ఢీకొని నలుగురు దుర్మరణం").
   - ప్రభుత్వ పథకాలు, శుభవార్తలు: ఉత్తేజభరితమైన, సూటిగా ప్రయోజనాన్ని తెలిపే శైలి (ఉదా: "రైతుల ఖాతాల్లోకి నేడే రైతు భరోసా నిధుల జమ").
   - నేరాలు, దోపిడీలు: పదునైన క్రైమ్ రిపోర్టింగ్ (ఉదా: "సికింద్రాబాద్‌లో సినీ ఫక్కీలో భారీ దోపిడీ.. అంతర్రాష్ట్ర ముఠా అరెస్ట్").
   - నిబంధనలు: కచ్చితంగా 7 నుండి 8 పదాలు మాత్రమే, మొదటి నుండి చివరి వరకు ఒకే ఒక్క నిరంతర వాక్యం, కొటేషన్లు ('...', "...") మరియు కోలన్లు (:) పూర్తిగా నిషిద్ధం!

5. స్వచ్ఛమైన తెలుగు లిపి (NO FOREIGN SCRIPTS): కన్నడ, హిందీ/దేవనాగరి లిపి అక్షరాలు రాకూడదు. 100% తెలుగు లిపి వాడాలి.
6. ఇంగ్లీష్ పూర్తి కథనం (fullStoryEn): 200-250 words strictly across 3-4 paragraphs separated by \\n\\n.
Output must be strictly JSON format.`;
const processSocialPostWithAI = async (socialText, platform, category, authorName) => {
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            isNewsFound: { type: genai_1.Type.BOOLEAN },
            headline: { type: genai_1.Type.STRING },
            content: { type: genai_1.Type.STRING },
            fullStoryTe: { type: genai_1.Type.STRING, description: "Senior editor comprehensive full story in Telugu, at least 250-320 words across 3-4 paragraphs separated by \\n\\n" },
            headlineEn: { type: genai_1.Type.STRING },
            contentEn: { type: genai_1.Type.STRING },
            fullStoryEn: { type: genai_1.Type.STRING, description: "Senior editor full story in English, 200-250 words across 3-4 paragraphs separated by \\n\\n" },
            category: { type: genai_1.Type.STRING }
        },
        required: ["isNewsFound", "headline", "content", "fullStoryTe", "fullStoryEn", "headlineEn", "contentEn", "category"],
    };
    // Build the user prompt — include Post Author when available so AI can attribute correctly
    const authorLine = authorName ? `Post Author: ${authorName}\n` : "";
    const userPrompt = `Platform: ${platform}\nCategory: ${category}\n${authorLine}Input Text:\n${socialText}`;
    return await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: EDITORIAL_SYSTEM_INSTRUCTION,
                temperature: 0.4,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema,
                max_output_tokens: 4096
            },
        });
        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text)
            return null;
        const parsed = (0, utils_1.parseAIJson)(text);
        if (!parsed || !parsed.isNewsFound)
            return null;
        const cleanedContent = (0, utils_1.sanitizeTeluguText)(parsed.content).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const rawStoryTe = parsed.fullStoryTe ? (0, utils_1.sanitizeTeluguText)(parsed.fullStoryTe) : cleanedContent;
        const rawStoryEn = parsed.fullStoryEn ? String(parsed.fullStoryEn).trim() : (parsed.contentEn || "");
        return {
            ...parsed,
            headline: (0, utils_1.cleanTeluguHeadline)(parsed.headline),
            content: cleanedContent,
            fullStoryTe: (0, utils_1.formatIntoParagraphs)(rawStoryTe),
            fullStoryEn: (0, utils_1.formatIntoParagraphs)(rawStoryEn)
        };
    });
};
exports.processSocialPostWithAI = processSocialPostWithAI;
const processCitizenContentWithAI = async (rawContent) => {
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            success: { type: genai_1.Type.BOOLEAN },
            reason: { type: genai_1.Type.STRING },
            processed: {
                type: genai_1.Type.OBJECT,
                properties: {
                    headline: { type: genai_1.Type.STRING },
                    content: { type: genai_1.Type.STRING },
                    fullStoryTe: { type: genai_1.Type.STRING, description: "Senior editor full story in Telugu, at least 250-320 words across 3-4 paragraphs separated by \\n\\n" },
                    headlineEn: { type: genai_1.Type.STRING },
                    contentEn: { type: genai_1.Type.STRING },
                    fullStoryEn: { type: genai_1.Type.STRING, description: "Senior editor full story in English, 200-250 words across 3-4 paragraphs separated by \\n\\n" },
                    category: { type: genai_1.Type.STRING }
                },
                required: ["headline", "content", "fullStoryTe", "fullStoryEn", "headlineEn", "contentEn", "category"]
            }
        },
        required: ["success"],
    };
    return await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `Citizen Submission:\n${rawContent}` }] }],
            config: {
                systemInstruction: EDITORIAL_SYSTEM_INSTRUCTION,
                temperature: 0.4,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema,
                max_output_tokens: 4096
            }
        });
        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text)
            throw new Error("Empty AI response");
        const parsed = (0, utils_1.parseAIJson)(text);
        if (parsed && parsed.processed) {
            const cleanContent = (0, utils_1.sanitizeTeluguText)(parsed.processed.content).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
            const rawStoryTe = parsed.processed.fullStoryTe ? (0, utils_1.sanitizeTeluguText)(parsed.processed.fullStoryTe) : cleanContent;
            const rawStoryEn = parsed.processed.fullStoryEn ? String(parsed.processed.fullStoryEn).trim() : (parsed.processed.contentEn || "");
            parsed.processed.headline = (0, utils_1.cleanTeluguHeadline)(parsed.processed.headline);
            parsed.processed.content = cleanContent;
            parsed.processed.fullStoryTe = (0, utils_1.formatIntoParagraphs)(rawStoryTe);
            parsed.processed.fullStoryEn = (0, utils_1.formatIntoParagraphs)(rawStoryEn);
        }
        return parsed;
    });
};
exports.processCitizenContentWithAI = processCitizenContentWithAI;
const processContentWithAI = async (rawContent, rawHeadline) => {
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            summarizedTeluguContent: { type: genai_1.Type.STRING },
            generatedTeluguHeadline: { type: genai_1.Type.STRING },
            fullStoryTe: { type: genai_1.Type.STRING, description: "Senior editor comprehensive full story in Telugu, at least 250-320 words across 3-4 paragraphs separated by \\n\\n" },
            englishHeadline: { type: genai_1.Type.STRING },
            englishContent: { type: genai_1.Type.STRING },
            fullStoryEn: { type: genai_1.Type.STRING, description: "Senior editor full story in English, 200-250 words across 3-4 paragraphs separated by \\n\\n" },
        },
        required: ["summarizedTeluguContent", "generatedTeluguHeadline", "fullStoryTe", "fullStoryEn", "englishHeadline", "englishContent"],
    };
    return await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `Headline: ${rawHeadline || 'N/A'}\nContent: ${rawContent}` }] }],
            config: {
                systemInstruction: EDITORIAL_SYSTEM_INSTRUCTION,
                temperature: 0.4,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema,
                max_output_tokens: 4096
            }
        });
        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text)
            throw new Error("Empty AI response");
        const parsed = (0, utils_1.parseAIJson)(text);
        const cleanContent = (0, utils_1.sanitizeTeluguText)(parsed.summarizedTeluguContent).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const rawStoryTe = parsed.fullStoryTe ? (0, utils_1.sanitizeTeluguText)(parsed.fullStoryTe) : cleanContent;
        const rawStoryEn = parsed.fullStoryEn ? String(parsed.fullStoryEn).trim() : (parsed.englishContent || "");
        return {
            ...parsed,
            generatedTeluguHeadline: (0, utils_1.cleanTeluguHeadline)(parsed.generatedTeluguHeadline),
            summarizedTeluguContent: cleanContent,
            fullStoryTe: (0, utils_1.formatIntoParagraphs)(rawStoryTe),
            fullStoryEn: (0, utils_1.formatIntoParagraphs)(rawStoryEn)
        };
    });
};
exports.processContentWithAI = processContentWithAI;
const processProductWithAI = async (productInfo) => {
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            headline: { type: genai_1.Type.STRING },
            content: { type: genai_1.Type.STRING },
            headlineEn: { type: genai_1.Type.STRING },
            contentEn: { type: genai_1.Type.STRING },
            category: { type: genai_1.Type.STRING }
        },
        required: ["headline", "content", "headlineEn", "contentEn", "category"],
    };
    return await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `Product Info:\n${productInfo}` }] }],
            config: {
                systemInstruction: `You are a Tech & Lifestyle Reporter.
            1. Convert the provided product information into an exciting news story in Telugu (content) of STRICTLY 50 to 60 words total. Focus on the value, features, or a massive discount.
            2. Write a professional news paragraph in English (contentEn) maximum 50 words.
            3. Generate an eye-catching Telugu headline (headline) maximum 10 words.
            4. Generate a professional English headline (headlineEn) maximum 12 words.
            5. Categorize this as 'Gadgets', 'Fashion', or 'Lifestyle'.
            Output JSON only.`,
                temperature: 0.5,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
                responseSchema: schema,
                // Safety
                system_instruction: `You are a Tech & Lifestyle Reporter. ...`,
                max_output_tokens: 2048
            }
        });
        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text)
            throw new Error("Empty AI response");
        return (0, utils_1.parseAIJson)(text);
    });
};
exports.processProductWithAI = processProductWithAI;
