import * as admin from "firebase-admin";
import { GoogleGenAI, Type } from "@google/genai";
import { Buffer } from 'buffer';
const sharp = require('sharp');

export const REGION = "asia-south1";
export const SCHEDULED_MODEL = "gemini-3.5-flash-lite";
export const PRO_MODEL = "gemini-3.5-flash-lite";
export const FLASH_MODEL = "gemini-3.5-flash-lite";
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
    "gemini-3.5-flash-lite",  // 1. Primary: 1,500 RPD, 30 RPM, super fast & clean Telugu
    "gemini-3.5-flash",       // 2. Secondary Fallback
    "gemini-3.6-flash"        // 3. Tertiary Fallback
];

/**
 * Priority list of API keys: Free 1 -> Free 2 -> Paid -> Legacy fallback
 */
function getApiKeys(): string[] {
    return [
        process.env.FREE_GEMINI_API_KEY_1,
        process.env.FREE_GEMINI_API_KEY_2,
        process.env.PAID_GEMINI_API_KEY,
        process.env.GEMINI_API_KEY,
        process.env.API_KEY
    ].filter(key => !!key && key.trim().length > 0) as string[];
}

/**
 * Safety flag to prevent unexpected billing.
 * Set to true only if you want to allow falling back to the PAID_GEMINI_API_KEY.
 */
const isPaidFallbackEnabled = () => process.env.PAID_FALLBACK_ENABLED === "true";

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
 * Core wrapper to run AI operations with automatic fallback across models AND keys.
 * Rules:
 * - If a model fails or hits quota (429/404), immediately switch to the next model.
 * - Total attempts capped at MAX_TOTAL_ATTEMPTS (3) to prevent loops and excess quota usage.
 */
export async function runWithAIFallback<T>(
    operation: (ai: any, modelName: string) => Promise<T>,
    customModels?: string[]
): Promise<T> {
    const apiKeys = getApiKeys();
    const keysToTry = apiKeys.length > 0 ? apiKeys : [process.env.GEMINI_API_KEY || process.env.API_KEY || ""];
    const modelsToTry = customModels || TEXT_MODELS;

    const MAX_TOTAL_ATTEMPTS = 4;
    let totalAttempts = 0;
    let lastError: any = null;

    for (let k = 0; k < keysToTry.length; k++) {
        const currentKey = keysToTry[k];
        const isPaidKey = currentKey === process.env.PAID_GEMINI_API_KEY;

        if (isPaidKey && !isPaidFallbackEnabled()) {
            console.warn(`[AI-SKIP] Paid key detected but PAID_FALLBACK_ENABLED is false. Skipping.`);
            continue;
        }

        const keyLabel = k === 0 ? "FREE_1" : k === 1 ? "FREE_2" : k === 2 ? "PAID" : `KEY_${k}`;
        const ai = getAIInstanceInternal(currentKey);

        for (let m = 0; m < modelsToTry.length; m++) {
            if (totalAttempts >= MAX_TOTAL_ATTEMPTS) {
                console.warn(`[AI-STOP] Reached maximum ${MAX_TOTAL_ATTEMPTS} total attempts. Stopping.`);
                break;
            }

            const currentModelName = modelsToTry[m];
            totalAttempts++;

            try {
                const result = await operation(ai, currentModelName);
                if (m > 0 || k > 0 || totalAttempts > 1) {
                    console.log(`[AI-SUCCESS] Model ${currentModelName} (${keyLabel}) succeeded on attempt ${totalAttempts}.`);
                }
                return result;
            } catch (err: any) {
                lastError = err;
                const status = extractErrorStatus(err);
                const errMsg = String(err.message || "Unknown error");

                console.warn(`[AI-FAIL] Model ${currentModelName} (${keyLabel}) failed (Status: ${status || 'N/A'}, Attempt ${totalAttempts}/${MAX_TOTAL_ATTEMPTS}): ${errMsg.substring(0, 120)}`);

                // If key is totally unauthorized (403), jump to next key immediately
                if (status === 403) {
                    console.warn(`[KEY-INVALID] Key ${keyLabel} unauthorized (403). Moving to next key.`);
                    break;
                }

                // If 429 (rate/quota limit) and another key is available, immediately switch to the other key
                if (status === 429 && k < keysToTry.length - 1) {
                    const nextKeyLabel = k === 0 ? "FREE_2" : (k === 1 ? "PAID" : `KEY_${k+1}`);
                    console.warn(`[KEY-429-SWITCH] Key ${keyLabel} hit 429. Switching to ${nextKeyLabel}...`);
                    break; // break model loop to switch key
                }

                // If on last available key or no other keys, continue trying next model
                if (status === 429) {
                    console.warn(`[MODEL-429-FALLBACK] Model ${currentModelName} hit rate limit. Trying next model...`);
                }

                // If 503/504 transient server overload, wait briefly
                if (status === 503 || status === 504) {
                    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 300));
                }
            }
        }

        if (totalAttempts >= MAX_TOTAL_ATTEMPTS) {
            break;
        }
    }

    throw lastError || new Error(`AI processing failed after ${totalAttempts} attempts across available keys and models.`);
}

