const fs = require('fs');

const targetFeeds = [
    // =========================================================================
    // 1. JOBS, CAREER & EDUCATION (విద్య & ప్రభుత్వ ఉద్యోగాల సమాచారం)
    // =========================================================================
    {
        url: '@eenadupratibha',
        sourceName: 'ఈనాడు ప్రతిభ (Eenadu Pratibha - APPSC, TSPSC ఉద్యోగ సమాచారం & మెటీరియల్)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'Andhra Pradesh'
    },
    {
        url: '@sakshibhavita',
        sourceName: 'సాక్షి భవిత (Sakshi Bhavita - విద్యా ఉద్యోగ సమాచారం & కెరీర్ గైడెన్స్)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'Telangana'
    },
    {
        url: '@Employ_News',
        sourceName: 'ఎంప్లాయ్‌మెంట్ న్యూస్ (Employment News - కేంద్ర ప్రభుత్వ అధికారిక ఉద్యోగ సమాచారం)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'National/General'
    },
    {
        url: '@NCSIndia',
        sourceName: 'నేషనల్ కెరీర్ సర్వీస్ (NCS India - కేంద్ర కార్మిక మంత్రిత్వ శాఖ ఉద్యోగ పోర్టల్)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'National/General'
    },
    {
        url: '@RailMinIndia',
        sourceName: 'భారతీయ రైల్వే శాఖ (Ministry of Railways - RRB ఉద్యోగాలు & రైల్వే అప్‌డేట్స్)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'National/General'
    },
    {
        url: '@EduMinOfIndia',
        sourceName: 'కేంద్ర విద్యా మంత్రిత్వ శాఖ (Ministry of Education - విద్యా విధానాలు & పరీక్షలు)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'National/General'
    },
    {
        url: '@ugc_india',
        sourceName: 'యూజీసీ ఇండియా (UGC India - ఉన్నత విద్య, ప్రొఫెసర్ నియామకాలు & ఫెలోషిప్స్)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'National/General'
    },
    {
        url: '@mamidala90',
        sourceName: 'ప్రొఫెసర్ ఎం. జగదీష్ కుమార్ (Prof. M. Jagadesh Kumar - యూజీసీ ఛైర్మన్, విద్యారంగ నిపుణులు)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'Telangana',
        district: 'నల్గొండ'
    },
    {
        url: '@drishtiias',
        sourceName: 'దృష్టి ఐఏఎస్ (Drishti IAS - సివిల్స్, గ్రూప్స్ & ప్రభుత్వ ఉద్యోగాల గైడెన్స్)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'National/General'
    },
    {
        url: '@Adda247Official',
        sourceName: 'అడ్డా 247 (Adda247 - బ్యాంకింగ్, ఎస్‌ఎస్‌సీ, రైల్వే & ప్రభుత్వ ఉద్యోగాల సమాచారం)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'National/General'
    },
    {
        url: '@Testbookdotcom',
        sourceName: 'టెస్ట్‌బుక్ (Testbook - లేటెస్ట్ జాబ్ నోటిఫికేషన్లు, అడ్మిట్ కార్డులు & ప్రిపరేషన్)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'National/General'
    },
    {
        url: '@PhysicswallahAP',
        sourceName: 'అలఖ్ పాండే (Alakh Pandey / Physics Wallah - విద్యా మార్గదర్శనం & ఎగ్జామ్స్)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'National/General'
    },
    {
        url: '@khansirpatna',
        sourceName: 'ఖాన్ సర్ (Khan Sir Patna - రైల్వే, డిఫెన్స్ & కాంపిటీటివ్ ఎగ్జామ్స్ గైడ్)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'National/General'
    },
    {
        url: '@PIB_India',
        sourceName: 'పీఐబీ ఇండియా (PIB India - కేంద్ర ప్రభుత్వ నియామకాలు, కేబినెట్ ఉద్యోగ నిర్ణయాలు)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'National/General'
    },
    {
        url: '@LabourMinistry',
        sourceName: 'కేంద్ర కార్మిక & ఉపాధి మంత్రిత్వ శాఖ (Ministry of Labour & Employment - ఉపాధి సమాచారం)',
        category: 'విద్య/ఉద్యోగాలు',
        state: 'National/General'
    },

    // =========================================================================
    // 2. AGRICULTURE & WEATHER (వ్యవసాయం & రైతుల సమాచారం / వాతావరణం)
    // =========================================================================
    {
        url: '@metcentrehyd',
        sourceName: 'ఐఎండీ హైదరాబాద్ (IMD Hyderabad - తెలంగాణ వాతావరణ సూచనలు & వర్ష హెచ్చరికలు)',
        category: 'వ్యవసాయం',
        state: 'Telangana',
        district: 'హైదరాబాద్'
    },
    {
        url: '@AmaravatiMc',
        sourceName: 'ఐఎండీ అమరావతి (IMD Amaravati - ఆంధ్రప్రదేశ్ వాతావరణం & తుఫాను హెచ్చరికలు)',
        category: 'వ్యవసాయం',
        state: 'Andhra Pradesh',
        district: 'గుంటూరు'
    },
    {
        url: '@icarindia',
        sourceName: 'ఐకార్ ఇండియా (ICAR - భారత వ్యవసాయ పరిశోధనా మండలి, విత్తనాలు & పంట రక్షణ)',
        category: 'వ్యవసాయం',
        state: 'National/General'
    },
    {
        url: '@Devinder_Sharma',
        sourceName: 'దేవీందర్ శర్మ (Devinder Sharma - ప్రముఖ వ్యవసాయ శాస్త్రవేత్త & ఆహార విధాన విశ్లేషకులు)',
        category: 'వ్యవసాయం',
        state: 'National/General'
    },
    {
        url: '@kkuruganti',
        sourceName: 'కవితా కురుగంటి (Kavitha Kuruganti - రైతు హక్కులు & సహజ సేద్య మార్గదర్శి)',
        category: 'వ్యవసాయం',
        state: 'National/General'
    },
    {
        url: '@PSainath_org',
        sourceName: 'పి. సాయినాథ్ (P. Sainath - గ్రామీణ భారతం & రైతుల సంక్షేమ జర్నలిస్ట్)',
        category: 'వ్యవసాయం',
        state: 'National/General'
    },
    {
        url: '@SkymetWeather',
        sourceName: 'స్కైమెట్ వెదర్ (Skymet Weather - వ్యవసాయ వాతావరణ అంచనాలు & వర్షపాతం)',
        category: 'వ్యవసాయం',
        state: 'National/General'
    },

    // =========================================================================
    // 3. GROUND FIELD JOURNALISTS & SENIOR NEWS ANCHORS (క్షేత్రస్థాయి జర్నలిస్టులు & న్యూస్ యాంకర్లు)
    // =========================================================================
    {
        url: '@rajinikanthlive',
        sourceName: 'రజనీకాంత్ వెల్లాలచెరువు (Rajinikanth - మేనేజింగ్ ఎడిటర్ TV9 తెలుగు, గ్రౌండ్ రిపోర్ట్స్)',
        category: 'రాజకీయం',
        state: 'Telangana',
        district: 'హైదరాబాద్'
    },
    {
        url: '@sudhakarudumula',
        sourceName: 'సుధాకర్ రెడ్డి ఉడుముల (Sudhakar Reddy Udumula - ఇన్వెస్టిగేటివ్ ఎడిటర్ & గ్రౌండ్ జర్నలిస్ట్)',
        category: 'స్థానిక',
        state: 'Telangana',
        district: 'హైదరాబాద్'
    },
    {
        url: '@murthyscribe',
        sourceName: 'జర్నలిస్ట్ మూర్తి (Journalist Murthy - సీనియర్ రాజకీయ విశ్లేషకులు & గ్రౌండ్ న్యూస్)',
        category: 'రాజకీయం',
        state: 'Andhra Pradesh'
    },
    {
        url: '@thulasichandu1',
        sourceName: 'తులసి చందు (Thulasi Chandu - స్వతంత్ర గ్రౌండ్ జర్నలిస్ట్ & ఫ్యాక్ట్ చెకర్)',
        category: 'తాజా వార్తలు',
        state: 'Telangana',
        district: 'హైదరాబాద్'
    },
    {
        url: '@Paul_Oommen',
        sourceName: 'పాల్ ఊమెన్ (Paul Oommen - సీనియర్ గ్రౌండ్ కరస్పాండెంట్, సౌత్ ఇండియా)',
        category: 'స్థానిక',
        state: 'Telangana',
        district: 'హైదరాబాద్'
    },
    {
        url: '@venkatatweets',
        sourceName: 'వెంకట కృష్ణ (Venkata Krishna B. - సీనియర్ జర్నలిస్ట్ & స్పోర్ట్స్/కరెంట్ అఫైర్స్)',
        category: 'తాజా వార్తలు',
        state: 'National/General'
    }
];

