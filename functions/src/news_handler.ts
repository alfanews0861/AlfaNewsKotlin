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
    getAIInstance,
    parseAIJson,
    FLASH_MODEL,
    REGION
} from "./utils";
import { normalizeCategory, normalizeCategories, getCategorySystemInstruction } from './categories';
import { notifyReporter } from "./reporter_handler";

const db = admin.firestore();

/**
 * Helper: Perform AI enhancement on news content
 */
async function performAIProcessing(headline: string, content: string, actualPostData: any): Promise<any> {
    const ai = getAIInstance();
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
        required: ["headline", "content", "headlineEn", "contentEn", "location", "storyFingerprint", "refinedCategory", "isSafeForYouTube", "rejectionReason", "tags", "entities"]
    };

    console.log(`[AI_START] Processing: ${headline.substring(0, 30)}...`);

    try {
        const result = await ai.models.generateContent({
            model: FLASH_MODEL,
            contents: [{ role: "user", parts: [{ text: `Headline: ${headline}\nContent: ${content}` }] }],
            config: {
                systemInstruction: getCategorySystemInstruction(),
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        } as any);

        const aiRes = parseAIJson(result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || "{}");

        const finalContent = aiRes.content || aiRes.contentTe || content;
        const finalHeadline = aiRes.headline || aiRes.headlineTe || headline;
        const finalHeadlineEn = aiRes.headlineEn || aiRes.headline_en || headline;
        const finalContentEn = aiRes.contentEn || aiRes.content_en || content;

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
            storyFingerprint: aiRes.storyFingerprint || `gen_${Date.now()}`,
            aiProcessed: true,
            aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };
    } catch (e: any) {
        console.error(`[AI_ERROR]`, e.message);
        throw e;
    }
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
    memory: "4GiB",
    timeoutSeconds: 540
}, async (event) => {
    const snapshot = event.data?.after;
    if (!snapshot || !snapshot.exists) return;
    const postId = event.params.postId;
    let data: any = snapshot.data();

    // Case-insensitive status check
    const currentStatus = (data.status || "").toUpperCase();
    console.log(`[ON_WRITE] Post: ${postId}, Status: ${data.status}, AI Processed: ${data.aiProcessed}`);

    // Trigger processing if status is PENDING
    if (currentStatus !== "PENDING") {
        console.log(`[ON_WRITE_SKIP] skipping ${postId}: status not PENDING`);
        return;
    }

    console.log(`[ON_WRITE_PROCEED] Force processing: ${postId}`);

    try {
        const isReporter = data.isReporter === true || data.processingType === "REPORTER_SUBMISSION";
        await db.collection('news').doc(postId).update({ status: "REVIEWING_CONTENT" });

        const headline = data.headline?.telugu || "";
        const content = data.content?.telugu || "";

        if (headline && content && !data.aiProcessed) {
            const aiProcessedData = await performAIProcessing(headline, content, data);
            const isRejected = !isReporter && aiProcessedData.rejectionReason && aiProcessedData.rejectionReason.length > 0;

            const mTypes = (data.mediaTypes || []).map((t: string) => t.toUpperCase());
            const videoIndex = mTypes.indexOf('VIDEO') !== -1 ? mTypes.indexOf('VIDEO') : (data.mediaType?.toUpperCase() === 'VIDEO' ? 0 : -1);
            const videoUrlForCheck = (videoIndex !== -1 && data.mediaUrls && data.mediaUrls[videoIndex]) || (videoIndex === 0 ? data.mediaUrl : null);
            const hasVideo = !!videoUrlForCheck;

            const updatePayload = {
                ...aiProcessedData,
                status: isRejected ? "REJECTED" : (hasVideo ? "PROCESSING_VIDEO" : "published"),
                approved: isReporter ? (hasVideo ? false : true) : (!isRejected && !hasVideo)
            };

            console.log(`[AI_DONE] ${postId}. Final Status: ${updatePayload.status}`);
            await db.collection('news').doc(postId).update(updatePayload);

            if (isRejected) {
                if (data.reporter?.id) await notifyReporter(data.reporter.id, postId, headline, 'POLICY_VIOLATION', data.mediaUrl || "");
                return;
            }
            data = { ...data, ...aiProcessedData, status: updatePayload.status, approved: updatePayload.approved };
        }

        // Video processing
        const mTypesFinal = (data.mediaTypes || []).map((t: string) => t.toUpperCase());
        const videoIndexFinal = mTypesFinal.indexOf('VIDEO') !== -1 ? mTypesFinal.indexOf('VIDEO') : (data.mediaType?.toUpperCase() === 'VIDEO' ? 0 : -1);
        const videoUrl = (videoIndexFinal !== -1 && data.mediaUrls && data.mediaUrls[videoIndexFinal]) || (videoIndexFinal === 0 ? data.mediaUrl : null);

        if (videoIndexFinal !== -1 && !data.youtubeUrl && videoUrl) {
            console.log(`[VIDEO_START] ${postId}. URL: ${videoUrl.substring(0, 50)}...`);
            await db.collection('news').doc(postId).update({ status: "PROCESSING_VIDEO" });

            const teluguNews = data.content?.telugu || data.headline?.telugu || "";
            const reporterName = data.reporter?.name || "";

            let description = reporterName ? `రిపోర్టర్: ${reporterName}\n\n` : "";
            description += `${teluguNews}\n\n`;
            description += `మరిన్ని తాజా వార్తల కోసం ఆల్ఫా న్యూస్ అప్ ని ఇప్పుడే డౌన్లోడ్ చేసుకోండి\n`;
            description += `https://play.google.com/store/apps/details?id=com.alfanews.telugu\n\n`;

            const tempDir = os.tmpdir();
            const videoPath = path.join(tempDir, `input_${postId}.mp4`);
            const audioPath = path.join(tempDir, `audio_${postId}.mp3`);
            const outputPath = path.join(tempDir, `output_${postId}.mp4`);

            try {
                const videoRes = await fetch(videoUrl);
                fs.writeFileSync(videoPath, Buffer.from(await videoRes.arrayBuffer()));

                const ttsAuth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
                const authClient = await ttsAuth.getClient();
                const accessToken = (await authClient.getAccessToken()).token;

                const ssml = `<speak><prosody rate="1.30" pitch="-2st" volume="loud">${teluguNews.replace(/[<>&'"]/g, '').substring(0, 4900)}</prosody></speak>`;
                const ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                    body: JSON.stringify({
                        input: { ssml },
                        voice: { languageCode: 'te-IN', name: 'te-IN-Chirp3-HD-Achernar' },
                        audioConfig: { audioEncoding: 'MP3' }
                    })
                });

                const ttsData: any = await ttsRes.json();
                if (ttsData.audioContent) {
                    fs.writeFileSync(audioPath, Buffer.from(ttsData.audioContent, 'base64'));

                    const logoPath = path.join(process.cwd(), 'assets', 'logo.png');
                    const hasLogo = fs.existsSync(logoPath);

                    console.log(`[VIDEO_FFMPEG] Starting merge for ${postId}. Logo: ${hasLogo} at ${logoPath}`);

                    await new Promise((resolve, reject) => {
                        try {
                            let cmd = ffmpeg(videoPath).input(audioPath);
                            if (hasLogo) cmd.input(logoPath);

                            const filters = [];
                            let vMap = '[0:v]';
                            if (hasLogo) {
                                filters.push('[2:v]scale=90:-1[l];[0:v][l]overlay=W-w-25:25[vl]');
                                vMap = '[vl]';
                            }
                            filters.push(`${vMap}format=yuv420p[vf]`);
                            filters.push('[1:a]volume=3.5[outa]');

                            cmd.complexFilter(filters)
                               .outputOptions(['-map', '[vf]', '-map', '[outa]', '-shortest'])
                               .save(outputPath)
                               .on('start', (commandLine: string) => console.log(`[FFMPEG_CMD] ${commandLine}`))
                               .on('end', resolve)
                               .on('error', (err: any) => {
                                   console.error(`[FFMPEG_ERR] ${err.message}`);
                                   reject(err);
                               });
                        } catch (ffmpegSetupErr: any) {
                            console.error(`[FFMPEG_SETUP_ERR] ${ffmpegSetupErr.message}`);
                            reject(ffmpegSetupErr);
                        }
                    });

                    const ytSettings = await db.collection('settings').doc('youtube').get();
                    const refreshToken = ytSettings.exists ? ytSettings.data()?.refreshToken : process.env.YOUTUBE_REFRESH_TOKEN;

                    if (!refreshToken) {
                        throw new Error("YouTube Refresh Token not found in Firestore or Environment Secrets.");
                    }

                    const ytAuth = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET);
                    ytAuth.setCredentials({ refresh_token: refreshToken });
                    const youtube = google.youtube({ version: 'v3', auth: ytAuth });
                    const ytRes = await youtube.videos.insert({
                        part: ['snippet', 'status'],
                        requestBody: { snippet: { title: (data.headline?.telugu || "Alfa News").substring(0, 100), description, categoryId: '25' }, status: { privacyStatus: 'public' } },
                        media: { body: fs.createReadStream(outputPath) },
                    });

                    await db.collection('news').doc(postId).update({ youtubeUrl: `https://www.youtube.com/watch?v=${ytRes.data.id}`, videoProcessed: true, status: "published", approved: true });
                    if (data.isReporter && data.reporter?.id) await notifyReporter(data.reporter.id, postId, data.headline?.telugu || "", 'SUCCESS');
                } else {
                    console.error(`[TTS_ERR] synthesis failed for ${postId}:`, JSON.stringify(ttsData));
                    throw new Error(`TTS synthesis failed: ${ttsData.error?.message || 'Unknown error'}`);
                }
            } catch (videoErr: any) {
                console.error(`[VIDEO_ERR] ${postId}:`, videoErr.message);
                await db.collection('news').doc(postId).update({ status: "FAILED", error: videoErr.message });
            } finally {
                [videoPath, audioPath, outputPath].forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
            }
        }
    } catch (err: any) {
        console.error(`[PROCESS_ERR] ${postId}:`, err.message);
        await db.collection('news').doc(postId).update({ status: "FAILED", error: err.message });
    }
});
