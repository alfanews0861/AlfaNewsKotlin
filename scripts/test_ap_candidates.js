const fs = require('fs');

const candidates = [
    // నంద్యాల
    { handle: 'SilpaRaviReddy', name: 'శిల్పా రవిచంద్ర కిషోర్ రెడ్డి', title: 'మాజీ ఎమ్మెల్యే నంద్యాల', district: 'నంద్యాల' },
    { handle: 'SilpaRavi_YSRCP', name: 'శిల్పా రవి', title: 'నంద్యాల', district: 'నంద్యాల' },
    { handle: 'FarooqTDP', name: 'ఎన్.ఎం.డి. ఫరూక్', title: 'చట్ట & మైనారిటీ సంక్షేమ శాఖ మంత్రి, నంద్యాల ఎమ్మెల్యే', district: 'నంద్యాల' },
    { handle: 'NMDFAROOQ', name: 'ఎన్.ఎం.డి. ఫరూక్', title: 'మంత్రి', district: 'నంద్యాల' },
    { handle: 'NMD_Farooq', name: 'ఎన్.ఎం.డి. ఫరూక్', title: 'మంత్రి', district: 'నంద్యాల' },
    { handle: 'CollectorNdyl', name: 'కలెక్టర్ నంద్యాల', title: 'Collector Nandyal', district: 'నంద్యాల', isOfficial: true },
    { handle: 'collectornandyal', name: 'కలెక్టర్ నంద్యాల', title: 'Collector Nandyal', district: 'నంద్యాల', isOfficial: true },
    { handle: 'dm_nandyal', name: 'కలెక్టర్ నంద్యాల', title: 'Collector Nandyal', district: 'నంద్యాల', isOfficial: true },
    { handle: 'Collector_NDL', name: 'కలెక్టర్ నంద్యాల', title: 'Collector Nandyal', district: 'నంద్యాల', isOfficial: true },
    { handle: 'BhumaAkhilaTDP', name: 'భూమా అఖిల ప్రియ', title: 'ఆళ్లగడ్డ ఎమ్మెల్యే', district: 'నంద్యాల' },
    { handle: 'AkhilaBhuma', name: 'భూమా అఖిల ప్రియ', title: 'ఆళ్లగడ్డ ఎమ్మెల్యే', district: 'నంద్యాల' },
    { handle: 'Bhuma_Akhila', name: 'భూమా అఖిల ప్రియ', title: 'ఆళ్లగడ్డ ఎమ్మెల్యే', district: 'నంద్యాల' },
    { handle: 'ByreddyOfficial', name: 'బైరెడ్డి సిద్ధార్థ్ రెడ్డి', title: 'వైఎస్సార్‌సీపీ యువజన విభాగం అధ్యక్షుడు, నందికొట్కూరు', district: 'నంద్యాల' },
    { handle: 'ByreddySiddarth', name: 'బైరెడ్డి సిద్ధార్థ్ రెడ్డి', title: 'వైఎస్సార్‌సీపీ నందికొట్కూరు', district: 'నంద్యాల' },
    { handle: 'byreddy_siddard', name: 'బైరెడ్డి సిద్ధార్థ్ రెడ్డి', title: 'నందికొట్కూరు', district: 'నంద్యాల' },

    // పశ్చిమ గోదావరి
    { handle: 'RamanaiduTDP', name: 'నిమ్మల రామానాయుడు', title: 'జలవనరుల శాఖ మంత్రి, పాలకొల్లు ఎమ్మెల్యే', district: 'పశ్చిమ గోదావరి' },
    { handle: 'collector_wg', name: 'కలెక్టర్ పశ్చిమ గోదావరి', title: 'Collector West Godavari', district: 'పశ్చిమ గోదావరి', isOfficial: true },
    { handle: 'collectorwg', name: 'కలెక్టర్ పశ్చిమ గోదావరి', title: 'Collector West Godavari', district: 'పశ్చిమ గోదావరి', isOfficial: true },
    { handle: 'Collector_WG', name: 'కలెక్టర్ పశ్చిమ గోదావరి', title: 'Collector West Godavari', district: 'పశ్చిమ గోదావరి', isOfficial: true },
    { handle: 'CollectorWGDist', name: 'కలెక్టర్ పశ్చిమ గోదావరి', title: 'Collector West Godavari', district: 'పశ్చిమ గోదావరి', isOfficial: true },
    { handle: 'Raghurama_raju', name: 'రఘురామ కృష్ణంరాజు', title: 'డిప్యూటీ స్పీకర్, ఉండి ఎమ్మెల్యే', district: 'పశ్చిమ గోదావరి' },
    { handle: 'RaghuRaju_RRR', name: 'రఘురామ కృష్ణంరాజు', title: 'డిప్యూటీ స్పీకర్', district: 'పశ్చిమ గోదావరి' },
    { handle: 'RRR_MP', name: 'రఘురామ కృష్ణంరాజు', title: 'డిప్యూటీ స్పీకర్', district: 'పశ్చిమ గోదావరి' },
    { handle: 'KanumuruRRR', name: 'రఘురామ కృష్ణంరాజు', title: 'డిప్యూటీ స్పీకర్', district: 'పశ్చిమ గోదావరి' },
    { handle: 'GrandhiSrinivas', name: 'గ్రంధి శ్రీనివాస్', title: 'మాజీ ఎమ్మెల్యే భీమవరం', district: 'పశ్చిమ గోదావరి' },
    { handle: 'Grandhi_YSRCP', name: 'గ్రంధి శ్రీనివాస్', title: 'భీమవరం', district: 'పశ్చిమ గోదావరి' },

    // కోనసీమ
    { handle: 'collector_knsm', name: 'కలెక్టర్ కోనసీమ', title: 'Collector Konaseema', district: 'కోనసీమ', isOfficial: true },
    { handle: 'collectorknsm', name: 'కలెక్టర్ కోనసీమ', title: 'Collector Konaseema', district: 'కోనసీమ', isOfficial: true },
    { handle: 'CollectorKNSM', name: 'కలెక్టర్ కోనసీమ', title: 'Collector Konaseema', district: 'కోనసీమ', isOfficial: true },
    { handle: 'konaseemapolice', name: 'కోనసీమ పోలీస్', title: 'Konaseema Police', district: 'కోనసీమ', isOfficial: true },
    { handle: 'sp_konaseema', name: 'కోనసీమ ఎస్పీ', title: 'SP Konaseema', district: 'కోనసీమ', isOfficial: true },
    { handle: 'KonaseemaPolice', name: 'కోనసీమ పోలీస్', title: 'Konaseema Police', district: 'కోనసీమ', isOfficial: true },
    { handle: 'HarishBalayogi', name: 'గంటి హరీష్ మాధుర్ (బాలయోగి)', title: 'అమలాపురం ఎంపీ', district: 'కోనసీమ' },
    { handle: 'Harish_Balayogi', name: 'గంటి హరీష్ మాధుర్', title: 'అమలాపురం ఎంపీ', district: 'కోనసీమ' },
    { handle: 'GMC_Balayogi', name: 'బాలయోగి', title: 'అమలాపురం', district: 'కోనసీమ' },
    { handle: 'PinipeViswarup', name: 'పినిపే విశ్వరూప్', title: 'మాజీ మంత్రి, అమలాపురం', district: 'కోనసీమ' },
    { handle: 'ViswaroopPinipe', name: 'పినిపే విశ్వరూప్', title: 'మాజీ మంత్రి', district: 'కోనసీమ' },
    { handle: 'Gollapalli_TDP', name: 'గొల్లపల్లి సూర్యారావు', title: 'మాజీ మంత్రి, రాజోలు', district: 'కోనసీమ' },
    { handle: 'Rapaka_YSRCP', name: 'రాపాక వరప్రసాద్', title: 'మాజీ ఎమ్మెల్యే రాజోలు', district: 'కోనసీమ' },

    // ప్రకాశం
    { handle: 'reddymagunta5', name: 'మాగుంట శ్రీనివాసులు రెడ్డి', title: 'ఒంగోలు ఎంపీ', district: 'ప్రకాశం' },
    { handle: 'MaguntaRaghava', name: 'మాగుంట రాఘవ రెడ్డి', title: 'ఒంగోలు నాయకుడు', district: 'ప్రకాశం' },
    { handle: 'CollectorPKSM', name: 'కలెక్టర్ ప్రకాశం', title: 'Collector Prakasam', district: 'ప్రకాశం', isOfficial: true },
    { handle: 'collectorpksm', name: 'కలెక్టర్ ప్రకాశం', title: 'Collector Prakasam', district: 'ప్రకాశం', isOfficial: true },
    { handle: 'collector_pksm', name: 'కలెక్టర్ ప్రకాశం', title: 'Collector Prakasam', district: 'ప్రకాశం', isOfficial: true },
    { handle: 'collectorongole', name: 'కలెక్టర్ ప్రకాశం', title: 'Collector Prakasam', district: 'ప్రకాశం', isOfficial: true },
    { handle: 'Balineni_YSRCP', name: 'బాలినేని శ్రీనివాసరెడ్డి', title: 'మాజీ మంత్రి, ఒంగోలు', district: 'ప్రకాశం' },
    { handle: 'BalineniVasu', name: 'బాలినేని శ్రీనివాసరెడ్డి', title: 'ఒంగోలు', district: 'ప్రకాశం' },
    { handle: 'Damacharla_Jana', name: 'దామచర్ల జనార్దన్ రావు', title: 'ఒంగోలు ఎమ్మెల్యే', district: 'ప్రకాశం' },
    { handle: 'DamacharlaJana', name: 'దామచర్ల జనార్దన్ రావు', title: 'ఒంగోలు ఎమ్మెల్యే', district: 'ప్రకాశం' },
    { handle: 'JanaDamacharla', name: 'దామచర్ల జనార్దన్ రావు', title: 'ఒంగోలు ఎమ్మెల్యే', district: 'ప్రకాశం' },

    // శ్రీ సత్యసాయి
    { handle: 'IParitalaSriram', name: 'పరిటాల శ్రీరామ్', title: 'ధర్మవరం టీడీపీ సమన్వయకర్త', district: 'శ్రీ సత్యసాయి' },
    { handle: 'ParitalaSunitha', name: 'పరిటాల సునీత', title: 'రాప్తాడు ఎమ్మెల్యే, మాజీ మంత్రి', district: 'శ్రీ సత్యసాయి' },
    { handle: 'Paritala_Sunita', name: 'పరిటాల సునీత', title: 'రాప్తాడు ఎమ్మెల్యే', district: 'శ్రీ సత్యసాయి' },
    { handle: 'ParitalaSunith5', name: 'పరిటాల సునీత', title: 'రాప్తాడు ఎమ్మెల్యే', district: 'శ్రీ సత్యసాయి' },
    { handle: 'BKParthasarathi', name: 'బి.కె. పార్థసారథి', title: 'హిందూపురం ఎంపీ', district: 'శ్రీ సత్యసాయి' },
    { handle: 'BK_Partha', name: 'బి.కె. పార్థసారథి', title: 'హిందూపురం ఎంపీ', district: 'శ్రీ సత్యసాయి' },
    { handle: 'Gorantla_Madhav', name: 'గోరంట్ల మాధవ్', title: 'మాజీ ఎంపీ హిందూపురం', district: 'శ్రీ సత్యసాయి' },
    { handle: 'MadhavGorantla', name: 'గోరంట్ల మాధవ్', title: 'మాజీ ఎంపీ హిందూపురం', district: 'శ్రీ సత్యసాయి' },

    // తిరుపతి
    { handle: 'Chevireddy_BR', name: 'చెవిరెడ్డి భాస్కర్ రెడ్డి', title: 'మాజీ ఎమ్మెల్యే చంద్రగిరి', district: 'తిరుపతి' },
    { handle: 'ChevireddyB', name: 'చెవిరెడ్డి భాస్కర్ రెడ్డి', title: 'మాజీ ఎమ్మెల్యే చంద్రగిరి', district: 'తిరుపతి' },
    { handle: 'chevireddy_ysr', name: 'చెవిరెడ్డి భాస్కర్ రెడ్డి', title: 'చంద్రగిరి', district: 'తిరుపతి' },
    { handle: 'ChevireddyMohit', name: 'చెవిరెడ్డి మోహిత్ రెడ్డి', title: 'చంద్రగిరి సమన్వయకర్త', district: 'తిరుపతి' },
    { handle: 'Bhumana_Official', name: 'భూమన కరుణాకర్ రెడ్డి', title: 'మాజీ టీటీడీ ఛైర్మన్, తిరుపతి', district: 'తిరుపతి' },
    { handle: 'BhumanaKReddy', name: 'భూమన కరుణాకర్ రెడ్డి', title: 'తిరుపతి', district: 'తిరుపతి' },
    { handle: 'BhumanaAbhinay', name: 'భూమన అభినయ్ రెడ్డి', title: 'తిరుపతి డిప్యూటీ మేయర్', district: 'తిరుపతి' },
    { handle: 'AraniSrinivas', name: 'ఆరణి శ్రీనివాసులు', title: 'తిరుపతి ఎమ్మెల్యే', district: 'తిరుపతి' },
    { handle: 'DrGurumoorthy', name: 'మద్దిల గురుమూర్తి', title: 'తిరుపతి ఎంపీ', district: 'తిరుపతి' },
    { handle: 'GurumoorthyMP', name: 'మద్దిల గురుమూర్తి', title: 'తిరుపతి ఎంపీ', district: 'తిరుపతి' },
    { handle: 'Dr_Gurumoorthy', name: 'మద్దిల గురుమూర్తి', title: 'తిరుపతి ఎంపీ', district: 'తిరుపతి' },

    // అనంతపురం
    { handle: 'AnanthaVenkat', name: 'అనంత వెంకటరామిరెడ్డి', title: 'మాజీ ఎమ్మెల్యే అనంతపురం అర్బన్', district: 'అనంతపురం' },
    { handle: 'Anantha_MLA', name: 'అనంత వెంకటరామిరెడ్డి', title: 'అనంతపురం అర్బన్', district: 'అనంతపురం' },
    { handle: 'AmbicaLakshmiN', name: 'అంబికా లక్ష్మీనారాయణ', title: 'అనంతపురం ఎంపీ', district: 'అనంతపురం' },
    { handle: 'Ambica_MP', name: 'అంబికా లక్ష్మీనారాయణ', title: 'అనంతపురం ఎంపీ', district: 'అనంతపురం' },
    { handle: 'TalariRangaiah', name: 'తలారి రంగయ్య', title: 'మాజీ ఎంపీ అనంతపురం', district: 'అనంతపురం' },
    { handle: 'JC_AsmitReddy', name: 'జె.సి. అస్మిత్ రెడ్డి', title: 'తాడిపత్రి ఎమ్మెల్యే', district: 'అనంతపురం' },
    { handle: 'JC_PrabhakarR', name: 'జె.సి. ప్రభాకర్ రెడ్డి', title: 'తాడిపత్రి మున్సిపల్ చైర్మన్', district: 'అనంతపురం' },
    { handle: 'JCPrabhakarRdy', name: 'జె.సి. ప్రభాకర్ రెడ్డి', title: 'తాడిపత్రి', district: 'అనంతపురం' },
    { handle: 'collector_atp', name: 'కలెక్టర్ అనంతపురం', title: 'Collector Anantapur', district: 'అనంతపురం', isOfficial: true },
    { handle: 'Collector_ATP', name: 'కలెక్టర్ అనంతపురం', title: 'Collector Anantapur', district: 'అనంతపురం', isOfficial: true },
    { handle: 'AnantapurPolice', name: 'అనంతపురం పోలీస్', title: 'Anantapur Police', district: 'అనంతపురం', isOfficial: true },

    // కాకినాడ
    { handle: 'udaysrinivas_t', name: 'తంగెళ్ల ఉదయ్ శ్రీనివాస్', title: 'కాకినాడ ఎంపీ', district: 'కాకినాడ' },
    { handle: 'UdaySrinivasJSP', name: 'తంగెళ్ల ఉదయ్ శ్రీనివాస్', title: 'కాకినాడ ఎంపీ', district: 'కాకినాడ' },
    { handle: 'Uday_TeaTime', name: 'తంగెళ్ల ఉదయ్ శ్రీనివాస్', title: 'కాకినాడ ఎంపీ', district: 'కాకినాడ' },
    { handle: 'KondababuTDP', name: 'వనమాడి వెంకటేశ్వరరావు (కొండబాబు)', title: 'కాకినాడ సిటీ ఎమ్మెల్యే', district: 'కాకినాడ' },
    { handle: 'Vanamadi_Konda', name: 'వనమాడి కొండబాబు', title: 'కాకినాడ సిటీ ఎమ్మెల్యే', district: 'కాకినాడ' },
    { handle: 'DwarampudiCh', name: 'ద్వారంపూడి చంద్రశేఖర్ రెడ్డి', title: 'మాజీ ఎమ్మెల్యే కాకినాడ సిటీ', district: 'కాకినాడ' },
    { handle: 'Dwarampudi_YSR', name: 'ద్వారంపూడి చంద్రశేఖర్ రెడ్డి', title: 'కాకినాడ సిటీ', district: 'కాకినాడ' },
    { handle: 'JyothulaNehru', name: 'జ్యోతుల నెహ్రూ', title: 'జగ్గంపేట ఎమ్మెల్యే', district: 'కాకినాడ' },
    { handle: 'Jyothula_Nehru', name: 'జ్యోతుల నెహ్రూ', title: 'జగ్గంపేట ఎమ్మెల్యే', district: 'కాకినాడ' },
    { handle: 'Collector_KKD', name: 'కలెక్టర్ కాకినాడ', title: 'Collector Kakinada', district: 'కాకినాడ', isOfficial: true },
    { handle: 'collectorkkd', name: 'కలెక్టర్ కాకినాడ', title: 'Collector Kakinada', district: 'కాకినాడ', isOfficial: true },
    { handle: 'kakinada_police', name: 'కాకినాడ పోలీస్', title: 'Kakinada Police', district: 'కాకినాడ', isOfficial: true },

    // అన్నమయ్య
    { handle: 'Peddireddy_YSR', name: 'పెద్దిరెడ్డి రామచంద్రారెడ్డి', title: 'పుంగనూరు ఎమ్మెల్యే, మాజీ మంత్రి', district: 'అన్నమయ్య' },
    { handle: 'PeddireddyRCR', name: 'పెద్దిరెడ్డి రామచంద్రారెడ్డి', title: 'పుంగనూరు ఎమ్మెల్యే', district: 'అన్నమయ్య' },
    { handle: 'MidhunReddyYS', name: 'పెద్దిరెడ్డి మిథున్ రెడ్డి', title: 'రాజంపేట ఎంపీ', district: 'అన్నమయ్య' },
    { handle: 'MidhunReddyMP', name: 'పెద్దిరెడ్డి మిథున్ రెడ్డి', title: 'రాజంపేట ఎంపీ', district: 'అన్నమయ్య' },
    { handle: 'midhunreddy_ysr', name: 'పెద్దిరెడ్డి మిథున్ రెడ్డి', title: 'రాజంపేట ఎంపీ', district: 'అన్నమయ్య' },
    { handle: 'AmarnathAkepati', name: 'ఆకేపాటి అమరనాథ్ రెడ్డి', title: 'రాజంపేట ఎమ్మెల్యే', district: 'అన్నమయ్య' },
    { handle: 'Akepati_MLA', name: 'ఆకేపాటి అమరనాథ్ రెడ్డి', title: 'రాజంపేట ఎమ్మెల్యే', district: 'అన్నమయ్య' },

    // కర్నూలు
    { handle: 'TGBharathTDP', name: 'టి.జి. భరత్', title: 'పరిశ్రమల శాఖ మంత్రి, కర్నూలు ఎమ్మెల్యే', district: 'కర్నూలు' },
    { handle: 'TG_Bharath', name: 'టి.జి. భరత్', title: 'మంత్రి, కర్నూలు ఎమ్మెల్యే', district: 'కర్నూలు' },
    { handle: 'TGBharathMLA', name: 'టి.జి. భరత్', title: 'మంత్రి', district: 'కర్నూలు' },
    { handle: 'BastipatiNagarj', name: 'బస్తిపాటి నాగరాజు', title: 'కర్నూలు ఎంపీ', district: 'కర్నూలు' },
    { handle: 'Bastipati_MP', name: 'బస్తిపాటి నాగరాజు', title: 'కర్నూలు ఎంపీ', district: 'కర్నూలు' },
    { handle: 'KotlaSuryaTDP', name: 'కోట్ల జయసూర్య ప్రకాశరెడ్డి', title: 'డోన్ ఎమ్మెల్యే, మాజీ కేంద్ర మంత్రి', district: 'కర్నూలు' },
    { handle: 'KotlaSuryaReddy', name: 'కోట్ల జయసూర్య ప్రకాశరెడ్డి', title: 'డోన్ ఎమ్మెల్యే', district: 'కర్నూలు' },
    { handle: 'BugganaOfficial', name: 'బుగ్గన రాజేంద్రనాథ్ రెడ్డి', title: 'మాజీ ఆర్థిక మంత్రి, డోన్', district: 'కర్నూలు' },
    { handle: 'BugganaRajendra', name: 'బుగ్గన రాజేంద్రనాథ్ రెడ్డి', title: 'మాజీ మంత్రి', district: 'కర్నూలు' },
    { handle: 'BugganaRReddy', name: 'బుగ్గన రాజేంద్రనాథ్ రెడ్డి', title: 'మాజీ మంత్రి', district: 'కర్నూలు' },
    { handle: 'HafeezKhan_MLA', name: 'హాఫీజ్ ఖాన్', title: 'మాజీ ఎమ్మెల్యే కర్నూలు', district: 'కర్నూలు' },
    { handle: 'HafeezKhanYSRCP', name: 'హాఫీజ్ ఖాన్', title: 'కర్నూలు', district: 'కర్నూలు' },

    // ఏలూరు
    { handle: 'PuttaMaheshMP', name: 'పుట్టా మహేష్ కుమార్', title: 'ఏలూరు ఎంపీ', district: 'ఏలూరు' },
    { handle: 'Putta_Mahesh', name: 'పుట్టా మహేష్ కుమార్', title: 'ఏలూరు ఎంపీ', district: 'ఏలూరు' },
    { handle: 'Chintamaneni_P', name: 'చింతమనేని ప్రభాకర్', title: 'దెందులూరు ఎమ్మెల్యే', district: 'ఏలూరు' },
    { handle: 'ChintamaneniTDP', name: 'చింతమనేని ప్రభాకర్', title: 'దెందులూరు ఎమ్మెల్యే', district: 'ఏలూరు' },
    { handle: 'Chintamaneni_CP', name: 'చింతమనేని ప్రభాకర్', title: 'దెందులూరు', district: 'ఏలూరు' },
    { handle: 'AllaNani_YSRCP', name: 'ఆళ్ల నాని', title: 'మాజీ ఉప ముఖ్యమంత్రి, ఏలూరు', district: 'ఏలూరు' },
    { handle: 'AllaNaniOfficial', name: 'ఆళ్ల నాని', title: 'మాజీ మంత్రి', district: 'ఏలూరు' },
    { handle: 'KarumuriNageshw', name: 'కారుమూరి వెంకట నాగేశ్వరరావు', title: 'మాజీ మంత్రి, తణుకు', district: 'ఏలూరు' },
    { handle: 'Karumuri_YSRCP', name: 'కారుమూరి నాగేశ్వరరావు', title: 'మాజీ మంత్రి', district: 'ఏలూరు' },

    // కృష్ణా
    { handle: 'KolluROfficial', name: 'కొల్లు రవీంద్ర', title: 'గనుల శాఖ మంత్రి, మచిలీపట్నం ఎమ్మెల్యే', district: 'కృష్ణా' },
    { handle: 'VallabhaneniVam', name: 'వల్లభనేని వంశీ మోహన్', title: 'మాజీ ఎమ్మెల్యే గన్నవరం', district: 'కృష్ణా' },
    { handle: 'Vamshi_Gannavrm', name: 'వల్లభనేని వంశీ మోహన్', title: 'గన్నవరం', district: 'కృష్ణా' },
    { handle: 'PerniNani_YSRCP', name: 'పేర్ని నాని (వెంకట్రామయ్య)', title: 'మాజీ మంత్రి, మచిలీపట్నం', district: 'కృష్ణా' },
    { handle: 'PerniNaniOffl', name: 'పేర్ని నాని', title: 'మాజీ మంత్రి', district: 'కృష్ణా' },
    { handle: 'perninani', name: 'పేర్ని నాని', title: 'మాజీ మంత్రి', district: 'కృష్ణా' },
    { handle: 'KodaliNaniOffl', name: 'కొడాలి నాని (శ్రీ వెంకటేశ్వరరావు)', title: 'మాజీ మంత్రి, గుడివాడ', district: 'కృష్ణా' },
    { handle: 'KodaliNaniYSRCP', name: 'కొడాలి నాని', title: 'మాజీ మంత్రి', district: 'కృష్ణా' },
    { handle: 'kodali_nani', name: 'కొడాలి నాని', title: 'మాజీ మంత్రి', district: 'కృష్ణా' },
    { handle: 'BalashowryMP', name: 'వల్లభనేని బాలశౌరి', title: 'మచిలీపట్నం ఎంపీ', district: 'కృష్ణా' },
    { handle: 'BalashowryV', name: 'వల్లభనేని బాలశౌరి', title: 'మచిలీపట్నం ఎంపీ', district: 'కృష్ణా' },

    // పల్నాడు
    { handle: 'vidadalarajini', name: 'విడదల రజిని', title: 'మాజీ వైద్య ఆరోగ్య శాఖ మంత్రి, చిలకలూరిపేట', district: 'పల్నాడు' },
    { handle: 'Gopireddy_NSP', name: 'డాక్టర్ గోపిరెడ్డి శ్రీనివాసరెడ్డి', title: 'మాజీ ఎమ్మెల్యే నరసరావుపేట', district: 'పల్నాడు' },
    { handle: 'DrGopireddyNrt', name: 'డాక్టర్ గోపిరెడ్డి శ్రీనివాసరెడ్డి', title: 'నరసరావుపేట', district: 'పల్నాడు' },
    { handle: 'Chadalavada_TDP', name: 'చదలవాడ అరవింద బాబు', title: 'నరసరావుపేట ఎమ్మెల్యే', district: 'పల్నాడు' },
    { handle: 'BrahmanandaTDP', name: 'యరపతినేని శ్రీనివాసరావు', title: 'గురజాల ఎమ్మెల్యే', district: 'పల్నాడు' },
    { handle: 'Yerapatineni_S', name: 'యరపతినేని శ్రీనివాసరావు', title: 'గురజాల ఎమ్మెల్యే', district: 'పల్నాడు' },

    // విశాఖపట్నం / అనకాపల్లి / విజయనగరం / పార్వతీపురం
    { handle: 'AvanthiSrinivas', name: 'ముత్తంశెట్టి శ్రీనివాసరావు (అవంతి శ్రీనివాస్)', title: 'మాజీ మంత్రి, భీమిలి', district: 'విశాఖపట్నం' },
    { handle: 'Pushpasreevani', name: 'పాముల పుష్ప శ్రీవాణి', title: 'మాజీ ఉప ముఖ్యమంత్రి, కురుపాం', district: 'పార్వతీపురం మన్యం' },
    { handle: 'Ramanaidu_TDP', name: 'గవిరెడ్డి రామానాయుడు', title: 'మాజీ ఎమ్మెల్యే మాడుగుల', district: 'అనకాపల్లి' },
    { handle: 'BudiMutyalaNaid', name: 'బూడి ముత్యాలనాయుడు', title: 'మాజీ ఉప ముఖ్యమంత్రి, మాడుగుల', district: 'అనకాపల్లి' },
    { handle: 'GudivadaAmarnath', name: 'గుడివాడ అమర్నాథ్', title: 'మాజీ పరిశ్రమల మంత్రి, అనకాపల్లి', district: 'అనకాపల్లి' }
];