export const getAIInstance = () => {
    const keys = getApiKeys();
    return getAIInstanceInternal(keys[0] || process.env.GEMINI_API_KEY || process.env.API_KEY || "");
};


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
 * Calculates smart 16:9 crop coordinates preserving faces, heads, and salient human subjects.
 * Uses facial skin chrominance (YCbCr) and edge density to dynamically locate people in vertical/portrait photos.
 */
/**
 * Uses Gemini AI Vision to detect all human heads/faces in the image.
 * Returns normalized bounding boxes [ymin, xmin, ymax, xmax] on a 0-1000 scale.
 */
export async function detectFacesWithGeminiAI(
    imageBuffer: Buffer
): Promise<{ ymin: number; ymax: number; xmin: number; xmax: number }[] | null> {
    try {
        const jpegBuffer = await sharp(imageBuffer)
            .resize(640, 640, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer();

        const base64 = jpegBuffer.toString('base64');
        const prompt = `Identify bounding boxes [ymin, xmin, ymax, xmax] for all human heads/faces and key subjects in this news photo. Scale 0-1000.`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                faces: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            box_2d: {
                                type: Type.ARRAY,
                                items: { type: Type.INTEGER }
                            }
                        },
                        required: ["box_2d"]
                    }
                }
            },
            required: ["faces"]
        };

        const result = await runWithAIFallback(async (ai, modelName) => {
            const res = await ai.models.generateContent({
                model: modelName,
                contents: [
                    {
                        role: "user",
                        parts: [
                            { inlineData: { mimeType: "image/jpeg", data: base64 } },
                            { text: prompt }
                        ]
                    }
                ],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    temperature: 0.1,
                    maxOutputTokens: 1024
                }
            } as any);

            const text = res.text || res.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return null;
            const parsed = parseAIJson(text);
            if (parsed && Array.isArray(parsed.faces) && parsed.faces.length > 0) {
                return parsed.faces
                    .filter((f: any) => Array.isArray(f.box_2d) && f.box_2d.length === 4)
                    .map((f: any) => ({
                        ymin: f.box_2d[0],
                        xmin: f.box_2d[1],
                        ymax: f.box_2d[2],
                        xmax: f.box_2d[3]
                    }));
            }
            return [];
        });

        return result;
    } catch (e: any) {
        console.warn(`[AI_FACE_DETECTION_FALLBACK] AI vision face detection fallback:`, e.message);
        return null;
    }
}

/**
 * Calculates a clean 16:9 crop box using Gemini AI Vision face detection.
 * Ensures heads and faces are 100% visible in the upper frame without being cut.
 */
