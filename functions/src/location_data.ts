// District and Mandal dataset with English and Telugu names for smart mandal extraction and reporter attribution

export const TELUGU_DISTRICT_ALIASES: Record<string, string> = {
    "karimnagar": "కరీంనగర్",
    "కరీంనగర్": "కరీంనగర్",
    "yadadri": "యాదాద్రి భువనగిరి",
    "yadadri bhuvanagiri": "యాదాద్రి భువనగిరి",
    "bhuvanagiri": "యాదాద్రి భువనగిరి",
    "యాదాద్రి భువనగిరి": "యాదాద్రి భువనగిరి",
    "kurnool": "కర్నూలు",
    "కర్నూలు": "కర్నూలు",
    "hyderabad": "హైదరాబాద్",
    "హైదరాబాద్": "హైదరాబాద్",
    "hanumakonda": "హన్మకొండ",
    "hanmakonda": "హన్మకొండ",
    "warangal": "వరంగల్",
    "వరంగల్": "వరంగల్",
    "peddapalli": "పెద్దపల్లి",
    "పెద్దపల్లి": "పెద్దపల్లి",
    "nagar kurnool": "నాగర్ కర్నూల్",
    "nagarkurnool": "నాగర్ కర్నూల్",
    "నాగర్ కర్నూల్": "నాగర్ కర్నూల్",
    "nalgonda": "నల్గొండ",
    "నల్గొండ": "నల్గొండ",
    "khammam": "ఖమ్మం",
    "ఖమ్మం": "ఖమ్మం",
    "nirmal": "నిర్మల్",
    "నిర్మల్": "నిర్మల్",
    "mancherial": "మంచిర్యాల",
    "మంచిర్యాల": "మంచిర్యాల",
    "siddipet": "సిద్దిపేట",
    "సిద్దిపేట": "సిద్దిపేట",
    "suryapet": "సూర్యాపేట",
    "సూర్యాపేట": "సూర్యాపేట",
    "sangareddy": "సంగారెడ్డి",
    "సంగారెడ్డి": "సంగారెడ్డి",
    "medak": "మెదక్",
    "మెదక్": "మెదక్",
    "kamareddy": "కామారెడ్డి",
    "కామారెడ్డి": "కామారెడ్డి",
    "nizamabad": "నిజామాబాద్",
    "నిజామాబాద్": "నిజామాబాద్",
    "jagtial": "జగిత్యాల",
    "జగిత్యాల": "జగిత్యాల",
    "rajanna sircilla": "రాజన్న సిరిసిల్ల",
    "sircilla": "రాజన్న సిరిసిల్ల",
    "రాజన్న సిరిసిల్ల": "రాజన్న సిరిసిల్ల",
    "visakhapatnam": "విశాఖపట్నం",
    "vizag": "విశాఖపట్నం",
    "విశాఖపట్నం": "విశాఖపట్నం",
    "vizianagaram": "విజయనగరం",
    "విజయనగరం": "విజయనగరం",
    "srikakulam": "శ్రీకాకుళం",
    "శ్రీకాకుళం": "శ్రీకాకుళం",
    "nellore": "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు",
    "spsr nellore": "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు",
    "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు": "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు",
    "guntur": "గుంటూరు",
    "గుంటూరు": "గుంటూరు",
    "krishna": "కృష్ణా",
    "కృష్ణా": "కృష్ణా",
    "chittoor": "చిత్తూరు",
    "చిత్తూరు": "చిత్తూరు",
    "tirupati": "తిరుపతి",
    "తిరుపతి": "తిరుపతి",
    "kadapa": "వైఎస్ఆర్ కడప",
    "వైఎస్ఆర్ కడప": "వైఎస్ఆర్ కడప",
    "anantapur": "అనంతపురం",
    "అనంతపురం": "అనంతపురం",
    "nandyal": "నంద్యాల",
    "నంద్యాల": "నంద్యాల",
    "alluri sitharama raju": "అల్లూరి సీతారామరాజు",
    "alluri sitarama raju": "అల్లూరి సీతారామరాజు",
    "asr district": "అల్లూరి సీతారామరాజు",
    "అల్లూరి సీతారామరాజు": "అల్లూరి సీతారామరాజు",
    "anakapalli": "అనకాపల్లి",
    "అనకాపల్లి": "అనకాపల్లి",
    "konaseema": "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ",
    "dr br ambedkar konaseema": "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ",
    "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ": "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ",
    "కోనసీమ": "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ",
    "vikarabad": "వికారాబాద్",
    "వికారాబాద్": "వికారాబాద్",
    "mulugu": "ములుగు",
    "ములుగు": "ములుగు",
    "bhadradri kothagudem": "భద్రాద్రి కొత్తగూడెం",
    "bhadradri": "భద్రాద్రి కొత్తగూడెం",
    "భద్రాద్రి కొత్తగూడెం": "భద్రాద్రి కొత్తగూడెం",
    "parvathipuram manyam": "పార్వతీపురం మన్యం",
    "manyam": "పార్వతీపురం మన్యం",
    "పార్వతీపురం మన్యం": "పార్వతీపురం మన్యం"
};

