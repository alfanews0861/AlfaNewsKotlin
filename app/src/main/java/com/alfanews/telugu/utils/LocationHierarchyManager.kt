package com.alfanews.telugu.utils

import com.alfanews.telugu.models.NewsPost
import java.util.Locale

/**
 * తెలంగాణ మరియు ఆంధ్రప్రదేశ్ జిల్లాల్లోని మండలాలు, నియోజకవర్గాలు (Assembly Constituencies) 
 * మరియు వార్తా పోస్టుల నుంచి మండలాలను గుర్తించడానికి ఉపయోగపడే హైరార్కీ మేనేజర్.
 */
object LocationHierarchyManager {

    /**
     * నియోజకవర్గం -> మండలాల మ్యాపింగ్ (తెలంగాణ & ఆంధ్రప్రదేశ్ ముఖ్య నియోజకవర్గాలు & మండలాలు)
     * జిల్లా -> (నియోజకవర్గం -> మండలాల జాబితా)
     */
    val CONSTITUENCY_MAP: Map<String, Map<String, List<String>>> = mapOf(
        // ==========================================
        // తెలంగాణ జిల్లాలు (TELANGANA DISTRICTS)
        // ==========================================
        "కరీంనగర్" to mapOf(
            "కరీంనగర్" to listOf("కరీంనగర్", "కరీంనగర్ రూరల్", "కొత్తపల్లి"),
            "చొప్పదండి" to listOf("చొప్పదండి", "గంగాధర", "రామడుగు"),
            "మానాకొండూరు" to listOf("మానాకొండూరు", "తిమ్మాపూర్", "గన్నేరువరం", "చిగురుమామిడి", "శంకరపట్నం", "సైదాపూర్", "ఇల్లందకుంట"),
            "హుజూరాబాద్" to listOf("హుజూరాబాద్", "జమ్మికుంట", "వీణవంక")
        ),
        "యాదాద్రి భువనగిరి" to mapOf(
            "భువనగిరి" to listOf("భువనగిరి", "బీబీనగర్", "భూదాన్ పోచంపల్లి", "వలిగొండ"),
            "ఆలేరు" to listOf("ఆలేరు", "యాదగిరిగుట్ట", "రాజాపేట", "తుర్కపల్లి", "మోటకొండూరు", "గుండాల", "అడ్డగూడూరు", "ఆత్మకూరు(ఎం)", "బొమ్మలరామారం"),
            "మునుగోడు" to listOf("చౌటుప్పల్", "సంస్థాన్ నారాయణపూర్"),
            "తుంగతుర్తి" to listOf("మోత్కూరు")
        ),
        "హన్మకొండ" to mapOf(
            "వరంగల్ పశ్చిమ" to listOf("హన్మకొండ", "కాజీపేట"),
            "వరంగల్ తూర్పు" to listOf("హన్మకొండ"),
            "వరంగల్ రూరల్" to listOf("ధర్మసాగర్", "వేలేర్", "ఐనవోలు", "హసన్పర్తి"),
            "పరకాల" to listOf("పరకాల", "శాయంపేట", "దామెర", "ఆత్మకూరు", "నడికూడ"),
            "హుస్నాబాద్" to listOf("భీమదేవరపల్లి", "ఎల్కతుర్తి", "కమలాపూర్")
        ),
        "వరంగల్" to mapOf(
            "వరంగల్ తూర్పు" to listOf("వరంగల్", "ఖిలా వరంగల్"),
            "వర్ధన్నపేట" to listOf("వర్ధన్నపేట", "గీసుకొండ", "సంగెం", "రాయపర్తి", "పర్వతగిరి"),
            "నర్సంపేట" to listOf("నర్సంపేట", "చెన్నారావుపేట", "నెక్కొండ", "ఖానాపూర్", "దుగ్గొండి", "నల్లబెల్లి")
        ),
        "పెద్దపల్లి" to mapOf(
            "పెద్దపల్లి" to listOf("పెద్దపల్లి", "సుల్తానాబాద్", "ఓదెల", "జూలపల్లి", "ఎలిగేడు", "కాల్వశ్రీరాంపూర్", "ధర్మారం"),
            "రామగుండం" to listOf("రామగుండం", "గోదావరిఖని", "అంతర్గాం", "పాలకుర్తి"),
            "మంథని" to listOf("మంథని", "కమాన్ పూర్", "రామగిరి", "ముత్తారం")
        ),
        "నాగర్ కర్నూల్" to mapOf(
            "నాగర్ కర్నూల్" to listOf("నాగర్ కర్నూల్", "బిజినేపల్లి", "తెల్కపల్లి", "తిమ్మాజిపేట", "తాడూరు"),
            "కల్వకుర్తి" to listOf("కల్వకుర్తి", "వెల్దండ", "చారకొండ", "ఊరుకొండ", "వంగూరు"),
            "అచ్చంపేట" to listOf("అచ్చంపేట", "బల్మూర్", "లింగాల", "ఉప్పునుంతల", "అమ్రాబాద్", "పదర"),
            "కొల్లాపూర్" to listOf("కొల్లాపూర్", "పెద్దకొత్తపల్లి", "కోడేరు", "పెంట్లవెల్లి")
        ),
        "ఖమ్మం" to mapOf(
            "ఖమ్మం" to listOf("ఖమ్మం అర్బన్", "ఖమ్మం రూరల్", "రఘునాథపాలెం"),
            "పాలేరు" to listOf("తిరుమలాయపాలెం", "కుసుమంచి", "నేలకొండపల్లి", "ముదిగొండ"),
            "మధిర" to listOf("మధిర", "బోనకల్", "చింతకాని", "ఎర్రుపాలెం"),
            "వైరా" to listOf("వైరా", "కొణిజర్ల", "ఏన్కూరు", "సింగరేణి", "కామేపల్లి"),
            "సత్తుపల్లి" to listOf("సత్తుపల్లి", "కల్లూరు", "పెనుబల్లి", "వేంసూరు", "తల్లాడ")
        ),
        "నల్గొండ" to mapOf(
            "నల్గొండ" to listOf("నల్గొండ", "తిప్పర్తి", "కనగల్", "మాడుగులపల్లి"),
            "మిర్యాలగూడ" to listOf("మిర్యాలగూడ", "వేములపల్లి", "దామరచర్ల", "అడవిదేవులపల్లి"),
            "దేవరకొండ" to listOf("దేవరకొండ", "గుండ్లపల్లి", "చందంపేట", "డిండి", "నేరెడిగొమ్ము", "పి.ఏ.పల్లి"),
            "నాగార్జునసాగర్" to listOf("నిడమనూరు", "త్రిపురారం", "అనుముల", "పెద్దవూర", "గుర్రంపోడ్", "తిరుమలగిరి సాగర్"),
            "నకిరేకల్" to listOf("నకిరేకల్", "కట్టంగూర్", "కేతేపల్లి", "శాలిగౌరారం", "చిట్యాల", "నార్కెట్‌పల్లి"),
            "మునుగోడు" to listOf("మునుగోడు", "చండూరు", "మర్రిగూడ", "నాంపల్లి", "చింతపల్లి", "గట్టుప్పల్")
        ),
        "సిద్దిపేట" to mapOf(
            "సిద్దిపేట" to listOf("సిద్దిపేట అర్బన్", "సిద్దిపేట రూరల్", "చిన్నకోడూరు", "నంగ్నూరు", "నారాయణరావుపేట"),
            "గజ్వేల్" to listOf("గజ్వేల్", "జగదేవ్ పూర్", "వర్గల్", "మర్కూక్", "కొండపాక", "కుకునూరుపల్లి", "రాయపోల్"),
            "దుబ్బాక" to listOf("దుబ్బాక", "మిర్దొడ్డి", "దౌల్తాబాద్", "తొగుట", "అక్బర్ పేట-భూంపల్లి"),
            "హుస్నాబాద్" to listOf("హుస్నాబాద్", "అక్కన్నపేట", "కోహెడ", "బెజ్జంకి")
        ),
        "సూర్యాపేట" to mapOf(
            "సూర్యాపేట" to listOf("సూర్యాపేట", "చివ్వెంల", "మోతే", "ఆత్మకూరు (ఎస్)", "పెన్ పహాడ్"),
            "కోదాడ" to listOf("కోదాడ", "మునగాల", "నడిగూడెం", "చిలుకూరు", "అనంతగిరి"),
            "హుజూర్ నగర్" to listOf("హుజూర్ నగర్", "మఠంపల్లి", "మేళ్లచెరువు", "గరిడేపల్లి", "నేరేడుచర్ల", "పాలకీడు", "చింతలపాలెం"),
            "తుంగతుర్తి" to listOf("తుంగతుర్తి", "నూతన్ కల్", "జాజిరెడ్డిగూడెం", "మద్దిరాల", "తిరుమలగిరి", "నగరం")
        ),
        "మంచిర్యాల" to mapOf(
            "మంచిర్యాల" to listOf("మంచిర్యాల", "హాజీపూర్", "నస్పూర్", "లక్సెట్టిపేట", "దండపల్లి", "జన్నారం"),
            "బెల్లంపల్లి" to listOf("బెల్లంపల్లి", "తాండూరు", "కాసిపేట", "నెన్నెల్", "వేమన్‌పల్లి", "భీమిని", "కన్నెపల్లి", "మందమర్రి"),
            "చెన్నూర్" to listOf("చెన్నూర్", "కోటపల్లి", "జైపూర్", "భీమారం")
        ),
        "నిర్మల్" to mapOf(
            "నిర్మల్" to listOf("నిర్మల్ అర్బన్", "నిర్మల్ రూరల్", "దిలావర్ పూర్", "సోన్", "లక్ష్మణచాంద", "మామడ", "సారంగాపూర్", "నర్సాపూర్ (జి)"),
            "ముధోల్" to listOf("ముధోల్", "తానూర్", "లోకేశ్వరం", "భైంసా", "కుబీర్", "బాసర"),
            "ఖానాపూర్" to listOf("ఖానాపూర్", "కుంటాల", "కడెం", "పెంబి", "దస్తురాబాద్")
        ),
        "జగిత్యాల" to mapOf(
            "జగిత్యాల" to listOf("జగిత్యాల", "జగిత్యాల రూరల్", "రాయికల్", "సారంగాపూర్", "బీర్పూర్"),
            "కోరుట్ల" to listOf("కోరుట్ల", "మెట్‌పల్లి", "మల్లాపూర్", "ఇబ్రహీంపట్నం", "మేడిపల్లి", "కత్లాపూర్"),
            "ధర్మపురి" to listOf("ధర్మపురి", "బుగ్గారం", "పెగడపల్లి", "గొల్లపల్లి", "మల్యాల", "కొడిమ్యాల", "వెల్గటూరు", "ఎండపల్లి", "భీమారం")
        ),
        "రాజన్న సిరిసిల్ల" to mapOf(
            "సిరిసిల్ల" to listOf("సిరిసిల్ల", "తంగళ్ళపల్లి", "గంభీరావుపేట", "ముస్తాబాద్", "ఎల్లారెడ్డిపేట", "వీర్నపల్లి"),
            "వేములవాడ" to listOf("వేములవాడ", "వేములవాడ రూరల్", "చందుర్తి", "కోనరావుపేట", "బోయిన్ పల్లి", "ఇల్లంతకుంట", "రుద్రంగి")
        ),
        "నిజామాబాద్" to mapOf(
            "నిజామాబాద్ అర్బన్" to listOf("నిజామాబాద్ సౌత్", "నిజామాబాద్ నార్త్"),
            "నిజామాబాద్ రూరల్" to listOf("నిజామాబాద్ రూరల్", "ముగ్పాల్", "డిచ్‌పల్లి", "ధర్పల్లి", "ఇందల్వాయి", "జక్రాన్‌పల్లి", "సిరికొండ"),
            "ఆర్మూర్" to listOf("ఆర్మూర్", "నందిపేట", "మాక్లూర్", "ఆలూరు", "డొంకేశ్వర్"),
            "బోధన్" to listOf("బోధన్", "ఎడపల్లి", "రంజల్", "నవీపేట", "సాలూర"),
            "బాల్కొండ" to listOf("బాల్కొండ", "మెండోరా", "ముప్కల్", "ఏర్గట్ల", "వేల్పూర్", "మోర్తాడ్", "కమ్మర్‌పల్లి", "భీమ్ గల్", "పోచంపాడు")
        ),
        "కామారెడ్డి" to mapOf(
            "కామారెడ్డి" to listOf("కామారెడ్డి", "భిక్నూర్", "దోమకొండ", "మాచారెడ్డి", "సదాశివనగర్", "రామారెడ్డి", "బీబీపేట", "రాజంపేట"),
            "ఎల్లారెడ్డి" to listOf("ఎల్లారెడ్డి", "నాగిరెడ్డిపేట", "లింగంపేట", "గాంధారి", "తాడ్వాయి"),
            "జుక్కల్" to listOf("జుక్కల్", "మద్నూర్", "బిచ్కుంద", "బీర్కూర్", "నస్రుల్లాబాద్", "పిట్లం", "నిజాంసాగర్", "పెద్ద కొడపగల్", "దొంగ్లి", "మహమ్మద్ నగర్"),
            "బాన్సువాడ" to listOf("బాన్సువాడ")
        ),
        "సంగారెడ్డి" to mapOf(
            "సంగారెడ్డి" to listOf("సంగారెడ్డి", "కంది", "కొండాపూర్", "సదాశివపేట"),
            "పటాన్ చెరు" to listOf("పటాన్ చెరు", "అమీన్ పూర్", "రామచంద్రాపురం", "జిన్నారం", "గుమ్మడిదల"),
            "జహీరాబాద్" to listOf("జహీరాబాద్", "కోహీర్", "న్యాల్కల్", "ఝరాసంగం", "మొగుడంపల్లి"),
            "ఆందోల్" to listOf("ఆందోల్", "పుల్కల్", "చౌటకూరు", "వట్ పల్లి", "మునిపల్లి", "రాయికోడ్", "టేక్మల్", "అల్లాదుర్గ్"),
            "నారాయణఖేడ్" to listOf("నారాయణఖేడ్", "కంగ్తి", "కల్హేర్", "సిర్గాపూర్", "మనూర్", "నాగల్‌గిద్ద")
        ),
        "మెదక్" to mapOf(
            "మెదక్" to listOf("మెదక్", "హవేలి ఘన్ పూర్", "పాపన్నపేట", "శంకరంపేట (ఆర్)", "రామాయంపేట", "నిజాంపేట", "ఎల్దుర్తి", "చేగుంట", "చిన్న శంకరంపేట", "నార్సింగి", "కుల్చారం", "మాసాయిపేట"),
            "నర్సాపూర్" to listOf("నర్సాపూర్", "శివంపేట", "కౌడిపల్లి", "చిలిపిచెడ్", "హత్నూర")
        ),
        "హైదరాబాద్" to mapOf(
            "చార్మినార్" to listOf("చార్మినార్", "బహదూర్‌పురా", "బండ్లగూడ"),
            "చాంద్రాయణగుట్ట" to listOf("చార్మినార్", "బండ్లగూడ"),
            "యాకుత్‌పురా" to listOf("సైదాబాద్", "మలక్ పేట"),
            "బహదూర్‌పురా" to listOf("బహదూర్‌పురా"),
            "కార్వాన్" to listOf("గోల్కొండ", "ఆసిఫ్ నగర్"),
            "గోషామహల్" to listOf("గోల్కొండ", "నాంపల్లి"),
            "నాంపల్లి" to listOf("నాంపల్లి", "ఆసిఫ్ నగర్"),
            "మలక్‌పేట" to listOf("మలక్ పేట", "సైదాబాద్"),
            "అంబర్‌పేట్" to listOf("అంబర్‌పేట్"),
            "ముషీరాబాద్" to listOf("ముషీరాబాద్"),
            "ఖైరతాబాద్" to listOf("ఖైరతాబాద్", "హిమాయత్ నగర్"),
            "జూబ్లీహిల్స్" to listOf("షేక్‌పేట్"),
            "సనత్‌నగర్" to listOf("అమీర్‌పేట్"),
            "సికింద్రాబాద్" to listOf("సికింద్రాబాద్", "మారేడుపల్లి"),
            "సికింద్రాబాద్ కంటోన్మెంట్" to listOf("తిరుమలగిరి", "మారేడుపల్లి")
        ),

        // ==========================================
        // ఆంధ్రప్రదేశ్ జిల్లాలు (ANDHRA PRADESH DISTRICTS)
        // ==========================================
        "కర్నూలు" to mapOf(
            "కర్నూలు" to listOf("కర్నూలు అర్బన్"),
            "పాణ్యం" to listOf("కర్నూలు రూరల్", "కల్లూరు", "ఓర్వకల్లు"),
            "కోడుమూరు" to listOf("కోడుమూరు", "గూడూరు", "సి.బెళగల్", "వెల్దుర్తి"),
            "ఎమ్మిగనూరు" to listOf("ఎమ్మిగనూరు", "గోనెగండ్ల", "నందవరం"),
            "ఆదోని" to listOf("ఆదోని"),
            "మంత్రాలయం" to listOf("మంత్రాలయం", "కౌతాలం", "కోసిగి", "పెద్ద కడబూరు"),
            "ఆలూరు" to listOf("ఆలూరు", "ఆస్పరి", "చిప్పగిరి", "హాలహర్వి", "హోళగుంద"),
            "పత్తికొండ" to listOf("పత్తికొండ", "మద్దికెర", "తుగ్గలి", "దేవనకొండ", "కృష్ణగిరి")
        ),
        "నంద్యాల" to mapOf(
            "నంద్యాల" to listOf("నంద్యాల", "నంద్యాల రూరల్", "గోస్పాడు"),
            "ఆళ్లగడ్డ" to listOf("ఆళ్లగడ్డ", "చాగలమర్రి", "రుద్రవరం", "శిరివెళ్ల", "దొర్నిపాడు", "ఉయ్యాలవాడ"),
            "బనగానపల్లె" to listOf("బనగానపల్లె", "అవుకు", "కోయిలకుంట్ల", "సంజామల", "కొలిమిగుండ్ల"),
            "డోన్" to listOf("డోన్", "బేతంచెర్ల", "ప్యాపిలి"),
            "పాణ్యం" to listOf("పాణ్యం", "మహానంది", "గడివేముల"),
            "నందికొట్కూరు" to listOf("నందికొట్కూరు", "పగిడ్యాల", "జూపాడు బంగ్లా", "కొత్తపల్లె", "పాములపాడు", "మిడ్తూరు"),
            "శ్రీశైలం" to listOf("శ్రీశైలం", "ఆత్మకూరు", "వెలుగోడు", "బండి ఆత్మకూరు")
        ),
        "విశాఖపట్నం" to mapOf(
            "విశాఖపట్నం తూర్పు" to listOf("విశాఖపట్నం అర్బన్", "సీతమ్మధార", "మహారాణిపేట"),
            "విశాఖపట్నం దక్షిణ" to listOf("విశాఖపట్నం అర్బన్", "మహారాణిపేట"),
            "విశాఖపట్నం ఉత్తర" to listOf("విశాఖపట్నం అర్బన్", "సీతమ్మధార"),
            "విశాఖపట్నం పశ్చిమ" to listOf("గోపాలపట్నం", "ములగాడ"),
            "గాజువాక" to listOf("గాజువాక", "పెదగంట్యాడ"),
            "భీమిలి" to listOf("భీమునిపట్నం", "ఆనందపురం", "పద్మనాభం"),
            "పెందుర్తి" to listOf("పెందుర్తి", "విశాఖపట్నం రూరల్")
        ),
        "విజయనగరం" to mapOf(
            "విజయనగరం" to listOf("విజయనగరం", "విజయనగరం రూరల్", "గంట్యాడ"),
            "నెల్లిమర్ల" to listOf("నెల్లిమర్ల", "పూసపాటిరేగ", "డెంకాడ", "భోగాపురం"),
            "చీపురుపల్లి" to listOf("చీపురుపల్లి", "గరివిడి", "గుర్ల", "మెరకముడిదం"),
            "గజపతినగరం" to listOf("గజపతినగరం", "బొండపల్లి", "మెంటాడ", "దత్తిరాజేరు"),
            "బొబ్బిలి" to listOf("బొబ్బిలి", "తెర్లాం", "బాడంగి", "రామభద్రపురం"),
            "శృంగవరపుకోట" to listOf("శృంగవరపుకోట", "వేపాడ", "లక్కవరపుకోట", "జామి", "కొత్తవలస"),
            "రాజాం" to listOf("రాజాం", "వంగర", "రేగిడి ఆమదాలవలస", "సంతకవిటి")
        ),
        "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు" to mapOf(
            "నెల్లూరు నగరం" to listOf("నెల్లూరు అర్బన్"),
            "నెల్లూరు రూరల్" to listOf("నెల్లూరు రూరల్", "ఇందుకూరుపేట", "తోటపల్లిగూడూరు"),
            "కోవూరు" to listOf("కోవూరు", "బుచ్చిరెడ్డిపాలెం", "కొడవలూరు", "విడవలూరు", "అల్లూరు"),
            "కావలి" to listOf("కావలి", "బోగోలు", "దగదర్తి", "జలదంకి"),
            "ఆత్మకూరు" to listOf("ఆత్మకూరు", "సంగం", "చేజర్ల", "మర్రిపాడు", "అనుమసముద్రంపేట", "ఏఎస్‌పేట"),
            "ఉదయగిరి" to listOf("ఉదయగిరి", "దుత్తలూరు", "వరికుంటపాడు", "సీతారామపురం", "కలిగిరి", "కొండాపురం", "వింజమూరు"),
            "సర్వేపల్లి" to listOf("ముత్తుకూరు", "వెంకటాచలం", "మనుబోలు", "పొదలకూరు", "సైదాపురం")
        ),
        "గుంటూరు" to mapOf(
            "గుంటూరు తూర్పు" to listOf("గుంటూరు తూర్పు"),
            "గుంటూరు పశ్చిమ" to listOf("గుంటూరు పశ్చిమ"),
            "ప్రత్తిపాడు" to listOf("ప్రత్తిపాడు", "పెదకాకాని", "వట్టిచెరుకూరు", "పెదనందిపాడు", "కాకుమాను"),
            "తాడికొండ" to listOf("తాడికొండ", "తుళ్లూరు", "అమరావతి", "మేడికొండూరు", "ఫిరంగిపురం"),
            "మంగళగిరి" to listOf("మంగళగిరి", "తాడేపల్లి", "దుగ్గిరాల"),
            "తెనాలి" to listOf("తెనాలి", "చేబ్రోలు", "కొల్లిపర")
        ),
        "కృష్ణా" to mapOf(
            "మచిలీపట్నం" to listOf("మచిలీపట్నం అర్బన్", "మచిలీపట్నం రూరల్"),
            "పెడన" to listOf("పెడన", "గుడ్లవల్లేరు", "గూడూరు", "బంటుమిల్లి", "కృత్తివెన్ను"),
            "అవనిగడ్డ" to listOf("అవనిగడ్డ", "చల్లపల్లి", "మోపిదేవి", "నాగాయలంక", "కోడూరు", "ఘంటసాల"),
            "పామర్రు" to listOf("పామర్రు", "మొవ్వ", "పామిడిముక్కల", "పెదపారుపూడి"),
            "పెనమలూరు" to listOf("పెనమలూరు", "తోట్లవల్లూరు", "ఉయ్యూరు", "కంకిపాడు"),
            "గన్నవరం" to listOf("గన్నవరం", "బాపులపాడు", "ఉంగుటూరు"),
            "గుడివాడ" to listOf("గుడివాడ", "నందివాడ")
        ),
        "ఎన్టీఆర్" to mapOf(
            "విజయవాడ సెంట్రల్" to listOf("విజయవాడ సెంట్రల్"),
            "విజయవాడ తూర్పు" to listOf("విజయవాడ ఈస్ట్"),
            "విజయవాడ పశ్చిమ" to listOf("విజయవాడ వెస్ట్"),
            "మైలవరం" to listOf("మైలవరం", "జి.కొండూరు", "ఇబ్రహీంపట్నం", "కొండపల్లి", "రెడ్డిగూడెం"),
            "నందిగామ" to listOf("నందిగామ", "కంచికచర్ల", "వీరుళ్లపాడు", "చందర్లపాడు"),
            "జగ్గయ్యపేట" to listOf("జగ్గయ్యపేట", "పెనుగంచిప్రోలు", "వత్సవాయి"),
            "తిరువూరు" to listOf("తిరువూరు", "ఏ.కొండూరు", "గంపలగూడెం", "విస్సన్నపేట")
        ),
        "వైఎస్ఆర్ కడప" to mapOf(
            "కడప" to listOf("కడప", "చింతకొమ్మదిన్నె"),
            "కమలాపురం" to listOf("కమలాపురం", "పెండ్లిమర్రి", "వల్లూరు", "చెన్నూరు", "వీరపునాయునిపల్లి"),
            "పులివెందుల" to listOf("పులివెందుల", "వేంపల్లి", "లింగాల", "తొండూరు", "చక్రాయపేట", "సింహాద్రిపురం", "వేముల"),
            "జమ్మలమడుగు" to listOf("జమ్మలమడుగు", "ముద్దనూరు", "కొండాపురం", "మైలవరం", "పెద్దముడియం", "యర్రగుంట్ల"),
            "ప్రొద్దుటూరు" to listOf("ప్రొద్దుటూరు", "రాజుపాలెం"),
            "మైదుకూరు" to listOf("మైదుకూరు", "దువ్వూరు", "చాపాడు", "ఖాజీపేట", "బ్రహ్మంగారిమఠం"),
            "బద్వేల్" to listOf("బద్వేల్", "గోపవరం", "బి.కోడూరు", "అట్లూరు", "పోరుమామిళ్ల", "కలసపాడు", "శ్రీ అవధూత కాశినాయన", "ఒంటిమిట్ట", "సిద్ధవటం")
        ),
        "అనంతపురం" to mapOf(
            "అనంతపురం అర్బన్" to listOf("అనంతపురం"),
            "అనంతపురం రూరల్" to listOf("అనంతపురం రూరల్", "బుక్కరాయసముద్రం", "రాప్తాడు", "గార్లదిన్నె", "ఆత్మకూరు", "కూడేరు"),
            "శింగనమల" to listOf("శింగనమల", "పుట్లూరు", "యల్లనూరు", "నార్పల", "పెద్దవడుగూరు"),
            "తాడిపత్రి" to listOf("తాడిపత్రి", "యాడికి", "పెద్దపప్పురు"),
            "గుంతకల్లు" to listOf("గుంతకల్లు", "గుత్తి", "పామిడి"),
            "ఉరవకొండ" to listOf("ఉరవకొండ", "వజ్రకరూరు", "విడపనకల్లు"),
            "కళ్యాణదుర్గం" to listOf("కళ్యాణదుర్గం", "బెలుగుప్ప", "కంబదూరు", "కుందుర్పి", "బ్రహ్మసముద్రం"),
            "రాయదుర్గం" to listOf("రాయదుర్గం", "డి.హిరేహాల్", "కనేకల్", "బొమ్మనహల్", "గుమ్మగట్ట")
        )
    )

