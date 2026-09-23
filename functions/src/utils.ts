import * as admin from "firebase-admin";
import { GoogleGenAI, Type } from "@google/genai";
import { Buffer } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
const sharp = require('sharp');
export const REGION = "asia-south1";
export const SCHEDULED_MODEL = "gemini-3.7-flash";
export const PRO_MODEL = "gemini-3.7-flash";
export const FLASH_MODEL = "gemini-3.7-flash";
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
    "gemini-3.7-flash",       // 1. Primary - Best Editorial Quality
    "gemini-3.6-flash",       // 2. High-speed, high-quota safety net
    "gemini-3.5-flash-lite",  // 3. Fallback
    "gemini-3.5-flash"        // 4. Backup
];

const IMAGE_ANALYSIS_MODELS = [
    "gemini-3.5-flash-lite",  // 1. Primary for Vision/Scan: 1,500 RPD, 30 RPM, super fast image parsing
    "gemini-3.1-flash-lite",  // 2. Secondary high-throughput vision
    "gemini-3.6-flash",       // 3. Fallback
    "gemini-3.7-flash"        // 4. Ultimate fallback
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
    ]
        .map(key => key ? key.replace(/^["']|["']$/g, '').trim() : '')
        .filter(key => key.length > 0);
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

    const MAX_TOTAL_ATTEMPTS = 8;
    let totalAttempts = 0;
    let lastError: any = null;

    for (let k = 0; k < keysToTry.length; k++) {
        const currentKey = keysToTry[k];
        const paidKeyClean = (process.env.PAID_GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim();
        const isPaidKey = !!paidKeyClean && currentKey === paidKeyClean;

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

                // If 429 (rate/quota limit)
                if (status === 429) {
                    console.warn(`[MODEL-429] Model ${currentModelName} (${keyLabel}) hit rate/quota limit. Waiting briefly...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
                }

                // If 503/504 transient server overload, wait briefly
                if (status === 503 || status === 504) {
                    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
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
 * and Devanagari/Hindi Unicode characters (0x0900-0x097F) to Telugu, removing orphaned matras,
 * broken placeholder glyphs, and zero-width spaces, ensuring 100% pure Telugu script purity.
 */
export function sanitizeTeluguText(text: string): string {
    if (!text) return "";
    return text
        // 1. Map any bled Kannada Unicode characters (0x0C80-0x0CFF) to Telugu Unicode (0x0C00-0x0C7F)
        .replace(/[\u0C80-\u0CFF]/g, (char) => {
            const code = char.charCodeAt(0) - 0x0080;
            return (code >= 0x0C00 && code <= 0x0C7F) ? String.fromCharCode(code) : '';
        })
        // 2. Map any bled Devanagari / Hindi Unicode characters (0x0900-0x097F) to Telugu Unicode (0x0C00-0x0C7F)
        .replace(/[\u0900-\u097F]/g, (char) => {
            const code = char.charCodeAt(0) + 0x0300;
            return (code >= 0x0C00 && code <= 0x0C7F) ? String.fromCharCode(code) : '';
        })
        // 3. Strip any residual unmapped Kannada or Hindi characters to guarantee 0% Kannada/Hindi
        .replace(/[\u0900-\u097F\u0C80-\u0CFF]/g, '')
        // 4. Remove dotted circle characters used as fallback for broken combining marks
        .replace(/\u25CC/g, '')
        // 5. Remove invisible zero-width spaces that break Telugu word joining
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        // 6. Fix spaces before Telugu combining vowel marks / virama
        .replace(/\s+([\u0C01-\u0C03\u0C3E-\u0C4D\u0C55\u0C56\u0C62\u0C63])/g, '$1')
        .trim();
}

/**
 * Sanitizes and formats Telugu headlines:
 * 1. Strictly eliminates all inverted commas / quotes ('...', "...", ‘...’, “...”).
 * 2. Eliminates colon templates and multiple dots (..) to ensure ONE single continuous sentence.
 * 3. Ensures single integrated sentence flow without clause splitting.
 */
export function cleanTeluguHeadline(headline: string): string {
    if (!headline) return "";
    let clean = headline.trim();

    // 1. Strip all residual quotes (single, double, curly quotes, backticks)
    clean = clean.replace(/['"“‘”’`]/g, '');

    // 2. Replace colons, semicolons, and multiple dots (..) with a space to prevent splitting into two sentences
    clean = clean.replace(/\s*[:;]\s*/g, ' ');
    clean = clean.replace(/\.{2,}/g, ' ');

    // 3. Normalize multiple whitespace and trim
    clean = clean.replace(/\s+/g, ' ').trim();

    return sanitizeTeluguText(clean);
}

/**
 * Detects whether a headline or post is pure party flattery / sycophancy / verdict without attribution.
 */
export function isEditorialVerdictOrFlattery(headline: string, text: string = '', authorName: string = ''): boolean {
    if (!headline || typeof headline !== 'string') return false;
    const h = headline.trim();
    const t = (text || '').trim();
    const a = (authorName || '').trim();

    // 1. Common flattery / self-praise / title phrases in headline
    const flatteryPhrases = [
        /ప్రజల పక్షాన నిలిచి? పోరాడే/i,
        /ప్రజల పక్షాన నిలిచే నాయక/i,
        /పేదల పెన్నిధి/i,
        /పేదల ఆశాజ్యోతి/i,
        /అభివృద్ధి ప్రదాత/i,
        /రియల్ హీరో/i,
        /ప్రజల కోసం ప్రశ్నించే గొంతు/i,
        /మా నాయకుడే/i
    ];

    const hasFlatteryInHeadline = flatteryPhrases.some(pattern => pattern.test(h));

    // Attribution markers in Telugu
    const attributionWords = [
        'అన్న', 'అని', 'పేర్కొన్న', 'చెప్పిన', 'విమర్శించిన', 'నిలదీసిన',
        'డిమాండ్ చేసిన', 'స్పష్టం చేసిన', 'హెచ్చరించిన', 'ఆగ్రహం', 'ధ్వజం',
        'సవాల్', 'వెల్లడి', 'ప్రకటన', 'ట్వీట్'
    ];
    const hasAttribution = attributionWords.some(w => h.includes(w));

    // If headline contains praise/title and lacks attribution, it's an editorial verdict!
    if (hasFlatteryInHeadline && !hasAttribution) {
        return true;
    }

    // 2. Pure PR hype / promotional slogans from political party accounts
    const isPartySource = /inc|tdp|ysrcp|brs|bjp|congress|jana\s*sena|వైసీపీ|టిడిపి|బిజెపి|కాంగ్రెస్/i.test(a) ||
                          /inc|tdp|ysrcp|brs|bjp|congress/i.test(t);
    const hasSycophancySlogans = /(?:ప్రశ్నించే గొంతు|పోరాడే నిబద్ధత|ప్రజల పక్షాన నిలిచే నాయకత్వం|మా నాయకుడే మా భవిష్యత్తు|నాయకత్వ పటిమ)/i.test(t);
    const hasRealNewsKeywords = /(?:నిర్ణయం|పథకం|బడ్జెట్|కేటాయింపు|రూపాయల|కోట్ల|హామీ|సమీక్ష|అరెస్ట్|కేసు|దాడులు|ప్రమాదం|మృతి|మరణం|ఉత్తర్వులు|జీవో|నోటిఫికేషన్|పోలీస్|రైతు|ధరలు)/i.test(t);

    if (isPartySource && hasSycophancySlogans && !hasRealNewsKeywords) {
        return true;
    }

    return false;
}

/**
 * Formats a story text into strictly 3 to 4 distinct paragraphs separated by \n\n.
 * If already separated by paragraphs, preserves them.
 * If provided as a single block or clump, intelligently splits by sentence boundaries
 * into 3 to 4 balanced paragraphs.
 */
export function formatIntoParagraphs(text: string, targetCount: number = 4): string {
    if (!text || !text.trim()) return "";
    const clean = text.trim();

    // 1. Check if already split by double newlines (\n\n)
    const doubleNewlineParas = clean.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
    if (doubleNewlineParas.length >= 2) {
        return doubleNewlineParas.join('\n\n');
    }

    // 2. Check if split by single newlines
    const singleNewlineParas = clean.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
    if (singleNewlineParas.length >= 2) {
        return singleNewlineParas.join('\n\n');
    }

    // 3. Single text clump: split into sentences and balance into 2, 3, or strictly 4 paragraphs
    const sentences = clean.split(/(?<=[.!?।])\s*/).map(s => s.trim()).filter(s => s.length > 0);
    if (sentences.length >= 4) {
        const k = 4;
        const chunks: string[] = [];
        const baseSize = Math.floor(sentences.length / k);
        const remainder = sentences.length % k;
        let start = 0;
        for (let i = 0; i < k; i++) {
            const chunkSize = baseSize + (i < remainder ? 1 : 0);
            if (chunkSize > 0 && start < sentences.length) {
                chunks.push(sentences.slice(start, start + chunkSize).join(' '));
                start += chunkSize;
            }
        }
        return chunks.length > 0 ? chunks.join('\n\n') : clean;
    } else if (sentences.length === 3) {
        return sentences.join('\n\n');
    } else if (sentences.length === 2) {
        return sentences.join('\n\n');
    } else if (sentences.length === 1 && sentences[0].length > 180) {
        const clauses = sentences[0].split(/(?<=[,;—–])\s+/).map(c => c.trim()).filter(Boolean);
        if (clauses.length >= 3) {
            const k = 3;
            const chunks: string[] = [];
            const baseSize = Math.floor(clauses.length / k);
            const remainder = clauses.length % k;
            let start = 0;
            for (let i = 0; i < k; i++) {
                const chunkSize = baseSize + (i < remainder ? 1 : 0);
                if (chunkSize > 0 && start < clauses.length) {
                    chunks.push(clauses.slice(start, start + chunkSize).join(' '));
                    start += chunkSize;
                }
            }
            return chunks.join('\n\n');
        } else if (clauses.length === 2) {
            return clauses.join('\n\n');
        }
    }

    return clean;
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
        }, IMAGE_ANALYSIS_MODELS);

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

export interface BlurTimeRange {
    start: number;
    end: number;
}

export interface ImageSafetyScanResult {
    isSafe: boolean;
    isAdultOrNude: boolean;
    isHateOrIllegal: boolean;
    isExtremelyGruesome: boolean;
    rejectionReason: string | null;
    safetyDetails: string;
    isTemporaryError?: boolean;
    canSanitizeWithBlur?: boolean;
    violatingTileIndices?: number[];
    blurRanges?: BlurTimeRange[];
}

/**
 * Maps violating tile indices (1-indexed from storyboard mosaic) to time ranges in seconds,
 * merging overlapping intervals with safety buffer padding.
 */
export function calculateBlurRanges(
    violatingTileIndices: number[],
    intervalSec: number,
    durationSeconds: number
): BlurTimeRange[] {
    if (!violatingTileIndices || violatingTileIndices.length === 0 || intervalSec <= 0) return [];

    const rawRanges: BlurTimeRange[] = violatingTileIndices
        .filter(idx => typeof idx === 'number' && idx >= 1)
        .map(k => {
            const start = Math.max(0, (k - 1) * intervalSec - 3);
            const end = Math.min(durationSeconds, k * intervalSec + 3);
            return { start, end };
        })
        .sort((a, b) => a.start - b.start);

    if (rawRanges.length === 0) return [];

    const merged: BlurTimeRange[] = [{ ...rawRanges[0] }];
    for (let i = 1; i < rawRanges.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = rawRanges[i];
        if (curr.start <= prev.end + 2) {
            prev.end = Math.max(prev.end, curr.end);
        } else {
            merged.push({ ...curr });
        }
    }

    return merged;
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
        }, IMAGE_ANALYSIS_MODELS);

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
        const isQuotaOrServer = e.message && (e.message.includes("429") || e.message.includes("quota") || e.message.includes("503") || e.message.includes("RESOURCE_EXHAUSTED"));
        if (isQuotaOrServer) {
            return {
                isSafe: false,
                isTemporaryError: true,
                isAdultOrNude: false,
                isHateOrIllegal: false,
                isExtremelyGruesome: false,
                rejectionReason: null,
                safetyDetails: `AI quota limit hit: ${e.message}`
            };
        }
        return { isSafe: true, isAdultOrNude: false, isHateOrIllegal: false, isExtremelyGruesome: false, rejectionReason: null, safetyDetails: "Error bypassed" };
    }
}

