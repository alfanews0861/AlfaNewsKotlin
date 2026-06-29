"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processContentWithAI = exports.processCitizenContentWithAI = exports.processSocialPostWithAI = void 0;
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
            systemInstruction: { role: "system", parts: [{ text: `You are a Senior Reporter.
            1. Write a detailed paragraph in Telugu (content) between 500-600 chars. Capture the emotional essence and include ALL names and locations.
            2. Write a paragraph in English (contentEn) maximum 70 words.
            3. Generate a strong punchy Telugu headline (headline) maximum 10 words.
            4. Generate a sharp English headline (headlineEn) maximum 12 words.
            Output JSON only.` }] },
            generationConfig: {
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        const text = response.text;
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
            systemInstruction: { role: "system", parts: [{ text: `You are a Senior Reporter.
            1. Write a detailed paragraph in Telugu (content) between 500-600 chars. Capture the emotional essence and include ALL names and locations.
            2. Write a paragraph in English (contentEn) maximum 70 words.
            3. Generate a strong punchy Telugu headline (headline) maximum 10 words.
            4. Generate a sharp English headline (headlineEn) maximum 12 words.
            Output JSON only.` }] },
            generationConfig: {
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        const text = response.text;
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
            systemInstruction: { role: "system", parts: [{ text: `You are a Senior Reporter.
            1. Write a detailed paragraph in Telugu (content) between 500-600 chars. Capture the emotional essence and include ALL names and locations.
            2. Write a paragraph in English (contentEn) maximum 70 words.
            3. Generate a strong punchy Telugu headline (headline) maximum 10 words.
            4. Generate a sharp English headline (headlineEn) maximum 12 words.
            Output JSON only.` }] },
            generationConfig: {
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        const text = response.text;
        if (!text)
            throw new Error("Empty AI response");
        return (0, utils_1.parseAIJson)(text);
    });
};
exports.processContentWithAI = processContentWithAI;
//# sourceMappingURL=geminiService.js.map