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
    verifyReporter
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

/**
 * Push Broadcast Function (Manual Push)
 */
export const triggerPushBroadcast = onCall(async (request) => {
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
        message.notification.imageUrl = imageUrl;
        message.android.notification.imageUrl = imageUrl;
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

export const shareNews = onRequest(async (req, res) => {
    const id = req.path.split('/').pop();
    const playUrl = "https://play.google.com/store/apps/details?id=com.alfanews.telugu";
    if (!id || id === 'news') {
        res.redirect(playUrl);
        return;
    }
    try {
        const doc = await db.collection('news').doc(id).get();
        if (!doc.exists) {
            res.redirect(playUrl);
            return;
        }
        const data = doc.data();
        res.status(200).send(`<html><head><title>${data?.headline?.telugu}</title><meta property="og:image" content="${data?.mediaUrl}"></head><body><script>window.location.href="${playUrl}";</script></body></html>`);
    } catch (e) {
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