/**
 * Extracts representative keyframes from a video file for visual AI safety inspection.
 * Uses ffprobe to identify duration and ffmpeg to extract frames at 25% and 60% of duration.
 */
export async function extractVideoKeyFrames(videoPath: string, maxFrames: number = 2): Promise<Buffer[]> {
    const frameBuffers: Buffer[] = [];
    if (!videoPath || !fs.existsSync(videoPath)) return frameBuffers;

    const tempDir = os.tmpdir();
    let durationSeconds = 10;

    try {
        const ffprobeStatic = require('ffprobe-static');
        const probeOutput = execSync(`"${ffprobeStatic.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`, { timeout: 10000 }).toString().trim();
        const parsedDur = parseFloat(probeOutput);
        if (!isNaN(parsedDur) && parsedDur > 0) {
            durationSeconds = parsedDur;
        }
    } catch (e: any) {
        console.warn(`[FRAME_PROBE_WARN] Could not probe video duration (${e.message}). Defaulting to 10s.`);
    }

    const ffmpegStatic = require('ffmpeg-static');
    const timestamps: number[] = [];
    if (durationSeconds <= 3) {
        timestamps.push(0.5);
    } else {
        timestamps.push(Math.max(1, Math.floor(durationSeconds * 0.25)));
        if (maxFrames > 1 && durationSeconds >= 4) {
            timestamps.push(Math.max(2, Math.floor(durationSeconds * 0.60)));
        }
    }

    for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        const framePath = path.join(tempDir, `vframe_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}.jpg`);
        try {
            execSync(`"${ffmpegStatic}" -ss ${ts} -i "${videoPath}" -vframes 1 -q:v 2 "${framePath}" -y`, { timeout: 15000 });
            if (fs.existsSync(framePath)) {
                const buf = fs.readFileSync(framePath);
                if (buf && buf.length > 0) {
                    frameBuffers.push(buf);
                }
            }
        } catch (err: any) {
            console.warn(`[FRAME_EXTRACT_WARN] Frame extraction at ${ts}s failed: ${err.message}`);
        } finally {
            if (fs.existsSync(framePath)) {
                try { fs.unlinkSync(framePath); } catch (e) {}
            }
        }
    }

    // Fallback: If timestamp seek failed, try extracting the very first frame
    if (frameBuffers.length === 0) {
        const fallbackPath = path.join(tempDir, `vframe_fallback_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.jpg`);
        try {
            execSync(`"${ffmpegStatic}" -i "${videoPath}" -vframes 1 -q:v 2 "${fallbackPath}" -y`, { timeout: 15000 });
            if (fs.existsSync(fallbackPath)) {
                const buf = fs.readFileSync(fallbackPath);
                if (buf && buf.length > 0) {
                    frameBuffers.push(buf);
                }
            }
        } catch (e: any) {
            console.warn(`[FRAME_FALLBACK_ERR] Fallback frame extraction failed: ${e.message}`);
        } finally {
            if (fs.existsSync(fallbackPath)) {
                try { fs.unlinkSync(fallbackPath); } catch (e) {}
            }
        }
    }

    return frameBuffers;
}

