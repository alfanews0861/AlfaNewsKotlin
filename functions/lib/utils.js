"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIInstance = exports.IMAGEN_FAST_MODEL = exports.IMAGEN_MODEL = exports.FLASH_MODEL = exports.PRO_MODEL = exports.SCHEDULED_MODEL = exports.REGION = void 0;
exports.runWithAIFallback = runWithAIFallback;
exports.getISTDateString = getISTDateString;
exports.parseAIJson = parseAIJson;
exports.saveBufferToStorage = saveBufferToStorage;
exports.saveImageLocally = saveImageLocally;
exports.generateImageWithRetry = generateImageWithRetry;
const admin = __importStar(require("firebase-admin"));
const genai_1 = require("@google/genai");
const buffer_1 = require("buffer");
const sharp = require('sharp');
exports.REGION = "asia-south1";
exports.SCHEDULED_MODEL = "gemini-3.1-flash-lite";
exports.PRO_MODEL = "gemini-3.1-flash-lite";
exports.FLASH_MODEL = "gemini-3.1-flash-lite";
exports.IMAGEN_MODEL = "gemini-3.1-flash-image";
exports.IMAGEN_FAST_MODEL = "gemini-3.1-flash-image";
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
].filter(key => !!key);
/**
 * Safety flag to prevent unexpected billing.
 * Set to true only if you want to allow falling back to the PAID_GEMINI_API_KEY.
 */
const PAID_FALLBACK_ENABLED = process.env.PAID_FALLBACK_ENABLED === "true";
/**
 * Internal helper to get a specific AI instance
 */
const getAIInstanceInternal = (apiKey) => new genai_1.GoogleGenAI({
    apiKey,
    apiVersion: "v1beta"
});
/**
 * Helper to extract HTTP status code from various types of SDK errors
 */
function extractErrorStatus(err) {
    if (!err)
        return 0;
    // 1. Direct properties
    if (typeof err.status === 'number')
        return err.status;
    if (typeof err.code === 'number')
        return err.code;
    // 2. Nested properties (Common in Gemini/Firebase SDKs)
    if (err.error && typeof err.error.code === 'number')
        return err.error.code;
    if (err.response && typeof err.response.status === 'number')
        return err.response.status;
    // 3. String-based detection (Fallback)
    const errStr = JSON.stringify(err).toLowerCase();
    const msg = String(err.message || "").toLowerCase();
    const fullSearch = msg + " " + errStr;
    if (fullSearch.includes("429") || fullSearch.includes("quota") || fullSearch.includes("limit") || fullSearch.includes("exhausted"))
        return 429;
    if (fullSearch.includes("503") || fullSearch.includes("unavailable") || fullSearch.includes("demand") || fullSearch.includes("overloaded"))
        return 503;
    if (fullSearch.includes("404") || fullSearch.includes("not found"))
        return 404;
    if (fullSearch.includes("500") || fullSearch.includes("internal server error"))
        return 500;
    if (fullSearch.includes("504") || fullSearch.includes("deadline") || fullSearch.includes("timeout"))
        return 504;
    if (fullSearch.includes("403") || fullSearch.includes("permission") || fullSearch.includes("forbidden"))
        return 403;
    return 0;
}
/**
 * Core wrapper to run AI operations with automatic fallback across multiple keys AND models.
 * Integrated with Exponential Backoff for 503/500 errors.
 */
async function runWithAIFallback(operation, customModels) {
    const keysToTry = API_KEYS.length > 0 ? API_KEYS : [process.env.GEMINI_API_KEY || process.env.API_KEY || ""];
    const modelsToTry = customModels || TEXT_MODELS;
    let lastError = null;
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
                }
                catch (err) {
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
                        console.warn(`[MODEL-FALLBACK] ${currentModelName} failed (${status}) after ${attempt} attempts. Trying ${modelsToTry[m + 1]}...`);
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
                        console.warn(`[DATA-FALLBACK] ${currentModelName} failed (${errMsg}). Trying ${modelsToTry[m + 1]}...`);
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
const getAIInstance = () => getAIInstanceInternal(API_KEYS[0] || process.env.GEMINI_API_KEY || process.env.API_KEY || "");
exports.getAIInstance = getAIInstance;
function getISTDateString() {
    const now = new Date();
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
}
function parseAIJson(text) {
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
    }
    catch (e) {
        console.error("JSON parse error. Extracted text:", cleanText.substring(0, 200));
        console.error("Original raw text:", text.substring(0, 200));
        throw new Error(`Invalid AI JSON response: ${e.message}`);
    }
}
async function saveBufferToStorage(buffer, prefix) {
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
    }
    catch (e) {
        console.error("Buffer save error:", e);
        return null;
    }
}
async function saveImageLocally(externalUrl, prefix) {
    try {
        const response = await fetch(externalUrl);
        if (!response.ok)
            return null;
        const arrayBuffer = await response.arrayBuffer();
        return await saveBufferToStorage(buffer_1.Buffer.from(arrayBuffer), prefix);
    }
    catch (e) {
        console.error("External image save error:", e);
        return null;
    }
}
async function generateImageWithRetry(aiUnused, // Keeping signature for compatibility
prompt, aspectRatio = '9:16', retriesUnused = 3) {
    const modelsToTry = [exports.IMAGEN_MODEL, "imagen-3.0-generate-002", "imagen-3.0-generate-001"];
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
                const imagePart = parts.find((p) => p.inlineData);
                if (imagePart && imagePart.inlineData) {
                    return buffer_1.Buffer.from(imagePart.inlineData.data, 'base64');
                }
            }
            throw new Error(`Model ${modelName} returned no image data`);
        }, modelsToTry);
    }
    catch (e) {
        console.error("[IMAGE_GEN_ERROR] All attempts failed:", e.message);
        return null;
    }
}
//# sourceMappingURL=utils.js.map