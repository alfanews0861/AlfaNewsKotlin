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
1. Transform the input into high-quality Telugu news (content) of STRICTLY 60 to 70 words total (NEVER exceed 70 words) in exactly 2 micro-paragraphs separated by \\n\\n (Para 1: Core lead story ~30-35 words, Para 2: Background details & impact ~25-35 words).
2. Capture the emotional essence (bhaavam) and include ALL factual names and locations. Never invent facts.
3. Use 100% accurate standard Telugu spelling and grammar (e.g. use 'బనాయించి', NOT 'బనడించి'). No typing or compound letter errors.
4. Write a crisp English summary (contentEn) maximum 60 words.
5. Generate a dynamic, emotionally resonant Telugu headline (headline) STRICTLY 6-9 words. NEVER use boring meeting labels ("ప్రెస్ మీట్", "సమావేశం"). Match tone: poignant for human plight, fiery punch quote for speeches, crisp action for crimes/schemes.
6. Generate a sharp English headline (headlineEn) maximum 10-12 words.
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
        return parsed && parsed.isNewsFound ? parsed : null;
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
1. Transform the input into high-quality Telugu news (content) of STRICTLY 60 to 70 words total (NEVER exceed 70 words) in exactly 2 micro-paragraphs separated by \\n\\n (Para 1: Core lead story ~30-35 words, Para 2: Background details & impact ~25-35 words).
2. Capture the emotional essence (bhaavam) and include ALL factual names and locations. Never invent facts.
3. Use 100% accurate standard Telugu spelling and grammar (e.g. use 'బనాయించి', NOT 'బనడించి'). No typing or compound letter errors.
4. Write a crisp English summary (contentEn) maximum 60 words.
5. Generate a dynamic, emotionally resonant Telugu headline (headline) STRICTLY 6-9 words. NEVER use boring meeting labels ("ప్రెస్ మీట్", "సమావేశం"). Match tone: poignant for human plight, fiery punch quote for speeches, crisp action for crimes/schemes.
6. Generate a sharp English headline (headlineEn) maximum 10-12 words.
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
        return (0, utils_1.parseAIJson)(text);
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
1. Transform the input into high-quality Telugu news (summarizedTeluguContent) of STRICTLY 60 to 70 words total (NEVER exceed 70 words) in exactly 2 micro-paragraphs separated by \\n\\n (Para 1: Core lead story ~30-35 words, Para 2: Background details & impact ~25-35 words).
2. Capture the emotional essence (bhaavam) and include ALL factual names and locations. Never invent facts.
3. Use 100% accurate standard Telugu spelling and grammar (e.g. use 'బనాయించి', NOT 'బనడించి'). No typing or compound letter errors.
4. Write a crisp English summary (englishContent) maximum 60 words.
5. Generate a dynamic, emotionally resonant Telugu headline (generatedTeluguHeadline) STRICTLY 6-9 words. NEVER use boring meeting labels ("ప్రెస్ మీట్", "సమావేశం"). Match tone: poignant for human plight, fiery punch quote for speeches, crisp action for crimes/schemes.
6. Generate a sharp English headline (englishHeadline) maximum 10-12 words.
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
        return (0, utils_1.parseAIJson)(text);
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