import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { Type } from "@google/genai";
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
const { google } = require('googleapis');
import {
    runWithAIFallback,
    parseAIJson,
    sanitizeTeluguText,
    processAndOptimizeNewsImage,
    FLASH_MODEL,
    REGION,
    createAndSaveThumbnail
} from "./utils";
import { normalizeCategory, normalizeCategories, getCategorySystemInstruction } from './categories';
import { notifyReporter, awardPointsToReporter, getAssignedReporter } from "./reporter_handler";

const db = admin.firestore();

/**
 * Helper: Extract storage path from Firebase Storage URL
 */
function getStoragePathFromUrl(url: string): string | null {
    if (!url || !url.includes('firebasestorage.googleapis.com')) return null;
    try {
        const decodedUrl = decodeURIComponent(url);
        const parts = decodedUrl.split('/o/');
        if (parts.length < 2) return null;
        const pathWithParams = parts[1];
        return pathWithParams.split('?')[0];
    } catch (e) {
        return null;
    }
}

/**
 * Helper: Delete file from Storage
 */
async function deleteOriginalFile(url: string) {
    const filePath = getStoragePathFromUrl(url);
    if (!filePath) return;
    try {
        console.log(`[CLEANUP] Deleting original file: ${filePath}`);
        await admin.storage().bucket().file(filePath).delete();
    } catch (e: any) {
        console.warn(`[CLEANUP_ERR] Failed to delete ${filePath}:`, e.message);
    }
}

/**
 * Helper: Translate the entire survey (headline, content, questions, options)
 */
async function performSurveyAITranslation(surveyData: any): Promise<any> {
    const rawHeadline = surveyData.headline?.telugu || surveyData.headline?.english || surveyData.headline || "";
    const rawContent = surveyData.content?.telugu || surveyData.content?.english || surveyData.content || "";
    
    const inputQuestions = (surveyData.surveyQuestions || []).map((q: any) => {
        return {
            id: q.id,
            questionText: q.questionText || "",
            options: (q.options || []).map((o: any) => {
                return {
                    id: o.id,
                    text: o.text || "",
                    nextQuestionId: o.nextQuestionId || null
                };
            })
        };
    });

    const schema = {
        type: Type.OBJECT,
        properties: {
            headline: {
                type: Type.OBJECT,
                properties: {
                    telugu: { type: Type.STRING },
                    english: { type: Type.STRING }
                },
                required: ["telugu", "english"]
            },
            content: {
                type: Type.OBJECT,
                properties: {
                    telugu: { type: Type.STRING },
                    english: { type: Type.STRING }
                },
                required: ["telugu", "english"]
            },
            surveyQuestions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        questionText: {
                            type: Type.OBJECT,
                            properties: {
                                telugu: { type: Type.STRING },
                                english: { type: Type.STRING }
                            },
                            required: ["telugu", "english"]
                        },
                        options: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    text: {
                                        type: Type.OBJECT,
                                        properties: {
                                            telugu: { type: Type.STRING },
                                            english: { type: Type.STRING }
                                        },
                                        required: ["telugu", "english"]
                                    },
                                    nextQuestionId: { type: Type.STRING, nullable: true }
                                },
                                required: ["id", "text"]
                            }
                        }
                    },
                    required: ["id", "questionText", "options"]
                }
            }
        },
        required: ["headline", "content", "surveyQuestions"]
    };

    const prompt = `
Original Headline: ${rawHeadline}
Original Content: ${rawContent}

Original Questions & Options structure:
${JSON.stringify(inputQuestions, null, 2)}
`;

    return await runWithAIFallback(async (ai, modelName) => {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                systemInstruction: `You are an expert bilingual editor translating content between Telugu and English.
Your task:
1. Identify the input language (could be Telugu, English, or mixed).
2. Translate the Headline and Content (description) into both Telugu and English.
3. For each question in the list, translate the "questionText" into both Telugu and English.
4. For each option within a question, translate the "text" into both Telugu and English.
5. IMPORTANT: Keep the original "id" and "nextQuestionId" values for all questions and options exactly as given. Do not generate new IDs, do not change them, and do not drop them.
Output JSON only.`,
                temperature: 0.3,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema,
                system_instruction: `You are an expert bilingual editor translating content between Telugu and English. ...`,
                response_mime_type: "application/json",
                response_schema: schema,
                max_output_tokens: 4096
            }
        } as any);

        const rawText = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        console.log(`[SURVEY_AI_RES] Output:`, rawText.substring(0, 500));
        const aiRes = parseAIJson(rawText);

        if (!aiRes.headline || !aiRes.content || !aiRes.surveyQuestions) {
            throw new Error("AI response missing mandatory survey fields.");
        }

        // Map back to guarantee nextQuestionId and structure are preserved exactly
        const mappedQuestions = aiRes.surveyQuestions.map((q: any) => {
            const originalQ = inputQuestions.find((oQ: any) => oQ.id === q.id) || {};
            return {
                id: q.id,
                questionText: q.questionText,
                options: (q.options || []).map((o: any) => {
                    const originalO = (originalQ.options || []).find((oO: any) => oO.id === o.id) || {};
                    return {
                        id: o.id,
                        text: o.text,
                        nextQuestionId: originalO.nextQuestionId || o.nextQuestionId || null
                    };
                })
            };
        });

        return {
            headline: aiRes.headline,
            content: aiRes.content,
            surveyQuestions: mappedQuestions
        };
    });
}

/**
 * Helper: Perform AI enhancement on news content
 */
/**
 * Helper: Normalize a single AI-generated story object
 */
