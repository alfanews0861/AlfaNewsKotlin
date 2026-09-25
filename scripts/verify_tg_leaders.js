const fs = require('fs');
const path = require('path');

// Candidate list of Telangana Political Leaders & Official Handles to test
const candidates = [
    // --- State / Ministers / Key Leaders ---
    { handle: "revanth_anumula", name: "ఎనుముల రేవంత్ రెడ్డి (Revanth Reddy - CM)", district: "వికారాబాద్", party: "INC" },
    { handle: "KTRBRS", name: "కె.టి. రామారావు (KTR - BRS Working President, Sircilla MLA)", district: "రాజన్న సిరిసిల్ల", party: "BRS" },
    { handle: "BRSHarish", name: "తన్నీరు హరీష్ రావు (T. Harish Rao - Siddipet MLA)", district: "సిద్దిపేట", party: "BRS" },
    { handle: "Bhatti_Mallu", name: "మల్లు భట్టి విక్రమార్క (Bhatti Vikramarka - Dy CM, Madhira MLA)", district: "ఖమ్మం", party: "INC" },
    { handle: "bandisanjay_bjp", name: "బండి సంజయ్ కుమార్ (Bandi Sanjay - MoS Home, MP Karimnagar)", district: "కరీంనగర్", party: "BJP" },
    { handle: "kishanreddybjp", name: "జి. కిషన్ రెడ్డి (G. Kishan Reddy - Union Minister, MP Secunderabad)", district: "హైదరాబాద్", party: "BJP" },
    { handle: "Eatala_Rajender", name: "ఈటల రాజేందర్ (Eatala Rajender - MP Malkajgiri)", district: "మేడ్చల్ మల్కాజిగిరి", party: "BJP" },
    { handle: "iamkondasurekha", name: "కొండా సురేఖ (Konda Surekha - Minister, Warangal East MLA)", district: "వరంగల్", party: "INC" },
    { handle: "seethakkaMLA", name: "దనసరి అనసూయ (సీతక్క) (Seethakka - Minister, Mulugu MLA)", district: "ములుగు", party: "INC" },
    { handle: "asadowaisi", name: "అసదుద్దీన్ ఒవైసీ (Asaduddin Owaisi - MP Hyderabad, AIMIM Chief)", district: "హైదరాబాద్", party: "AIMIM" },
    { handle: "AkbarOwaisi_", name: "అక్బరుద్దీన్ ఒవైసీ (Akbaruddin Owaisi - Chandrayangutta MLA)", district: "హైదరాబాద్", party: "AIMIM" },
    { handle: "TigerRajaSingh", name: "టి. రాజాసింగ్ (T. Raja Singh - Goshamahal MLA)", district: "హైదరాబాద్", party: "BJP" },
    { handle: "Arvindharmapuri", name: "ధర్మపురి అరవింద్ (Arvind Dharmapuri - MP Nizamabad)", district: "నిజామాబాద్", party: "BJP" },
    { handle: "RaghunandanraoM", name: "ఎం. రఘునందన్ రావు (M. Raghunandan Rao - MP Medak)", district: "మెదక్", party: "BJP" },
    { handle: "arunadk_bjp", name: "డి.కె. అరుణ (D.K. Aruna - MP Mahabubnagar, BJP National VP)", district: "మహబూబ్‌నగర్", party: "BJP" },
    { handle: "KVishReddy", name: "కొండా విశ్వేశ్వర్ రెడ్డి (Konda Vishweshwar Reddy - MP Chevella)", district: "రంగారెడ్డి", party: "BJP" },
    { handle: "KadiyamSrihari", name: "కడియం శ్రీహరి (Kadiyam Srihari - Station Ghanpur MLA)", district: "హన్మకొండ", party: "INC" },
    { handle: "RaoKavitha", name: "కల్వకుంట్ల కవిత (K. Kavitha - MLC)", district: "హైదరాబాద్", party: "BRS" },
    { handle: "kavitha_trs", name: "కవిత (Kavitha Kalvakuntla)", district: "హైదరాబాద్", party: "BRS" },
    { handle: "OffDSB", name: "దుద్దిళ్ల శ్రీధర్ బాబు (D. Sridhar Babu - IT Minister, Manthani MLA)", district: "పెద్దపల్లి", party: "INC" },
    { handle: "d_sridharbabu", name: "శ్రీధర్ బాబు (Duddilla Sridhar Babu)", district: "పెద్దపల్లి", party: "INC" },
    { handle: "UttamINC", name: "నలమాద ఉత్తమ్ కుమార్ రెడ్డి (N. Uttam Kumar Reddy - Minister, Huzurnagar MLA)", district: "సూర్యాపేట", party: "INC" },
    { handle: "uttamkumarreddy", name: "ఉత్తమ్ కుమార్ రెడ్డి (Uttam Kumar Reddy)", district: "సూర్యాపేట", party: "INC" },
    { handle: "KomatireddyVenkat", name: "కోమటిరెడ్డి వెంకట్ రెడ్డి (Komatireddy Venkat Reddy - Minister, Nalgonda MLA)", district: "నల్గొండ", party: "INC" },
    { handle: "rajgopalreddyk", name: "కోమటిరెడ్డి రాజగోపాల్ రెడ్డి (K. Rajgopal Reddy - Munugode MLA)", district: "నల్గొండ", party: "INC" },
    { handle: "DamodarCdn", name: "సి. దామోదర రాజనర్సింహ (Damodar Raja Narasimha - Health Minister, Andole MLA)", district: "సంగారెడ్డి", party: "INC" },
    { handle: "PonnamINC", name: "పొన్నం ప్రభాకర్ (Ponnam Prabhakar - Transport Minister, Husnabad MLA)", district: "సిద్దిపేట", party: "INC" },
    { handle: "Jupally_KR", name: "జూపల్లి కృష్ణారావు (Jupally Krishna Rao - Minister, Kollapur MLA)", district: "నాగర్ కర్నూల్", party: "INC" },
    { handle: "VSrinivasGoud", name: "వి. శ్రీనివాస్ గౌడ్ (V. Srinivas Goud - Ex-Minister, Mahabubnagar)", district: "మహబూబ్‌నగర్", party: "BRS" },
    { handle: "pallarreddy", name: "పల్లా రాజేశ్వర్ రెడ్డి (Palla Rajeshwar Reddy - Jangaon MLA)", district: "జనగాం", party: "BRS" },
    { handle: "rspraveenswaero", name: "డాక్టర్ ఆర్.ఎస్. ప్రవీణ్ కుమార్ (Dr. R.S. Praveen Kumar - BRS Sirpur)", district: "కుమ్రం భీమ్ ఆసిఫాబాద్", party: "BRS" },
    { handle: "kpremsagarrao", name: "కొక్కిరాల ప్రేమ్‌సాగర్ రావు (K. Premsagar Rao - Mancherial MLA)", district: "మంచిర్యాల", party: "INC" },
    { handle: "balkasumanTRS", name: "బాల్క సుమన్ (Balka Suman - Ex-MLA Chennur)", district: "మంచిర్యాల", party: "BRS" },
    { handle: "G_Vivekanand", name: "గడ్డం వివేకానంద్ (Dr. G. Vivekanand - Chennur MLA)", district: "మంచిర్యాల", party: "INC" },
    { handle: "DrMalluRavi", name: "డాక్టర్ మల్లు రవి (Dr. Mallu Ravi - MP Nagarkurnool)", district: "నాగర్ కర్నూల్", party: "INC" },
    { handle: "chamalakiraninc", name: "చామల కిరణ్ కుమార్ రెడ్డి (Chamala Kiran Kumar Reddy - MP Bhongir)", district: "యాదాద్రి భువనగిరి", party: "INC" },
    { handle: "JagadishBRS", name: "గుంటకండ్ల జగదీష్ రెడ్డి (G. Jagadish Reddy - Suryapet MLA)", district: "సూర్యాపేట", party: "BRS" },
    { handle: "jagadishreddytrs", name: "జగదీష్ రెడ్డి (Jagadish Reddy)", district: "సూర్యాపేట", party: "BRS" },
    { handle: "jeevanreddyinc", name: "టి. జీవన్ రెడ్డి (T. Jeevan Reddy - Senior Leader, MLC Jagtial)", district: "జగిత్యాల", party: "INC" },
    { handle: "JaggaReddyINC", name: "తూర్పు జయప్రకాష్ రెడ్డి (జగ్గారెడ్డి) (Jagga Reddy - Ex-MLA Sangareddy)", district: "సంగారెడ్డి", party: "INC" },
    { handle: "NiranjanReddyTRS", name: "సింగిరెడ్డి నిరంజన్ రెడ్డి (S. Niranjan Reddy - Ex-Minister Wanaparthy)", district: "వనపర్తి", party: "BRS" },
    { handle: "VPR_TRS", name: "వేముల ప్రశాంత్ రెడ్డి (Vemula Prashanth Reddy - Balkonda MLA)", district: "నిజామాబాద్", party: "BRS" },
    { handle: "MaheswarReddyBJP", name: "ఏలేటి మహేశ్వర్ రెడ్డి (A. Maheshwar Reddy - BJP Floor Leader, Nirmal MLA)", district: "నిర్మల్", party: "BJP" },
    { handle: "IKReddyOfficial", name: "అల్లోల ఇంద్రకరణ్ రెడ్డి (A. Indrakaran Reddy - Ex-Minister Nirmal)", district: "నిర్మల్", party: "BRS" },
    { handle: "ahmedbalala", name: "అహ్మద్ బలాలా (Ahmed Balala - Malakpet MLA)", district: "హైదరాబాద్", party: "AIMIM" },
    { handle: "kausarmohiuddin", name: "కౌసర్ మొహియుద్దీన్ (Kausar Mohiuddin - Karwan MLA)", district: "హైదరాబాద్", party: "AIMIM" },
    { handle: "KausarAIMIM", name: "కౌసర్ మొహియుద్దీన్ (Kausar Mohiuddin)", district: "హైదరాబాద్", party: "AIMIM" },
    { handle: "JafferMeraj", name: "జాఫర్ హుస్సేన్ మిరాజ్ (Jaffer Hussain Meraj - Yakutpura MLA)", district: "హైదరాబాద్", party: "AIMIM" },
    { handle: "danam_nagender", name: "దానం నాగేందర్ (Danam Nagender - Khairatabad MLA)", district: "హైదరాబాద్", party: "INC" },
    { handle: "TalasaniTRS", name: "తలసాని శ్రీనివాస్ యాదవ్ (Talasani Srinivas Yadav - Sanathnagar MLA)", district: "హైదరాబాద్", party: "BRS" },
    { handle: "Talasani_SY", name: "తలసాని శ్రీనివాస్ యాదవ్ (Talasani Srinivas Yadav)", district: "హైదరాబాద్", party: "BRS" },
    { handle: "mutagopalbrs", name: "ముఠా గోపాల్ (Muta Gopal - Musheerabad MLA)", district: "హైదరాబాద్", party: "BRS" },
    { handle: "chmalla_reddy", name: "చామకూర మల్లారెడ్డి (Ch. Malla Reddy - Medchal MLA)", district: "మేడ్చల్ మల్కాజిగిరి", party: "BRS" },
    { handle: "KP_Vivekanand", name: "కె.పి. వివేకానంద గౌడ్ (KP Vivekananda - Quthbullapur MLA)", district: "మేడ్చల్ మల్కాజిగిరి", party: "BRS" },
    { handle: "SabithaIndraRedd", name: "సబితా ఇంద్రారెడ్డి (P. Sabitha Indra Reddy - Maheshwaram MLA)", district: "రంగారెడ్డి", party: "BRS" },
    { handle: "ArekapudiGandhi", name: "అరెకపూడి గాంధీ (Arekapudi Gandhi - Serilingampally MLA)", district: "రంగారెడ్డి", party: "INC" },
    { handle: "KTRoffice", name: "KTR ఆఫీస్ (KTR Office)", district: "రాజన్న సిరిసిల్ల", party: "BRS" },
    { handle: "HarishRaoOffice", name: "హరీష్ రావు ఆఫీస్ (Harish Rao Office)", district: "సిద్దిపేట", party: "BRS" },
    { handle: "KCRBRSPresident", name: "కల్వకుంట్ల చంద్రశేఖర్ రావు (KCR - BRS President, Ex-CM)", district: "సిద్దిపేట", party: "BRS" },

    // --- Verified Police Commissionerates / SPs ---
    { handle: "hydcitypolice", name: "హైదరాబాద్ సిటీ పోలీస్ (Hyderabad City Police)", district: "హైదరాబాద్", party: "Police" },
    { handle: "CyberabadPolice", name: "సైబరాబాద్ పోలీస్ కమిషనరేట్ (Cyberabad Police)", district: "మేడ్చల్ మల్కాజిగిరి", party: "Police" },
    { handle: "RachakondaCop", name: "రాచకొండ పోలీస్ కమిషనరేట్ (Rachakonda Police)", district: "మేడ్చల్ మల్కాజిగిరి", party: "Police" },
    { handle: "warangalpolice", name: "వరంగల్ పోలీస్ కమిషనరేట్ (Warangal Police Commissionerate)", district: "హన్మకొండ", party: "Police" },
    { handle: "cpkarimnagar", name: "కరీంనగర్ పోలీస్ కమిషనరేట్ (Karimnagar Police Commissionerate)", district: "కరీంనగర్", party: "Police" },
    { handle: "cp_nizamabad", name: "నిజామాబాద్ పోలీస్ కమిషనరేట్ (Nizamabad Police Commissionerate)", district: "నిజామాబాద్", party: "Police" },
    { handle: "cp_ramagundam", name: "రామగుండం పోలీస్ కమిషనరేట్ (Ramagundam Police Commissionerate)", district: "పెద్దపల్లి", party: "Police" },
    { handle: "cp_siddipet", name: "సిద్దిపేట పోలీస్ కమిషనరేట్ (Siddipet Police Commissionerate)", district: "సిద్దిపేట", party: "Police" },
    { handle: "cp_khammam", name: "ఖమ్మం పోలీస్ కమిషనరేట్ (Khammam Police Commissionerate)", district: "ఖమ్మం", party: "Police" },
    { handle: "TelanganaCOPs", name: "తెలంగాణ స్టేట్ పోలీస్ (Telangana State Police - DGP)", district: "", party: "Police" },

    // --- Verified State Media / I&PR ---
    { handle: "ipr_telangana", name: "సమాచార పౌర సంబంధాల శాఖ (I&PR Telangana)", district: "", party: "Govt" },
    { handle: "TelanganaCMO", name: "తెలంగాణ సీఎంవో (Telangana CMO)", district: "హైదరాబాద్", party: "Govt" }
];

