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

import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';

try {
    const fontsDir = path.join(__dirname, '..', 'fonts');
    const mallannaPath = path.join(fontsDir, 'mallanna_regular.ttf');
    const ramabhadraPath = path.join(fontsDir, 'ramabhadra_regular.ttf');
    if (fs.existsSync(mallannaPath)) {
        GlobalFonts.registerFromPath(mallannaPath, 'Mallanna');
    }
    if (fs.existsSync(ramabhadraPath)) {
        GlobalFonts.registerFromPath(ramabhadraPath, 'Ramabhadra');
    }
} catch (e) {
    console.warn("Could not register fonts with Skia Canvas:", e);
}

function wrapTextCanvas(ctx: any, text: string, maxWidth: number, maxLines: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? (currentLine + ' ' + word) : word;
        if (ctx.measureText(testLine).width > maxWidth) {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
            if (lines.length >= maxLines - 1) break;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine && lines.length < maxLines) {
        lines.push(currentLine);
    }
    return lines;
}

function drawHeart(ctx: any, x: number, y: number, size: number) {
    ctx.save();
    ctx.beginPath();
    const topCurveHeight = size * 0.3;
    ctx.moveTo(x, y + topCurveHeight);
    ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + topCurveHeight);
    ctx.bezierCurveTo(x - size / 2, y + (size + topCurveHeight) / 2, x, y + (size + topCurveHeight) / 1.4, x, y + size);
    ctx.bezierCurveTo(x, y + (size + topCurveHeight) / 1.4, x + size / 2, y + (size + topCurveHeight) / 2, x + size / 2, y + topCurveHeight);
    ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + topCurveHeight);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
}

function drawShareIcon(ctx: any, x: number, y: number, size: number) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    const n1x = x + size * 0.3, n1y = y - size * 0.25;
    const n2x = x - size * 0.3, n2y = y;
    const n3x = x + size * 0.3, n3y = y + size * 0.25;
    const r = size * 0.12;

    ctx.beginPath();
    ctx.moveTo(n2x, n2y); ctx.lineTo(n1x, n1y);
    ctx.moveTo(n2x, n2y); ctx.lineTo(n3x, n3y);
    ctx.stroke();

    ctx.beginPath(); ctx.arc(n1x, n1y, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(n2x, n2y, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(n3x, n3y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawCommentIcon(ctx: any, x: number, y: number, size: number) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    const w = size * 0.8;
    const h = size * 0.55;
    const rx = x - w / 2;
    const ry = y - h / 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rx, ry, w, h, 6); else ctx.rect(rx, ry, w, h);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(rx + 6, ry + h);
    ctx.lineTo(rx + 2, ry + h + 8);
    ctx.lineTo(rx + 16, ry + h);
    ctx.fill();
    ctx.restore();
}

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
        const mandal = data.mandal || location;
        const reporterName = data.reporter?.name || data.reporterName || "Alfa News";
        const likes = data.likes || data.likeCount || (Math.floor(Math.random() * 150) + 75);
        const shares = data.shares || data.shareCount || (Math.floor(Math.random() * 25) + 12);
        const comments = data.commentCount || (Math.floor(Math.random() * 5));

        let mediaUrl = data.mediaUrl || data.imageUrl || (Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : null) || data.videoThumbnailUrl;

        // 9:14 Mobile Aspect Ratio -> 1080 x 1680
        const width = 1080;
        const height = 1680;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 1. Mobile App Dark Background
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, width, height);

        // 2. Top Header Bar (Y: 0 to 75)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, 75);
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(0, 0, width, 4);

        // Hamburger icon
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(36, 26, 26, 3.5);
        ctx.fillRect(36, 36, 26, 3.5);
        ctx.fillRect(36, 46, 26, 3.5);

        // Brand name
        ctx.font = '900 36px -apple-system, sans-serif';
        ctx.fillText('alfanews', 76, 52);

        // Location text
        ctx.font = '700 32px Mallanna';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(location, width - 36, 52);
        ctx.textAlign = 'left';

        // 3. News Photo (Y: 75 to 675, Height: 600)
        const photoY = 75;
        const photoH = 600;
        if (mediaUrl && typeof mediaUrl === 'string' && mediaUrl.startsWith('http')) {
            try {
                const photo = await loadImage(mediaUrl);
                ctx.drawImage(photo, 0, photoY, width, photoH);
            } catch(e) {
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(0, photoY, width, photoH);
            }
        } else {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, photoY, width, photoH);
        }

        // Photo Bottom Overlay Strip
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, photoY + photoH - 55, width, 55);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = '600 28px Mallanna';
        ctx.fillText(`మూలం: ${reporterName}`, 36, photoY + photoH - 18);

        // 4. Headline
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 52px Ramabhadra';
        const titleLines = wrapTextCanvas(ctx, title, width - 180, 3);
        let curY = photoY + photoH + 72;
        for (const line of titleLines) {
            ctx.fillText(line, 40, curY);
            curY += 70;
        }

        // 5. Meta Info Line
        curY += 10;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '600 32px Mallanna';
        ctx.fillText(`${reporterName}  |  ${mandal}  |  AlfaNews`, 40, curY);

        // 6. Dotted Divider
        curY += 26;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(40, curY);
        ctx.lineTo(width - 160, curY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 7. Story Body (46px Mallanna)
        curY += 66;
        ctx.fillStyle = '#f8fafc';
        ctx.font = '500 46px Mallanna';
        
        const paragraphs = content.split('\n\n');
        for (const para of paragraphs) {
            const bodyLines = wrapTextCanvas(ctx, para, width - 180, 6);
            for (const line of bodyLines) {
                ctx.fillText(line, 40, curY);
                curY += 68;
            }
            curY += 28;
        }

        // 8. Right Action Floating Buttons
        const actionX = width - 80;
        let actionY = photoY + photoH + 75;

        // Heart (Likes)
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(actionX, actionY, 34, 0, Math.PI * 2); ctx.fill();
        drawHeart(ctx, actionX, actionY - 14, 28);
        ctx.fillStyle = '#ffffff'; ctx.font = '700 22px -apple-system, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(likes.toString(), actionX, actionY + 56);

        // Share
        actionY += 130;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(actionX, actionY, 34, 0, Math.PI * 2); ctx.fill();
        drawShareIcon(ctx, actionX, actionY, 34);
        ctx.fillStyle = '#ffffff'; ctx.font = '700 22px -apple-system, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(shares.toString(), actionX, actionY + 56);

        // Comments
        actionY += 130;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(actionX, actionY, 34, 0, Math.PI * 2); ctx.fill();
        drawCommentIcon(ctx, actionX, actionY, 32);
        ctx.fillStyle = '#ffffff'; ctx.font = '700 22px -apple-system, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(comments.toString(), actionX, actionY + 56);

        const imageBuf = canvas.toBuffer('image/jpeg');
        res.set({
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=86400, s-maxage=604800'
        });
        res.status(200).send(imageBuf);
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
        const cardImageUrl = `https://alfanews.app/news-card/${id}.jpg`;
        const descRaw = data.content?.telugu || data.summary?.telugu || data.content?.english || data.summary?.english || data.description || "";
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
    <title>&#8203;</title>

    <!-- Open Graph (Full-Size Image Only Preview for WhatsApp) -->
    <meta property="og:title" content="&#8203;">
    <meta property="og:type" content="image.other">
    <meta property="og:url" content="${postUrl}">
    <meta property="og:image" content="${safeImage}">
    <meta property="og:image:secure_url" content="${safeImage}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1080">
    <meta property="og:image:height" content="1680">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
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