    /**
     * ఇచ్చిన మండలం యొక్క నియోజకవర్గాన్ని (Constituency) రిటర్న్ చేస్తుంది.
     */
    fun getConstituencyForMandal(district: String?, mandal: String?): String? {
        if (district.isNullOrBlank() || mandal.isNullOrBlank()) return null
        
        val normalizedMandal = normalizePlaceName(mandal)
        
        // 1. జిల్లా నియోజకవర్గాల్లో వెతకడం
        val districtConstituencies = CONSTITUENCY_MAP[district]
            ?: CONSTITUENCY_MAP.entries.find { it.key.contains(district, ignoreCase = true) || district.contains(it.key, ignoreCase = true) }?.value

        if (districtConstituencies != null) {
            for ((constituency, mandals) in districtConstituencies) {
                if (mandals.any { normalizePlaceName(it) == normalizedMandal || it.contains(normalizedMandal) || normalizedMandal.contains(it) }) {
                    return constituency
                }
            }
        }

        // 2. ఒకవేళ ఏ జిల్లాలోనూ దొరకకపోతే అన్ని జిల్లాల్లో సెర్చ్ చేయడం
        for ((_, constMap) in CONSTITUENCY_MAP) {
            for ((constituency, mandals) in constMap) {
                if (mandals.any { normalizePlaceName(it) == normalizedMandal || it.contains(normalizedMandal) || normalizedMandal.contains(it) }) {
                    return constituency
                }
            }
        }

        // 3. Fallback: మండలం పేరునే నియోజకవర్గంగా భావించడం
        return mandal
    }