async function syncTargetFeeds() {
    console.log("==================================================");
    console.log("🚀 SYNCING JOBS/CAREER, AGRICULTURE/WEATHER & FIELD JOURNALISTS");
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

    for (let i = 0; i < targetFeeds.length; i++) {
        const item = targetFeeds[i];
        const cleanHandle = item.url.toLowerCase().replace(/^@+/, '').trim();
        const fullHandle = `@${cleanHandle}`;

        if (existingMap.has(cleanHandle)) {
            console.log(`[${i + 1}/${targetFeeds.length}] ⏭️ ALREADY IN DB: ${fullHandle} (${item.sourceName})`);
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
                console.log(`[${i + 1}/${targetFeeds.length}] ✅ INSERTED: ${fullHandle} (${item.sourceName}) [${item.category}]`);
                insertedCount++;
            }
        } catch (e) {
            console.error(`❌ Exception inserting ${fullHandle}:`, e.message);
            errorCount++;
        }
    }

    console.log("\n==================================================");
    console.log(`🎉 SYNC COMPLETE!`);
    console.log(`   Total Targets:  ${targetFeeds.length}`);
    console.log(`   ✅ Inserted:    ${insertedCount}`);
    console.log(`   ⏭️ Skipped:     ${skippedCount}`);
    console.log(`   ❌ Errors:      ${errorCount}`);
    console.log("==================================================");
}

syncTargetFeeds().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