function normalizeSingleStory(aiRes: any, actualPostData: any): any {
    let finalContent = aiRes.content || aiRes.contentTe || aiRes.content_te ||
        aiRes.telugu?.content || aiRes.telugu?.contentTe || aiRes.telugu?.summary ||
        aiRes.telugu_version?.content || aiRes.telugu_version?.summary ||
        aiRes.summaryTe || aiRes.summarized_telugu_content || aiRes.summary ||
        aiRes.description || aiRes.summarizedTeluguContent || "";
    finalContent = sanitizeTeluguText(finalContent);

    let finalHeadline = aiRes.headline || aiRes.headlineTe || aiRes.headline_te ||
        aiRes.telugu?.headline || aiRes.telugu?.headlineTe ||
        aiRes.telugu_version?.headline || aiRes.telugu_version?.title ||
        aiRes.title || aiRes.generated_telugu_headline || aiRes.generatedTeluguHeadline || "";
    finalHeadline = sanitizeTeluguText(finalHeadline);

    const finalHeadlineEn = aiRes.headlineEn || aiRes.headline_en ||
        aiRes.english?.headline || aiRes.english?.headlineEn ||
        aiRes.english_version?.headline || aiRes.english_version?.title ||
        aiRes.titleEn || aiRes.englishHeadline || "";

    let finalNotificationTitle = aiRes.notificationTitle || aiRes.notification_title || aiRes.curiosityHeadline || "";
    if (finalNotificationTitle.toLowerCase() === "null" ||
        finalNotificationTitle.toLowerCase() === "none" ||
        finalNotificationTitle.toLowerCase() === "n/a" ||
        finalNotificationTitle.toLowerCase() === "false") {
        finalNotificationTitle = "";
    } else {
        finalNotificationTitle = sanitizeTeluguText(finalNotificationTitle);
    }

    const isRejected = aiRes.rejectionReason && aiRes.rejectionReason.length > 0;

    if (!isRejected && (!finalContent || !finalHeadline)) {
         console.warn("[AI_FIELD_WARNING] AI story item missing Telugu fields:", JSON.stringify(aiRes).substring(0, 300));
    }

    const finalContentEn = aiRes.contentEn || aiRes.content_en ||
        aiRes.english?.content || aiRes.english?.contentEn || aiRes.english?.summary ||
        aiRes.english_version?.content || aiRes.english_version?.summary ||
        aiRes.summaryEn || aiRes.summarized_english_content || aiRes.englishContent || "";

    let rejectionReason = aiRes.rejectionReason || "";
    if (rejectionReason.toLowerCase() === "null" ||
        rejectionReason.toLowerCase() === "none" ||
        rejectionReason.toLowerCase() === "n/a" ||
        rejectionReason.toLowerCase() === "false") {
        rejectionReason = "";
    }

    const normalizedEntities = {
        people: Array.isArray(aiRes.entities?.people) ? aiRes.entities.people : [],
        organizations: Array.isArray(aiRes.entities?.organizations) ? aiRes.entities.organizations : [],
        locations: Array.isArray(aiRes.entities?.locations) ? aiRes.entities.locations : []
    };

    const aiCategoryDetected = aiRes.refinedCategory || actualPostData?.category || "OTHER";
    const canonicalCategory = normalizeCategory(aiCategoryDetected);
    const isReporterPost = actualPostData?.isReporter === true || actualPostData?.processingType === "REPORTER_SUBMISSION";
    const isGlobal = actualPostData?.isGlobal === true;

    let primaryCategory: string;
    let finalCategories: string[];

    if (isReporterPost && !isGlobal) {
        primaryCategory = "జిల్లా వార్త";
        finalCategories = ["జిల్లా వార్త"];
        if (actualPostData?.district) finalCategories.push(actualPostData.district);
    } else {
        primaryCategory = canonicalCategory;
        finalCategories = Array.from(new Set([
            primaryCategory,
            canonicalCategory,
            ...normalizeCategories(actualPostData?.categories || []),
            ...(actualPostData?.district ? [actualPostData.district] : [])
        ])).filter(c => !!c && c !== "OTHER");
    }

    return {
        headline: { telugu: finalHeadline || "", english: finalHeadlineEn || "" },
        content: { telugu: finalContent || "", english: finalContentEn || "" },
        notificationTitle: finalNotificationTitle,
        location: aiRes.location || actualPostData?.location || "",
        category: primaryCategory,
        categories: finalCategories,
        tags: aiRes.tags || [],
        entities: normalizedEntities,
        matchedImageIndex: typeof aiRes.matchedImageIndex === 'number' ? aiRes.matchedImageIndex : 0,
        isSafeForYouTube: aiRes.isSafeForYouTube ?? true,
        rejectionReason: rejectionReason,
        tone: aiRes.tone || "NORMAL",
        vocalContent: aiRes.vocalContent || finalContent || "",
        qualitySignals: aiRes.qualitySignals || { biasScore: 0.5, publicInterestScore: 0.5, investigativeScore: 0, isPersonalPraise: false },
        storyFingerprint: aiRes.storyFingerprint || `gen_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        isBreaking: aiRes.isBreaking === true,
        notificationWorthy: aiRes.notificationWorthy !== false,
        isGraphicOrBloody: aiRes.isGraphicOrBloody === true,
        isSensitiveVictimOrMinor: aiRes.isSensitiveVictimOrMinor === true,
        aiProcessed: true,
        aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };
}

/**
 * Helper: Perform AI enhancement on news content (returns Array of 1 to 3 stories)
 */
async function performAIProcessing(headline: string, content: string, actualPostData: any): Promise<any[]> {
    const singleStorySchema = {
        type: Type.OBJECT,
        properties: {
            headline: { type: Type.STRING },
            content: { type: Type.STRING },
            headlineEn: { type: Type.STRING },
            contentEn: { type: Type.STRING },
            location: { type: Type.STRING },
            storyFingerprint: { type: Type.STRING },
            refinedCategory: { type: Type.STRING },
            matchedImageIndex: { type: Type.INTEGER },
            isSafeForYouTube: { type: Type.BOOLEAN },
            rejectionReason: { type: Type.STRING },
            tone: { type: Type.STRING },
            vocalContent: { type: Type.STRING },
            notificationTitle: { type: Type.STRING },
            isGraphicOrBloody: { type: Type.BOOLEAN },
            isSensitiveVictimOrMinor: { type: Type.BOOLEAN },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            isBreaking: { type: Type.BOOLEAN },
            notificationWorthy: { type: Type.BOOLEAN },
            qualitySignals: {
                type: Type.OBJECT,
                properties: {
                    biasScore: { type: Type.NUMBER },
                    publicInterestScore: { type: Type.NUMBER },
                    investigativeScore: { type: Type.NUMBER },
                    isPersonalPraise: { type: Type.BOOLEAN }
                }
            },
            entities: {
                type: Type.OBJECT,
                properties: {
                    people: { type: Type.ARRAY, items: { type: Type.STRING } },
                    organizations: { type: Type.ARRAY, items: { type: Type.STRING } },
                    locations: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
            }
        },
        required: ["headline", "content", "headlineEn", "contentEn", "location", "storyFingerprint", "refinedCategory", "isSafeForYouTube", "rejectionReason", "tags", "entities", "tone", "vocalContent", "isBreaking", "notificationWorthy"]
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            stories: {
                type: Type.ARRAY,
                items: singleStorySchema
            }
        },
        required: ["stories"]
    };

    console.log(`[AI_START] Processing: ${headline.substring(0, 30)}... (Type: ${actualPostData?.isReporter ? 'Reporter' : 'Citizen'})`);

    const metadataPrompt = `
SUBMISSION METADATA:
- type: ${actualPostData?.isReporter ? 'REPORTER_SUBMISSION' : 'CITIZEN_SUBMISSION'}
- isReporter: ${actualPostData?.isReporter === true}
- isCitizen: ${actualPostData?.isCitizen === true}
- district: ${actualPostData?.district || 'Unknown'}
- location: ${actualPostData?.location || 'Unknown'}

PROACTIVE MULTI-STORY BUNDLE DETECTION (CRITICAL):
- Proactively detect if the input text contains multiple distinct sub-stories or angles:
  1. Political Attack + Development Works/Achievements (e.g. Leader attacks rival on corruption, AND explains party's own development works or welfare comparison) -> MUST SPLIT into 2 distinct stories (Story 1: The sharp political/corruption attack; Story 2: Development works, achievements & challenges).
  2. Multiple distinct scandals/scams or allegations in the same press meet -> MUST SPLIT into 2 distinct stories.
  3. Bundled press releases / tour notes (Press meet + Project inauguration + Condolence) -> MUST SPLIT into 2 to 3 standalone stories.
- If multiple distinct events/topics exist, output 2 to 3 separate story objects in the 'stories' array.
- If strictly one single topic, return 1 story in the 'stories' array.
- Assign 'matchedImageIndex' (0, 1, 2) matching which attached photo corresponds to each story.

NOTIFICATION INSTRUCTIONS (CRITICAL):
- isBreaking: true ONLY if the news is genuinely urgent and time-sensitive
  (accidents, deaths, natural disasters, major political decisions, crimes, emergency events).
  Do NOT set true for routine news, press meets, events, or opinion pieces.
- notificationWorthy: true if the news is relevant to a broad audience and worth sending as a push notification.
- notificationTitle: If isBreaking or notificationWorthy is true, generate an intriguing Telugu curiosity hook title (max 8-10 words).
  If both are false, set notificationTitle to null.
- tone options: BREAKING | URGENT | IMPORTANT | NORMAL | SOFT
`;

    return await runWithAIFallback(async (ai, modelName) => {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `${metadataPrompt}\n\nHeadline: ${headline}\nContent: ${content}` }] }],
            config: {
                systemInstruction: getCategorySystemInstruction(),
                temperature: 0.4,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema,
                // Full compatibility aliases
                system_instruction: getCategorySystemInstruction(),
                response_mime_type: "application/json",
                response_schema: schema,
                max_output_tokens: 4096
            }
        } as any);

        const rawText = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        console.log(`[AI_RES] ${actualPostData.id || 'new'}:`, rawText.substring(0, 500));
        const aiRes = parseAIJson(rawText);

        let rawStories: any[] = [];
        if (Array.isArray(aiRes.stories) && aiRes.stories.length > 0) {
            rawStories = aiRes.stories;
        } else if (aiRes.headline || aiRes.content) {
            rawStories = [aiRes];
        } else if (Array.isArray(aiRes) && aiRes.length > 0) {
            rawStories = aiRes;
        }

        if (rawStories.length === 0) {
            throw new Error("AI response did not contain any valid stories.");
        }

        return rawStories.slice(0, 3).map((item, idx) => {
            const normalized = normalizeSingleStory(item, actualPostData);
            if (typeof item.matchedImageIndex === 'number') {
                normalized.matchedImageIndex = item.matchedImageIndex;
            } else {
                normalized.matchedImageIndex = idx;
            }
            return normalized;
        });
    });
}

/**
 * 6. Main News Processing (OnCall)
 */
export const processNewsPost = onCall(async (request) => {
    const { postId, headline: rawHeadline, content: rawContent, postData } = request.data;
    try {
        let headline = rawHeadline || postData?.headline?.telugu || "";
        let content = rawContent || postData?.content?.telugu || "";

        if (postId && (!headline || !content)) {
            const doc = await db.collection('news').doc(postId).get();
            if (doc.exists) {
                const d = doc.data();
                headline = headline || d?.headline?.telugu || "";
                content = content || d?.content?.telugu || "";
            }
        }

        if (!content) throw new HttpsError('invalid-argument', 'వార్త వివరణ (Content) తప్పనిసరి.');
        if (!headline) headline = content.substring(0, 60).split('\n')[0] + "...";

        const mediaUrl = postData?.mediaUrl || "";
        const mediaUrls = postData?.mediaUrls || (mediaUrl ? [mediaUrl] : []);

        const finalData = {
            ...postData,
            headline: { telugu: headline, english: postData?.headline?.english || "" },
            content: { telugu: content, english: postData?.content?.telugu || "" },
            mediaUrl: mediaUrl,
            mediaUrls: mediaUrls,
            isCitizen: postData?.isCitizen || true,
            isReporter: postData?.isReporter || false,
            aiProcessed: false,
            approved: false,
            status: "PENDING",
            timestamp: postData?.timestamp || admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };

        const reporterId = request.auth?.uid || (typeof postData?.reporter === 'string' ? postData.reporter : postData?.reporter?.id);
        if (reporterId && !reporterId.startsWith('BOT_') && !reporterId.startsWith('SYSTEM_')) {
            await db.collection('users').doc(reporterId).set({
                lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        if (postId) {
            await db.collection('news').doc(postId).update(finalData);
            return { success: true, postId: postId, message: "వార్త అప్‌డేట్ అవుతోంది..." };
        } else {
            const newDocRef = await db.collection('news').add(finalData);
            return { success: true, postId: newDocRef.id, message: "వార్త పంపబడింది. త్వరలో ప్రచురించబడుతుంది." };
        }
    } catch (e: any) { throw new HttpsError('internal', e.message); }
});

/**
 * 6.2 Background News Processing (Triggered on Create/Update)
 */
/**
 * Helper: Calculate points based on media type and AI quality signals
 */
function calculateIncentivePoints(hasVideo: boolean, qs?: any): number {
    let points = hasVideo ? 20 : 10;
    if (!qs) return points;

    // investigativeScore: High value investigative news (+30)
    if (qs.investigativeScore > 0.8) points += 30;
    // publicInterestScore: Public interest/Local problems (+15)
    else if (qs.publicInterestScore > 0.7) points += 15;

    // isPersonalPraise / biasScore: Reduced points for flattery or high bias
    if (qs.isPersonalPraise === true || qs.biasScore > 0.75) {
        points -= 8;
    }

    return Math.max(points, 2); // Minimum 2 points
}

/**
 * 6.2 Background News Processing (Combined Trigger)
 */
export const onNewsPostCreated = onDocumentWritten({
    document: "news/{postId}",
    region: REGION,
    secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
    memory: "2GiB",
    timeoutSeconds: 540,
    maxInstances: 5
}, async (event) => {
    const snapshot = event.data?.after;
    if (!snapshot || !snapshot.exists) return;
    const postId = event.params.postId;
    let data: any = snapshot.data();

    // 1. QUICK GUARD: Skip if document is already processed, approved, or published unless forceReprocess is set
    if (!data.forceReprocess) {
        if (data.approved === true || data.status === "PUBLISHED" || data.status === "REJECTED" || data.status === "FAILED") {
            return;
        }
        if (data.aiProcessed === true && (data.mediaType !== 'VIDEO' || data.videoProcessed === true)) {
            return;
        }
    }

    const beforeData = event.data?.before?.data() || {};
    const status = (data.status || "").toUpperCase();

    // Fields that should NOT trigger re-processing (views, likes, maintenance, reports)
    const passiveFields = [
        "longViews", "views", "likes", "shares", "comments", 
        "lastUpdated", "lastCleanupAt", "rawVideoCleaned", 
        "thumbnailUrl", "reportCount", "lastReportedAt", "hiddenReason"
    ];
    const isPassiveUpdate = Object.keys(data).every(key =>
        passiveFields.includes(key) || JSON.stringify(data[key]) === JSON.stringify(beforeData[key])
    );

    const LOCKED_STATUSES = ["REVIEWING_CONTENT", "PROCESSING_VIDEO_START", "FAILED", "REJECTED", "PUBLISHED", "ARCHIVED", "FAILED_YOUTUBE_UPLOAD", "PENDING_YOUTUBE_RETRY"];

    if (LOCKED_STATUSES.includes(status) && !data.forceReprocess) {
        // If it's already locked and not a forced reprocess, skip immediately without reading DB again
        return;
    }

    if (isPassiveUpdate && status !== "PENDING" && !data.forceReprocess) {
        // console.log(`[TRIGGER_SKIPPED] Passive update for ${postId}`);
        return;
    }
    // 2. FETCH LATEST: Only now we fetch to handle race conditions for actual content changes
    const latestDoc = await db.collection('news').doc(postId).get();
    const latestData = latestDoc.data();
    if (!latestData) return;

    const latestStatus = (latestData.status || "").toUpperCase();

    if (LOCKED_STATUSES.includes(latestStatus) && !data.forceReprocess) {
        console.log(`[TRIGGER_SKIPPED] ${postId} is already in state: ${latestStatus}`);
        return;
    }

    const originalReporterId = latestData.reporter?.id;
    const isReporter = latestData.isReporter === true || latestData.processingType === "REPORTER_SUBMISSION";

    // 2. SURVEY PROCESS — Translate survey using Gemini AI
    if (latestData.type === "survey") {
        if (latestData.aiProcessed) {
            // Already processed by AI, skip
            return;
        }

        console.log(`[SURVEY_AI_PROCESS] Starting translation for survey: ${postId}`);
        try {
            await db.collection('news').doc(postId).update({
                status: "REVIEWING_CONTENT", // Lock it
            });

            // Perform translation
            const translatedSurvey = await performSurveyAITranslation(latestData);

            const updatePayloadSurvey: any = {
                ...translatedSurvey,
                status: latestData.approved ? "PUBLISHED" : "PENDING",
                aiProcessed: true,
                publishedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            const mediaUrl = latestData.mediaUrl || (latestData.mediaUrls && latestData.mediaUrls[0]) || "";
            if (mediaUrl && !latestData.thumbnailUrl) {
                try {
                    const thumbUrl = await createAndSaveThumbnail(mediaUrl, postId);
                    if (thumbUrl) {
                        updatePayloadSurvey.thumbnailUrl = thumbUrl;
                    }
                } catch (e: any) {
                    console.error(`[THUMBNAIL_ERR] Error creating thumbnail:`, e.message);
                }
            }

            await db.collection('news').doc(postId).update(updatePayloadSurvey);
            console.log(`[SURVEY_AI_DONE] Successfully processed survey: ${postId}`);
            return;
        } catch (err: any) {
            console.error(`[SURVEY_AI_ERR] Failed to process survey ${postId}:`, err.message);
            await db.collection('news').doc(postId).update({
                status: "FAILED",
                error: err.message
            });
            return;
        }
    }

    // 3. AI PROCESSING PHASE
    // Trigger if not processed and status is PENDING or missing
    if (!latestData.aiProcessed && (latestStatus === "PENDING" || latestStatus === "" || data.forceReprocess)) {
        console.log(`[ON_WRITE_PROCEED] AI Start: ${postId}`);

        // LOCK immediately with a transaction-like update or at least a check-before-update
        // We use status: "REVIEWING_CONTENT" as the lock.
        await db.collection('news').doc(postId).update({
            status: "REVIEWING_CONTENT",
            lastProcessingStart: admin.firestore.FieldValue.serverTimestamp()
        });

        try {
            const headline = latestData.headline?.telugu || "";
            const content = latestData.content?.telugu || "";

            if (!headline || !content) {
                 await db.collection('news').doc(postId).update({ status: "FAILED", error: "Missing headline or content" });
                 return;
            }

            const processedStories = await performAIProcessing(headline, content, latestData);
            console.log(`[AI_SPLIT] Post ${postId} processed into ${processedStories.length} distinct stories.`);

            const availableMediaUrls: string[] = latestData.mediaUrls && latestData.mediaUrls.length > 0
                ? latestData.mediaUrls
                : (latestData.mediaUrl ? [latestData.mediaUrl] : []);

            for (let i = 0; i < processedStories.length; i++) {
                const aiProcessedData = processedStories[i];
                const targetPostId = i === 0 ? postId : `${postId}_part${i + 1}`;

                // --- MANDALAM REPORTER ASSIGNMENT LOGIC ---
                // Only auto-assign for citizen/auto posts; NEVER overwrite an official reporter's submission!
                if (!isReporter && !originalReporterId) {
                    const targetDistrict = data.district || (aiProcessedData.categories && aiProcessedData.categories.find((c: string) => !c.includes("వార్త") && c !== aiProcessedData.category));
                    const targetMandalam = aiProcessedData.location;

                    if (targetDistrict && targetMandalam) {
                        const assignedReporter = await getAssignedReporter(targetDistrict, targetMandalam);
                        if (assignedReporter) {
                            console.log(`[REPORTER_ASSIGN] Assigning citizen/auto post ${targetPostId} to ${assignedReporter.name} for mandalam ${targetMandalam}`);
                            aiProcessedData.reporter = assignedReporter;
                            aiProcessedData.isReporter = true;
                        }
                    }
                } else if (latestData.reporter) {
                    // Retain original submitting reporter
                    aiProcessedData.reporter = latestData.reporter;
                    aiProcessedData.isReporter = true;
                }

                const finalIsReporter = isReporter || aiProcessedData.isReporter;
                const isRejected = aiProcessedData.rejectionReason && aiProcessedData.rejectionReason.length > 0;

                const mTypes = (latestData.mediaTypes || []).map((t: string) => t.toUpperCase());
                const hasVideo = mTypes.includes('VIDEO') || latestData.mediaType?.toUpperCase() === 'VIDEO';

                const updatePayload: any = {
                    ...aiProcessedData,
                    status: isRejected ? "REJECTED" : (hasVideo ? "PROCESSING_VIDEO" : "published"),
                    approved: isRejected ? false : (finalIsReporter ? (hasVideo ? false : true) : (!hasVideo))
                };

                // Smart Photo Matching:
                // Use matchedImageIndex if valid, else match by index i or fallback to first image
                const imgIdx = typeof aiProcessedData.matchedImageIndex === 'number' && aiProcessedData.matchedImageIndex >= 0 && aiProcessedData.matchedImageIndex < availableMediaUrls.length
                    ? aiProcessedData.matchedImageIndex
                    : (i < availableMediaUrls.length ? i : 0);
                const storyMediaUrl = availableMediaUrls[imgIdx] || availableMediaUrls[0] || "";
                let isPostRejected = isRejected;

                if (storyMediaUrl && !hasVideo) {
                    try {
                        const optResult = await processAndOptimizeNewsImage(
                            storyMediaUrl,
                            targetPostId,
                            aiProcessedData.isGraphicOrBloody === true,
                            aiProcessedData.isSensitiveVictimOrMinor === true
                        );
                        if (optResult) {
                            if (!optResult.isSafe) {
                                console.warn(`[SAFETY_BLOCKED_POST] Post ${targetPostId} rejected due to unsafe/obscene image: ${optResult.rejectionReason}`);
                                isPostRejected = true;
                                updatePayload.status = "REJECTED";
                                updatePayload.approved = false;
                                updatePayload.rejectionReason = optResult.rejectionReason || "అసభ్యకరమైన లేదా చట్టవ్యతిరేక చిత్రం గుర్తించబడింది";
                                updatePayload.mediaUrl = "";
                                updatePayload.mediaUrls = [];
                                updatePayload.thumbnailUrl = "";
                            } else {
                                updatePayload.mediaUrl = optResult.optimizedUrl;
                                updatePayload.mediaUrls = [optResult.optimizedUrl];
                                updatePayload.thumbnailUrl = optResult.thumbnailUrl;
                                if (aiProcessedData.isGraphicOrBloody) {
                                    updatePayload.isGrayscale = true;
                                }
                                if (aiProcessedData.isSensitiveVictimOrMinor) {
                                    updatePayload.isPrivacyBlurred = true;
                                }
                            }
                        }
                    } catch (e: any) {
                        console.error(`[IMG_OPT_ERR] Error optimizing news image for ${targetPostId}:`, e.message);
                    }
                }

                console.log(`[AI_DONE] ${targetPostId} (Story ${i+1}/${processedStories.length}). Type: ${finalIsReporter ? 'REPORTER' : 'CITIZEN'}, Status: ${updatePayload.status}, Approved: ${updatePayload.approved}`);
                if (isPostRejected) console.log(`[AI_REJECTED] ${targetPostId} Reason: ${updatePayload.rejectionReason || aiProcessedData.rejectionReason}`);

                if (i === 0) {
                    await db.collection('news').doc(postId).update(updatePayload);
                } else {
                    const splitDocData = {
                        ...latestData,
                        ...updatePayload,
                        id: targetPostId,
                        parentPostId: postId,
                        splitPart: i + 1,
                        totalSplitParts: processedStories.length,
                        timestamp: latestData.timestamp || admin.firestore.FieldValue.serverTimestamp(),
                        createdAt: latestData.createdAt || admin.firestore.FieldValue.serverTimestamp()
                    };
                    await db.collection('news').doc(targetPostId).set(splitDocData);
                }

                // Notifications & Rewards
                if (isPostRejected && finalIsReporter && originalReporterId && i === 0) {
                    await notifyReporter(
                        originalReporterId,
                        targetPostId,
                        aiProcessedData.headline?.telugu || latestData.headline?.telugu || "",
                        'POLICY_VIOLATION',
                        ""
                    );
                }

                if (updatePayload.status === "published" && !isPostRejected && finalIsReporter && originalReporterId) {
                    const points = calculateIncentivePoints(false, updatePayload.qualitySignals);
                    await awardPointsToReporter(originalReporterId, points);
                    await notifyReporter(
                        originalReporterId,
                        targetPostId,
                        updatePayload.headline?.telugu || aiProcessedData.headline?.telugu || "",
                        'SUCCESS',
                        updatePayload.mediaUrl || storyMediaUrl
                    );
                }
            }
            return;
        } catch (err: any) {
            console.error(`[AI_FATAL_FAILED] ${postId}:`, err.message);
            await db.collection('news').doc(postId).update({
                status: "FAILED",
                error: err.message,
                aiProcessed: false,
                lastProcessingError: err.message,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
            return;
        }
    }

    // 3. VIDEO PROCESSING PHASE
    // Trigger if AI is done, has video, but not yet processed by YouTube
    const mTypes = (data.mediaTypes || []).map((t: string) => t.toUpperCase());
    const videoIndex = mTypes.indexOf('VIDEO') !== -1 ? mTypes.indexOf('VIDEO') : (data.mediaType?.toUpperCase() === 'VIDEO' ? 0 : -1);
    const videoUrl = (videoIndex !== -1 && data.mediaUrls && data.mediaUrls[videoIndex]) || (videoIndex === 0 ? data.mediaUrl : null);

    if (data.aiProcessed && status === "PROCESSING_VIDEO" && !data.videoProcessed) {
        if (!videoUrl) {
            console.error(`[VIDEO_ERR] ${postId}: Missing video URL for PROCESSING_VIDEO post.`);
            await db.collection('news').doc(postId).update({
                status: "published",
                approved: true,
                videoProcessed: false,
                processingError: "Missing video URL"
            });
            return;
        }
        // Double check against DB to avoid race conditions from onDocumentWritten
        const latestDoc = await db.collection('news').doc(postId).get();
        const latestData = latestDoc.data();
        if (!latestData) return;

        const latestStatus = (latestData.status || "").toUpperCase();
        if (latestStatus === "PROCESSING_VIDEO_START" || latestData.videoProcessed || latestStatus === "FAILED") {
            console.log(`[VIDEO_SKIPPED] ${postId} already processing, done, or failed.`);
            return;
        }

        console.log(`[VIDEO_START] ${postId}. URL: ${videoUrl.substring(0, 50)}...`);

        // LOCK immediately
        await db.collection('news').doc(postId).update({ status: "PROCESSING_VIDEO_START" });

        let videoPath = "";
        let audioPath = "";
        let outputPath = "";

        try {
            const teluguNews = data.content?.telugu || data.headline?.telugu || "";
            const reporterName = data.reporter?.name || "";

            // Build enhanced description with hashtags and entities
            const tags: string[] = Array.isArray(data.tags) ? data.tags : [];
            const baseTags = ["AlfaNews", "TeluguNews", "BreakingNews"];
            const allTags = Array.from(new Set([...tags, ...baseTags]));
            const hashTags = allTags.map(t => `#${t.replace(/\s+/g, '')}`).join(' ');

            let description = hashTags ? `${hashTags}\n\n` : "";
            if (reporterName) description += `రిపోర్టర్: ${reporterName}\n\n`;
            description += `${teluguNews}\n\n`;

            const people = data.entities?.people || [];
            const organizations = data.entities?.organizations || [];
            const locations = data.entities?.locations || [];

            if (people.length > 0) description += `వ్యక్తులు: ${people.join(', ')}\n`;
            if (organizations.length > 0) description += `సంస్థలు: ${organizations.join(', ')}\n`;
            if (locations.length > 0) description += `ప్రాంతాలు: ${locations.join(', ')}\n`;
            if (data.location) description += `స్థలం: ${data.location}\n`;

            description += `\n${hashTags}\n\n`;
            description += `మరిన్ని తాజా వార్తల కోసం ఆల్ఫా న్యూస్ అప్ ని ఇప్పుడే డౌన్లోడ్ చేసుకోండి\n`;
            description += `https://play.google.com/store/apps/details?id=com.alfanews.telugu\n\n`;

            const tempDir = os.tmpdir();
            videoPath = path.join(tempDir, `input_${postId}.mp4`);
            audioPath = path.join(tempDir, `audio_${postId}.mp3`);
            outputPath = path.join(tempDir, `output_${postId}.mp4`);

            // STREAMING DOWNLOAD to save memory and handle large files
            console.log(`[VIDEO_DOWNLOAD] Downloading ${videoUrl.substring(0, 50)}...`);
            const videoRes = await fetch(videoUrl);
            if (!videoRes.ok) throw new Error(`Video download failed: ${videoRes.statusText}`);
            if (!videoRes.body) throw new Error(`Video response body is null`);

            const { pipeline } = require('stream/promises');
            const { Readable } = require('stream');

            if (typeof (videoRes.body as any)[Symbol.asyncIterator] === 'function') {
                await pipeline(videoRes.body, fs.createWriteStream(videoPath));
            } else {
                await pipeline(Readable.fromWeb(videoRes.body as any), fs.createWriteStream(videoPath));
            }

            const ttsAuth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
            const authClient = await ttsAuth.getClient();
            const accessToken = (await authClient.getAccessToken()).token;

            let teluguVocal = data.vocalContent || teluguNews;

            // Filter out intro greetings like "నమస్కారం" so they don't get read in voiceover
            teluguVocal = teluguVocal.replace(/^(నమస్కారం|నమస్కారమండి|నమస్కారాలు|నమస్తే)[,\s!.]*/gi, '').trim();

            // 1. PROTECT STRESS TAGS and CLEAN OTHER BRACKETS
            // First, hide the STRESS tags so they don't get destroyed by bracket cleanup
            let vocal = teluguVocal.replace(/\[\[STRESS\]\]/g, '___STRESS_START___')
                                   .replace(/\[\[\/STRESS\]\]/g, '___STRESS_END___');

            // Now safely remove any other double brackets (AI emphasis like [[word]])
            vocal = vocal.replace(/\[\[/g, '').replace(/\]\]/g, '');

            // Restore protected tags to a safe internal format for processing
            vocal = vocal.replace(/___STRESS_START___/g, '[[STRESS]]')
                         .replace(/___STRESS_END___/g, '[[/STRESS]]');

            // 2. SAFE TRUNCATION: Truncate base text first to avoid cutting SSML tags later
            let baseText = vocal.substring(0, 4000).replace(/\s+/g, ' ').trim();

            // 3. SANITIZE: Escape XML special characters properly
            baseText = baseText.replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;')
                              .replace(/"/g, '&quot;')
                              .replace(/'/g, '&apos;');

            // 4. INJECT SSML: Clean markup for Studio (Chirp) voices
            // Chirp 3 HD handles punctuation (. , ...) naturally.
            // Internal SSML tags (<break>, inner <prosody>) cause unnatural audio boundary gaps/pauses.
            let processedText = baseText;
            processedText = processedText.replace(/,\s*,+/g, ','); // Clean double commas like ", ,"
            processedText = processedText.replace(/,\s*\./g, '.'); // Clean comma before period ", ."
            processedText = processedText.replace(/,\s*/g, ', ');
            processedText = processedText.replace(/\.\s*/g, '. ');
            
            // Clean STRESS tags cleanly so no internal SSML tags create unnatural gaps in Chirp 3 HD
            processedText = processedText.replace(/\[\[STRESS\]\](.*?)\[\[\/STRESS\]\]/g, '$1');

            // Pitch shift (-1.8st) gives a deep, serious, authoritative news-anchor tone (గంభీరత్వం)
            let selectedVoice = data.voiceModel || 'te-IN-Chirp3-HD-Kore';
            const ssml = `<speak><prosody rate="1.30" pitch="-1.8st" volume="+6dB">${processedText}</prosody></speak>`;

            console.log(`[TTS_REQUEST] postId: ${postId}, voice: ${selectedVoice}, ssml: ${ssml.substring(0, 500)}`);

            let ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                body: JSON.stringify({
                    input: { ssml: ssml },
                    voice: { languageCode: 'te-IN', name: selectedVoice },
                    audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 48000 }
                })
            });

            let ttsData: any = await ttsRes.json();

            // FALLBACK LOGIC: Try Neural2-B (Deep Male Voice) or Wavenet-B / Standard-A if primary fails
            if (!ttsData.audioContent) {
                console.warn(`[TTS_WARNING] Primary voice ${selectedVoice} failed. Trying Neural2 Male fallback.`);
                selectedVoice = 'te-IN-Neural2-B';
                ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                    body: JSON.stringify({
                        input: { ssml: ssml },
                        voice: { languageCode: 'te-IN', name: selectedVoice },
                        audioConfig: { audioEncoding: 'MP3', sampleRateHertz: 48000 }
                    })
                });
                ttsData = await ttsRes.json();
            }

            if (!ttsData.audioContent) {
                console.warn(`[TTS_WARNING] Neural2-B failed. Falling back to Standard-B.`);
                selectedVoice = 'te-IN-Standard-B';
                ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                    body: JSON.stringify({
                        input: { ssml: ssml },
                        voice: { languageCode: 'te-IN', name: selectedVoice },
                        audioConfig: { audioEncoding: 'MP3' }
                    })
                });
                ttsData = await ttsRes.json();
            }

            if (!ttsData.audioContent) throw new Error(`TTS failed even after fallback: ${ttsData.error?.message || 'No audio'}`);

            fs.writeFileSync(audioPath, Buffer.from(ttsData.audioContent, 'base64'));

            const logoPath = path.join(process.cwd(), 'assets', 'logo.png');
            const hasLogo = fs.existsSync(logoPath);

            await new Promise((resolve, reject) => {
                let logoWidth = 99;
                let hasAudioStream = false;
                let audioChannels = 2;
                let videoWidth = 720;
                let videoHeight = 1280;

                try {
                    const { execSync } = require('child_process');
                    const ffprobeStatic = require('ffprobe-static');
                    const probeOutput = execSync(`"${ffprobeStatic.path}" -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${videoPath}"`).toString().trim();
                    const parts = probeOutput.split('x');
                    videoWidth = parseInt(parts[0]) || 720;
                    videoHeight = parseInt(parts[1]) || 1280;

                    if (videoWidth <= 450) logoWidth = 54;
                    else if (videoWidth <= 950) logoWidth = 99;
                    else logoWidth = 144;

                    const audioProbe = execSync(`"${ffprobeStatic.path}" -v error -select_streams a:0 -show_entries stream=channels -of csv=s=x:p=0 "${videoPath}"`).toString().trim();
                    hasAudioStream = audioProbe.length > 0;
                    if (hasAudioStream) {
                        audioChannels = parseInt(audioProbe) || 2;
                    }
                } catch (e) {}

                const isVertical = videoHeight > videoWidth;
                const introFileName = isVertical ? 'YouTube_intro_BBC_style_9_16.mp4' : 'YouTube_channel_intro_16_9.mp4';
                const outroFileName = isVertical ? 'alfanews_outro_like_share_9_16.mp4' : 'alfanews_outro_like_share_16_9.mp4';

                const introPath = path.join(process.cwd(), 'assets', introFileName);
                const outroPath = path.join(process.cwd(), 'assets', outroFileName);
                const hasIntro = fs.existsSync(introPath);
                const hasOutro = fs.existsSync(outroPath);

                console.log(`[VIDEO_PROC] Res: ${videoWidth}x${videoHeight}, Vertical: ${isVertical}, HasIntro: ${hasIntro}, HasOutro: ${hasOutro}`);

                let cmd = ffmpeg(videoPath).input(audioPath);
                let logoInputIdx = -1;
                let introInputIdx = -1;
                let outroInputIdx = -1;
                let currentIdx = 2;

                if (hasLogo) {
                    cmd.input(logoPath);
                    logoInputIdx = currentIdx++;
                }
                if (hasIntro) {
                    cmd.input(introPath);
                    introInputIdx = currentIdx++;
                }
                if (hasOutro) {
                    cmd.input(outroPath);
                    outroInputIdx = currentIdx++;
                }

                const filterGraph: any[] = [];

                // 1. Logo Watermark Overlay
                if (hasLogo && logoInputIdx !== -1) {
                    filterGraph.push({ filter: 'scale', options: `${logoWidth}:-2`, inputs: `${logoInputIdx}:v`, outputs: 'logo' });
                    filterGraph.push({ filter: 'overlay', options: 'W-w-25:25', inputs: ['0:v', 'logo'], outputs: 'vlogo_raw' });
                } else {
                    filterGraph.push({ filter: 'null', inputs: '0:v', outputs: 'vlogo_raw' });
                }

                // 2. Audio Processing (Voiceover TTS + Muted/Ducked Original Video Audio)
                let mainAudioLabel = 'outa';
                if (hasAudioStream) {
                    let ttsDuration = 0;
                    try {
                        const { execSync } = require('child_process');
                        const ffprobeStatic = require('ffprobe-static');
                        const ttsProbe = execSync(`"${ffprobeStatic.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`).toString().trim();
                        ttsDuration = parseFloat(ttsProbe) || 0;
                    } catch (e) {}

                    filterGraph.push({
                        filter: 'volume',
                        options: { volume: `if(gte(t,${ttsDuration}),1,0)`, eval: 'frame' },
                        inputs: '0:a',
                        outputs: 'ducked_raw'
                    });

                    if (audioChannels === 1) {
                        filterGraph.push({ filter: 'pan', options: 'stereo|c0=c0|c1=c0', inputs: 'ducked_raw', outputs: 'ducked_stereo' });
                        filterGraph.push({ filter: 'aformat', options: { sample_fmts: 'fltp', sample_rates: 44100, channel_layouts: 'stereo' }, inputs: 'ducked_stereo', outputs: 'ducked' });
                    } else {
                        filterGraph.push({ filter: 'aformat', options: { sample_fmts: 'fltp', sample_rates: 44100, channel_layouts: 'stereo' }, inputs: 'ducked_raw', outputs: 'ducked' });
                    }

                    filterGraph.push({ filter: 'volume', options: 2.0, inputs: '1:a', outputs: 'tts_vol' });
                    filterGraph.push({ filter: 'aformat', options: { sample_fmts: 'fltp', sample_rates: 44100, channel_layouts: 'stereo' }, inputs: 'tts_vol', outputs: 'enhanced_tts' });
                    filterGraph.push({ filter: 'amix', options: { inputs: 2, duration: 'longest', dropout_transition: 0, normalize: 0 }, inputs: ['ducked', 'enhanced_tts'], outputs: 'outa' });
                } else {
                    filterGraph.push({ filter: 'volume', options: 2.0, inputs: '1:a', outputs: 'tts_vol' });
                    filterGraph.push({ filter: 'aformat', options: { sample_fmts: 'fltp', sample_rates: 44100, channel_layouts: 'stereo' }, inputs: 'tts_vol', outputs: 'enhanced_tts' });
                    mainAudioLabel = 'enhanced_tts';
                }

                // 3. Intro + Main Video + Outro Concatenation (Single Pass)
                if (hasIntro && hasOutro && introInputIdx !== -1 && outroInputIdx !== -1) {
                    const targetW = isVertical ? 1080 : 1920;
                    const targetH = isVertical ? 1920 : 1080;
                    const scalePadOpt = `${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p`;

                    filterGraph.push({ filter: 'scale', options: scalePadOpt, inputs: `${introInputIdx}:v`, outputs: 'vintro' });
                    filterGraph.push({ filter: 'scale', options: scalePadOpt, inputs: 'vlogo_raw', outputs: 'vmain' });
                    filterGraph.push({ filter: 'scale', options: scalePadOpt, inputs: `${outroInputIdx}:v`, outputs: 'voutro' });

                    filterGraph.push({ filter: 'aformat', options: { sample_fmts: 'fltp', sample_rates: 44100, channel_layouts: 'stereo' }, inputs: `${introInputIdx}:a`, outputs: 'aintro' });
                    filterGraph.push({ filter: 'aformat', options: { sample_fmts: 'fltp', sample_rates: 44100, channel_layouts: 'stereo' }, inputs: mainAudioLabel, outputs: 'amain' });
                    filterGraph.push({ filter: 'aformat', options: { sample_fmts: 'fltp', sample_rates: 44100, channel_layouts: 'stereo' }, inputs: `${outroInputIdx}:a`, outputs: 'aoutro' });

                    filterGraph.push({
                        filter: 'concat',
                        options: { n: 3, v: 1, a: 1 },
                        inputs: ['vintro', 'aintro', 'vmain', 'amain', 'voutro', 'aoutro'],
                        outputs: ['vf', 'outa_final']
                    });

                    cmd.complexFilter(filterGraph)
                        .outputOptions(['-c:v', 'libx264', '-preset', 'ultrafast', '-map', '[vf]', '-map', '[outa_final]', '-ar', '44100', '-ac', '2'])
                        .save(outputPath)
                        .on('end', () => resolve(true))
                        .on('error', (err: any) => reject(err));
                } else {
                    filterGraph.push({ filter: 'format', options: 'yuv420p', inputs: 'vlogo_raw', outputs: 'vf' });
                    cmd.complexFilter(filterGraph)
                        .outputOptions(['-c:v', 'libx264', '-preset', 'ultrafast', '-map', '[vf]', '-map', `[${mainAudioLabel}]`, '-ar', '44100', '-ac', '2'])
                        .save(outputPath)
                        .on('end', () => resolve(true))
                        .on('error', (err: any) => reject(err));
                }
            });

            const ytSettings = await db.collection('settings').doc('youtube').get();
            const refreshToken = ytSettings.exists ? ytSettings.data()?.refreshToken : process.env.YOUTUBE_REFRESH_TOKEN;
            if (!refreshToken) throw new Error("YouTube Refresh Token missing");

            const ytAuth = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET);
            ytAuth.setCredentials({ refresh_token: refreshToken });
            const youtube = google.youtube({ version: 'v3', auth: ytAuth });
            const ytRes = await youtube.videos.insert({
                part: ['snippet', 'status'],
                requestBody: { snippet: { title: (data.headline?.telugu || "Alfa News").substring(0, 100), description, categoryId: '25' }, status: { privacyStatus: 'public' } },
                media: { body: fs.createReadStream(outputPath) },
            });

            const ytVideoId = ytRes.data.id;
            const ytThumbnail = `https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg`;

            // ✅ CRITICAL COST OPTIMIZATION: Delete raw heavy MP4 from Firebase Storage
            if (videoUrl && videoUrl.includes('firebasestorage.googleapis.com')) {
                try {
                    const decodedUrl = decodeURIComponent(videoUrl);
                    const pathParts = decodedUrl.split('/o/');
                    if (pathParts.length >= 2) {
                        const rawStoragePath = pathParts[1].split('?')[0];
                        console.log(`[STORAGE_CLEANUP] Deleting uploaded raw video from storage: ${rawStoragePath}`);
                        await admin.storage().bucket().file(rawStoragePath).delete();
                    }
                } catch (delErr: any) {
                    console.warn(`[STORAGE_CLEANUP_WARN] Could not delete raw video: ${delErr.message}`);
                }
            }

            await db.collection('news').doc(postId).update({
                youtubeUrl: `https://www.youtube.com/watch?v=${ytVideoId}`,
                mediaUrl: ytThumbnail,
                mediaUrls: [ytThumbnail],
                thumbnailUrl: ytThumbnail,
                videoProcessed: true,
                status: "published",
                approved: true
            });

            // Award points to ORIGINAL reporter for video publication
            if (isReporter && originalReporterId) {
                const freshDoc = await db.collection('news').doc(postId).get();
                const freshData = freshDoc.data();
                const points = calculateIncentivePoints(true, freshData?.qualitySignals);

                await awardPointsToReporter(originalReporterId, points);
                await notifyReporter(originalReporterId, postId, data.headline?.telugu || "", 'SUCCESS');
            }
        } catch (err: any) {
            console.error(`[VIDEO_ERR] ${postId}: ${err.message}. Locking post in FAILED_YOUTUBE_UPLOAD to prevent storage egress loop.`);
            
            // Clean up raw storage file on failure as well to prevent storage accumulation
            if (videoUrl && videoUrl.includes('firebasestorage.googleapis.com')) {
                try {
                    const decodedUrl = decodeURIComponent(videoUrl);
                    const pathParts = decodedUrl.split('/o/');
                    if (pathParts.length >= 2) {
                        const rawStoragePath = pathParts[1].split('?')[0];
                        await admin.storage().bucket().file(rawStoragePath).delete();
                    }
                } catch (delErr: any) {}
            }

            // Lock in FAILED_YOUTUBE_UPLOAD so it never retries automatically or streams raw video from Firebase Storage to users
            await db.collection('news').doc(postId).update({
                status: "FAILED_YOUTUBE_UPLOAD",
                approved: false,
                videoProcessed: false,
                processingError: err.message,
                failedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } finally {
            [videoPath, audioPath, outputPath].forEach(p => { 
                if (p && fs.existsSync(p)) {
                    try { fs.unlinkSync(p); } catch (e) {}
                } 
            });
        }
    }
});
