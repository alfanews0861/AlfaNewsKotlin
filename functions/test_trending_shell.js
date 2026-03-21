const admin = require('firebase-admin');
const fs = require('fs');

admin.initializeApp();
const db = admin.firestore();

async function run() {
  try {
     const data = JSON.parse(fs.readFileSync('generated_news.json', 'utf8'));
     for (let d of data) {
         d.timestamp = admin.firestore.FieldValue.serverTimestamp();
         d.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
         const res = await db.collection('news').add(d);
         console.log('Added:', res.id);
     }
  } catch(e) {
      console.error(e);
  }
}
run();