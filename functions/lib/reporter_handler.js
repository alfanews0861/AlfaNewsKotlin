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
exports.onAnonymousDeviceCreated = exports.onUserCreated = exports.verifyReporter = exports.onUserRoleChanged = exports.onNewsPostApproved = exports.submitReporterApplication = exports.processReporterSubmission = exports.onNewsViewCountUpdated = exports.backfillReporterPoints = void 0;
exports.notifyReporter = notifyReporter;
exports.awardPointsToReporter = awardPointsToReporter;
exports.getAssignedReporter = getAssignedReporter;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const nodemailer = __importStar(require("nodemailer"));
const utils_1 = require("./utils");
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
    // ✅ Quick guard: exit if longViews hasn't changed (saves execution time)
    if (viewsBefore === viewsAfter)
        return;
    const reporterId = after.reporter?.id;
    if (!reporterId)
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
exports.submitReporterApplication = (0, https_1.onCall)({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const data = request.data;
    const { fullName, fatherName, phone, address, position, interestedArea, education, currentOrg, state, district, mandal, message, userId } = data;
    if (!district || !mandal) {
        throw new https_1.HttpsError('invalid-argument', 'జిల్లా మరియు మండలం తప్పనిసరి.');
    }
    const rawDistrict = district || data.assignedDistrict || data.selectedDistrict || "";
    const rawMandal = mandal || data.assignedMandal || data.selectedMandal || data.mandalam || "";
    const trimmedDistrict = String(rawDistrict).trim();
    const trimmedMandal = String(rawMandal).trim();
    if (!trimmedDistrict || !trimmedMandal) {
        throw new https_1.HttpsError('invalid-argument', 'జిల్లా మరియు మండలం తప్పనిసరి.');
    }
    // 1. Check if THIS USER (userId or phone) already has a PENDING application
    if (userId) {
        const userPendingSnap = await db.collection('reporter_applications')
            .where('userId', '==', userId)
            .where('status', '==', 'PENDING')
            .limit(1)
            .get();
        if (!userPendingSnap.empty) {
            throw new https_1.HttpsError('already-exists', 'మీ దరఖాస్తు ఇప్పటికే పరిశీలనలో (PENDING) ఉంది. దయచేసి అడ్మిన్ నిర్ణయం కోసం వేచి చూడండి.');
        }
    }
    if (phone) {
        const cleanPhone = phone.trim().replace(/\s+/g, '').replace(/^\+91/, '');
        const phonePendingSnap = await db.collection('reporter_applications')
            .where('status', '==', 'PENDING')
            .where('phone', '==', cleanPhone)
            .limit(1)
            .get();
        if (!phonePendingSnap.empty) {
            throw new https_1.HttpsError('already-exists', 'ఈ ఫోన్ నంబర్‌తో దరఖాస్తు ఇప్పటికే పరిశీలనలో (PENDING) ఉంది.');
        }
    }
    // 2. Check if reporter already exists for this mandal in users collection
    const reporterQuery = db.collection('users')
        .where('role', 'in', ['REPORTER', 2, 2.0])
        .where('district', '==', trimmedDistrict)
        .where('assignedMandal', '==', trimmedMandal)
        .limit(1)
        .get();
    // 3. Check if there is already a JOINED application for this mandal
    const joinedAppQuery = db.collection('reporter_applications')
        .where('status', '==', 'JOINED')
        .where('district', '==', trimmedDistrict)
        .where('mandal', '==', trimmedMandal)
        .limit(1)
        .get();
    // 4. Check if there is already a PENDING application for this mandal
    // (first-come-first-served — ఒకరు apply చేసిన mandal కి మరొకరు apply చేయలేరు)
    const pendingMandalQuery = db.collection('reporter_applications')
        .where('status', '==', 'PENDING')
        .where('district', '==', trimmedDistrict)
        .where('mandal', '==', trimmedMandal)
        .limit(1)
        .get();
    const [reporterSnap, joinedAppSnap, pendingMandalSnap] = await Promise.all([reporterQuery, joinedAppQuery, pendingMandalQuery]);
    if (!reporterSnap.empty || !joinedAppSnap.empty) {
        throw new https_1.HttpsError('already-exists', 'ఈ మండలానికి ఇప్పటికే రిపోర్టర్ కేటాయించబడ్డారు.');
    }
    if (!pendingMandalSnap.empty) {
        throw new https_1.HttpsError('already-exists', 'ఈ మండలానికి ఇప్పటికే మరొకరు దరఖాస్తు (PENDING) చేశారు. దయచేసి వేరే మండలం ఎంచుకోండి.');
    }
    // Save application to Firestore with PENDING status
    await db.collection('reporter_applications').add({
        ...data,
        district: trimmedDistrict,
        mandal: trimmedMandal,
        status: "PENDING",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    // Send notification email
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    const emailContent = `
        New Reporter Application:
        -------------------------
        Full Name: ${fullName || 'N/A'}
        Father's Name: ${fatherName || 'N/A'}
        Phone Number: ${phone || 'N/A'}
        Address: ${address || 'N/A'}
        Position: ${position || 'N/A'}
        Interested Area: ${interestedArea || 'N/A'}
        Educational Qualification: ${education || 'N/A'}
        Currently Working Organization: ${currentOrg || 'N/A'}
        State: ${state || 'N/A'}
        District: ${trimmedDistrict || 'N/A'}
        Mandal: ${trimmedMandal || 'N/A'}
        Message: ${message || 'N/A'}
        User ID: ${userId || 'N/A'}
    `;
    const htmlEmail = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; margin: 0 auto;">
            <div style="background-color: #d32f2f; color: white; padding: 16px; text-align: center; font-size: 20px; font-weight: bold;">
                Alfa News - కొత్త రిపోర్టర్ దరఖాస్తు
            </div>
            <div style="padding: 20px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr><td style="padding: 8px; font-weight: bold; width: 180px;">పేరు (Full Name):</td><td style="padding: 8px;">${fullName || 'N/A'}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">తండ్రి పేరు (Father's Name):</td><td style="padding: 8px;">${fatherName || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">ఫోన్ నంబర్ (Phone):</td><td style="padding: 8px;">${phone || 'N/A'}</td></tr>
                    <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">చిరునామా (Address):</td><td style="padding: 8px;">${address || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; font-weight: bold;">రాష్ట్రం (State):</td><td style="padding: 8px;">${state || 'N/A'}</td></tr>
                    <tr style="background-color: #ffebee;"><td style="padding: 8px; font-weight: bold; color: #d32f2f;">జిల్లా (District):</td><td style="padding: 8px; font-weight: bold; color: #d32f2f; font-size: 16px;">${trimmedDistrict || 'N/A'}</td></tr>
                    <tr style="background-color: #ffebee;"><td style="padding: 8px; font-weight: bold; color: #d32f2f;">మండలం (Mandal):</td><td style="padding: 8px; font-weight: bold; color: #d32f2f; font-size: 16px;">${trimmedMandal || 'N/A'}</td></tr>
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
    try {
        await transporter.sendMail({
            from: `"Alfa News Applications" <${process.env.EMAIL_USER}>`,
            to: 'alfanews0861@gmail.com',
            subject: `రిపోర్టర్ దరఖాస్తు: ${fullName || 'N/A'} (${trimmedDistrict} - ${trimmedMandal})`,
            text: emailContent,
            html: htmlEmail
        });
    }
    catch (error) {
        console.error("Email send failed during application submission:", error.message);
        // We still return success: true because the database write succeeded.
    }
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
        const reporterId = (typeof after.reporter === 'string' ? after.reporter : after.reporter?.id) || after.reporterId || after.originalReporterId;
        if (!reporterId || reporterId.startsWith('BOT_') || reporterId.startsWith('SYSTEM_'))
            return;
        console.log(`[POST_APPROVED] Updating lastPostTimestamp for reporter: ${reporterId}`);
        await db.collection('users').doc(reporterId).set({
            lastPostTimestamp: after.timestamp || admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
});
/**
 * Automatically reset warning levels and set promotion timestamps when a user is assigned/upgraded to REPORTER
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
    const isBeforeReporter = ['REPORTER', '2', '2.0'].includes(beforeRole) || before?.role === 2 || before?.role === 2.0;
    const isAfterReporter = ['REPORTER', '2', '2.0'].includes(afterRole) || after.role === 2 || after.role === 2.0;
    // Check if user was newly promoted / upgraded to REPORTER
    if (!isBeforeReporter && isAfterReporter) {
        console.log(`[ROLE_UPGRADED] User ${event.params.userId} upgraded to REPORTER. Setting grace period timestamps...`);
        // Prevent endless trigger loops by checking if timestamps are already zeroed/set
        if (!after.promotedAt || after.warningLevel !== 0) {
            await event.data?.after.ref.update({
                warningLevel: 0,
                inProbation: false,
                lastWarningDate: null,
                promotedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastPostTimestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }
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
//# sourceMappingURL=reporter_handler.js.map