/**
 * 🛡️ Generates a unified storyboard mosaic contact sheet across the ENTIRE video duration.
 * For example, a 4x3 grid (12 evenly distributed snapshots across 0% to 100% of the video).
 * Eliminates all blind spots: Even if a horrific scene lasts only 10-15 seconds in a 5-minute video,
 * it will be captured in 2 to 3 tiles of this mosaic, while still requiring ONLY 1 Gemini API call!
 */
export interface VideoStoryboardMosaicInfo {
    buffer: Buffer;
    duration: number;
    intervalSec: number;
    totalTiles: number;
}

/**
 * 🛡️ Generates a unified storyboard mosaic contact sheet across the ENTIRE video duration.
 * For example, a 4x3 grid (12 evenly distributed snapshots across 0% to 100% of the video).
 * Eliminates all blind spots: Even if a horrific scene lasts only 10-15 seconds in a 5-minute video,
 * it will be captured in 2 to 3 tiles of this mosaic, while still requiring ONLY 1 Gemini API call!
 */
export async function extractVideoStoryboardMosaic(videoPath: string): Promise<VideoStoryboardMosaicInfo | null> {
    if (!videoPath || !fs.existsSync(videoPath)) return null;

    const tempDir = os.tmpdir();
    let durationSeconds = 10;

    try {
        const ffprobeStatic = require('ffprobe-static');
        const probeOutput = execSync(`"${ffprobeStatic.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`, { timeout: 10000 }).toString().trim();
        const parsedDur = parseFloat(probeOutput);
        if (!isNaN(parsedDur) && parsedDur > 0) {
            durationSeconds = parsedDur;
        }
    } catch (e: any) {}

    const ffmpegStatic = require('ffmpeg-static');
    const mosaicPath = path.join(tempDir, `mosaic_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.jpg`);

    // Adaptive grid:
    // <= 20s: 2x2 (4 snapshots)
    // 20s - 60s: 3x2 (6 snapshots)
    // > 60s (up to 5-10 mins): 4x3 (12 snapshots across the whole timeline)
    let grid = "3x2";
    let totalTiles = 6;
    if (durationSeconds <= 20) {
        grid = "2x2";
        totalTiles = 4;
    } else if (durationSeconds > 60) {
        grid = "4x3";
        totalTiles = 12;
    }

    const intervalSec = Math.max(1, Math.floor(durationSeconds / totalTiles));
    const filter = `fps=1/${intervalSec},scale=320:180,tile=${grid}`;

    try {
        execSync(`"${ffmpegStatic}" -i "${videoPath}" -vf "${filter}" -frames:v 1 -update 1 "${mosaicPath}" -y`, { timeout: 20000 });
        if (fs.existsSync(mosaicPath)) {
            const buf = fs.readFileSync(mosaicPath);
            if (buf && buf.length > 0) {
                return {
                    buffer: buf,
                    duration: durationSeconds,
                    intervalSec: intervalSec,
                    totalTiles: totalTiles
                };
            }
        }
    } catch (err: any) {
        console.warn(`[MOSAIC_WARN] Storyboard mosaic extraction failed (${err.message}). Falling back to keyframe sampling.`);
    } finally {
        if (fs.existsSync(mosaicPath)) {
            try { fs.unlinkSync(mosaicPath); } catch (e) {}
        }
    }
    return null;
}

