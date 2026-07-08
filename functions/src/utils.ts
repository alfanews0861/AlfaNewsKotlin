import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { Buffer } from 'buffer';
const sharp = require('sharp');

export const REGION = "asia-south1";
export const SCHEDULED_MODEL = "gemini-3.1-flash-lite";
export const PRO_MODEL = "gemini-3.1-flash-lite";
export const FLASH_MODEL = "gemini-3.1-flash-lite";
export const IMAGEN_MODEL = "gemini-3.1-flash-image";
export const IMAGEN_FAST_MODEL = "gemini-3.1-flash-image";

/**
 * Converts any string into a safe FCM topic name.
 * FCM supports: [a-zA-Z0-9-_.~%]+
 * We use hex encoding for non-alphanumeric characters to ensure uniqueness and compatibility.
 */
export function slugify(text: string): string {
    if (!text) return "default";

    // Allow alphanumeric, dash, underscore, dot, tilde, and percent
    // But for safety with Telugu, we hex-encode everything that isn't basic ASCII
    return text.split('').map(char => {
        const code = char.charCodeAt(0);
        // Safe ASCII: a-z, A-Z, 0-9
        if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
            return char;
        }
        // Encode everything else as hex
        return code.toString(16).padStart(4, '0');
    }).join('').substring(0, 80); // FCM Limit is 900, but let's keep it sane
}

export function getTopicName(prefix: string, value: string): string {
    return `${prefix}_${slugify(value)}`;
}

const TEXT_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash"
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
 * Safety flag to prevent unexpected billing.
 * Set to true only if you want to allow falling back to the PAID_GEMINI_API_KEY.
 */
const PAID_FALLBACK_ENABLED = process.env.PAID_FALLBACK_ENABLED === "true";

/**
 * Internal helper to get a specific AI instance
 */
const getAIInstanceInternal = (apiKey: string) => new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta"
});

/**
 * Helper to extract HTTP status code from various types of SDK errors
 */
function extractErrorStatus(err: any): number {
    if (!err) return 0;

    // 1. Direct properties
    if (typeof err.status === 'number') return err.status;
    if (typeof err.code === 'number') return err.code;

    // 2. Nested properties (Common in Gemini/Firebase SDKs)
    if (err.error && typeof err.error.code === 'number') return err.error.code;
    if (err.response && typeof err.response.status === 'number') return err.response.status;

    // 3. String-based detection (Fallback)
    const errStr = JSON.stringify(err).toLowerCase();
    const msg = String(err.message || "").toLowerCase();
    const fullSearch = msg + " " + errStr;

    if (fullSearch.includes("429") || fullSearch.includes("quota") || fullSearch.includes("limit") || fullSearch.includes("exhausted")) return 429;
    if (fullSearch.includes("503") || fullSearch.includes("unavailable") || fullSearch.includes("demand") || fullSearch.includes("overloaded")) return 503;
    if (fullSearch.includes("404") || fullSearch.includes("not found")) return 404;
    if (fullSearch.includes("500") || fullSearch.includes("internal server error")) return 500;
    if (fullSearch.includes("504") || fullSearch.includes("deadline") || fullSearch.includes("timeout")) return 504;
    if (fullSearch.includes("403") || fullSearch.includes("permission") || fullSearch.includes("forbidden")) return 403;

    return 0;
}

