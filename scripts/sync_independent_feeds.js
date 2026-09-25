const fs = require('fs');

const independentFeeds = [
    {
        url: '@balaji25_t',
        sourceName: 'తెలంగాణ వెదర్‌మ్యాన్ (Telangana Weatherman - T. Balaji)',
        category: 'తాజా వార్తలు',
        state: 'Telangana'
    },
    {
        url: '@APWeatherman96',
        sourceName: 'ఆంధ్రప్రదేశ్ వెదర్‌మ్యాన్ (Andhra Pradesh Weatherman - Sai Praneeth)',
        category: 'తాజా వార్తలు',
        state: 'Andhra Pradesh'
    },
    {
        url: '@HiHyderabad',
        sourceName: 'హాయ్ హైదరాబాద్ (Hi Hyderabad - సిటీ అప్‌డేట్స్ & వైరల్ న్యూస్)',
        category: 'స్థానిక',
        state: 'Telangana',
        district: 'హైదరాబాద్'
    },
    {
        url: '@HyderabadMojo',
        sourceName: 'హైదరాబాద్ మోజో (Hyderabad Mojo - నగర తాజా పరిణామాలు)',
        category: 'స్థానిక',
        state: 'Telangana',
        district: 'హైదరాబాద్'
    },
    {
        url: '@WeAreHyderabad',
        sourceName: 'వి ఆర్ హైదరాబాద్ (We Are Hyderabad - కమ్యూనిటీ అప్‌డేట్స్)',
        category: 'స్థానిక',
        state: 'Telangana',
        district: 'హైదరాబాద్'
    },
    {
        url: '@CoreenaSuares2',
        sourceName: 'కొరీనా సువారెస్ (Coreena Suares - ఇన్వెస్టిగేటివ్ జర్నలిస్ట్)',
        category: 'తాజా వార్తలు',
        state: 'Telangana'
    },
    {
        url: '@revathitweets',
        sourceName: 'రేవతి (Revathi - స్వతంత్ర జర్నలిస్ట్)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@RishikaSadam',
        sourceName: 'రిషిక సదమ్ (Rishika Sadam - గ్రౌండ్ రిపోర్టర్)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@DonitaJose',
        sourceName: 'డోనిటా జోస్ (Donita Jose - ఇన్వెస్టిగేటివ్ రిపోర్టర్)',
        category: 'తాజా వార్తలు',
        state: 'Telangana'
    },
    {
        url: '@ap7am',
        sourceName: 'ఏపీ7ఏఎం (AP7AM - తాజా వార్తలు & పొలిటికల్ అప్‌డేట్స్)',
        category: 'తాజా వార్తలు',
        state: 'Andhra Pradesh'
    },
    {
        url: '@TeluguBulletin',
        sourceName: 'తెలుగు బులెటిన్ (TeluguBulletin - రాజకీయ & తాజా వార్తలు)',
        category: 'రాజకీయం',
        state: 'National/General'
    },
    {
        url: '@telugustop',
        sourceName: 'తెలుగు స్టాప్ (TeluguStop - ప్రాంతీయ వార్తలు)',
        category: 'తాజా వార్తలు',
        state: 'National/General'
    },
    {
        url: '@teluguglobal',
        sourceName: 'తెలుగు గ్లోబల్ (Telugu Global - వార్తలు & సమాచారం)',
        category: 'తాజా వార్తలు',
        state: 'National/General'
    },
    {
        url: '@AndhraBoxOffice',
        sourceName: 'ఆంధ్ర బాక్స్ ఆఫీస్ (AndhraBoxOffice - వైరల్ సినీ & కల్చర్ న్యూస్)',
        category: 'వినోదం',
        state: 'National/General'
    },
    {
        url: '@TrackTwood',
        sourceName: 'ట్రాక్ టాలీవుడ్ (TrackTollywood - వైరల్ న్యూస్ & అప్‌డేట్స్)',
        category: 'వినోదం',
        state: 'National/General'
    },
    {
        url: '@Way2NewsTelugu',
        sourceName: 'వే2న్యూస్ తెలుగు (Way2News - హైపర్‌లోకల్ వార్తలు)',
        category: 'తాజా వార్తలు',
        state: 'National/General'
    },
    {
        url: '@Manatelangana_',
        sourceName: 'మన తెలంగాణ డిజిటల్ (Mana Telangana - గ్రౌండ్ పాలిటిక్స్)',
        category: 'రాజకీయం',
        state: 'Telangana'
    },
    {
        url: '@WarangalUpdates',
        sourceName: 'వరంగల్ అప్‌డేట్స్ (Warangal Updates - స్థానిక సమాచారం)',
        category: 'స్థానిక',
        state: 'Telangana',
        district: 'వరంగల్'
    },
    {
        url: '@TirupatiUpdates',
        sourceName: 'తిరుపతి అప్‌డేట్స్ (Tirupati Updates - స్థానిక సమాచారం)',
        category: 'స్థానిక',
        state: 'Andhra Pradesh',
        district: 'తిరుపతి'
    }
];

async function syncIndependentFeeds() {
    console.log("==================================================");
    console.log("🚀 SYNCING VERIFIED INDEPENDENT REGIONAL & VIRAL FEEDS TO FIRESTORE");
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

    for (let i = 0; i < independentFeeds.length; i++) {
        const item = independentFeeds[i];
        const cleanHandle = item.url.toLowerCase().replace(/^@+/, '').trim();
        const fullHandle = `@${cleanHandle}`;

        if (existingMap.has(cleanHandle)) {
            console.log(`[${i + 1}/${independentFeeds.length}] ⏭️ ALREADY IN DB: ${fullHandle} (${item.sourceName})`);
            skippedCount++;
            continue;
        }

        const postUrl = `https://firestore.googleapis.com/v1/projects/alfa-news-31bf7/databases/(default)/documents/social_feeds`;
        const payloadFields = {
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
        };

        if (item.district) {
            payloadFields.district = { stringValue: item.district };
        }

        try {
            const res = await fetch(postUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fields: payloadFields })
            });
            const resData = await res.json();
            if (resData.error) {
                console.error(`❌ Error inserting ${fullHandle}:`, resData.error.message);
                errorCount++;
            } else {
                console.log(`[${i + 1}/${independentFeeds.length}] ✅ INSERTED: ${fullHandle} (${item.sourceName}) [${item.state}]`);
                insertedCount++;
            }
        } catch (e) {
            console.error(`❌ Exception inserting ${fullHandle}:`, e.message);
            errorCount++;
        }
    }

    console.log("\n==================================================");
    console.log(`🎉 INDEPENDENT FEEDS SYNC COMPLETE!`);
    console.log(`   Total Targets:  ${independentFeeds.length}`);
    console.log(`   ✅ Inserted:    ${insertedCount}`);
    console.log(`   ⏭️ Skipped:     ${skippedCount}`);
    console.log(`   ❌ Errors:      ${errorCount}`);
    console.log("==================================================");
}

syncIndependentFeeds().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
