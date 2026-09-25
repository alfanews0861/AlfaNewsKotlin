const candidates = [
    // Weather & Disaster Ground Alerts (Highly viral & critical regional news)
    { handle: 'balaji25_t', desc: 'Telangana Weatherman (తెలంగాణ వెదర్‌మ్యాన్ - తాజా వర్షాలు, వాతావరణ హెచ్చరికలు)', state: 'Telangana', cat: 'తాజా వార్తలు' },
    { handle: 'APWeatherman96', desc: 'Andhra Pradesh Weatherman (ఆంధ్రప్రదేశ్ వెదర్‌మ్యాన్ - తుఫాను, వర్షాల హెచ్చరికలు)', state: 'Andhra Pradesh', cat: 'తాజా వార్తలు' },
    { handle: 'VizagWeatherman', desc: 'Vizag Weatherman (విశాఖ వాతావరణ వార్తలు)', state: 'Andhra Pradesh', cat: 'స్థానిక' },
    { handle: 'Hyderabad_Rain', desc: 'Hyderabad Rains (హైదరాబాద్ వర్షాలు & వరద అప్‌డేట్స్)', state: 'Telangana', cat: 'స్థానిక' },

    // Hyperlocal Civic & Regional News Trackers
    { handle: 'HiHyderabad', desc: 'హాయ్ హైదరాబాద్ (Hi Hyderabad - సిటీ అప్‌డేట్స్ & వైరల్ వార్తలు)', state: 'Telangana', cat: 'స్థానిక' },
    { handle: 'HyderabadMojo', desc: 'హైదరాబాద్ మోజో (Hyderabad Mojo - నగర తాజా పరిణామాలు)', state: 'Telangana', cat: 'స్థానిక' },
    { handle: 'WeAreHyderabad', desc: 'వి ఆర్ హైదరాబాద్ (We Are Hyderabad)', state: 'Telangana', cat: 'స్థానిక' },
    { handle: 'CoreenaSuares2', desc: 'కొరీనా సువారెస్ (Coreena Suares - ఇన్వెస్టిగేటివ్ జర్నలిస్ట్, గ్రౌండ్ రిపోర్ట్స్)', state: 'Telangana', cat: 'తాజా వార్తలు' },
    { handle: 'revathitweets', desc: 'రేవతి (Revathi - స్వతంత్ర జర్నలిస్ట్, రాజకీయ & సామాజిక విశ్లేషణ)', state: 'National/General', cat: 'రాజకీయం' },
    { handle: 'RishikaSadam', desc: 'రిషిక సదమ్ (Rishika Sadam - సౌత్ పాలిటిక్స్ & గ్రౌండ్ రిపోర్టర్)', state: 'National/General', cat: 'రాజకీయం' },
    { handle: 'DonitaJose', desc: 'డోనిటా జోస్ (Donita Jose - ఇన్వెస్టిగేటివ్ రిపోర్టర్)', state: 'Telangana', cat: 'తాజా వార్తలు' },

    // Independent Digital Telugu News & Viral Trackers (Non-mainstream)
    { handle: 'ap7am', desc: 'AP7AM (తెలుగు వెబ్ న్యూస్ & పొలిటికల్ అప్‌డేట్స్)', state: 'Andhra Pradesh', cat: 'తాజా వార్తలు' },
    { handle: 'TupakiOfficial', desc: 'తుపాకీ (Tupaki - రాజకీయ & వైరల్ వార్తలు)', state: 'National/General', cat: 'రాజకీయం' },
    { handle: 'TeluguBulletin', desc: 'తెలుగు బులెటిన్ (Telugu Bulletin - తాజా & రాజకీయ వార్తలు)', state: 'National/General', cat: 'రాజకీయం' },
    { handle: 'TeluguPost', desc: 'తెలుగు పోస్ట్ (Telugu Post)', state: 'National/General', cat: 'తాజా వార్తలు' },
    { handle: 'TeluguPostNews', desc: 'తెలుగు పోస్ట్ న్యూస్ (Telugu Post News)', state: 'National/General', cat: 'తాజా వార్తలు' },
    { handle: 'TeluguStop', desc: 'తెలుగు స్టాప్ (Telugu Stop)', state: 'National/General', cat: 'తాజా వార్తలు' },
    { handle: 'TeluguGlobal', desc: 'తెలుగు గ్లోబల్ (Telugu Global)', state: 'National/General', cat: 'తాజా వార్తలు' },
    { handle: 'andhraboxoffice', desc: 'ఆంధ్ర బాక్స్ ఆఫీస్ (AndhraBoxOffice - వైరల్ సినిమా & ట్రెండ్స్)', state: 'National/General', cat: 'వినోదం' },
    { handle: 'Way2NewsTelugu', desc: 'వే2న్యూస్ తెలుగు (Way2News - హైపర్‌లోకల్ వార్తలు)', state: 'National/General', cat: 'తాజా వార్తలు' },
    { handle: 'SuryaTelugu', desc: 'సూర్య తెలుగు న్యూస్', state: 'National/General', cat: 'తాజా వార్తలు' },
    { handle: 'ManaTelangana_', desc: 'మన తెలంగాణ డిజిటల్', state: 'Telangana', cat: 'రాజకీయం' },
    { handle: 'Mirchi9', desc: 'మిర్చి9 (Mirchi9 - వైరల్ & ఎంటర్‌టైన్‌మెంట్ న్యూస్)', state: 'National/General', cat: 'వినోదం' },
    { handle: 'ChitramBhalare', desc: 'చిత్రం భళారే (వైరల్ న్యూస్)', state: 'National/General', cat: 'వినోదం' },

    // Regional District Accounts
    { handle: 'VizagNewsman', desc: 'వైజాగ్ న్యూస్‌మ్యాన్ (విశాఖ లోకల్ న్యూస్)', state: 'Andhra Pradesh', cat: 'స్థానిక' },
    { handle: 'VizagUpdates', desc: 'వైజాగ్ అప్‌డేట్స్', state: 'Andhra Pradesh', cat: 'స్థానిక' },
    { handle: 'VijayawadaCity', desc: 'విజయవాడ సిటీ అప్‌డేట్స్', state: 'Andhra Pradesh', cat: 'స్థానిక' },
    { handle: 'WarangalUpdates', desc: 'వరంగల్ అప్‌డేట్స్', state: 'Telangana', cat: 'స్థానిక' },
    { handle: 'TirupatiUpdates', desc: 'తిరుపతి అప్‌డేట్స్', state: 'Andhra Pradesh', cat: 'స్థానిక' }
];