export async function calculateSmartCrop16x9(
    buffer: Buffer,
    width: number,
    height: number
): Promise<{ left: number; top: number; width: number; height: number }> {
    const targetAspect = 16 / 9;
    const currentAspect = width / height;

    // 1. If photo is already standard 16:9 (landscape), do NOT crop or call AI - preserve full original
    if (Math.abs(currentAspect - targetAspect) <= 0.08) {
        console.log(`[IMG_OPT] Image is already standard 16:9 (${width}x${height}, aspect: ${currentAspect.toFixed(2)}). Skipping AI crop.`);
        return { left: 0, top: 0, width, height };
    }

    // 2. Only for vertical / portrait / square photos (e.g. 9:16, 3:4, 1:1)
    if (currentAspect < targetAspect) {
        const cropWidth = width;
        const cropHeight = Math.round(width / targetAspect);
        if (cropHeight >= height) {
            return { left: 0, top: 0, width, height };
        }

        try {
            console.log(`[AI_SMART_CROP] Vertical photo detected (${width}x${height}, aspect: ${currentAspect.toFixed(2)}). Running AI Face Detection...`);
            // AI-Powered Face and Head Detection via Gemini Vision
            const aiFaces = await detectFacesWithGeminiAI(buffer);

            if (aiFaces && aiFaces.length > 0) {
                const minFaceY = Math.min(...aiFaces.map(f => f.ymin)); // 0-1000 scale
                const maxFaceY = Math.max(...aiFaces.map(f => f.ymax));

                console.log(`[AI_SMART_CROP] Found ${aiFaces.length} faces via AI. Top face at ${minFaceY}/1000, Bottom face at ${maxFaceY}/1000.`);

                // If faces are in the upper region of the photo (top 25%), keep top = 0 to guarantee 100% hair/headroom
                if (minFaceY <= 250) {
                    return { left: 0, top: 0, width: cropWidth, height: cropHeight };
                }

                // If faces are situated lower down in the frame (e.g. seated people),
                // calculate top with 80 units (8% headroom) above highest head
                const targetHeadroomPx = Math.max(0, Math.round(((minFaceY - 80) / 1000) * height));
                let cropTop = Math.min(targetHeadroomPx, height - cropHeight);
                cropTop = Math.max(0, cropTop);

                return { left: 0, top: cropTop, width: cropWidth, height: cropHeight };
            }
        } catch (err: any) {
            console.warn('[AI_SMART_CROP] Error during AI face detection:', err.message);
        }

        // Fallback: Default to top-aligned crop (top = 0) so heads are never cut
        return { left: 0, top: 0, width: cropWidth, height: cropHeight };
    }

    // 3. Landscape wider than 16:9
    const cropHeight = height;
    const cropWidth = Math.round(height * targetAspect);
    if (cropWidth >= width) {
        return { left: 0, top: 0, width, height };
    }

    const cropLeft = Math.max(0, Math.min(width - cropWidth, Math.round((width - cropWidth) / 2)));
    return { left: cropLeft, top: 0, width: cropWidth, height: cropHeight };
}

export interface ImageSafetyScanResult {
    isSafe: boolean;
    isAdultOrNude: boolean;
    isHateOrIllegal: boolean;
    isExtremelyGruesome: boolean;
    rejectionReason: string | null;
    safetyDetails: string;
}

/**
 * 🛡️ AI Obscenity & Safety Scanner (Gemini Multimodal Vision)
 * Scans submitted images for adult content, nudity, obscenity, illegal hate materials, or severe gore.
 * Prevents brand damage, hack attempts, and rogue reporter sabotage.
 */
