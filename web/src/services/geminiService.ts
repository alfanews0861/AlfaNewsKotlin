/// <reference types="vite/client" />

export const CATEGORIES_MAP: Record<string, string> = {
    'Politics': 'రాజకీయం',
    'AndhraPradesh': 'ఆంధ్ర ప్రదేశ్',
    'Telangana': 'తెలంగాణ',
    'Crime': 'క్రైమ్',
    'Cinema': 'వినోదం',
    'Sports': 'క్రీడలు',
    'Business': 'వ్యాపారం',
    'Technology': 'టెక్నాలజీ',
    'Lifestyle': 'లైఫ్ స్టైల్',
    'Health': 'ఆరోగ్యం',
    'Devotional': 'భక్తి',
    'Agriculture': 'వ్యవసాయం',
    'Education': 'విద్య/ఉద్యోగాలు',
    'National': 'జాతీయం',
    'International': 'అంతర్జాతీయం',
    'Other': 'ఇతరాలు'
};

const getApiKey = () => {
    try {
        return import.meta.env.VITE_GEMINI_API_KEY || '';
    } catch (e) {
        return '';
    }
};

async function callGeminiAPI(prompt: string, schema: any) {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.warn("No Gemini API Key found");
        return {};
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return JSON.parse(text);
}

export async function categorizeNews(headline: string, content: string): Promise<string> {
    try {
        const prompt = `Analyze the following news headline and content. Categorize it into EXACTLY ONE of these categories: ${Object.keys(CATEGORIES_MAP).join(', ')}.
        
        Guidelines:
        - If it's about movies, actors, or entertainment, use 'Cinema'.
        - If it's about health, diseases, or medical tips, use 'Health'.
        - If it's about fashion, food, travel, or daily living, use 'Lifestyle'.
        - If it's about crimes, police, or court cases, use 'Crime'.
        - If it's specifically about Andhra Pradesh state politics or events, use 'AndhraPradesh'.
        - If it's specifically about Telangana state politics or events, use 'Telangana'.
        - If it's about general politics not specific to these states, use 'Politics'.
        
        Headline: ${headline}
        Content: ${content.substring(0, 500)}`;

        const schema = {
            type: "OBJECT",
            properties: {
                category: {
                    type: "STRING",
                    description: "The identified category ID"
                }
            },
            required: ["category"]
        };

        const result = await callGeminiAPI(prompt, schema);
        const identified = result.category;
        
        return CATEGORIES_MAP[identified] ? CATEGORIES_MAP[identified] : 'ఇతరాలు';
    } catch (error) {
        console.error("Categorization Error:", error);
        return 'ఇతరాలు';
    }
}

export interface NewsMetadata {
    category: string;
    keywords: string[];
    tone: string;
    entities: {
        people: string[];
        organizations: string[];
        locations: string[];
    };
}

export async function analyzeNewsMetadata(headline: string, content: string): Promise<NewsMetadata> {
    try {
        const prompt = `Analyze the following news headline and content. 
        1. Categorize it into EXACTLY ONE of these categories: ${Object.keys(CATEGORIES_MAP).join(', ')}.
        2. Extract 5-8 relevant keywords (in Telugu) that describe the subjects, people, or places in the news.
        3. Identify the 'tone' or 'slant' of the news (in Telugu). For example, if it's political, mention if it's "జగన్ వ్యతిరేక వార్త", "కెసిఆర్ అనుకూల వార్త", "ప్రభుత్వ వ్యతిరేక వార్త", "తటస్థ వార్త" (neutral), etc.
        4. Identify People (వ్యక్తులు), Organizations (సంస్థలు), and Locations (ప్రాంతాలు) mentioned in the news.
        
        Headline: ${headline}
        Content: ${content.substring(0, 1000)}`;

        const schema = {
            type: "OBJECT",
            properties: {
                categoryId: {
                    type: "STRING",
                    description: "The identified category ID from the provided list"
                },
                keywords: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "List of 5-8 keywords in Telugu"
                },
                tone: {
                    type: "STRING",
                    description: "The tone or slant of the news in Telugu"
                },
                entities: {
                    type: "OBJECT",
                    properties: {
                        people: { type: "ARRAY", items: { type: "STRING" } },
                        organizations: { type: "ARRAY", items: { type: "STRING" } },
                        locations: { type: "ARRAY", items: { type: "STRING" } }
                    }
                }
            },
            required: ["categoryId", "keywords", "tone", "entities"]
        };

        const result = await callGeminiAPI(prompt, schema);
        return {
            category: CATEGORIES_MAP[result.categoryId] || 'ఇతరాలు',
            keywords: result.keywords || [],
            tone: result.tone || 'తటస్థ వార్త',
            entities: result.entities || { people: [], organizations: [], locations: [] }
        };
    } catch (error) {
        console.error("Metadata Analysis Error:", error);
        return {
            category: 'ఇతరాలు',
            keywords: [],
            tone: 'తటస్థ వార్త',
            entities: { people: [], organizations: [], locations: [] }
        };
    }
}

export async function detectDistrict(content: string): Promise<string | null> {
    return null;
}
