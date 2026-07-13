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
    FLASH_MODEL,
    REGION
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
 * Helper: Perform AI enhancement on news content
 */
async function performAIProcessing(headline: string, content: string, actualPostData: any): Promise<any> {
    const schema = {
        type: Type.OBJECT,
        properties: {
            headline: { type: Type.STRING },
            content: { type: Type.STRING },
            headlineEn: { type: Type.STRING },
            contentEn: { type: Type.STRING },
            location: { type: Type.STRING },
            storyFingerprint: { type: Type.STRING },
            refinedCategory: { type: Type.STRING },
            isSafeForYouTube: { type: Type.BOOLEAN },
            rejectionReason: { type: Type.STRING },
            tone: { type: Type.STRING },
            vocalContent: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
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
        required: ["headline", "content", "headlineEn", "contentEn", "location", "storyFingerprint", "refinedCategory", "isSafeForYouTube", "rejectionReason", "tags", "entities", "tone", "vocalContent"]
    };

    console.log(`[AI_START] Processing: ${headline.substring(0, 30)}... (Type: ${actualPostData?.isReporter ? 'Reporter' : 'Citizen'})`);

    const metadataPrompt = `
SUBMISSION METADATA:
- type: ${actualPostData?.isReporter ? 'REPORTER_SUBMISSION' : 'CITIZEN_SUBMISSION'}
- isReporter: ${actualPostData?.isReporter === true}
- isCitizen: ${actualPostData?.isCitizen === true}
- district: ${actualPostData?.district || 'Unknown'}
- location: ${actualPostData?.location || 'Unknown'}
`;

    return await runWithAIFallback(async (ai, modelName) => {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `${metadataPrompt}\n\nHeadline: ${headline}\nContent: ${content}` }] }],
            config: {
                systemInstruction: getCategorySystemInstruction(),
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
                // Full compatibility aliases
                system_instruction: getCategorySystemInstruction(),
                response_mime_type: "application/json",
                response_schema: schema
            }
        } as any);

        const rawText = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        console.log(`[AI_RES] ${actualPostData.id || 'new'}:`, rawText.substring(0, 500));
        const aiRes = parseAIJson(rawText);

        // ROBUST FIELD EXTRACTION: Handle Flat AND Nested JSON
        const finalContent = aiRes.content || aiRes.contentTe || aiRes.content_te ||
            aiRes.telugu?.content || aiRes.telugu?.contentTe || aiRes.telugu?.summary ||
            aiRes.telugu_version?.content || aiRes.telugu_version?.summary ||
            aiRes.summaryTe || aiRes.summarized_telugu_content || aiRes.summary ||
            aiRes.description || aiRes.summarizedTeluguContent;

        const finalHeadline = aiRes.headline || aiRes.headlineTe || aiRes.headline_te ||
            aiRes.telugu?.headline || aiRes.telugu?.headlineTe ||
            aiRes.telugu_version?.headline || aiRes.telugu_version?.title ||
            aiRes.title || aiRes.generated_telugu_headline || aiRes.generatedTeluguHeadline;

        const finalHeadlineEn = aiRes.headlineEn || aiRes.headline_en ||
            aiRes.english?.headline || aiRes.english?.headlineEn ||
            aiRes.english_version?.headline || aiRes.english_version?.title ||
            aiRes.titleEn || aiRes.englishHeadline || "";

        const isRejected = aiRes.rejectionReason && aiRes.rejectionReason.length > 0;

        if (!isRejected && (!finalContent || !finalHeadline)) {
             console.error("[AI_SCHEMA_MISMATCH] AI response missing Telugu fields:", JSON.stringify(aiRes).substring(0, 500));
             throw new Error("AI response missing mandatory Telugu fields.");
        }

        const finalContentEn = aiRes.contentEn || aiRes.content_en ||
            aiRes.english?.content || aiRes.english?.contentEn || aiRes.english?.summary ||
            aiRes.english_version?.content || aiRes.english_version?.summary ||
            aiRes.summaryEn || aiRes.summarized_english_content || aiRes.englishContent || "";

        // Normalize rejection reason - ignore common placeholders
        let rejectionReason = aiRes.rejectionReason || "";
        if (rejectionReason.toLowerCase() === "null" ||
            rejectionReason.toLowerCase() === "none" ||
            rejectionReason.toLowerCase() === "n/a" ||
            rejectionReason.toLowerCase() === "false") {
            rejectionReason = "";
        }

        // Validate character count (Telugu)
        if (finalContent.length < 450) {
             console.warn(`[AI_LENGTH_WARNING] Content too short: ${finalContent.length} chars. Target is 450-600. Proceeding but logging.`);
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
            location: aiRes.location || actualPostData?.location || "",
            category: primaryCategory,
            categories: finalCategories,
            tags: aiRes.tags || [],
            entities: normalizedEntities,
            isSafeForYouTube: aiRes.isSafeForYouTube ?? true,
            rejectionReason: rejectionReason,
            tone: aiRes.tone || "NORMAL",
            vocalContent: aiRes.vocalContent || finalContent || "",
            qualitySignals: aiRes.qualitySignals || { biasScore: 0.5, publicInterestScore: 0.5, investigativeScore: 0, isPersonalPraise: false },
            storyFingerprint: aiRes.storyFingerprint || `gen_${Date.now()}`,
            aiProcessed: true,
            aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };
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

    // Capture the original submitter to ensure they get the points,
    // even if display reporter is reassigned.
    const originalReporterId = data.reporter?.id;

    const currentStatus = (data.status || "").toUpperCase();
    const isReporter = data.isReporter === true || data.processingType === "REPORTER_SUBMISSION";

    // 1. Guard against infinite loops or redundant processing
    // We MUST re-fetch the document to ensure we aren't racing with another trigger instance
    const latestDoc = await db.collection('news').doc(postId).get();
    const latestData = latestDoc.data();
    if (!latestData) return;

    const latestStatus = (latestData.status || "").toUpperCase();

    // Statuses that mean we've already started or finished processing
    const LOCKED_STATUSES = ["REVIEWING_CONTENT", "PROCESSING_VIDEO_START", "FAILED", "REJECTED", "PUBLISHED"];

    if (LOCKED_STATUSES.includes(latestStatus) && !data.forceReprocess) {
        console.log(`[TRIGGER_SKIPPED] ${postId} is already in state: ${latestStatus}`);
        return;
    }

    // 2. SURVEY BYPASS — skip Gemini AI for survey/poll/opinion posts
    if (latestData.type === "survey") {
        console.log(`[SURVEY_BYPASS] Auto-publishing survey post: ${postId}`);
        await db.collection('news').doc(postId).update({
            status: "PUBLISHED",
            approved: true,
            aiProcessed: true,
            publishedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
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

            const aiProcessedData = await performAIProcessing(headline, content, latestData);

            // --- MANDALAM REPORTER ASSIGNMENT LOGIC ---
            // If there's an assigned reporter for this mandalam, override the reporter field
            const mandalamDistrict = (aiProcessedData.categories && aiProcessedData.categories.find((c: string) => c.includes("జిల్లా"))) ? data.district : aiProcessedData.location;
            // Actually, we should use data.district or aiProcessedData.district if we added it.
            // Let's use the location (mandalam) and the district from data or categories.
            const targetDistrict = data.district || (aiProcessedData.categories && aiProcessedData.categories.find((c: string) => !c.includes("వార్త") && c !== aiProcessedData.category));
            const targetMandalam = aiProcessedData.location;

            if (targetDistrict && targetMandalam) {
                const assignedReporter = await getAssignedReporter(targetDistrict, targetMandalam);
                if (assignedReporter) {
                    console.log(`[REPORTER_ASSIGN] Reassigning ${postId} to ${assignedReporter.name} for mandalam ${targetMandalam}`);
                    aiProcessedData.reporter = assignedReporter;
                    aiProcessedData.isReporter = true;
                }
            }
            // ------------------------------------------

            const finalIsReporter = isReporter || aiProcessedData.isReporter;
            const isRejected = aiProcessedData.rejectionReason && aiProcessedData.rejectionReason.length > 0;

            const mTypes = (data.mediaTypes || []).map((t: string) => t.toUpperCase());
            const hasVideo = mTypes.includes('VIDEO') || data.mediaType?.toUpperCase() === 'VIDEO';

            const updatePayload = {
                ...aiProcessedData,
                status: isRejected ? "REJECTED" : (hasVideo ? "PROCESSING_VIDEO" : "published"),
                approved: isRejected ? false : (finalIsReporter ? (hasVideo ? false : true) : (!hasVideo))
            };

            console.log(`[AI_DONE] ${postId}. Type: ${finalIsReporter ? 'REPORTER' : 'CITIZEN'}, Status: ${updatePayload.status}, Approved: ${updatePayload.approved}`);
            if (isRejected) console.log(`[AI_REJECTED] ${postId} Reason: ${aiProcessedData.rejectionReason}`);

            await db.collection('news').doc(postId).update(updatePayload);

            // Award points to the ORIGINAL submitter if published
            if (updatePayload.status === "published" && finalIsReporter && originalReporterId) {
                const points = calculateIncentivePoints(false, updatePayload.qualitySignals);
                await awardPointsToReporter(originalReporterId, points);
            }
            return; // Exit and wait for the second trigger to handle video if needed
        } catch (err: any) {
            console.error(`[AI_ERR] ${postId}:`, err.message);
            await db.collection('news').doc(postId).update({ status: "FAILED", error: err.message });
            return;
        }
    }

    // 3. VIDEO PROCESSING PHASE
    // Trigger if AI is done, has video, but not yet processed by YouTube
    const mTypes = (data.mediaTypes || []).map((t: string) => t.toUpperCase());
    const videoIndex = mTypes.indexOf('VIDEO') !== -1 ? mTypes.indexOf('VIDEO') : (data.mediaType?.toUpperCase() === 'VIDEO' ? 0 : -1);
    const videoUrl = (videoIndex !== -1 && data.mediaUrls && data.mediaUrls[videoIndex]) || (videoIndex === 0 ? data.mediaUrl : null);

    if (data.aiProcessed && currentStatus === "PROCESSING_VIDEO" && !data.videoProcessed && videoUrl) {
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
            const videoPath = path.join(tempDir, `input_${postId}.mp4`);
            const audioPath = path.join(tempDir, `audio_${postId}.mp3`);
            const outputPath = path.join(tempDir, `output_${postId}.mp4`);

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

            // 4. INJECT SSML: Simplified tags for Studio (Chirp) voices
            // Use placeholders to avoid double-processing punctuation (like ... getting processed as 3 dots)
            let processedText = baseText;
            processedText = processedText.replace(/అంటే\.\.\./g, 'అంటే___ANTE___');
            processedText = processedText.replace(/ఆ\.\.\./g, 'ఆ___AA___');
            processedText = processedText.replace(/\.\.\./g, '___ELLIPSIS___');
            processedText = processedText.replace(/,/g, '___COMMA___');
            processedText = processedText.replace(/\./g, '___DOT___');
            processedText = processedText.replace(/!/g, '___EXCLAMATION___');
            processedText = processedText.replace(/\?/g, '___QUESTION___');

            // Now replace placeholders with actual SSML tags
            processedText = processedText.replace(/___ANTE___/g, '... <break time="150ms"/>');
            processedText = processedText.replace(/___AA___/g, '... <break time="120ms"/>');
            processedText = processedText.replace(/___ELLIPSIS___/g, '... <break time="200ms"/>');
            processedText = processedText.replace(/___COMMA___/g, ', <break time="30ms"/>');
            processedText = processedText.replace(/___DOT___/g, '. <break time="80ms"/>');
            processedText = processedText.replace(/___EXCLAMATION___/g, '! <break time="80ms"/>');
            processedText = processedText.replace(/___QUESTION___/g, '? <break time="80ms"/>');

            // NOW INJECT THE PROSODY TAG (STRESS)
            processedText = processedText.replace(/\[\[STRESS\]\](.*?)\[\[\/STRESS\]\]/g, '<prosody volume="+2.0dB">$1</prosody>');

            let selectedVoice = 'te-IN-Chirp3-HD-Kore';
            const ssml = `<speak><prosody rate="1.30" pitch="0st" volume="+10dB">${processedText}</prosody></speak>`;

            console.log(`[TTS_REQUEST] postId: ${postId}, voice: ${selectedVoice}, ssml: ${ssml.substring(0, 500)}`);

            let ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                body: JSON.stringify({
                    input: { ssml: ssml },
                    voice: { languageCode: 'te-IN', name: selectedVoice },
                    audioConfig: { audioEncoding: 'MP3' }
                })
            });

            let ttsData: any = await ttsRes.json();

            // FALLBACK LOGIC: If Chirp 3 HD fails, try Standard voice to ensure video is generated
            if (!ttsData.audioContent) {
                console.warn(`[TTS_WARNING] Chirp voice ${selectedVoice} failed. Falling back to Standard-A.`);
                selectedVoice = 'te-IN-Standard-A';
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
                try {
                    const { execSync } = require('child_process');
                    const ffprobeStatic = require('ffprobe-static');
                    const probeOutput = execSync(`"${ffprobeStatic.path}" -v error -select_streams v:0 -show_entries stream=width -of csv=s=x:p=0 "${videoPath}"`).toString().trim();
                    const videoWidth = parseInt(probeOutput) || 720;
                    if (videoWidth <= 450) logoWidth = 54;
                    else if (videoWidth <= 950) logoWidth = 99;
                    else logoWidth = 144;
                } catch (e) {}

                let cmd = ffmpeg(videoPath).input(audioPath);
                if (hasLogo) cmd.input(logoPath);

                const filters = [];
                let vMap = '[0:v]';
                if (hasLogo) {
                    filters.push(`[2:v]scale=${logoWidth}:-1[logo]`);
                    filters.push(`[0:v][logo]overlay=W-w-25:25[vlogo]`);
                    vMap = '[vlogo]';
                } else {
                    filters.push("[0:v]null[vlogo]");
                }
                filters.push(`[vlogo]format=yuv420p[vf]`);

                let ttsDuration = 0;
                try {
                    const { execSync } = require('child_process');
                    const ffprobeStatic = require('ffprobe-static');
                    const ttsProbe = execSync(`"${ffprobeStatic.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`).toString().trim();
                    ttsDuration = parseFloat(ttsProbe) || 0;
                } catch (e) {}

                filters.push(`[0:a]volume='if(lt(t,${ttsDuration}),0.15,1)':eval=frame,volume=1.2[ducked]`);
                // Enhance TTS: Pro Quality Stereo (Haas Effect) + Clarity EQ + Reverb
                // 1. Split mono to 2 channels
                // 2. Delay one side by 25ms to create space
                // 3. Apply subtle reverb for "Studio Room" feel
                filters.push("[1:a]volume=2.2,asplit[left][right];[right]adelay=25|25[delayed_right];[left][delayed_right]amerge=2,anequalizer=c0 f=3000 w=200 g=2|c1 f=3000 w=200 g=2,aecho=0.8:0.88:20:0.2[enhanced_tts]");
                filters.push("[ducked][enhanced_tts]amix=inputs=2:duration=longest:normalize=0[outa]");

                cmd.complexFilter(filters.join(';'))
                    .outputOptions(['-c:v', 'libx264', '-preset', 'ultrafast', '-map', '[vf]', '-map', '[outa]', '-ar', '44100', '-ac', '2'])
                    .save(outputPath)
                    .on('end', () => resolve(true))
                    .on('error', (err: any) => reject(err));
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

            await db.collection('news').doc(postId).update({
                youtubeUrl: `https://www.youtube.com/watch?v=${ytRes.data.id}`,
                videoProcessed: true,
                status: "published",
                approved: true
            });

            // Award points to ORIGINAL reporter for video publication
            if (isReporter && originalReporterId) {
                // Re-fetch to get latest quality signals from AI phase
                const freshDoc = await db.collection('news').doc(postId).get();
                const freshData = freshDoc.data();
                const points = calculateIncentivePoints(true, freshData?.qualitySignals);

                await awardPointsToReporter(originalReporterId, points);
                await notifyReporter(originalReporterId, postId, data.headline?.telugu || "", 'SUCCESS');
            }

            [videoPath, audioPath, outputPath].forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
        } catch (err: any) {
            console.error(`[VIDEO_ERR] ${postId}:`, err.message);
            await db.collection('news').doc(postId).update({ status: "FAILED", error: err.message });
        }
    }
});
