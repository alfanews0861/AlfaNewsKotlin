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
exports.onNewsPostApproved = exports.submitReporterApplication = exports.processReporterSubmission = exports.onNewsViewCountUpdated = exports.backfillReporterPoints = void 0;
exports.notifyReporter = notifyReporter;
exports.awardPointsToReporter = awardPointsToReporter;
exports.getAssignedReporter = getAssignedReporter;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const utils_1 = require("./utils");
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
 * Award points to reporter and update badges
 */
async function awardPointsToReporter(reporterId, points) {
    try {
        if (!reporterId || reporterId.startsWith('BOT_') || reporterId.startsWith('SYSTEM_')) {
            console.log(`[POINTS_SKIP] Skipping points for system account: ${reporterId}`);
            return;
        }
        const userRef = db.collection('users').doc(reporterId);
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);
            if (!doc.exists)
                return;
            const data = doc.data();
            const currentPoints = (data.points || 0) + points;
            // Calculate badges
            const badges = [];
            if (currentPoints >= 100)
                badges.push("BRONZE");
            if (currentPoints >= 500)
                badges.push("SILVER");
            if (currentPoints >= 2000)
                badges.push("GOLD");
            if (currentPoints >= 10000)
                badges.push("DIAMOND");
            transaction.update(userRef, {
                points: currentPoints,
                badges: badges
            });
            // --- MONTHLY LEADERBOARD TRACKING ---
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const monthlyId = `${year}_${month}`;
            const monthlyRef = db.collection('monthly_leaderboard').doc(monthlyId)
                .collection('reporters').doc(reporterId);
            const monthlyDoc = await transaction.get(monthlyRef);
            if (monthlyDoc.exists) {
                transaction.update(monthlyRef, {
                    points: admin.firestore.FieldValue.increment(points),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            else {
                transaction.set(monthlyRef, {
                    userId: reporterId,
                    name: data.name || "Reporter",
                    photoUrl: data.photoUrl || "",
                    district: data.district || "",
                    assignedMandal: data.assignedMandal || "",
                    points: points,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            // ------------------------------------
        });
        console.log(`[POINTS] Awarded ${points} points to ${reporterId}`);
    }
    catch (e) {
        console.error(`[POINTS_ERR] Error:`, e.message);
    }
}
/**
 * Backfill points for all reporters based on their existing news posts
 */
exports.backfillReporterPoints = (0, https_1.onCall)(async (request) => {
    // Only admins can trigger backfill
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }
    const adminDoc = await db.collection('users').doc(auth.uid).get();
    if (adminDoc.data()?.role !== 'ADMIN') {
        throw new https_1.HttpsError('permission-denied', 'అడ్మిన్లకు మాత్రమే ఈ అనుమతి ఉంది.');
    }
    console.log(`[BACKFILL] Starting points backfill...`);
    const reportersSnapshot = await db.collection('users').where('role', '==', 'REPORTER').get();
    const results = [];
    for (const reporterDoc of reportersSnapshot.docs) {
        const reporterId = reporterDoc.id;
        // Fetch all approved news for this reporter
        const newsSnapshot = await db.collection('news')
            .where('reporter.id', '==', reporterId)
            .where('approved', '==', true)
            .get();
        let totalPoints = 0;
        newsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const mediaType = data.mediaType?.toUpperCase() || "";
            const mediaTypes = (data.mediaTypes || []).map((t) => t.toUpperCase());
            const isVideo = mediaType === 'VIDEO' || mediaTypes.includes('VIDEO');
            totalPoints += isVideo ? 20 : 10;
            // Reward for views (Legacy posts)
            const longViews = data.longViews || 0;
            const viewMilestones = Math.floor(longViews / 500);
            totalPoints += (viewMilestones * 50);
        });
        // Calculate badges
        const badges = [];
        if (totalPoints >= 100)
            badges.push("BRONZE");
        if (totalPoints >= 500)
            badges.push("SILVER");
        if (totalPoints >= 2000)
            badges.push("GOLD");
        if (totalPoints >= 10000)
            badges.push("DIAMOND");
        // Update reporter doc
        await db.collection('users').doc(reporterId).update({
            points: totalPoints,
            badges: badges,
            lastPostTimestamp: newsSnapshot.empty ? null : newsSnapshot.docs[0].data().timestamp
        });
        results.push({
            name: reporterDoc.data()?.name || reporterId,
            points: totalPoints,
            posts: newsSnapshot.size
        });
    }
    console.log(`[BACKFILL] Completed. Processed ${results.length} reporters.`);
    return { success: true, processed: results.length, details: results };
});
/**
 * Award points for view milestones
 * Triggered when longViews is updated
 */
