const candidates = [
    // Senior Political Analysts & Journalists
    { handle: 'ProfKNageshwar', role: 'రాజకీయ విశ్లేషకులు, మాజీ ఎమ్మెల్సీ' },
    { handle: 'ProfNageshwar', role: 'రాజకీయ విశ్లేషకులు' },
    { handle: 'umasudhir', role: 'సీనియర్ జర్నలిస్ట్, రాజకీయ విశ్లేషకురాలు (NDTV)' },
    { handle: 'Iamtvsudhir', role: 'సీనియర్ జర్నలిస్ట్, సౌత్ పొలిటికల్ ఎనలిస్ట్' },
    { handle: 'sudhakarudumula', role: 'జర్నలిస్ట్ & పొలిటికల్ అబ్జర్వర్ (Telangana)' },
    { handle: 'TeluguScribe', role: 'రాజకీయ & సమకాలీన వార్తల ఇన్‌ఫ్లుయెన్సర్' },
    { handle: 'sayesekhar', role: 'సీనియర్ జర్నలిస్ట్, పొలిటికల్ కామెంటేటర్' },
    { handle: 'JournalistSai', role: 'జర్నలిస్ట్ సాయి, రాజకీయ విశ్లేషకుడు' },
    { handle: 'tv5murthy', role: 'మూర్తి, సీనియర్ జర్నలిస్ట్ & ఎడిటర్' },
    { handle: 'MurthyTV5', role: 'సీనియర్ జర్నలిస్ట్' },
    { handle: 'VenkataKrishna_', role: 'వెంకటకృష్ణ, సీనియర్ జర్నలిస్ట్ (ABN)' },
    { handle: 'VenkataKrishnaABN', role: 'జర్నలిస్ట్' },
    { handle: 'imraviprakash', role: 'రవి ప్రకాష్, ఆర్టీవీ అధినేత, సీనియర్ జర్నలిస్ట్' },
    { handle: 'TelakapalliRavi', role: 'తె Faustి రవి, సీనియర్ రాజకీయ విశ్లేషకులు' },
    { handle: 'Telakapalliravi', role: 'తె Faustి రవి, సీనియర్ రాజకీయ విశ్లేషకులు' },
    { handle: 'RahulDevulapall', role: 'జర్నలిస్ట్ (The Week), రాజకీయ పరిశీలకులు' },
    { handle: 'Aashish_TNIE', role: 'జర్నలిస్ట్, తెలంగాణ రాజకీయ విశ్లేషణ' },
    { handle: 'crgowrishanker', role: 'సీనియర్ జర్నలిస్ట్ & రాజకీయ వ్యాఖ్యాత' },
    { handle: 'GowriShankerCR', role: 'సీనియర్ జర్నలిస్ట్' },
    { handle: 'Kommineni_YSR', role: 'కొమ్మినేని శ్రీనివాసరావు, సీనియర్ జర్నలిస్ట్' },
    { handle: 'KommineniS', role: 'కొమ్మినేని శ్రీనివాసరావు' },
    { handle: 'krishnarao_journo', role: 'సీనియర్ జర్నలిస్ట్' },
    { handle: 'PraveenBhartiya', role: 'జర్నలిస్ట్' },
    { handle: 'PrashantKishor', role: 'రాజకీయ వ్యూహకర్త & జన్ సూరజ్ వ్యవస్థాపకులు' },
    { handle: 'SumanthRaman', role: 'దక్షిణాది రాజకీయ విశ్లేషకులు' },
    { handle: 'Chalasani_S', role: 'చలసాని శ్రీనివాస్' },
    { handle: 'ChalasaniAP', role: 'చలసాని శ్రీనివాస్' },
    { handle: 'Swapna_journo', role: 'స్వప్న, సీనియర్ జర్నలిస్ట్' },
    { handle: 'Prema_Journo', role: 'ప్రేమ, జర్నలిస్ట్' },
    { handle: 'PeoplesPulseRes', role: 'పీపుల్స్ పల్స్ రీసెర్చ్ (రాజకీయ సర్వే సంస్థ)' },
    { handle: 'PeoplesPulse', role: 'పీపుల్స్ పల్స్ రీసెర్చ్' },
    { handle: 'PulsePeoples', role: 'పీపుల్స్ పల్స్' },
    { handle: 'AtmaSakshiGroup', role: 'ఆత్మసాక్షి గ్రూప్ (ఎన్నికల విశ్లేషణ సంస్థ)' },
    { handle: 'AtmasakshiGroup', role: 'ఆత్మసాక్షి' },
    { handle: 'APPoliticsNews', role: 'రాజకీయ పరిశీలకుల హ్యాండిల్' },
    { handle: 'Telugu360', role: 'రాజకీయ & వినోద విశ్లేషణ సంస్థ' },
    { handle: 'greatandhranews', role: 'గ్రేట్ ఆంధ్ర రాజకీయ విభాగం' },
    { handle: 'DeccanChronicle', role: 'దక్కన్ క్రానికల్' },
    { handle: 'srinivasjasti', role: 'శ్రీనివాస్ జాస్తి, రాజకీయ వ్యాఖ్యాత' },
    { handle: 'Mirchi9', role: 'మిర్చి9 రాజకీయ & సినీ విశ్లేషణ' }
];

async function testAnalysts() {
    console.log(`Checking ${candidates.length} candidate handles...\n`);
    const verified = [];

    for (const item of candidates) {
        try {
            const res = await fetch(`https://api.fxtwitter.com/${item.handle}`);
            if (res.status === 200) {
                const data = await res.json();
                if (data.code === 200 && data.user) {
                    const u = data.user;
                    console.log(`✅ FOUND @${u.screen_name}: "${u.name}" (Tweets: ${u.tweets}, Followers: ${u.followers})`);
                    console.log(`   Bio: ${(u.description || '').replace(/\n/g, ' ').substring(0, 120)}`);
                    verified.push({
                        handle: `@${u.screen_name}`,
                        name: u.name,
                        role: item.role,
                        tweets: u.tweets,
                        followers: u.followers,
                        description: u.description || '',
                        location: u.location || ''
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

    const fs = require('fs');
    fs.writeFileSync('C:\\AlfaKotlin\\scripts\\analysts_verified.json', JSON.stringify(verified, null, 2));
    console.log(`\n🎉 Found ${verified.length} verified accounts!`);
}

testAnalysts();
