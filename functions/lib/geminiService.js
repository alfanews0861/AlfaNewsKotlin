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
            headlineEn: { type: genai_1.Type.STRING },
            contentEn: { type: genai_1.Type.STRING },
            category: { type: genai_1.Type.STRING }
        },
        required: ["isNewsFound", "headline", "content", "headlineEn", "contentEn", "category"],
    };
    return await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `Platform: ${platform}\nCategory: ${category}\nInput Text:\n${socialText}` }] }],
            config: {
                systemInstruction: `You are the Chief Editor of Alfa News (Telugu).
1. Transform the input into high-quality Telugu news (content) of STRICTLY 60 to 70 words total as strictly ONE SINGLE UNIFIED PARAGRAPH (గతం లో మాదిరిగానే ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్, no multiple paragraphs, no newlines).
2. Capture the full emotional essence (భావం), tone, and intensity (ఆవేశం, ఆగ్రహం, ఆవేదన). Include ALL factual names of people and exact locations. Never invent facts.
3. Extract the sharpest punch dialogue or key statement from the news as the headline hook (e.g. "'...': ..."). STRICTLY 6-9 words.
4. STRICT SCRIPT PURITY: Output pure Telugu script only (Unicode U+0C00-U+0C7F). Zero Kannada or Hindi/Devanagari characters allowed.
5. Write a crisp English summary (contentEn) maximum 60 words, and English headline (headlineEn) maximum 10-12 words.
LEGAL COMPLIANCE: Use objective, neutral language. For allegations, use "ఆరోపణలు వస్తున్నాయి" or "సమాచారం అందుతోంది".
Output JSON only.`,
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
        return {
            ...parsed,
            headline: (0, utils_1.sanitizeTeluguText)(parsed.headline),
            content: (0, utils_1.sanitizeTeluguText)(parsed.content).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim()
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
                    headlineEn: { type: genai_1.Type.STRING },
                    contentEn: { type: genai_1.Type.STRING },
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
                systemInstruction: `You are the Chief Editor of Alfa News (Telugu).
1. Transform the input into high-quality Telugu news (content) of STRICTLY 60 to 70 words total as strictly ONE SINGLE UNIFIED PARAGRAPH (గతం లో మాదిరిగానే ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్, no multiple paragraphs, no newlines).
2. Capture the full emotional essence (భావం), tone, and intensity (ఆవేశం, ఆగ్రహం, ఆవేదన). Include ALL factual names of people and exact locations. Never invent facts.
3. Extract the sharpest punch dialogue or key statement from the news as the headline hook (e.g. "'...': ..."). STRICTLY 6-9 words.
4. STRICT SCRIPT PURITY: Output pure Telugu script only (Unicode U+0C00-U+0C7F). Zero Kannada or Hindi/Devanagari characters allowed.
5. Write a crisp English summary (contentEn) maximum 60 words, and English headline (headlineEn) maximum 10-12 words.
LEGAL COMPLIANCE: Use objective, neutral language. For allegations, use "ఆరోపణలు వస్తున్నాయి" or "సమాచారం అందుతోంది".
Output JSON only.`,
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
            parsed.processed.headline = (0, utils_1.sanitizeTeluguText)(parsed.processed.headline);
            parsed.processed.content = (0, utils_1.sanitizeTeluguText)(parsed.processed.content).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
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
            englishHeadline: { type: genai_1.Type.STRING },
            englishContent: { type: genai_1.Type.STRING },
        },
        required: ["summarizedTeluguContent", "generatedTeluguHeadline", "englishHeadline", "englishContent"],
    };
    return await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `Headline: ${rawHeadline || 'N/A'}\nContent: ${rawContent}` }] }],
            config: {
                systemInstruction: `You are the Chief Editor of Alfa News (Telugu).
1. Transform the input into high-quality Telugu news (summarizedTeluguContent) of STRICTLY 60 to 70 words total as strictly ONE SINGLE UNIFIED PARAGRAPH (గతం లో మాదిరిగానే ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్, no multiple paragraphs, no newlines).
2. Capture the full emotional essence (భావం), tone, and intensity (ఆవేశం, ఆగ్రహం, ఆవేదన). Include ALL factual names of people and exact locations. Never invent facts.
3. Extract the sharpest punch dialogue or key statement from the news as the headline hook (e.g. "'...': ..."). STRICTLY 6-9 words.
4. STRICT SCRIPT PURITY: Output pure Telugu script only (Unicode U+0C00-U+0C7F). Zero Kannada or Hindi/Devanagari characters allowed.
5. Write a crisp English summary (englishContent) maximum 60 words, and English headline (englishHeadline) maximum 10-12 words.
LEGAL COMPLIANCE: Use objective, neutral language. For allegations, use "ఆరోపణలు వస్తున్నాయి" or "సమాచారం అందుతోంది".
Output JSON only.`,
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
        return {
            ...parsed,
            generatedTeluguHeadline: (0, utils_1.sanitizeTeluguText)(parsed.generatedTeluguHeadline),
            summarizedTeluguContent: (0, utils_1.sanitizeTeluguText)(parsed.summarizedTeluguContent).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim()
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
//# sourceMappingURL=geminiService.js.map