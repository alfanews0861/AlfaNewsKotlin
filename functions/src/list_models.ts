import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const genAI = new GoogleGenAI({
    apiKey: process.env.FREE_GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY || "",
    apiVersion: "v1beta"
});

async function listModels() {
    try {
        // The SDK doesn't have a direct listModels, but we can try to hit the REST endpoint or use a known model.
        console.log("Checking gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("test");
        console.log("gemini-1.5-flash is available");
    } catch (e: any) {
        console.error("Error with gemini-1.5-flash:", e.message);
    }

    try {
        console.log("Checking gemini-3.1-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash" });
        const result = await model.generateContent("test");
        console.log("gemini-3.1-flash is available");
    } catch (e: any) {
        console.error("Error with gemini-3.1-flash:", e.message);
    }
}

listModels();
