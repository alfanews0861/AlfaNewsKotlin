
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function checkSources() {
    console.log("Checking scraping sources...");
    const sourcesSnap = await db.collection('scraping_sources').get();
    console.log(`Total sources: ${sourcesSnap.size}`);

    const groups: Record<number, number> = {};
    const statuses: Record<string, number> = {};

    sourcesSnap.docs.forEach(doc => {
        const data = doc.data();
        const group = data.group || 1;
        groups[group] = (groups[group] || 0) + 1;

        const status = data.lastStatus || 'unknown';
        statuses[status] = (statuses[status] || 0) + 1;

        if (data.lastError) {
            console.log(`Source [${data.siteName}] has error: ${data.lastError}`);
        }

        const lastFetch = data.lastFetchTime ? data.lastFetchTime.toDate() : 'never';
        console.log(`- ${data.siteName} (Group ${group}): Status=${status}, LastFetch=${lastFetch}, 24hProcessed=${data.processed24h || 0}`);
    });

    console.log("\nGroup Distribution:", groups);
    console.log("Status Distribution:", statuses);
}

checkSources().catch(console.error);
