import { Type } from "@google/genai";
import { runWithAIFallback, parseAIJson, PRO_MODEL, sanitizeTeluguText, cleanTeluguHeadline } from "./utils";

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
                systemInstruction: `మీరు ఆల్ఫా న్యూస్ (Alfa News) కు చీఫ్ ఎడిటర్.
1. ఇచ్చిన సమాచారాన్ని కచ్చితంగా 60 నుండి 70 పదాల మధ్య ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్ (content) వార్తగా మార్చండి (No multiple paragraphs, no newlines).
2. వార్త యొక్క పూర్తి మూల భావం (భావం), మాట్లాడిన వారి ఆవేశం, ఆగ్రహం, బాధ లేదా ఆవేదన తీవ్రతను యథాతథంగా ప్రతిబింబించండి. పేర్లు, ప్రదేశాలను మార్చవద్దు.
3. శీర్షిక నిబంధనలు (CRITICAL HEADLINE RULES):
   - తప్పనిసరిగా మొదటి నుండి చివరి వరకు ఒకే ఒక్క నిరంతర సంపూర్ణ వాక్యం (STRICTLY ONE SINGLE CONTINUOUS SENTENCE) ఉండాలి.
   - రెండు వాక్యాలుగా లేదా ముక్కలుగా విడదీయరాదు. మధ్యలో డబుల్ డాట్స్ (..) లేదా చుక్కలు పెట్టరాదు.
   - కచ్చితంగా 5 నుండి 8 పదాలు మాత్రమే (STRICTLY 5-8 WORDS ONLY) ఉండాలి.
   - కవితాత్మక రూపకాలు (Poetic Metaphors - కన్నీటి సంద్రం, ఆక్రోశపు జ్వాలలు, మృత్యు కుహరాలు, కర్కశ వైఖరి, చీకటి కోరలు) ఉపయోగించి హృదయాన్ని హత్తుకునేలా లేదా రగిలించేలా రాయాలి.
   - ఎక్కడా కొటేషన్ మార్కులు ('...', "...") లేదా కోలన్ టెంప్లేట్లు వాడరాదు.
4. కన్నడ, హిందీ లిపి అక్షరాలు రాకుండా స్వచ్ఛమైన తెలుగు లిపి మాత్రమే వాడాలి.
5. ఇంగ్లీష్ సారాంశం (contentEn) max 50-60 పదాలు, ఇంగ్లీష్ శీర్షిక (headlineEn) max 8-10 పదాలు రాయండి.
అవుట్‌పుట్ కేవలం JSON మాత్రమే ఇవ్వాలి.`,
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
            headline: cleanTeluguHeadline(parsed.headline),
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
                systemInstruction: `మీరు ఆల్ఫా న్యూస్ (Alfa News) కు చీఫ్ ఎడిటర్.
1. పౌరులు పంపిన సమాచారాన్ని కచ్చితంగా 60 నుండి 70 పదాల మధ్య ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్ (content) వార్తగా మార్చండి (No multiple paragraphs, no newlines).
2. ప్రజా సమస్యల తీవ్రత, ఆవేదన లేదా సమస్య మూల భావాన్ని (భావం) యథాతథంగా ప్రతిబింబించండి.
3. శీర్షిక నిబంధనలు (CRITICAL HEADLINE RULES):
   - తప్పనిసరిగా మొదటి నుండి చివరి వరకు ఒకే ఒక్క నిరంతర సంపూర్ణ వాక్యం (STRICTLY ONE SINGLE CONTINUOUS SENTENCE) ఉండాలి.
   - రెండు వాక్యాలుగా లేదా ముక్కలుగా విడదీయరాదు. మధ్యలో డబుల్ డాట్స్ (..) లేదా చుక్కలు పెట్టరాదు.
   - కచ్చితంగా 5 నుండి 8 పదాలు మాత్రమే (STRICTLY 5-8 WORDS ONLY) ఉండాలి.
   - కవితాత్మక రూపకాలు (Poetic Metaphors) ఉపయోగించి ప్రజా సమస్యలను గుండెకు హత్తుకునేలా లేదా నిలదీసేలా రాయాలి.
   - ఎక్కడా కొటేషన్ మార్కులు ('...', "...") లేదా కోలన్ టెంప్లేట్లు వాడరాదు.
4. కన్నడ, హిందీ లిపి అక్షరాలు రాకుండా స్వచ్ఛమైన తెలుగు లిపి మాత్రమే వాడాలి.
5. ఇంగ్లీష్ సారాంశం (contentEn) max 50-60 పదాలు, ఇంగ్లీష్ శీర్షిక (headlineEn) max 8-10 పదాలు రాయండి.
అవుట్‌పుట్ కేవలం JSON మాత్రమే ఇవ్వాలి.`,
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
            parsed.processed.headline = cleanTeluguHeadline(parsed.processed.headline);
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
                systemInstruction: `మీరు ఆల్ఫా న్యూస్ (Alfa News) కు చీఫ్ ఎడిటర్.
1. సమాచారాన్ని కచ్చితంగా 60 నుండి 70 పదాల మధ్య ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్ (summarizedTeluguContent) వార్తగా మార్చండి (No multiple paragraphs, no newlines).
2. వార్త యొక్క పూర్తి భావం, మాట్లాడిన వారి ఆవేశం, ఆగ్రహం లేదా సమస్య తీవ్రతను యథాతథంగా ప్రతిబింబించండి.
3. శీర్షిక నిబంధనలు (CRITICAL HEADLINE RULES):
   - తప్పనిసరిగా మొదటి నుండి చివరి వరకు ఒకే ఒక్క నిరంతర సంపూర్ణ వాక్యం (STRICTLY ONE SINGLE CONTINUOUS SENTENCE) ఉండాలి.
   - రెండు వాక్యాలుగా లేదా ముక్కలుగా విడదీయరాదు. మధ్యలో డబుల్ డాట్స్ (..) లేదా చుక్కలు పెట్టరాదు.
   - కచ్చితంగా 5 నుండి 8 పదాలు మాత్రమే (STRICTLY 5-8 WORDS ONLY) ఉండాలి.
   - కవితాత్మక రూపకాలు (Poetic Metaphors) ఉపయోగించి సమస్యలను, భావోద్వేగాలను పదునుగా రాయాలి.
   - ఎక్కడా కొటేషన్ మార్కులు ('...', "...") లేదా కోలన్ టెంప్లేట్లు వాడరాదు.
4. కన్నడ, హిందీ లిపి అక్షరాలు రాకుండా స్వచ్ఛమైన తెలుగు లిపి మాత్రమే వాడాలి.
5. ఇంగ్లీష్ సారాంశం (englishContent) max 50-60 పదాలు, ఇంగ్లీష్ శీర్షిక (englishHeadline) max 8-10 పదాలు రాయండి.
అవుట్‌పుట్ కేవలం JSON మాత్రమే ఇవ్వాలి.`,
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
            generatedTeluguHeadline: cleanTeluguHeadline(parsed.generatedTeluguHeadline),
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