/**
 * 🛡️ Video AI Safety Scanner (Gemini Multimodal Vision + YouTube Community Guidelines)
 * 1. Uses a 12-tile full timeline storyboard mosaic covering the ENTIRE video from start to finish.
 * 2. Leaves zero blind spots even if horrific content lasts only a few seconds in a 5-minute video.
 * 3. Detects specific violating tiles and calculates precise timeline blur ranges for FFmpeg Option A.
 * 4. Requires only 1 Gemini API call, keeping cost virtually zero.
 */
export async function scanVideoSafetyWithGeminiAI(videoPath: string): Promise<ImageSafetyScanResult> {
    try {
        // 1. PRIMARY: Full-timeline Storyboard Mosaic (12 snapshots across 0-100% duration in 1 single scan)
        const mosaicInfo = await extractVideoStoryboardMosaic(videoPath);
        if (mosaicInfo) {
            console.log(`[VIDEO_SAFETY_SCAN] Scanning full timeline storyboard mosaic (${mosaicInfo.totalTiles} snapshots across ${mosaicInfo.duration}s) with Gemini Vision...`);

            const previewBuffer = await sharp(mosaicInfo.buffer)
                .resize(1024, 768, { fit: 'inside' })
                .jpeg({ quality: 85 })
                .toBuffer();

            const base64 = previewBuffer.toString("base64");

            const prompt = `You are the Chief YouTube Trust, Safety & Legal Compliance Officer for a Telugu news media channel.
This image is a chronologically ordered storyboard contact sheet containing ${mosaicInfo.totalTiles} video snapshots from 0% to 100% of a submitted news video.
The tiles are arranged in reading order: Row 1 (Tile 1 to 4), Row 2 (Tile 5 to 8), Row 3 (Tile 9 to 12).
Each tile represents approximately ${mosaicInfo.intervalSec} seconds of the video timeline.

YouTube Community Guidelines strictly prohibit graphic violence, mutilated corpses, hanging/suicides, severe bleeding, or gory accident victim bodies unless properly blurred.

EVALUATION RULES:
1. isSafe: true ONLY IF there are NO graphic gore, severe bloodshed, dead bodies, sexual content, or violent scenes in any of the tiles.
2. hasGraphicContent: true if any tiles depict blood, fatal crashes, wounded bodies, or violent clashes.
3. canSanitizeWithBlur: true IF AND ONLY IF the objectionable material is routine local news accident/injury footage, blood splatters, or post-accident damaged vehicles/victims that CAN BE MADE COMPLIANT by applying a full-screen blur to the affected timestamps.
   IMPORTANT: Set canSanitizeWithBlur = FALSE if there is child abuse (POCSO), explicit sexual content, hanging/suicide, or illegal terror promotion.
4. violatingTileIndices: Array of 1-based tile numbers (e.g. [4, 5]) where the disturbing or policy-violating scenes appear. Return empty [] if isSafe is true.
5. rejectionReason: In polite Telugu, explain what was found (e.g. "ప్రమాద దృశ్యాలలో తీవ్ర రక్తపాతం గుర్తించబడింది").
6. safetyDetails: Brief English explanation specifying which tiles contain graphic scenes.`;

            const schema = {
                type: Type.OBJECT,
                properties: {
                    isSafe: { type: Type.BOOLEAN },
                    hasGraphicContent: { type: Type.BOOLEAN },
                    canSanitizeWithBlur: { type: Type.BOOLEAN },
                    violatingTileIndices: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                    rejectionReason: { type: Type.STRING },
                    safetyDetails: { type: Type.STRING }
                },
                required: ["isSafe", "hasGraphicContent", "canSanitizeWithBlur", "violatingTileIndices", "safetyDetails"]
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
                if (!text) throw new Error("Empty response from AI");
                const parsed = parseAIJson(text);
                if (parsed && typeof parsed.isSafe === 'boolean') {
                    if (parsed.isSafe === true) {
                        return {
                            isSafe: true,
                            isAdultOrNude: false,
                            isHateOrIllegal: false,
                            isExtremelyGruesome: false,
                            canSanitizeWithBlur: false,
                            violatingTileIndices: [],
                            blurRanges: [],
                            rejectionReason: null,
                            safetyDetails: "Full timeline storyboard mosaic passed YouTube safety inspection"
                        };
                    }

                    const violatingTiles: number[] = Array.isArray(parsed.violatingTileIndices) ? parsed.violatingTileIndices : [];
                    const canSanitize = parsed.canSanitizeWithBlur === true && violatingTiles.length > 0;
                    const blurRanges = canSanitize
                        ? calculateBlurRanges(violatingTiles, mosaicInfo.intervalSec, mosaicInfo.duration)
                        : [];

                    return {
                        isSafe: false,
                        canSanitizeWithBlur: canSanitize,
                        violatingTileIndices: violatingTiles,
                        blurRanges: blurRanges,
                        isAdultOrNude: !canSanitize,
                        isHateOrIllegal: false,
                        isExtremelyGruesome: true,
                        rejectionReason: parsed.rejectionReason || "వీడియో దృశ్యాలలో యూట్యూబ్ నిబంధనలకు విరుద్ధమైన భయానక/రక్తపాత దృశ్యాలు గుర్తించబడ్డాయి",
                        safetyDetails: parsed.safetyDetails || `Violating tiles: ${violatingTiles.join(',')}`
                    };
                }
                throw new Error("Invalid AI JSON structure");
            }, IMAGE_ANALYSIS_MODELS);

            if (result) return result;
        }

        // 2. FALLBACK: Discrete keyframe extraction if mosaic filter fails
        const frameBuffers = await extractVideoKeyFrames(videoPath, 3);
        if (frameBuffers.length === 0) {
            console.warn("[VIDEO_SAFETY_WARN] No frames could be extracted from video. Bypassing frame scan.");
            return {
                isSafe: true,
                isAdultOrNude: false,
                isHateOrIllegal: false,
                isExtremelyGruesome: false,
                rejectionReason: null,
                safetyDetails: "No frames extracted"
            };
        }

        console.log(`[VIDEO_SAFETY_SCAN] Scanning ${frameBuffers.length} fallback keyframes with Gemini Vision...`);
        for (let i = 0; i < frameBuffers.length; i++) {
            const scan = await scanImageSafetyWithGeminiAI(frameBuffers[i]);
            if (!scan.isSafe) {
                if (scan.isTemporaryError) {
                    console.warn(`[VIDEO_FRAME_TEMP_ERROR] Frame ${i + 1} safety scan hit quota or temporary error: ${scan.safetyDetails}`);
                    return {
                        isSafe: false,
                        isTemporaryError: true,
                        isAdultOrNude: false,
                        isHateOrIllegal: false,
                        isExtremelyGruesome: false,
                        rejectionReason: "వీడియో భద్రతా పరిశీలన తాత్కాలికంగా నిలిచింది (కోటా పరిమితి).",
                        safetyDetails: `Frame ${i + 1} quota/network deferred: ${scan.safetyDetails}`
                    };
                }
                console.warn(`[VIDEO_FRAME_UNSAFE] Video frame ${i + 1} flagged as unsafe: ${scan.rejectionReason} (${scan.safetyDetails})`);
                return {
                    isSafe: false,
                    isAdultOrNude: scan.isAdultOrNude,
                    isHateOrIllegal: scan.isHateOrIllegal,
                    isExtremelyGruesome: scan.isExtremelyGruesome,
                    rejectionReason: scan.rejectionReason || "వీడియో దృశ్యాలలో యూట్యూబ్ నిబంధనలకు విరుద్ధమైన భయానక/రక్తపాత దృశ్యాలు గుర్తించబడ్డాయి",
                    safetyDetails: `Frame ${i + 1}: ${scan.safetyDetails}`
                };
            }
        }

        return {
            isSafe: true,
            isAdultOrNude: false,
            isHateOrIllegal: false,
            isExtremelyGruesome: false,
            rejectionReason: null,
            safetyDetails: `All ${frameBuffers.length} fallback frames passed YouTube safety inspection`
        };
    } catch (e: any) {
        console.error("[VIDEO_SAFETY_SCAN_ERR] Error during video safety scan:", e.message);
        return {
            isSafe: false,
            isTemporaryError: true,
            isAdultOrNude: false,
            isHateOrIllegal: false,
            isExtremelyGruesome: false,
            rejectionReason: "వీడియో భద్రతా పరిశీలన తాత్కాలికంగా నిలిచింది",
            safetyDetails: `Video safety scan deferred (quota/network): ${e.message}`
        };
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