async function testHandles() {
    console.log(`Testing ${candidates.length} candidate handles...\n`);
    const verified = [];

    for (let i = 0; i < candidates.length; i++) {
        const item = candidates[i];
        const handle = item.handle;
        try {
            const res = await fetch(`https://api.fxtwitter.com/${handle}`);
            if (res.status === 200) {
                const data = await res.json();
                if (data.code === 200 && data.user) {
                    const u = data.user;
                    console.log(`[${i+1}/${candidates.length}] ✅ FOUND @${handle}: ${u.name} (${u.statuses_count} tweets) -> ${item.district} | ${item.title}`);
                    verified.push({
                        handle: `@${u.screen_name}`,
                        sourceName: item.title ? `${u.name} - ${item.title}` : u.name,
                        twitterName: u.name,
                        tweets: u.statuses_count,
                        bio: (u.description || '').replace(/\n/g, ' ').substring(0, 100),
                        district: item.district,
                        category: item.isOfficial ? 'స్థానిక' : 'రాజకీయం',
                        isOfficial: !!item.isOfficial
                    });
                    continue;
                }
            }
            console.log(`[${i+1}/${candidates.length}] ❌ NOT FOUND: @${handle}`);
        } catch (e) {
            console.log(`[${i+1}/${candidates.length}] ⚠️ ERROR: @${handle} - ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 200));
    }

    fs.writeFileSync('C:\\AlfaKotlin\\scripts\\ap_tested_results.json', JSON.stringify(verified, null, 2));
    console.log(`\n🎉 Found ${verified.length} verified accounts out of ${candidates.length}!`);
}

testHandles();
