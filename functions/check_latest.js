const admin = require('firebase-admin');
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'alfa-news-31bf7'
    });
}
const db = admin.firestore();

async function check() {
    console.log("Checking latest 5 news posts...");
    const snapshot = await db.collection('news').orderBy('timestamp', 'desc').limit(5).get();
    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`  Headline: ${data.headline?.telugu || 'N/A'}`);
        console.log(`  Status: ${data.status}`);
        console.log(`  AI Processed: ${data.aiProcessed}`);
        console.log(`  Video Processed: ${data.videoProcessed}`);
        console.log(`  Timestamp: ${data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp}`);
        console.log("-------------------");
    });
}

check().catch(console.error);
