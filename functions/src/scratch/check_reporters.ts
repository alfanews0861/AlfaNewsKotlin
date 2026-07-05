import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

async function checkReporters() {
    console.log("Checking reporters...");
    const snapshot = await db.collection('users').where('role', '==', 'REPORTER').get();
    console.log(`Found ${snapshot.size} reporters.`);

    const reportersWithPoints = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        points: doc.data().points || 0
    })).sort((a, b) => b.points - a.points);

    console.log("Top 5 reporters by points:");
    reportersWithPoints.slice(0, 5).forEach((r, i) => {
        console.log(`${i+1}. ${r.name} (${r.id}): ${r.points} points`);
    });

    const reportersWithNoPoints = reportersWithPoints.filter(r => r.points === 0);
    console.log(`Reporters with 0 points: ${reportersWithNoPoints.length}`);
}

checkReporters().catch(console.error);