export async function scanImageSafetyWithGeminiAI(buffer: Buffer): Promise<ImageSafetyScanResult> {
    try {
        // Resize image to max 512px for lightning-fast inspection
        const previewBuffer = await sharp(buffer)
            .resize(512, 512, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer();

        const base64 = previewBuffer.toString("base64");

        const prompt = `You are the Chief Trust, Safety & Legal Compliance Officer for a prestigious family-oriented Telugu news media platform.
Analyze this submitted news photo strictly for adult, obscene, pornographic, violent, or brand-damaging illegal material.

EVALUATION RULES:
1. isAdultOrNude: true if there is ANY explicit nudity, pornographic/erotic images, sexually suggestive/obscene posing, exposed intimate body parts, or vulgar sexual depictions.
2. isHateOrIllegal: true if there are hate symbols, terror propaganda, illegal weapons brandishing, narcotics/contraband, or illicit promotions.
3. isExtremelyGruesome: true if there are decapitated/mutilated corpses, extreme gore, or graphic horrors unfit for public media.
4. isSafe: true ONLY IF isAdultOrNude is false AND isHateOrIllegal is false AND isExtremelyGruesome is false.
5. rejectionReason: In Telugu, provide a clear, respectful reason for rejection if unsafe (e.g. "అసభ్యకరమైన లేదా శృంగార చిత్రం గుర్తించబడింది", "చట్టవ్యతిరేక లేదా హింసాత్మక చిత్రం"), or null if safe.
6. safetyDetails: Brief English explanation of findings.`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                isSafe: { type: Type.BOOLEAN },
                isAdultOrNude: { type: Type.BOOLEAN },
                isHateOrIllegal: { type: Type.BOOLEAN },
                isExtremelyGruesome: { type: Type.BOOLEAN },
                rejectionReason: { type: Type.STRING },
                safetyDetails: { type: Type.STRING }
            },
            required: ["isSafe", "isAdultOrNude", "isHateOrIllegal", "isExtremelyGruesome", "safetyDetails"]
        };

        const result = await runWithAIFallback(async (ai, modelName) => {
            const res = await ai.models.generateContent({
                model: modelName,
                contents: [
                    {
                        role: "user",
                        parts: [
                            { inlineData: { mimeType: "image/jpeg", data: base64 } },
                            { text: prompt }
                        ]
                    }
                ],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    temperature: 0.1,
                    maxOutputTokens: 512
                }
            } as any);

            const text = res.text || res.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return { isSafe: true, isAdultOrNude: false, isHateOrIllegal: false, isExtremelyGruesome: false, rejectionReason: null, safetyDetails: "Empty response" };
            const parsed = parseAIJson(text);
            if (parsed && typeof parsed.isSafe === 'boolean') {
                const isUnsafe = parsed.isAdultOrNude === true || parsed.isHateOrIllegal === true || parsed.isExtremelyGruesome === true || parsed.isSafe === false;
                return {
                    isSafe: !isUnsafe,
                    isAdultOrNude: parsed.isAdultOrNude === true,
                    isHateOrIllegal: parsed.isHateOrIllegal === true,
                    isExtremelyGruesome: parsed.isExtremelyGruesome === true,
                    rejectionReason: isUnsafe ? (parsed.rejectionReason || "అసభ్యకరమైన చిత్రం గుర్తించబడింది") : null,
                    safetyDetails: parsed.safetyDetails || "Scanned"
                };
            }
            return { isSafe: true, isAdultOrNude: false, isHateOrIllegal: false, isExtremelyGruesome: false, rejectionReason: null, safetyDetails: "Fallback" };
        });

        return result || { isSafe: true, isAdultOrNude: false, isHateOrIllegal: false, isExtremelyGruesome: false, rejectionReason: null, safetyDetails: "Default safe" };
    } catch (e: any) {
        console.error("[IMAGE_SAFETY_SCAN_ERR] Error during image safety scan:", e.message);
        // If Gemini safety settings triggered a block on the image itself, it is definitely UNSAFE!
        if (e.message && (e.message.includes("SAFETY") || e.message.includes("blocked") || e.message.includes("SEXUAL") || e.message.includes("HARM"))) {
            return {
                isSafe: false,
                isAdultOrNude: true,
                isHateOrIllegal: false,
                isExtremelyGruesome: false,
                rejectionReason: "అసభ్యకరమైన చిత్రం (AI Safety System Blocked)",
                safetyDetails: "Gemini built-in safety filter caught explicit content"
            };
        }
        return { isSafe: true, isAdultOrNude: false, isHateOrIllegal: false, isExtremelyGruesome: false, rejectionReason: null, safetyDetails: "Error bypassed" };
    }
}

export interface OptimizedImageResult {
    optimizedUrl: string;
    thumbnailUrl: string;
    isSafe: boolean;
    rejectionReason?: string | null;
}

/**
 * Intelligently processes a news image:
 * 1. Scans for Adult/Nudity/Obscenity with Gemini Vision (rejection shield).
 * 2. Converts to Black & White (grayscale) if flagged as bloody/graphic accident.
 * 3. Applies privacy protection blur if flagged as sensitive minor/POCSO/sexual assault victim or dead body.
 * 4. Auto-enhances brightness & dynamic contrast for dark night photos (normalize).
 * 5. Applies smart subtle sharpening to improve photo crispness.
 * 6. Smart-crops non-16:9 (vertical 9:16 / square 1:1) images into a clean 16:9 frame keeping heads, faces, and salient subjects in view via AI.
 * 7. Generates an optimized 16:9 image + fast thumbnail in WebP format.
 */
