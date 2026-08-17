import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { Buffer } from 'buffer';
const sharp = require('sharp');

export const REGION = "asia-south1";
export const SCHEDULED_MODEL = "gemini-2.5-flash";
export const PRO_MODEL = "gemini-2.5-flash";
export const FLASH_MODEL = "gemini-2.5-flash";
export const IMAGEN_MODEL = "gemini-3.1-flash-image";         // GA as of 2026
export const IMAGEN_FAST_MODEL = "gemini-3.1-flash-image";    // imagen-4.0 deprecated Aug 17, 2026

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
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-flash-lite"
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

            // INTERNAL RETRY LOOP for Exponential Backoff (3 attempts per model)
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

                    // 1. If we can retry the same model (e.g. rate limit wait or server busy)
                    const isRetryable = [503, 500, 504, 408, 429].includes(status) || 
                                        errMsg.includes("fetch") || 
                                        errMsg.includes("timeout") || 
                                        errMsg.includes("ECONNRESET") || 
                                        errMsg.includes("JSON") || 
                                        errMsg.includes("parsing");

                    if (isRetryable && attempt < MAX_RETRIES) {
                        const delay = Math.pow(2, attempt - 1) * 1000 + (Math.random() * 500); // 1s, 2s, 4s + Jitter
                        console.warn(`[RETRY] ${currentModelName} (${keyLabel}) attempt ${attempt}/${MAX_RETRIES} failed (${status || errMsg.substring(0, 50)}). Retrying in ${Math.round(delay)}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }

                    // 2. Key error (403, permission, or exhausted 429) -> Switch to next key
                    if ((status === 403 || status === 429) && k < keysToTry.length - 1) {
                        console.warn(`[KEY-FALLBACK] Key ${keyLabel} exhausted (${status}). Switching to next API key.`);
                        m = modelsToTry.length; // Move to next key
                        break;
                    }

                    // 3. Fallback to next model if available
                    if (m < modelsToTry.length - 1) {
                        console.warn(`[MODEL-FALLBACK] ${currentModelName} failed (${errMsg.substring(0, 100)}). Falling back to ${modelsToTry[m+1]}...`);
                        break; // Try next model
                    }

                    // If last model of current key, log and let outer loop try next key
                    console.warn(`[KEY-EXHAUSTED] Key ${keyLabel} and model ${currentModelName} exhausted: ${errMsg.substring(0, 100)}`);
                }
            }
        }
    }
    throw lastError || new Error("AI Fallback failed across all keys and models");
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

/**
 * Sanitizes Telugu text by converting any bled Kannada Unicode characters (0x0C80-0x0CFF)
 * back to Telugu, removing orphaned matras, broken placeholder glyphs, and zero-width spaces.
 */
export function sanitizeTeluguText(text: string): string {
    if (!text) return "";
    return text
        // 1. Map any bled Kannada Unicode characters (0x0C80-0x0CFF) to Telugu Unicode (0x0C00-0x0C7F)
        .replace(/[\u0C80-\u0CFF]/g, (char) => {
            const teluguCode = char.charCodeAt(0) - 0x0080;
            return String.fromCharCode(teluguCode);
        })
        // 2. Remove dotted circle characters used as fallback for broken combining marks
        .replace(/\u25CC/g, '')
        // 3. Remove invisible zero-width spaces that break Telugu word joining
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        // 4. Fix spaces before Telugu combining vowel marks / virama
        .replace(/\s+([\u0C01-\u0C03\u0C3E-\u0C4D\u0C55\u0C56\u0C62\u0C63])/g, '$1')
        .trim();
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

/**
 * Intelligently processes a news image:
 * 1. Converts to Black & White (grayscale) if flagged as bloody/graphic accident.
 * 2. Applies privacy protection blur if flagged as sensitive minor/POCSO/sexual assault victim or dead body.
 * 3. Auto-enhances brightness & dynamic contrast for dark night photos (normalize).
 * 4. Applies smart subtle sharpening to improve photo crispness.
 * 5. Smart-crops non-16:9 (vertical/square/4:3) images into a clean 16:9 frame keeping heads and salient subjects in view.
 * 6. Generates an optimized 16:9 image + fast thumbnail in WebP format.
 */
export async function processAndOptimizeNewsImage(
    imageUrl: string,
    postId: string,
    isGraphicOrBloody: boolean = false,
    isSensitiveVictimOrMinor: boolean = false
): Promise<{ optimizedUrl: string; thumbnailUrl: string } | null> {
    try {
        if (!imageUrl || !imageUrl.includes('firebasestorage.googleapis.com')) return null;

        console.log(`[IMG_OPT] Processing image for post ${postId} (Bloody: ${isGraphicOrBloody}, Sensitive: ${isSensitiveVictimOrMinor})...`);
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.error(`[IMG_OPT_ERR] Failed to download image: ${response.statusText}`);
            return null;
        }

        const contentType = response.headers.get('content-type') || "";
        if (!contentType.startsWith('image/')) {
            console.log(`[IMG_OPT] URL is not an image (Content-Type: ${contentType}). Skipping.`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const img = sharp(buffer);
        const metadata = await img.metadata();
        const width = metadata.width || 1280;
        const height = metadata.height || 720;
        const aspectRatio = width / height;

        // Base sharp pipeline
        let pipeline = sharp(buffer);

        // 1. Auto-enhance dynamic contrast & brightness for dark/night photos
        pipeline = pipeline.normalize();

        // 2. Convert to Black & White if graphic/bloody accident
        if (isGraphicOrBloody) {
            console.log(`[IMG_OPT] Converting graphic/bloody image to Grayscale (B&W) for post ${postId}`);
            pipeline = pipeline.grayscale();
        }

        // 3. Privacy protection for POCSO / Minors / Victims / Dead bodies
        if (isSensitiveVictimOrMinor) {
            console.log(`[IMG_OPT] Applying sensitive privacy protection blur for post ${postId}`);
            pipeline = pipeline.blur(18);
        } else {
            // Apply subtle sharpening for crisp journalism output when not blurred
            pipeline = pipeline.sharpen({ sigma: 1, m1: 0.5, m2: 0.5 });
        }

        // 4. Smart Crop to 16:9 if image is vertical, square, or 4:3 (aspectRatio < 1.6)
        // Using sharp.strategy.attention to keep faces and heads in frame
        if (aspectRatio < 1.6) {
            console.log(`[IMG_OPT] Non-16:9 image detected (${width}x${height}, ratio: ${aspectRatio.toFixed(2)}). Smart-cropping to 16:9 with head/attention preservation...`);
            pipeline = pipeline.resize({
                width: 1280,
                height: 720,
                fit: sharp.fit.cover,
                position: sharp.strategy.attention // Keeps faces and salient top-attention subjects
            });
        } else {
            // Already 16:9 or wide, normalize width to 1280 without cropping
            pipeline = pipeline.resize({
                width: 1280,
                height: Math.round(1280 / aspectRatio),
                withoutEnlargement: true
            });
        }

        const optimizedBuffer = await pipeline.webp({ quality: 85 }).toBuffer();

        // 5. Generate 16:9 Thumbnail (200px width)
        const thumbBuffer = await sharp(optimizedBuffer)
            .resize({ width: 200, withoutEnlargement: true })
            .webp({ quality: 65 })
            .toBuffer();

        const bucket = admin.storage().bucket();
        const optFileName = `news-media/${postId}_opt_${Date.now()}.webp`;
        const thumbFileName = `news-media/thumbnails/${postId}_thumb.webp`;

        await Promise.all([
            bucket.file(optFileName).save(optimizedBuffer, {
                metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' }
            }),
            bucket.file(thumbFileName).save(thumbBuffer, {
                metadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' }
            })
        ]);

        const optimizedUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(optFileName)}?alt=media`;
        const thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(thumbFileName)}?alt=media`;

        console.log(`[IMG_OPT] Optimized successfully -> Main: ${optimizedUrl.substring(0, 60)}..., Thumb: ${thumbnailUrl.substring(0, 60)}...`);
        return { optimizedUrl, thumbnailUrl };
    } catch (e: any) {
        console.error(`[IMG_OPT_ERR] Error optimizing image for ${postId}:`, e.message);
        return null;
    }
}

export async function createAndSaveThumbnail(imageUrl: string, postId: string): Promise<string | null> {
    const result = await processAndOptimizeNewsImage(imageUrl, postId, false);
    return result?.thumbnailUrl || null;
}

export async function generateImageWithRetry(
    aiUnused: any, // Keeping signature for compatibility
    prompt: string,
    aspectRatio: '1:1' | '9:16' | '16:9' | '3:4' | '4:3' = '9:16',
    retriesUnused = 3
): Promise<Buffer | null> {
    // NOTE: imagen-4.0-generate-001 is DEPRECATED (shutdown Aug 17, 2026)
    // Use gemini-3.1-flash-image (GA) as primary image model
    const modelsToTry = [
        "gemini-3.1-flash-image",          // ✅ GA - Primary
        "gemini-3.1-flash-image-preview",  // Preview fallback
        "imagen-3.0-generate-002"          // Legacy fallback (billing required)
    ];

    try {
        return await runWithAIFallback(async (ai, modelName) => {
            const isImagen = modelName.includes("imagen");

            // For Gemini models, we append aspect ratio to the prompt as they don't support the parameter yet
            const finalPrompt = isImagen ? prompt : `${prompt} [Aspect Ratio: ${aspectRatio}]`;

            const genConfig: any = {
                temperature: 0.9
            };

            // Gemini Native Image models MUST have these modalities
            if (!isImagen) {
                genConfig.responseModalities = ["TEXT", "IMAGE"];
            } else {
                // Imagen supports explicit aspect ratio
                genConfig.aspectRatio = aspectRatio.replace(":", "x"); // converts 16:9 to 16x9
            }

            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
                config: genConfig  // ✅ Fixed: @google/genai SDK uses 'config', not 'generationConfig'
            });

            if (response.candidates && response.candidates.length > 0) {
                const parts = response.candidates[0].content.parts;
                // Look for inlineData in any part (Gemini returns TEXT and IMAGE interleaved)
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
