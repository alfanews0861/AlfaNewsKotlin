/**
 * Alfa News - Cloud Functions v18.0 (Refactored & Modular)
 */
import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import * as nodemailer from "nodemailer";
import { REGION } from "./utils";

if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

setGlobalOptions({
    region: REGION,
    maxInstances: 5,
    memory: "512MiB",
    timeoutSeconds: 300,
    concurrency: 10
});

// 1. Export Scheduled/Auto-Content Functions
export {
    scheduleFestivalGreeting,
    scheduleQuoteOfTheDay,
    scheduleHistoryOfTheDay,
    generateDailyCartoon,
    checkSevereWeatherAlerts,
    cleanupOldNews
} from "./auto_content_handler";

export {
    scheduleDailyAffiliateDeals
} from "./affiliate_handler";

// 2. Export Reporter Functions
export {
    processReporterSubmission,
    submitReporterApplication,
    backfillReporterPoints,
    onNewsViewCountUpdated,
    onNewsPostApproved,
    onUserRoleChanged,
    verifyReporter,
    onUserCreated,
    onAnonymousDeviceCreated,
    onReporterApplicationCreated,
    autoApproveAllPendingApplications,
    runAutoApprovePendingBackfill,
    reactivateFalselyDemotedReporters,
    runReactivateDemotedReportersHttp,
    recordAppInstallReferral
} from "./reporter_handler";

// 3. Export Main News Functions
export {
    processNewsPost,
    onNewsPostCreated
} from "./news_handler";

// 4. Export Notification Engine
export * from './notification_engine';

// 5. Export Reporter Monitoring
export * from './reporter_monitor';

// 6. Export Reporter Messaging
export {
    sendAdminReporterMessage,
    broadcastToAllReporters
} from './reporter_messaging';

// 7. Export News Reporting & Auto-Takedown
export {
    reportNewsPost
} from './report_handler';


import { UserRole } from "./types";

/**
 * Push Broadcast Function (Manual Push - Admin Only)
 */
export const triggerPushBroadcast = onCall(async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }

    const senderDoc = await db.collection('users').doc(auth.uid).get();
    const senderRole = String(senderDoc.data()?.role || '').toUpperCase();
    const isAdmin = ['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(senderRole) || senderDoc.data()?.role === UserRole.ADMIN || senderDoc.data()?.role === UserRole.EDITOR;

    if (!isAdmin) {
        throw new HttpsError('permission-denied', 'పుష్ నోటిఫికేషన్లు పంపే అనుమతి కేవలం అడ్మిన్లకు మాత్రమే ఉంది.');
    }

    const { title, body, actionUrl, topic, imageUrl, newsId, channelId, silent } = request.data;
    if (!title || !body) throw new HttpsError('invalid-argument', 'Title and Body are required.');

    const message: any = {
        notification: { title, body },
        android: {
            notification: {
                channelId: channelId || "general_news",
                priority: silent ? "low" : "high" as any,
                defaultSound: !silent
            }
        },
        data: {
            actionUrl: actionUrl || "",
            newsId: newsId || "",
            channelId: channelId || "general_news",
            title: title,
            body: body
        },
        topic: topic || 'all_users'
    };

    if (imageUrl && imageUrl.startsWith('http')) {
        const isHeavyStorageUrl = imageUrl.includes('firebasestorage.googleapis.com') && !imageUrl.includes('thumbnails%2F') && !imageUrl.includes('_thumb');
        if (!isHeavyStorageUrl) {
            message.notification.imageUrl = imageUrl;
            message.android.notification.imageUrl = imageUrl;
        }
        message.data.imageUrl = imageUrl;
    }

    try {
        const response = await admin.messaging().send(message);
        return { success: true, messageId: response };
    } catch (error: any) {
        throw new HttpsError('internal', error.message || 'Failed to send notification');
    }
});

export const sendContactEmail = onCall({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const { name, phone, message } = request.data;
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
    await transporter.sendMail({ from: process.env.EMAIL_USER, to: 'alfanews0861@gmail.com', subject: `Contact: ${name}`, text: `Phone: ${phone}\n${message}` });
    return { success: true };
});

function escapeHtml(str: string): string {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeXml(str: string): string {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxCharsPerLine: number = 28, maxLines: number = 4): string[] {
    if (!text) return [];
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
        if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
            currentLine = (currentLine + " " + word).trim();
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
            if (lines.length >= maxLines - 1) {
                break;
            }
        }
    }
    if (currentLine && lines.length < maxLines) {
        lines.push(currentLine);
    }
    return lines;
}

