"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.youtubeAuthCallback = exports.youtubeAuthStart = exports.shareNews = exports.sendContactEmail = exports.triggerPushBroadcast = exports.onNewsPostCreated = exports.processNewsPost = exports.submitReporterApplication = exports.processReporterSubmission = exports.cleanupOldNews = exports.checkSevereWeatherAlerts = exports.generateDailyCartoon = exports.scheduleHistoryOfTheDay = exports.scheduleQuoteOfTheDay = exports.scheduleFestivalGreeting = void 0;
/**
 * Alfa News - Cloud Functions v18.0 (Refactored & Modular)
 */
const admin = __importStar(require("firebase-admin"));
const v2_1 = require("firebase-functions/v2");
const https_1 = require("firebase-functions/v2/https");
const nodemailer = __importStar(require("nodemailer"));
const utils_1 = require("./utils");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
(0, v2_1.setGlobalOptions)({
    region: utils_1.REGION,
    maxInstances: 5,
    memory: "512MiB",
    timeoutSeconds: 300,
    concurrency: 10
});
// 1. Export Scheduled/Auto-Content Functions
var auto_content_handler_1 = require("./auto_content_handler");
Object.defineProperty(exports, "scheduleFestivalGreeting", { enumerable: true, get: function () { return auto_content_handler_1.scheduleFestivalGreeting; } });
Object.defineProperty(exports, "scheduleQuoteOfTheDay", { enumerable: true, get: function () { return auto_content_handler_1.scheduleQuoteOfTheDay; } });
Object.defineProperty(exports, "scheduleHistoryOfTheDay", { enumerable: true, get: function () { return auto_content_handler_1.scheduleHistoryOfTheDay; } });
Object.defineProperty(exports, "generateDailyCartoon", { enumerable: true, get: function () { return auto_content_handler_1.generateDailyCartoon; } });
Object.defineProperty(exports, "checkSevereWeatherAlerts", { enumerable: true, get: function () { return auto_content_handler_1.checkSevereWeatherAlerts; } });
Object.defineProperty(exports, "cleanupOldNews", { enumerable: true, get: function () { return auto_content_handler_1.cleanupOldNews; } });
// 2. Export Reporter Functions
var reporter_handler_1 = require("./reporter_handler");
Object.defineProperty(exports, "processReporterSubmission", { enumerable: true, get: function () { return reporter_handler_1.processReporterSubmission; } });
Object.defineProperty(exports, "submitReporterApplication", { enumerable: true, get: function () { return reporter_handler_1.submitReporterApplication; } });
// 3. Export Main News Functions
var news_handler_1 = require("./news_handler");
Object.defineProperty(exports, "processNewsPost", { enumerable: true, get: function () { return news_handler_1.processNewsPost; } });
Object.defineProperty(exports, "onNewsPostCreated", { enumerable: true, get: function () { return news_handler_1.onNewsPostCreated; } });
// 4. Export Notification Engine
__exportStar(require("./notification_engine"), exports);
/**
 * Push Broadcast Function (Manual Push)
 */
exports.triggerPushBroadcast = (0, https_1.onCall)(async (request) => {
    const { title, body, actionUrl, topic, imageUrl, newsId, channelId, silent } = request.data;
    if (!title || !body)
        throw new https_1.HttpsError('invalid-argument', 'Title and Body are required.');
    const message = {
        notification: { title, body },
        android: {
            notification: {
                imageUrl: imageUrl || "",
                channelId: channelId || "general_news",
                priority: silent ? "low" : "high",
                defaultSound: !silent
            }
        },
        data: {
            actionUrl: actionUrl || "",
            newsId: newsId || "",
            channelId: channelId || "general_news",
            imageUrl: imageUrl || "",
            title: title,
            body: body
        },
        topic: topic || 'all_users'
    };
    try {
        const response = await admin.messaging().send(message);
        return { success: true, messageId: response };
    }
    catch (error) {
        throw new https_1.HttpsError('internal', error.message || 'Failed to send notification');
    }
});
exports.sendContactEmail = (0, https_1.onCall)({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const { name, phone, message } = request.data;
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
    await transporter.sendMail({ from: process.env.EMAIL_USER, to: 'alfanews0861@gmail.com', subject: `Contact: ${name}`, text: `Phone: ${phone}\n${message}` });
    return { success: true };
});
exports.shareNews = (0, https_1.onRequest)(async (req, res) => {
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
    }
    catch (e) {
        res.redirect(playUrl);
    }
});
// YouTube Auth Flow (Keep in index for simple management)
const { google } = require('googleapis');
exports.youtubeAuthStart = (0, https_1.onRequest)({ secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"] }, (req, res) => {
    const youtubeAuth = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, `https://${utils_1.REGION}-alfa-news-31bf7.cloudfunctions.net/youtubeAuthCallback`);
    res.redirect(youtubeAuth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: ['https://www.googleapis.com/auth/youtube.upload'] }));
});
exports.youtubeAuthCallback = (0, https_1.onRequest)({ secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"] }, async (req, res) => {
    const { code } = req.query;
    if (!code) {
        res.status(400).send("Code missing.");
        return;
    }
    const youtubeAuth = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, `https://${utils_1.REGION}-alfa-news-31bf7.cloudfunctions.net/youtubeAuthCallback`);
    try {
        const { tokens } = await youtubeAuth.getToken(code);
        if (tokens.refresh_token) {
            await db.collection('settings').doc('youtube').set({ refreshToken: tokens.refresh_token, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            res.status(200).send("<h1>Success! ✅</h1><p>Refresh Token Saved.</p>");
        }
        else {
            res.status(400).send("No refresh token received.");
        }
    }
    catch (e) {
        res.status(500).send(`Error: ${e.message}`);
    }
});
//# sourceMappingURL=index.js.map