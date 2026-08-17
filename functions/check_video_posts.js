const admin = require('firebase-admin');
if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'alfa-news-31bf7' });
}
const db = admin.firestore();

async function check() {
    const snap = await db.collection('news').where('approved', '==', true).get();
    let total = snap.size;
    let videoWithoutYt = 0;
    const items = [];
    snap.docs.forEach(doc => {
        const d = doc.data();
        const mTypes = (d.mediaTypes || []).map(t => (t || '').toUpperCase());
        const isVideo = mTypes.includes('VIDEO') || (d.mediaType || '').toUpperCase() === 'VIDEO';
        const hasYt = d.youtubeUrl && d.youtubeUrl.length > 5;
        if (isVideo && !hasYt) {
            videoWithoutYt++;
            items.push({ id: doc.id, status: d.status, mediaUrl: d.mediaUrl });
        }
    });
    console.log(`Total approved posts: ${total}, Approved video posts WITHOUT YouTube URL: ${videoWithoutYt}`);
    console.log(JSON.stringify(items, null, 2));
}

check().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
