const fs = require('fs');

const feedsToSync = [
    {
        url: '@umasudhir',
        sourceName: 'ఉమా సుధీర్ (Uma Sudhir - Senior Journalist)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@sudhakarudumula',
        sourceName: 'సుధాకర్ ఉడుముల (Sudhakar Udumula - TOI Investigative Editor)',
        category: 'రాజకీయం',
        state: 'Telangana'
    },
    {
        url: '@TelakapalliRavi',
        sourceName: 'తెలకపల్లి రవి (Telakapalli Ravi - Senior Editor & Analyst)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@murthyscribe',
        sourceName: 'మూర్తి (Murthy - Senior Journalist, TV5)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@sayesekhar',
        sourceName: 'సాయే శేఖర్ (Saye Sekhar - Senior Journalist)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@sumanthraman',
        sourceName: 'డాక్టర్ సుమంత్ రామన్ (Dr. Sumanth Raman - Political Analyst)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@serish',
        sourceName: 'సెరీష్ నానిశెట్టి (Serish Nanisetti - The Hindu)',
        category: 'రాజకీయం',
        state: 'Telangana'
    },
    {
        url: '@Paul_Oommen',
        sourceName: 'పాల్ ఉమ్మన్ (Paul Oommen - Senior Journalist)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@appajireddem',
        sourceName: 'అప్పాజీ రెడ్డిం (Appaji Reddem - The Hindu AP Resident Editor)',
        category: 'రాజకీయం',
        state: 'Andhra Pradesh'
    },
    {
        url: '@greatandhranews',
        sourceName: 'గ్రేట్ ఆంధ్ర న్యూస్ (GreatAndhra)',
        category: 'రాజకీయం',
        state: 'Andhra Pradesh'
    },
    {
        url: '@TheSouthfirst',
        sourceName: 'సౌత్ ఫస్ట్ (The South First)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@NewsMeter_In',
        sourceName: 'న్యూస్ మీటర్ (NewsMeter India)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@thenewsminute',
        sourceName: 'ది న్యూస్ మినిట్ (The News Minute)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@GulteOfficial',
        sourceName: 'గుల్టే న్యూస్ (Gulte)',
        category: 'రాజకీయం',
        state: 'Andhra Pradesh'
    },
    {
        url: '@PradeepGuptaAMI',
        sourceName: 'ప్రదీప్ గుప్తా (Pradeep Gupta - Axis My India)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@YRDeshmukh',
        sourceName: 'యశ్వంత్ దేశ్‌ముఖ్ (Yashwant Deshmukh - CVoter)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@PrashantKishor',
        sourceName: 'ప్రశాంత్ కిశోర్ (Prashant Kishor - Jan Suraaj)',
        category: 'రాజకీయం',
        state: 'National/General'
    }
];

async function syncFeeds() {
    console.log("==================================================");
    console.log("🚀 SYNCING VERIFIED JOURNALISTS & NEWS PLATFORMS TO FIRESTORE");
    console.log("==================================================\n");

    const cfgPath = 'C:\\Users\\alfan\\.config\\configstore\\firebase-tools.json';
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    let token = cfg.tokens?.access_token;

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
            existingMap.set(cleanHandle, true);
        }
    });

    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < feedsToSync.length; i++) {
        const item = feedsToSync[i];
        const cleanHandle = item.url.toLowerCase().replace(/^@+/, '').trim();
        const fullHandle = `@${cleanHandle}`;

        if (existingMap.has(cleanHandle)) {
            console.log(`[${i + 1}/${feedsToSync.length}] ⏭️ ALREADY IN DB: ${fullHandle} (${item.sourceName})`);
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
                state: { stringValue: item.state },
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
                console.log(`[${i + 1}/${feedsToSync.length}] ✅ INSERTED: ${fullHandle} (${item.sourceName}) [${item.state}]`);
                insertedCount++;
            }
        } catch (e) {
            console.error(`❌ Exception inserting ${fullHandle}:`, e.message);
            errorCount++;
        }
    }

    console.log("\n==================================================");
    console.log(`🎉 SYNC COMPLETE!`);
    console.log(`   Total Targets:  ${feedsToSync.length}`);
    console.log(`   ✅ Inserted:    ${insertedCount}`);
    console.log(`   ⏭️ Skipped:     ${skippedCount}`);
    console.log(`   ❌ Errors:      ${errorCount}`);
    console.log("==================================================");
}

syncFeeds().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