async function verifyAll() {
    console.log(`Starting Live Verification for ${candidates.length} candidate handles...\n`);
    const verified = [];
    const rejected = [];

    for (let i = 0; i < candidates.length; i++) {
        const item = candidates[i];
        const h = item.handle;

        try {
            const res = await fetch(`https://api.fxtwitter.com/${h}`);
            const data = await res.json();

            if (data.code === 200 && data.user) {
                const u = data.user;
                const tweets = u.tweets || 0;
                const bio = (u.description || '').replace(/\n/g, ' ');

                if (tweets > 0) {
                    console.log(`[${i + 1}/${candidates.length}] ✅ VERIFIED: @${u.screen_name} -> "${u.name}" (${tweets} tweets) | Bio: ${bio.substring(0, 60)}...`);
                    verified.push({
                        handle: `@${u.screen_name}`,
                        realName: u.name,
                        sourceName: `${u.name} (${item.name.split('(')[1] || item.name}`,
                        district: item.district,
                        state: "Telangana",
                        category: item.party === "Police" || item.party === "Govt" ? "స్థానిక" : "రాజకీయం",
                        tweets: tweets,
                        bio: bio
                    });
                } else {
                    console.log(`[${i + 1}/${candidates.length}] ⚠️ ZERO TWEETS (INACTIVE): @${h}`);
                    rejected.push({ handle: h, reason: "Zero tweets / Inactive" });
                }
            } else {
                console.log(`[${i + 1}/${candidates.length}] ❌ NOT FOUND: @${h} (${data.message || data.code})`);
                rejected.push({ handle: h, reason: data.message || "Not found" });
            }
        } catch (e) {
            console.log(`[${i + 1}/${candidates.length}] ❌ ERROR: @${h} (${e.message})`);
            rejected.push({ handle: h, reason: e.message });
        }

        await new Promise(r => setTimeout(r, 250)); // polite delay
    }

    const outputPath = path.join(__dirname, '..', 'telangana_verified_handles.json');
    fs.writeFileSync(outputPath, JSON.stringify(verified, null, 2), 'utf8');

    console.log("\n==================================================");
    console.log("📊 VERIFICATION RESULTS");
    console.log(`✅ Total Verified Active Handles: ${verified.length}`);
    console.log(`❌ Rejected / Not Found Handles: ${rejected.length}`);
    console.log(`Saved to: ${outputPath}`);
    console.log("==================================================");
}

verifyAll().catch(console.error);
