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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAppInstallReferral = exports.onAnonymousDeviceCreated = exports.onUserCreated = exports.getAssignedReporter = exports.verifyReporter = exports.runReactivateDemotedReportersHttp = exports.reactivateFalselyDemotedReporters = exports.executeReactivateFalselyDemotedReporters = exports.onUserRoleChanged = exports.onNewsPostApproved = exports.runAutoApprovePendingBackfill = exports.autoApproveAllPendingApplications = exports.onReporterApplicationCreated = exports.submitReporterApplication = exports.sendReporterApplicationEmail = exports.promoteUserToReporter = exports.notifyApplicantOfConflict = exports.isMandalVacant = exports.checkMandalVacancy = exports.processReporterSubmission = exports.onNewsViewCountUpdated = exports.backfillReporterPoints = exports.awardPointsToReporter = exports.notifyReporter = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const nodemailer = __importStar(require("nodemailer"));
const utils_1 = require("./utils");
const location_data_1 = require("./location_data");
const db = admin.firestore();
const MILESTONE_SIZE = 500;
const POINTS_PER_MILESTONE = 50;
// ==========================================
// WELCOME NOTIFICATION MESSAGES
// App download చేసిన వెంటనే పంపాలి
// ==========================================
const WELCOME_MESSAGES = [
    { title: 'అల్ఫా న్యూస్‌కు సుస్వాగతం! 🌟', body: 'తెలుగు వార్తలు చదవడానికి స్వాగతం! తాజా వార్తలు మీ వార్తలు — అన్నీ ఒకేచోట చదవండి.' },
    { title: 'నమస్కారం! Alfa News లోకి క్రోస్ చేసినందుకు ధన్యవాదాలు 🙏', body: 'మీ జిల్లా వార్తలు, చుట్టుప్రక్కల వార్తలు — అన్నీ ఇక్కడే చదవండి!' },
    { title: 'Alfa News లో స్వాగతం! 📰', body: 'తెలంగాణ, ఆంధ్రప్రదేశ్ వార్తలు వేగంగా, నిజాయితిగా — మీకు ందిస్తాం!' },
];
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
            const truncatedHeadline = headline.length > 50 ? headline.substring(0, 50) + "..." : headline;
            body = `మీ వార్త: "${truncatedHeadline}" విజయవంతంగా ప్రచురించబడింది.`;
        }
        else if (type === 'DUPLICATE') {
            title = 'వార్త తిరస్కరించబడింది (డూప్లికేట్)! ⚠️';
            const truncatedHeadline = headline.length > 40 ? headline.substring(0, 40) + "..." : headline;
            body = `"${truncatedHeadline}" - ఈ మండలంలో ఈ వార్త గత 6 గంటల్లో ఇప్పటికే ప్రచురించబడింది.`;
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
exports.notifyReporter = notifyReporter;
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
            // --- MONTHLY LEADERBOARD TRACKING ---
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const monthlyId = `${year}_${month}`;
            const monthlyRef = db.collection('monthly_leaderboard').doc(monthlyId)
                .collection('reporters').doc(reporterId);
            const monthlyDoc = await transaction.get(monthlyRef);
            // ------------------------------------
            const data = doc.exists ? doc.data() : {};
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
            transaction.set(userRef, {
                points: currentPoints,
                badges: badges,
                lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
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
        });
        console.log(`[POINTS] Awarded ${points} points to ${reporterId}`);
    }
    catch (e) {
        console.error(`[POINTS_ERR] Error:`, e.message);
    }
}
exports.awardPointsToReporter = awardPointsToReporter;
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
        const reporterData = reporterDoc.data();
        // Fetch all approved news for this reporter
        const newsSnapshot = await db.collection('news')
            .where('reporter.id', '==', reporterId)
            .where('approved', '==', true)
            .get();
        let totalPoints = 0;
        const monthlyPointsMap = {};
        newsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const mediaType = data.mediaType?.toUpperCase() || "";
            const mediaTypes = (data.mediaTypes || []).map((t) => t.toUpperCase());
            const isVideo = mediaType === 'VIDEO' || mediaTypes.includes('VIDEO');
            const postPoints = isVideo ? 20 : 10;
            totalPoints += postPoints;
            // Calculate monthly points
            const ts = data.timestamp;
            let date;
            if (ts && typeof ts.toDate === 'function') {
                date = ts.toDate();
            }
            else if (ts && ts._seconds) {
                date = new Date(ts._seconds * 1000);
            }
            else {
                date = new Date();
            }
            const monthId = `${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            monthlyPointsMap[monthId] = (monthlyPointsMap[monthId] || 0) + postPoints;
            // Reward for views (Legacy posts)
            const longViews = data.longViews || 0;
            const viewMilestones = Math.floor(longViews / MILESTONE_SIZE);
            const viewPoints = (viewMilestones * POINTS_PER_MILESTONE);
            totalPoints += viewPoints;
            // Note: View points are typically awarded at the time of milestone,
            // but for backfill we'll put them in the post's original month or current month.
            // Let's put them in the post's original month for historical accuracy.
            monthlyPointsMap[monthId] = (monthlyPointsMap[monthId] || 0) + viewPoints;
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
        // Update reporter doc (Global points)
        await db.collection('users').doc(reporterId).update({
            points: totalPoints,
            badges: badges,
            lastPostTimestamp: newsSnapshot.empty ? null : newsSnapshot.docs[0].data().timestamp
        });
        // Update Monthly Leaderboards
        for (const [monthId, points] of Object.entries(monthlyPointsMap)) {
            const monthlyRef = db.collection('monthly_leaderboard').doc(monthId)
                .collection('reporters').doc(reporterId);
            await monthlyRef.set({
                userId: reporterId,
                name: reporterData.name || "Reporter",
                photoUrl: reporterData.photoUrl || "",
                district: reporterData.district || "",
                assignedMandal: reporterData.assignedMandal || "",
                points: points,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
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
    // ✅ Quick guard: exit if longViews hasn't increased (saves execution time)
    if (viewsAfter <= viewsBefore)
        return;
    const reporterId = after.reporter?.id || (typeof after.reporter === 'string' ? after.reporter : null);
    if (!reporterId || reporterId.startsWith('BOT_') || reporterId.startsWith('SYSTEM_'))
        return;
    // Award points for milestones
    const milestonesBefore = Math.floor(viewsBefore / MILESTONE_SIZE);
    const milestonesAfter = Math.floor(viewsAfter / MILESTONE_SIZE);
    if (milestonesAfter > milestonesBefore) {
        const newMilestones = milestonesAfter - milestonesBefore;
        const totalPointsToAdd = newMilestones * POINTS_PER_MILESTONE;
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
        const reporterId = request.auth?.uid || (typeof postData?.reporter === 'string' ? postData.reporter : postData?.reporter?.id);
        if (reporterId && !reporterId.startsWith('BOT_') && !reporterId.startsWith('SYSTEM_')) {
            await db.collection('users').doc(reporterId).set({
                lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
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
/**
 * Helper: Check if a mandal currently has an active REPORTER in the users collection.
 */
async function checkMandalVacancy(district, mandal, excludeUserId) {
    const trimmedDistrict = district.trim();
    const trimmedMandal = mandal.trim();
    if (!trimmedDistrict || !trimmedMandal)
        return { vacant: false };
    // Check users collection for active reporter
    const reporterQuery = await db.collection('users')
        .where('role', 'in', ['REPORTER', 2, 2.0, '2'])
        .where('district', '==', trimmedDistrict)
        .where('assignedMandal', '==', trimmedMandal)
        .limit(2)
        .get();
    if (!reporterQuery.empty) {
        const activeReporters = reporterQuery.docs.filter(doc => doc.id !== excludeUserId);
        if (activeReporters.length > 0) {
            const repData = activeReporters[0].data();
            return {
                vacant: false,
                existingReporter: {
                    id: activeReporters[0].id,
                    name: repData.name || "Reporter",
                    phone: repData.phone || "",
                    district: repData.district || trimmedDistrict,
                    mandal: repData.assignedMandal || repData.mandal || trimmedMandal
                }
            };
        }
    }
    // Secondary check: in case assignedMandal wasn't set but mandal was set
    const mandalQuery = await db.collection('users')
        .where('role', 'in', ['REPORTER', 2, 2.0, '2'])
        .where('district', '==', trimmedDistrict)
        .where('mandal', '==', trimmedMandal)
        .limit(2)
        .get();
    if (!mandalQuery.empty) {
        const activeReporters = mandalQuery.docs.filter(doc => doc.id !== excludeUserId);
        if (activeReporters.length > 0) {
            const repData = activeReporters[0].data();
            return {
                vacant: false,
                existingReporter: {
                    id: activeReporters[0].id,
                    name: repData.name || "Reporter",
                    phone: repData.phone || "",
                    district: repData.district || trimmedDistrict,
                    mandal: repData.assignedMandal || repData.mandal || trimmedMandal
                }
            };
        }
    }
    return { vacant: true };
}
exports.checkMandalVacancy = checkMandalVacancy;
async function isMandalVacant(district, mandal, excludeUserId) {
    const res = await checkMandalVacancy(district, mandal, excludeUserId);
    return res.vacant;
}
exports.isMandalVacant = isMandalVacant;
/**
 * Helper: Notify an applicant when their desired mandal is occupied, letting them know
 * their application is forwarded to Admin for competition / probation review.
 */
async function notifyApplicantOfConflict(userId, applicantName, district, mandal, existingReporterName) {
    if (!userId)
        return;
    try {
        const conflictText = `నమస్కారం ${applicantName || 'మిత్రమా'}, మీరు కోరిన ${mandal} మండలానికి ఇప్పటికే క్రియాశీల విలేకరి (${existingReporterName || 'ఇతరులు'}) ఉన్నారు.\n\nఅందువల్ల మీ దరఖాస్తు అడ్మిన్ ప్రత్యేక పరిశీలనకు (పోటీ / ప్రొబేషన్) పంపబడింది. మా అడ్మిన్ టీమ్ పరిశీలించి త్వరలోనే మిమ్మల్ని సంప్రదిస్తారు. మీకు ఏవైనా సందేహాలున్నా లేదా మీ వివరాలు తెలియజేయాలన్నా ఇక్కడే అడ్మిన్‌కు నేరుగా మెసేజ్ / రిప్లై ఇవ్వవచ్చు. ధన్యవాదాలు!`;
        const msgTimestamp = admin.firestore.FieldValue.serverTimestamp();
        // 1. Add to 2-way reporter conversation for chat
        await db.collection('reporter_conversations').doc(userId).collection('messages').add({
            senderId: "SYSTEM_ADMIN",
            senderName: "AlfaNews Editorial Desk",
            senderRole: "ADMIN",
            text: conflictText,
            type: "NOTICE",
            read: false,
            timestamp: msgTimestamp
        });
        await db.collection('reporter_conversations').doc(userId).set({
            reporterId: userId,
            reporterName: applicantName || "Applicant",
            reporterDistrict: district,
            reporterMandal: mandal,
            lastMessage: conflictText,
            lastMessageTime: msgTimestamp,
            lastSenderRole: "ADMIN",
            lastSenderId: "SYSTEM_ADMIN",
            unreadCountForReporter: 1,
            updatedAt: msgTimestamp
        }, { merge: true });
        // 2. Add to user's general in-app messages list
        await db.collection('users').doc(userId).collection('messages').add({
            title: "మీ దరఖాస్తు పరిశీలనలో ఉంది ⏳",
            body: conflictText,
            senderName: "AlfaNews Editorial Desk",
            senderRole: "ADMIN",
            read: false,
            importance: "HIGH",
            type: "REPORTER_APP_PENDING",
            timestamp: msgTimestamp
        });
        // 3. Send FCM push notification
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data() || {};
        const tokens = [...(userData.fcmTokens || []), userData.fcmToken].filter((t) => typeof t === 'string' && t.trim().length > 0);
        if (tokens.length > 0) {
            const push = tokens.map(token => ({
                token,
                notification: {
                    title: "మీ దరఖాస్తు పరిశీలనలో ఉంది ⏳",
                    body: `${mandal} మండలానికి ఇప్పటికే విలేకరి ఉన్నందున మీ దరఖాస్తు అడ్మిన్ పరిశీలనకు పంపబడింది. వివరాలకు అడ్మిన్ డెస్క్ సందేశాన్ని చూడండి.`
                },
                data: {
                    type: "REPORTER_APP_PENDING",
                    district: district,
                    mandal: mandal
                }
            }));
            await admin.messaging().sendEach(push).catch(() => { });
        }
        console.log(`[CONFLICT_NOTIF] 📩 Sent conflict notice to applicant ${userId} for ${mandal}`);
    }
    catch (e) {
        console.error("[CONFLICT_NOTIF] Failed to send conflict notification:", e.message);
    }
}
exports.notifyApplicantOfConflict = notifyApplicantOfConflict;
/**
 * Helper: Promote user to REPORTER, initialize conversation, send welcome push and desk message.
 */
async function promoteUserToReporter(userId, fullName, phone, district, mandal, promoter = "AUTO_APPROVAL_SYSTEM", options) {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const existingData = userDoc.exists ? (userDoc.data() || {}) : {};
    const isChallenger = options?.isChallenger === true;
    const inProbation = options?.inProbation === true || isChallenger;
    await userRef.set({
        role: "REPORTER",
        district: district,
        assignedMandal: mandal,
        mandal: mandal,
        promotedBy: promoter,
        agreedToRules: true,
        previouslyDowngraded: false,
        suspended: false,
        warningLevel: 0,
        inProbation: inProbation,
        isChallenger: isChallenger,
        downgradedReason: admin.firestore.FieldValue.delete(),
        downgradedAt: admin.firestore.FieldValue.delete(),
        lastWarningDate: admin.firestore.FieldValue.delete(),
        probationStartDate: inProbation ? admin.firestore.FieldValue.serverTimestamp() : null,
        promotedAt: admin.firestore.FieldValue.serverTimestamp(),
        rejoinedAt: admin.firestore.FieldValue.serverTimestamp(),
        joinedAt: existingData.joinedAt || admin.firestore.FieldValue.serverTimestamp(),
        lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        name: fullName || existingData.name || "",
        phone: phone || existingData.phone || "",
        points: existingData.points ?? 0,
        badges: existingData.badges ?? []
    }, { merge: true });
    console.log(`[REPORTER_PROMOTION] 👑 Promoted user ${userId} to REPORTER for ${district} - ${mandal} (Challenger: ${isChallenger})`);
    // Send In-App Welcome Desk Message & Push to the newly joined reporter
    try {
        const welcomeText = isChallenger
            ? `నమస్కారం ${fullName || 'మిత్రమా'}, ఆల్ఫా న్యూస్ విలేకరి బృందానికి స్వాగతం! 🎉\n\nమీరు ${mandal} మండలానికి ప్రొబేషనరీ (పోటీ) విలేకరిగా ఆమోదించబడ్డారు. నెల రోజుల పాటు మీ పనితీరు ఆధారంగా పర్మనెంట్ విలేకరిని నిర్ణయిస్తారు. మీ మండల తాజా వార్తలను ప్రతిరోజూ చురుగ్గా పోస్ట్ చేయండి. శుభాకాంక్షలు!`
            : `నమస్కారం ${fullName || 'మిత్రమా'}, ఆల్ఫా న్యూస్ విలేకరి బృందానికి మీకు హృదయపూర్వక స్వాగతం! 🎉\n\nమీరు ${mandal} మండల విలేకరిగా నియమించబడ్డారు. మీ మండల తాజా వార్తలను ప్రతిరోజూ కనీసం ఒకటైనా యాప్‌లో పోస్ట్ చేయండి. ఏదైనా సహాయం లేదా సందేహాలు ఉంటే ఇక్కడ నేరుగా మాకు మెసేజ్ చేయవచ్చు. శుభాకాంక్షలు!`;
        const msgTimestamp = admin.firestore.FieldValue.serverTimestamp();
        await db.collection('reporter_conversations').doc(userId).collection('messages').add({
            senderId: "SYSTEM_ADMIN",
            senderName: "AlfaNews Editorial Desk",
            senderRole: "ADMIN",
            text: welcomeText,
            type: "NOTICE",
            read: false,
            timestamp: msgTimestamp
        });
        await db.collection('reporter_conversations').doc(userId).set({
            reporterId: userId,
            reporterName: fullName || existingData.name || "Reporter",
            reporterPhone: phone || existingData.phone || "",
            reporterDistrict: district,
            reporterMandal: mandal,
            lastMessage: welcomeText,
            lastMessageTime: msgTimestamp,
            lastSenderRole: "ADMIN",
            lastSenderId: "SYSTEM_ADMIN",
            unreadCountForReporter: 1,
            updatedAt: msgTimestamp
        }, { merge: true });
        // Push Notification to new reporter
        const userTokens = [...(existingData.fcmTokens || []), existingData.fcmToken].filter((t) => typeof t === 'string' && t.trim().length > 0);
        if (userTokens.length > 0) {
            const pushMessages = userTokens.map(token => ({
                token,
                notification: {
                    title: isChallenger ? "ప్రొబేషనరీ విలేకరిగా ఆమోదించబడ్డారు! 🌟" : "ఆల్ఫా న్యూస్ విలేకరి బృందానికి స్వాగతం! 🎉",
                    body: isChallenger
                        ? `మీరు ${mandal} మండలానికి ప్రొబేషనరీ విలేకరిగా చేరారు. నేటి నుంచే వార్తలు పోస్ట్ చేయండి!`
                        : `మీరు ${mandal} మండల విలేకరిగా ఆమోదించబడ్డారు. నేటి నుంచే వార్తలను పోస్ట్ చేయడం ప్రారంభించండి!`
                },
                data: {
                    type: "REPORTER_WELCOME",
                    mandal: mandal,
                    district: district
                }
            }));
            await admin.messaging().sendEach(pushMessages).catch(() => { });
        }
        // If challenger, also send notice to existing reporter
        if (isChallenger && options?.existingReporterId) {
            const existingRepDoc = await db.collection('users').doc(options.existingReporterId).get();
            const existingRepData = existingRepDoc.data() || {};
            const existingTokens = [...(existingRepData.fcmTokens || []), existingRepData.fcmToken].filter((t) => typeof t === 'string' && t.trim().length > 0);
            if (existingTokens.length > 0) {
                const repPush = existingTokens.map(token => ({
                    token,
                    notification: {
                        title: `మీ మండలానికి మరొక విలేకరి తోడయ్యారు! 📰`,
                        body: `${mandal} మండలానికి కొత్త విలేకరి చేరారు. ప్రతిరోజూ చురుగ్గా వార్తలు పోస్ట్ చేస్తూ మీ అగ్రస్థానాన్ని కాపాడుకోండి!`
                    },
                    data: {
                        type: "CO_REPORTER_JOINED",
                        mandal: mandal,
                        district: district
                    }
                }));
                await admin.messaging().sendEach(repPush).catch(() => { });
            }
        }
    }
    catch (msgErr) {
        console.error("[REPORTER_PROMOTION] Failed to send welcome message/push to reporter:", msgErr.message);
    }
}
exports.promoteUserToReporter = promoteUserToReporter;
/**
 * Helper: Send notification email to admin when a reporter application is submitted/approved.
 */
async function sendReporterApplicationEmail(data, shouldAutoApprove, isPreviouslyDowngraded, finalStatus, conflictInfo) {
    const { fullName, fatherName, phone, address, position, interestedArea, education, currentOrg, state, district, mandal, message, userId } = data;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    if (!emailUser || !emailPass) {
        console.log("[REPORTER_APP_EMAIL] ℹ️ EMAIL_USER or EMAIL_PASS not configured in environment. Skipping email dispatch.");
        return;
    }
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });
    const isConflict = conflictInfo?.isConflict === true;
    const existingRepName = conflictInfo?.existingReporterName || "Active Reporter";
    const existingRepPhone = conflictInfo?.existingReporterPhone || "";
    const emailContent = `
        ${shouldAutoApprove ? '[AUTO-APPROVED - ఆటోమేటిక్ అప్రూవ్ అయింది]' : isConflict ? '[పోటీ దరఖాస్తు / అడ్మిన్ పరిశీలన]' : 'New Reporter Application:'}
        -------------------------
        Status: ${finalStatus}
        Full Name: ${fullName || 'N/A'}
        Father's Name: ${fatherName || 'N/A'}
        Phone Number: ${phone || 'N/A'}
        Address: ${address || 'N/A'}
        Position: ${position || 'N/A'}
        Interested Area: ${interestedArea || 'N/A'}
        Educational Qualification: ${education || 'N/A'}
        Currently Working Organization: ${currentOrg || 'N/A'}
        State: ${state || 'N/A'}
        District: ${district || 'N/A'}
        Mandal: ${mandal || 'N/A'}
        Message: ${message || 'N/A'}
        User ID: ${userId || 'N/A'}
        ${isConflict ? `Existing Reporter: ${existingRepName} (${existingRepPhone})` : ''}
    `;
    const htmlEmail = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; margin: 0 auto;">
            <div style="background-color: ${shouldAutoApprove ? '#2e7d32' : isConflict ? '#e65100' : '#d32f2f'}; color: white; padding: 16px; text-align: center; font-size: 20px; font-weight: bold;">
                Alfa News - ${shouldAutoApprove ? 'కొత్త రిపోర్టర్ చేరారు (Auto-Approved)' : isConflict ? 'పోటీ దరఖాస్తు (అడ్మిన్ పరిశీలన)' : 'కొత్త రిపోర్టర్ దరఖాస్తు'}
            </div>
            <div style="padding: 20px;">
                ${isPreviouslyDowngraded
        ? '<div style="background-color: #fff3e0; border: 1px solid #ff9800; color: #e65100; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-weight: bold; text-align: center;">⚠️ గమనిక: ఈ అభ్యర్థి గతంలో విలేకరిగా ఉండి నిష్క్రియాత్మకత వల్ల తొలగించబడిన రికార్డు ఉంది. అందువల్ల ఆటో-అప్రూవల్ చేయబడలేదు, మీ పరిశీలన (PENDING) కోసం ఉంచబడింది.</div>'
        : isConflict
            ? `<div style="background-color: #fff3e0; border: 1px solid #ff9800; color: #e65100; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-weight: bold; text-align: center;">⚠️ గమనిక: ${mandal} మండలానికి ఇప్పటికే క్రియాశీల విలేకరి (${existingRepName} - ${existingRepPhone}) ఉన్నారు. ఈ అభ్యర్థిని ప్రొబేషన్ / పోటీదారుగా ఆమోదించవచ్చు లేదా వేరే మండలాన్ని కేటాయించవచ్చు.</div>`
            : shouldAutoApprove
                ? '<div style="background-color: #e8f5e9; border: 1px solid #4caf50; color: #2e7d32; padding: 12px; border-radius: 6px; margin-bottom: 16px; font-weight: bold; text-align: center;">✅ ఈ విలేకరి మండలానికి ఎవరూ లేనందున ఆటోమేటిక్‌గా అప్రూవ్ చేయబడ్డారు (Auto-Approved).</div>'
                : ''}
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr><td style="padding: 8px; font-weight: bold; width: 180px;">స్టేటస్ (Status):</td><td style="padding: 8px; font-weight: bold; color: ${shouldAutoApprove ? '#2e7d32' : '#f57c00'};">${finalStatus}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold; width: 180px;">పేరు (Full Name):</td><td style="padding: 8px;">${fullName || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">తండ్రి పేరు (Father's Name):</td><td style="padding: 8px;">${fatherName || 'N/A'}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">ఫోన్ నంబర్ (Phone):</td><td style="padding: 8px;">${phone || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">చిరునామా (Address):</td><td style="padding: 8px;">${address || 'N/A'}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">రాష్ట్రం (State):</td><td style="padding: 8px;">${state || 'N/A'}</td></tr>
                    <tr style="background-color: #ffebee;"><td style="padding: 8px; font-weight: bold; color: #d32f2f;">జిల్లా (District):</td><td style="padding: 8px; font-weight: bold; color: #d32f2f; font-size: 16px;">${district || 'N/A'}</td></tr>
                    <tr style="background-color: #ffebee;"><td style="padding: 8px; font-weight: bold; color: #d32f2f;">మండలం (Mandal):</td><td style="padding: 8px; font-weight: bold; color: #d32f2f; font-size: 16px;">${mandal || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">కోరిన పదవి (Position):</td><td style="padding: 8px;">${position || 'N/A'}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">ఆసక్తి ఉన్న విభాగం:</td><td style="padding: 8px;">${interestedArea || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">విద్యార్హత (Education):</td><td style="padding: 8px;">${education || 'N/A'}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">ప్రస్తుత సంస్థ:</td><td style="padding: 8px;">${currentOrg || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">సందేశం (Message):</td><td style="padding: 8px;">${message || 'N/A'}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">User ID:</td><td style="padding: 8px;">${userId || 'N/A'}</td></tr>
                </table>
            </div>
        </div>
    `;
    const emailSubject = isPreviouslyDowngraded
        ? `[గతంలో తొలగించబడిన విలేకరి మళ్లీ దరఖాస్తు] ${fullName || 'N/A'} (${district} - ${mandal})`
        : isConflict
            ? `[పోటీ దరఖాస్తు / అడ్మిన్ పరిశీలన] ${fullName || 'N/A'} (${district} - ${mandal})`
            : shouldAutoApprove
                ? `[ఆటో-అప్రూవ్ అయింది] కొత్త రిపోర్టర్ చేరారు: ${fullName || 'N/A'} (${district} - ${mandal})`
                : `రిపోర్టర్ దరఖాస్తు: ${fullName || 'N/A'} (${district} - ${mandal})`;
    try {
        console.log(`[REPORTER_APP] 📧 Sending email to alfanews0861@gmail.com (Subject: ${emailSubject})`);
        await transporter.sendMail({
            from: `"Alfa News Applications" <${emailUser}>`,
            to: 'alfanews0861@gmail.com',
            subject: emailSubject,
            text: emailContent,
            html: htmlEmail
        });
        console.log(`[REPORTER_APP] ✉️ Email sent successfully to admin!`);
    }
    catch (error) {
        console.error("[REPORTER_APP] ❌ Email send failed during application submission:", error.message);
    }
}
exports.sendReporterApplicationEmail = sendReporterApplicationEmail;
exports.submitReporterApplication = (0, https_1.onCall)({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const data = request.data;
    let { fullName, fatherName, phone, address, position, interestedArea, education, currentOrg, state, district, mandal, message, userId } = data;
    let rawDistrict = district || data.assignedDistrict || data.selectedDistrict || data.state_district || "";
    let rawMandal = mandal || data.assignedMandal || data.selectedMandal || data.mandalam || "";
    let trimmedDistrict = String(rawDistrict || "").trim();
    let trimmedMandal = String(rawMandal || "").trim();
    const rawPhone = String(phone || data.phoneNumber || "").trim();
    const clean10 = rawPhone.replace(/\D/g, '').slice(-10);
    // If userId or district/mandal is missing, look up user profile
    let existingUserData = {};
    if (userId) {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists)
            existingUserData = userDoc.data() || {};
    }
    else if (clean10.length === 10) {
        const phoneFormats = [`+91${clean10}`, clean10, `0${clean10}`, `91${clean10}`];
        for (const fmt of phoneFormats) {
            const uQuery = await db.collection('users').where('phone', '==', fmt).limit(1).get();
            if (!uQuery.empty) {
                const uDoc = uQuery.docs[0];
                userId = uDoc.id;
                existingUserData = uDoc.data() || {};
                break;
            }
        }
    }
    if (!trimmedDistrict && existingUserData.district) {
        trimmedDistrict = String(existingUserData.district).trim();
    }
    if (!trimmedMandal && (existingUserData.assignedMandal || existingUserData.mandal)) {
        trimmedMandal = String(existingUserData.assignedMandal || existingUserData.mandal).trim();
    }
    // Smart text extraction from address/interestedArea/profile if still missing
    if (!trimmedDistrict || !trimmedMandal) {
        const extracted = (0, location_data_1.extractDistrictAndMandal)(address, interestedArea, existingUserData.district, existingUserData.address);
        if (!trimmedDistrict)
            trimmedDistrict = extracted.district;
        if (!trimmedMandal)
            trimmedMandal = extracted.mandal;
    }
    if (!trimmedDistrict || !trimmedMandal) {
        throw new https_1.HttpsError('invalid-argument', 'జిల్లా మరియు మండలం తప్పనిసరి.');
    }
    console.log(`[REPORTER_APP] 📥 Processing application for ${fullName || 'N/A'} (District: ${trimmedDistrict}, Mandal: ${trimmedMandal}, UserId: ${userId || 'N/A'}, Phone: ${phone || 'N/A'})`);
    // 1. Check vacancy for mandal in users collection
    const vacancyResult = await checkMandalVacancy(trimmedDistrict, trimmedMandal, userId);
    const vacant = vacancyResult.vacant;
    const existingRep = vacancyResult.existingReporter;
    // 2. Check if THIS APPLICANT was previously removed / downgraded for inactivity or suspended
    let isPreviouslyDowngraded = false;
    if (existingUserData.previouslyDowngraded === true ||
        existingUserData.suspended === true ||
        existingUserData.downgradedReason === "INACTIVITY") {
        isPreviouslyDowngraded = true;
    }
    if (!isPreviouslyDowngraded && clean10.length === 10) {
        const prevAppSnap = await db.collection('reporter_applications')
            .where('phone', 'in', [`+91${clean10}`, clean10])
            .where('status', '==', 'SUSPENDED')
            .limit(1)
            .get();
        if (!prevAppSnap.empty) {
            isPreviouslyDowngraded = true;
        }
    }
    // Auto-approve IF user is not previously downgraded and mandal is vacant
    const shouldAutoApprove = Boolean(userId && !isPreviouslyDowngraded && vacant);
    const finalStatus = shouldAutoApprove ? "JOINED" : "PENDING";
    const isConflict = !vacant;
    console.log(`[REPORTER_APP] ⚖️ Decision: shouldAutoApprove=${shouldAutoApprove}, finalStatus=${finalStatus}, isPrevDowngraded=${isPreviouslyDowngraded}, isVacant=${vacant}, isConflict=${isConflict}`);
    // Save application to Firestore
    const newAppRef = await db.collection('reporter_applications').add({
        ...data,
        district: trimmedDistrict,
        mandal: trimmedMandal,
        userId: userId || data.userId || null,
        status: finalStatus,
        autoApproved: shouldAutoApprove,
        isConflict: isConflict,
        existingReporterName: existingRep?.name || null,
        existingReporterPhone: existingRep?.phone || null,
        existingReporterId: existingRep?.id || null,
        isReapplication: isPreviouslyDowngraded,
        previouslyDowngraded: isPreviouslyDowngraded,
        agreedToRules: true,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`[REPORTER_APP] 💾 Saved application document: ${newAppRef.id}`);
    // If auto-approved, promote user immediately
    if (shouldAutoApprove && userId) {
        try {
            const oldAppsQuery = await db.collection('reporter_applications')
                .where('userId', '==', userId)
                .where('status', '==', 'PENDING')
                .get();
            for (const doc of oldAppsQuery.docs) {
                if (doc.id !== newAppRef.id) {
                    await doc.ref.update({ status: 'JOINED', autoApproved: true, supersededBy: newAppRef.id });
                }
            }
            if (clean10.length === 10) {
                const oldPhoneQuery = await db.collection('reporter_applications')
                    .where('phone', '==', clean10)
                    .where('status', '==', 'PENDING')
                    .get();
                for (const doc of oldPhoneQuery.docs) {
                    if (doc.id !== newAppRef.id) {
                        await doc.ref.update({ status: 'JOINED', autoApproved: true, supersededBy: newAppRef.id });
                    }
                }
            }
        }
        catch (e) {
            console.error("[REPORTER_APP] Non-critical error updating previous applications:", e.message);
        }
        // Promote user role to REPORTER immediately
        await promoteUserToReporter(userId, fullName || existingUserData.name || "", phone || existingUserData.phone || "", trimmedDistrict, trimmedMandal, "AUTO_APPROVAL_SYSTEM");
    }
    else if (isConflict && userId) {
        // Notify applicant that mandal is occupied and application is forwarded for Admin competition review
        await notifyApplicantOfConflict(userId, fullName || existingUserData.name || "", trimmedDistrict, trimmedMandal, existingRep?.name || "విలేకరి");
    }
    // Send notification email to admin
    await sendReporterApplicationEmail({ ...data, district: trimmedDistrict, mandal: trimmedMandal, userId }, shouldAutoApprove, isPreviouslyDowngraded, finalStatus, { isConflict, existingReporterName: existingRep?.name, existingReporterPhone: existingRep?.phone });
    return {
        success: true,
        autoApproved: shouldAutoApprove,
        isPreviouslyDowngraded,
        isConflict,
        existingReporterName: existingRep?.name || null,
        status: finalStatus
    };
});
/**
 * Background Trigger: Auto-approve newly created reporter applications
 * Catches direct Firestore additions (from web, scripts, or client fallback)
 */
