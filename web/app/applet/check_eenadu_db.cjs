const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT || 'ais-dev-vrmacxrw6p7e7iucxlnr6x'
});

const db = admin.firestore();

async function checkFeeds() {
  const snapshot = await db.collection('web_scraping_sources').get();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.url.includes('eenadu')) {
        console.log(doc.id, '=>', data.url, 'District:', data.district);
    }
  });
}

checkFeeds();
