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
            config: {
                systemInstruction: `You are a Senior Reporter.
            1. Write a detailed paragraph in Telugu (content) between 500-600 chars. Capture the emotional essence and include ALL names and locations.
            2. Write a paragraph in English (contentEn) maximum 70 words.
            3. Generate a strong punchy Telugu headline (headline) maximum 10 words.
            4. Generate a sharp English headline (headlineEn) maximum 12 words.
            LEGAL COMPLIANCE: Use objective, neutral language. For accusations or unverified info, use "allegedly" or "reportedly" (తెలుగులో: "ఆరోపణలు వస్తున్నాయి", "సమాచారం అందుతోంది"). Avoid libel.
            Output JSON only.`,
                temperature: 0.4,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema,
                // Safety
                system_instruction: `You are a Senior Reporter. ...`,
                max_output_tokens: 4096
            },
        } as any);

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
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
            config: {
                systemInstruction: `You are a Senior Reporter.
            1. Write a detailed paragraph in Telugu (content) between 500-600 chars. Capture the emotional essence and include ALL names and locations.
            2. Write a paragraph in English (contentEn) maximum 70 words.
            3. Generate a strong punchy Telugu headline (headline) maximum 10 words.
            4. Generate a sharp English headline (headlineEn) maximum 12 words.
            LEGAL COMPLIANCE: Use objective, neutral language. For accusations or unverified info, use "allegedly" or "reportedly" (తెలుగులో: "ఆరోపణలు వస్తున్నాయి", "సమాచారం అందుతోంది"). Avoid libel.
            Output JSON only.`,
                temperature: 0.4,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema,
                // Safety
                system_instruction: `You are a Senior Reporter. ...`,
                max_output_tokens: 4096
            }
        } as any);

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
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
            config: {
                systemInstruction: `You are a Senior Reporter.
            1. Write a detailed paragraph in Telugu (content) between 500-600 chars. Capture the emotional essence and include ALL names and locations.
            2. Write a paragraph in English (contentEn) maximum 70 words.
            3. Generate a strong punchy Telugu headline (headline) maximum 10 words.
            4. Generate a sharp English headline (headlineEn) maximum 12 words.
            LEGAL COMPLIANCE: Use objective, neutral language. For accusations or unverified info, use "allegedly" or "reportedly" (తెలుగులో: "ఆరోపణలు వస్తున్నాయి", "సమాచారం అందుతోంది"). Avoid libel.
            Output JSON only.`,
                temperature: 0.4,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema,
                // Safety
                system_instruction: `You are a Senior Reporter. ...`,
                max_output_tokens: 4096
            }
        } as any);

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty AI response");
        return parseAIJson(text);
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
                systemInstruction: `You are a Tech & Lifestyle Reporter.
            1. Convert the provided product information into an exciting news story in Telugu (content) between 400-500 chars. Focus on the value, features, or a massive discount.
            2. Write a professional news paragraph in English (contentEn) maximum 60 words.
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
        } as any);

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty AI response");
        return parseAIJson(text);
    });
};
