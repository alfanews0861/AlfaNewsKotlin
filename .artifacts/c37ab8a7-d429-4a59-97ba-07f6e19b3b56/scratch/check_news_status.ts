import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
    admin.initializeApp();
}

async function checkNews() {
    const db = admin.firestore();
    const now = new Date();
    const sinceTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log(`Checking news since: ${sinceTime.toISOString()}`);

    const newsSnapshot = await db.collection('news')
        .where('approved', '==', true)
        .where('timestamp', '>', sinceTime)
        .get();

    if (newsSnapshot.empty) {
        console.log("No approved news found in the last 24 hours.");
        return;
    }

    console.log(`Found ${newsSnapshot.docs.length} approved news articles.`);
    newsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}, Headline: ${data.headline?.telugu || data.headline}, Score: ${data.score}, Timestamp: ${data.timestamp.toDate()}`);
    });

    const settingsDoc = await db.collection('settings').doc('notifications').get();
    console.log("Notification Settings:", JSON.stringify(settingsDoc.data(), null, 2));
}

checkNews().catch(console.error);
