const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function run() {
    const db = admin.firestore();
    console.log("Triggering test update in Firestore...");
    await db.collection('news').doc('test_trigger_doc_' + Date.now()).set({
        headline: { telugu: "టెస్ట్ వార్త " + Date.now(), english: "Test News" },
        content: { telugu: "టెస్ట్ వివరణ", english: "Test Content" },
        status: "PENDING",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("Document written successfully.");
    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
