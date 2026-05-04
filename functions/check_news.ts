import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'alfa-news-31bf7'
    });
}

async function check() {
    const db = admin.firestore();
    const eightHoursAgo = new Date(Date.now() - (8 * 60 * 60 * 1000));
    console.log("Checking news since:", eightHoursAgo.toISOString());

    const snapshot = await db.collection('news')
        .where('timestamp', '>', eightHoursAgo)
        .get();

    console.log("Total news found in last 8 hours:", snapshot.size);
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}, Approved: ${data.approved}, Status: ${data.status}, Category: ${data.category}`);
    });

    process.exit(0);
}

check();
