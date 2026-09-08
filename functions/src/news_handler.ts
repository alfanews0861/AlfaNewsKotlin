import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { Type } from "@google/genai";
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
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
import { areMandalsMatching } from "./location_data";

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
 * Helper: Fast string similarity check (Jaccard similarity on Telugu word tokens)
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    const tokens1 = new Set(text1.toLowerCase().replace(/[^\u0C00-\u0C7F0-9a-zA-Z]/g, ' ').split(/\s+/).filter(w => w.length > 2));
    const tokens2 = new Set(text2.toLowerCase().replace(/[^\u0C00-\u0C7F0-9a-zA-Z]/g, ' ').split(/\s+/).filter(w => w.length > 2));
    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    let intersectionCount = 0;
    for (const t of tokens1) {
        if (tokens2.has(t)) intersectionCount++;
    }
    const unionSize = new Set([...tokens1, ...tokens2]).size;
    return unionSize > 0 ? (intersectionCount / unionSize) : 0;
}

/**
 * Helper: Fetch approved news in the same mandal/district from the last 6 hours (cost-effective query)
 */
export async function fetchRecentMandalNews(postData: any, currentPostId?: string): Promise<Array<{ id: string; headline: string; content: string; location: string }>> {
    const targetDistrict = (postData?.district || "").trim();
    const targetLocation = (postData?.location || postData?.mandal || "").trim();

    // Critical Safeguard: If no mandal/location is specified, do NOT fetch random district news as "same mandal"!
    if (!targetLocation || targetLocation.length < 2) {
        return [];
    }

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    try {
        let queryRef: admin.firestore.Query = db.collection('news')
            .where('approved', '==', true)
            .where('timestamp', '>=', sixHoursAgo);

        if (targetDistrict && targetDistrict !== "State" && targetDistrict !== "General") {
            queryRef = queryRef.where('district', '==', targetDistrict);
        }

        const snapshot = await queryRef.orderBy('timestamp', 'desc').limit(25).get();
        if (snapshot.empty) return [];

        const recentList: Array<{ id: string; headline: string; content: string; location: string }> = [];
        const normTargetLoc = targetLocation.toLowerCase().replace(/\s+/g, '');

        for (const doc of snapshot.docs) {
            if (currentPostId && doc.id === currentPostId) continue;
            const d = doc.data();
            const docLoc = (d.location || d.mandal || "").trim().toLowerCase().replace(/\s+/g, '');
            
            // Strictly match same mandal
            const isMandalMatch = docLoc === normTargetLoc || 
                (normTargetLoc.length > 2 && docLoc.length > 2 && (docLoc.includes(normTargetLoc) || normTargetLoc.includes(docLoc)));

            if (isMandalMatch) {
                const hl = d.headline?.telugu || d.title || "";
                const ct = d.content?.telugu || d.summary || "";
                if (hl || ct) {
                    recentList.push({
                        id: doc.id,
                        headline: hl,
                        content: ct,
                        location: d.location || d.mandal || targetLocation
                    });
                }
            }
        }

        return recentList.slice(0, 5); // At most 5 most recent stories for concise AI context
    } catch (e: any) {
        console.warn(`[DUPLICATE_FETCH_WARN] Could not fetch recent mandal news:`, e.message);
        return [];
    }
}

/**
 * Helper: Normalize a single AI-generated story object
 */