export const COMMON_MANDAL_LOOKUP: { mandalTelugu: string; districtTelugu: string; keywords: string[] }[] = [
    // Srikakulam
    { mandalTelugu: "పలాస", districtTelugu: "శ్రీకాకుళం", keywords: ["palasa", "పలాస", "kasibugga", "కాశీబుగ్గ", "పలాస-కాశీబుగ్గ", "పలాస కాశీబుగ్గ", "palasa kasibugga", "పలాస టౌన్", "పలాస రూరల్"] },
    { mandalTelugu: "శ్రీకాకుళం", districtTelugu: "శ్రీకాకుళం", keywords: ["srikakulam", "శ్రీకాకుళం", "srikakulam urban", "srikakulam rural", "శ్రీకాకుళం అర్బన్", "శ్రీకాకుళం రూరల్"] },
    { mandalTelugu: "టెక్కలి", districtTelugu: "శ్రీకాకుళం", keywords: ["tekkali", "టెక్కలి"] },
    { mandalTelugu: "సోంపేట", districtTelugu: "శ్రీకాకుళం", keywords: ["sompeta", "సోంపేట"] },
    { mandalTelugu: "ఇచ్ఛాపురం", districtTelugu: "శ్రీకాకుళం", keywords: ["ichchapuram", "ichapuram", "ఇచ్ఛాపురం", "ఇచ్చాపురం"] },
    { mandalTelugu: "వజ్రపుకొత్తూరు", districtTelugu: "శ్రీకాకుళం", keywords: ["vajrapukotturu", "vajrapukothuru", "వజ్రపుకొత్తూరు", "వజ్రపు కొత్తూరు"] },
    { mandalTelugu: "మందస", districtTelugu: "శ్రీకాకుళం", keywords: ["mandasa", "మందస"] },
    { mandalTelugu: "నరసన్నపేట", districtTelugu: "శ్రీకాకుళం", keywords: ["narasannapeta", "నరసన్నపేట"] },
    { mandalTelugu: "ఆమదాలవలస", districtTelugu: "శ్రీకాకుళం", keywords: ["amadalavalasa", "ఆమదాలవలస"] },
    { mandalTelugu: "సరుబుజ్జిలి", districtTelugu: "శ్రీకాకుళం", keywords: ["sarubujjili", "సరుబుజ్జిలి", "purushottapuram", "పురుషోత్తపురం"] },
    { mandalTelugu: "జలుమూరు", districtTelugu: "శ్రీకాకుళం", keywords: ["jalumuru", "జలుమూరు"] },
    { mandalTelugu: "ఎచ్చెర్ల", districtTelugu: "శ్రీకాకుళం", keywords: ["etcherla", "ఎచ్చెర్ల"] },
    { mandalTelugu: "జి.సిగడాం", districtTelugu: "శ్రీకాకుళం", keywords: ["g sigadam", "g.sigadam", "జి.సిగడాం", "జి సిగడాం"] },
    { mandalTelugu: "రణస్థలం", districtTelugu: "శ్రీకాకుళం", keywords: ["ranastalam", "రణస్థలం"] },
    { mandalTelugu: "రాజాం", districtTelugu: "శ్రీకాకుళం", keywords: ["rajam", "రాజాం"] },
    { mandalTelugu: "కోటబొమ్మాళి", districtTelugu: "శ్రీకాకుళం", keywords: ["kotabommali", "కోటబొమ్మాళి"] },
    { mandalTelugu: "సంతబొమ్మాళి", districtTelugu: "శ్రీకాకుళం", keywords: ["santabommali", "సంతబొమ్మాళి"] },
    { mandalTelugu: "కవిటి", districtTelugu: "శ్రీకాకుళం", keywords: ["kaviti", "కవిటి"] },
    { mandalTelugu: "కంచిలి", districtTelugu: "శ్రీకాకుళం", keywords: ["kanchili", "కంచిలి"] },
    { mandalTelugu: "పాతపట్నం", districtTelugu: "శ్రీకాకుళం", keywords: ["pathapatnam", "పాతపట్నం"] },
    { mandalTelugu: "మెళియాపుట్టి", districtTelugu: "శ్రీకాకుళం", keywords: ["meliaputti", "మెళియాపుట్టి"] },

    // Chittoor
    { mandalTelugu: "వెదురుకుప్పం", districtTelugu: "చిత్తూరు", keywords: ["vedurukuppam", "వెదురుకుప్పం", "marepalli", "మారేపల్లి"] },
    { mandalTelugu: "చిత్తూరు అర్బన్", districtTelugu: "చిత్తూరు", keywords: ["chittoor", "చిత్తూరు", "chittoor urban", "చిత్తూరు అర్బన్"] },
    { mandalTelugu: "చిత్తూరు రూరల్", districtTelugu: "చిత్తూరు", keywords: ["chittoor rural", "చిత్తూరు రూరల్"] },
    { mandalTelugu: "పుంగనూరు", districtTelugu: "చిత్తూరు", keywords: ["punganur", "పుంగనూరు"] },
    { mandalTelugu: "పలమనేరు", districtTelugu: "చిత్తూరు", keywords: ["palamaner", "పలమనేరు"] },
    { mandalTelugu: "కుప్పం", districtTelugu: "చిత్తూరు", keywords: ["kuppam", "కుప్పం"] },
    { mandalTelugu: "నగరి", districtTelugu: "చిత్తూరు", keywords: ["nagari", "నగరి"] },
    { mandalTelugu: "గంగాధర నెల్లూరు", districtTelugu: "చిత్తూరు", keywords: ["gd nellore", "gangadhara nellore", "గంగాధర నెల్లూరు"] },

    // Tirupati
    { mandalTelugu: "తిరుపతి అర్బన్", districtTelugu: "తిరుపతి", keywords: ["tirupati", "తిరుపతి", "tirupati urban", "తిరుపతి అర్బన్"] },
    { mandalTelugu: "తిరుపతి రూరల్", districtTelugu: "తిరుపతి", keywords: ["tirupati rural", "తిరుపతి రూరల్", "మల్లంగుంట", "mallangunta"] },
    { mandalTelugu: "శ్రీకాళహస్తి", districtTelugu: "తిరుపతి", keywords: ["srikalahasti", "శ్రీకాళహస్తి"] },
    { mandalTelugu: "చంద్రగిరి", districtTelugu: "తిరుపతి", keywords: ["chandragiri", "చంద్రగిరి"] },
    { mandalTelugu: "పుత్తూరు", districtTelugu: "తిరుపతి", keywords: ["puttur", "పుత్తూరు"] },
    { mandalTelugu: "నారాయణవనం", districtTelugu: "తిరుపతి", keywords: ["narayanavanam", "నారాయణవనం"] },
    { mandalTelugu: "పిచ్చాటూరు", districtTelugu: "తిరుపతి", keywords: ["pichatur", "పిచ్చాటూరు"] },
    { mandalTelugu: "వడమాలపేట", districtTelugu: "తిరుపతి", keywords: ["vadamalapeta", "వడమాలపేట"] },
    { mandalTelugu: "సూళ్లూరుపేట", districtTelugu: "తిరుపతి", keywords: ["sullurupeta", "సూళ్లూరుపేట"] },
    { mandalTelugu: "నాయుడుపేట", districtTelugu: "తిరుపతి", keywords: ["naidupeta", "నాయుడుపేట"] },
    { mandalTelugu: "గూడూరు", districtTelugu: "తిరుపతి", keywords: ["gudur", "గూడూరు"] },
    { mandalTelugu: "వెంకటగిరి", districtTelugu: "తిరుపతి", keywords: ["venkatagiri", "వెంకటగిరి"] },
    { mandalTelugu: "చిట్వేల్", districtTelugu: "తిరుపతి", keywords: ["chitvel", "చిట్వేల్"] },

    // Alluri Sitharama Raju
    { mandalTelugu: "చింతపల్లి", districtTelugu: "అల్లూరి సీతారామరాజు", keywords: ["chintapalli", "chinthapalli", "చింతపల్లి", "వీరవరం", "veeravaram"] },
    { mandalTelugu: "జి.కె.వీధి", districtTelugu: "అల్లూరి సీతారామరాజు", keywords: ["gudem kotha veedhi", "g.k.veedhi", "జి.కె.వీధి", "గూడెం కొత్తవీధి", "gk veedhi", "దొడ్డికొండ", "doddikonda"] },
    { mandalTelugu: "అనంతగిరి", districtTelugu: "అల్లూరి సీతారామరాజు", keywords: ["ananthagiri", "anantagiri", "అనంతగిరి", "పినకోట", "pinakota"] },
    { mandalTelugu: "అరకు వ్యాలీ", districtTelugu: "అల్లూరి సీతారామరాజు", keywords: ["araku valley", "araku", "అరకు వ్యాలీ", "అరకు"] },
    { mandalTelugu: "పాడేరు", districtTelugu: "అల్లూరి సీతారామరాజు", keywords: ["paderu", "పాడేరు"] },
    { mandalTelugu: "పెదబయలు", districtTelugu: "అల్లూరి సీతారామరాజు", keywords: ["pedabayalu", "పెదబయలు"] },
    { mandalTelugu: "డుంబ్రిగుడ", districtTelugu: "అల్లూరి సీతారామరాజు", keywords: ["dumbriguda", "డుంబ్రిగుడ"] },
    { mandalTelugu: "రంపచోడవరం", districtTelugu: "అల్లూరి సీతారామరాజు", keywords: ["ram pachodavaram", "rampachodavaram", "రంపచోడవరం"] },
    { mandalTelugu: "కొయ్యూరు", districtTelugu: "అల్లూరి సీతారామరాజు", keywords: ["koyyuru", "కొయ్యూరు"] },
    { mandalTelugu: "మారేడుమిల్లి", districtTelugu: "అల్లూరి సీతారామరాజు", keywords: ["maredumilli", "మారేడుమిల్లి"] },

    // Warangal & Hanumakonda
    { mandalTelugu: "వర్ధన్నపేట", districtTelugu: "వరంగల్", keywords: ["wardhannapet", "vardhannapet", "వర్ధన్నపేట", "venkatraopalli", "వెంకట్రావుపల్లి"] },
    { mandalTelugu: "వరంగల్", districtTelugu: "వరంగల్", keywords: ["warangal", "వరంగల్", "warangal urban", "వరంగల్ అర్బన్"] },
    { mandalTelugu: "హన్మకొండ", districtTelugu: "హన్మకొండ", keywords: ["hanumakonda", "hanmakonda", "హన్మకొండ"] },
    { mandalTelugu: "నర్సంపేట", districtTelugu: "వరంగల్", keywords: ["narsampet", "నర్సంపేట"] },
    { mandalTelugu: "రాయపర్తి", districtTelugu: "వరంగల్", keywords: ["rayaparthy", "రాయపర్తి"] },
    { mandalTelugu: "పర్వతగిరి", districtTelugu: "వరంగల్", keywords: ["parvathagiri", "పర్వతగిరి"] },

    // Karimnagar
    { mandalTelugu: "కరీంనగర్", districtTelugu: "కరీంనగర్", keywords: ["karimnagar", "కరీంనగర్", "karimnagar urban", "కరీంనగర్ అర్బన్"] },
    { mandalTelugu: "కరీంనగర్ రూరల్", districtTelugu: "కరీంనగర్", keywords: ["karimnagar rural", "కరీంనగర్ రూరల్"] },
    { mandalTelugu: "కొత్తపల్లి", districtTelugu: "కరీంనగర్", keywords: ["kothapalli", "kothapally", "కొత్తపల్లి"] },
    { mandalTelugu: "హుజూరాబాద్", districtTelugu: "కరీంనగర్", keywords: ["huzurabad", "హుజూరాబాద్"] },
    { mandalTelugu: "జమ్మికుంట", districtTelugu: "కరీంనగర్", keywords: ["jammikunta", "జమ్మికుంట"] },
    { mandalTelugu: "చొప్పదండి", districtTelugu: "కరీంనగర్", keywords: ["choppadandi", "చొప్పదండి"] },
    { mandalTelugu: "మానాకొండూరు", districtTelugu: "కరీంనగర్", keywords: ["manakondur", "మానాకొండూరు"] },
    { mandalTelugu: "తిమ్మాపూర్", districtTelugu: "కరీంనగర్", keywords: ["timmapur", "thimmapur", "తిమ్మాపూర్"] },
    { mandalTelugu: "గంగాధర", districtTelugu: "కరీంనగర్", keywords: ["gangadhara", "గంగాధర"] },
    { mandalTelugu: "రామడుగు", districtTelugu: "కరీంనగర్", keywords: ["ramadugu", "రామడుగు"] },
    { mandalTelugu: "సైదాపూర్", districtTelugu: "కరీంనగర్", keywords: ["saidapur", "సైదాపూర్"] },
    { mandalTelugu: "శంకరపట్నం", districtTelugu: "కరీంనగర్", keywords: ["shankarapatnam", "శంకరపట్నం"] },
    { mandalTelugu: "వీణవంక", districtTelugu: "కరీంనగర్", keywords: ["veenavanka", "వీణవంక"] },
    { mandalTelugu: "చిగురుమామిడి", districtTelugu: "కరీంనగర్", keywords: ["chigurumamidi", "చిగురుమామిడి"] },
    { mandalTelugu: "ఇల్లందకుంట", districtTelugu: "కరీంనగర్", keywords: ["illanthakunta", "ellanthakunta", "ఇల్లందకుంట"] },
    { mandalTelugu: "గన్నేరువరం", districtTelugu: "కరీంనగర్", keywords: ["ganneruvaram", "గన్నేరువరం"] },

    // Yadadri Bhuvanagiri
    { mandalTelugu: "సంస్థాన్ నారాయణపూర్", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["narayanpur", "నారాయణపూర్", "సంస్థాన్ నారాయణపూర్", "vaillapalle"] },
    { mandalTelugu: "మోత్కూరు", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["mothkur", "mothkuru", "మోత్కూరు", "మోత్కూర్"] },
    { mandalTelugu: "భువనగిరి", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["bhuvanagiri", "bhongir", "భువనగిరి"] },
    { mandalTelugu: "చౌటుప్పల్", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["choutuppal", "చౌటుప్పల్"] },
    { mandalTelugu: "ఆలేరు", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["aler", "ఆలేరు"] },
    { mandalTelugu: "గుండాల", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["gundala", "గుండాల"] },
    { mandalTelugu: "రాజాపేట", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["rajapet", "రాజాపేట"] },
    { mandalTelugu: "యాదగిరిగుట్ట", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["yadagirigutta", "యాదగిరిగుట్ట"] },
    { mandalTelugu: "వలిగొండ", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["valigonda", "వలిగొండ", "puligilla", "పులిగిల్ల"] },
    { mandalTelugu: "ఆత్మకూరు(ఎం)", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["atmakur", "ఆత్మకూరు", "ఆత్మకూరు(ఎం)", "athmakur m"] },
    { mandalTelugu: "అడ్డగూడూరు", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["addagudur", "అడ్డగూడూరు"] },

    // Kurnool
    { mandalTelugu: "ఆదోని", districtTelugu: "కర్నూలు", keywords: ["adoni", "ఆదోని", "ఆదోని అర్బన్", "ఆదోని రూరల్"] },
    { mandalTelugu: "కర్నూలు అర్బన్", districtTelugu: "కర్నూలు", keywords: ["kurnool", "కర్నూలు", "kurnool urban"] },
    { mandalTelugu: "ఎమ్మిగనూరు", districtTelugu: "కర్నూలు", keywords: ["yemmiganur", "ఎమ్మిగనూరు"] },
    { mandalTelugu: "ఆలూరు", districtTelugu: "కర్నూలు", keywords: ["alur", "ఆలూరు"] },
    { mandalTelugu: "పత్తికొండ", districtTelugu: "కర్నూలు", keywords: ["pattikonda", "పత్తికొండ"] },
    { mandalTelugu: "గోనెగండ్ల", districtTelugu: "కర్నూలు", keywords: ["gonegandla", "గోనెగండ్ల"] },
    { mandalTelugu: "మంత్రాలయం", districtTelugu: "కర్నూలు", keywords: ["mantralayam", "మంత్రాలయం"] },
    { mandalTelugu: "కోడుమూరు", districtTelugu: "కర్నూలు", keywords: ["kodumur", "కోడుమూరు"] },

    // Peddapalli
    { mandalTelugu: "మంథని", districtTelugu: "పెద్దపల్లి", keywords: ["manthani", "మంథని"] },
    { mandalTelugu: "పెద్దపల్లి", districtTelugu: "పెద్దపల్లి", keywords: ["peddapalli", "పెద్దపల్లి"] },
    { mandalTelugu: "గోదావరిఖని", districtTelugu: "పెద్దపల్లి", keywords: ["godavarikhani", "గోదావరిఖని", "రామగుండం", "ramagundam"] },
    { mandalTelugu: "సుల్తానాబాద్", districtTelugu: "పెద్దపల్లి", keywords: ["sultanabad", "సుల్తానాబాద్"] },

    // Nagar Kurnool
    { mandalTelugu: "కల్వకుర్తి", districtTelugu: "నాగర్ కర్నూల్", keywords: ["kalwakurthy", "kalvakurthi", "కల్వకుర్తి"] },
    { mandalTelugu: "నాగర్ కర్నూల్", districtTelugu: "నాగర్ కర్నూల్", keywords: ["nagar kurnool", "nagarkurnool", "నాగర్ కర్నూల్"] },
    { mandalTelugu: "అచ్చంపేట", districtTelugu: "నాగర్ కర్నూల్", keywords: ["achampet", "అచ్చంపేట"] },
    { mandalTelugu: "కొల్లాపూర్", districtTelugu: "నాగర్ కర్నూల్", keywords: ["kollapur", "కొల్లాపూర్"] },

    // Nirmal
    { mandalTelugu: "నిర్మల్", districtTelugu: "నిర్మల్", keywords: ["nirmal", "నిర్మల్", "nirmal urban", "nirmal rural"] },
    { mandalTelugu: "భైంసా", districtTelugu: "నిర్మల్", keywords: ["bhainsa", "భైంసా"] },
    { mandalTelugu: "ఖానాపూర్", districtTelugu: "నిర్మల్", keywords: ["khanapur", "ఖానాపూర్"] },
    { mandalTelugu: "దస్తురాబాద్", districtTelugu: "నిర్మల్", keywords: ["dasthurabad", "dasturabad", "దస్తురాబాద్", "మున్యాల్", "munyal"] },
    { mandalTelugu: "కడెం", districtTelugu: "నిర్మల్", keywords: ["kadem", "కడెం"] },

    // Mancherial
    { mandalTelugu: "మంచిర్యాల", districtTelugu: "మంచిర్యాల", keywords: ["mancherial", "మంచిర్యాల"] },
    { mandalTelugu: "బెల్లంపల్లి", districtTelugu: "మంచిర్యాల", keywords: ["bellampalli", "బెల్లంపల్లి"] },
    { mandalTelugu: "చెన్నూర్", districtTelugu: "మంచిర్యాల", keywords: ["chennur", "చెన్నూర్"] },
    { mandalTelugu: "మందమర్రి", districtTelugu: "మంచిర్యాల", keywords: ["mandamarri", "మందమర్రి"] },
    { mandalTelugu: "జన్నారం", districtTelugu: "మంచిర్యాల", keywords: ["jannaram", "జన్నారం", "ponkal", "పొన్కల్"] },
    { mandalTelugu: "దండేపల్లి", districtTelugu: "మంచిర్యాల", keywords: ["dandepally", "దండేపల్లి", "దండపల్లి"] },
    { mandalTelugu: "లక్షెట్టిపేట", districtTelugu: "మంచిర్యాల", keywords: ["luxettipet", "లక్షెట్టిపేట"] },

    // Nellore (SPSR Nellore)
    { mandalTelugu: "బుచ్చిరెడ్డిపాలెం", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["buchireddypalem", "బుచ్చిరెడ్డిపాలెం"] },
    { mandalTelugu: "సంగం", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["sangam", "సంగం"] },
    { mandalTelugu: "నెల్లూరు అర్బన్", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["nellore", "నెల్లూరు", "nellore urban", "నెల్లూరు అర్బన్"] },
    { mandalTelugu: "నెల్లూరు రూరల్", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["nellore rural", "నెల్లూరు రూరల్"] },
    { mandalTelugu: "కోవూరు", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["kovur", "కోవూరు"] },
    { mandalTelugu: "కందుకూరు", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["kandukur", "కందుకూరు"] },
    { mandalTelugu: "కావలి", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["kavali", "కావలి"] },
    { mandalTelugu: "ఆత్మకూరు", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["atmakur", "ఆత్మకూరు"] },
    { mandalTelugu: "ఉదయగిరి", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["udayagiri", "ఉదయగిరి"] },
    { mandalTelugu: "వెంకటాచలం", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["venkatachalam", "వెంకటాచలం"] },
    { mandalTelugu: "మర్రిపాడు", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["marripadu", "మర్రిపాడు"] },
    { mandalTelugu: "ఏఎస్‌పేట", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["as peta", "a.s.peta", "ఏఎస్‌పేట"] },

    // Khammam
    { mandalTelugu: "నేలకొండపల్లి", districtTelugu: "ఖమ్మం", keywords: ["nelakondapalli", "nelakondapally", "నేలకొండపల్లి", "kotha kothuru"] },
    { mandalTelugu: "ఖమ్మం అర్బన్", districtTelugu: "ఖమ్మం", keywords: ["khammam", "ఖమ్మం", "khammam urban", "ఖమ్మం అర్బన్"] },
    { mandalTelugu: "ఖమ్మం రూరల్", districtTelugu: "ఖమ్మం", keywords: ["khammam rural", "ఖమ్మం రూరల్"] },
    { mandalTelugu: "వైరా", districtTelugu: "ఖమ్మం", keywords: ["wyra", "వైరా"] },
    { mandalTelugu: "మధిర", districtTelugu: "ఖమ్మం", keywords: ["madhira", "మధిర"] },
    { mandalTelugu: "సత్తుపల్లి", districtTelugu: "ఖమ్మం", keywords: ["sathupalli", "sattupalli", "సత్తుపల్లి"] },
    { mandalTelugu: "వేంసూరు", districtTelugu: "ఖమ్మం", keywords: ["vemsur", "వేంసూరు"] },

    // Siddipet
    { mandalTelugu: "హుస్నాబాద్", districtTelugu: "సిద్దిపేట", keywords: ["husnabad", "hasnabad", "హుస్నాబాద్", "హస్నాబాద్"] },
    { mandalTelugu: "సిద్దిపేట అర్బన్", districtTelugu: "సిద్దిపేట", keywords: ["siddipet", "సిద్దిపేట", "siddipet urban", "సిద్దిపేట అర్బన్"] },
    { mandalTelugu: "గజ్వేల్", districtTelugu: "సిద్దిపేట", keywords: ["gajwel", "గజ్వేల్"] },
    { mandalTelugu: "దుబ్బాక", districtTelugu: "సిద్దిపేట", keywords: ["dubbaka", "దుబ్బాక"] },
    { mandalTelugu: "చేర్యాల", districtTelugu: "సిద్దిపేట", keywords: ["cheryal", "చేర్యాల"] },
    { mandalTelugu: "అక్కన్నపేట", districtTelugu: "సిద్దిపేట", keywords: ["akkannapet", "అక్కన్నపేట"] },

    // Vikarabad
    { mandalTelugu: "బంట్వారం", districtTelugu: "వికారాబాద్", keywords: ["bantwaram", "బంట్వారం"] },
    { mandalTelugu: "వికారాబాద్", districtTelugu: "వికారాబాద్", keywords: ["vikarabad", "వికారాబాద్"] },
    { mandalTelugu: "తాండూరు", districtTelugu: "వికారాబాద్", keywords: ["tandur", "తాండూరు"] },
    { mandalTelugu: "పరిగి", districtTelugu: "వికారాబాద్", keywords: ["parigi", "పరిగి"] },

    // Jagtial
    { mandalTelugu: "వెల్గటూరు", districtTelugu: "జగిత్యాల", keywords: ["velgatoor", "velgatur", "వెల్గటూరు", "endapalli", "ఎండపల్లి", "maredupalle"] },
    { mandalTelugu: "జగిత్యాల", districtTelugu: "జగిత్యాల", keywords: ["jagtial", "జగిత్యాల"] },
    { mandalTelugu: "కోరుట్ల", districtTelugu: "జగిత్యాల", keywords: ["korutla", "కోరుట్ల"] },
    { mandalTelugu: "మెట్‌పల్లి", districtTelugu: "జగిత్యాల", keywords: ["metpally", "మెట్‌పల్లి"] },

    // Anakapalli
    { mandalTelugu: "బుచ్చయ్యపేట", districtTelugu: "అనకాపల్లి", keywords: ["buchayyapeta", "buchiahpeta", "బుచ్చయ్యపేట", "వడ్డాది", "vaddadi"] },
    { mandalTelugu: "అనకాపల్లి", districtTelugu: "అనకాపల్లి", keywords: ["anakapalli", "అనకాపల్లి"] },
    { mandalTelugu: "చోడవరం", districtTelugu: "అనకాపల్లి", keywords: ["chodavaram", "చోడవరం"] },
    { mandalTelugu: "నర్సీపట్నం", districtTelugu: "అనకాపల్లి", keywords: ["narsipatnam", "నర్సీపట్నం"] },
    { mandalTelugu: "దేవరాపల్లి", districtTelugu: "అనకాపల్లి", keywords: ["devarapalli", "దేవరాపల్లి"] },

    // Konaseema
    { mandalTelugu: "రాజోలు", districtTelugu: "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ", keywords: ["razole", "రాజోలు", "ponnamanda", "పొన్నమండ"] },
    { mandalTelugu: "అమలాపురం", districtTelugu: "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ", keywords: ["amalapuram", "అమలాపురం"] },
    { mandalTelugu: "రావులపాలెం", districtTelugu: "డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ", keywords: ["ravulapalem", "రావులపాలెం"] },

    // Vizianagaram
    { mandalTelugu: "బొబ్బిలి", districtTelugu: "విజయనగరం", keywords: ["bobbili", "బొబ్బిలి"] },
    { mandalTelugu: "విజయనగరం", districtTelugu: "విజయనగరం", keywords: ["vizianagaram", "విజయనగరం", "hukkumpeta", "హుకుంపేట"] },
    { mandalTelugu: "చీపురుపల్లి", districtTelugu: "విజయనగరం", keywords: ["cheepurupalli", "చీపురుపల్లి"] },

    // Visakhapatnam
    { mandalTelugu: "గాజువాక", districtTelugu: "విశాఖపట్నం", keywords: ["gajuwaka", "గాజువాక", "aganampudi", "వడ్లపూడి", "vadlapudi"] },
    { mandalTelugu: "భీమునిపట్నం", districtTelugu: "విశాఖపట్నం", keywords: ["bheemunipatnam", "bheemili", "భీమిలి"] },
    { mandalTelugu: "విశాఖపట్నం అర్బన్", districtTelugu: "విశాఖపట్నం", keywords: ["visakhapatnam", "vizag", "విశాఖపట్నం"] }
];