exports.onReporterApplicationCreated = (0, firestore_1.onDocumentCreated)({
    document: "reporter_applications/{appId}",
    region: utils_1.REGION,
    secrets: ["EMAIL_USER", "EMAIL_PASS"]
}, async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    const appId = event.params.appId;
    const applicantName = data.fullName || data.name || "No Name";
    const rawPhone = String(data.phone || data.phoneNumber || data.mobile || "").trim();
    const clean10 = rawPhone.replace(/\D/g, '').slice(-10);
    let district = String(data.district || data.selectedDistrict || data.assignedDistrict || data.state_district || data.stateDistrict || "").trim();
    let mandal = String(data.mandal || data.selectedMandal || data.assignedMandal || data.mandalam || "").trim();
    let userId = String(data.userId || data.uid || data.user_id || "").trim();
    let rawStatus = String(data.status || "").trim().toUpperCase();
    // 1. If userId is missing, search users collection by phone
    let userDocData = null;
    if (!userId && clean10.length === 10) {
        const phoneFormats = [`+91${clean10}`, clean10, `0${clean10}`, `91${clean10}`];
        for (const fmt of phoneFormats) {
            const uQuery = await db.collection('users').where('phone', '==', fmt).limit(1).get();
            if (!uQuery.empty) {
                const uDoc = uQuery.docs[0];
                userId = uDoc.id;
                userDocData = uDoc.data();
                break;
            }
        }
    }
    if (userId && !userDocData) {
        const uDoc = await db.collection('users').doc(userId).get();
        if (uDoc.exists)
            userDocData = uDoc.data();
    }
    // 2. If district or mandal is missing in application, try resolving from user document
    if ((!district || !mandal) && userDocData) {
        if (!district)
            district = String(userDocData.district || "").trim();
        if (!mandal)
            mandal = String(userDocData.assignedMandal || userDocData.mandal || "").trim();
    }
    // 3. Smart extraction from address/interestedArea/profile if still missing
    if (!district || !mandal) {
        const extracted = (0, location_data_1.extractDistrictAndMandal)(data.address, data.interestedArea, userDocData?.district || district, userDocData?.address);
        if (!district)
            district = extracted.district;
        if (!mandal)
            mandal = extracted.mandal;
    }
    // Check if user was previously downgraded/suspended
    let isPreviouslyDowngraded = data.previouslyDowngraded === true || data.isReapplication === true;
    if (!isPreviouslyDowngraded && userDocData) {
        if (userDocData.previouslyDowngraded === true || userDocData.suspended === true || userDocData.downgradedReason === "INACTIVITY") {
            isPreviouslyDowngraded = true;
        }
    }
    // Check vacancy for mandal in users collection
    let vacancyResult = { vacant: false };
    if (district && mandal) {
        vacancyResult = await checkMandalVacancy(district, mandal, userId);
    }
    const vacant = vacancyResult.vacant;
    const existingRep = vacancyResult.existingReporter;
    // Determine auto-approval eligibility
    const canAutoApprove = Boolean(district && mandal && userId && !isPreviouslyDowngraded && vacant);
    const isConflict = Boolean(district && mandal && !vacant);
    console.log(`[REPORTER_APP_TRIGGER] 📋 Processing ${appId} for ${applicantName} (dist: '${district}', mandal: '${mandal}', userId: '${userId}', canAutoApprove: ${canAutoApprove}, isConflict: ${isConflict})`);
    if (canAutoApprove) {
        console.log(`[REPORTER_APP_TRIGGER] ✅ Mandal ${mandal} is VACANT. Auto-approving application ${appId}...`);
        // Update application document
        await event.data?.ref.update({
            status: "JOINED",
            autoApproved: true,
            district,
            mandal,
            userId,
            emailSentToAdmin: true,
            approvedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // Promote user to REPORTER
        await promoteUserToReporter(userId, applicantName, rawPhone || userDocData?.phone || "", district, mandal, "AUTO_APPROVAL_TRIGGER");
        // Send notification email to admin
        await sendReporterApplicationEmail({ ...data, district, mandal, fullName: applicantName, phone: rawPhone, userId }, true, false, "JOINED");
    }
    else if (isConflict) {
        console.log(`[REPORTER_APP_TRIGGER] ⚠️ Mandal ${mandal} in ${district} is occupied by ${existingRep?.name}. Keeping PENDING for competition review.`);
        await event.data?.ref.update({
            district,
            mandal,
            userId: userId || null,
            status: "PENDING",
            isConflict: true,
            emailSentToAdmin: true,
            existingReporterName: existingRep?.name || null,
            existingReporterPhone: existingRep?.phone || null,
            existingReporterId: existingRep?.id || null
        });
        if (userId) {
            await notifyApplicantOfConflict(userId, applicantName, district, mandal, existingRep?.name || "విలేకరి");
        }
        // Send email alert to admin
        await sendReporterApplicationEmail({ ...data, district, mandal, fullName: applicantName, phone: rawPhone, userId }, false, isPreviouslyDowngraded, "PENDING", { isConflict: true, existingReporterName: existingRep?.name, existingReporterPhone: existingRep?.phone });
    }
    else {
        // Missing location details or user account
        console.log(`[REPORTER_APP_TRIGGER] ℹ️ Application ${appId} kept PENDING for manual admin review (Missing dist/mandal/userId or prev downgraded).`);
        if (district || mandal || userId) {
            await event.data?.ref.update({
                district: district || data.district || "",
                mandal: mandal || data.mandal || "",
                userId: userId || data.userId || null,
                emailSentToAdmin: true
            });
        }
        // ALWAYS SEND EMAIL TO ADMIN SO YOU NEVER MISS ANY APPLICANT!
        await sendReporterApplicationEmail({ ...data, district: district || "N/A", mandal: mandal || "N/A", fullName: applicantName, phone: rawPhone, userId }, false, isPreviouslyDowngraded, rawStatus === "JOINED" ? "JOINED" : "PENDING");
    }
});
/**
 * Helper to verify Admin Bearer token for HTTP endpoints
 */
async function verifyHttpAdminAuth(req) {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1].trim();
            const decoded = await admin.auth().verifyIdToken(idToken);
            const userDoc = await db.collection('users').doc(decoded.uid).get();
            const role = String(userDoc.data()?.role || '').toUpperCase();
            return ['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(role);
        }
        return false;
    }
    catch {
        return false;
    }
}
/**
 * Callable function to scan and auto-approve existing pending reporter applications whose mandals are vacant.
 */
