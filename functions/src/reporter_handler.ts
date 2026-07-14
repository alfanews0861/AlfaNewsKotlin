import * as admin from "firebase-admin";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as nodemailer from "nodemailer";
import { REGION } from "./utils";

const db = admin.firestore();

const MILESTONE_SIZE = 500;
const POINTS_PER_MILESTONE = 50;

/**
 * Helper: Notify reporter with human-friendly messages
 */
export async function notifyReporter(
    reporterId: string,
    postId: string,
    headline: string,
    type: 'SUCCESS' | 'INTERNAL_ERROR' | 'POLICY_VIOLATION',
    imageUrl?: string
) {
    try {
        const userDoc = await db.collection('users').doc(reporterId).get();
        if (!userDoc.exists) return;

        const userData = userDoc.data();
        if (userData && userData.notificationsEnabled === false) return;

        const tokens: string[] = [];
        if (userData?.fcmToken) tokens.push(userData.fcmToken);
        if (Array.isArray(userData?.fcmTokens)) {
            userData.fcmTokens.forEach((t: any) => {
                if (t && typeof t === 'string' && !tokens.includes(t)) tokens.push(t);
            });
        }

        if (tokens.length === 0) return;

        let title = "";
        let body = "";

        if (type === 'SUCCESS') {
            title = 'వార్త ప్రచురించబడింది! ✅';
            body = `మీ వార్త: "${headline.substring(0, 50)}..." విజయవంతంగా ప్రచురించబడింది.`;
        } else if (type === 'POLICY_VIOLATION') {
            title = 'వార్త తిరస్కరించబడింది! ⚠️';
            body = `మీ వార్తలోని అంశాలు మా నిబంధనలకు విరుద్ధంగా ఉన్నందున ప్రచురించబడలేదు.`;
        } else {
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

        const sendPromises = tokens.map(token =>
            admin.messaging().send({ ...message, token }).catch(async err => {
                if (err.code === 'messaging/registration-token-not-registered' ||
                    err.code === 'messaging/invalid-registration-token') {
                    const updates: any = {};
                    if (userData?.fcmToken === token) updates.fcmToken = admin.firestore.FieldValue.delete();
                    updates.fcmTokens = admin.firestore.FieldValue.arrayRemove(token);
                    await db.collection('users').doc(reporterId).update(updates).catch(() => {});
                }
            })
        );

        await Promise.all(sendPromises);
    } catch (e: any) {
        console.error(`[NOTIFY] Error:`, e.message);
    }
}

/**
 * Award points to reporter and update badges
 */
export async function awardPointsToReporter(reporterId: string, points: number) {
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

            const data = doc.exists ? doc.data()! : {};
            const currentPoints = (data.points || 0) + points;

            // Calculate badges
            const badges: string[] = [];
            if (currentPoints >= 100) badges.push("BRONZE");
            if (currentPoints >= 500) badges.push("SILVER");
            if (currentPoints >= 2000) badges.push("GOLD");
            if (currentPoints >= 10000) badges.push("DIAMOND");

            transaction.set(userRef, {
                points: currentPoints,
                badges: badges
            }, { merge: true });

            if (monthlyDoc.exists) {
                transaction.update(monthlyRef, {
                    points: admin.firestore.FieldValue.increment(points),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
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
    } catch (e: any) {
        console.error(`[POINTS_ERR] Error:`, e.message);
    }
}

/**
 * Backfill points for all reporters based on their existing news posts
 */
export const backfillReporterPoints = onCall(async (request) => {
    // Only admins can trigger backfill
    const auth = request.auth;
    if (!auth || !auth.uid) {
        throw new HttpsError('unauthenticated', 'మీరు లాగిన్ అవ్వాలి.');
    }

    const adminDoc = await db.collection('users').doc(auth.uid).get();
    if (adminDoc.data()?.role !== 'ADMIN') {
        throw new HttpsError('permission-denied', 'అడ్మిన్లకు మాత్రమే ఈ అనుమతి ఉంది.');
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
        const monthlyPointsMap: { [key: string]: number } = {};

        newsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const mediaType = data.mediaType?.toUpperCase() || "";
            const mediaTypes = (data.mediaTypes || []).map((t: string) => t.toUpperCase());
            const isVideo = mediaType === 'VIDEO' || mediaTypes.includes('VIDEO');

            const postPoints = isVideo ? 20 : 10;
            totalPoints += postPoints;

            // Calculate monthly points
            const ts = data.timestamp;
            let date: Date;
            if (ts && typeof ts.toDate === 'function') {
                date = ts.toDate();
            } else if (ts && ts._seconds) {
                date = new Date(ts._seconds * 1000);
            } else {
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
        const badges: string[] = [];
        if (totalPoints >= 100) badges.push("BRONZE");
        if (totalPoints >= 500) badges.push("SILVER");
        if (totalPoints >= 2000) badges.push("GOLD");
        if (totalPoints >= 10000) badges.push("DIAMOND");

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
export const onNewsViewCountUpdated = onDocumentWritten({
    document: "news/{postId}",
    region: REGION,
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after || !after.isReporter) return;

    const viewsBefore = before?.longViews || 0;
    const viewsAfter = after.longViews || 0;

    // ✅ Quick guard: exit if longViews hasn't changed (saves execution time)
    if (viewsBefore === viewsAfter) return;
    const reporterId = after.reporter?.id;
    if (!reporterId) return;

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
export const processReporterSubmission = onCall(async (request) => {
    const { postId, headline: rawHeadline, content: rawContent, postData } = request.data;

    try {
        console.log(`[REPORTER_SUBMISSION] Quick acceptance for post: ${postId || 'new'}`);

        const headline = rawHeadline || postData?.headline?.telugu || "";
        const content = rawContent || postData?.content?.telugu || "";

        if (!headline || !content) {
            throw new HttpsError('invalid-argument', 'వార్త శీర్షిక మరియు వివరణ తప్పనిసరి.');
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
        } else {
            const newDocRef = await db.collection('news').add(finalData);
            return { success: true, postId: newDocRef.id, message: "వార్త ప్రచురించబడుతోంది (నేపథ్యంలో)..." };
        }
    } catch (e: any) {
        console.error(`[REPORTER_SUBMISSION] Critical Error:`, e.message);
        throw new HttpsError('internal', e.message);
    }
});

export const submitReporterApplication = onCall({ secrets: ["EMAIL_USER", "EMAIL_PASS"] }, async (request) => {
    const data = request.data;
    const { district, mandal } = data;

    if (!district || !mandal) {
        throw new HttpsError('invalid-argument', 'జిల్లా మరియు మండలం తప్పనిసరి.');
    }

    const trimmedDistrict = district.trim();
    const trimmedMandal = mandal.trim();

    // Check if reporter already exists for this mandal in users collection
    const reporterQuery = db.collection('users')
        .where('role', 'in', ['REPORTER', 2, 2.0])
        .where('district', '==', trimmedDistrict)
        .where('assignedMandal', '==', trimmedMandal)
        .limit(1)
        .get();

    // Check if there is already a JOINED application for this mandal
    const appQuery = db.collection('reporter_applications')
        .where('status', '==', 'JOINED')
        .where('district', '==', trimmedDistrict)
        .where('mandal', '==', trimmedMandal)
        .limit(1)
        .get();

    const [reporterSnap, appSnap] = await Promise.all([reporterQuery, appQuery]);

    if (!reporterSnap.empty || !appSnap.empty) {
        throw new HttpsError('already-exists', 'ఈ మండలానికి ఇప్పటికే రిపోర్టర్ కేటాయించబడ్డారు.');
    }

    await db.collection('reporter_applications').add({
        ...data,
        district: trimmedDistrict,
        mandal: trimmedMandal,
        status: "PENDING",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});

/**
 * Update reporter's last post timestamp when a post is approved
 */
export const onNewsPostApproved = onDocumentWritten({
    document: "news/{postId}",
    region: REGION,
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    // Trigger only if status changes to published or approved becomes true
    if (after && after.approved === true && before?.approved !== true) {
        const reporterId = after.reporter?.id;
        if (!reporterId || reporterId.startsWith('BOT_') || reporterId.startsWith('SYSTEM_')) return;

        console.log(`[POST_APPROVED] Updating lastPostTimestamp for reporter: ${reporterId}`);
        await db.collection('users').doc(reporterId).set({
            lastPostTimestamp: after.timestamp || admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
});

/**
 * 6.2 Verify Reporter (Web Page)
 */
export const verifyReporter = onRequest(async (req, res) => {
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
    } catch (error: any) {
        console.error("Verification error:", error);
        res.status(500).send("<h1>Internal Server Error</h1>");
    }
});

/**
 * Helper: Find assigned reporter for a specific Mandalam in a District
 */
export async function getAssignedReporter(district: string, mandalam: string): Promise<{ id: string, name: string } | null> {
    try {
        if (!district || !mandalam) return null;

        const reporters = await db.collection('users')
            .where('role', '==', 'REPORTER')
            .where('district', '==', district)
            .where('assignedMandal', '==', mandalam)
            .limit(1)
            .get();

        if (reporters.empty) return null;

        const data = reporters.docs[0].data();
        return {
            id: reporters.docs[0].id,
            name: data.name || "Reporter"
        };
    } catch (e) {
        console.error(`[GET_ASSIGNED_REPORTER_ERR] ${district}/${mandalam}:`, e);
        return null;
    }
}