/**
 * Helper: Check if two mandal names refer to the same mandal or a sub-locality within the mandal.
 * Handles English/Telugu aliases, Urban/Rural suffixes, and common local town names.
 */
export function areMandalsMatching(mandal1: string, mandal2: string, district?: string): boolean {
    if (!mandal1 || !mandal2) return false;
    
    const m1 = mandal1.trim();
    const m2 = mandal2.trim();
    if (!m1 || !m2) return false;

    // 1. Direct match (normalized)
    const norm1 = m1.toLowerCase().replace(/[\s\-_()]/g, '');
    const norm2 = m2.toLowerCase().replace(/[\s\-_()]/g, '');
    if (norm1 === norm2) return true;

    // 2. If reporter is assigned as district-level or whole district
    const isDistrictRole = norm2 === 'జిల్లావిలేకరి' || norm2 === 'districtreporter' || norm2 === 'all';
    if (isDistrictRole) return true;

    // 3. Match via COMMON_MANDAL_LOOKUP keywords
    const lower1 = m1.toLowerCase();
    const lower2 = m2.toLowerCase();

    for (const item of COMMON_MANDAL_LOOKUP) {
        if (district && item.districtTelugu !== district) continue;

        const itemNorm = item.mandalTelugu.toLowerCase().replace(/[\s\-_()]/g, '');
        const matches1 = itemNorm === norm1 ||
                         item.keywords.some(kw => lower1 === kw.toLowerCase() || lower1.includes(kw.toLowerCase()) || kw.toLowerCase().includes(lower1));
        const matches2 = itemNorm === norm2 ||
                         item.keywords.some(kw => lower2 === kw.toLowerCase() || lower2.includes(kw.toLowerCase()) || kw.toLowerCase().includes(lower2));

        if (matches1 && matches2) {
            return true;
        }
    }

    // 4. Substring / Urban-Rural match (e.g. "పలాస" in "పలాస - కాశీబుగ్గ" or "నెల్లూరు" in "నెల్లూరు అర్బన్")
    if ((norm1.length >= 3 && norm2.includes(norm1)) || (norm2.length >= 3 && norm1.includes(norm2))) {
        return true;
    }

    return false;
}

