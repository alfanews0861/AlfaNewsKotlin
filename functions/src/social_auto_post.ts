import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./utils";
import { TELUGU_DISTRICT_ALIASES } from "./location_data";
import { DistrictSocialConfig, SocialAutoPostLog, SocialAutoPostSettings, UserRole } from "./types";

const db = admin.firestore();

// 33 Telangana Districts
export const ALL_TS_DISTRICTS = [
    'ఆదిలాబాద్', 'భద్రాద్రి కొత్తగూడెం', 'హన్మకొండ', 'హైదరాబాద్', 'జగిత్యాల', 'జనగాం', 'జయశంకర్ భూపాలపల్లి', 
    'జోగులాంబ గద్వాల', 'కామారెడ్డి', 'కరీంనగర్', 'ఖమ్మం', 'కుమ్రం భీమ్ ఆసిఫాబాద్', 'మహబూబాబాద్', 'మహబూబ్ నగర్', 
    'మంచిర్యాల', 'మెదక్', 'మేడ్చల్ మల్కాజిగిరి', 'ములుగు', 'నాగర్ కర్నూల్', 'నల్గొండ', 'నారాయణపేట', 'నిర్మల్', 
    'నిజామాబాద్', 'పెద్దపల్లి', 'రాజన్న సిరిసిల్ల', 'రంగారెడ్డి', 'సంగారెడ్డి', 'సిద్దిపేట', 'సూర్యాపేట', 
    'వికారాబాద్', 'వనపర్తి', 'వరంగల్', 'యాదాద్రి భువనగిరి'
];

// 26 Andhra Pradesh Districts
export const ALL_AP_DISTRICTS = [
    'అల్లూరి సీతారామరాజు', 'అనకాపల్లి', 'అనంతపురం', 'అన్నమయ్య', 'బాపట్ల', 'చిత్తూరు', 'కోనసీమ', 
    'తూర్పు గోదావరి', 'ఏలూరు', 'గుంటూరు', 'కాకినాడ', 'కృష్ణా', 'కర్నూలు', 'నందయాల', 'ఎన్టీఆర్', 
    'పల్నాడు', 'పార్వతీపురం మన్యం', 'ప్రకాశం', 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు', 'శ్రీ సత్యసాయి', 
    'శ్రీకాకుళం', 'తిరుపతి', 'విశాఖపట్నం', 'విజయనగరం', 'పశ్చిమ గోదావరి', 'వైఎస్ఆర్ కడప'
];

/**
 * Resolve canonical Telugu district name from news post
 */
export function resolveDistrictName(data: any): string | null {
    if (!data) return null;

    const rawDistrict = (data.district || "").trim();
    if (rawDistrict) {
        const canonical = TELUGU_DISTRICT_ALIASES[rawDistrict.toLowerCase()] || rawDistrict;
        if ([...ALL_TS_DISTRICTS, ...ALL_AP_DISTRICTS].includes(canonical)) {
            return canonical;
        }
    }

    const rawLocation = (data.location || "").trim();
    if (rawLocation) {
        const canonical = TELUGU_DISTRICT_ALIASES[rawLocation.toLowerCase()] || rawLocation;
        if ([...ALL_TS_DISTRICTS, ...ALL_AP_DISTRICTS].includes(canonical)) {
            return canonical;
        }
        for (const [alias, teluguDist] of Object.entries(TELUGU_DISTRICT_ALIASES)) {
            if (rawLocation.toLowerCase().includes(alias.toLowerCase())) {
                return teluguDist;
            }
        }
    }

    if (Array.isArray(data.categories)) {
        for (const cat of data.categories) {
            const trimmed = String(cat).trim();
            const canonical = TELUGU_DISTRICT_ALIASES[trimmed.toLowerCase()] || trimmed;
            if ([...ALL_TS_DISTRICTS, ...ALL_AP_DISTRICTS].includes(canonical)) {
                return canonical;
            }
        }
    }

    return null;
}

/**
 * Build caption text for Facebook & Instagram
 */
