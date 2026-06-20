import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
    admin.initializeApp();
}

async function run() {
    const db = admin.firestore();
    console.log("Triggering test update...");
    await db.collection('news').doc('test_trigger_doc').set({
        headline: { telugu: "టెస్ట్ వార్త", english: "Test News" },
        content: { telugu: "టెస్ట్ వివరణ", english: "Test Content" },
        status: "PENDING",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("Done.");
}

run().catch(console.error);
