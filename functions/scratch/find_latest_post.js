const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function findLatest() {
    const snapshot = await db.collection('news').orderBy('timestamp', 'desc').limit(1).get();
    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        console.log('LATEST_POST_ID:', doc.id);
        console.log('DATA:', JSON.stringify(doc.data(), null, 2));
    } else {
        console.log('No posts found');
    }
    process.exit(0);
}

findLatest();
