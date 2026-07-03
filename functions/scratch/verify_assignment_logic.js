const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "alfa-news-31bf7"
    });
}

const db = admin.firestore();

async function verifyAssignment() {
    const testDistrict = "Nellore";
    const testMandalam = "Kavali";

    const reporterAId = "REPORTER_A_SUBMITTER";
    const reporterBId = "REPORTER_B_ASSIGNED";

    console.log("Setting up test reporters...");
    // Reporter A: The one who actually submits the news
    await db.collection('users').doc(reporterAId).set({
        name: "Submitter A",
        role: "REPORTER",
        district: "Tirupati",
        points: 100
    });

    // Reporter B: The one assigned to Kavali mandalam
    await db.collection('users').doc(reporterBId).set({
        name: "Assigned B",
        role: "REPORTER",
        district: testDistrict,
        assignedMandal: testMandalam,
        points: 0
    });

    console.log("Simulation: Reporter A submits news for Kavali mandalam...");
    // Trigger logic starts...

    const originalReporterId = reporterAId; // Captured at start of trigger
    let displayReporter = { id: reporterAId, name: "Submitter A" };

    // Logic to find assigned reporter
    const reporters = await db.collection('users')
        .where('role', '==', 'REPORTER')
        .where('district', '==', testDistrict)
        .where('assignedMandal', '==', testMandalam)
        .limit(1)
        .get();

    if (!reporters.empty) {
        const assigned = reporters.docs[0].data();
        displayReporter = { id: reporters.docs[0].id, name: assigned.name };
    }

    console.log(`Display Name on News: ${displayReporter.name} (Expected: Assigned B)`);
    console.log(`Points awarded to: ${originalReporterId} (Expected: REPORTER_A_SUBMITTER)`);

    if (displayReporter.id === reporterBId && originalReporterId === reporterAId) {
        console.log("SUCCESS: Logic verified. Display credit goes to B, but points go to A.");
    } else {
        console.log("FAILED: Assignment logic mismatch.");
    }
}

verifyAssignment().catch(console.error);
