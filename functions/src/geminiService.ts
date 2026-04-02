import { GoogleGenAI, Type } from "@google/genai";

const PRIMARY_MODEL = "gemini-3-flash-preview";

/**
 * Robust helper to create AI instance with the correct API key.
 */
const getAIInstance = () => {
    if (!process.env.API_KEY) {
        console.error("[GEMINI-SERVICE] CRITICAL: API_KEY is missing in environment.");
    }
    return new GoogleGenAI({
        apiKey: process.env.API_KEY || "",
        apiVersion: "v1beta",
        httpOptions: { apiVersion: "v1beta" }
    });
};

export const processSocialPostWithAI = async (
    socialText: string,
    platform: string,
    category: string
): Promise<{
    isNewsFound: boolean;
    headline: string;
    content: string;
    headlineEn: string;
    contentEn: string;
    category: string;
} | null> => {
    const ai = getAIInstance();
    const schema = {
        type: Type.OBJECT,
        properties: {
            isNewsFound: { type: Type.BOOLEAN },
            headline: { type: Type.STRING },
            content: { type: Type.STRING },
            headlineEn: { type: Type.STRING },
            contentEn: { type: Type.STRING },
            category: { type: Type.STRING }
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
        const text = response.text as string;
        if (!text) return null;
        const parsed = JSON.parse(text.trim());
        return parsed.isNewsFound ? parsed : null;
    } catch (error: any) {
        console.error("Gemini Social Error:", error.message);
        return null;
    }
};

export const processCitizenContentWithAI = async (
    rawContent: string
): Promise<{
    success: boolean;
    reason?: string;
    processed?: {
        headline: string;
        content: string;
        headlineEn: string;
        contentEn: string;
        category: string;
    };
}> => {
    const ai = getAIInstance();
    const schema = {
        type: Type.OBJECT,
        properties: {
            success: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
            processed: {
                type: Type.OBJECT,
                properties: {
                    headline: { type: Type.STRING },
                    content: { type: Type.STRING },
                    headlineEn: { type: Type.STRING },
                    contentEn: { type: Type.STRING },
                    category: { type: Type.STRING }
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
        const text = response.text as string;
        if (!text) throw new Error("Empty AI response");
        return JSON.parse(text.trim());
    } catch (error: any) {
        console.error("Gemini Citizen Error:", error.message);
        throw error;
    }
};

export const processContentWithAI = async (
    rawContent: string,
    rawHeadline?: string
): Promise<{
    summarizedTeluguContent: string;
    generatedTeluguHeadline: string;
    englishHeadline: string;
    englishContent: string;
}> => {
    const ai = getAIInstance();
    const schema = {
        type: Type.OBJECT,
        properties: {
            summarizedTeluguContent: { type: Type.STRING },
            generatedTeluguHeadline: { type: Type.STRING },
            englishHeadline: { type: Type.STRING },
            englishContent: { type: Type.STRING },
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
        const text = response.text as string;
        if (!text) throw new Error("Empty AI response");
        return JSON.parse(text.trim());
    } catch (error: any) {
        console.error("Gemini Editor Error:", error.message);
        throw error;
    }
};