/**
 * Smartly extract District and Mandal from text (address, interestedArea, position, userDistrict)
 */
export function extractDistrictAndMandal(
    address: string = "",
    interestedArea: string = "",
    userDistrict: string = "",
    userAddress: string = ""
): { district: string; mandal: string } {
    const combinedText = `${address} ${interestedArea} ${userAddress}`.toLowerCase();
    
    // 1. Resolve district if possible
    let resolvedDistrict = userDistrict ? (TELUGU_DISTRICT_ALIASES[userDistrict.toLowerCase().trim()] || userDistrict) : "";
    if (!resolvedDistrict) {
        for (const [alias, teluguDist] of Object.entries(TELUGU_DISTRICT_ALIASES)) {
            if (combinedText.includes(alias)) {
                resolvedDistrict = teluguDist;
                break;
            }
        }
    }

    // 2. Search for mandal match in COMMON_MANDAL_LOOKUP
    for (const item of COMMON_MANDAL_LOOKUP) {
        // If we already know the district, prioritize mandals in that district
        if (resolvedDistrict && item.districtTelugu !== resolvedDistrict) {
            continue;
        }

        for (const kw of item.keywords) {
            if (combinedText.includes(kw.toLowerCase())) {
                return {
                    district: resolvedDistrict || item.districtTelugu,
                    mandal: item.mandalTelugu
                };
            }
        }
    }

    // 3. Fallback: if district is known, check if any mandal keyword matches anywhere
    for (const item of COMMON_MANDAL_LOOKUP) {
        for (const kw of item.keywords) {
            if (combinedText.includes(kw.toLowerCase())) {
                return {
                    district: resolvedDistrict || item.districtTelugu,
                    mandal: item.mandalTelugu
                };
            }
        }
    }

    // 4. Default to District HQ mandal if only district is matched
    if (resolvedDistrict) {
        return {
            district: resolvedDistrict,
            mandal: resolvedDistrict
        };
    }

    return { district: "", mandal: "" };
}
