import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { Buffer } from 'buffer';
const sharp = require('sharp');

export const REGION = "asia-south1";
export const SCHEDULED_MODEL = "gemini-3-flash-preview";
export const PRO_MODEL = "gemini-3.1-pro-preview";
export const FLASH_MODEL = "gemini-3-flash-preview";
export const IMAGEN_MODEL = "imagen-4.0-generate-001";

export const getAIInstance = () => new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || "",
    apiVersion: "v1beta"
});

export function getISTDateString() {
    const now = new Date();
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istString);
    return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
}

export function parseAIJson(text: string) {
    try {
        let cleanText = text.trim();
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```(json)?\n/, '').replace(/\n```$/, '');
        }
        return JSON.parse(cleanText);
    } catch(e) {
        console.error("JSON parse error:", e);
        return {};
    }
}

export async function saveBufferToStorage(buffer: Buffer, prefix: string): Promise<string | null> {
    try {
        const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
        const bucket = admin.storage().bucket();
        const fileName = `news-media/${prefix}_${Date.now()}.webp`;
        await bucket.file(fileName).save(webpBuffer, { metadata: { contentType: 'image/webp' } });
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

export async function generateImageWithRetry(ai: any, prompt: string, aspectRatio: '1:1' | '9:16' | '16:9' | '3:4' | '4:3' = '9:16', retries = 3): Promise<Buffer | null> {
    const modelsToTry = [IMAGEN_MODEL, "imagen-3.0-generate-001"];

    for (const currentModel of modelsToTry) {
        for (let i = 0; i < retries; i++) {
            try {
                console.log(`[AI_IMAGE] Attempt ${i + 1} using ${currentModel} for prompt: ${prompt.substring(0, 50)}...`);
                const imgRes = await ai.models.generateImages({
                    model: currentModel,
                    prompt: prompt,
                    config: {
                        numberOfImages: 1,
                        aspectRatio: aspectRatio,
                        safetyFilterLevel: 'block_few',
                        personGeneration: 'allow_all',
                        includeRaiReason: true
                    }
                });

                if (imgRes.generatedImages?.[0]?.image?.imageBytes) {
                    console.log(`[AI_IMAGE] Success with ${currentModel}`);
                    return Buffer.from(imgRes.generatedImages[0].image.imageBytes, 'base64');
                }

                const reason = imgRes.generatedImages?.[0]?.raiReason || "Safety/Filtered";
                console.warn(`[AI_IMAGE] Attempt ${i + 1} (${currentModel}) returned no images. Reason: ${reason}`);

                if (i < retries - 1) {
                    const delay = Math.pow(2, i) * 2000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (err: any) {
                console.error(`[AI_IMAGE] Attempt ${i + 1} (${currentModel}) failed:`, err.message);
                if (i === retries - 1 && currentModel === modelsToTry[modelsToTry.length - 1]) return null;
                const delay = Math.pow(2, i) * 3000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    return null;
}
