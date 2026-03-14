const admin = require('firebase-admin');

// Use application default credentials
admin.initializeApp({
    projectId: 'alfa-news-31bf7'
});

const db = admin.firestore();

async function checkScrapingSources() {
    console.log('=== CHECKING SCRAPING SOURCES ===\n');

    const sourcesSnap = await db.collection('scraping_sources').get();
    console.log(`Total sources in database: ${sourcesSnap.size}\n`);

    if (sourcesSnap.empty) {
        console.log('❌ NO SCRAPING SOURCES FOUND!');
        console.log('Please add sources via Admin Panel.');
        process.exit(0);
    }

    sourcesSnap.forEach((doc, index) => {
        const data = doc.data();
        console.log(`--- Source ${index + 1} ---`);
        console.log(`Site Name: ${data.siteName || 'N/A'}`);
        console.log(`URL: ${data.url || 'N/A'}`);
        console.log(`Category: ${data.category || 'N/A'}`);
        console.log(`District: ${data.district || 'N/A'}`);
        console.log(`State: ${data.state || 'N/A'}`);
        console.log(`Group: ${data.group !== undefined ? data.group : 'Not Set (defaults to 1)'}`);
        console.log(`Is Paused: ${data.isPaused === true ? 'YES ⏸️' : 'NO ✅'}`);
        console.log(`Last Status: ${data.lastStatus || 'Never Run'}`);
        console.log(`Last Error: ${data.lastError || 'None'}`);
        console.log(`Last Processed Count: ${data.lastProcessedCount || 0}`);
        console.log(`Last Failed Count: ${data.lastFailedCount || 0}`);
        console.log(`Processed (24h): ${data.processed24h || 0}`);
        console.log(`Failed (24h): ${data.failed24h || 0}`);

        if (data.lastFetchTime) {
            const lastFetch = data.lastFetchTime.toDate();
            console.log(`Last Fetch: ${lastFetch.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
        } else {
            console.log(`Last Fetch: Never`);
        }
        console.log('');
    });

    // Check recent news
    console.log('\n=== CHECKING RECENT NEWS ===\n');
    const newsSnap = await db.collection('news')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

    console.log(`Total recent news items: ${newsSnap.size}\n`);

    if (newsSnap.empty) {
        console.log('❌ NO NEWS FOUND IN DATABASE!');
    } else {
        newsSnap.forEach((doc, index) => {
            const data = doc.data();
            console.log(`${index + 1}. ${data.headline?.telugu || data.headline?.english || 'No headline'}`);
            console.log(`   Source: ${data.originalUrl || 'Manual Post'}`);
            console.log(`   Categories: ${data.categories?.join(', ') || data.category || 'N/A'}`);
            if (data.timestamp) {
                const ts = data.timestamp.toDate();
                console.log(`   Time: ${ts.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
            }
            console.log('');
        });
    }

    process.exit(0);
}

checkScrapingSources().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