    /**
     * ఒక నియోజకవర్గంలో ఉన్న అన్ని మండలాల జాబితాను అందిస్తుంది.
     */
    fun getMandalsForConstituency(district: String?, constituency: String?): List<String> {
        if (district.isNullOrBlank() || constituency.isNullOrBlank()) return emptyList()

        val normalizedConst = normalizePlaceName(constituency)

        val districtConstituencies = CONSTITUENCY_MAP[district]
            ?: CONSTITUENCY_MAP.entries.find { it.key.contains(district, ignoreCase = true) || district.contains(it.key, ignoreCase = true) }?.value

        if (districtConstituencies != null) {
            val mandals = districtConstituencies[constituency]
                ?: districtConstituencies.entries.find { normalizePlaceName(it.key) == normalizedConst || it.key.contains(normalizedConst) }?.value
            if (mandals != null) return mandals
        }

        // Fallback: ఆ నియోజకవర్గం పేరుతో మండలం ఉంటే దాన్ని రిటర్న్ చేయడం
        return listOf(constituency)
    }

    /**
     * వార్తా పోస్ట్ నుండి మండలాన్ని గుర్తించి (Extract) రిటర్న్ చేస్తుంది.
     */
    fun extractMandalFromPost(post: NewsPost, district: String?): String? {
        val allDistrictMandals = district?.let { Constants.MANDAL_DATA[it] } ?: emptyList()

        // 1. post.location చెక్ చేయడం (రిపోర్టర్ ఎంచుకున్న మండలం)
        val loc = post.location.trim()
        if (loc.isNotBlank()) {
            val matchedInDistrict = allDistrictMandals.find { 
                normalizePlaceName(it) == normalizePlaceName(loc) || it.contains(loc) || loc.contains(it) 
            }
            if (matchedInDistrict != null) return matchedInDistrict

            // All districts mandal match
            val allDistMatch = findMatchingMandalAnywhere(loc)
            if (allDistMatch != null) return allDistMatch
        }

        // 2. post.entities.locations చెక్ చేయడం (AI గుర్తించిన లొకేషన్లు)
        for (entityLoc in post.entities.locations) {
            val matched = allDistrictMandals.find { 
                normalizePlaceName(it) == normalizePlaceName(entityLoc) || it.contains(entityLoc) || entityLoc.contains(it) 
            }
            if (matched != null) return matched
        }

        // 3. పోస్ట్ హెడ్‌లైన్ లో మండల పేరు ఉందో లేదో వెతకడం (Fast Substring Check)
        val headlineTe = post.headline.telugu
        if (headlineTe.isNotBlank() && allDistrictMandals.isNotEmpty()) {
            val headlineMatch = allDistrictMandals.find { mandal ->
                // కనీసం 3 అక్షరాలు ఉన్న మండల పేర్లను మాత్రమే హెడ్‌లైన్ లో చూస్తాం (తప్పుడు పాజిటివ్‌లు నివారించడానికి)
                mandal.length >= 3 && headlineTe.contains(mandal)
            }
            if (headlineMatch != null) return headlineMatch
        }

        // 4. Tags & Categories లో మండలాల వెతుకులాట
        for (tag in (post.tags + post.categories)) {
            val matched = allDistrictMandals.find { 
                normalizePlaceName(it) == normalizePlaceName(tag) || it.equals(tag, ignoreCase = true) 
            }
            if (matched != null) return matched
        }

        return loc.takeIf { it.isNotBlank() }
    }