exports.onNewsViewCountUpdated = (0, firestore_1.onDocumentWritten)({
    document: "news/{postId}",
    region: utils_1.REGION,
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after || !after.isReporter)
        return;
    const viewsBefore = before?.longViews || 0;
    const viewsAfter = after.longViews || 0;
    const reporterId = after.reporter?.id;
    if (!reporterId)
        return;
    // Award 50 points for every 500 views
    const milestoneSize = 500;
    const pointsPerMilestone = 50;
    const milestonesBefore = Math.floor(viewsBefore / milestoneSize);
    const milestonesAfter = Math.floor(viewsAfter / milestoneSize);
    if (milestonesAfter > milestonesBefore) {
        const newMilestones = milestonesAfter - milestonesBefore;
        const totalPointsToAdd = newMilestones * pointsPerMilestone;
        console.log(`[MILESTONE] News ${event.params.postId} reached ${viewsAfter} views. Awarding ${totalPointsToAdd} points to ${reporterId}`);
        await awardPointsToReporter(reporterId, totalPointsToAdd);
    }
});
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
    const { district, mandal } = data;
    if (!district || !mandal) {
        throw new https_1.HttpsError('invalid-argument', 'జిల్లా మరియు మండలం తప్పనిసరి.');
    }
    // Check if reporter already exists for this mandal
    const existingReporters = await db.collection('users')
        .where('role', '==', 'REPORTER')
        .where('district', '==', district)
        .where('assignedMandal', '==', mandal)
        .limit(1)
        .get();
    if (!existingReporters.empty) {
        throw new https_1.HttpsError('already-exists', 'ఈ మండలానికి ఇప్పటికే రిపోర్టర్ కేటాయించబడ్డారు.');
    }
    await db.collection('reporter_applications').add({
        ...data,
        status: "PENDING",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});
/**
 * Update reporter's last post timestamp when a post is approved
 */
exports.onNewsPostApproved = (0, firestore_1.onDocumentWritten)({
    document: "news/{postId}",
    region: utils_1.REGION,
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    // Trigger only if status changes to published or approved becomes true
    if (after && after.approved === true && before?.approved !== true) {
        const reporterId = after.reporter?.id;
        if (!reporterId || reporterId.startsWith('BOT_') || reporterId.startsWith('SYSTEM_'))
            return;
        console.log(`[POST_APPROVED] Updating lastPostTimestamp for reporter: ${reporterId}`);
        await db.collection('users').doc(reporterId).update({
            lastPostTimestamp: after.timestamp || admin.firestore.FieldValue.serverTimestamp()
        });
    }
});
/**
 * Helper: Find assigned reporter for a specific Mandalam in a District
 */
async function getAssignedReporter(district, mandalam) {
    try {
        if (!district || !mandalam)
            return null;
        const reporters = await db.collection('users')
            .where('role', '==', 'REPORTER')
            .where('district', '==', district)
            .where('assignedMandal', '==', mandalam)
            .limit(1)
            .get();
        if (reporters.empty)
            return null;
        const data = reporters.docs[0].data();
        return {
            id: reporters.docs[0].id,
            name: data.name || "Reporter"
        };
    }
    catch (e) {
        console.error(`[GET_ASSIGNED_REPORTER_ERR] ${district}/${mandalam}:`, e);
        return null;
    }
}
//# sourceMappingURL=reporter_handler.js.map