/**
 * Core wrapper to run AI operations with automatic fallback across multiple keys AND models.
 * Integrated with Exponential Backoff for 503/500 errors.
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
        const isPaidKey = currentKey === process.env.PAID_GEMINI_API_KEY;

        if (isPaidKey && !PAID_FALLBACK_ENABLED) {
            console.warn(`[AI-SKIP] Paid key detected but PAID_FALLBACK_ENABLED is false. Skipping.`);
            continue;
        }

        const keyLabel = k === 0 ? "FREE_1" : k === 1 ? "FREE_2" : k === 2 ? "PAID" : "FALLBACK";
        const ai = getAIInstanceInternal(currentKey);

        for (let m = 0; m < modelsToTry.length; m++) {
            const currentModelName = modelsToTry[m];

            // INTERNAL RETRY LOOP for Exponential Backoff (Official Recommendation)
            const MAX_RETRIES = 3;
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    const result = await operation(ai, currentModelName);
                    if (m > 0 || k > 0 || attempt > 1) {
                        console.log(`[AI-SUCCESS] Model ${currentModelName} (${keyLabel}) succeeded on attempt ${attempt}.`);
                    }
                    return result;
                } catch (err: any) {
                    lastError = err;
                    const status = extractErrorStatus(err);
                    const errMsg = String(err.message || "Unknown error");

                    // 1. Transient Server Errors (503, 500, 504, 408) -> RETRY SAME MODEL
                    const isRetryable = [503, 500, 504, 408].includes(status);
                    if (isRetryable && attempt < MAX_RETRIES) {
                        const delay = Math.pow(2, attempt - 1) * 1000 + (Math.random() * 500); // 1s, 2s, 4s + Jitter
                        console.warn(`[RETRY] ${currentModelName} failed (${status}). Attempt ${attempt}/${MAX_RETRIES}. Waiting ${Math.round(delay)}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue; // Try same model again
                    }

                    // 2. Model Errors (404, or exhausted retries) -> FALLBACK TO NEXT MODEL
                    const isModelError = status === 404 || isRetryable;
                    if (isModelError && m < modelsToTry.length - 1) {
                        console.warn(`[MODEL-FALLBACK] ${currentModelName} failed (${status}) after ${attempt} attempts. Trying ${modelsToTry[m+1]}...`);
                        break; // Breaks the retry loop to try next model in outer loop
                    }

                    // 3. Key/Account Errors (429, 403) -> FALLBACK TO NEXT KEY
                    const isKeyError = status === 429 || status === 403;
                    if (isKeyError && k < keysToTry.length - 1) {
                        console.warn(`[KEY-FALLBACK] Key ${keyLabel} failed (${status}). Switching to next key.`);
                        m = modelsToTry.length; // Force break outer model loop
                        break; // Breaks retry loop
                    }

                    // 4. JSON/Truncation Errors (if operation throws for parsing) -> FALLBACK
                    const isDataError = errMsg.includes("JSON") || errMsg.includes("parsing") || errMsg.includes("Unterminated");
                    if (isDataError && m < modelsToTry.length - 1) {
                        console.warn(`[DATA-FALLBACK] ${currentModelName} failed (${errMsg}). Trying ${modelsToTry[m+1]}...`);
                        break;
                    }

                    // 5. Fatal/Unknown Errors
                    console.error(`[AI-FATAL-FINAL] Error with ${currentModelName} (${keyLabel}). Status: ${status}. Message: ${errMsg.substring(0, 100)}`);
                    throw err;
                }
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
            metadata: {
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000'
            }
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
    aiUnused: any, // Keeping signature for compatibility
    prompt: string,
    aspectRatio: '1:1' | '9:16' | '16:9' | '3:4' | '4:3' = '9:16',
    retriesUnused = 3
): Promise<Buffer | null> {
    const modelsToTry = [IMAGEN_MODEL, "imagen-3.0-generate-002", "imagen-3.0-generate-001"];

    try {
        return await runWithAIFallback(async (ai, modelName) => {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    // @ts-ignore - responseModalities is newer
                    responseModalities: ["IMAGE"],
                }
            });

            if (response.candidates && response.candidates.length > 0) {
                const parts = response.candidates[0].content.parts;
                const imagePart = parts.find((p: any) => p.inlineData);
                if (imagePart && imagePart.inlineData) {
                    return Buffer.from(imagePart.inlineData.data, 'base64');
                }
            }

            throw new Error(`Model ${modelName} returned no image data`);
        }, modelsToTry);
    } catch (e: any) {
        console.error("[IMAGE_GEN_ERROR] All attempts failed:", e.message);
        return null;
    }
}
