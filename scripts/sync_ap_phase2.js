const fs = require('fs');
const path = require('path');

async function syncAndhraPhase2() {
    console.log("==================================================");
    console.log("🚀 SYNCING VERIFIED ANDHRA PRADESH PHASE 2 FEEDS TO FIRESTORE");
    console.log("==================================================\n");

    const cfgPath = 'C:\\Users\\alfan\\.config\\configstore\\firebase-tools.json';
    if (!fs.existsSync(cfgPath)) {
        console.error("❌ firebase-tools.json not found!");
        process.exit(1);
    }

    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    let token = cfg.tokens?.access_token;
    if (!token) {
        console.error("❌ No access token found in firebase-tools.json");
        process.exit(1);
    }

    const feedsPath = path.join(__dirname, '..', 'andhra_phase2_verified_feeds.json');
    if (!fs.existsSync(feedsPath)) {
        console.error("❌ andhra_phase2_verified_feeds.json not found!");
        process.exit(1);
    }
    const feeds = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));
    console.log(`Loaded ${feeds.length} verified AP Phase 2 feeds to sync.\n`);

    // Fetch existing feeds to prevent duplicates
    console.log("Fetching existing feeds from Firestore...");
    let existingDocs = [];
    let pageToken = '';
    do {
        const url = 'https://firestore.googleapis.com/v1/projects/alfa-news-31bf7/databases/(default)/documents/social_feeds?pageSize=300' + (pageToken ? '&pageToken=' + pageToken : '');
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        if (data.documents) existingDocs.push(...data.documents);
        pageToken = data.nextPageToken || '';
    } while (pageToken);

    console.log(`Current Firestore social_feeds count: ${existingDocs.length}\n`);

    const existingMap = new Map();
    existingDocs.forEach(d => {
        const f = d.fields || {};
        const rawHandle = f.url ? f.url.stringValue : (f.handle ? f.handle.stringValue : '');
        const cleanHandle = rawHandle.toLowerCase().replace(/^@+/, '').replace(/^https?:\/\/(x|twitter)\.com\//, '').split('/')[0].split('?')[0].trim();
        if (cleanHandle) {
            existingMap.set(cleanHandle, {
                id: d.name.split('/').pop(),
                sourceName: f.sourceName ? f.sourceName.stringValue : '',
                district: f.district ? f.district.stringValue : '',
                state: f.state ? f.state.stringValue : ''
            });
        }
    });

    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < feeds.length; i++) {
        const item = feeds[i];
        const cleanHandle = item.url.toLowerCase().replace(/^@+/, '').trim();
        const fullHandle = `@${cleanHandle}`;

        if (existingMap.has(cleanHandle)) {
            console.log(`[${i + 1}/${feeds.length}] ⏭️ ALREADY IN DB: ${fullHandle} (${item.sourceName})`);
            skippedCount++;
            continue;
        }

        const postUrl = `https://firestore.googleapis.com/v1/projects/alfa-news-31bf7/databases/(default)/documents/social_feeds`;
        const payload = {
            fields: {
                url: { stringValue: fullHandle },
                sourceName: { stringValue: item.sourceName },
                platform: { stringValue: "Twitter" },
                category: { stringValue: item.category },
                state: { stringValue: "Andhra Pradesh" },
                district: { stringValue: item.district },
                isPaused: { booleanValue: false },
                lastStatus: { stringValue: "active" },
                lastFetchTime: { nullValue: null },
                lastError: { nullValue: null },
                totalProcessedCount: { integerValue: "0" },
                totalFailedCount: { integerValue: "0" },
                todayProcessedCount: { integerValue: "0" },
                lastProcessedCount: { integerValue: "0" },
                lastFailedCount: { integerValue: "0" }
            }
        };

        try {
            const res = await fetch(postUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const resData = await res.json();
            if (resData.error) {
                console.error(`❌ Error inserting ${fullHandle}:`, resData.error.message);
                errorCount++;
            } else {
                console.log(`[${i + 1}/${feeds.length}] ✅ INSERTED: ${fullHandle} (${item.sourceName}) -> 📍 ${item.district}`);
                insertedCount++;
            }
        } catch (e) {
            console.error(`❌ Exception inserting ${fullHandle}:`, e.message);
            errorCount++;
        }
    }

    console.log("\n==================================================");
    console.log(`🎉 ANDHRA PRADESH PHASE 2 SYNC COMPLETE!`);
    console.log(`   Total Candidates: ${feeds.length}`);
    console.log(`   ✅ Inserted:      ${insertedCount}`);
    console.log(`   ⏭️ Skipped:       ${skippedCount}`);
    console.log(`   ❌ Errors:        ${errorCount}`);
    console.log("==================================================");
}

syncAndhraPhase2().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