async function testFeeds() {
    console.log(`Testing ${candidates.length} candidate independent regional & viral handles...\n`);
    const verified = [];
    const fs = require('fs');
    const existing = new Set(JSON.parse(fs.readFileSync('C:\\AlfaKotlin\\current_db_all_handles.json', 'utf8')));

    for (const item of candidates) {
        const clean = item.handle.toLowerCase();
        if (existing.has(clean)) {
            console.log(`⏭️ ALREADY IN DB: @${item.handle}`);
            continue;
        }

        try {
            const res = await fetch(`https://api.fxtwitter.com/${item.handle}`);
            if (res.status === 200) {
                const data = await res.json();
                if (data.code === 200 && data.user) {
                    const u = data.user;
                    console.log(`✅ FOUND @${u.screen_name}: "${u.name}" (Tweets: ${u.tweets}, Followers: ${u.followers})`);
                    console.log(`   Desc: ${(u.description || '').replace(/\n/g, ' ').substring(0, 100)}`);
                    verified.push({
                        handle: `@${u.screen_name}`,
                        sourceName: `${u.name} (${item.desc})`,
                        cleanName: u.name,
                        tweets: u.tweets,
                        followers: u.followers,
                        description: u.description || '',
                        state: item.state,
                        category: item.cat
                    });
                }
            } else {
                console.log(`❌ NOT FOUND: @${item.handle}`);
            }
        } catch (e) {
            console.log(`⚠️ ERROR @${item.handle}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 150));
    }

    fs.writeFileSync('C:\\AlfaKotlin\\scripts\\independent_verified.json', JSON.stringify(verified, null, 2));
    console.log(`\n🎉 Found ${verified.length} new verified independent accounts to add!`);
}

testFeeds();
