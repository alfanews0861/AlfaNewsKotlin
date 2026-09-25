const fs = require('fs');
const path = require('path');

async function syncTelanganaLeaders() {
    console.log("==================================================");
    console.log("🚀 TELANGANA LEADERS TWITTER FEEDS SYNC TO FIRESTORE");
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

    const leadersPath = path.join(__dirname, '..', 'telangana_leaders_feeds.json');
    if (!fs.existsSync(leadersPath)) {
        console.error("❌ telangana_leaders_feeds.json not found!");
        process.exit(1);
    }
    const leaders = JSON.parse(fs.readFileSync(leadersPath, 'utf8'));
    console.log(`Loaded ${leaders.length} Telangana political leaders to sync across all 33 districts.\n`);

    // 1. Fetch all current social_feeds from Firestore to prevent any duplication
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

    let updatedCount = 0;
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < leaders.length; i++) {
        const item = leaders[i];
        const cleanHandle = item.handle.toLowerCase().replace(/^@+/, '').trim();
        const fullHandle = `@${cleanHandle}`;

        if (existingMap.has(cleanHandle)) {
            // Update existing
            const existing = existingMap.get(cleanHandle);
            if (existing.district !== item.district || existing.state !== 'Telangana') {
                const patchUrl = `https://firestore.googleapis.com/v1/projects/alfa-news-31bf7/databases/(default)/documents/social_feeds/${existing.id}?updateMask.fieldPaths=district&updateMask.fieldPaths=state&updateMask.fieldPaths=category`;
                try {
                    const res = await fetch(patchUrl, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            fields: {
                                district: { stringValue: item.district },
                                state: { stringValue: 'Telangana' },
                                category: { stringValue: 'రాజకీయం' }
                            }
                        })
                    });
                    const resData = await res.json();
                    if (resData.error) {
                        console.error(`❌ Error updating ${fullHandle}:`, resData.error.message);
                        errorCount++;
                    } else {
                        console.log(`[${i + 1}/${leaders.length}] 🔄 UPDATED: ${fullHandle} (${item.name}) -> 📍 ${item.district}`);
                        updatedCount++;
                    }
                } catch (e) {
                    console.error(`❌ Exception updating ${fullHandle}:`, e.message);
                    errorCount++;
                }
            } else {
                console.log(`[${i + 1}/${leaders.length}] ⏭️ ALREADY UP TO DATE: ${fullHandle} -> 📍 ${item.district}`);
            }
        } else {
            // Insert new
            const postUrl = `https://firestore.googleapis.com/v1/projects/alfa-news-31bf7/databases/(default)/documents/social_feeds`;
            const payload = {
                fields: {
                    url: { stringValue: fullHandle },
                    sourceName: { stringValue: item.name },
                    platform: { stringValue: "Twitter" },
                    category: { stringValue: "రాజకీయం" },
                    state: { stringValue: "Telangana" },
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
                    console.log(`[${i + 1}/${leaders.length}] ✅ INSERTED: ${fullHandle} (${item.name}) -> 📍 ${item.district}`);
                    insertedCount++;
                    existingMap.set(cleanHandle, { id: resData.name?.split('/').pop(), district: item.district, state: 'Telangana' });
                }
            } catch (e) {
                console.error(`❌ Exception inserting ${fullHandle}:`, e.message);
                errorCount++;
            }
        }

        // Small delay every 10 requests to avoid rate limits
        if (i % 10 === 0 && i > 0) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    console.log("\n==================================================");
    console.log("📊 SYNC COMPLETE SUMMARY");
    console.log("==================================================");
    console.log(`✅ Newly Added Feeds: ${insertedCount}`);
    console.log(`🔄 Updated Existing Feeds: ${updatedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`Total Telangana Leaders Processed: ${leaders.length}`);
}

syncTelanganaLeaders();
