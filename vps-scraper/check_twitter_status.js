const admin = require('firebase-admin');
const path = require('path');

try {
    const serviceAccount = require('./firebase-service-account.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (e) {
    console.error("Could not load firebase-service-account.json:", e.message);
    process.exit(1);
}

const db = admin.firestore();

async function checkTwitterStatus() {
    console.log("\n========================================================");
    console.log(" 🔍 ALFA NEWS - TWITTER / SOCIAL FEEDS HEALTH CHECK");
    console.log("========================================================\n");

    const snap = await db.collection('social_feeds').get();
    if (snap.empty) {
        console.log("No social feeds configured in Firestore!");
        process.exit(0);
    }

    const feeds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`Total Twitter/Social Feeds Configured: ${feeds.length}\n`);

    const summaryTable = feeds.map(f => {
        let lastFetch = 'Never';
        if (f.lastFetchTime) {
            const d = f.lastFetchTime.toDate ? f.lastFetchTime.toDate() : new Date(f.lastFetchTime._seconds * 1000);
            lastFetch = d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
        }

        let statusText = f.isPaused ? '⏸️ Paused' : (f.lastStatus === 'error' ? '❌ Error' : '✅ Active');

        return {
            'Source Name': f.sourceName || 'Unnamed',
            'Handle/URL': f.handle || f.url || '',
            'Status': statusText,
            'Today': f.todayProcessedCount || 0,
            'Total': f.totalProcessedCount || 0,
            'Last Checked (IST)': lastFetch,
            'Error (if any)': f.lastError ? f.lastError.substring(0, 30) : '-'
        };
    });

    console.table(summaryTable);

    // Also check the most recently published Twitter news
    console.log("\n--------------------------------------------------------");
    console.log(" 📰 RECENTLY PUBLISHED TWEETS (Last 5 in 'news' collection)");
    console.log("--------------------------------------------------------\n");

    const recentNews = await db.collection('news')
        .where('categories', 'array-contains', 'Social')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

    if (recentNews.empty) {
        console.log("No news with 'Social' category found in last queries.");
    } else {
        recentNews.docs.forEach((d, i) => {
            const data = d.data();
            const date = data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp._seconds * 1000)) : new Date();
            const timeStr = date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
            console.log(`${i + 1}. [${data.sourceName || 'Social'}] ${timeStr}`);
            console.log(`   Headline: ${data.headline?.telugu || data.headline}`);
            console.log(`   URL: ${data.sourceUrl || data.originalUrl}`);
            console.log(`   Media: ${data.mediaUrl ? '🖼️ Attached' : '❌ None'}\n`);
        });
    }

    process.exit(0);
}

checkTwitterStatus().catch(err => {
    console.error("Error checking Twitter status:", err);
    process.exit(1);
});
