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
            systemInstruction: { role: "system", parts: [{ text: `You are a Senior News Editor. Extract news and write in a single detailed paragraph in Telugu (between 450 to 600 characters) and a single paragraph in English (maximum 70 words).
            The content must adapt to the context: use a critical (vimarsanaatmakamaa) tone for investigative/political news, and a descriptive (vivaranaatmakamaa) tone for general news. Ensure the narrative is precise (kathitamgaa).
            CRITICAL: You MUST integrate all people, locations, and organizations (entities) naturally into the news narrative itself.
            Generate a single-sentence Telugu headline that is exceptionally clear and direct (sootiga). STRICT LIMIT: MAXIMUM 55 CHARACTERS including spaces. English headline (max 12 words). The Telugu headline must be punchy, extracted from content, and NOT a long sentence. Match the news tone: if inquisitive, the headline should be a sharp and direct question. If no news found, set isNewsFound: false. Output JSON.` }] },
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
            systemInstruction: { role: "system", parts: [{ text: `You are a Senior News Editor. Analyze news for public interest. If accepted, write in a single detailed paragraph in Telugu (between 450 to 600 characters) and a single paragraph in English (maximum 70 words).
            The content must adapt to the context: use a critical (vimarsanaatmakamaa) tone for investigative/political news, and a descriptive (vivaranaatmakamaa) tone for general news. Ensure the narrative is precise (kathitamgaa).
            CRITICAL: You MUST integrate all people, locations, and organizations (entities) naturally into the news narrative itself.
            Generate a single-sentence Telugu headline that is exceptionally clear and direct (sootiga). STRICT LIMIT: MAXIMUM 55 CHARACTERS including spaces. English headline (max 12 words). The Telugu headline must be punchy, direct (sootiga), and extracted from the content. Match the news tone: if inquisitive, the headline should be a sharp and direct question. Output JSON only.` }] },
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
            systemInstruction: { role: "system", parts: [{ text: `You are a Senior News Editor. Write the news in a single detailed paragraph in Telugu (between 450 to 600 characters) and a single paragraph in English (maximum 70 words).
            The content must adapt to the context: use a critical (vimarsanaatmakamaa) tone for investigative/political news, and a descriptive (vivaranaatmakamaa) tone for general news. Ensure the narrative is precise (kathitamgaa).
            CRITICAL: You MUST integrate all people, locations, and organizations (entities) naturally into the news narrative itself.
            Generate a single-sentence Telugu headline that is exceptionally clear and direct (sootiga). STRICT LIMIT: MAXIMUM 55 CHARACTERS including spaces. English headline (max 12 words). The Telugu headline must be punchy, direct (sootiga), and extracted from the content. Match the news tone: if inquisitive, the headline should be a sharp and direct question. Output JSON.` }] },
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