function buildPostCaption(
    headline: string, 
    content: string, 
    district: string, 
    customHashtags: string[] = [], 
    includeDownloadLink: boolean = true, 
    downloadLink: string = "https://play.google.com/store/apps/details?id=com.alfanews.telugu",
    youtubeUrl?: string
): string {
    const cleanHeadline = (headline || "").trim();
    let cleanContent = (content || "").trim();
    if (cleanContent.length > 600) {
        cleanContent = cleanContent.substring(0, 597) + "...";
    }

    let caption = `🔴 ${cleanHeadline}\n\n${cleanContent}`;

    if (youtubeUrl) {
        caption += `\n\n▶️ యూట్యూబ్ వీడియో చూడండి:\n👉 ${youtubeUrl}`;
    }

    if (includeDownloadLink && downloadLink) {
        caption += `\n\n📲 మరింత సమాచారం & తాజా వార్తల కోసం ఆల్ఫా న్యూస్ యాప్‌ని డౌన్‌లోడ్ చేసుకోండి:\n👉 ${downloadLink}`;
    }

    const defaultTags = ["#AlfaNews", "#AlfaNewsTelugu", `#${district.replace(/\s+/g, '')}`, "#TeluguNews", "#BreakingNews"];
    const allTags = Array.from(new Set([...customHashtags.filter(Boolean), ...defaultTags]));
    const tagString = allTags.join(" ");

    caption += `\n\n${tagString}`;
    return caption;
}

/**
 * Helper: Ensure image is public, valid, and downloadable by Meta (mirrors YouTube thumbnails to Firebase Storage)
 */
