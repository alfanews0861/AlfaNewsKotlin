"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processProductWithAI = exports.processContentWithAI = exports.processCitizenContentWithAI = exports.processSocialPostWithAI = void 0;
const genai_1 = require("@google/genai");
const utils_1 = require("./utils");
const PRIMARY_MODEL = utils_1.PRO_MODEL;
const processSocialPostWithAI = async (socialText, platform, category) => {
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            isNewsFound: { type: genai_1.Type.BOOLEAN },
            headline: { type: genai_1.Type.STRING },
            content: { type: genai_1.Type.STRING },
            fullStoryTe: { type: genai_1.Type.STRING, description: "Senior editor comprehensive full story in Telugu, 200-250 words" },
            headlineEn: { type: genai_1.Type.STRING },
            contentEn: { type: genai_1.Type.STRING },
            fullStoryEn: { type: genai_1.Type.STRING, description: "Senior editor full story in English, 150-200 words" },
            category: { type: genai_1.Type.STRING }
        },
        required: ["isNewsFound", "headline", "content", "headlineEn", "contentEn", "category"],
    };
    return await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `Platform: ${platform}\nCategory: ${category}\nInput Text:\n${socialText}` }] }],
            config: {
                systemInstruction: `మీరు ఆల్ఫా న్యూస్ (Alfa News) కు చీఫ్ ఎడిటర్.
1. ఇచ్చిన సమాచారాన్ని కచ్చితంగా 60 నుండి 70 పదాల మధ్య ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్ (content) వార్తగా మార్చండి (No multiple paragraphs, no newlines).
2. fullStoryTe: ఒక సీనియర్ ఎడిటర్ శైలిలో సమగ్రమైన 200 నుండి 250 పదాల పూర్తి కథనాన్ని రాయండి. అసలు మూల భావం, మాట్లాడిన వారి ఆవేశం లేదా ఆవేదన తీవ్రత తగ్గకూడదు. వ్యక్తులు, ప్రదేశాల పేర్లు మార్చవద్దు. అసలు టెక్స్ట్ చిన్నదైతే లేనివి ఊహించవద్దు.
3. శీర్షిక నిబంధనలు (CRITICAL HEADLINE RULES):
   - తప్పనిసరిగా మొదటి నుండి చివరి వరకు ఒకే ఒక్క నిరంతర సంపూర్ణ వాక్యం (STRICTLY ONE SINGLE CONTINUOUS SENTENCE) ఉండాలి.
   - రెండు వాక్యాలుగా లేదా ముక్కలుగా విడదీయరాదు. మధ్యలో డబుల్ డాట్స్ (..) లేదా చుక్కలు పెట్టరాదు.
   - కచ్చితంగా 5 నుండి 8 పదాలు మాత్రమే (STRICTLY 5-8 WORDS ONLY) ఉండాలి.
   - కవితాత్మక రూపకాలు (Poetic Metaphors - కన్నీటి సంద్రం, ఆక్రోశపు జ్వాలలు, మృత్యు కుహరాలు, కర్కశ వైఖరి, చీకటి కోరలు) ఉపయోగించి హృదయాన్ని హత్తుకునేలా లేదా రగిలించేలా రాయాలి.
   - ఎక్కడా కొటేషన్ మార్కులు ('...', "...") లేదా కోలన్ టెంప్లేట్లు వాడరాదు.
4. కన్నడ, హిందీ లిపి అక్షరాలు రాకుండా స్వచ్ఛమైన తెలుగు లిపి మాత్రమే వాడాలి.
5. ఇంగ్లీష్ సారాంశం (contentEn) max 50-60 పదాలు, ఇంగ్లీష్ శీర్షిక (headlineEn) max 8-10 పదాలు, ఇంగ్లీష్ పూర్తి కథనం (fullStoryEn) 150-200 పదాలు రాయండి.
అవుట్‌పుట్ కేవలం JSON మాత్రమే ఇవ్వాలి.`,
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
        return {
            ...parsed,
            headline: (0, utils_1.cleanTeluguHeadline)(parsed.headline),
            content: cleanedContent,
            fullStoryTe: parsed.fullStoryTe ? (0, utils_1.sanitizeTeluguText)(parsed.fullStoryTe).trim() : cleanedContent,
            fullStoryEn: parsed.fullStoryEn ? parsed.fullStoryEn.trim() : (parsed.contentEn || "")
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
                    fullStoryTe: { type: genai_1.Type.STRING, description: "Senior editor full story in Telugu, 200-250 words" },
                    headlineEn: { type: genai_1.Type.STRING },
                    contentEn: { type: genai_1.Type.STRING },
                    fullStoryEn: { type: genai_1.Type.STRING, description: "Senior editor full story in English, 150-200 words" },
                    category: { type: genai_1.Type.STRING }
                }
            }
        },
        required: ["success"],
    };
    return await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `Citizen Submission:\n${rawContent}` }] }],
            config: {
                systemInstruction: `మీరు ఆల్ఫా న్యూస్ (Alfa News) కు చీఫ్ ఎడిటర్.
1. పౌరులు పంపిన సమాచారాన్ని కచ్చితంగా 60 నుండి 70 పదాల మధ్య ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్ (content) వార్తగా మార్చండి (No multiple paragraphs, no newlines).
2. fullStoryTe: ప్రజా సమస్యల తీవ్రత, ఆవేదన లేదా సమస్య మూల భావాన్ని తగ్గించకుండా, సీనియర్ ఎడిటర్ శైలిలో 200 నుండి 250 పదాల సమగ్ర కథనం రాయండి. లేని విషయాలు కల్పించవద్దు.
3. శీర్షిక నిబంధనలు (CRITICAL HEADLINE RULES):
   - తప్పనిసరిగా మొదటి నుండి చివరి వరకు ఒకే ఒక్క నిరంతర సంపూర్ణ వాక్యం (STRICTLY ONE SINGLE CONTINUOUS SENTENCE) ఉండాలి.
   - రెండు వాక్యాలుగా లేదా ముక్కలుగా విడదీయరాదు. మధ్యలో డబుల్ డాట్స్ (..) లేదా చుక్కలు పెట్టరాదు.
   - కచ్చితంగా 5 నుండి 8 పదాలు మాత్రమే (STRICTLY 5-8 WORDS ONLY) ఉండాలి.
   - కవితాత్మక రూపకాలు (Poetic Metaphors) ఉపయోగించి ప్రజా సమస్యలను గుండెకు హత్తుకునేలా లేదా నిలదీసేలా రాయాలి.
   - ఎక్కడా కొటేషన్ మార్కులు ('...', "...") లేదా కోలన్ టెంప్లేట్లు వాడరాదు.
4. కన్నడ, హిందీ లిపి అక్షరాలు రాకుండా స్వచ్ఛమైన తెలుగు లిపి మాత్రమే వాడాలి.
5. ఇంగ్లీష్ సారాంశం (contentEn) max 50-60 పదాలు, ఇంగ్లీష్ శీర్షిక (headlineEn) max 8-10 పదాలు, ఇంగ్లీష్ పూర్తి కథనం (fullStoryEn) 150-200 పదాలు రాయండి.
అవుట్‌పుట్ కేవలం JSON మాత్రమే ఇవ్వాలి.`,
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
            parsed.processed.headline = (0, utils_1.cleanTeluguHeadline)(parsed.processed.headline);
            parsed.processed.content = cleanContent;
            parsed.processed.fullStoryTe = parsed.processed.fullStoryTe ? (0, utils_1.sanitizeTeluguText)(parsed.processed.fullStoryTe).trim() : cleanContent;
            parsed.processed.fullStoryEn = parsed.processed.fullStoryEn ? parsed.processed.fullStoryEn.trim() : (parsed.processed.contentEn || "");
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
            fullStoryTe: { type: genai_1.Type.STRING, description: "Senior editor comprehensive full story in Telugu, 200-250 words" },
            englishHeadline: { type: genai_1.Type.STRING },
            englishContent: { type: genai_1.Type.STRING },
            fullStoryEn: { type: genai_1.Type.STRING, description: "Senior editor full story in English, 150-200 words" },
        },
        required: ["summarizedTeluguContent", "generatedTeluguHeadline", "englishHeadline", "englishContent"],
    };
    return await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `Headline: ${rawHeadline || 'N/A'}\nContent: ${rawContent}` }] }],
            config: {
                systemInstruction: `మీరు ఆల్ఫా న్యూస్ (Alfa News) కు చీఫ్ ఎడిటర్.
1. సమాచారాన్ని కచ్చితంగా 60 నుండి 70 పదాల మధ్య ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్ (summarizedTeluguContent) వార్తగా మార్చండి (No multiple paragraphs, no newlines).
2. fullStoryTe: సీనియర్ ఎడిటర్ శైలిలో సమగ్రమైన 200 నుండి 250 పదాల పూర్తి కథనాన్ని రాయండి. అసలు మూల భావం, మాట్లాడిన వారి ఆవేశం లేదా ఆవేదన తీవ్రత తగ్గకూడదు. వ్యక్తులు, ప్రదేశాల పేర్లు మార్చవద్దు. అసలు టెక్స్ట్ చిన్నదైతే లేనివి ఊహించవద్దు.
3. శీర్షిక నిబంధనలు (CRITICAL HEADLINE RULES):
   - తప్పనిసరిగా మొదటి నుండి చివరి వరకు ఒకే ఒక్క నిరంతర సంపూర్ణ వాక్యం (STRICTLY ONE SINGLE CONTINUOUS SENTENCE) ఉండాలి.
   - రెండు వాక్యాలుగా లేదా ముక్కలుగా విడదీయరాదు. మధ్యలో డబుల్ డాట్స్ (..) లేదా చుక్కలు పెట్టరాదు.
   - కచ్చితంగా 5 నుండి 8 పదాలు మాత్రమే (STRICTLY 5-8 WORDS ONLY) ఉండాలి.
   - కవితాత్మక రూపకాలు (Poetic Metaphors) ఉపయోగించి సమస్యలను, భావోద్వేగాలను పదునుగా రాయాలి.
   - ఎక్కడా కొటేషన్ మార్కులు ('...', "...") లేదా కోలన్ టెంప్లేట్లు వాడరాదు.
4. కన్నడ, హిందీ లిపి అక్షరాలు రాకుండా స్వచ్ఛమైన తెలుగు లిపి మాత్రమే వాడాలి.
5. ఇంగ్లీష్ సారాంశం (englishContent) max 50-60 పదాలు, ఇంగ్లీష్ శీర్షిక (englishHeadline) max 8-10 పదాలు, ఇంగ్లీష్ పూర్తి కథనం (fullStoryEn) 150-200 పదాలు రాయండి.
అవుట్‌పుట్ కేవలం JSON మాత్రమే ఇవ్వాలి.`,
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
        return {
            ...parsed,
            generatedTeluguHeadline: (0, utils_1.cleanTeluguHeadline)(parsed.generatedTeluguHeadline),
            summarizedTeluguContent: cleanContent,
            fullStoryTe: parsed.fullStoryTe ? (0, utils_1.sanitizeTeluguText)(parsed.fullStoryTe).trim() : cleanContent,
            fullStoryEn: parsed.fullStoryEn ? parsed.fullStoryEn.trim() : (parsed.englishContent || "")
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
