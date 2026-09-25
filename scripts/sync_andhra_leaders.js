const fs = require('fs');
const path = require('path');

async function syncAndhraLeaders() {
    console.log("==================================================");
    console.log("🚀 ANDHRA PRADESH LEADERS TWITTER FEEDS SYNC TO FIRESTORE");
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

    const leadersPath = path.join(__dirname, '..', 'andhra_leaders_feeds.json');
    if (!fs.existsSync(leadersPath)) {
        console.error("❌ andhra_leaders_feeds.json not found!");
        process.exit(1);
    }
    const leaders = JSON.parse(fs.readFileSync(leadersPath, 'utf8'));
    console.log(`Loaded ${leaders.length} Andhra Pradesh political leaders across all 26 districts.\n`);

    // 1. Fetch all current social_feeds from Firestore to prevent duplicate entries
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
                state: f.state ? f.state.stringValue : '',
                category: f.category ? f.category.stringValue : ''
            });
        }
    });

    let updatedCount = 0;
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < leaders.length; i++) {
        const item = leaders[i];
        const cleanHandle = item.handle.toLowerCase().replace(/^@+/, '').trim();
        const fullHandle = `@${cleanHandle}`;

        if (existingMap.has(cleanHandle)) {
            const existing = existingMap.get(cleanHandle);
            // Check if district or state needs update
            if (existing.district !== item.district || existing.state !== 'Andhra Pradesh') {
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
                                state: { stringValue: 'Andhra Pradesh' },
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
                skippedCount++;
            }
        } else {
            // Insert new feed
            const postUrl = `https://firestore.googleapis.com/v1/projects/alfa-news-31bf7/databases/(default)/documents/social_feeds`;
            const docBody = {
                fields: {
                    url: { stringValue: fullHandle },
                    sourceName: { stringValue: item.name },
                    platform: { stringValue: 'Twitter' },
                    category: { stringValue: 'రాజకీయం' },
                    state: { stringValue: 'Andhra Pradesh' },
                    district: { stringValue: item.district },
                    isPaused: { booleanValue: false },
                    lastStatus: { stringValue: 'active' },
                    createdAt: { timestampValue: new Date().toISOString() }
                }
            };

            try {
                const res = await fetch(postUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(docBody)
                });
                const resData = await res.json();
                if (resData.error) {
                    console.error(`❌ Error inserting ${fullHandle}:`, resData.error.message);
                    errorCount++;
                } else {
                    console.log(`[${i + 1}/${leaders.length}] ➕ ADDED: ${fullHandle} (${item.name}) -> 📍 ${item.district}`);
                    insertedCount++;
                    existingMap.set(cleanHandle, {
                        id: resData.name.split('/').pop(),
                        sourceName: item.name,
                        district: item.district,
                        state: 'Andhra Pradesh'
                    });
                }
            } catch (e) {
                console.error(`❌ Exception inserting ${fullHandle}:`, e.message);
                errorCount++;
            }
        }

        // Small throttle
        if ((i + 1) % 15 === 0) {
            await new Promise(r => setTimeout(r, 100));
        }
    }

    // Fix the Nandyal SP typo if present
    const nandyalSp = existingMap.get('nandyalsp');
    if (nandyalSp && nandyalSp.district === 'నందయాల') {
        const patchUrl = `https://firestore.googleapis.com/v1/projects/alfa-news-31bf7/databases/(default)/documents/social_feeds/${nandyalSp.id}?updateMask.fieldPaths=district`;
        await fetch(patchUrl, {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { district: { stringValue: 'నంద్యాల' } } })
        });
        console.log("🔧 Fixed typo: @nandyalsp district updated to 'నంద్యాల'");
    }

    console.log("\n==================================================");
    console.log("🎉 ANDHRA PRADESH SYNC COMPLETED");
    console.log(`➕ Inserted: ${insertedCount}`);
    console.log(`🔄 Updated: ${updatedCount}`);
    console.log(`⏭️ Skipped (already matching): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log("==================================================");
}

syncAndhraLeaders().catch(err => {
    console.error("Fatal error during sync:", err);
});
