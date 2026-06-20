import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { Buffer } from 'buffer';
const sharp = require('sharp');

export const REGION = "asia-south1";
export const SCHEDULED_MODEL = "gemini-3.1-flash-lite";
export const PRO_MODEL = "gemini-3.1-flash";
export const FLASH_MODEL = "gemini-3.1-flash-lite";
export const IMAGEN_MODEL = "gemini-3.1-flash-image";
export const IMAGEN_FAST_MODEL = "gemini-3.1-flash-image";

const TEXT_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash",
    "gemini-3.0-flash"
];

/**
 * Priority list of API keys: Free 1 -> Free 2 -> Paid -> Legacy fallback
 */
const API_KEYS = [
    process.env.FREE_GEMINI_API_KEY_1,
    process.env.FREE_GEMINI_API_KEY_2,
    process.env.PAID_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.API_KEY
].filter(key => !!key) as string[];

/**
 * Internal helper to get a specific AI instance
 */
const getAIInstanceInternal = (apiKey: string) => new GoogleGenAI({
    apiKey,
    apiVersion: "v1"
});

/**
 * Core wrapper to run AI operations with automatic fallback across multiple keys AND models.
 */
export async function runWithAIFallback<T>(
    operation: (ai: any, modelName: string) => Promise<T>,
    customModels?: string[]
): Promise<T> {
    const keysToTry = API_KEYS.length > 0 ? API_KEYS : [process.env.GEMINI_API_KEY || process.env.API_KEY || ""];
    const modelsToTry = customModels || TEXT_MODELS;

    let lastError: any = null;

    for (let k = 0; k < keysToTry.length; k++) {
        const currentKey = keysToTry[k];
        const keyLabel = k === 0 ? "FREE_1" : k === 1 ? "FREE_2" : k === 2 ? "PAID" : "FALLBACK";
        const ai = getAIInstanceInternal(currentKey);

        for (let m = 0; m < modelsToTry.length; m++) {
            const currentModel = modelsToTry[m];

            try {
                return await operation(ai, currentModel);
            } catch (err: any) {
                lastError = err;
                const status = err.status || (err.message?.includes("429") ? 429 : (err.message?.includes("404") ? 404 : 0));

                // If model not found, try next model with same key
                if (status === 404 && m < modelsToTry.length - 1) {
                    console.warn(`[MODEL-FALLBACK] Model ${currentModel} failed (404) with key ${keyLabel}. Trying ${modelsToTry[m+1]}...`);
                    continue;
                }

                const isQuotaError = status === 429 ||
                                   err.message?.toLowerCase().includes("quota") ||
                                   err.message?.toLowerCase().includes("limit") ||
                                   err.message?.toLowerCase().includes("billing");

                // If quota error, break model loop to switch key
                if (isQuotaError && k < keysToTry.length - 1) {
                    console.warn(`[KEY-FALLBACK] Key ${keyLabel} failed with quota error using ${currentModel}. Switching to next key.`);
                    break;
                }

                // IMPORTANT: If NOT a quota error (e.g. 400, 404, Schema Error), DO NOT switch keys.
                // Log and throw the error to be handled by the caller or retry within same key.
                console.error(`[AI-ERROR] Permanent error with key ${keyLabel} and model ${currentModel}:`, err.message);
                throw err;
            }
        }
    }
    throw lastError || new Error("AI Fallback failed with no keys/models");
}

export const getAIInstance = () => getAIInstanceInternal(API_KEYS[0] || process.env.GEMINI_API_KEY || process.env.API_KEY || "");


export function getISTDateString() {
    const now = new Date();
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
}

export function parseAIJson(text: string) {
    let cleanText = text.trim();

    // 1. Handle Markdown Code Blocks
    if (cleanText.includes('```')) {
        const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
            cleanText = match[1].trim();
        }
    }

    // 2. Extract JSON using bracket matching if preamble exists
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }

    try {
        return JSON.parse(cleanText);
    } catch(e: any) {
        console.error("JSON parse error. Extracted text:", cleanText.substring(0, 200));
        console.error("Original raw text:", text.substring(0, 200));
        throw new Error(`Invalid AI JSON response: ${e.message}`);
    }
}

export async function saveBufferToStorage(buffer: Buffer, prefix: string): Promise<string | null> {
    try {
        const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
        const bucket = admin.storage().bucket();
        const fileName = `news-media/${prefix}_${Date.now()}.webp`;
        await bucket.file(fileName).save(webpBuffer, {
            metadata: { contentType: 'image/webp' }
        });
        return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
    } catch (e) {
        console.error("Buffer save error:", e);
        return null;
    }
}

export async function saveImageLocally(externalUrl: string, prefix: string): Promise<string | null> {
    try {
        const response = await fetch(externalUrl);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return await saveBufferToStorage(Buffer.from(arrayBuffer), prefix);
    } catch (e) {
        console.error("External image save error:", e);
        return null;
    }
}

export async function generateImageWithRetry(
    aiUnused: any, // Keeping signature but using internal fallback
    prompt: string,
    aspectRatio: '1:1' | '9:16' | '16:9' | '3:4' | '4:3' = '9:16',
    retries = 3
): Promise<Buffer | null> {
    return await runWithAIFallback(async (ai) => {
        const modelsToTry = [IMAGEN_MODEL, "imagen-3.0-generate-001"];

        for (const currentModel of modelsToTry) {
            const isGemini = currentModel.startsWith("gemini-");

            for (let i = 0; i < retries; i++) {
                try {
                    console.log(`[AI_IMAGE] Attempt ${i + 1} using ${currentModel} for prompt: ${prompt.substring(0, 50)}...`);

                    if (isGemini) {
                        const imgRes = await ai.models.generateContent({
                            model: currentModel,
                            contents: [{ role: "user", parts: [{ text: prompt }] }],
                            config: {
                                responseModalities: ["IMAGE"],
                                imageConfig: {
                                    aspectRatio: aspectRatio,
                                    imageSize: '1K'
                                }
                            }
                        } as any);

                        const imagePart = imgRes.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
                        if (imagePart?.inlineData?.data) {
                            console.log(`[AI_IMAGE] Success with ${currentModel}`);
                            return Buffer.from(imagePart.inlineData.data, 'base64');
                        }
                    } else {
                        const imgRes = await ai.models.generateImages({
                            model: currentModel,
                            prompt: prompt,
                            config: {
                                numberOfImages: 1,
                                aspectRatio: aspectRatio,
                                safetyFilterLevel: 'BLOCK_ONLY_HIGH',
                                personGeneration: 'ALLOW_ALL',
                                includeRaiReason: true
                            }
                        });

                        if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                            console.log(`[AI_IMAGE] Success with ${currentModel}`);
                            return Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                        }
                    }

                    console.warn(`[AI_IMAGE] Attempt ${i + 1} (${currentModel}) returned no images.`);

                    if (i < retries - 1) {
                        const delay = Math.pow(2, i) * 2000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                } catch (err: any) {
                    console.error(`[AI_IMAGE] Attempt ${i + 1} (${currentModel}) failed:`, err.message);
                    if (i === retries - 1 && currentModel === modelsToTry[modelsToTry.length - 1]) throw err; // Re-throw to trigger key fallback
                    const delay = Math.pow(2, i) * 3000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        return null;
    });
}