    /**
     * GPS Geocoder నుండి వచ్చిన ఊరు/ప్రాంతం పేరును బట్టి జిల్లాలోని సరైన మండలాన్ని గుర్తిస్తుంది.
     */
    fun findMatchingMandal(district: String?, placeName: String?): String? {
        if (district.isNullOrBlank() || placeName.isNullOrBlank()) return null

        val districtMandals = Constants.MANDAL_DATA[district] ?: emptyList()
        val cleanPlace = normalizePlaceName(placeName)

        // 1. ఖచ్చితమైన సమానత్వం లేదా సబ్‌స్ట్రింగ్ చెక్
        val directMatch = districtMandals.find { mandal ->
            val cleanMandal = normalizePlaceName(mandal)
            cleanMandal == cleanPlace || cleanMandal.contains(cleanPlace) || cleanPlace.contains(cleanMandal)
        }
        if (directMatch != null) return directMatch

        // 2. ఇంగ్లీష్ మరియు తెలుగు కామన్ అలీయాసెస్ వెతకడం
        for (mandal in districtMandals) {
            val cleanMandal = normalizePlaceName(mandal)
            val keywords = getMandalKeywords(cleanMandal)
            if (keywords.any { cleanPlace.contains(it) || it.contains(cleanPlace) }) {
                return mandal
            }
        }

        return null
    }

