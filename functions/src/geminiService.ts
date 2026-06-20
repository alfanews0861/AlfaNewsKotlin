import { Type } from "@google/genai";
import { runWithAIFallback, parseAIJson, PRO_MODEL } from "./utils";

const PRIMARY_MODEL = PRO_MODEL;


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

    return await runWithAIFallback(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `Platform: ${platform}\nCategory: ${category}\nInput Text:\n${socialText}` }] }],
            systemInstruction: { role: "system", parts: [{ text: `You are a Senior News Editor. Extract news and write in a single detailed paragraph in Telugu (between 300 to 360 characters) and a single paragraph in English (maximum 70 words).
            CRITICAL: You MUST integrate all people, locations, and organizations (entities) naturally into the news narrative itself. A news story is incomplete without stating 'Who, Where, and What' explicitly in the text.
            Generate a single-sentence Telugu headline (max 55 characters) and an English headline (max 12 words). The Telugu headline must be punchy like a 'punch dialogue', direct (sootiga), and extracted from the content. Match the news tone: if inquisitive, the headline should be a sharp and direct question. If no news found, set isNewsFound: false. Output JSON.` }] },
            generationConfig: {
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        } as any);

        const text = response.text as string;
        if (!text) return null;
        const parsed = parseAIJson(text);
        return parsed && parsed.isNewsFound ? parsed : null;
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
        headlineEn: string;
        contentEn: string;
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

    return await runWithAIFallback(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `Citizen Submission:\n${rawContent}` }] }],
            systemInstruction: { role: "system", parts: [{ text: `You are a Senior News Editor. Analyze news for public interest. If accepted, write in a single detailed paragraph in Telugu (between 300 to 360 characters) and a single paragraph in English (maximum 70 words).
            CRITICAL: You MUST integrate all people, locations, and organizations (entities) naturally into the news narrative itself. A news story is incomplete without stating 'Who, Where, and What' explicitly in the text.
            Generate a single-sentence Telugu headline (max 55 characters) and an English headline (max 12 words). The Telugu headline must be punchy like a 'punch dialogue', direct (sootiga), and extracted from the content. Match the news tone: if inquisitive, the headline should be a sharp and direct question. Output JSON only.` }] },
            generationConfig: {
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        } as any);

        const text = response.text as string;
        if (!text) throw new Error("Empty AI response");
        return parseAIJson(text);
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
}> => {
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

    return await runWithAIFallback(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `Headline: ${rawHeadline || 'N/A'}\nContent: ${rawContent}` }] }],
            systemInstruction: { role: "system", parts: [{ text: `You are a Senior News Editor. Write the news in a single detailed paragraph in Telugu (between 300 to 360 characters) and a single paragraph in English (maximum 70 words).
            CRITICAL: You MUST integrate all people, locations, and organizations (entities) naturally into the news narrative itself. A news story is incomplete without stating 'Who, Where, and What' explicitly in the text.
            Generate a single-sentence Telugu headline (max 55 characters) and an English headline (max 12 words). The Telugu headline must be punchy like a 'punch dialogue', direct (sootiga), and extracted from the content. Match the news tone: if inquisitive, the headline should be a sharp and direct question. Output JSON.` }] },
            generationConfig: {
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        } as any);

        const text = response.text as string;
        if (!text) throw new Error("Empty AI response");
        return parseAIJson(text);
    });
};
