import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as nodemailer from "nodemailer";

const db = admin.firestore();

/**
 * Helper: Notify reporter with human-friendly messages
 */
export async function notifyReporter(reporterId: string, postId: string, headline: string, type: 'SUCCESS' | 'INTERNAL_ERROR' | 'POLICY_VIOLATION', imageUrl?: string) {
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
            android: { notification: { imageUrl: imageUrl || "" } },
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
                if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token') {
                    const updates: any = {};
                    if (userData?.fcmToken === token) updates.fcmToken = admin.firestore.FieldValue.delete();
                    updates.fcmTokens = admin.firestore.FieldValue.arrayRemove(token);
                    await db.collection('users').doc(reporterId).update(updates).catch(() => {});
                }
            })
        );
        await Promise.all(sendPromises);
    } catch (e: any) { console.error(`[NOTIFY] Error:`, e.message); }
}

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
            headline: { telugu: headline, english: postData?.headline?.english || "" },
            content: { telugu: content, english: postData?.content?.telugu || "" },
            mediaUrl: mediaUrl,
            mediaUrls: mediaUrls,
            isReporter: true,
            isCitizen: false,
            aiProcessed: false,
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
    await db.collection('reporter_applications').add({ ...data, timestamp: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true };
});
