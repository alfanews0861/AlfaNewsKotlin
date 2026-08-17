const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'alfa-news-31bf7' });
}

const db = admin.firestore();

async function checkLogs() {
    console.log("Checking recent news posts...");
    const snap = await db.collection('news').orderBy('timestamp', 'desc').limit(5).get();
    snap.forEach(doc => {
        const d = doc.data();
        console.log("------------------------------------------");
        console.log("Post ID:", doc.id);
        console.log("Status:", d.status);
        console.log("videoProcessed:", d.videoProcessed);
        console.log("processingError:", d.processingError);
        console.log("failedAt:", d.failedAt?.toDate?.());
        console.log("headline:", d.headline?.telugu || d.headline);
    });
}

checkLogs().catch(err => console.error("Error:", err.message));
