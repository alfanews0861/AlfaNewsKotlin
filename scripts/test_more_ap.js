const fs = require('fs');

const moreCandidates = [
    // గుంటూరు / తెనాలి / బాపట్ల
    { handle: 'PemmasaniOnX', name: 'డాక్టర్ పెమ్మసాని చంద్రశేఖర్', title: 'కేంద్ర గ్రామీణాభివృద్ధి & కమ్యూనికేషన్ల శాఖ సహాయ మంత్రి, గుంటూరు ఎంపీ', district: 'గుంటూరు' },
    { handle: 'Pemmasani', name: 'డాక్టర్ పెమ్మసాని చంద్రశేఖర్', title: 'గుంటూరు ఎంపీ', district: 'గుంటూరు' },
    { handle: 'DrPemmasani', name: 'డాక్టర్ పెమ్మసాని చంద్రశేఖర్', title: 'గుంటూరు ఎంపీ', district: 'గుంటూరు' },
    { handle: 'Manohar_Nadendla', name: 'నాదెండ్ల మనోహర్', title: 'పౌర సరఫరాల శాఖ మంత్రి, తెనాలి ఎమ్మెల్యే', district: 'గుంటూరు' },
    { handle: 'NadendlaManohar', name: 'నాదెండ్ల మనోహర్', title: 'మంత్రి, తెనాలి ఎమ్మెల్యే', district: 'గుంటూరు' },
    { handle: 'Nadendla_M', name: 'నాదెండ్ల మనోహర్', title: 'మంత్రి', district: 'గుంటూరు' },
    { handle: 'GallaJayadev', name: 'గల్లా జయదేవ్', title: 'మాజీ ఎంపీ గుంటూరు', district: 'గుంటూరు' },
    { handle: 'JayGalla', name: 'గల్లా జయదేవ్', title: 'మాజీ ఎంపీ గుంటూరు', district: 'గుంటూరు' },
    { handle: 'Dhulipalla_N', name: 'ధూళిపాళ్ల నరేంద్ర కుమార్', title: 'పొన్నూరు ఎమ్మెల్యే', district: 'గుంటూరు' },
    { handle: 'DhulipallaN', name: 'ధూళిపాళ్ల నరేంద్ర కుమార్', title: 'పొన్నూరు ఎమ్మెల్యే', district: 'గుంటూరు' },

    // కర్నూలు
    { handle: 'TGBharath_TDP', name: 'టి.జి. భరత్', title: 'పరిశ్రమల శాఖ మంత్రి, కర్నూలు ఎమ్మెల్యే', district: 'కర్నూలు' },
    { handle: 'TGBharath', name: 'టి.జి. భరత్', title: 'మంత్రి, కర్నూలు ఎమ్మెల్యే', district: 'కర్నూలు' },
    { handle: 'BharathTG', name: 'టి.జి. భరత్', title: 'మంత్రి', district: 'కర్నూలు' },
    { handle: 'BugganaRajendraN', name: 'బుగ్గన రాజేంద్రనాథ్ రెడ్డి', title: 'మాజీ ఆర్థిక మంత్రి', district: 'కర్నూలు' },
    { handle: 'BugganaRaj', name: 'బుగ్గన రాజేంద్రనాథ్ రెడ్డి', title: 'మాజీ మంత్రి', district: 'కర్నూలు' },
    { handle: 'KotlaSurya', name: 'కోట్ల జయసూర్య ప్రకాశరెడ్డి', title: 'డోన్ ఎమ్మెల్యే', district: 'కర్నూలు' },
    { handle: 'collector_knl', name: 'కలెక్టర్ కర్నూలు', title: 'Collector Kurnool', district: 'కర్నూలు', isOfficial: true },
    { handle: 'Collector_KNL', name: 'కలెక్టర్ కర్నూలు', title: 'Collector Kurnool', district: 'కర్నూలు', isOfficial: true },
    { handle: 'collectorkurnool', name: 'కలెక్టర్ కర్నూలు', title: 'Collector Kurnool', district: 'కర్నూలు', isOfficial: true },

    // కాకినాడ
    { handle: 'uday_tangella', name: 'తంగెళ్ల ఉదయ్ శ్రీనివాస్', title: 'కాకినాడ ఎంపీ', district: 'కాకినాడ' },
    { handle: 'UdayTangellaJSP', name: 'తంగెళ్ల ఉదయ్ శ్రీనివాస్', title: 'కాకినాడ ఎంపీ', district: 'కాకినాడ' },
    { handle: 'UdaySrinivasMP', name: 'తంగెళ్ల ఉదయ్ శ్రీనివాస్', title: 'కాకినాడ ఎంపీ', district: 'కాకినాడ' },
    { handle: 'KakinadaSP', name: 'కాకినాడ ఎస్పీ', title: 'SP Kakinada', district: 'కాకినాడ', isOfficial: true },
    { handle: 'sp_kakinada', name: 'కాకినాడ ఎస్పీ', title: 'SP Kakinada', district: 'కాకినాడ', isOfficial: true },
    { handle: 'KakinadaPolice', name: 'కాకినాడ పోలీస్', title: 'Kakinada Police', district: 'కాకినాడ', isOfficial: true },
    { handle: 'collector_kkd', name: 'కలెక్టర్ కాకినాడ', title: 'Collector Kakinada', district: 'కాకినాడ', isOfficial: true },

    // వైఎస్ఆర్ కడప
    { handle: 'yssharmila', name: 'వై.ఎస్. షర్మిల', title: 'పీసీసీ అధ్యక్షురాలు', district: 'వైఎస్ఆర్ కడప' },
    { handle: 'BTechRaviTDP', name: 'బిటెక్ రవి', title: 'పులివెందుల టీడీపీ సమన్వయకర్త, ఎమ్మెల్సీ', district: 'వైఎస్ఆర్ కడప' },
    { handle: 'BTechRavi_TDP', name: 'బిటెక్ రవి', title: 'పులివెందుల టీడీపీ', district: 'వైఎస్ఆర్ కడప' },
    { handle: 'btechravi', name: 'బిటెక్ రవి', title: 'ఎమ్మెల్సీ', district: 'వైఎస్ఆర్ కడప' },
    { handle: 'ReddeppagariMR', name: 'రెడ్డిప్పగారి మాధవి రెడ్డి', title: 'కడప ఎమ్మెల్యే', district: 'వైఎస్ఆర్ కడప' },
    { handle: 'MadhaviReddy_KDP', name: 'మాధవి రెడ్డి', title: 'కడప ఎమ్మెల్యే', district: 'వైఎస్ఆర్ కడప' },

    // బాపట్ల
    { handle: 'collector_bpatla', name: 'కలెక్టర్ బాపట్ల', title: 'Collector Bapatla', district: 'బాపట్ల', isOfficial: true },
    { handle: 'CollectorBapatla', name: 'కలెక్టర్ బాపట్ల', title: 'Collector Bapatla', district: 'బాపట్ల', isOfficial: true },
    { handle: 'collectorbpatla', name: 'కలెక్టర్ బాపట్ల', title: 'Collector Bapatla', district: 'బాపట్ల', isOfficial: true },
    { handle: 'KonaRaghupathi', name: 'కోన రఘుపతి', title: 'బాపట్ల మాజీ డిప్యూటీ స్పీకర్', district: 'బాపట్ల' },
    { handle: 'Kona_Raghupathi', name: 'కోన రఘుపతి', title: 'మాజీ ఎమ్మెల్యే', district: 'బాపట్ల' },
    { handle: 'TennetiKrishnaP', name: 'తెన్నేటి కృష్ణప్రసాద్', title: 'బాపట్ల ఎంపీ', district: 'బాపట్ల' },
    { handle: 'KrishnaPrasad_MP', name: 'తెన్నేటి కృష్ణప్రసాద్', title: 'బాపట్ల ఎంపీ', district: 'బాపట్ల' },
    { handle: 'TKP_IPS', name: 'తెన్నేటి కృష్ణప్రసాద్', title: 'బాపట్ల ఎంపీ, మాజీ డీజీపీ', district: 'బాపట్ల' },

    // చిత్తూరు
    { handle: 'collector_ctr', name: 'కలెక్టర్ చిత్తూరు', title: 'Collector Chittoor', district: 'చిత్తూరు', isOfficial: true },
    { handle: 'Collector_CTR', name: 'కలెక్టర్ చిత్తూరు', title: 'Collector Chittoor', district: 'చిత్తూరు', isOfficial: true },
    { handle: 'collectorctr', name: 'కలెక్టర్ చిత్తూరు', title: 'Collector Chittoor', district: 'చిత్తూరు', isOfficial: true },
    { handle: 'Amaranatha_TDP', name: 'ఎన్. అమరనాథరెడ్డి', title: 'పలమనేరు ఎమ్మెల్యే, మాజీ మంత్రి', district: 'చిత్తూరు' },
    { handle: 'NAmaranathaRedy', name: 'ఎన్. అమరనాథరెడ్డి', title: 'పలమనేరు ఎమ్మెల్యే', district: 'చిత్తూరు' },
    { handle: 'Daggumalla_MP', name: 'దగ్గుమళ్ల ప్రసాదరావు', title: 'చిత్తూరు ఎంపీ', district: 'చిత్తూరు' },
    { handle: 'PrasadaRaoMP', name: 'దగ్గుమళ్ల ప్రసాదరావు', title: 'చిత్తూరు ఎంపీ', district: 'చిత్తూరు' }
];

async function run() {
    console.log(`Checking ${moreCandidates.length} additional candidates...`);
    const verified = [];
    for (let i = 0; i < moreCandidates.length; i++) {
        const item = moreCandidates[i];
        try {
            const res = await fetch(`https://api.fxtwitter.com/${item.handle}`);
            if (res.status === 200) {
                const data = await res.json();
                if (data.code === 200 && data.user) {
                    const u = data.user;
                    console.log(`✅ FOUND @${u.screen_name}: "${u.name}" (Tweets: ${u.tweets}, Followers: ${u.followers}) -> ${item.district} | ${item.title}`);
                    verified.push({
                        handle: `@${u.screen_name}`,
                        name: u.name,
                        tweets: u.tweets,
                        followers: u.followers,
                        description: u.description || '',
                        location: u.location || '',
                        district: item.district,
                        title: item.title,
                        category: item.isOfficial ? 'స్థానిక' : 'రాజకీయం',
                        isOfficial: !!item.isOfficial
                    });
                }
            }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 150));
    }
    fs.writeFileSync('C:\\AlfaKotlin\\scripts\\ap_more_tested_results.json', JSON.stringify(verified, null, 2));
    console.log(`\n🎉 Found ${verified.length} in this batch!`);
}
run();
