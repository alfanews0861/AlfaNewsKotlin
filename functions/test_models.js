const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({
    apiKey: process.env.API_KEY || 'AIzaSyAzmrl2_vOhQOhr_YUlS4EsvCriZP1OBxo',
    apiVersion: 'v1beta',
    httpOptions: { apiVersion: 'v1beta' }
});

async function run() {
    const modelsToTest = ['gemini-3.1-flash-lite-preview', 'gemini-3.1-flash-live-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash'];

    for (const model of modelsToTest) {
        try {
            console.log(`\n--- Testing ${model} ---`);
            const start = Date.now();
            const res = await ai.models.generateContent({
                model: model,
                contents: 'అమరావతి రాజధాని నిర్మాణం గురించి తెలుగులో ఒకే ఒక మంచి వాక్యం రాయండి.',
                config: { temperature: 0.3 }
            });
            const end = Date.now();
            console.log(`Time: ${end - start}ms`);
            console.log(`Output: ${res.text}`);
        } catch(e) {
            console.log(`Error: ${e.message}`);
        }
    }
}
run();