const fs = require('fs');

const healthLifestyleFeeds = [
    // --- 1. HEALTH & MEDICAL EXPERTS ---
    {
        url: '@theliverdr',
        sourceName: 'డా. సిరియాక్ అబ్బీ ఫిలిప్స్ (The Liver Doc - హెపటాలజిస్ట్ & హెల్త్ రీసెర్చర్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@hyderabaddoctor',
        sourceName: 'డా. సుధీర్ కుమార్ (Dr. Sudhir Kumar - న్యూరాలజిస్ట్, అపోలో హైదరాబాద్)',
        category: 'లైఫ్ స్టైల్',
        state: 'Telangana',
        district: 'హైదరాబాద్'
    },
    {
        url: '@DoctorNene',
        sourceName: 'డా. శ్రీరామ్ నేనే (Dr. Shriram Nene - కార్డియోథొరాసిక్ సర్జన్ & హెల్త్ ఎడ్యుకేటర్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@drpal_manickam',
        sourceName: 'డా. పళనియప్పన్ మాణిక్యం (Dr. Pal - గ్యాస్ట్రోఎంటరాలజిస్ట్ & గట్ హెల్త్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@ArvinderSoin',
        sourceName: 'డా. అర్విందర్ సింగ్ సోయిన్ (Dr. Arvinder Soin - పద్మశ్రీ లివర్ సర్జన్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@doctorsoumya',
        sourceName: 'డా. సౌమ్య స్వామినాథన్ (Dr. Soumya Swaminathan - మాజీ WHO చీఫ్ సైంటిస్ట్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@FaheemYounus',
        sourceName: 'డా. ఫహీమ్ యూనుస్ (Dr. Faheem Younus - ఇన్ఫెక్షియస్ డిసీజెస్ & హెల్త్ అడ్వైజర్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@vshivdasani',
        sourceName: 'డా. విశాఖ శివదాసాని (Dr. Vishakha Shivdasani - లైఫ్‌స్టైల్ డిసీజ్ & గట్ స్పెషలిస్ట్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@doctormanthena',
        sourceName: 'డా. మంతెన సత్యనారాయణ రాజు (Dr. Manthena - ప్రకృతి వైద్యం & ఆహార నియమాలు)',
        category: 'లైఫ్ స్టైల్',
        state: 'Andhra Pradesh'
    },
    {
        url: '@drsangitareddy',
        sourceName: 'డా. సంగీతారెడ్డి (Dr. Sangita Reddy - అపోలో హాస్పిటల్స్ జాయింట్ ఎండీ)',
        category: 'లైఫ్ స్టైల్',
        state: 'Telangana',
        district: 'హైదరాబాద్'
    },
    {
        url: '@RajeevJayadevan',
        sourceName: 'డా. రాజీవ్ జయదేవన్ (Dr. Rajeev Jayadevan - పబ్లిక్ హెల్త్ & మెడికల్ రీసెర్చర్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },

    // --- 2. SEX & RELATIONSHIPS / SEXUAL WELLNESS ---
    {
        url: '@leezamangaldas',
        sourceName: 'లీజా మంగళ్‌దాస్ (Leeza Mangaldas - సెక్స్ ఎడ్యుకేటర్ & రచయిత్రి)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@drvggupta',
        sourceName: 'డా. విజయ్ గోవింద గుప్తా (Dr. Vijayant Govinda - యూరాలజిస్ట్ & పురుషుల లైంగిక ఆరోగ్యం)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@SeemaAnand17',
        sourceName: 'సీమా ఆనంద్ (Seema Anand - సెక్సువల్ వెల్‌నెస్ & ఇన్టిమసీ ఎడ్యుకేటర్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@DR_SAMARAM',
        sourceName: 'డా. జి. సమరం (Dr. G. Samaram - ప్రముఖ సెక్సాలజిస్ట్, ఆంధ్రప్రదేశ్)',
        category: 'లైఫ్ స్టైల్',
        state: 'Andhra Pradesh',
        district: 'ఎన్టీఆర్'
    },
    {
        url: '@dr_samirparikh',
        sourceName: 'డా. సమీర్ పరీఖ్ (Dr. Samir Parikh - సైకియాట్రిస్ట్ & రిలేషన్‌షిప్స్ ఎక్స్‌పర్ట్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@doctoryuvi',
        sourceName: 'డా. యువరాజ్ జడేజా (Dr. Yuvraj Jadeja - గైనకాలజిస్ట్ & ఫెర్టిలిటీ స్పెషలిస్ట్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },

    // --- 3. FITNESS, DIET & NUTRITION ---
    {
        url: '@RujutaDiwekar',
        sourceName: 'రుజుతా దివేకర్ (Rujuta Diwekar - ప్రముఖ న్యూట్రిషనిస్ట్ & డైట్ ఎక్స్‌పర్ట్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@LukeCoutinho17',
        sourceName: 'ల్యూక్ కౌటిన్హో (Luke Coutinho - హోలిస్టిక్ లైఫ్‌స్టైల్ & వెల్‌నెస్ కోచ్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@chiragbarjatyaa',
        sourceName: 'చిరాగ్ బర్జాత్యా (Chirag Barjatya - ఫిట్‌నెస్ కోచ్ & డైట్ ఎక్స్‌పర్ట్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@basu2013',
        sourceName: 'బాసు శంకర్ (Basu Shanker - స్ట్రెంత్ & కండిషనింగ్ కోచ్, టీమ్ ఇండియా)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@BeerBicepsGuy',
        sourceName: 'రణ్‌వీర్ అల్లాహాబాదియా (Ranveer Allahbadia / BeerBiceps - ఫిట్‌నెస్ & వెల్‌నెస్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@shashankmehta05',
        sourceName: 'శశాంక్ మెహతా (Shashank Mehta - ఫుడ్ & ఫిట్‌నెస్ ఎడ్యుకేటర్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@hubermanlab',
        sourceName: 'డా. ఆండ్రూ హుబర్‌మన్ (Dr. Andrew Huberman - న్యూరోబయాలజీ & స్లీప్/ఫిట్‌నెస్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@PeterAttiaMD',
        sourceName: 'డా. పీటర్ అటియా (Dr. Peter Attia - లాంజివిటీ & ప్రివెంటివ్ ఎక్సర్‌సైజ్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    }
];

async function syncHealthLifestyleFeeds() {
    console.log("==================================================");
    console.log("🚀 SYNCING VERIFIED HEALTH, SEX & RELATIONS, FITNESS FEEDS TO FIRESTORE");
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

    for (let i = 0; i < healthLifestyleFeeds.length; i++) {
        const item = healthLifestyleFeeds[i];
        const cleanHandle = item.url.toLowerCase().replace(/^@+/, '').trim();
        const fullHandle = `@${cleanHandle}`;

        if (existingMap.has(cleanHandle)) {
            console.log(`[${i + 1}/${healthLifestyleFeeds.length}] ⏭️ ALREADY IN DB: ${fullHandle} (${item.sourceName})`);
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
                console.log(`[${i + 1}/${healthLifestyleFeeds.length}] ✅ INSERTED: ${fullHandle} (${item.sourceName}) [${item.state}]`);
                insertedCount++;
            }
        } catch (e) {
            console.error(`❌ Exception inserting ${fullHandle}:`, e.message);
            errorCount++;
        }
    }

    console.log("\n==================================================");
    console.log(`🎉 HEALTH & LIFESTYLE FEEDS SYNC COMPLETE!`);
    console.log(`   Total Targets:  ${healthLifestyleFeeds.length}`);
    console.log(`   ✅ Inserted:    ${insertedCount}`);
    console.log(`   ⏭️ Skipped:     ${skippedCount}`);
    console.log(`   ❌ Errors:      ${errorCount}`);
    console.log("==================================================");
}

syncHealthLifestyleFeeds().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
