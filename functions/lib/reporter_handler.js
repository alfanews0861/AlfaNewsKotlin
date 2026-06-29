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
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitReporterApplication = exports.processReporterSubmission = void 0;
exports.notifyReporter = notifyReporter;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const db = admin.firestore();
/**
 * Helper: Notify reporter with human-friendly messages
 */
async function notifyReporter(reporterId, postId, headline, type, imageUrl) {
    try {
        const userDoc = await db.collection('users').doc(reporterId).get();
        if (!userDoc.exists)
            return;
        const userData = userDoc.data();
        if (userData && userData.notificationsEnabled === false)
            return;
        const tokens = [];
        if (userData?.fcmToken)
            tokens.push(userData.fcmToken);
        if (Array.isArray(userData?.fcmTokens)) {
            userData.fcmTokens.forEach((t) => {
                if (t && typeof t === 'string' && !tokens.includes(t))
                    tokens.push(t);
            });
        }
        if (tokens.length === 0)
            return;
        let title = "";
        let body = "";
        if (type === 'SUCCESS') {
            title = 'వార్త ప్రచురించబడింది! ✅';
            body = `మీ వార్త: "${headline.substring(0, 50)}..." విజయవంతంగా ప్రచురించబడింది.`;
        }
        else if (type === 'POLICY_VIOLATION') {
            title = 'వార్త తిరస్కరించబడింది! ⚠️';
            body = `మీ వార్తలోని అంశాలు మా నిబంధనలకు విరుద్ధంగా ఉన్నందున ప్రచురించబడలేదు.`;
        }
        else {
            title = 'వార్త ప్రచురణలో అంతరాయం! ❌';
            body = `సాంకేతిక కారణాల వల్ల మీ వార్త ప్రచురించబడలేదు. దయచేసి మళ్ళీ ప్రయత్నిచండి.`;
        }
        const message = {
            notification: { title, body },
            android: {
                notification: { imageUrl: imageUrl || "" }
            },
            data: {
                actionUrl: `alfanews://news/${postId}`,
                newsId: postId,
                type: `REPORTER_SUBMISSION_${type}`,
                title,
                body,
                imageUrl: imageUrl || ""
            }
        };
        const sendPromises = tokens.map(token => admin.messaging().send({ ...message, token }).catch(async (err) => {
            if (err.code === 'messaging/registration-token-not-registered' ||
                err.code === 'messaging/invalid-registration-token') {
                const updates = {};
                if (userData?.fcmToken === token)
                    updates.fcmToken = admin.firestore.FieldValue.delete();
                updates.fcmTokens = admin.firestore.FieldValue.arrayRemove(token);
                await db.collection('users').doc(reporterId).update(updates).catch(() => { });
            }
        }));
        await Promise.all(sendPromises);
    }
    catch (e) {
        console.error(`[NOTIFY] Error:`, e.message);
    }
}
/**
 * 6.1 Process Reporter Submission
 */
exports.processReporterSubmission = (0, https_1.onCall)(async (request) => {
    const { postId, headline: rawHeadline, content: rawContent, postData } = request.data;
    try {
        console.log(`[REPORTER_SUBMISSION] Quick acceptance for post: ${postId || 'new'}`);
        const headline = rawHeadline || postData?.headline?.telugu || "";
        const content = rawContent || postData?.content?.telugu || "";
        if (!headline || !content) {
            throw new https_1.HttpsError('invalid-argument', 'వార్త శీర్షిక మరియు వివరణ తప్పనిసరి.');
        }
        const mediaUrl = postData?.mediaUrl || "";
        const mediaUrls = postData?.mediaUrls || (mediaUrl ? [mediaUrl] : []);
        const finalData = {
            ...postData,
            headline: {
                telugu: headline,
                english: postData?.headline?.english || ""
            },
            content: {
                telugu: content,
                english: postData?.content?.english || ""
            },
            mediaUrl: mediaUrl,
            mediaUrls: mediaUrls,
            isReporter: true,
            isCitizen: false,
            aiProcessed: false,
            videoProcessed: false, // Explicit false so trigger guard detects changes reliably
            approved: false,
            status: "PENDING",
            processingType: "REPORTER_SUBMISSION",
            timestamp: postData?.timestamp || admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };
        if (postId) {
            await db.collection('news').doc(postId).update(finalData);
            return { success: true, postId: postId, message: "వార్త అప్‌డేట్ అవుతోంది (నేపథ్యంలో)..." };
        }
        else {
            const newDocRef = await db.collection('news').add(finalData);
            return { success: true, postId: newDocRef.id, message: "వార్త ప్రచురించబడుతోంది (నేపథ్యంలో)..." };
        }
    }
    catch (e) {
        console.error(`[REPORTER_SUBMISSION] Critical Error:`, e.message);
        throw new https_1.HttpsError('internal', e.message);
    }
});
exports.submitReporterApplication = (0, https_1.onCall)({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const data = request.data;
    await db.collection('reporter_applications').add({
        ...data,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});
//# sourceMappingURL=reporter_handler.js.map