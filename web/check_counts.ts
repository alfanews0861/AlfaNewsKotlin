
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "alfa-news-31bf7"
    });
}

const db = admin.firestore();

async function checkCounts() {
    const apifyFeeds = await db.collection('apify_facebook_feeds').get();
    const fbFeeds = await db.collection('facebook_feeds').get();
    
    console.log(`apify_facebook_feeds count: ${apifyFeeds.size}`);
    console.log(`facebook_feeds count: ${fbFeeds.size}`);
    
    if (apifyFeeds.size > 0) {
        console.log("First 5 Apify Feeds:");
        apifyFeeds.docs.slice(0, 5).forEach(d => console.log(`- ${d.id}: ${d.data().sourceName} (${d.data().url})`));
    }
}

checkCounts().catch(console.error);