const sharp = require('sharp');

export const getNewsCardImage = onRequest(async (req, res) => {
    const pathSegments = req.path.split('/').filter(Boolean);
    let fileName = pathSegments.pop() || "";
    const id = fileName.replace(/\.jpg$|\.jpeg$|\.png$|\.webp$/i, "");

    if (!id || id === 'news' || id === 'news-card') {
        res.status(404).send("Not found");
        return;
    }

    try {
        const isAd = pathSegments.includes('ad');
        const collectionName = isAd ? 'localAds' : 'news';
        const doc = await db.collection(collectionName).doc(id).get();

        if (!doc.exists) {
            res.status(404).send("Post not found");
            return;
        }

        const data = doc.data() || {};
        const title = data.headline?.telugu || data.headline?.english || data.title || data.businessName || "Alfa News Telugu";
        const content = data.content?.telugu || data.summary?.telugu || data.content?.english || data.summary?.english || data.description || "";
        const location = data.location || data.district || "ఆంధ్రప్రదేశ్";
        const reporterName = data.reporter?.name || data.reporterName || "Alfa News";
        const likes = data.likes || 0;
        const shares = data.shares || 0;
        const comments = data.commentCount || 0;

        let mediaUrl = data.mediaUrl || data.imageUrl || (Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : null) || data.videoThumbnailUrl;

        const cardWidth = 720;
        const cardHeight = 1280;
        const photoHeight = 486; // 38% of card height

        // 1. Base Dark Background (#121212)
        const bgSvg = `
        <svg width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${cardWidth}" height="${cardHeight}" fill="#121212" />
        </svg>`;

        // 2. Fetch and prepare media photo (Width: 720, Height: 486)
        let mediaBuffer: Buffer | null = null;
        if (mediaUrl && mediaUrl.startsWith("http")) {
            try {
                const response = await fetch(mediaUrl, { signal: AbortSignal.timeout(4000) });
                if (response.ok) {
                    const arrayBuf = await response.arrayBuffer();
                    const rawBuffer = Buffer.from(arrayBuf);
                    mediaBuffer = await sharp(rawBuffer)
                        .resize(cardWidth, photoHeight, { fit: 'cover', position: 'center' })
                        .jpeg({ quality: 85 })
                        .toBuffer();
                }
            } catch (err) {
                console.warn("Could not fetch media photo for card:", err);
            }
        }

        // 3. Format Text Lines
        const titleLines = wrapText(title, 26, 3);
        const contentLines = wrapText(content, 36, 12);

        let headlineTspans = titleLines.map((line, idx) => `<tspan x="24" dy="${idx === 0 ? '0' : '44'}">${escapeXml(line)}</tspan>`).join('');
        let contentTspans = contentLines.map((line, idx) => `<tspan x="24" dy="${idx === 0 ? '0' : '36'}">${escapeXml(line)}</tspan>`).join('');

        const overlaySvg = `
        <svg width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .source { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Mallanna", "Ramabhadra", sans-serif; font-size: 16px; fill: #ffffff; }
                .headline { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Mallanna", "Ramabhadra", sans-serif; font-size: 32px; font-weight: 800; fill: #ffffff; }
                .reporter { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Mallanna", "Ramabhadra", sans-serif; font-size: 19px; font-weight: 700; fill: #38bdf8; }
                .meta { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Mallanna", "Ramabhadra", sans-serif; font-size: 18px; fill: #94a3b8; }
                .body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Mallanna", "Ramabhadra", sans-serif; font-size: 22px; font-weight: 400; fill: #cbd5e1; }
                .action-count { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 15px; font-weight: 600; fill: #94a3b8; text-anchor: middle; }
                .watermark { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; font-weight: 700; fill: #ef4444; }
            </style>

            <!-- Media Source watermark on photo (Y: 465) -->
            <rect x="0" y="445" width="720" height="41" fill="rgba(0,0,0,0.4)" />
            <text x="16" y="471" class="source">మూలం: ${escapeXml(reporterName)}</text>

            <!-- Headline Text (Y: 525) -->
            <text x="24" y="525" class="headline">
                ${headlineTspans}
            </text>

            <!-- Dotted Line 1 (Y: 640) -->
            <line x1="24" y1="645" x2="615" y2="645" stroke="#475569" stroke-width="1.5" stroke-dasharray="4 4" />

            <!-- Meta Row: Reporter | Location (Y: 675) -->
            <text x="24" y="675" class="reporter">${escapeXml(reporterName)}</text>
            <text x="190" y="675" class="meta">| 📍 ${escapeXml(location)}</text>

            <!-- Dotted Line 2 (Y: 695) -->
            <line x1="24" y1="695" x2="615" y2="695" stroke="#475569" stroke-width="1.5" stroke-dasharray="4 4" />

            <!-- Full Article Content Body (Y: 735) -->
            <text x="24" y="735" class="body">
                ${contentTspans}
            </text>

            <!-- Right Action Bar (X: 630 to 700) -->
            <!-- Like Action -->
            <circle cx="660" cy="540" r="22" fill="#1e293b" />
            <text x="660" y="547" font-size="20" text-anchor="middle">❤️</text>
            <text x="660" y="580" class="action-count">${likes}</text>

            <!-- Share Action -->
            <circle cx="660" cy="630" r="22" fill="#1e293b" />
            <text x="660" y="637" font-size="20" text-anchor="middle">🔗</text>
            <text x="660" y="670" class="action-count">${shares}</text>

            <!-- Comment Action -->
            <circle cx="660" cy="720" r="22" fill="#1e293b" />
            <text x="660" y="727" font-size="20" text-anchor="middle">💬</text>
            <text x="660" y="760" class="action-count">${comments}</text>

            <!-- Bottom Brand Bar -->
            <rect x="0" y="1230" width="720" height="50" fill="#0f172a" />
            <text x="24" y="1262" class="watermark">🔴 ALFA NEWS APP</text>
            <text x="560" y="1262" font-size="14" fill="#64748b" font-family="sans-serif">alfanews.app</text>
        </svg>`;

        const compositeInputs: any[] = [];

        if (mediaBuffer) {
            compositeInputs.push({
                input: mediaBuffer,
                top: 0,
                left: 0
            });
        }

        compositeInputs.push({
            input: Buffer.from(overlaySvg),
            top: 0,
            left: 0
        });

        const finalImage = await sharp(Buffer.from(bgSvg))
            .composite(compositeInputs)
            .jpeg({ quality: 85 })
            .toBuffer();

        res.set({
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=86400, s-maxage=604800'
        });
        res.status(200).send(finalImage);
    } catch (e) {
        console.error("Error generating news card image:", e);
        res.status(500).send("Error generating image");
    }
});

