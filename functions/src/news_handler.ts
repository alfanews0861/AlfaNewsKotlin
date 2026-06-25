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
import { notifyReporter } from "./reporter_handler";

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

    console.log(`[AI_START] Processing: ${headline.substring(0, 30)}...`);

    return await runWithAIFallback(async (ai, modelName) => {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `INPUT DATA:
Headline: ${headline}
Content: ${content}

COMMAND:
1. Apply Senior Editor instructions.
2. IMPORTANT: Generate output in BOTH Telugu AND English.
3. Return results in the specified JSON schema.
4. STRICTLY JSON ONLY.` }] }],
            systemInstruction: { role: "system", parts: [{ text: getCategorySystemInstruction() }] },
            generationConfig: {
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        } as any);

        const aiRes = parseAIJson(result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || "{}");

        // ROBUST FIELD EXTRACTION: Handle Flat AND Nested JSON (including 'summary' inside 'telugu')
        const finalContent = aiRes.content || aiRes.contentTe || aiRes.telugu?.content || aiRes.telugu?.contentTe || aiRes.telugu?.summary || aiRes.summaryTe || aiRes.summary || aiRes.description || aiRes.summarizedTeluguContent;
        const finalHeadline = aiRes.headline || aiRes.headlineTe || aiRes.telugu?.headline || aiRes.telugu?.headlineTe || aiRes.title || aiRes.generatedTeluguHeadline;
        const finalContentEn = aiRes.contentEn || aiRes.content_en || aiRes.english?.content || aiRes.english?.contentEn || aiRes.english?.summary || aiRes.summaryEn || aiRes.englishContent;
        const finalHeadlineEn = aiRes.headlineEn || aiRes.headline_en || aiRes.english?.headline || aiRes.english?.headlineEn || aiRes.titleEn || aiRes.englishHeadline;

        if (!finalContent || !finalHeadline) {
             console.error("[AI_SCHEMA_MISMATCH] AI response missing Telugu fields:", JSON.stringify(aiRes).substring(0, 300));
             // Fallback for urgent display if we have AT LEAST some data
             if (!finalContent && !finalHeadline) throw new Error("AI response missing mandatory Telugu fields.");
        }

        // Validate character count (Telugu)
        if (finalContent.length < 400) {
             console.warn(`[AI_LENGTH_WARNING] Content too short: ${finalContent.length} chars. Proceeding but logging.`);
        }

        const normalizedEntities = {
            people: Array.isArray(aiRes.entities?.people) ? aiRes.entities.people : [],
            organizations: Array.isArray(aiRes.entities?.organizations) ? aiRes.entities.organizations : [],
            locations: Array.isArray(aiRes.entities?.locations) ? aiRes.entities.locations : []
        };

        const aiCategoryDetected = aiRes.refinedCategory || actualPostData?.category || "OTHER";
        const canonicalCategory = normalizeCategory(aiCategoryDetected);
        const isReporterPost = actualPostData?.isReporter === true || actualPostData?.processingType === "REPORTER_SUBMISSION";

        let primaryCategory: string;
        let finalCategories: string[];

        if (isReporterPost) {
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
            headline: { telugu: finalHeadline, english: finalHeadlineEn },
            content: { telugu: finalContent, english: finalContentEn },
            location: aiRes.location || actualPostData?.location || "",
            category: primaryCategory,
            categories: finalCategories,
            tags: aiRes.tags || [],
            entities: normalizedEntities,
            isSafeForYouTube: aiRes.isSafeForYouTube ?? true,
            rejectionReason: aiRes.rejectionReason || "",
            tone: aiRes.tone || "NORMAL",
            vocalContent: aiRes.vocalContent || finalContent,
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

    const currentStatus = (data.status || "").toUpperCase();
    const isReporter = data.isReporter === true || data.processingType === "REPORTER_SUBMISSION";

    // 1. Guard against infinite loops or redundant processing
    const LOCKED_STATUSES = ["REVIEWING_CONTENT", "PROCESSING_VIDEO_START", "FAILED", "REJECTED"];
    if (LOCKED_STATUSES.includes(currentStatus) && !data.forceReprocess) {
        return;
    }

    // 2. AI PROCESSING PHASE
    // Trigger if not processed and status is PENDING or missing
    if (!data.aiProcessed && (currentStatus === "PENDING" || currentStatus === "" || data.forceReprocess)) {
        // Double check against DB to avoid race conditions
        const latestDoc = await db.collection('news').doc(postId).get();
        const latestData = latestDoc.data();
        if (!latestData) return;

        const latestStatus = (latestData.status || "").toUpperCase();
        if (latestData.aiProcessed || latestStatus === "REVIEWING_CONTENT" || (LOCKED_STATUSES.includes(latestStatus) && !data.forceReprocess)) {
            console.log(`[AI_SKIPPED] ${postId} already processing, done, or failed.`);
            return;
        }

        console.log(`[ON_WRITE_PROCEED] AI Start: ${postId}`);

        // LOCK immediately to prevent other instances
        await db.collection('news').doc(postId).update({ status: "REVIEWING_CONTENT" });

        try {
            const headline = data.headline?.telugu || "";
            const content = data.content?.telugu || "";

            if (!headline || !content) {
                 await db.collection('news').doc(postId).update({ status: "FAILED", error: "Missing headline or content" });
                 return;
            }

            const aiProcessedData = await performAIProcessing(headline, content, data);
            const isRejected = !isReporter && aiProcessedData.rejectionReason && aiProcessedData.rejectionReason.length > 0;

            const mTypes = (data.mediaTypes || []).map((t: string) => t.toUpperCase());
            const hasVideo = mTypes.includes('VIDEO') || data.mediaType?.toUpperCase() === 'VIDEO';

            const updatePayload = {
                ...aiProcessedData,
                status: isRejected ? "REJECTED" : (hasVideo ? "PROCESSING_VIDEO" : "published"),
                approved: isReporter ? (hasVideo ? false : true) : (!isRejected && !hasVideo)
            };

            console.log(`[AI_DONE] ${postId}. Status: ${updatePayload.status}, Approved: ${updatePayload.approved}`);
            await db.collection('news').doc(postId).update(updatePayload);
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
            let processedText = teluguVocal.replace(/\s+/g, ' ').trim();
            processedText = processedText.replace(/[<>&'"]/g, '');
            processedText = processedText.replace(/\[\[STRESS\]\](.*?)\[\[\/STRESS\]\]/g, '<prosody volume="+2.5dB" rate="92%">$1</prosody>');
            processedText = processedText.replace(/(\d+)/g, '<say-as interpret-as="cardinal">$1</say-as>');
            processedText = processedText.replace(/అంటే\.\.\./g, 'అంటే... <break time="250ms"/>');
            processedText = processedText.replace(/ఆ\.\.\./g, 'ఆ... <break time="200ms"/>');
            processedText = processedText.replace(/\.\.\./g, '... <break time="500ms"/>');
            processedText = processedText.replace(/,/g, ', <break time="150ms"/>');
            processedText = processedText.replace(/\./g, '. <break time="350ms"/>');
            processedText = processedText.replace(/!/g, '! <break time="250ms"/>');
            processedText = processedText.replace(/\?/g, '? <break time="250ms"/>');

            const selectedVoice = 'te-IN-Chirp3-HD-Kore';
            const speed = 1.20;

            const ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                body: JSON.stringify({
                    input: { ssml: `<speak>${processedText.substring(0, 1500)}</speak>` },
                    voice: { languageCode: 'te-IN', name: selectedVoice },
                    audioConfig: { audioEncoding: 'MP3', speakingRate: speed }
                })
            });

            const ttsData: any = await ttsRes.json();
            if (!ttsData.audioContent) throw new Error(`TTS failed: ${ttsData.error?.message || 'No audio'}`);

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

                filters.push(`[0:a]volume='if(lt(t,${ttsDuration}),0.01,1)':eval=frame,volume=3.5[ducked]`);
                filters.push("[1:a]volume=3.5,highpass=f=200[a1_mix]");
                filters.push("[ducked][a1_mix]amix=inputs=2:duration=longest:normalize=0[outa]");

                cmd.complexFilter(filters.join(';'))
                    .outputOptions(['-c:v', 'libx264', '-preset', 'ultrafast', '-map', '[vf]', '-map', '[outa]'])
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

            // CLEANUP: Delete original video file to save storage costs
            if (videoUrl) {
                await deleteOriginalFile(videoUrl);
            }

            if (isReporter && data.reporter?.id) await notifyReporter(data.reporter.id, postId, data.headline?.telugu || "", 'SUCCESS');

            [videoPath, audioPath, outputPath].forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
        } catch (err: any) {
            console.error(`[VIDEO_ERR] ${postId}:`, err.message);
            await db.collection('news').doc(postId).update({ status: "FAILED", error: err.message });
        }
    }
});
