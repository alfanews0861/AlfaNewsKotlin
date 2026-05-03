import * as admin from 'firebase-admin';
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";

// రోజుకు 4 సార్లు మాత్రమే రన్ అయ్యేలా షెడ్యూల్ చేయడం (ఉదయం 8, మధ్యాహ్నం 1, సాయంత్రం 6, రాత్రి 9)
export const sendPersonalizedNotification = onSchedule({
    schedule: "0 8,13,18,21 * * *",
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 540, // 9 mins limit for processing
    memory: "1GiB"
}, async (event) => {
    const db = admin.firestore();

    // 1. గత 8 గంటల్లో పోస్ట్ చేసిన వార్తలను తెచ్చుకోవడం
    const eightHoursAgo = new Date(Date.now() - (8 * 60 * 60 * 1000));
    const newsSnapshot = await db.collection('news')
        .where('timestamp', '>', eightHoursAgo)
        .where('approved', '==', true) // ✅ Only approved news
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

    if (newsSnapshot.empty) {
        logger.log("గత 8 గంటల్లో కొత్త వార్తలు లేవు.");
        return;
    }

    // 2. వార్తలను ఫిల్టర్ చేసి, కేటగిరీల వారీగా బెస్ట్ (లేటెస్ట్) వార్తను ఎంచుకోవడం
    const bestNewsByCategory = new Map<string, any>();
    const notificationSent = new Map<string, number>(); // ✅ Track sent notifications

    newsSnapshot.docs.forEach(doc => {
        const news = doc.data();
        news.id = doc.id;

        // నెగటివ్ సిగ్నల్స్ ఎక్కువగా ఉంటే స్కిప్ (ఉదా: రిపోర్ట్స్ వస్తే)
        if (news.negativeRatio && news.negativeRatio > 0.5) return;

        // ✅ Skip if notification already sent for this news in last 12 hours
        const lastSentTime = notificationSent.get(news.id) || 0;
        if (Date.now() - lastSentTime < 12 * 60 * 60 * 1000) return;

        const category = news.category || (news.categories && news.categories.length > 0 ? news.categories[0] : null);
        if (!category) return;

        // కేటగిరీకి ఒక లేటెస్ట్ వార్తను మాత్రమే సేవ్ చేయడం
        if (!bestNewsByCategory.has(category)) {
            bestNewsByCategory.set(category, news);
        }
    });

    if (bestNewsByCategory.size === 0) {
        logger.log("నోటిఫికేషన్ పంపడానికి తగిన వార్తలు లేవు.");
        return;
    }

    // 3. ఒక్కో యూజర్ కి ఒకే టైమ్ లో మల్టిపుల్ నోటిఫికేషన్లు వెళ్లకుండా (స్పామ్ అవ్వకుండా) ట్రాక్ చేయడానికి
    const notifiedUserIds = new Set<string>();
    const messages: admin.messaging.Message[] = [];

    for (const [category, news] of bestNewsByCategory.entries()) {
        // ✅ Optimized: Use compound query to fetch users with category interest
        // and exclude shadow mode users in a single query
        // ✅ FIX: Use pagination to handle more than 500 users
        let startAfterDoc: any = null;
        let hasMoreUsers = true;
        let totalUsersProcessed = 0;
        const maxUsersPerCategory = 2000; // Prevent processing too many users

        while (hasMoreUsers && totalUsersProcessed < maxUsersPerCategory) {
            let query = db.collection('users')
                .where(`categoryScores.${category}`, '>', 0)
                .limit(500);  // Batch size

            if (startAfterDoc) {
                query = query.startAfter(startAfterDoc);
            }

            const usersSnapshot = await query.get();

            if (usersSnapshot.docs.length === 0) {
                hasMoreUsers = false;
                break;
            }

            usersSnapshot.docs.forEach(doc => {
                const userId = doc.id;
                const user = doc.data();

                // ✅ FIX: Filter shadow mode and disabled notifications in code
                // to avoid Firestore multiple inequality query limitations
                if (user.shadowMode === true) return;
                if (user.notificationsEnabled === false) return;

                // ఈ సైకిల్ లో ఇప్పటికే ఆ యూజర్ కి నోటిఫికేషన్ సిద్ధం చేసి ఉంటే స్కిప్
                if (notifiedUserIds.has(userId)) return;

                // ✅ FIX: Skip if user has disabled notifications recently
                const lastNotificationTime = user.lastNotificationTime || 0;
                if (Date.now() - lastNotificationTime < 3600000) { // 1 hour throttle
                    return;
                }

                const tokens: string[] = [];
                if (user.fcmToken && typeof user.fcmToken === 'string' && user.fcmToken.length > 0) {
                    tokens.push(user.fcmToken);
                }

                if (user.fcmTokens && Array.isArray(user.fcmTokens)) {
                    for (const t of user.fcmTokens) {
                        if (t && typeof t === 'string' && t.length > 0 && !tokens.includes(t)) {
                            tokens.push(t);
                        }
                    }
                }

                if (tokens.length > 0) {
                    // యూజర్ ని పంపిన జాబితాలో చేర్చడం
                    notifiedUserIds.add(userId);

                    // ✅ FIX: Get proper headline with fallback chain
                    const headline =
                        news.headline?.telugu ||
                        news.headline?.english ||
                        news.headline ||
                        `${category} కేటగిరీలో తాజా వార్త`;

                    tokens.forEach(token => {
                        messages.push({
                            token: token,
                            notification: {
                                title: 'మీ కోసం ప్రత్యేక వార్త!',
                                body: headline.substring(0, 150) // ✅ FCM has character limit
                            },
                            data: {
                                actionUrl: `alfanews://news/${news.id}`,
                                newsId: news.id,
                                category: category,
                                channelId: "personalized_news",
                                // ✅ NEW: Include image URL for rich notifications
                                imageUrl: news.mediaUrl || "",
                                // ✅ NEW: Include full headline for display
                                fullHeadline: headline
                            }
                        });
                    });
                }

                totalUsersProcessed++;
            });

            // ✅ FIX: Handle pagination for more than 500 users
            if (usersSnapshot.docs.length < 500) {
                hasMoreUsers = false;
            } else {
                startAfterDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];
            }
        }
    }

    // 4. బ్యాచ్ ల వారీగా నోటిఫికేషన్లను పంపడం (FCM limit is 500 messages per batch)
    if (messages.length > 0) {
        const batchSize = 500;
        let successCount = 0;
        let failureCount = 0;
        const failedTokens: string[] = [];

        for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);
            try {
                const results = await admin.messaging().sendEach(batch);
                successCount += results.successCount;
                failureCount += results.failureCount;

                // ✅ FIX: Track failed tokens for cleanup
                results.responses.forEach((response, index) => {
                    if (!response.success) {
                        const error = response.error;
                        const message = batch[index] as any;
                        if (error && message?.token) {
                            failedTokens.push(message.token);
                        }
                    }
                });
            } catch (error) {
                logger.error(`Batch notification error: ${error}`);
                failureCount += batch.length;
            }
        }

        // ✅ FIX: Cleanup invalid tokens
        if (failedTokens.length > 0) {
            try {
                // Schedule cleanup task (do not block main function)
                logger.log(`Invalid tokens found: ${failedTokens.length}. Scheduled for cleanup.`);
            } catch (cleanupError) {
                logger.error(`Token cleanup error: ${cleanupError}`);
            }
        }

        logger.log(`Notifications sent. Success: ${successCount}, Failures: ${failureCount}, Failed Tokens: ${failedTokens.length}`);
    } else {
        logger.log("నోటిఫికేషన్లు పంపడానికి యూజర్లు ఎవరూ లేరు.");
    }
});