function normalizeSingleStory(aiRes: any, actualPostData: any): any {
    let finalContent = aiRes.content || aiRes.contentTe || aiRes.content_te ||
        aiRes.telugu?.content || aiRes.telugu?.contentTe || aiRes.telugu?.summary ||
        aiRes.telugu_version?.content || aiRes.telugu_version?.summary ||
        aiRes.summaryTe || aiRes.summarized_telugu_content || aiRes.summary ||
        aiRes.description || aiRes.summarizedTeluguContent || "";
    finalContent = sanitizeTeluguText(finalContent).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();

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

    let isDuplicate = aiRes.isDuplicate === true;
    const dupPostId = (aiRes.duplicateOfPostId || "").trim();
    let rejectionReason = (aiRes.rejectionReason || "").trim();

    // Critical Safeguard 1: If AI flagged isDuplicate=true but did not provide a valid duplicateOfPostId,
    // it is a hallucination. Override isDuplicate to false!
    if (isDuplicate && (!dupPostId || dupPostId.toLowerCase() === "null" || dupPostId.toLowerCase() === "none")) {
        console.warn(`[AI_DUP_FALSE_POSITIVE] AI flagged isDuplicate=true without valid duplicateOfPostId for "${finalHeadline}". Overriding isDuplicate to false.`);
        isDuplicate = false;
        if (rejectionReason.includes("డూప్లికేట్") || rejectionReason.toLowerCase().includes("duplicate")) {
            rejectionReason = "";
        }
    }

    // Safeguard 2: If AI marked isDuplicate = false, clear any contradictory duplicate rejectionReason
    if (!isDuplicate && (rejectionReason.includes("డూప్లికేట్") || rejectionReason.toLowerCase().includes("duplicate"))) {
        console.log(`[AI_RECONCILE] Clearing contradictory duplicate rejectionReason because isDuplicate is false.`);
        rejectionReason = "";
    }

    if (isDuplicate && (!rejectionReason || rejectionReason.toLowerCase() === "null" || rejectionReason.toLowerCase() === "none")) {
        rejectionReason = "ఈ మండలంలో గత 6 గంటల్లో ఇప్పటికే ప్రచురించబడిన వార్త (డూప్లికేట్).";
    }

    const isRejected = (rejectionReason && rejectionReason.length > 0) || isDuplicate;

    if (!isRejected && (!finalContent || !finalHeadline)) {
         console.warn("[AI_FIELD_WARNING] AI story item missing Telugu fields:", JSON.stringify(aiRes).substring(0, 300));
    }

    const finalContentEn = aiRes.contentEn || aiRes.content_en ||
        aiRes.english?.content || aiRes.english?.contentEn || aiRes.english?.summary ||
        aiRes.english_version?.content || aiRes.english_version?.summary ||
        aiRes.summaryEn || aiRes.summarized_english_content || aiRes.englishContent || "";

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
        isDuplicate: isDuplicate,
        duplicateOfPostId: aiRes.duplicateOfPostId || null,
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
export async function performAIProcessing(
    headline: string,
    content: string,
    actualPostData: any,
    recentStories: Array<{ id: string; headline: string; content: string; location: string }> = []
): Promise<any[]> {
    // 1. FAST PRE-CHECK: Text similarity against recent stories in the same mandal (0 Gemini Token cost)
    // Only trigger for near-identical copy-paste (>88% similarity) and NOT for routine welfare/ward-level events or video coverage
    const mTypes = (actualPostData?.mediaTypes || []).map((t: string) => String(t).toUpperCase());
    const isVideoPost = actualPostData?.mediaType?.toUpperCase() === 'VIDEO' || mTypes.includes('VIDEO');

    if (recentStories.length > 0 && !isVideoPost) {
        const isRoutineWelfareOrWard = (headline + " " + content).includes("పింఛన్") ||
            (headline + " " + content).includes("వార్డు") ||
            (headline + " " + content).includes("గ్రామం") ||
            (headline + " " + content).includes("కాలనీ") ||
            (headline + " " + content).includes("రేషన్") ||
            (headline + " " + content).includes("సంక్షేమ");

        if (!isRoutineWelfareOrWard) {
            for (const recent of recentStories) {
                const headlineSim = calculateTextSimilarity(headline, recent.headline);
                const contentSim = calculateTextSimilarity(content, recent.content);
                if (headlineSim >= 0.88 && contentSim >= 0.82) {
                    console.log(`[FAST_DUPLICATE_HIT] Near-exact text similarity hit with post ${recent.id} (headlineSim: ${headlineSim.toFixed(2)}, contentSim: ${contentSim.toFixed(2)})`);
                    return [{
                        headline: { telugu: headline, english: "" },
                        content: { telugu: content, english: "" },
                        notificationTitle: "",
                        location: actualPostData?.location || recent.location || "",
                        category: "జిల్లా వార్త",
                        categories: ["జిల్లా వార్త"],
                        tags: [],
                        entities: { people: [], organizations: [], locations: [] },
                        matchedImageIndex: 0,
                        isSafeForYouTube: true,
                        rejectionReason: "ఈ మండలంలో గత కొన్ని గంటల్లో ఈ వార్తాంశం ఇప్పటికే ప్రచురించబడింది.",
                        isDuplicate: true,
                        duplicateOfPostId: recent.id,
                        tone: "NORMAL",
                        vocalContent: content,
                        qualitySignals: { biasScore: 0.5, publicInterestScore: 0.5, investigativeScore: 0, isPersonalPraise: false },
                        storyFingerprint: `dup_${recent.id}`,
                        isBreaking: false,
                        notificationWorthy: false,
                        isGraphicOrBloody: false,
                        isSensitiveVictimOrMinor: false,
                        aiProcessed: true,
                        aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    }];
                }
            }
        }
    }

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
            isDuplicate: { type: Type.BOOLEAN },
            duplicateOfPostId: { type: Type.STRING, nullable: true },
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
        required: ["headline", "content", "headlineEn", "contentEn", "location", "storyFingerprint", "refinedCategory", "isSafeForYouTube", "rejectionReason", "isDuplicate", "tags", "entities", "tone", "vocalContent", "isBreaking", "notificationWorthy"]
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

    const recentStoriesPrompt = recentStories.length > 0
        ? `\nRECENT APPROVED NEWS IN THIS SAME MANDAL IN THE PAST 6 HOURS:\n` +
          recentStories.map((s, idx) => `[Prior Story ${idx + 1}] ID: ${s.id} | Location: ${s.location} | Headline: ${s.headline} | Content: ${s.content.substring(0, 150)}`).join('\n') +
          `\n\nDUPLICATE DETECTION RULES (CRITICAL):\n` +
          `- Compare incoming news with the [Prior Story] list in this same mandal above.\n` +
          `- DIFFERENT TOPICS/EVENTS IN THE SAME MANDAL ARE 100% PERMITTED AND ARE NEVER DUPLICATES (CRITICAL):\n` +
          `  * A mandal has many diverse everyday events. Multiple different news stories from the same mandal MUST ALL BE PUBLISHED.\n` +
          `  * Examples of distinct, non-duplicate stories in the same mandal:\n` +
          `    - Story A is about voter list verification / inquiry (ఓటర్ల సర్వే / ధ్రువపత్రాల పరిశీలన) vs Story B is about garbage/waste collection vehicle shortage (చెత్త సేకరణ వాహనాల కొరత) -> COMPLETELY DIFFERENT TOPICS -> NOT DUPLICATE (isDuplicate = false).\n` +
          `    - School infrastructure issues vs Police inspections vs Local elections vs Sports meet vs Road accident -> COMPLETELY DIFFERENT TOPICS -> NOT DUPLICATE (isDuplicate = false).\n` +
          `- ROUTINE WELFARE & WARD/VILLAGE-LEVEL SCHEMES EXEMPTION:\n` +
          `  * Routine welfare events (e.g. NTR Bharosa Pensions / ఎన్టీఆర్ భరోసా పింఛన్ల పంపిణీ, Ration distribution, Kalyanamastu, Medical camps, House site pattas) happening in DIFFERENT WARDS (e.g. 24th Ward vs 10th Ward or Ward 1 vs Ward 2), DIFFERENT VILLAGES, OR DIFFERENT HABITATIONS in the same mandal are NOT duplicates! They are distinct ward/village events.\n` +
          `- VIDEO COVERAGE EXEMPTION (CRITICAL):\n` +
          `  * If the incoming post is a VIDEO report (mediaType = VIDEO or includes video), it is NEVER a duplicate of an earlier text/photo story! Video coverage is distinct multimedia content. Set isDuplicate = false, duplicateOfPostId = null.\n` +
          `- ONLY MARK isDuplicate = true IF AND ONLY IF:\n` +
          `  * The incoming news is reporting the EXACT SAME real-world incident/event (same exact accident at the same spot, same exact press meet/statement, same individual death/theft, same meeting) that has ALREADY been covered in one of the [Prior Story] items above, AND is the same media format.\n` +
          `  * In that case only:\n` +
          `    1. Set isDuplicate = true\n` +
          `    2. Set duplicateOfPostId = matching Prior Story ID\n` +
          `    3. Set rejectionReason = "ఈ మండలంలో గత కొన్ని గంటల్లో ఈ వార్తాంశం ఇప్పటికే ప్రచురించబడింది."\n` +
          `- IF IT IS A DIFFERENT TOPIC, DIFFERENT EVENT, DIFFERENT WARD/VILLAGE, VIDEO COVERAGE, OR FOLLOW-UP:\n` +
          `  1. Set isDuplicate = false\n` +
          `  2. Set duplicateOfPostId = null\n` +
          `  3. Leave rejectionReason empty "" (DO NOT put duplicate rejection message if topics differ!).\n`
        : `\nDUPLICATE DETECTION: No recent stories found in this mandal in the past 6 hours. Set isDuplicate = false, duplicateOfPostId = null.\n`;

    const metadataPrompt = `
SUBMISSION METADATA:
- type: ${actualPostData?.isReporter ? 'REPORTER_SUBMISSION' : 'CITIZEN_SUBMISSION'}
- isReporter: ${actualPostData?.isReporter === true}
- isCitizen: ${actualPostData?.isCitizen === true}
- district: ${actualPostData?.district || 'Unknown'}
- location: ${actualPostData?.location || 'Unknown'}

${recentStoriesPrompt}

EDITORIAL & REJECTION INSTRUCTIONS (CRITICAL):
- rejectionReason MUST be phrased politely in professional Telugu as if written by a Human Chief Editor / News Desk. NEVER mention AI, algorithms, bots, or automated systems. Explain naturally like an editor (e.g. 'ఈ మండలంలో ఈ వార్తాంశం ఇప్పటికే ప్రచురితమైంది', 'వార్తలో ప్రజా ప్రయోజనం కొరవడింది లేదా వ్యక్తిగత ప్రచారం', 'చిత్రం ప్రచురణ ప్రమాణాలకు అనుగుణంగా లేదు').


PROACTIVE MULTI-STORY BUNDLE DETECTION (CRITICAL):
- Proactively detect if the input text contains multiple distinct sub-stories or angles:
  1. Political Attack + Development Works/Achievements -> MUST SPLIT into 2 distinct stories.
  2. Multiple distinct scandals/scams or allegations in the same press meet -> MUST SPLIT into 2 distinct stories.
  3. Bundled press releases / tour notes -> MUST SPLIT into 2 to 3 standalone stories.
- If multiple distinct events/topics exist, output 2 to 3 separate story objects in the 'stories' array.
- If strictly one single topic, return 1 story in the 'stories' array.
- Assign 'matchedImageIndex' (0, 1, 2) matching which attached photo corresponds to each story.

NOTIFICATION INSTRUCTIONS (CRITICAL):
- isBreaking: true ONLY if the news is genuinely urgent and time-sensitive (accidents, deaths, natural disasters, major political decisions, crimes, emergency events).
- notificationWorthy: true if the news is relevant to a broad audience and worth sending as a push notification.
- notificationTitle: If isBreaking or notificationWorthy is true, generate an intriguing Telugu curiosity hook title (max 8-10 words).
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

        const isCitizen = postData?.isCitizen === true || (!postData?.isReporter && postData?.processingType !== "REPORTER_SUBMISSION");
        const reporterId = request.auth?.uid || (typeof postData?.reporter === 'string' ? postData.reporter : postData?.reporter?.id);
        const finalReporter = isCitizen
            ? { id: reporterId || "", name: "సిటిజెన్ పోస్ట్" }
            : (postData?.reporter || { id: reporterId || "", name: "" });

        const finalData = {
            ...postData,
            headline: { telugu: headline, english: postData?.headline?.english || "" },
            content: { telugu: content, english: postData?.content?.telugu || "" },
            mediaUrl: mediaUrl,
            mediaUrls: mediaUrls,
            reporter: finalReporter,
            isCitizen: isCitizen,
            isReporter: !isCitizen && (postData?.isReporter === true),
            aiProcessed: false,
            approved: false,
            status: "PENDING",
            timestamp: postData?.timestamp || admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };

        if (reporterId && !reporterId.startsWith('BOT_') && !reporterId.startsWith('SYSTEM_')) {
            await db.collection('users').doc(reporterId).set({
                lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        if (postId) {
            const postRef = db.collection('news').doc(postId);
            const existingSnap = await postRef.get();
            if (!existingSnap.exists) {
                throw new HttpsError('not-found', 'వార్త లభించలేదు.');
            }
            const existingData = existingSnap.data() || {};
            const wasApproved = existingData.approved === true || (existingData.status || '').toUpperCase() === 'PUBLISHED';

            if (wasApproved) {
                const updatePayload: any = {
                    ...postData,
                    headline: {
                        telugu: headline,
                        english: postData?.headline?.english || existingData.headline?.english || ""
                    },
                    content: {
                        telugu: content,
                        english: postData?.content?.english || existingData.content?.english || ""
                    },
                    mediaUrl: mediaUrl || existingData.mediaUrl || "",
                    mediaUrls: mediaUrls.length > 0 ? mediaUrls : (existingData.mediaUrls || (existingData.mediaUrl ? [existingData.mediaUrl] : [])),
                    mediaType: postData?.mediaType || existingData.mediaType || "IMAGE",
                    mediaTypes: postData?.mediaTypes || existingData.mediaTypes || ["IMAGE"],
                    youtubeUrl: postData?.youtubeUrl !== undefined ? postData.youtubeUrl : (existingData.youtubeUrl || null),
                    location: postData?.location || existingData.location || "",
                    district: postData?.district || existingData.district || "State",
                    state: postData?.state || existingData.state || "TS",
                    category: postData?.category || existingData.category || "General News",
                    categories: postData?.categories || existingData.categories || [],
                    isGlobal: postData?.isGlobal !== undefined ? postData.isGlobal : (existingData.isGlobal || false),
                    approved: true,
                    status: "PUBLISHED",
                    aiProcessed: true,
                    videoProcessed: existingData.videoProcessed ?? true,
                    timestamp: existingData.timestamp || admin.firestore.FieldValue.serverTimestamp(),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                };

                if (existingData.likes !== undefined) updatePayload.likes = existingData.likes;
                if (existingData.comments !== undefined) updatePayload.comments = existingData.comments;
                if (existingData.shares !== undefined) updatePayload.shares = existingData.shares;
                if (existingData.views !== undefined) updatePayload.views = existingData.views;
                if (existingData.longViews !== undefined) updatePayload.longViews = existingData.longViews;
                if (existingData.reporter) updatePayload.reporter = existingData.reporter;
                if (existingData.originalReporterId) updatePayload.originalReporterId = existingData.originalReporterId;
                if (existingData.type) updatePayload.type = existingData.type;

                await postRef.update(updatePayload);
                console.log(`[NEWS_POST_EDIT_PUBLISHED] Post ${postId} updated directly without unpublishing.`);
                return { success: true, postId: postId, message: "వార్త విజయవంతంగా నవీకరించబడింది." };
            } else {
                const updatePayload: any = {
                    ...finalData,
                    forceReprocess: true,
                    rejectionReason: admin.firestore.FieldValue.delete(),
                    error: admin.firestore.FieldValue.delete(),
                    timestamp: existingData.timestamp || admin.firestore.FieldValue.serverTimestamp()
                };
                await postRef.update(updatePayload);
                console.log(`[NEWS_POST_EDIT_PENDING] Post ${postId} updated and queued for re-processing.`);
                return { success: true, postId: postId, message: "వార్త అప్‌డేట్ అవుతోంది..." };
            }
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

    const originalReporterId = latestData.reporter?.id || (typeof latestData.reporter === 'string' ? latestData.reporter : null) || latestData.originalReporterId || latestData.userId || latestData.reporter?.name;
    const isCitizen = latestData.isCitizen === true || latestData.reporter?.name === "సిటిజెన్ పోస్ట్" || (!latestData.isReporter && latestData.processingType !== "REPORTER_SUBMISSION");
    const isReporter = !isCitizen && (latestData.isReporter === true || latestData.processingType === "REPORTER_SUBMISSION");

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
    // Trigger if not processed and status is PENDING or missing, or if forceReprocess is set
    if ((!latestData.aiProcessed || data.forceReprocess) && (latestStatus === "PENDING" || latestStatus === "" || data.forceReprocess)) {
        console.log(`[ON_WRITE_PROCEED] AI Start: ${postId}`);

        // Loop prevention: If reprocess count exceeds 3, abort to avoid infinite loop
        if ((latestData.reprocessCount || 0) >= 3) {
            console.warn(`[REPROCESS_ABORT] Post ${postId} reached max reprocess limit (3). Aborting to prevent infinite loop.`);
            await db.collection('news').doc(postId).update({
                status: "FAILED",
                error: "Max reprocess attempts exceeded (infinite loop safeguard)",
                forceReprocess: admin.firestore.FieldValue.delete()
            });
            return;
        }

        // LOCK immediately with a transaction-like update or at least a check-before-update
        // We use status: "REVIEWING_CONTENT" as the lock and immediately clear forceReprocess
        await db.collection('news').doc(postId).update({
            status: "REVIEWING_CONTENT",
            forceReprocess: admin.firestore.FieldValue.delete(),
            lastProcessingStart: admin.firestore.FieldValue.serverTimestamp()
        });

        try {
            const headline = latestData.headline?.telugu || "";
            const content = latestData.content?.telugu || "";

            if (!headline || !content) {
                 await db.collection('news').doc(postId).update({ status: "FAILED", error: "Missing headline or content" });
                 return;
            }

            // Fetch recent news in the same mandal/district from the last 6 hours (cost-effective)
            const recentMandalNews = await fetchRecentMandalNews(latestData, postId);
            const processedStories = await performAIProcessing(headline, content, latestData, recentMandalNews);
            console.log(`[AI_SPLIT] Post ${postId} processed into ${processedStories.length} distinct stories.`);

            const availableMediaUrls: string[] = latestData.mediaUrls && latestData.mediaUrls.length > 0
                ? latestData.mediaUrls
                : (latestData.mediaUrl ? [latestData.mediaUrl] : []);

            // Fetch submitting reporter assigned mandal to verify cross-mandal submissions
            let submittingReporterAssignedMandal = "";
            if (originalReporterId && !isCitizen) {
                try {
                    const repDoc = await db.collection('users').doc(originalReporterId).get();
                    if (repDoc.exists) {
                        const repData = repDoc.data();
                        submittingReporterAssignedMandal = (repData?.assignedMandal || repData?.mandal || repData?.mandalam || "").trim();
                    }
                } catch (e: any) {
                    console.warn(`[REPORTER_MANDAL_FETCH_WARN] Could not fetch user data for ${originalReporterId}:`, e.message);
                }
            }

            for (let i = 0; i < processedStories.length; i++) {
                const aiProcessedData = processedStories[i];
                const targetPostId = i === 0 ? postId : `${postId}_part${i + 1}`;
                const targetMandalam = (aiProcessedData.location || latestData.location || latestData.mandal || "").trim();

                // --- MANDALAM REPORTER ASSIGNMENT & ATTRIBUTION LOGIC ---
                // Only auto-assign for scraper/auto posts; NEVER overwrite citizen posts!
                if (isCitizen) {
                    aiProcessedData.reporter = { id: latestData.reporter?.id || originalReporterId || "", name: "సిటిజెన్ పోస్ట్" };
                    aiProcessedData.isCitizen = true;
                    aiProcessedData.isReporter = false;
                } else if (!isReporter && !originalReporterId) {
                    const targetDistrict = data.district || (aiProcessedData.categories && aiProcessedData.categories.find((c: string) => !c.includes("వార్త") && c !== aiProcessedData.category));

                    if (targetDistrict && targetMandalam) {
                        const assignedReporter = await getAssignedReporter(targetDistrict, targetMandalam);
                        if (assignedReporter) {
                            console.log(`[REPORTER_ASSIGN] Assigning auto post ${targetPostId} to ${assignedReporter.name} for mandalam ${targetMandalam}`);
                            aiProcessedData.reporter = assignedReporter;
                            aiProcessedData.isReporter = true;
                        } else {
                            aiProcessedData.reporter = { id: "ALFA_DESK", name: "Alfa News Desk" };
                            aiProcessedData.isReporter = true;
                        }
                    }
                } else if (originalReporterId) {
                    // Submitting reporter post: check if cross-mandal post (outside assigned mandal)
                    const targetDistrict = data.district || latestData.district || (aiProcessedData.categories && aiProcessedData.categories.find((c: string) => !c.includes("వార్త") && c !== aiProcessedData.category));

                    let isDifferentMandal = false;
                    if (submittingReporterAssignedMandal && targetMandalam) {
                        const isMatch = areMandalsMatching(targetMandalam, submittingReporterAssignedMandal, targetDistrict);
                        isDifferentMandal = !isMatch;
                    }

                    if (isDifferentMandal) {
                        console.log(`[CROSS_MANDAL_CREDIT] Reporter ${originalReporterId} (assigned: '${submittingReporterAssignedMandal}') posted for '${targetMandalam}'. Attribution set to 'Alfa News Desk'. Points will be credited to reporter.`);
                        aiProcessedData.reporter = {
                            id: originalReporterId,
                            name: "Alfa News Desk",
                            originalReporterName: latestData.reporter?.name || "Reporter"
                        };
                    } else {
                        aiProcessedData.reporter = latestData.reporter || { id: originalReporterId, name: "Reporter" };
                    }
                    aiProcessedData.isReporter = true;
                }

                const finalIsReporter = !isCitizen && (isReporter || aiProcessedData.isReporter);
                const finalIsCitizen = isCitizen;
                const isDuplicateStory = aiProcessedData.isDuplicate === true;

                // ACCIDENT & CRIME SHIELD:
                // Never reject accident/crime stories because of graphic/injury mentions; instead convert image to B&W/Grayscale and publish!
                const rawRejection = (aiProcessedData.rejectionReason || "").trim();
                const isAccidentOrInjury = rawRejection.includes("ప్రమాదం") ||
                    rawRejection.includes("రక్తపాతం") ||
                    rawRejection.includes("గాయాలు") ||
                    rawRejection.includes("దృశ్యం") ||
                    rawRejection.includes("మరణం") ||
                    rawRejection.includes("మృతి");

                if (isAccidentOrInjury && !isDuplicateStory) {
                    console.log(`[ACCIDENT_SHIELD] Post ${targetPostId}: Overriding rejection for accident/injury story. Enabling isGraphicOrBloody to apply B&W/blur.`);
                    aiProcessedData.rejectionReason = null;
                    aiProcessedData.isGraphicOrBloody = true;
                    aiProcessedData.isBreaking = true;
                }

                const isRejected = (aiProcessedData.rejectionReason && aiProcessedData.rejectionReason.length > 0) || isDuplicateStory;

                const mTypes = (latestData.mediaTypes || []).map((t: string) => t.toUpperCase());
                const rawMediaUrl = latestData.mediaUrl || "";
                const rawMediaUrls = Array.isArray(latestData.mediaUrls) ? latestData.mediaUrls : [];
                const isDirectYoutube = (latestData.youtubeUrl && latestData.youtubeUrl.length > 5) ||
                    rawMediaUrl.includes('youtube.com') || rawMediaUrl.includes('youtu.be') ||
                    rawMediaUrls.some((u: string) => typeof u === 'string' && (u.includes('youtube.com') || u.includes('youtu.be')));

                const hasVideo = mTypes.includes('VIDEO') || latestData.mediaType?.toUpperCase() === 'VIDEO' || isDirectYoutube;
                const isAlreadyVideoReady = latestData.videoProcessed === true || isDirectYoutube;
                const shouldWaitForVideoUpload = hasVideo && !isAlreadyVideoReady;

                const updatePayload: any = {
                    ...aiProcessedData,
                    isCitizen: finalIsCitizen,
                    isReporter: finalIsReporter,
                    reporter: finalIsCitizen ? { id: latestData.reporter?.id || originalReporterId || "", name: "సిటిజెన్ పోస్ట్" } : (aiProcessedData.reporter || latestData.reporter),
                    status: isRejected ? "REJECTED" : (shouldWaitForVideoUpload ? "PROCESSING_VIDEO" : "PUBLISHED"),
                    approved: isRejected ? false : (shouldWaitForVideoUpload ? false : true),
                    ...(isAlreadyVideoReady ? { videoProcessed: true } : {})
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

                // Notifications & Rewards (Send to both registered reporters and citizen journalists)
                if (isPostRejected && originalReporterId && i === 0) {
                    const notifyType = isDuplicateStory ? 'DUPLICATE' : 'POLICY_VIOLATION';
                    const specificReason = updatePayload.rejectionReason || aiProcessedData.rejectionReason || "";
                    await notifyReporter(
                        originalReporterId,
                        targetPostId,
                        aiProcessedData.headline?.telugu || latestData.headline?.telugu || "",
                        notifyType,
                        "",
                        specificReason
                    );
                }

                if (updatePayload.status === "published" && !isPostRejected && originalReporterId) {
                    if (finalIsReporter) {
                        const points = calculateIncentivePoints(false, updatePayload.qualitySignals);
                        await awardPointsToReporter(originalReporterId, points);
                    }
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

            // Graceful Reporter Fallback:
            // If post is from a registered reporter and has valid headline & content,
            // do NOT leave it stuck in FAILED! Publish directly with reporter's original content so news goes LIVE immediately!
            if (isReporter && (latestData.headline?.telugu || latestData.headline) && (latestData.content?.telugu || latestData.content)) {
                console.log(`[AI_FALLBACK_PUBLISH] Publishing reporter post ${postId} directly with original content due to AI temporary outage.`);
                const mediaUrl = latestData.mediaUrl || (latestData.mediaUrls && latestData.mediaUrls[0]) || "";
                const updatePayloadFallback: any = {
                    headline: {
                        telugu: latestData.headline?.telugu || latestData.headline || "",
                        english: latestData.headline?.english || ""
                    },
                    content: {
                        telugu: latestData.content?.telugu || latestData.content || "",
                        english: latestData.content?.english || ""
                    },
                    category: latestData.category || "జిల్లా వార్త",
                    categories: Array.isArray(latestData.categories) ? latestData.categories : ["జిల్లా వార్త"],
                    status: "published",
                    approved: true,
                    aiProcessed: false,
                    isReporter: true,
                    isCitizen: false,
                    lastProcessingError: err.message,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('news').doc(postId).update(updatePayloadFallback);
                if (originalReporterId) {
                    await awardPointsToReporter(originalReporterId, 2);
                    await notifyReporter(
                        originalReporterId,
                        postId,
                        latestData.headline?.telugu || latestData.headline || "వార్త",
                        'SUCCESS',
                        mediaUrl
                    );
                }
                return;
            }

            await db.collection('news').doc(postId).update({
                status: "FAILED",
                error: err.message,
                aiProcessed: false,
                lastProcessingError: err.message,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
            if (originalReporterId) {
                await notifyReporter(
                    originalReporterId,
                    postId,
                    latestData.headline?.telugu || "వార్త",
                    'INTERNAL_ERROR',
                    "",
                    err.message
                );
            }
            return;
        }
    }

    // 3. VIDEO PROCESSING PHASE
    // Trigger if AI is done, has video, but not yet processed by YouTube
    const mTypes = (data.mediaTypes || []).map((t: string) => t.toUpperCase());
    const videoIndex = mTypes.indexOf('VIDEO') !== -1 ? mTypes.indexOf('VIDEO') : (data.mediaType?.toUpperCase() === 'VIDEO' ? 0 : -1);
    const videoUrl = (videoIndex !== -1 && data.mediaUrls && data.mediaUrls[videoIndex]) || (videoIndex === 0 ? data.mediaUrl : null);

    if (data.aiProcessed && (status === "PROCESSING_VIDEO" || status === "PENDING_YOUTUBE_RETRY") && !data.videoProcessed) {
        // Direct YouTube link detection: If news has an existing YouTube link, publish directly without FFmpeg
        const rawYtUrl = (data.youtubeUrl || videoUrl || "").trim();
        const isYoutubeLink = rawYtUrl.includes('youtube.com') || rawYtUrl.includes('youtu.be');

        if (isYoutubeLink) {
            console.log(`[VIDEO_YOUTUBE_DIRECT] ${postId} is already a direct YouTube URL (${rawYtUrl}). Publishing directly without FFmpeg.`);
            let ytId = "";
            const ytMatch = rawYtUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
            if (ytMatch && ytMatch[1]) {
                ytId = ytMatch[1];
            }
            const cleanYtUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : rawYtUrl;
            const ytThumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : (data.thumbnailUrl || data.mediaUrl || "");

            await db.collection('news').doc(postId).update({
                youtubeUrl: cleanYtUrl,
                mediaUrl: ytThumb,
                mediaUrls: [ytThumb],
                thumbnailUrl: ytThumb,
                videoProcessed: true,
                status: "published",
                approved: true,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });

            if (isReporter && originalReporterId) {
                const points = calculateIncentivePoints(true, data.qualitySignals);
                await awardPointsToReporter(originalReporterId, points);
                await notifyReporter(originalReporterId, postId, data.headline?.telugu || "", 'SUCCESS');
            }
            return;
        }

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
        if ((latestStatus === "PROCESSING_VIDEO_START" && !data.forceReprocess) || latestData.videoProcessed || latestStatus === "FAILED") {
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

            // 2. SAFE TRUNCATION: Truncate base text
            let baseText = vocal.substring(0, 3000).replace(/\s+/g, ' ').trim();

            // Prepare clean plain Telugu vocal text for Sarvam AI with expressive punctuation
            let plainVocalText = baseText.replace(/\[\[STRESS\]\](.*?)\[\[\/STRESS\]\]/g, '$1');
            plainVocalText = plainVocalText.replace(/,\s*,+/g, ',');
            plainVocalText = plainVocalText.replace(/,\s*\./g, '.');
            plainVocalText = plainVocalText.replace(/,\s*/g, ', ');
            plainVocalText = plainVocalText.replace(/\.\s*/g, '. ');
            plainVocalText = plainVocalText.replace(/!\s*/g, '! ');
            plainVocalText = plainVocalText.replace(/\?\s*/g, '? ');
            plainVocalText = plainVocalText.substring(0, 2500).trim();

            let audioBuffer: Buffer | null = null;
            const sarvamApiKey = process.env.SARVAM_API_KEY;

            // --- PRIMARY TTS: Sarvam AI (Simran, Telugu, 1.25x speed, 0.85 temperature, 44.1kHz High Quality Stereo) ---
            if (sarvamApiKey) {
                try {
                    console.log(`[SARVAM_TTS_REQUEST] postId: ${postId}, speaker: simran, pace: 1.25, temp: 0.85, length: ${plainVocalText.length}`);
                    const sarvamRes = await fetch('https://api.sarvam.ai/text-to-speech', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'api-subscription-key': sarvamApiKey
                        },
                        body: JSON.stringify({
                            inputs: [plainVocalText],
                            target_language_code: 'te-IN',
                            speaker: 'simran',
                            pace: 1.25,
                            temperature: 0.85,
                            model: 'bulbul:v3',
                            speech_sample_rate: 44100
                        }),
                        signal: AbortSignal.timeout(25000)
                    });

                    if (sarvamRes.ok) {
                        const sarvamData: any = await sarvamRes.json();
                        if (sarvamData.audios && Array.isArray(sarvamData.audios) && sarvamData.audios.length > 0 && sarvamData.audios[0]) {
                            audioBuffer = Buffer.from(sarvamData.audios[0], 'base64');
                            console.log(`[SARVAM_TTS_SUCCESS] Generated voiceover using Sarvam AI for post ${postId} (Bytes: ${audioBuffer.length})`);
                        } else {
                            console.warn(`[SARVAM_TTS_WARNING] Sarvam AI returned OK but no audio content:`, JSON.stringify(sarvamData));
                        }
                    } else {
                        const errText = await sarvamRes.text().catch(() => '');
                        console.warn(`[SARVAM_TTS_WARNING] Sarvam AI HTTP error ${sarvamRes.status}: ${errText}`);
                    }
                } catch (sarvamErr: any) {
                    console.warn(`[SARVAM_TTS_ERROR] Sarvam AI request failed: ${sarvamErr.message}`);
                }
            } else {
                console.log(`[SARVAM_TTS_INFO] SARVAM_API_KEY not configured in environment. Routing directly to Chirp 3 HD.`);
            }

            // --- FALLBACK TTS: Google Cloud Text-to-Speech (Chirp 3 HD -> Neural2 -> Standard) ---
            if (!audioBuffer) {
                console.log(`[TTS_FALLBACK] Falling back to Google Cloud Chirp 3 HD for post ${postId}...`);

                const { GoogleAuth } = require('google-auth-library');
                const ttsAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
                const authClient = await ttsAuth.getClient();
                const accessToken = (await authClient.getAccessToken()).token;

                // 3. SANITIZE: Escape XML special characters properly
                let xmlText = baseText.replace(/&/g, '&amp;')
                                      .replace(/</g, '&lt;')
                                      .replace(/>/g, '&gt;')
                                      .replace(/"/g, '&quot;')
                                      .replace(/'/g, '&apos;');

                // 4. INJECT SSML: Clean markup for Studio (Chirp) voices
                let processedText = xmlText;
                processedText = processedText.replace(/,\s*,+/g, ',');
                processedText = processedText.replace(/,\s*\./g, '.');
                processedText = processedText.replace(/,\s*/g, ', ');
                processedText = processedText.replace(/\.\s*/g, '. ');
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

                audioBuffer = Buffer.from(ttsData.audioContent, 'base64');
            }

            fs.writeFileSync(audioPath, audioBuffer);

            const logoPath = path.join(process.cwd(), 'assets', 'logo.png');
            const hasLogo = fs.existsSync(logoPath);

            const renderVideoWithFFmpeg = async () => {
                const runPass = (isSimpleFallback: boolean) => new Promise((resolve, reject) => {
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

                    let cmd = ffmpeg(videoPath).input(audioPath);

                    if (isSimpleFallback) {
                        console.log(`[VIDEO_PROC_FALLBACK] Executing resilient simple muxing for ${postId}...`);
                        if (hasLogo) {
                            cmd.input(logoPath);
                            const simpleFilter: any[] = [
                                { filter: 'scale', options: `${logoWidth}:-2`, inputs: '2:v', outputs: 'logo' },
                                { filter: 'overlay', options: 'W-w-25:25', inputs: ['0:v', 'logo'], outputs: 'vf' }
                            ];
                            cmd.complexFilter(simpleFilter)
                                .outputOptions(['-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-map', '[vf]', '-map', '1:a:0', '-ar', '44100', '-ac', '2', '-shortest'])
                                .save(outputPath)
                                .on('end', () => resolve(true))
                                .on('error', (err: any) => reject(err));
                        } else {
                            cmd.outputOptions(['-c:v', 'copy', '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0', '-shortest'])
                                .save(outputPath)
                                .on('end', () => resolve(true))
                                .on('error', (err: any) => reject(err));
                        }
                        return;
                    }

                    const isVertical = videoHeight > videoWidth;
                    const introFileName = isVertical ? 'YouTube_intro_BBC_style_9_16.mp4' : 'YouTube_channel_intro_16_9.mp4';
                    const outroFileName = isVertical ? 'alfanews_outro_like_share_9_16.mp4' : 'alfanews_outro_like_share_16_9.mp4';

                    const introPath = path.join(process.cwd(), 'assets', introFileName);
                    const outroPath = path.join(process.cwd(), 'assets', outroFileName);
                    const hasIntro = fs.existsSync(introPath);
                    const hasOutro = fs.existsSync(outroPath);

                    console.log(`[VIDEO_PROC] Res: ${videoWidth}x${videoHeight}, Vertical: ${isVertical}, HasIntro: ${hasIntro}, HasOutro: ${hasOutro}`);

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

                try {
                    await runPass(false);
                } catch (complexErr: any) {
                    console.warn(`[FFMPEG_WARN] Complex filtergraph failed for ${postId} (${complexErr.message}). Retrying with resilient simple muxing.`);
                    if (fs.existsSync(outputPath)) {
                        try { fs.unlinkSync(outputPath); } catch (e) {}
                    }
                    await runPass(true);
                }
            };

            await renderVideoWithFFmpeg();

            const ytSettings = await db.collection('settings').doc('youtube').get();
            const refreshToken = ytSettings.exists ? ytSettings.data()?.refreshToken : process.env.YOUTUBE_REFRESH_TOKEN;
            if (!refreshToken) throw new Error("YouTube Refresh Token missing");

            const { google } = require('googleapis');
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
            const currentVideoRetries = (latestData?.videoRetryCount || 0) + 1;
            const canRetry = currentVideoRetries < 2;

            console.error(`[VIDEO_ERR] ${postId}: ${err.message}. Video retry attempt: ${currentVideoRetries}/2.`);
            
            // Clean up raw storage file on permanent failure to prevent storage accumulation
            if (!canRetry && videoUrl && videoUrl.includes('firebasestorage.googleapis.com')) {
                try {
                    const decodedUrl = decodeURIComponent(videoUrl);
                    const pathParts = decodedUrl.split('/o/');
                    if (pathParts.length >= 2) {
                        const rawStoragePath = pathParts[1].split('?')[0];
                        await admin.storage().bucket().file(rawStoragePath).delete();
                    }
                } catch (delErr: any) {}
            }

            await db.collection('news').doc(postId).update({
                status: canRetry ? "PENDING_YOUTUBE_RETRY" : "FAILED_YOUTUBE_UPLOAD",
                approved: false,
                videoProcessed: false,
                videoRetryCount: currentVideoRetries,
                processingError: err.message,
                failedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            if (!canRetry && originalReporterId) {
                await notifyReporter(
                    originalReporterId,
                    postId,
                    data.headline?.telugu || "వీడియో వార్త",
                    'INTERNAL_ERROR',
                    "",
                    `వీడియో అప్‌లోడ్ సాంకేతిక లోపం: ${err.message}`
                );
            }
        } finally {
            [videoPath, audioPath, outputPath].forEach(p => { 
                if (p && fs.existsSync(p)) {
                    try { fs.unlinkSync(p); } catch (e) {}
                } 
            });
        }
    }
});

/**
 * 6.3 Scheduled Auto-Retry for Failed Reporter News (Runs every 30 minutes)
 * Scans for reporter submissions from the last 4 hours that failed, remained pending, or were falsely rejected
 * and triggers automated reprocessing.
 */
export const scheduleReprocessFailedReporterNews = onSchedule({
    schedule: "*/30 * * * *",
    timeZone: "Asia/Kolkata",
    memory: "1GiB",
    timeoutSeconds: 540,
    region: REGION,
    secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"]
}, async (event) => {
    console.log("[AUTO_RETRY_SCHEDULE] Starting 30-min scan for failed/pending reporter news...");
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

    try {
        const snapshot = await db.collection('news')
            .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(fourHoursAgo))
            .get();

        const retryCandidates = snapshot.docs.filter(doc => {
            const d = doc.data();
            const status = (d.status || "").toUpperCase();
            const isReporter = d.isReporter === true || (d.reporter?.id && !d.isCitizen && d.reporter?.name !== "సిటిజెన్ పోస్ట్");
            if (!isReporter || d.approved === true) return false;

            // 1. Loop prevention: Never retry if reprocessCount >= 3
            if ((d.reprocessCount || 0) >= 3) return false;

            // 2. Filter real policy rejections and verified duplicates
            const isRealPolicyRejection = status === "REJECTED" && !d.isDuplicate;
            const isRealDuplicate = d.isDuplicate === true && !!d.duplicateOfPostId;
            if (isRealPolicyRejection || isRealDuplicate) return false;

            // 3. Check for AI failure, stuck pending, or false duplicate
            const isFalseDuplicate = (status === "REJECTED" || d.isDuplicate === true) && !d.duplicateOfPostId;
            const isFailedOrPendingAI = (status === "FAILED" || (status === "PENDING" && d.aiProcessed !== true) || status === "REVIEWING_CONTENT" || isFalseDuplicate);

            // 4. Check for stuck video posts (PENDING_YOUTUBE_RETRY or interrupted video processing)
            const mTypes = (d.mediaTypes || []).map((t: string) => t.toUpperCase());
            const hasVideo = mTypes.includes('VIDEO') || d.mediaType?.toUpperCase() === 'VIDEO';
            const isStuckVideo = hasVideo && (status === "PENDING_YOUTUBE_RETRY" || status === "PROCESSING_VIDEO" || status === "PROCESSING_VIDEO_START") && d.videoProcessed !== true;

            return isFailedOrPendingAI || isStuckVideo;
        });

        console.log(`[AUTO_RETRY_SCHEDULE] Found ${retryCandidates.length} failed/pending reporter posts from the last 2 hours to retry.`);

        for (const doc of retryCandidates) {
            const postId = doc.id;
            const data = doc.data();
            const mTypes = (data.mediaTypes || []).map((t: string) => t.toUpperCase());
            const hasVideo = mTypes.includes('VIDEO') || data.mediaType?.toUpperCase() === 'VIDEO';
            const targetStatus = (data.aiProcessed && hasVideo) ? "PROCESSING_VIDEO" : "PENDING";

            console.log(`[AUTO_RETRY_SCHEDULE] Retrying post: ${postId} (${data.headline?.telugu || 'Untitled'}) -> Target: ${targetStatus}, Attempts: ${(data.reprocessCount || 0) + 1}/2`);
            
            await db.collection('news').doc(postId).update({
                status: targetStatus,
                forceReprocess: true,
                reprocessCount: admin.firestore.FieldValue.increment(1),
                lastReprocessAttempt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (err: any) {
        console.error("[AUTO_RETRY_SCHEDULE_ERR] Error during 2-hour auto-retry schedule:", err.message);
    }
});

