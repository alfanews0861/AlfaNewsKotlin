"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processContentWithAI = exports.processCitizenContentWithAI = exports.processSocialPostWithAI = void 0;
const genai_1 = require("@google/genai");
const PRIMARY_MODEL = "gemini-3-flash-preview";
/**
 * Robust helper to create AI instance with the correct API key.
 */
const getAIInstance = () => {
    if (!process.env.API_KEY) {
        console.error("[GEMINI-SERVICE] CRITICAL: API_KEY is missing in environment.");
    }
    return new genai_1.GoogleGenAI({
        apiKey: process.env.API_KEY || "",
        apiVersion: "v1beta",
        httpOptions: { apiVersion: "v1beta" }
    });
};
const processSocialPostWithAI = async (socialText, platform, category) => {
    const ai = getAIInstance();
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
    try {
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: [{ role: "user", parts: [{ text: `Platform: ${platform}\nCategory: ${category}\nInput Text:\n${socialText}` }] }],
            config: {
                systemInstruction: `You are a Senior News Editor. Extract news and write in a single paragraph in Telugu of maximum 60 words and a single paragraph in English of maximum 60 words, ensuring people and locations are included without changing the original meaning. Generate a single-sentence Telugu headline of 6-10 words and an English headline of maximum 12 words. Both headlines must be punchy like a 'punch dialogue' and match the news sentiment. If no news found, set isNewsFound: false. Output JSON.`,
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });
        const text = response.text;
        if (!text)
            return null;
        const parsed = JSON.parse(text.trim());
        return parsed.isNewsFound ? parsed : null;
    }
    catch (error) {
        console.error("Gemini Social Error:", error.message);
        return null;
    }
};
exports.processSocialPostWithAI = processSocialPostWithAI;
const processCitizenContentWithAI = async (rawContent) => {
    const ai = getAIInstance();
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
    try {
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: [{ role: "user", parts: [{ text: `Citizen Submission:\n${rawContent}` }] }],
            config: {
                systemInstruction: `You are a Senior News Editor. Analyze news for public interest. If accepted, write in a single paragraph in Telugu of maximum 60 words and a single paragraph in English of maximum 60 words, ensuring people and locations are included without changing the original meaning. Generate a single-sentence Telugu headline of 6-10 words and an English headline of maximum 12 words. Both headlines must be punchy like a 'punch dialogue' and match the news sentiment. Output JSON only.`,
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        const text = response.text;
        if (!text)
            throw new Error("Empty AI response");
        return JSON.parse(text.trim());
    }
    catch (error) {
        console.error("Gemini Citizen Error:", error.message);
        throw error;
    }
};
exports.processCitizenContentWithAI = processCitizenContentWithAI;
const processContentWithAI = async (rawContent, rawHeadline) => {
    const ai = getAIInstance();
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
    try {
        const response = await ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: [{ role: "user", parts: [{ text: `Headline: ${rawHeadline || 'N/A'}\nContent: ${rawContent}` }] }],
            config: {
                systemInstruction: `You are a Senior News Editor. Write the news in a single paragraph in Telugu of maximum 60 words and a single paragraph in English of maximum 60 words, ensuring people and locations are included without changing the original meaning. Generate a single-sentence Telugu headline of 6-10 words and an English headline of maximum 12 words. Both headlines must be punchy like a 'punch dialogue' and match the news sentiment. Output JSON.`,
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        const text = response.text;
        if (!text)
            throw new Error("Empty AI response");
        return JSON.parse(text.trim());
    }
    catch (error) {
        console.error("Gemini Editor Error:", error.message);
        throw error;
    }
};
exports.processContentWithAI = processContentWithAI;
//# sourceMappingURL=geminiService.js.map