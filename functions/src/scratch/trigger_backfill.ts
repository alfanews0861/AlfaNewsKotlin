import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

async function triggerBackfill() {
    console.log("Starting points backfill process...");

    // We can't easily call onCall from here without auth simulation,
    // so we'll just run the logic directly or tell the user to use the app button.
    // However, for immediate fix, I can provide a script that does the same logic.

    // Actually, it's better to just use the logic from reporter_handler.ts
    // but adapted for a standalone script.

    const reportersSnapshot = await db.collection('users').where('role', '==', 'REPORTER').get();
    console.log(`Processing ${reportersSnapshot.size} reporters...`);

    const MILESTONE_SIZE = 500;
    const POINTS_PER_MILESTONE = 50;

    for (const reporterDoc of reportersSnapshot.docs) {
        const reporterId = reporterDoc.id;
        const reporterData = reporterDoc.data();

        const newsSnapshot = await db.collection('news')
            .where('reporter.id', '==', reporterId)
            .where('approved', '==', true)
            .get();

        let totalPoints = 0;
        const monthlyPointsMap: { [key: string]: number } = {};

        newsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const mediaType = data.mediaType?.toUpperCase() || "";
            const mediaTypes = (data.mediaTypes || []).map((t: string) => t.toUpperCase());
            const isVideo = mediaType === 'VIDEO' || mediaTypes.includes('VIDEO');

            const postPoints = isVideo ? 20 : 10;
            totalPoints += postPoints;

            const ts = data.timestamp;
            let date: Date;
            if (ts && typeof ts.toDate === 'function') {
                date = ts.toDate();
            } else if (ts && (ts as any)._seconds) {
                date = new Date((ts as any)._seconds * 1000);
            } else {
                date = new Date();
            }

            const monthId = `${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            monthlyPointsMap[monthId] = (monthlyPointsMap[monthId] || 0) + postPoints;

            const longViews = data.longViews || 0;
            const viewMilestones = Math.floor(longViews / MILESTONE_SIZE);
            const viewPoints = (viewMilestones * POINTS_PER_MILESTONE);
            totalPoints += viewPoints;
            monthlyPointsMap[monthId] = (monthlyPointsMap[monthId] || 0) + viewPoints;
        });

        const badges: string[] = [];
        if (totalPoints >= 100) badges.push("BRONZE");
        if (totalPoints >= 500) badges.push("SILVER");
        if (totalPoints >= 2000) badges.push("GOLD");
        if (totalPoints >= 10000) badges.push("DIAMOND");

        await db.collection('users').doc(reporterId).update({
            points: totalPoints,
            badges: badges,
            lastPostTimestamp: newsSnapshot.empty ? null : newsSnapshot.docs[0].data().timestamp
        });

        for (const [monthId, points] of Object.entries(monthlyPointsMap)) {
            const monthlyRef = db.collection('monthly_leaderboard').doc(monthId)
                .collection('reporters').doc(reporterId);

            await monthlyRef.set({
                userId: reporterId,
                name: reporterData.name || "Reporter",
                photoUrl: reporterData.photoUrl || "",
                district: reporterData.district || "",
                assignedMandal: reporterData.assignedMandal || "",
                points: points,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        console.log(`Updated ${reporterData.name}: ${totalPoints} pts`);
    }
    console.log("Backfill completed successfully.");
}

triggerBackfill().catch(console.error);