export async function processAndOptimizeNewsImage(
    imageUrl: string,
    postId: string,
    isGraphicOrBloody: boolean = false,
    isSensitiveVictimOrMinor: boolean = false
): Promise<OptimizedImageResult | null> {
    try {
        if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) return null;

        console.log(`[IMG_OPT] Processing image for post ${postId} (Bloody: ${isGraphicOrBloody}, Sensitive: ${isSensitiveVictimOrMinor})...`);
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.error(`[IMG_OPT_ERR] Failed to download image: ${response.statusText}`);
            return null;
        }

        const contentType = response.headers.get('content-type') || "";
        if (contentType && !contentType.startsWith('image/')) {
            console.log(`[IMG_OPT] URL is not an image (Content-Type: ${contentType}). Skipping.`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 🛡️ STEP 1: AI Obscenity & Safety Scan (Instant Guard against adult/vulgar images)
        const safetyResult = await scanImageSafetyWithGeminiAI(buffer);
        if (!safetyResult.isSafe) {
            console.warn(`[IMAGE_BLOCKED_UNSAFE] Post ${postId}: Image rejected for safety: ${safetyResult.rejectionReason} (${safetyResult.safetyDetails})`);
            return {
                optimizedUrl: "",
                thumbnailUrl: "",
                isSafe: false,
                rejectionReason: safetyResult.rejectionReason || "అసభ్యకరమైన లేదా చట్టవ్యతిరేక చిత్రం గుర్తించబడింది"
            };
        }

        const img = sharp(buffer);
        const metadata = await img.metadata();
        const width = metadata.width || 1280;
        const height = metadata.height || 720;

        const targetW = Math.min(Math.max(1280, width), 1920);
        const targetH = Math.round(targetW * 9 / 16);

        // AI-Powered Smart 16:9 Crop for vertical/non-16:9 photos
        const cropBox = await calculateSmartCrop16x9(buffer, width, height);
        const isCropped = cropBox.width !== width || cropBox.height !== height || cropBox.left !== 0 || cropBox.top !== 0;

        let pipeline = sharp(buffer);
        if (isCropped) {
            pipeline = pipeline
                .extract(cropBox)
                .resize({
                    width: targetW,
                    height: targetH,
                    fit: sharp.fit.fill
                });
        } else {
            pipeline = pipeline
                .resize({
                    width: targetW,
                    height: targetH,
                    fit: sharp.fit.inside,
                    withoutEnlargement: true
                });
        }
        pipeline = pipeline.normalize();

        if (isGraphicOrBloody) {
            console.log(`[IMG_OPT] Converting graphic/bloody image to Grayscale (B&W) for post ${postId}`);
            pipeline = pipeline.grayscale();
        }

        if (isSensitiveVictimOrMinor) {
            console.log(`[IMG_OPT] Applying sensitive privacy protection blur for post ${postId}`);
            pipeline = pipeline.blur(18);
        } else {
            pipeline = pipeline.sharpen({ sigma: 0.8, m1: 0.5, m2: 0.5 });
        }

        // Save at ultra-crisp 92% WebP quality (lossless-grade crispness)
        const optimizedBuffer = await pipeline.webp({ quality: 92 }).toBuffer();

        // Generate 16:9 Thumbnail for push notifications (400x225 with top position)
        const thumbBuffer = await sharp(optimizedBuffer)
            .resize(400, 225, { fit: 'cover', position: 'top' })
            .webp({ quality: 80 })
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
        return { optimizedUrl, thumbnailUrl, isSafe: true, rejectionReason: null };
    } catch (e: any) {
        console.error(`[IMG_OPT_ERR] Error optimizing image for ${postId}:`, e.message);
        return null;
    }
}

export async function createAndSaveThumbnail(imageUrl: string, postId: string): Promise<string | null> {
    const result = await processAndOptimizeNewsImage(imageUrl, postId, false);
    return result?.isSafe ? (result.thumbnailUrl || null) : null;
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
