
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkCounts() {
    try {
        const newsSnap = await db.collection('news').limit(5).get();
        console.log(`Total news samples: ${newsSnap.size}`);
        newsSnap.forEach(doc => {
            console.log(`Document ID: ${doc.id}`);
            console.log(`Data:`, JSON.stringify(doc.data(), null, 2));
        });

        const sourcesSnap = await db.collection('scraping_sources').get();
        console.log(`Total scraping sources: ${sourcesSnap.size}`);
        sourcesSnap.forEach(doc => {
            console.log(`Source Document ID: ${doc.id}`);
            console.log(`Source Name: ${doc.data().siteName}, District: ${doc.data().district}, isPaused: ${doc.data().isPaused}`);
        });

        const scannedSnap = await db.collection('scanned_urls').limit(5).get();
        console.log(`Total scanned URLs (approx): ${scannedSnap.size} (sampled)`);

    } catch (error) {
        console.error("Error checking counts:", error);
    }
}

checkCounts();