exports.autoApproveAllPendingApplications = (0, https_1.onCall)({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }
    const adminDoc = await db.collection('users').doc(auth.uid).get();
    const role = String(adminDoc.data()?.role || '').toUpperCase();
    if (!['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(role)) {
        throw new https_1.HttpsError('permission-denied', 'అడ్మిన్లకు మాత్రమే ఈ అనుమతి ఉంది.');
    }
    return await executeAutoApprovePendingBackfill();
});
/**
 * HTTP endpoint to trigger the backfill scan directly and return execution summary (Admin Token Required).
 */
exports.runAutoApprovePendingBackfill = (0, https_1.onRequest)({ secrets: ["EMAIL_USER", "EMAIL_PASS"], region: utils_1.REGION }, async (req, res) => {
    if (!(await verifyHttpAdminAuth(req))) {
        res.status(403).json({ error: "Forbidden: Admin Bearer token required" });
        return;
    }
    try {
        if (req.query.getAllActiveReporters) {
            const snap = await db.collection('users')
                .where('role', 'in', ['REPORTER', 2, 2.0, '2'])
                .get();
            const list = snap.docs.map(d => {
                const u = d.data();
                return {
                    id: d.id,
                    name: u.name || u.fullName || "N/A",
                    phone: u.phone || u.phoneNumber || "N/A",
                    district: u.district || "N/A",
                    mandal: u.assignedMandal || u.mandal || "N/A",
                    suspended: u.suspended === true,
                    promotedAt: u.promotedAt || null,
                    lastPostTimestamp: u.lastPostTimestamp || null
                };
            });
            res.status(200).json({ count: list.length, reporters: list });
            return;
        }
        if (req.query.scanUsersDuplicates) {
            const snap = await db.collection('users').get();
            const phoneMap = {};
            for (const doc of snap.docs) {
                const u = doc.data();
                const rawPhone = String(u.phone || u.phoneNumber || "").trim();
                const clean10 = rawPhone.replace(/\D/g, '').slice(-10);
                if (clean10.length === 10) {
                    if (!phoneMap[clean10])
                        phoneMap[clean10] = [];
                    phoneMap[clean10].push({ id: doc.id, phone: rawPhone, name: u.name, role: u.role, createdAt: u.createdAt || u.joinedAt || null });
                }
            }
            const duplicates = Object.keys(phoneMap).filter(k => phoneMap[k].length > 1).map(k => ({ phone: k, count: phoneMap[k].length, accounts: phoneMap[k] }));
            res.status(200).json({ totalUsers: snap.size, duplicateGroupsCount: duplicates.length, duplicates });
            return;
        }
        if (req.query.july25Cleanup) {
            const dryRun = req.query.dryRun === "true";
            const result = await executeJuly25ApprovalAndCleanup(dryRun);
            res.status(200).json({ mode: dryRun ? "DRY_RUN" : "LIVE_APPLIED", ...result });
            return;
        }
        if (req.query.inspect) {
            if (req.query.phone) {
                const clean10 = String(req.query.phone).replace(/\D/g, '').slice(-10);
                const phoneFormats = [`+91${clean10}`, clean10, `0${clean10}`, `91${clean10}`];
                const usersFound = [];
                for (const fmt of phoneFormats) {
                    const snap = await db.collection('users').where('phone', '==', fmt).get();
                    snap.docs.forEach(d => usersFound.push({ id: d.id, ...d.data() }));
                }
                res.status(200).json({ count: usersFound.length, users: usersFound });
                return;
            }
            if (req.query.docId) {
                const docSnap = await db.collection('reporter_applications').doc(String(req.query.docId)).get();
                res.status(200).json({ id: docSnap.id, ...docSnap.data() });
                return;
            }
            if (req.query.checkVacancy) {
                const dist = String(req.query.dist || "");
                const mandal = String(req.query.mandal || "");
                const snap = await db.collection('users')
                    .where('role', 'in', ['REPORTER', 2, 2.0, '2'])
                    .where('district', '==', dist)
                    .where('assignedMandal', '==', mandal)
                    .get();
                const reporters = snap.docs.map(d => ({ id: d.id, name: d.data().name, phone: d.data().phone, mandal: d.data().assignedMandal }));
                res.status(200).json({ district: dist, mandal: mandal, count: reporters.length, reporters });
                return;
            }
            const snap = await db.collection('reporter_applications')
                .orderBy('timestamp', 'desc')
                .limit(20)
                .get();
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            res.status(200).json({ count: docs.length, docs });
            return;
        }
        const result = await executeAutoApprovePendingBackfill();
        res.status(200).json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
async function executeAutoApprovePendingBackfill() {
    console.log("[AUTO_APPROVE_ALL] 🚀 Starting scan of all applications in reporter_applications...");
    const allAppsSnap = await db.collection('reporter_applications').get();
    let totalPending = 0;
    let approvedCount = 0;
    let skippedCount = 0;
    const approvedList = [];
    const skippedList = [];
    for (const doc of allAppsSnap.docs) {
        const data = doc.data();
        const rawStatus = String(data.status || "").trim().toUpperCase();
        // Skip already finalized applications
        if (rawStatus === "JOINED" || rawStatus === "APPROVED" || rawStatus === "REJECTED") {
            continue;
        }
        totalPending++;
        const applicantName = data.fullName || data.name || "No Name";
        const rawPhone = String(data.phone || data.phoneNumber || data.mobile || "").trim();
        const clean10 = rawPhone.replace(/\D/g, '').slice(-10);
        let district = String(data.district || data.selectedDistrict || data.assignedDistrict || data.state_district || data.stateDistrict || "").trim();
        let mandal = String(data.mandal || data.selectedMandal || data.assignedMandal || data.mandalam || "").trim();
        let userId = String(data.userId || data.uid || data.user_id || "").trim();
        // 1. If userId is missing, search users collection by phone number
        let userDocData = null;
        if (!userId && clean10.length === 10) {
            const phoneFormats = [`+91${clean10}`, clean10, `0${clean10}`, `91${clean10}`];
            for (const fmt of phoneFormats) {
                const uQuery = await db.collection('users').where('phone', '==', fmt).limit(1).get();
                if (!uQuery.empty) {
                    const uDoc = uQuery.docs[0];
                    userId = uDoc.id;
                    userDocData = uDoc.data();
                    break;
                }
            }
        }
        // If we have userId, fetch user profile if not already fetched
        if (userId && !userDocData) {
            const uDoc = await db.collection('users').doc(userId).get();
            if (uDoc.exists) {
                userDocData = uDoc.data();
            }
        }
        // 2. If district or mandal is missing in application, try resolving from user document
        if ((!district || !mandal) && userDocData) {
            if (!district)
                district = String(userDocData.district || "").trim();
            if (!mandal)
                mandal = String(userDocData.assignedMandal || userDocData.mandal || "").trim();
        }
        // 3. Smart extraction from address/interestedArea/profile if still missing
        if (!district || !mandal) {
            const extracted = (0, location_data_1.extractDistrictAndMandal)(data.address, data.interestedArea, userDocData?.district || district, userDocData?.address);
            if (!district)
                district = extracted.district;
            if (!mandal)
                mandal = extracted.mandal;
        }
        // If still missing district/mandal or userId, log reason
        if (!district || !mandal) {
            skippedCount++;
            skippedList.push({
                id: doc.id,
                name: applicantName,
                phone: rawPhone,
                reason: `Missing district/mandal (Found: district='${district}', mandal='${mandal}')`
            });
            continue;
        }
        if (!userId) {
            skippedCount++;
            skippedList.push({
                id: doc.id,
                name: applicantName,
                phone: rawPhone,
                district,
                mandal,
                reason: "No matching user account found in users collection"
            });
            continue;
        }
        // 3. Check if user was previously downgraded or suspended
        if (userDocData?.previouslyDowngraded === true ||
            userDocData?.suspended === true ||
            userDocData?.downgradedReason === "INACTIVITY" ||
            data.previouslyDowngraded === true ||
            data.isReapplication === true) {
            skippedCount++;
            skippedList.push({
                id: doc.id,
                name: applicantName,
                phone: rawPhone,
                district,
                mandal,
                reason: "Applicant was previously downgraded/suspended (manual admin review required)"
            });
            continue;
        }
        // 4. Check if mandal is vacant in users collection
        const vacant = await isMandalVacant(district, mandal, userId);
        if (!vacant) {
            skippedCount++;
            skippedList.push({
                id: doc.id,
                name: applicantName,
                phone: rawPhone,
                district,
                mandal,
                reason: `Mandal (${district} - ${mandal}) is already occupied by an active reporter`
            });
            continue;
        }
        // 5. Auto approve!
        await doc.ref.update({
            status: "JOINED",
            autoApproved: true,
            district,
            mandal,
            userId,
            approvedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        await promoteUserToReporter(userId, applicantName, rawPhone || userDocData?.phone || "", district, mandal, "AUTO_APPROVE_BACKFILL");
        // Send notification email to admin
        await sendReporterApplicationEmail({ ...data, district, mandal, fullName: applicantName, phone: rawPhone, userId }, true, false, "JOINED");
        approvedCount++;
        approvedList.push({ id: doc.id, name: applicantName, phone: rawPhone, district, mandal, userId });
    }
    console.log(`[AUTO_APPROVE_ALL] 🏁 Finished: ${approvedCount} approved, ${skippedCount} skipped out of ${totalPending} pending applications.`);
    return {
        success: true,
        totalApplicationsInDb: allAppsSnap.size,
        totalPending,
        approvedCount,
        skippedCount,
        approvedList,
        skippedList
    };
}
async function executeJuly25ApprovalAndCleanup(dryRun = false) {
    console.log(`[JULY25_CLEANUP] 🚀 Starting July 25+ approval and cleanup (dryRun: ${dryRun})...`);
    const allAppsSnap = await db.collection('reporter_applications').get();
    const JULY_25_MS = new Date('2026-07-25T00:00:00+05:30').getTime(); // 1784917800000
    // Filter applications submitted on or after July 25, 2026
    const eligibleDocs = [];
    for (const doc of allAppsSnap.docs) {
        const data = doc.data();
        const ts = data.timestamp;
        let timeMs = 0;
        if (ts && typeof ts.toDate === 'function') {
            timeMs = ts.toDate().getTime();
        }
        else if (typeof ts === 'number') {
            timeMs = ts > 1e11 ? ts : ts * 1000;
        }
        else if (ts && typeof ts._seconds === 'number') {
            timeMs = ts._seconds * 1000;
        }
        if (timeMs >= JULY_25_MS) {
            const rawPhone = String(data.phone || data.phoneNumber || data.mobile || "").trim();
            const clean10 = rawPhone.replace(/\D/g, '').slice(-10);
            const userId = String(data.userId || data.uid || "").trim();
            const fullName = String(data.fullName || data.name || "").trim().toLowerCase();
            const groupKey = clean10.length === 10 ? clean10 : (userId || fullName || doc.id);
            eligibleDocs.push({
                id: doc.id,
                data: data,
                timeMs: timeMs,
                cleanPhone: clean10,
                key: groupKey
            });
        }
    }
    console.log(`[JULY25_CLEANUP] Found ${eligibleDocs.length} total applications submitted on or after July 25, 2026.`);
    // Group by unique applicant key
    const groups = {};
    for (const item of eligibleDocs) {
        if (!groups[item.key])
            groups[item.key] = [];
        groups[item.key].push(item);
    }
    const report = {
        uniqueApplicants: Object.keys(groups).length,
        totalApplications: eligibleDocs.length,
        approved: [],
        deletedDuplicates: []
    };
    for (const key of Object.keys(groups)) {
        const list = groups[key];
        // Sort newest first
        list.sort((a, b) => b.timeMs - a.timeMs);
        const canonical = list[0];
        const duplicates = list.slice(1);
        const appData = canonical.data;
        const applicantName = appData.fullName || appData.name || "Reporter";
        const rawPhone = String(appData.phone || appData.phoneNumber || appData.mobile || "").trim();
        const clean10 = canonical.cleanPhone;
        let userId = String(appData.userId || appData.uid || "").trim();
        // 1. Find all matching user records by phone and userId
        const matchingUsers = [];
        if (clean10.length === 10) {
            const phoneFormats = [`+91${clean10}`, clean10, `0${clean10}`, `91${clean10}`];
            for (const fmt of phoneFormats) {
                const uSnap = await db.collection('users').where('phone', '==', fmt).get();
                uSnap.docs.forEach(d => {
                    if (!matchingUsers.some(u => u.id === d.id)) {
                        matchingUsers.push({ id: d.id, ...d.data() });
                    }
                });
            }
        }
        if (userId && !matchingUsers.some(u => u.id === userId)) {
            const uDoc = await db.collection('users').doc(userId).get();
            if (uDoc.exists)
                matchingUsers.push({ id: uDoc.id, ...uDoc.data() });
        }
        // 2. Resolve District and Mandal
        let district = String(appData.district || appData.selectedDistrict || appData.assignedDistrict || "").trim();
        let mandal = String(appData.mandal || appData.selectedMandal || appData.assignedMandal || appData.mandalam || "").trim();
        if ((!district || !mandal) && matchingUsers.length > 0) {
            const firstU = matchingUsers[0];
            if (!district)
                district = String(firstU.district || "").trim();
            if (!mandal)
                mandal = String(firstU.assignedMandal || firstU.mandal || "").trim();
        }
        if (!district || !mandal) {
            const userDist = matchingUsers[0]?.district;
            const userAddr = matchingUsers[0]?.address;
            const extracted = (0, location_data_1.extractDistrictAndMandal)(appData.address, appData.interestedArea, userDist || district, userAddr);
            if (!district)
                district = extracted.district;
            if (!mandal)
                mandal = extracted.mandal;
        }
        if (!district)
            district = "తెలంగాణ / ఆంధ్రప్రదేశ్";
        if (!mandal)
            mandal = "జిల్లా విలేకరి";
        const targetUserId = userId || (matchingUsers.length > 0 ? matchingUsers[0].id : null);
        if (!dryRun) {
            // Update all matching user records to role: REPORTER
            for (const u of matchingUsers) {
                await db.collection('users').doc(u.id).set({
                    role: "REPORTER",
                    district: district,
                    assignedMandal: mandal,
                    mandal: mandal,
                    promotedBy: "ADMIN_BULK_APPROVE_JULY25",
                    agreedToRules: true,
                    suspended: false,
                    warningLevel: 0,
                    promotedAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                    name: applicantName || u.name || "Reporter",
                    phone: rawPhone || u.phone || ""
                }, { merge: true });
            }
            // Update canonical application to JOINED
            await db.collection('reporter_applications').doc(canonical.id).update({
                status: "JOINED",
                autoApproved: true,
                district: district,
                mandal: mandal,
                userId: targetUserId,
                approvedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // Delete older duplicate applications
            for (const dup of duplicates) {
                await db.collection('reporter_applications').doc(dup.id).delete();
            }
        }
        report.approved.push({
            id: canonical.id,
            name: applicantName,
            phone: rawPhone,
            district: district,
            mandal: mandal,
            userId: targetUserId,
            matchedUsersCount: matchingUsers.length
        });
        if (duplicates.length > 0) {
            report.deletedDuplicates.push({
                canonicalId: canonical.id,
                name: applicantName,
                phone: rawPhone,
                deletedCount: duplicates.length,
                deletedIds: duplicates.map(d => d.id)
            });
        }
    }
    console.log(`[JULY25_CLEANUP] 🏁 Finished July 25+ cleanup: Approved ${report.approved.length} unique reporters, Deleted ${report.deletedDuplicates.reduce((acc, d) => acc + d.deletedCount, 0)} duplicate applications.`);
    return report;
}
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
        const assignedReporterId = (typeof after.reporter === 'string' ? after.reporter : after.reporter?.id) || after.reporterId;
        const originalReporterId = after.originalReporterId;
        const reporterIdsToUpdate = new Set();
        if (assignedReporterId && !assignedReporterId.startsWith('BOT_') && !assignedReporterId.startsWith('SYSTEM_')) {
            reporterIdsToUpdate.add(assignedReporterId);
        }
        if (originalReporterId && !originalReporterId.startsWith('BOT_') && !originalReporterId.startsWith('SYSTEM_')) {
            reporterIdsToUpdate.add(originalReporterId);
        }
        for (const rId of reporterIdsToUpdate) {
            console.log(`[POST_APPROVED] Updating lastPostTimestamp for reporter: ${rId}`);
            await db.collection('users').doc(rId).set({
                lastPostTimestamp: after.timestamp || admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
    }
});
/**
 * Automatically reset warning levels and set promotion timestamps when a user is assigned/upgraded/re-joined to REPORTER
 */
exports.onUserRoleChanged = (0, firestore_1.onDocumentWritten)({
    document: "users/{userId}",
    region: utils_1.REGION,
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after)
        return;
    const beforeRole = String(before?.role || '').toUpperCase();
    const afterRole = String(after.role || '').toUpperCase();
    const isBeforeReporter = ['REPORTER', '2', '2.0', 'STAFF_REPORTER', 'REGIONAL_INCHARGE'].includes(beforeRole) || before?.role === 2 || before?.role === 2.0;
    const isAfterReporter = ['REPORTER', '2', '2.0'].includes(afterRole) || after.role === 2 || after.role === 2.0;
    // Check if user was newly promoted / upgraded / re-joined to REPORTER
    if (!isBeforeReporter && isAfterReporter) {
        console.log(`[ROLE_UPGRADED] User ${event.params.userId} upgraded to REPORTER. Setting full grace period timestamps and resetting flags...`);
        await event.data?.after.ref.update({
            warningLevel: 0,
            inProbation: false,
            lastWarningDate: admin.firestore.FieldValue.delete(),
            previouslyDowngraded: false,
            suspended: false,
            downgradedReason: admin.firestore.FieldValue.delete(),
            downgradedAt: admin.firestore.FieldValue.delete(),
            promotedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            rejoinedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // Also sync any SUSPENDED applications back to JOINED
        try {
            const appSnap = await db.collection('reporter_applications')
                .where('userId', '==', event.params.userId)
                .where('status', '==', 'SUSPENDED')
                .get();
            for (const doc of appSnap.docs) {
                await doc.ref.update({
                    status: 'JOINED',
                    rejoinedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }
        catch (err) {
            console.error(`[ROLE_UPGRADE_APP_SYNC_ERR] ${event.params.userId}:`, err.message);
        }
    }
});
/**
 * Mass re-activation of all reporters who were mistakenly demoted to subscribers.
 * Restores role: "REPORTER", sets 10-day fresh grace period, resets warning levels,
 * updates application records, and sends Telugu notification message + FCM push.
 */
async function executeReactivateFalselyDemotedReporters(dryRun = false) {
    console.log(`[REACTIVATE_REPORTERS] 🚀 Starting scan of falsely demoted reporters (dryRun: ${dryRun})...`);
    const usersSnap = await db.collection('users').get();
    const appsSnap = await db.collection('reporter_applications').get();
    // Map applications by clean phone and by userId
    const appsByUser = {};
    const appsByPhone = {};
    for (const doc of appsSnap.docs) {
        const data = { id: doc.id, ...doc.data() };
        const uId = String(data.userId || data.uid || "").trim();
        if (uId) {
            if (!appsByUser[uId])
                appsByUser[uId] = [];
            appsByUser[uId].push(data);
        }
        const rawPhone = String(data.phone || data.phoneNumber || data.mobile || "").trim();
        const clean10 = rawPhone.replace(/\D/g, '').slice(-10);
        if (clean10.length === 10) {
            if (!appsByPhone[clean10])
                appsByPhone[clean10] = [];
            appsByPhone[clean10].push(data);
        }
    }
    const reactivatedList = [];
    const seniorRoles = ['ADMIN', 'EDITOR', 'REGIONAL_INCHARGE', 'STAFF_REPORTER', '5', '7', 5, 7];
    for (const doc of usersSnap.docs) {
        const u = doc.data();
        const userId = doc.id;
        const currentRole = String(u.role || '').toUpperCase();
        // Skip senior roles (Admin, Editor, Staff Reporter, etc.)
        if (seniorRoles.includes(currentRole) || seniorRoles.includes(u.role)) {
            continue;
        }
        // Check if user is currently active as reporter
        const isActiveReporter = ['REPORTER', '2', '2.0'].includes(currentRole) || u.role === 2 || u.role === 2.0;
        // Check if user has demoted / suspended / inactive marker
        const isMarkedDemoted = u.previouslyDowngraded === true ||
            u.downgradedReason === "INACTIVITY" ||
            u.suspended === true ||
            u.downgradedAt != null;
        // Check matching applications
        const clean10 = String(u.phone || '').replace(/\D/g, '').slice(-10);
        const userApps = appsByUser[userId] || (clean10.length === 10 ? appsByPhone[clean10] : []) || [];
        const hasJoinedOrSuspendedApp = userApps.some((a) => a.status === 'JOINED' || a.status === 'SUSPENDED' || a.autoApproved === true);
        const shouldReactivate = (!isActiveReporter && (isMarkedDemoted || hasJoinedOrSuspendedApp)) ||
            (isActiveReporter && isMarkedDemoted);
        if (!shouldReactivate) {
            continue;
        }
        // Resolve District and Mandal
        let district = String(u.district || "").trim();
        let mandal = String(u.assignedMandal || u.mandal || "").trim();
        if ((!district || !mandal) && userApps.length > 0) {
            const firstApp = userApps[0];
            if (!district)
                district = String(firstApp.district || firstApp.selectedDistrict || "").trim();
            if (!mandal)
                mandal = String(firstApp.mandal || firstApp.assignedMandal || firstApp.selectedMandal || "").trim();
        }
        if (!district || !mandal) {
            const extracted = (0, location_data_1.extractDistrictAndMandal)(u.address, "", district, u.address);
            if (!district)
                district = extracted.district || "తెలంగాణ / ఆంధ్రప్రదేశ్";
            if (!mandal)
                mandal = extracted.mandal || "జిల్లా విలేకరి";
        }
        const name = u.name || userApps[0]?.fullName || userApps[0]?.name || "విలేకరి";
        const phone = u.phone || userApps[0]?.phone || "";
        if (!dryRun) {
            // 1. Update user document to active REPORTER with fresh grace period
            await db.collection('users').doc(userId).set({
                role: "REPORTER",
                district: district,
                assignedMandal: mandal,
                mandal: mandal,
                warningLevel: 0,
                inProbation: false,
                previouslyDowngraded: false,
                suspended: false,
                downgradedReason: admin.firestore.FieldValue.delete(),
                downgradedAt: admin.firestore.FieldValue.delete(),
                lastWarningDate: admin.firestore.FieldValue.delete(),
                promotedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                rejoinedAt: admin.firestore.FieldValue.serverTimestamp(),
                promotedBy: u.promotedBy || "SYSTEM_RESTORE"
            }, { merge: true });
            // 2. Update matching reporter_applications
            for (const app of userApps) {
                await db.collection('reporter_applications').doc(app.id).update({
                    status: "JOINED",
                    rejoinedAt: admin.firestore.FieldValue.serverTimestamp(),
                    district: district,
                    mandal: mandal,
                    userId: userId
                });
            }
            // 3. Send Encouraging Telugu Restoration Message & Push Notification
            const title = "అల్ఫా న్యూస్ రిపోర్టర్ హోదా తిరిగి ప్రారంభించబడింది! 🌟";
            const body = `నమస్కారం ${name}! సాంకేతిక కారణాల వల్ల నిలిచిపోయిన మీ రిపోర్టర్ హోదా తిరిగి విజయవంతంగా ప్రారంభించబడింది. శుభాకాంక్షలు! నేటి నుంచే మీ మండల తాజా వార్తలను ఉత్సాహంగా Alfa News లో పోస్ట్ చేయండి.`;
            const msgTimestamp = admin.firestore.FieldValue.serverTimestamp();
            // Inbox message
            await db.collection('users').doc(userId).collection('messages').add({
                title,
                body,
                senderName: "AlfaNews Editorial Desk",
                read: false,
                timestamp: msgTimestamp,
                importance: "HIGH",
                type: "RESTORATION"
            });
            // Reporter conversation thread
            try {
                await db.collection('reporter_conversations').doc(userId).collection('messages').add({
                    senderId: "SYSTEM_ADMIN",
                    senderName: "AlfaNews Editorial Desk",
                    senderRole: "ADMIN",
                    text: `🎉 [${title}]\n\n${body}`,
                    type: "NOTICE",
                    read: false,
                    timestamp: msgTimestamp
                });
                await db.collection('reporter_conversations').doc(userId).set({
                    reporterId: userId,
                    reporterName: name,
                    reporterPhone: phone,
                    reporterDistrict: district,
                    reporterMandal: mandal,
                    lastMessage: `🎉 ${title}`,
                    lastMessageTime: msgTimestamp,
                    lastSenderRole: "ADMIN",
                    lastSenderId: "SYSTEM_ADMIN",
                    unreadCountForReporter: admin.firestore.FieldValue.increment(1),
                    updatedAt: msgTimestamp
                }, { merge: true });
            }
            catch (convErr) {
                console.error(`[CONV_ERR] ${userId}:`, convErr.message);
            }
            // High priority FCM push
            const rawTokens = [...(u.fcmTokens || []), u.fcmToken];
            const tokens = Array.from(new Set(rawTokens.filter((t) => typeof t === 'string' && t.trim().length > 0)));
            if (tokens.length > 0) {
                const pushList = tokens.map(token => ({
                    token,
                    android: {
                        priority: 'high',
                        ttl: 86400000,
                        directBootOk: true,
                        notification: {
                            channelId: 'general_news',
                            sound: 'default'
                        }
                    },
                    notification: {
                        title,
                        body
                    },
                    data: {
                        type: "REPORTER_RESTORED",
                        title,
                        body,
                        channelId: 'general_news'
                    }
                }));
                await admin.messaging().sendEach(pushList).catch(() => { });
            }
        }
        reactivatedList.push({
            id: userId,
            name,
            phone,
            district,
            mandal,
            previousRole: currentRole || 'SUBSCRIBER',
            reason: isMarkedDemoted ? "Previously Downgraded/Suspended" : "Joined Application Found"
        });
    }
    console.log(`[REACTIVATE_REPORTERS] 🏁 Completed. Reactivated ${reactivatedList.length} reporters.`);
    return {
        success: true,
        mode: dryRun ? "DRY_RUN" : "LIVE_APPLIED",
        totalUsersScanned: usersSnap.size,
        reactivatedCount: reactivatedList.length,
        reactivated: reactivatedList
    };
}
exports.executeReactivateFalselyDemotedReporters = executeReactivateFalselyDemotedReporters;
/**
 * Callable function to reactivate all demoted reporters on demand (Admin Only).
 */
exports.reactivateFalselyDemotedReporters = (0, https_1.onCall)(async (request) => {
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }
    const adminDoc = await db.collection('users').doc(auth.uid).get();
    const role = String(adminDoc.data()?.role || '').toUpperCase();
    if (!['ADMIN', 'EDITOR', '5', '5.0', '7', '7.0'].includes(role)) {
        throw new https_1.HttpsError('permission-denied', 'అడ్మిన్లకు మాత్రమే ఈ అనుమతి ఉంది.');
    }
    return await executeReactivateFalselyDemotedReporters(false);
});
/**
 * HTTP endpoint to trigger reactivation and view detailed report (Admin Token Required).
 */
exports.runReactivateDemotedReportersHttp = (0, https_1.onRequest)({ region: utils_1.REGION }, async (req, res) => {
    if (!(await verifyHttpAdminAuth(req))) {
        res.status(403).json({ error: "Forbidden: Admin Bearer token required" });
        return;
    }
    try {
        const dryRun = req.query.dryRun === "true";
        const result = await executeReactivateFalselyDemotedReporters(dryRun);
        res.status(200).json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * 6.2 Verify Reporter (Web Page)
 */
exports.verifyReporter = (0, https_1.onRequest)(async (req, res) => {
    // Extract reporterId from the path: /verify/{reporterId}
    // Hosting rewrite will point /verify/** to this function
    const pathParts = req.path.split('/');
    const reporterId = pathParts[pathParts.length - 1];
    if (!reporterId || reporterId === 'verify' || reporterId === '') {
        res.status(404).send("<h1>Invalid Reporter ID</h1>");
        return;
    }
    try {
        const userDoc = await db.collection('users').doc(reporterId).get();
        if (!userDoc.exists) {
            res.status(404).send(`
                <html>
                    <head>
                        <title>Reporter Not Found - Alfa News</title>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px; background: #f4f4f4; }
                            .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); display: inline-block; }
                            h1 { color: #e74c3c; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>Reporter Not Found ❌</h1>
                            <p>The ID you are verifying is not registered in our system.</p>
                            <a href="https://play.google.com/store/apps/details?id=com.alfanews.telugu">Download Alfa News App</a>
                        </div>
                    </body>
                </html>
            `);
            return;
        }
        const user = userDoc.data();
        const isVerified = user?.role === 'REPORTER' || user?.role === 'ADMIN';
        const statusColor = isVerified ? '#2ecc71' : '#e74c3c';
        const statusText = isVerified ? 'VERIFIED REPORTER ✅' : 'NOT A REPORTER ❌';
        const html = `
            <!DOCTYPE html>
            <html lang="te">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reporter Verification - Alfa News</title>
                <style>
                    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f0f2f5; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    .card { background: white; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); width: 95%; max-width: 400px; overflow: hidden; text-align: center; border-top: 8px solid #ff0000; margin: 20px; }
                    .header { padding: 20px; background: #fff; }
                    .logo { font-size: 32px; font-weight: bold; margin-bottom: 5px; color: #000; }
                    .logo span { color: #ff0000; }
                    .photo-container { margin: 10px auto; width: 160px; height: 200px; border: 4px solid #eee; border-radius: 8px; overflow: hidden; background: #fafafa; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                    .photo { width: 100%; height: 100%; object-fit: cover; }
                    .info { padding: 0 25px 25px; }
                    .name { font-size: 24px; font-weight: bold; color: #333; margin: 15px 0 5px; }
                    .role { font-size: 16px; font-weight: bold; color: #ff0000; text-transform: uppercase; margin-bottom: 15px; letter-spacing: 1px; }
                    .details { text-align: left; margin: 20px 0; border-top: 1px solid #eee; padding-top: 15px; }
                    .detail-item { margin-bottom: 12px; font-size: 15px; color: #555; display: flex; }
                    .detail-label { font-weight: bold; color: #333; width: 90px; flex-shrink: 0; }
                    .status { display: inline-block; padding: 12px 25px; border-radius: 30px; background: ${statusColor}; color: white; font-weight: bold; margin-top: 5px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 16px; }
                    .footer { padding: 15px; background: #f9f9f9; font-size: 12px; color: #999; border-top: 1px solid #eee; }
                    @media (max-width: 480px) {
                        .card { margin: 10px; }
                        .info { padding: 0 15px 20px; }
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <div class="logo">alfa<span>news</span></div>
                        <div style="font-size: 11px; color: #666; font-weight: bold; letter-spacing: 2px; margin-top: 5px;">OFFICIAL REPORTER VERIFICATION</div>
                    </div>

                    <div class="photo-container">
                        <img src="${user?.photoUrl || 'https://via.placeholder.com/160x200?text=No+Photo'}" alt="${user?.name}" class="photo">
                    </div>

                    <div class="info">
                        <div class="name">${user?.name}</div>
                        <div class="role">${user?.role?.replace('_', ' ')}</div>

                        <div class="status">${statusText}</div>

                        <div class="details">
                            <div class="detail-item"><span class="detail-label">ID No:</span> <span>${reporterId.slice(-8).toUpperCase()}</span></div>
                            <div class="detail-item"><span class="detail-label">District:</span> <span>${user?.district || 'N/A'}</span></div>
                            <div class="detail-item"><span class="detail-label">Mandal:</span> <span>${user?.assignedMandal || user?.mandal || 'N/A'}</span></div>
                            <div class="detail-item"><span class="detail-label">Valid Upto:</span> <span>31-12-2027</span></div>
                        </div>
                    </div>

                    <div class="footer">
                        © 2026 Alfa News Media Group. This is a digitally verified identity. <br>
                        Verification Date: ${new Date().toLocaleDateString('te-IN')}
                    </div>
                </div>
            </body>
            </html>
        `;
        res.status(200).send(html);
    }
    catch (error) {
        console.error("Verification error:", error);
        res.status(500).send("<h1>Internal Server Error</h1>");
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
exports.getAssignedReporter = getAssignedReporter;
/**
 * Cloud Function to process new user referrals.
 * Award 50 points to the referrer when a new user document is created.
 * ✅ ADDED: Welcome notification to the new user immediately on download.
 */
exports.onUserCreated = (0, firestore_1.onDocumentCreated)({
    document: "users/{userId}",
    region: utils_1.REGION
}, async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    const referredBy = data.referredBy;
    const userId = event.params.userId;
    // ==========================================
    // WELCOME NOTIFICATION — App download చేసిన వెంటనే
    // ==========================================
    try {
        // Token save అవ్వడానికి 5 సెకండ్లు వేచ్చు కొందాం (జాగ్రత్తగా)
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Fresh token read చేస్తాం (ప్రారంభంలో token రాకపోవచ్చు)
        const freshDoc = await db.collection('users').doc(userId).get();
        const freshData = freshDoc.data();
        const tokens = [];
        if (freshData?.fcmToken)
            tokens.push(freshData.fcmToken);
        if (Array.isArray(freshData?.fcmTokens)) {
            freshData.fcmTokens.forEach((t) => {
                if (t && typeof t === 'string' && !tokens.includes(t))
                    tokens.push(t);
            });
        }
        if (tokens.length > 0) {
            // Random welcome message select చేస్తాం
            const welcome = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
            const userName = freshData?.name || freshData?.displayName;
            const title = userName
                ? `నమస్కారం ${userName.split(' ')[0]}! Alfa News లో స్వాగతం 🌟`
                : welcome.title;
            const welcomeMessage = {
                android: {
                    priority: 'high',
                    ttl: 86400000, // 24 hours — welcome ఒక్కరోజు valid
                    directBootOk: true,
                },
                data: {
                    type: 'WELCOME',
                    channelId: 'general_news',
                    title: title,
                    body: welcome.body,
                    click_action: 'OPEN_HOME',
                    actionUrl: '',
                    newsId: '',
                    imageUrl: '',
                },
                token: tokens[0] // మొదటి token కి పంపిస్తాం
            };
            await admin.messaging().send(welcomeMessage).catch(err => {
                console.error(`[WELCOME_NOTIFY] Failed to send to ${userId}:`, err.message);
            });
            console.log(`[WELCOME_NOTIFY] ✅ Sent welcome notification to new user: ${userId}`);
        }
        else {
            console.log(`[WELCOME_NOTIFY] No token yet for user ${userId} — skipping welcome.`);
        }
    }
    catch (err) {
        console.error(`[WELCOME_NOTIFY_ERR] ${userId}:`, err.message);
    }
    // ==========================================
    // REFERRAL HANDLING (existing logic)
    // ==========================================
    if (referredBy && referredBy !== userId) {
        console.log(`[REFERRAL] User ${userId} was referred by ${referredBy}. Awarding 50 points.`);
        await awardPointsToReporter(referredBy, 50);
        const referrerRef = db.collection('users').doc(referredBy);
        try {
            await db.runTransaction(async (transaction) => {
                const referrerDoc = await transaction.get(referrerRef);
                if (referrerDoc.exists) {
                    const currentCount = referrerDoc.data()?.referralCount || 0;
                    transaction.update(referrerRef, {
                        referralCount: currentCount + 1
                    });
                }
            });
            console.log(`[REFERRAL] Successfully incremented referralCount for ${referredBy}`);
        }
        catch (e) {
            console.error(`[REFERRAL_ERR] Error incrementing referralCount for ${referredBy}:`, e.message);
        }
        // ✅ FIX: Data-only message (yesterday's delivery fix consistent)
        try {
            const referrerDoc = await referrerRef.get();
            if (referrerDoc.exists) {
                const referrerData = referrerDoc.data();
                const tokens = [];
                if (referrerData?.fcmToken)
                    tokens.push(referrerData.fcmToken);
                if (Array.isArray(referrerData?.fcmTokens)) {
                    referrerData.fcmTokens.forEach((t) => {
                        if (t && typeof t === 'string' && !tokens.includes(t))
                            tokens.push(t);
                    });
                }
                if (tokens.length > 0) {
                    const title = 'పాయింట్లు లభించాయి! 🎁';
                    const body = 'మీ రిఫరల్ లింక్ ద్వారా ఒకరు యాప్‌ను డౌన్‌లోడ్ చేసుకున్నందుకు మీకు 50 పాయింట్లు లభించాయి.';
                    await Promise.all(tokens.map(token => admin.messaging().send({
                        android: {
                            priority: 'high',
                            ttl: 86400000,
                            directBootOk: true,
                        },
                        data: {
                            type: 'REFERRAL_SUCCESS',
                            channelId: 'general_news',
                            title,
                            body,
                            actionUrl: '',
                            newsId: '',
                            imageUrl: '',
                        },
                        token
                    }).catch(() => { })));
                    console.log(`[REFERRAL] Sent data-only notification to ${referredBy}`);
                }
            }
        }
        catch (err) {
            console.error(`[REFERRAL_NOTIFY_ERR] Error sending notification:`, err.message);
        }
    }
});
/**
 * ✅ NEW: Welcome notification for anonymous (guest) users.
 * App install చేసి Sign-up చేయకుండా వున్న users కోసం.
 * anonymous_devices collection లో కొత్త document సేవ్ అయినప్పుడు trigger అవుతుంది.
 */
exports.onAnonymousDeviceCreated = (0, firestore_1.onDocumentCreated)({
    document: "anonymous_devices/{deviceId}",
    region: utils_1.REGION
}, async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    const token = data.fcmToken;
    if (!token || typeof token !== 'string') {
        console.log(`[WELCOME_ANON] No token in anonymous_devices/${event.params.deviceId}`);
        return;
    }
    try {
        // Random welcome message
        const welcome = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
        const welcomeMessage = {
            android: {
                priority: 'high',
                ttl: 86400000, // 24 hours
                directBootOk: true,
            },
            data: {
                type: 'WELCOME',
                channelId: 'general_news',
                title: welcome.title,
                body: welcome.body,
                click_action: 'OPEN_HOME',
                actionUrl: '',
                newsId: '',
                imageUrl: '',
            },
            token
        };
        await admin.messaging().send(welcomeMessage);
        console.log(`[WELCOME_ANON] ✅ Sent welcome to anonymous device: ${event.params.deviceId}`);
    }
    catch (err) {
        if (err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token') {
            // Invalid token — delete the document
            await event.data?.ref.delete().catch(() => { });
            console.log(`[WELCOME_ANON] Deleted invalid anonymous device: ${event.params.deviceId}`);
        }
        else {
            console.error(`[WELCOME_ANON_ERR]:`, err.message);
        }
    }
});
/**
 * ✅ NEW: Record App Install Referral immediately when app is opened after install.
 * Works for BOTH guest (anonymous) users and logged-in users.
 * Anti-fraud: Ensures each installId only rewards points once.
 */
exports.recordAppInstallReferral = (0, https_1.onCall)(async (request) => {
    const { referrerUid, installId, platform, appVersion } = request.data || {};
    if (!referrerUid || typeof referrerUid !== 'string' || !installId || typeof installId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'referrerUid and installId are required.');
    }
    const cleanReferrer = referrerUid.trim();
    const cleanInstallId = installId.trim();
    if (!cleanReferrer || !cleanInstallId) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid referrer or installId');
    }
    if (cleanReferrer.startsWith('BOT_') || cleanReferrer.startsWith('SYSTEM_')) {
        console.log(`[INSTALL_REFERRAL_SKIP] Skipping points for system account: ${cleanReferrer}`);
        return { success: false, message: 'System accounts cannot receive referrals' };
    }
    try {
        const installRef = db.collection('app_installs').doc(cleanInstallId);
        const referrerRef = db.collection('users').doc(cleanReferrer);
        // Check if this installation was already processed (anti-fraud check)
        const installDoc = await installRef.get();
        if (installDoc.exists) {
            console.log(`[INSTALL_REFERRAL_DUP] Install ${cleanInstallId} already rewarded to ${installDoc.data()?.referrerUid}`);
            return { success: true, message: 'Already processed', duplicate: true };
        }
        // Verify that the referrer user document exists
        const referrerDoc = await referrerRef.get();
        if (!referrerDoc.exists) {
            console.warn(`[INSTALL_REFERRAL_WARN] Referrer doc ${cleanReferrer} does not exist.`);
            return { success: false, message: 'Referrer not found' };
        }
        // Save install receipt
        await installRef.set({
            referrerUid: cleanReferrer,
            installId: cleanInstallId,
            platform: platform || 'android',
            appVersion: appVersion || '',
            pointsAwarded: 50,
            installedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // 1. Award 50 points to reporter (and monthly leaderboard)
        await awardPointsToReporter(cleanReferrer, 50);
        // 2. Atomically increment referralCount
        await referrerRef.update({
            referralCount: admin.firestore.FieldValue.increment(1)
        });
        console.log(`[INSTALL_REFERRAL_SUCCESS] Awarded 50 points and +1 install to ${cleanReferrer} for install ${cleanInstallId}`);
        // 3. Send high-priority notification to the reporter
        try {
            const referrerData = referrerDoc.data();
            const tokens = [];
            if (referrerData?.fcmToken)
                tokens.push(referrerData.fcmToken);
            if (Array.isArray(referrerData?.fcmTokens)) {
                referrerData.fcmTokens.forEach((t) => {
                    if (t && typeof t === 'string' && !tokens.includes(t))
                        tokens.push(t);
                });
            }
            if (tokens.length > 0) {
                const title = 'పాయింట్లు లభించాయి! 🎁';
                const body = 'మీ ప్రమోషన్ లింక్ ద్వారా ఒకరు Alfa News యాప్‌ను ఇన్‌స్టాల్ చేసుకున్నందుకు మీకు 50 పాయింట్లు లభించాయి.';
                await Promise.all(tokens.map(token => admin.messaging().send({
                    android: {
                        priority: 'high',
                        ttl: 86400000,
                        directBootOk: true,
                    },
                    data: {
                        type: 'REFERRAL_SUCCESS',
                        channelId: 'general_news',
                        title,
                        body,
                        actionUrl: '',
                        newsId: '',
                        imageUrl: '',
                    },
                    token
                }).catch(() => { })));
                console.log(`[INSTALL_REFERRAL] Sent referral notification to ${cleanReferrer}`);
            }
        }
        catch (err) {
            console.error(`[INSTALL_REFERRAL_NOTIFY_ERR] Error sending notification:`, err.message);
        }
        return { success: true, message: 'Referral processed successfully' };
    }
    catch (e) {
        console.error(`[INSTALL_REFERRAL_ERR] Error processing install referral:`, e.message);
        throw new https_1.HttpsError('internal', e.message);
    }
});
//# sourceMappingURL=reporter_handler.js.map