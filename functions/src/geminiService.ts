import { Type } from "@google/genai";
import { runWithAIFallback, parseAIJson, PRO_MODEL, sanitizeTeluguText } from "./utils";

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
        } as any);

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;
        const parsed = parseAIJson(text);
        if (!parsed || !parsed.isNewsFound) return null;
        return {
            ...parsed,
            headline: sanitizeTeluguText(parsed.headline),
            content: sanitizeTeluguText(parsed.content).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim()
        };
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
        } as any);

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty AI response");
        const parsed = parseAIJson(text);
        if (parsed && parsed.processed) {
            parsed.processed.headline = sanitizeTeluguText(parsed.processed.headline);
            parsed.processed.content = sanitizeTeluguText(parsed.processed.content).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
        }
        return parsed;
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
        } as any);

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty AI response");
        const parsed = parseAIJson(text);
        return {
            ...parsed,
            generatedTeluguHeadline: sanitizeTeluguText(parsed.generatedTeluguHeadline),
            summarizedTeluguContent: sanitizeTeluguText(parsed.summarizedTeluguContent).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim()
        };
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
        } as any);

        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty AI response");
        return parseAIJson(text);
    });
};
