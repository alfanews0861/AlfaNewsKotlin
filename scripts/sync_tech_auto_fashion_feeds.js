const fs = require('fs');

const autoTechFashionFeeds = [
    // --- 1. BIKES & CARS REVIEWERS (ఆటోమొబైల్ - బైకులు, కార్లు & EV రివ్యూయర్లు) ---
    {
        url: '@FasBeam',
        sourceName: 'ఫైజల్ ఖాన్ (Faisal Khan / FasBeam - బైక్స్ & కార్స్ రివ్యూయర్)',
        category: 'టెక్నాలజీ',
        state: 'National/General'
    },
    {
        url: '@sidpatankar',
        sourceName: 'సిద్ధార్థ్ వినాయక్ పటంకర్ (Siddharth Patankar - కార్ల రివ్యూయర్ & ఆటో ఎడిటర్)',
        category: 'టెక్నాలజీ',
        state: 'National/General'
    },
    {
        url: '@BunnyPunia',
        sourceName: 'బన్నీ పూనియా (Bunny Punia - ఆటో ఎక్స్‌పర్ట్ & కార్/బైక్ రివ్యూయర్)',
        category: 'టెక్నాలజీ',
        state: 'National/General'
    },
    {
        url: '@ashishmasih1',
        sourceName: 'ఆశిష్ మసీహ్ (Ashish Masih - ఆటో జర్నలిస్ట్ & కార్ టెస్ట్ డ్రైవర్)',
        category: 'టెక్నాలజీ',
        state: 'National/General'
    },
    {
        url: '@bikemysoul',
        sourceName: 'సాగర్ షెల్డేకర్ (Sagar Sheldekar - బైక్స్ & మోటార్‌సైకిల్స్ రివ్యూయర్)',
        category: 'టెక్నాలజీ',
        state: 'National/General'
    },
    {
        url: '@themotorinc',
        sourceName: 'మోటార్ ఇంక్ (MotorInc - డీప్ కార్ & బైక్ అనాలిసిస్)',
        category: 'టెక్నాలజీ',
        state: 'National/General'
    },
    {
        url: '@dinos_vault',
        sourceName: 'దినేష్ కుమార్ (Dino\'s Vault - మోటార్‌సైకిల్స్ & బైక్ రివ్యూయర్, హైదరాబాద్)',
        category: 'టెక్నాలజీ',
        state: 'Telangana',
        district: 'హైదరాబాద్'
    },
    {
        url: '@evkurradu',
        sourceName: 'ఈవీ కుర్రాడు (EV Kurradu - ఎలక్ట్రిక్ బైక్స్ & కార్స్ రివ్యూస్, తెలుగు)',
        category: 'టెక్నాలజీ',
        state: 'Andhra Pradesh'
    },

    // --- 2. TECHNOLOGY & GADGET REVIEWERS (టెక్నాలజీ, మొబైల్స్ & గాడ్జెట్స్) ---
    {
        url: '@iamprasadtech',
        sourceName: 'ప్రసాద్ (Prasad Tech in Telugu - నంబర్ 1 తెలుగు టెక్ రివ్యూయర్)',
        category: 'టెక్నాలజీ',
        state: 'Andhra Pradesh'
    },
    {
        url: '@hafizsd',
        sourceName: 'సయ్యద్ హఫీజ్ (Telugu TechTuts - టెక్నాలజీ గైడ్ & గాడ్జెట్ రివ్యూస్)',
        category: 'టెక్నాలజీ',
        state: 'Telangana',
        district: 'హైదరాబాద్'
    },
    {
        url: '@geekyranjit',
        sourceName: 'రంజిత్ కుమార్ (Geekyranjit - స్మార్ట్‌ఫోన్స్ & గాడ్జెట్స్ ఎక్స్‌పర్ట్, హైదరాబాద్)',
        category: 'టెక్నాలజీ',
        state: 'Telangana',
        district: 'హైదరాబాద్'
    },
    {
        url: '@TechnicalGuruji',
        sourceName: 'గౌరవ్ చౌదరి (Technical Guruji - గాడ్జెట్స్ & టెక్ రివ్యూయర్)',
        category: 'టెక్నాలజీ',
        state: 'National/General'
    },
    {
        url: '@tech_burner',
        sourceName: 'శ్లోక్ శ్రీవాస్తవ (Tech Burner - టెక్ & గాడ్జెట్ రివ్యూయర్)',
        category: 'టెక్నాలజీ',
        state: 'National/General'
    },
    {
        url: '@stufflistings',
        sourceName: 'ముకుల్ శర్మ (Stufflistings - మొబైల్ లాంచ్‌లు & స్పెసిఫికేషన్స్ లీకర్)',
        category: 'టెక్నాలజీ',
        state: 'National/General'
    },
    {
        url: '@yabhishekhd',
        sourceName: 'అభిషేక్ యాదవ్ (Abhishek Yadav - టెక్ టిప్‌స్టర్ & స్మార్ట్‌ఫోన్ న్యూస్)',
        category: 'టెక్నాలజీ',
        state: 'National/General'
    },
    {
        url: '@8ap',
        sourceName: 'అరుణ్ ప్రభుదేశాయ్ (Arun Prabhudesai / Trakin Tech - టెక్ రివ్యూయర్)',
        category: 'టెక్నాలజీ',
        state: 'National/General'
    },
    {
        url: '@Dhananjay_Tech',
        sourceName: 'ధనంజయ్ భోసలే (Dhananjay Bhosale - టెక్ & గాడ్జెట్ గైడ్)',
        category: 'టెక్నాలజీ',
        state: 'National/General'
    },
    {
        url: '@C4ETech',
        sourceName: 'అశ్విన్ గణేష్ (C4ETech - స్మార్ట్‌ఫోన్ రివ్యూలు & కెమెరా టెస్ట్స్)',
        category: 'టెక్నాలజీ',
        state: 'National/General'
    },

    // --- 3. FASHION & STYLING (ఫ్యాషన్, స్టైలింగ్, ట్రెండ్స్ & గ్రూమింగ్) ---
    {
        url: '@MasabaG',
        sourceName: 'మసాబా గుప్తా (Masaba Gupta - ప్రముఖ ఫ్యాషన్ డిజైనర్ & స్టైల్ ఐకాన్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@ManishMalhotra',
        sourceName: 'మనీష్ మల్హోత్రా (Manish Malhotra - సెలబ్రిటీ కాస్ట్యూమ్ & ఫ్యాషన్ డిజైనర్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@shefatwork',
        sourceName: 'షెఫాలీ వాసుదేవ్ (Shefalee Vasudev - ది వాయిస్ ఆఫ్ ఫ్యాషన్ ఎడిటర్, ఫ్యాషన్ క్రిటిక్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@nonitakalra',
        sourceName: 'నోనితా కాల్రా (Nonita Kalra - మాజీ ఎడిటర్ హార్పర్స్ బజార్, ఫ్యాషన్ జర్నలిస్ట్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@MissMuttoo',
        sourceName: 'అంబికా ముట్టూ (Ambika Muttoo - ఫెమినా చీఫ్ ఎడిటర్, ఫ్యాషన్ & స్టైల్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@kritikakhurana',
        sourceName: 'కృతికా ఖురానా (Kritika Khurana / That Boho Girl - ఫ్యాషన్ & లైఫ్‌స్టైల్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    },
    {
        url: '@bandanatewari',
        sourceName: 'బందనా తివారీ (Bandana Tewari - మాజీ వోగ్ ఇండియా ఎడిటర్ & సస్టైనబుల్ ఫ్యాషన్)',
        category: 'లైఫ్ స్టైల్',
        state: 'National/General'
    }
];

async function syncAutoTechFashionFeeds() {
    console.log("==================================================");
    console.log("🚀 SYNCING BIKES, CARS, TECH & FASHION REVIEWERS TO FIRESTORE");
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

    for (let i = 0; i < autoTechFashionFeeds.length; i++) {
        const item = autoTechFashionFeeds[i];
        const cleanHandle = item.url.toLowerCase().replace(/^@+/, '').trim();
        const fullHandle = `@${cleanHandle}`;

        if (existingMap.has(cleanHandle)) {
            console.log(`[${i + 1}/${autoTechFashionFeeds.length}] ⏭️ ALREADY IN DB: ${fullHandle} (${item.sourceName})`);
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
                console.log(`[${i + 1}/${autoTechFashionFeeds.length}] ✅ INSERTED: ${fullHandle} (${item.sourceName}) [${item.state}]`);
                insertedCount++;
            }
        } catch (e) {
            console.error(`❌ Exception inserting ${fullHandle}:`, e.message);
            errorCount++;
        }
    }

    console.log("\n==================================================");
    console.log(`🎉 AUTO, TECH & FASHION FEEDS SYNC COMPLETE!`);
    console.log(`   Total Targets:  ${autoTechFashionFeeds.length}`);
    console.log(`   ✅ Inserted:    ${insertedCount}`);
    console.log(`   ⏭️ Skipped:     ${skippedCount}`);
    console.log(`   ❌ Errors:      ${errorCount}`);
    console.log("==================================================");
}

syncAutoTechFashionFeeds().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
