const { GoogleGenAI } = require('@google/genai');

// Use env var or the fallback from existing test_models.js
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || 'AIzaSyAzmrl2_vOhQOhr_YUlS4EsvCriZP1OBxo';

const ai = new GoogleGenAI({
    apiKey: apiKey,
    apiVersion: 'v1beta'
});

async function run() {
    const textModels = ['gemini-3.1-flash'];
    const imageModels = ['imagen-4.0-ultra-generate-001', 'imagen-4.0-generate-001', 'imagen-3.0-generate-002'];

    console.log("=== Testing Text Models ===");
    for (const model of textModels) {
        try {
            console.log(`\nTesting ${model}...`);
            const res = await ai.models.generateContent({
                model: model,
                contents: [{ role: 'user', parts: [{ text: 'Hello, confirm your model version.' }] }]
            });
            console.log(`Success: ${res.text.substring(0, 100)}...`);
        } catch(e) {
            console.log(`Error ${model}: ${e.message}`);
        }
    }

    console.log("\n=== Testing Image Models (Imagen) ===");
    for (const model of imageModels) {
        try {
            console.log(`\nTesting ${model}...`);
            const res = await ai.models.generateImages({
                model: model,
                prompt: 'A beautiful traditional Telugu lamp (Deepam) on a floral background, artistic digital painting, no text.',
                config: {
                    numberOfImages: 1,
                    aspectRatio: '1:1',
                    safetyFilterLevel: 'block_only_high',
                    personGeneration: 'allow_all'
                }
            });
            if (res.generatedImages && res.generatedImages[0]) {
                console.log(`Success: Image generated with ${model}`);
            } else {
                console.log(`Failed: No image returned for ${model}`);
            }
        } catch(e) {
            console.log(`Error ${model}: ${e.message}`);
        }
    }
}
run();
