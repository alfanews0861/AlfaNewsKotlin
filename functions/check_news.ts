
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function checkLatestNews() {
    console.log("Checking latest news...");
    const newsSnap = await db.collection('news')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

    if (newsSnap.empty) {
        console.log("No news found.");
        return;
    }

    newsSnap.docs.forEach(doc => {
        const data = doc.data();
        const ts = data.timestamp ? data.timestamp.toDate() : 'no ts';
        console.log(`[${ts}] ${data.headline?.telugu?.substring(0, 50)}... (Source: ${data.originalUrl})`);
    });
}

checkLatestNews().catch(console.error);
