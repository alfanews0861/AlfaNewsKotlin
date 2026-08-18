// District and Mandal dataset with English and Telugu names for smart mandal extraction

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
    "నంద్యాల": "నంద్యాల"
};

export const COMMON_MANDAL_LOOKUP: { mandalTelugu: string; districtTelugu: string; keywords: string[] }[] = [
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
    { mandalTelugu: "మోత్కూరు", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["mothkur", "mothkuru", "మోత్కూరు", "మోత్కూర్"] },
    { mandalTelugu: "భువనగిరి", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["bhuvanagiri", "bhongir", "భువనగిరి"] },
    { mandalTelugu: "చౌటుప్పల్", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["choutuppal", "చౌటుప్పల్"] },
    { mandalTelugu: "ఆలేరు", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["aler", "ఆలేరు"] },
    { mandalTelugu: "గుండాల", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["gundala", "గుండాల"] },
    { mandalTelugu: "రాజాపేట", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["rajapet", "రాజాపేట"] },
    { mandalTelugu: "యాదగిరిగుట్ట", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["yadagirigutta", "యాదగిరిగుట్ట"] },
    { mandalTelugu: "వలిగొండ", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["valigonda", "వలిగొండ"] },
    { mandalTelugu: "ఆత్మకూరు(ఎం)", districtTelugu: "యాదాద్రి భువనగిరి", keywords: ["atmakur", "ఆత్మకూరు"] },
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

    // Mancherial
    { mandalTelugu: "మంచిర్యాల", districtTelugu: "మంచిర్యాల", keywords: ["mancherial", "మంచిర్యాల"] },
    { mandalTelugu: "బెల్లంపల్లి", districtTelugu: "మంచిర్యాల", keywords: ["bellampalli", "బెల్లంపల్లి"] },
    { mandalTelugu: "చెన్నూర్", districtTelugu: "మంచిర్యాల", keywords: ["chennur", "చెన్నూర్"] },
    { mandalTelugu: "మందమర్రి", districtTelugu: "మంచిర్యాల", keywords: ["mandamarri", "మందమర్రి"] },

    // Nellore (SPSR Nellore)
    { mandalTelugu: "సంగం", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["sangam", "సంగం"] },
    { mandalTelugu: "నెల్లూరు అర్బన్", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["nellore", "నెల్లూరు"] },
    { mandalTelugu: "కోవూరు", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["kovur", "కోవూరు"] },
    { mandalTelugu: "కందుకూరు", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["kandukur", "కందుకూరు"] },
    { mandalTelugu: "కావలి", districtTelugu: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", keywords: ["kavali", "కావలి"] },

    // Vizianagaram
    { mandalTelugu: "బొబ్బిలి", districtTelugu: "విజయనగరం", keywords: ["bobbili", "బొబ్బిలి"] },
    { mandalTelugu: "విజయనగరం", districtTelugu: "విజయనగరం", keywords: ["vizianagaram", "విజయనగరం"] },
    { mandalTelugu: "చీపురుపల్లి", districtTelugu: "విజయనగరం", keywords: ["cheepurupalli", "చీపురుపల్లి"] },

    // Visakhapatnam
    { mandalTelugu: "గాజువాక", districtTelugu: "విశాఖపట్నం", keywords: ["gajuwaka", "గాజువాక", "aganampudi", "వడ్లపూడి", "vadlapudi"] },
    { mandalTelugu: "భీమునిపట్నం", districtTelugu: "విశాఖపట్నం", keywords: ["bheemunipatnam", "bheemili", "భీమిలి"] },
    { mandalTelugu: "విశాఖపట్నం అర్బన్", districtTelugu: "విశాఖపట్నం", keywords: ["visakhapatnam", "vizag", "విశాఖపట్నం"] }
];

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