async function ensurePublicDownloadableImageUrl(rawUrl: string, postId: string): Promise<string> {
    if (!rawUrl) return "";
    
    // Check if it's a YouTube thumbnail (img.youtube.com / ytimg.com / youtube.com/vi/)
    if (rawUrl.includes('img.youtube.com') || rawUrl.includes('ytimg.com') || rawUrl.includes('youtube.com/vi/')) {
        try {
            const bucket = admin.storage().bucket();
            const fileName = `social_thumbnails/yt_${postId || Date.now()}_thumb.jpg`;
            const file = bucket.file(fileName);
            
            const [exists] = await file.exists();
            if (!exists) {
                const resp = await fetch(rawUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                
                if (resp.ok) {
                    const arrayBuffer = await resp.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    await file.save(buffer, {
                        metadata: {
                            contentType: 'image/jpeg',
                            cacheControl: 'public, max-age=31536000'
                        }
                    });
                    await file.makePublic().catch(() => {});
                    console.log(`[YT_THUMB_MIRRORED] Successfully mirrored YouTube thumbnail to Storage: ${fileName}`);
                }
            }
            
            return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        } catch (e: any) {
            console.warn(`[YT_THUMB_MIRROR_WARN] Failed to mirror YT thumb:`, e.message);
        }
    }
    
    return rawUrl;
}

/**
 * Helper: Resolve Page Access Token from User/System Token if needed
 */
async function resolvePageAccessToken(pageId: string, token: string): Promise<string> {
    try {
        const url = `https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${token}`;
        const res = await fetch(url);
        const data: any = await res.json();
        if (data && data.access_token) {
            console.log(`[FB_TOKEN_RESOLVED] Successfully resolved Page Access Token for page: ${pageId}`);
            return data.access_token;
        }
    } catch (e: any) {
        console.warn(`[FB_TOKEN_WARN] Could not fetch page token for ${pageId}:`, e.message);
    }
    return token;
}

/**
 * Helper: Post to Facebook Page via Graph API
 */
async function postToFacebookPage(
    pageId: string, 
    accessToken: string, 
    caption: string, 
    imageUrl?: string,
    youtubeUrl?: string,
    rawVideoUrl?: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
        const effectiveToken = await resolvePageAccessToken(pageId, accessToken);
        
        // 1. YouTube Video Embed (When news has a YouTube link, post as a native clickable feed link embed)
        if (youtubeUrl && (youtubeUrl.includes('youtube.com') || youtubeUrl.includes('youtu.be'))) {
            console.log(`[FB_YT_EMBED] Embedding YouTube video to ${pageId}: ${youtubeUrl}`);
            const params = new URLSearchParams();
            params.append('access_token', effectiveToken);
            params.append('message', caption);
            params.append('link', youtubeUrl.trim());

            const feedRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
                method: 'POST',
                body: params
            });
            const feedResult: any = await feedRes.json();
            if (feedRes.ok && !feedResult.error) {
                const fbPostId = feedResult.post_id || feedResult.id;
                console.log(`[FB_YT_EMBED_SUCCESS] YouTube embed created on Facebook: ${fbPostId}`);
                return { success: true, postId: fbPostId };
            }
            console.warn(`[FB_YT_EMBED_WARN] Feed embed failed, trying fallbacks:`, feedResult.error || feedResult);
        }

        // 2. Direct Video Upload (When news has an actual .mp4 video file)
        if (rawVideoUrl && (rawVideoUrl.startsWith('http://') || rawVideoUrl.startsWith('https://')) && (rawVideoUrl.includes('.mp4') || rawVideoUrl.includes('video'))) {
            try {
                console.log(`[FB_VIDEO_UPLOAD] Uploading raw video to Facebook ${pageId}: ${rawVideoUrl}`);
                const videoParams = new URLSearchParams();
                videoParams.append('access_token', effectiveToken);
                videoParams.append('description', caption);
                videoParams.append('file_url', rawVideoUrl);

                const videoRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos`, {
                    method: 'POST',
                    body: videoParams
                });
                const videoResult: any = await videoRes.json();
                if (videoRes.ok && !videoResult.error && videoResult.id) {
                    console.log(`[FB_VIDEO_SUCCESS] Native video post created: ${videoResult.id}`);
                    return { success: true, postId: videoResult.id };
                }
            } catch (vErr: any) {
                console.warn(`[FB_VIDEO_WARN] Video upload error:`, vErr.message);
            }
        }

        // 3. Photo Post (For standard photo/article news)
        let hasImage = Boolean(imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) && !imageUrl.includes('youtube.com/watch') && !imageUrl.includes('youtu.be/'));
        if (hasImage) {
            try {
                const imgRes = await fetch(imageUrl!, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });

                if (imgRes.ok) {
                    const arrayBuffer = await imgRes.arrayBuffer();
                    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
                    const blob = new Blob([arrayBuffer], { type: contentType });
                    
                    const formData = new FormData();
                    formData.append('access_token', effectiveToken);
                    formData.append('caption', caption);
                    formData.append('source', blob, 'post_image.jpg');

                    const response = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
                        method: 'POST',
                        body: formData
                    });

                    const result: any = await response.json();
                    if (response.ok && !result.error) {
                        const fbPostId = result.post_id || result.id;
                        return { success: true, postId: fbPostId };
                    }
                }
            } catch (bufErr: any) {
                console.warn(`[FB_PHOTO_BUFFER_WARN] Buffer photo upload failed:`, bufErr.message);
            }

            // Fallback photo URL
            const photoUrlPayload = {
                access_token: effectiveToken,
                url: imageUrl,
                caption: caption
            };
            const photoRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(photoUrlPayload)
            });
            const photoResult: any = await photoRes.json();
            if (photoRes.ok && !photoResult.error) {
                const fbPostId = photoResult.post_id || photoResult.id;
                return { success: true, postId: fbPostId };
            }
        }

        // 4. Fallback text feed message post
        const feedParams = new URLSearchParams();
        feedParams.append('access_token', effectiveToken);
        feedParams.append('message', caption);
        if (youtubeUrl) {
            feedParams.append('link', youtubeUrl);
        }

        const feedRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
            method: 'POST',
            body: feedParams
        });
        const feedResult: any = await feedRes.json();
        if (feedRes.ok && !feedResult.error) {
            const fbPostId = feedResult.post_id || feedResult.id;
            return { success: true, postId: fbPostId };
        }

        const errorMsg = feedResult.error?.message || `Facebook API Error (HTTP ${feedRes.status})`;
        console.error(`[FB_POST_ERR] Page: ${pageId}, Error:`, feedResult.error || feedResult);
        return { success: false, error: errorMsg };
    } catch (e: any) {
        console.error(`[FB_POST_EXCEPTION] Page: ${pageId}, Error:`, e.message);
        return { success: false, error: e.message };
    }
}






/**
 * Helper: Post to Instagram Business Account via Graph API
 */
async function postToInstagramAccount(
    igUserId: string, 
    accessToken: string, 
    caption: string, 
    imageUrl: string
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
    try {
        if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
            return { success: false, error: "Instagram requires a public image URL." };
        }

        // Step 1: Create Container
        const containerEndpoint = `https://graph.facebook.com/v19.0/${igUserId}/media`;
        const containerRes = await fetch(containerEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_url: imageUrl,
                caption: caption,
                access_token: accessToken
            })
        });

        const containerData: any = await containerRes.json();
        if (!containerRes.ok || containerData.error || !containerData.id) {
            const errorMsg = containerData.error?.message || `Instagram Container Error (HTTP ${containerRes.status})`;
            console.error(`[IG_CONTAINER_ERR] IG User: ${igUserId}, Error:`, containerData.error || containerData);
            return { success: false, error: errorMsg };
        }

        const creationId = containerData.id;

        // Step 2: Wait briefly (2 seconds) for media processing
        await new Promise(res => setTimeout(res, 2000));

        // Step 3: Publish Container
        const publishEndpoint = `https://graph.facebook.com/v19.0/${igUserId}/media_publish`;
        const publishRes = await fetch(publishEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creation_id: creationId,
                access_token: accessToken
            })
        });

        const publishData: any = await publishRes.json();
        if (!publishRes.ok || publishData.error || !publishData.id) {
            const errorMsg = publishData.error?.message || `Instagram Publish Error (HTTP ${publishRes.status})`;
            console.error(`[IG_PUBLISH_ERR] IG User: ${igUserId}, Error:`, publishData.error || publishData);
            return { success: false, error: errorMsg };
        }

        return { success: true, mediaId: publishData.id };
    } catch (e: any) {
        console.error(`[IG_POST_EXCEPTION] IG User: ${igUserId}, Error:`, e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Execute auto-posting for a specific news post and district
 */
export async function executeSocialPostForNews(
    postId: string, 
    postData: any, 
    district: string
): Promise<{
    facebookStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    facebookPostId?: string;
    facebookError?: string;
    instagramStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    instagramMediaId?: string;
    instagramError?: string;
}> {
    // 1. Fetch Global Settings
    const settingsDoc = await db.collection('settings').doc('social_auto_post').get();
    const globalSettings: SocialAutoPostSettings = settingsDoc.exists 
        ? (settingsDoc.data() as SocialAutoPostSettings) 
        : { globalEnabled: true };

    if (globalSettings.globalEnabled === false) {
        console.log(`[SOCIAL_POST_SKIPPED] Global social auto-post is disabled.`);
        return {
            facebookStatus: 'SKIPPED',
            facebookError: 'Global social auto-post is disabled',
            instagramStatus: 'SKIPPED',
            instagramError: 'Global social auto-post is disabled'
        };
    }

    // 2. Fetch District Config
    const configDoc = await db.collection('social_auto_post_configs').doc(district).get();
    if (!configDoc.exists) {
        console.log(`[SOCIAL_POST_SKIPPED] No config found for district: ${district}`);
        return {
            facebookStatus: 'SKIPPED',
            facebookError: `No config found for district ${district}`,
            instagramStatus: 'SKIPPED',
            instagramError: `No config found for district ${district}`
        };
    }

    const config = configDoc.data() as DistrictSocialConfig;
    if (!config.enabled) {
        console.log(`[SOCIAL_POST_SKIPPED] Auto-post is disabled for district: ${district}`);
        return {
            facebookStatus: 'SKIPPED',
            facebookError: `Auto-post disabled for ${district}`,
            instagramStatus: 'SKIPPED',
            instagramError: `Auto-post disabled for ${district}`
        };
    }

    const headline = postData.headline?.telugu || postData.headline?.english || postData.headline || "";
    const content = postData.content?.telugu || postData.content?.english || postData.content || "";
    
    // Check for YouTube URL
    let youtubeUrl = postData.youtubeUrl || "";
    if (!youtubeUrl && postData.mediaUrl && (postData.mediaUrl.includes('youtube.com') || postData.mediaUrl.includes('youtu.be'))) {
        youtubeUrl = postData.mediaUrl;
    }

    let rawMediaUrl = postData.mediaUrl || postData.thumbnailUrl || (Array.isArray(postData.mediaUrls) ? postData.mediaUrls[0] : "") || "";
    if (!rawMediaUrl && youtubeUrl) {
        let ytId = "";
        if (youtubeUrl.includes('v=')) ytId = youtubeUrl.split('v=')[1].split('&')[0];
        else if (youtubeUrl.includes('youtu.be/')) ytId = youtubeUrl.split('youtu.be/')[1].split('?')[0];
        if (ytId) rawMediaUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }

    // Ensure media image is mirrored and public for Facebook/Instagram download
    const mediaUrl = await ensurePublicDownloadableImageUrl(rawMediaUrl, postId);

    const caption = buildPostCaption(
        headline, 
        content, 
        district, 
        config.customHashtags || globalSettings.defaultHashtags || [], 
        config.includeAppDownloadLink !== false, 
        globalSettings.defaultAppDownloadLink || "https://play.google.com/store/apps/details?id=com.alfanews.telugu",
        youtubeUrl
    );

    let facebookStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED' = 'SKIPPED';
    let facebookPostId: string | undefined;
    let facebookError: string | undefined;

    let instagramStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED' = 'SKIPPED';
    let instagramMediaId: string | undefined;
    let instagramError: string | undefined;

    // 3. Post to Facebook Page
    if (config.facebook?.enabled && config.facebook.pageId) {
        const fbToken = config.facebook.pageAccessToken || globalSettings.defaultAccessToken;
        if (!fbToken) {
            facebookStatus = 'FAILED';
            facebookError = "Facebook Page Access Token missing (neither district nor global token provided)";
        } else {
            const rawVideoUrl = postData.videoUrl || (postData.mediaUrl && typeof postData.mediaUrl === 'string' && postData.mediaUrl.includes('.mp4') ? postData.mediaUrl : "");
            console.log(`[FB_POST_START] Posting to FB Page: ${config.facebook.pageId} for district: ${district}`);
            const fbRes = await postToFacebookPage(config.facebook.pageId, fbToken, caption, mediaUrl, youtubeUrl, rawVideoUrl);
            if (fbRes.success) {
                facebookStatus = 'SUCCESS';
                facebookPostId = fbRes.postId;
            } else {
                facebookStatus = 'FAILED';
                facebookError = fbRes.error;
            }
        }

    }


    // 4. Post to Instagram Account
    if (config.instagram?.enabled && config.instagram.igUserId) {
        const igToken = config.instagram.accessToken || config.facebook?.pageAccessToken || globalSettings.defaultAccessToken;
        if (!igToken) {
            instagramStatus = 'FAILED';
            instagramError = "Instagram Access Token missing";
        } else if (!mediaUrl) {
            instagramStatus = 'SKIPPED';
            instagramError = "Instagram requires an image (post has no image)";
        } else {
            console.log(`[IG_POST_START] Posting to IG Account: ${config.instagram.igUserId} for district: ${district}`);
            const igRes = await postToInstagramAccount(config.instagram.igUserId, igToken, caption, mediaUrl);
            if (igRes.success) {
                instagramStatus = 'SUCCESS';
                instagramMediaId = igRes.mediaId;
            } else {
                instagramStatus = 'FAILED';
                instagramError = igRes.error;
            }
        }
    }

    // 5. Update District Stats
    const statsUpdate: any = {
        'stats.lastPostTime': admin.firestore.FieldValue.serverTimestamp(),
        'stats.lastFbStatus': facebookStatus,
        'stats.lastIgStatus': instagramStatus,
        'stats.lastError': facebookError || instagramError || null,
        'updatedAt': admin.firestore.FieldValue.serverTimestamp()
    };

    if (facebookStatus === 'SUCCESS') {
        statsUpdate['stats.totalFbPosts'] = admin.firestore.FieldValue.increment(1);
    }
    if (instagramStatus === 'SUCCESS') {
        statsUpdate['stats.totalIgPosts'] = admin.firestore.FieldValue.increment(1);
    }

    await db.collection('social_auto_post_configs').doc(district).update(statsUpdate).catch(err => {
        console.warn(`[CONFIG_STATS_WARN] Could not update stats for ${district}:`, err.message);
    });

    // 6. Record Log in `social_auto_post_logs`
    const logDoc: any = {
        id: `${postId}_${Date.now()}`,
        postId,
        headline: headline || '',
        district: district || '',
        state: config.state || '',
        mediaUrl: mediaUrl || '',
        facebookStatus,
        facebookPostId: facebookPostId || null,
        facebookError: facebookError || null,
        instagramStatus,
        instagramMediaId: instagramMediaId || null,
        instagramError: instagramError || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('social_auto_post_logs').doc(logDoc.id).set(logDoc).catch(err => {
        console.warn(`[LOG_SAVE_WARN] Could not save auto post log:`, err.message);
    });

    return {
        facebookStatus,
        facebookPostId,
        facebookError,
        instagramStatus,
        instagramMediaId,
        instagramError
    };
}


/**
 * 1. Firestore Trigger: Trigger auto-posting when a news post is published/approved
 */
export const onNewsPostSocialAutoPost = onDocumentWritten({
    document: "news/{postId}",
    region: REGION,
    timeoutSeconds: 300,
    memory: "512MiB",
    maxInstances: 5
}, async (event) => {
    const afterSnap = event.data?.after;
    if (!afterSnap || !afterSnap.exists) return;

    const beforeData: any = event.data?.before?.exists ? event.data.before.data() : null;
    const data: any = afterSnap.data();
    const postId = event.params.postId;

    // 1. Guard (Loop Prevention): Bail immediately if already posted in either before or after snapshot
    if (beforeData?.socialAutoPosted === true || data.socialAutoPosted === true) {
        return;
    }

    // 2. Guard: Strictly check if post is published/approved (ignore drafts, pending, or rejected)
    const rawStatus = (data.status || "").toLowerCase();
    const isApproved = (data.approved === true || rawStatus === 'published') && rawStatus !== 'rejected' && rawStatus !== 'draft' && rawStatus !== 'pending' && rawStatus !== 'suspended';
    if (!isApproved) {
        return;
    }

    // 3. Guard: If this is a video post, wait until YouTube processing has completed
    const isVideoType = data.type === 'video' || data.mediaType === 'video' || (Array.isArray(data.mediaUrls) && data.mediaUrls.some((u: string) => typeof u === 'string' && u.includes('.mp4')));
    if (isVideoType && !data.youtubeUrl && data.videoProcessed !== true) {
        console.log(`[SOCIAL_POST_WAIT_VIDEO] Post ${postId} is a video post still being processed for YouTube. Waiting for completion...`);
        return;
    }

    // 4. Guard: Age check (Do not auto-post old news older than 12 hours)
    const ts = data.timestamp || data.createdAt;
    if (ts) {
        let postTimeMs = 0;
        if (typeof ts.toMillis === 'function') postTimeMs = ts.toMillis();
        else if (typeof ts.toDate === 'function') postTimeMs = ts.toDate().getTime();
        else if (ts._seconds) postTimeMs = ts._seconds * 1000;
        else if (typeof ts === 'number') postTimeMs = ts;

        if (postTimeMs > 0 && (Date.now() - postTimeMs) > 12 * 60 * 60 * 1000) {
            console.log(`[SOCIAL_POST_SKIPPED] ${postId} is older than 12 hours.`);
            return;
        }
    }

    // 5. Resolve District
    const district = resolveDistrictName(data);
    if (!district) {
        // Not a district-tagged news, skip quietly
        return;
    }

    // 6. Atomic Locking via Firestore Transaction (Guarantees Exactly-Once Execution & Prevents Race Conditions)
    let lockAcquired = false;
    try {
        await db.runTransaction(async (t) => {
            const docRef = db.collection('news').doc(postId);
            const docSnap = await t.get(docRef);
            if (!docSnap.exists) return;
            const currentData = docSnap.data();
            if (currentData?.socialAutoPosted === true) {
                return; // Already locked by a concurrent execution
            }

            t.update(docRef, {
                socialAutoPosted: true,
                socialAutoPostTime: admin.firestore.FieldValue.serverTimestamp(),
                socialAutoPostDistrict: district
            });
            lockAcquired = true;
        });
    } catch (lockErr: any) {
        console.warn(`[SOCIAL_LOCK_WARN] Could not acquire lock for ${postId}:`, lockErr.message);
        return;
    }

    if (!lockAcquired) {
        console.log(`[SOCIAL_POST_LOCKED] Lock already held for ${postId}, skipping duplicate execution.`);
        return;
    }

    console.log(`[SOCIAL_AUTO_POST_TRIGGER] Starting social post for: ${postId} in district: ${district}`);

    try {
        const result = await executeSocialPostForNews(postId, data, district);

        await db.collection('news').doc(postId).update({
            socialAutoPostStatus: {
                facebookStatus: result.facebookStatus,
                facebookPostId: result.facebookPostId || null,
                facebookError: result.facebookError || null,
                instagramStatus: result.instagramStatus,
                instagramMediaId: result.instagramMediaId || null,
                instagramError: result.instagramError || null
            }
        }).catch((err) => {
            console.warn(`[STATUS_UPDATE_WARN]`, err.message);
        });
    } catch (execErr: any) {
        console.error(`[SOCIAL_AUTO_POST_FATAL] Error executing social post for ${postId}:`, execErr.message);
    }
});


/**
 * 2. Callable Function: Send a Test Post to Verify Connection
 */
export const testDistrictSocialPost = onCall({
    region: REGION,
    timeoutSeconds: 120,
    memory: "512MiB"
}, async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }

    const userDoc = await db.collection('users').doc(auth.uid).get();
    const role = String(userDoc.data()?.role || '').toUpperCase();
    const isAdmin = ['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(role) || userDoc.data()?.role === UserRole.ADMIN;

    if (!isAdmin) {
        throw new HttpsError('permission-denied', 'ఈ పరీక్ష నిర్వహించే అనుమతి కేవలం అడ్మిన్లకు మాత్రమే ఉంది.');
    }

    const { districtId, testPlatform, customMessage, customImageUrl } = request.data || {};
    if (!districtId) {
        throw new HttpsError('invalid-argument', 'District ID is required.');
    }

    const configDoc = await db.collection('social_auto_post_configs').doc(districtId).get();
    if (!configDoc.exists) {
        throw new HttpsError('not-found', `District configuration for "${districtId}" not found.`);
    }

    const config = configDoc.data() as DistrictSocialConfig;
    const settingsDoc = await db.collection('settings').doc('social_auto_post').get();
    const globalSettings: SocialAutoPostSettings = settingsDoc.exists 
        ? (settingsDoc.data() as SocialAutoPostSettings) 
        : { globalEnabled: true };

    const sampleHeadline = customMessage || `ఆల్ఫా న్యూస్ (${districtId}) టెస్ట్ పోస్ట్ - Alfa News Test`;
    const sampleContent = `ఇది ఆల్ఫా న్యూస్ సిస్టమ్ ద్వారా ఆటోమేటిక్‌గా పంపబడిన టెస్ట్ పోస్ట్. పేజీ కనెక్షన్ విజయవంతంగా పూర్తయింది.`;
    const sampleImageUrl = customImageUrl || "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1080&h=1080&fit=crop&fm=jpg";


    const caption = buildPostCaption(
        sampleHeadline, 
        sampleContent, 
        districtId, 
        config.customHashtags || globalSettings.defaultHashtags || [], 
        true, 
        globalSettings.defaultAppDownloadLink || "https://play.google.com/store/apps/details?id=com.alfanews.telugu"
    );

    const results: any = { district: districtId, timestamp: new Date().toISOString() };

    // Test Facebook
    if (testPlatform === 'all' || testPlatform === 'facebook') {
        const fbPageId = config.facebook?.pageId;
        const fbToken = config.facebook?.pageAccessToken || globalSettings.defaultAccessToken;
        if (!fbPageId) {
            results.facebook = { success: false, error: 'Facebook Page ID is not configured.' };
        } else if (!fbToken) {
            results.facebook = { success: false, error: 'Facebook Page Access Token missing (neither district nor global token provided).' };
        } else {
            const fbRes = await postToFacebookPage(fbPageId, fbToken, caption, sampleImageUrl);
            results.facebook = fbRes;
        }
    }

    // Test Instagram
    if (testPlatform === 'all' || testPlatform === 'instagram') {
        const igUserId = config.instagram?.igUserId;
        const igToken = config.instagram?.accessToken || config.facebook?.pageAccessToken || globalSettings.defaultAccessToken;
        if (!igUserId) {
            results.instagram = { success: false, error: 'Instagram Account ID (IG User ID) is not configured.' };
        } else if (!igToken) {
            results.instagram = { success: false, error: 'Instagram Access Token is missing.' };
        } else {
            const igRes = await postToInstagramAccount(igUserId, igToken, caption, sampleImageUrl);
            results.instagram = igRes;
        }
    }

    return results;
});

/**
 * 3. Callable Function: Manually Trigger Social Post for a Specific News Post
 */
export const manuallyTriggerSocialPost = onCall({
    region: REGION,
    timeoutSeconds: 180,
    memory: "512MiB"
}, async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }

    const userDoc = await db.collection('users').doc(auth.uid).get();
    const role = String(userDoc.data()?.role || '').toUpperCase();
    const isAdmin = ['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(role) || userDoc.data()?.role === UserRole.ADMIN;

    if (!isAdmin) {
        throw new HttpsError('permission-denied', 'ఈ ఆపరేషన్ కేవలం అడ్మిన్లకు మాత్రమే అందుబాటులో ఉంది.');
    }

    const { postId, districtId } = request.data || {};
    if (!postId) {
        throw new HttpsError('invalid-argument', 'Post ID is required.');
    }

    const postDoc = await db.collection('news').doc(postId).get();
    if (!postDoc.exists) {
        throw new HttpsError('not-found', 'News post not found.');
    }

    const postData = postDoc.data();
    const targetDistrict = districtId || resolveDistrictName(postData);

    if (!targetDistrict) {
        throw new HttpsError('invalid-argument', 'Could not resolve district for this news post. Please provide districtId explicitly.');
    }

    const result = await executeSocialPostForNews(postId, postData, targetDistrict);

    await db.collection('news').doc(postId).update({
        socialAutoPosted: true,
        socialAutoPostTime: admin.firestore.FieldValue.serverTimestamp(),
        socialAutoPostDistrict: targetDistrict,
        socialAutoPostStatus: {
            facebookStatus: result.facebookStatus,
            facebookPostId: result.facebookPostId || null,
            facebookError: result.facebookError || null,
            instagramStatus: result.instagramStatus,
            instagramMediaId: result.instagramMediaId || null,
            instagramError: result.instagramError || null
        }
    }).catch(err => {
        console.warn(`[MANUAL_STATUS_UPDATE_WARN]`, err.message);
    });

    return { success: true, district: targetDistrict, result };

});

/**
 * 4. Callable Function: Seed/Initialize All Districts in Firestore with Clean Defaults
 */
export const initializeDistrictSocialConfigs = onCall({
    region: REGION,
    timeoutSeconds: 120,
    memory: "512MiB"
}, async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }

    const userDoc = await db.collection('users').doc(auth.uid).get();
    const role = String(userDoc.data()?.role || '').toUpperCase();
    const isAdmin = ['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(role) || userDoc.data()?.role === UserRole.ADMIN;

    if (!isAdmin) {
        throw new HttpsError('permission-denied', 'అనుమతి నిరాకరించబడింది.');
    }

    const batch = db.batch();
    let count = 0;

    for (const dist of ALL_TS_DISTRICTS) {
        const docRef = db.collection('social_auto_post_configs').doc(dist);
        const existing = await docRef.get();
        if (!existing.exists) {
            const config: DistrictSocialConfig = {
                id: dist,
                district: dist,
                state: 'TS',
                enabled: false,
                facebook: { enabled: false, pageId: '', pageName: '', pageAccessToken: '' },
                instagram: { enabled: false, igUserId: '', accountName: '', accessToken: '' },
                customHashtags: [`#${dist.replace(/\s+/g, '')}`, '#AlfaNews'],
                includeAppDownloadLink: true,
                stats: { totalFbPosts: 0, totalIgPosts: 0, lastFbStatus: 'IDLE', lastIgStatus: 'IDLE', lastError: null },
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            batch.set(docRef, config);
            count++;
        }
    }

    for (const dist of ALL_AP_DISTRICTS) {
        const docRef = db.collection('social_auto_post_configs').doc(dist);
        const existing = await docRef.get();
        if (!existing.exists) {
            const config: DistrictSocialConfig = {
                id: dist,
                district: dist,
                state: 'AP',
                enabled: false,
                facebook: { enabled: false, pageId: '', pageName: '', pageAccessToken: '' },
                instagram: { enabled: false, igUserId: '', accountName: '', accessToken: '' },
                customHashtags: [`#${dist.replace(/\s+/g, '')}`, '#AlfaNews'],
                includeAppDownloadLink: true,
                stats: { totalFbPosts: 0, totalIgPosts: 0, lastFbStatus: 'IDLE', lastIgStatus: 'IDLE', lastError: null },
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            batch.set(docRef, config);
            count++;
        }
    }

    // Default global settings if not exists
    const globalRef = db.collection('settings').doc('social_auto_post');
    const globalDoc = await globalRef.get();
    if (!globalDoc.exists) {
        batch.set(globalRef, {
            globalEnabled: true,
            defaultAppDownloadLink: 'https://play.google.com/store/apps/details?id=com.alfanews.telugu',
            defaultHashtags: ['#AlfaNews', '#TeluguNews', '#BreakingNews'],
            defaultAccessToken: '',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    if (count > 0 || !globalDoc.exists) {
        await batch.commit();
    }

    return { success: true, initializedCount: count };
});

/**
 * 5. Callable Function: Exchange Short-Lived User Token to Long-Lived / Permanent Page Token
 */
export const exchangeForPermanentToken = onCall({
    region: REGION,
    timeoutSeconds: 60,
    memory: "512MiB"
}, async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }

    const { shortLivedToken, appId, appSecret } = request.data || {};
    if (!shortLivedToken || !appId || !appSecret) {
        throw new HttpsError('invalid-argument', 'Short-lived token, App ID, and App Secret are required.');
    }

    try {
        // Step 1: Exchange for 60-day Long-Lived User Token
        const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId.trim()}&client_secret=${appSecret.trim()}&fb_exchange_token=${shortLivedToken.trim()}`;
        const exchangeRes = await fetch(exchangeUrl);
        const exchangeData: any = await exchangeRes.json();

        if (!exchangeRes.ok || exchangeData.error || !exchangeData.access_token) {
            const err = exchangeData.error?.message || 'Failed to exchange for long-lived token.';
            throw new Error(err);
        }

        const longLivedUserToken = exchangeData.access_token;

        // Step 2: Fetch Permanent Page Access Tokens for all pages
        const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedUserToken}`;
        const accountsRes = await fetch(accountsUrl);
        const accountsData: any = await accountsRes.json();

        const pages = accountsData.data || [];

        // Save in global settings
        await db.collection('settings').doc('social_auto_post').set({
            appId: appId.trim(),
            appSecret: appSecret.trim(),
            defaultAccessToken: longLivedUserToken,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return {
            success: true,
            longLivedUserToken,
            pagesCount: pages.length,
            pages: pages.map((p: any) => ({
                id: p.id,
                name: p.name,
                accessToken: p.access_token // Never expires Page Access Token
            }))
        };
    } catch (err: any) {
        console.error('[TOKEN_EXCHANGE_ERR]', err.message);
        throw new HttpsError('internal', err.message);
    }
});

