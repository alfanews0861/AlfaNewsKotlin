const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const postId = 'M0pMa2cioUBrtJ8VPXYt';

async function checkPost() {
    const doc = await db.collection('news').doc(postId).get();
    if (doc.exists) {
        console.log('POST_DATA:', JSON.stringify(doc.data(), null, 2));
    } else {
        console.log('Post not found');
    }
    process.exit(0);
}

checkPost();
