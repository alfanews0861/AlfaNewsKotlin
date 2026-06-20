const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();

const genAI = new GoogleGenAI({
    apiKey: process.env.FREE_GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || "",
    apiVersion: "v1beta"
});

async function listModels() {
    const models = ["gemini-1.5-flash", "gemini-3.5-flash", "gemini-3.1-flash", "gemini-1.5-flash-8b"];
    for (const m of models) {
        try {
            console.log(`Checking ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("hi");
            console.log(`Success: ${m} is available. Response: ${result.response.text().substring(0, 10)}`);
        } catch (e) {
            console.error(`Fail: ${m} is NOT available. Error: ${e.message}`);
        }
    }
}

listModels();