    private fun findMatchingMandalAnywhere(placeName: String): String? {
        val cleanPlace = normalizePlaceName(placeName)
        for ((_, mandals) in Constants.MANDAL_DATA) {
            val match = mandals.find { 
                val cm = normalizePlaceName(it)
                cm == cleanPlace || cm.contains(cleanPlace) || cleanPlace.contains(cm) 
            }
            if (match != null) return match
        }
        return null
    }

    private fun normalizePlaceName(name: String): String {
        return name.trim()
            .replace("అర్బన్", "")
            .replace("రూరల్", "")
            .replace("Urban", "", ignoreCase = true)
            .replace("Rural", "", ignoreCase = true)
            .replace("Mandal", "", ignoreCase = true)
            .replace("మండలం", "")
            .trim()
            .lowercase(Locale.getDefault())
    }

    private fun getMandalKeywords(mandal: String): List<String> {
        return when {
            mandal.contains("కరీంనగర్") -> listOf("karimnagar", "కరీంనగర్")
            mandal.contains("హుజూరాబాద్") -> listOf("huzurabad", "హుజూరాబాద్")
            mandal.contains("జమ్మికుంట") -> listOf("jammikunta", "జమ్మికుంట")
            mandal.contains("మోత్కూరు") -> listOf("mothkur", "mothkuru", "మోత్కూరు", "మోత్కూర్")
            mandal.contains("భువనగిరి") -> listOf("bhuvanagiri", "bhongir", "భువనగిరి")
            mandal.contains("చౌటుప్పల్") -> listOf("choutuppal", "చౌటుప్పల్")
            mandal.contains("ఆలేరు") -> listOf("aler", "ఆలేరు")
            mandal.contains("యాదగిరిగుట్ట") -> listOf("yadagirigutta", "యాదగిరిగుట్ట")
            mandal.contains("గాజువాక") -> listOf("gajuwaka", "గాజువాక")
            mandal.contains("భీమిలి") || mandal.contains("భీమునిపట్నం") -> listOf("bheemili", "bheemunipatnam", "భీమిలి")
            mandal.contains("ఆదోని") -> listOf("adoni", "ఆదోని")
            mandal.contains("ఎమ్మిగనూరు") -> listOf("yemmiganur", "ఎమ్మిగనూరు")
            mandal.contains("మంథని") -> listOf("manthani", "మంథని")
            mandal.contains("గోదావరిఖని") || mandal.contains("రామగుండం") -> listOf("godavarikhani", "ramagundam", "గోదావరిఖని", "రామగుండం")
            mandal.contains("కల్వకుర్తి") -> listOf("kalwakurthy", "కల్వకుర్తి")
            mandal.contains("అచ్చంపేట") -> listOf("achampet", "అచ్చంపేట")
            mandal.contains("కొల్లాపూర్") -> listOf("kollapur", "కొల్లాపూర్")
            mandal.contains("నిర్మల్") -> listOf("nirmal", "నిర్మల్")
            mandal.contains("భైంసా") -> listOf("bhainsa", "భైంసా")
            mandal.contains("మంచిర్యాల") -> listOf("mancherial", "మంచిర్యాల")
            mandal.contains("బెల్లంపల్లి") -> listOf("bellampalli", "బెల్లంపల్లి")
            mandal.contains("కోవూరు") -> listOf("kovur", "కోవూరు")
            mandal.contains("కావలి") -> listOf("kavali", "కావలి")
            mandal.contains("బొబ్బిలి") -> listOf("bobbili", "బొబ్బిలి")
            mandal.contains("చీపురుపల్లి") -> listOf("cheepurupalli", "చీపురుపల్లి")
            else -> listOf(mandal)
        }
    }
}