export const shareNews = onRequest(async (req, res) => {
    const playUrl = "https://play.google.com/store/apps/details?id=com.alfanews.telugu";
    const pathSegments = req.path.split('/').filter(Boolean);
    const isAd = pathSegments.includes('ad');
    const id = pathSegments.pop();

    if (!id || id === 'news' || id === 'ad') {
        res.redirect(playUrl);
        return;
    }

    try {
        const collectionName = isAd ? 'localAds' : 'news';
        const doc = await db.collection(collectionName).doc(id).get();

        if (!doc.exists) {
            res.redirect(playUrl);
            return;
        }

        const data = doc.data() || {};
        const titleRaw = data.headline?.telugu || data.headline?.english || data.title || data.businessName || "Alfa News Telugu";
        const descRaw = data.summary?.telugu || data.summary?.english || (data.content?.telugu ? data.content.telugu.substring(0, 160) + "..." : (data.description || "తాజా తెలుగు వార్తలు మరియు వీడియోల కోసం Alfa News యాప్‌లో చూడండి."));
        
        const cardImageUrl = `https://alfanews.app/news-card/${id}.jpg`;
        const safeTitle = escapeHtml(titleRaw);
        const safeDesc = escapeHtml(descRaw);
        const safeImage = escapeHtml(cardImageUrl);
        const postUrl = `https://alfanews.app/${isAd ? 'ad' : 'news'}/${id}`;
        const intentScheme = `alfanews://${isAd ? 'ad' : 'news'}/${id}`;

        const html = `<!DOCTYPE html>
<html lang="te" prefix="og: http://ogp.me/ns#">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${safeTitle} | Alfa News</title>

    <!-- Open Graph (WhatsApp, Facebook, Telegram) - Full News Card Image -->
    <meta property="og:site_name" content="Alfa News">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${postUrl}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDesc}">
    <meta property="og:image" content="${safeImage}">
    <meta property="og:image:secure_url" content="${safeImage}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="720">
    <meta property="og:image:height" content="1200">
    <meta property="og:image:alt" content="${safeTitle}">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDesc}">
    <meta name="twitter:image" content="${safeImage}">

    <!-- Android App Links & Smart App Banner -->
    <meta name="google-play-app" content="app-id=com.alfanews.telugu">
    <meta property="al:android:url" content="${intentScheme}">
    <meta property="al:android:package" content="com.alfanews.telugu">
    <meta property="al:android:app_name" content="Alfa News">
    <meta property="al:web:url" content="${postUrl}">
    <link rel="canonical" href="${postUrl}">

    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        body { background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 16px; }
        .card { background: #1e293b; border-radius: 16px; max-width: 480px; width: 100%; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); border: 1px solid #334155; }
        .media-container { width: 100%; height: 320px; background: #000; overflow: hidden; position: relative; }
        .media-container img { width: 100%; height: 100%; object-fit: cover; }
        .badge { position: absolute; top: 12px; left: 12px; background: #ef4444; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
        .content { padding: 20px; }
        h1 { font-size: 18px; line-height: 1.4; color: #ffffff; margin-bottom: 12px; font-weight: 700; }
        p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px; }
        .btn-primary { display: block; width: 100%; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; text-align: center; padding: 14px; border-radius: 12px; font-size: 16px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4); margin-bottom: 10px; transition: transform 0.1s ease; }
        .btn-primary:active { transform: scale(0.98); }
        .btn-secondary { display: block; width: 100%; background: #334155; color: #cbd5e1; text-align: center; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 600; text-decoration: none; }
        .footer-note { text-align: center; font-size: 12px; color: #64748b; margin-top: 16px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="media-container">
            <img src="${safeImage}" alt="${safeTitle}">
            <div class="badge">Alfa News</div>
        </div>
        <div class="content">
            <h1>${safeTitle}</h1>
            <p>${safeDesc}</p>
            <a id="openAppBtn" href="${intentScheme}" class="btn-primary">📲 యాప్‌లో చదవండి (Open in App)</a>
            <a href="${playUrl}" class="btn-secondary">Google Play Store నుండి డౌన్‌లోడ్ చేసుకోండి</a>
            <div class="footer-note">Alfa News - వేగవంతమైన తెలుగు వార్తలు</div>
        </div>
    </div>
    <script>
        (function() {
            const isAndroid = /Android/i.test(navigator.userAgent);
            const intentUrl = "intent://${isAd ? 'ad' : 'news'}/${id}#Intent;scheme=alfanews;package=com.alfanews.telugu;S.browser_fallback_url=" + encodeURIComponent("${playUrl}") + ";end";
            const appBtn = document.getElementById("openAppBtn");
            if (isAndroid) {
                appBtn.href = intentUrl;
                const isCrawler = /facebookexternalhit|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Googlebot/i.test(navigator.userAgent);
                if (!isCrawler) {
                    setTimeout(() => {
                        window.location.href = intentUrl;
                    }, 50);
                }
            }
        })();
    </script>
</body>
</html>`;

        res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
        res.status(200).send(html);
    } catch (e) {
        console.error("Error in shareNews SSR:", e);
        res.redirect(playUrl);
    }
});

// YouTube Auth Flow (Keep in index for simple management)
const { google } = require('googleapis');

export const youtubeAuthStart = onRequest({ secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"] }, (req, res) => {
    const youtubeAuth = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, `https://${REGION}-alfa-news-31bf7.cloudfunctions.net/youtubeAuthCallback`);
    res.redirect(youtubeAuth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: ['https://www.googleapis.com/auth/youtube.upload'] }));
});

export const youtubeAuthCallback = onRequest({ secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"] }, async (req, res) => {
    const { code } = req.query;
    if (!code) {
        res.status(400).send("Code missing.");
        return;
    }
    const youtubeAuth = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, `https://${REGION}-alfa-news-31bf7.cloudfunctions.net/youtubeAuthCallback`);
    try {
        const { tokens } = await youtubeAuth.getToken(code as string);
        if (tokens.refresh_token) {
            await db.collection('settings').doc('youtube').set({ refreshToken: tokens.refresh_token, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            res.status(200).send("<h1>Success! ✅</h1><p>Refresh Token Saved.</p>");
        } else {
            res.status(400).send("No refresh token received.");
        }
    } catch (e: any) {
        res.status(500).send(`Error: ${e.message}`);
    }
});
