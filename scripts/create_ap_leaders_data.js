const fs = require('fs');
const path = require('path');

const leaders = [
    // ==========================================
    // 1. శ్రీకాకుళం (Srikakulam)
    // ==========================================
    { handle: "@katchannaidu", name: "కింజరాపు అచ్చెన్నాయుడు (Agriculture Minister, Tekkali MLA)", district: "శ్రీకాకుళం", party: "TDP" },
    { handle: "@RamMNK", name: "కింజరాపు రామ్మోహన్ నాయుడు (Union Civil Aviation Minister, Srikakulam MP)", district: "శ్రీకాకుళం", party: "TDP" },
    { handle: "@Ashokbendalam10", name: "బెందాళం అశోక్ (Itchapuram MLA)", district: "శ్రీకాకుళం", party: "TDP" },
    { handle: "@gouthusireesha", name: "గౌతు శిరీష (Palasa MLA)", district: "శ్రీకాకుళం", party: "TDP" },
    { handle: "@GondushankarTDP", name: "గోండు శంకర్ (Srikakulam MLA)", district: "శ్రీకాకుళం", party: "TDP" },
    { handle: "@KoonaRavi", name: "కూన రవికుమార్ (Amadalavalasa MLA)", district: "శ్రీకాకుళం", party: "TDP" },
    { handle: "@DharmanaDPR", name: "ధర్మాన ప్రసాద్ రావు (Ex-Minister, Srikakulam)", district: "శ్రీకాకుళం", party: "YSRCP" },
    { handle: "@DharamanaK", name: "ధర్మాన కృష్ణదాస్ (Ex-Dy CM, Narasannapeta)", district: "శ్రీకాకుళం", party: "YSRCP" },
    { handle: "@TammineniSpeaks", name: "తమ్మినేని సీతారాం (Ex-Speaker, Amadalavalasa)", district: "శ్రీకాకుళం", party: "YSRCP" },

    // ==========================================
    // 2. విజయనగరం (Vizianagaram)
    // ==========================================
    { handle: "@AditiGajapathi", name: "పూసపాటి అదితి గజపతిరాజు (Vizianagaram MLA)", district: "విజయనగరం", party: "TDP" },
    { handle: "@SKondapalliOffl", name: "కొండపల్లి శ్రీనివాస్ (MSME Minister, Gajapathinagaram MLA)", district: "విజయనగరం", party: "TDP" },
    { handle: "@LokamMadhavi", name: "లోకం నాగ మాధవి (Nellimarla MLA)", district: "విజయనగరం", party: "JSP" },
    { handle: "@KalaVenkatRaoK", name: "కిమిడి కళా వెంకటరావు (Cheepurupalli MLA)", district: "విజయనగరం", party: "TDP" },
    { handle: "@Lalitha_KumariK", name: "కోళ్ల లలిత కుమారి (Srungavarapukota MLA)", district: "విజయనగరం", party: "TDP" },
    { handle: "@Ashok_Gajapathi", name: "పూసపాటి అశోక్ గజపతిరాజు (Senior Leader)", district: "విజయనగరం", party: "TDP" },
    { handle: "@Appalanaidu_MLA", name: "కలిశెట్టి అప్పలనాయుడు (Vizianagaram MP)", district: "విజయనగరం", party: "TDP" },
    { handle: "@BotchaBSN", name: "బొత్స సత్యనారాయణ (MLC, Ex-Minister)", district: "విజయనగరం", party: "YSRCP" },
    { handle: "@BotchaJhansi", name: "బొత్స ఝాన్సీ లక్ష్మి (Ex-MP)", district: "విజయనగరం", party: "YSRCP" },
    { handle: "@Baddukonda_Appu", name: "బడ్డుకొండ అప్పలనాయుడు (Ex-MLA Nellimarla)", district: "విజయనగరం", party: "YSRCP" },

    // ==========================================
    // 3. పార్వతీపురం మన్యం (Parvathipuram Manyam)
    // ==========================================
    { handle: "@GSandhyarani_", name: "గుమ్మడి సంధ్యారాణి (Women & Child Welfare Minister, Salur MLA)", district: "పార్వతీపురం మన్యం", party: "TDP" },
    { handle: "@MLABonelaVijaya", name: "బోనెలా విజయ చంద్ర (Parvathipuram MLA)", district: "పార్వతీపురం మన్యం", party: "TDP" },
    { handle: "@jayakrishnajsp", name: "నిమ్మక జయకృష్ణ (Palakonda MLA)", district: "పార్వతీపురం మన్యం", party: "JSP" },
    { handle: "@JagadeeswariTDP", name: "తోయక జగదీశ్వరి (Kurupam MLA)", district: "పార్వతీపురం మన్యం", party: "TDP" },
    { handle: "@Pushpasreevani", name: "పాముల పుష్ప శ్రీవాణి (Ex-Dy CM, Kurupam)", district: "పార్వతీపురం మన్యం", party: "YSRCP" },
    { handle: "@RajannadoraP", name: "పీడిక రాజన్నదొర (Ex-Dy CM, Salur)", district: "పార్వతీపురం మన్యం", party: "YSRCP" },

    // ==========================================
    // 4. అల్లూరి సీతారామరాజు (Alluri Sitharama Raju)
    // ==========================================
    { handle: "@SireeshaDeviMLA", name: "మిరియాల శిరీషా దేవి (Rampachodavaram MLA)", district: "అల్లూరి సీతారామరాజు", party: "TDP" },
    { handle: "@GiddiEswari", name: "గిడ్డి ఈశ్వరి (Paderu)", district: "అల్లూరి సీతారామరాజు", party: "TDP" },
    { handle: "@DrTanujaRaniMP", name: "డాక్టర్ జి. తనుజా రాణి (Araku MP)", district: "అల్లూరి సీతారామరాజు", party: "YSRCP" },
    { handle: "@RajuMatsyarasa", name: "మత్స్యరాస విశ్వేశ్వరరాజు (Ex-MLA Paderu)", district: "అల్లూరి సీతారామరాజు", party: "YSRCP" },
    { handle: "@ChettiPalguna", name: "చెట్టి పాల్గుణ (Ex-MLA Araku)", district: "అల్లూరి సీతారామరాజు", party: "YSRCP" },
    { handle: "@DhanalakshmiMLA", name: "నాగులపల్లి ధనలక్ష్మి (Ex-MLA Rampachodavaram)", district: "అల్లూరి సీతారామరాజు", party: "YSRCP" },

    // ==========================================
    // 5. విశాఖపట్నం (Visakhapatnam)
    // ==========================================
    { handle: "@Ganta_Srinivasa", name: "గంటా శ్రీనివాసరావు (Bheemili MLA)", district: "విశాఖపట్నం", party: "TDP" },
    { handle: "@Velagapudi_TDP", name: "వెలగపూడి రామకృష్ణ బాబు (Visakhapatnam East MLA)", district: "విశాఖపట్నం", party: "TDP" },
    { handle: "@GanaBabu_P", name: "పి. గణబాబు (Visakhapatnam West MLA)", district: "విశాఖపట్నం", party: "TDP" },
    { handle: "@Vishnurajubjpap", name: "పి. విష్ణు కుమార్ రాజు (Visakhapatnam North MLA)", district: "విశాఖపట్నం", party: "BJP" },
    { handle: "@ChVamsiYadav", name: "వంశీకృష్ణ శ్రీనివాస్ యాదవ్ (Visakhapatnam South MLA)", district: "విశాఖపట్నం", party: "JSP" },
    { handle: "@sribharatm", name: "ఎం. శ్రీభరత్ (Visakhapatnam MP)", district: "విశాఖపట్నం", party: "TDP" },
    { handle: "@AvanthiSrinivas", name: "ముత్తంశెట్టి (అవంతి) శ్రీనివాస్ (Ex-Minister, Bheemili)", district: "విశాఖపట్నం", party: "YSRCP" },
    { handle: "@MVVSatyanarayn", name: "ఎం.వి.వి. సత్యనారాయణ (Ex-MP)", district: "విశాఖపట్నం", party: "YSRCP" },
    { handle: "@KKRajuOfficial", name: "కె.కె. రాజు (YSRCP Visakhapatnam North)", district: "విశాఖపట్నం", party: "YSRCP" },
    { handle: "@PallaSrinivasaR", name: "పల్లా శ్రీనివాసరావు (Gajuwaka MLA, TDP AP State President)", district: "విశాఖపట్నం", party: "TDP" },
    { handle: "@TippalaNagiR", name: "తిప్పల నాగిరెడ్డి (Ex-MLA Gajuwaka)", district: "విశాఖపట్నం", party: "YSRCP" },

    // ==========================================
    // 6. అనకాపల్లి (Anakapalli)
    // ==========================================
    { handle: "@AyyannaPatruduC", name: "చింతకాయల అయ్యన్నపాత్రుడు (AP Assembly Speaker, Narsipatnam MLA)", district: "అనకాపల్లి", party: "TDP" },
    { handle: "@Anitha_TDP", name: "వంగలపూడి అనిత (Home & Disaster Mgmt Minister, Payakaraopet MLA)", district: "అనకాపల్లి", party: "TDP" },
    { handle: "@Konathala_R", name: "కొణతాల రామకృష్ణ (Anakapalli MLA)", district: "అనకాపల్లి", party: "JSP" },
    { handle: "@BandaruSNM", name: "బండారు సత్యనారాయణ మూర్తి (Madugula MLA)", district: "అనకాపల్లి", party: "TDP" },
    { handle: "@vijaysundarapu", name: "సుందరపు విజయ్ కుమార్ (Elamanchili MLA)", district: "అనకాపల్లి", party: "JSP" },
    { handle: "@PRameshbabuMLA", name: "పంచకర్ల రమేష్ బాబు (Pendurthi MLA)", district: "అనకాపల్లి", party: "JSP" },
    { handle: "@CMRamesh_MP", name: "సి.ఎం. రమేష్ (Anakapalli MP)", district: "అనకాపల్లి", party: "BJP" },
    { handle: "@gudivadaamar", name: "గుడివాడ అమర్‌నాథ్ (Ex-IT Minister)", district: "అనకాపల్లి", party: "YSRCP" },
    { handle: "@BudiMutyala", name: "బూడి ముత్యాల నాయుడు (Ex-Dy CM, Madugula)", district: "అనకాపల్లి", party: "YSRCP" },
    { handle: "@PetlaGanesh", name: "పెట్ల ఉమాశంకర్ గణేష్ (Ex-MLA Narsipatnam)", district: "అనకాపల్లి", party: "YSRCP" },
    { handle: "@KannaBabuAnakap", name: "ఉప్పలపాటి వెంకట రమణమూర్తి రాజు (కన్నబాబు) (Ex-MLA Elamanchili)", district: "అనకాపల్లి", party: "YSRCP" },
    { handle: "@AdeepRajMLA", name: "అన్నంరెడ్డి అదీప్ రాజ్ (Ex-MLA Pendurthi)", district: "అనకాపల్లి", party: "YSRCP" },

    // ==========================================
    // 7. కాకినాడ (Kakinada)
    // ==========================================
    { handle: "@PawanKalyan", name: "పవన్ కళ్యాణ్ (Deputy Chief Minister, Pithapuram MLA, JanaSena Chief)", district: "కాకినాడ", party: "JSP" },
    { handle: "@KondababuV", name: "వనమాడి వెంకటేశ్వరరావు (కొండబాబు) (Kakinada City MLA)", district: "కాకినాడ", party: "TDP" },
    { handle: "@PanthamNanaji", name: "పంతం నానాజీ (Kakinada Rural MLA)", district: "కాకినాడ", party: "JSP" },
    { handle: "@Jyothula_Nehru", name: "జ్యోతుల నెహ్రూ (Jaggampeta MLA)", district: "కాకినాడ", party: "TDP" },
    { handle: "@VarupulaPrabha", name: "వరుపుల సత్యప్రభ (Prathipadu MLA)", district: "కాకినాడ", party: "TDP" },
    { handle: "@YanamalaDivya", name: "యనమల దివ్య (Tuni MLA)", district: "కాకినాడ", party: "TDP" },
    { handle: "@Yanamala_R", name: "యనమల రామకృష్ణుడు (Senior TDP Leader / MLC)", district: "కాకినాడ", party: "TDP" },
    { handle: "@UdayTangellaJSP", name: "తంగెళ్ల ఉదయ్ శ్రీనివాస్ (Kakinada MP)", district: "కాకినాడ", party: "JSP" },
    { handle: "@DwarampudiCSR", name: "ద్వారంపూడి చంద్రశేఖర్ రెడ్డి (Ex-MLA Kakinada City)", district: "కాకినాడ", party: "YSRCP" },
    { handle: "@VangaGeethamP", name: "వంగా గీత (Ex-MP)", district: "కాకినాడ", party: "YSRCP" },
    { handle: "@DadisettiRaja", name: "దాడిశెట్టి రాజా (Ex-Roads & Buildings Minister, Tuni)", district: "కాకినాడ", party: "YSRCP" },
    { handle: "@KurasalaKannaB", name: "కురసాల కన్నబాబు (Ex-Agriculture Minister, Kakinada Rural)", district: "కాకినాడ", party: "YSRCP" },

    // ==========================================
    // 8. కోనసీమ (Dr. B.R. Ambedkar Konaseema)
    // ==========================================
    { handle: "@V_Subhash_TDP", name: "వాసంశెట్టి సుభాష్ (Labour & Factory Minister, Ramachandrapuram MLA)", district: "కోనసీమ", party: "TDP" },
    { handle: "@AnandaraoMLA", name: "ఐతాబత్తుల ఆనందరావు (Amalapuram MLA)", district: "కోనసీమ", party: "TDP" },
    { handle: "@DevaVaraprasad", name: "దేవ వరప్రసాద్ (Razole MLA)", district: "కోనసీమ", party: "JSP" },
    { handle: "@Chinarajappa", name: "నిమ్మకాయల చిన్నరాజప్ప (Peddapuram MLA, Ex-Dy CM)", district: "కోనసీమ", party: "TDP" },
    { handle: "@DatlaBuchiBabu", name: "దాట్ల సుబ్బరాజు (బుచ్చిబాబు) (Mummidivaram MLA)", district: "కోనసీమ", party: "TDP" },
    { handle: "@HarishGanti_TDP", name: "గంటి హరీష్ మాధుర్ (P. Gannavaram MLA)", district: "కోనసీమ", party: "TDP" },
    { handle: "@BandaruS_MLA", name: "బండారు సత్యానందరావు (Kothapeta MLA)", district: "కోనసీమ", party: "TDP" },
    { handle: "@GMHarishMP", name: "జి.ఎం. హరీష్ బాలయోగి (Amalapuram MP)", district: "కోనసీమ", party: "TDP" },
    { handle: "@PinipeViswarup", name: "పినిపే విశ్వరూప్ (Ex-Minister, Amalapuram)", district: "కోనసీమ", party: "YSRCP" },
    { handle: "@PonnadaSatish", name: "పొన్నాడ వెంకట సతీష్ కుమార్ (Ex-MLA Mummidivaram)", district: "కోనసీమ", party: "YSRCP" },
    { handle: "@ChintaAnuradha", name: "చింతా అనురాధ (Ex-MP Amalapuram)", district: "కోనసీమ", party: "YSRCP" },
    { handle: "@RapakaVaraprasd", name: "రాపాక వరప్రసాద రావు (Ex-MLA Razole)", district: "కోనసీమ", party: "YSRCP" },
    { handle: "@ChiranjeeviJasti", name: "చిరంజీవి రావు జస్తి (Mandapeta MLA)", district: "కోనసీమ", party: "TDP" },

    // ==========================================
    // 9. తూర్పు గోదావరి (East Godavari)
    // ==========================================
    { handle: "@kanduladurgesh", name: "కందుల దుర్గేష్ (Tourism, Culture & Cinematography Minister, Nidadavole MLA)", district: "తూర్పు గోదావరి", party: "JSP" },
    { handle: "@Gorantla_BC", name: "గోరంట్ల బుచ్చయ్య చౌదరి (Rajahmundry Rural MLA)", district: "తూర్పు గోదావరి", party: "TDP" },
    { handle: "@AdireddyVasu", name: "అదిరెడ్డి శ్రీనివాస్ (వాసు) (Rajahmundry City MLA)", district: "తూర్పు గోదావరి", party: "TDP" },
    { handle: "@BalaramJSP", name: "బత్తుల బలరామకృష్ణ (Rajanagaram MLA)", district: "తూర్పు గోదావరి", party: "JSP" },
    { handle: "@MukkidiVenkat", name: "ముక్కిడి వెంకటేశ్వరరావు (Gopalapuram MLA)", district: "తూర్పు గోదావరి", party: "TDP" },
    { handle: "@PurandeswariBJP", name: "దగ్గుబాటి పురంధేశ్వరి (Rajahmundry MP, BJP AP President)", district: "తూర్పు గోదావరి", party: "BJP" },
    { handle: "@AdireddyBhavani", name: "అదిరెడ్డి భవాని (Ex-MLA Rajahmundry City)", district: "తూర్పు గోదావరి", party: "TDP" },
    { handle: "@BharatMargani", name: "మార్గాని భరత్ రామ్ (Ex-MP, Rajahmundry City)", district: "తూర్పు గోదావరి", party: "YSRCP" },
    { handle: "@JakkampudiRaja", name: "జక్కంపూడి రాజా (Ex-MLA Rajanagaram)", district: "తూర్పు గోదావరి", party: "YSRCP" },
    { handle: "@TanetiVanitha_", name: "తానేటి వనిత (Ex-Home Minister)", district: "తూర్పు గోదావరి", party: "YSRCP" },
    { handle: "@GSR_Nidadavole", name: "జి. శ్రీనివాస నాయుడు (Ex-MLA Nidadavole)", district: "తూర్పు గోదావరి", party: "YSRCP" },

    // ==========================================
    // 10. పశ్చిమ గోదావరి (West Godavari)
    // ==========================================
    { handle: "@RaghuramaRKraju", name: "రఘురామ కృష్ణరాజు (AP Assembly Deputy Speaker, Undi MLA)", district: "పశ్చిమ గోదావరి", party: "TDP" },
    { handle: "@RamanaiduTDP", name: "నిమ్మల రామానాయుడు (Water Resources Minister, Palakollu MLA)", district: "పశ్చిమ గోదావరి", party: "TDP" },
    { handle: "@Pithani_Satya", name: "పితాని సత్యనారాయణ (Achanta MLA, Ex-Minister)", district: "పశ్చిమ గోదావరి", party: "TDP" },
    { handle: "@AnjibabuJSP", name: "పులపర్తి రామాంజనేయులు (అంజిబాబు) (Bhimavaram MLA)", district: "పశ్చిమ గోదావరి", party: "JSP" },
    { handle: "@BSR_Varma", name: "భూపతిరాజు శ్రీనివాస వర్మ (Union Minister of State for Heavy Industries, Narasapuram MP)", district: "పశ్చిమ గోదావరి", party: "BJP" },
    { handle: "@NarasapuramJSP", name: "బొమ్మిడి నారాయణ నాయకర్ (Narasapuram MLA)", district: "పశ్చిమ గోదావరి", party: "JSP" },
    { handle: "@PatsamatlaV", name: "పాత్సమట్ల ధర్మరాజు (Tadepalligudem MLA)", district: "పశ్చిమ గోదావరి", party: "JSP" },
    { handle: "@GrandhiSrinivas", name: "గ్రంథి శ్రీనివాస్ (Ex-MLA Bhimavaram)", district: "పశ్చిమ గోదావరి", party: "YSRCP" },
    { handle: "@PrasadaRajuMLAY", name: "ముదునూరి ప్రసాదరాజు (Ex-Chief Whip, Narasapuram)", district: "పశ్చిమ గోదావరి", party: "YSRCP" },
    { handle: "@CSR_RangaRaju", name: "చెరుకువాడ శ్రీ రంగనాథరాజు (Ex-Minister Achanta)", district: "పశ్చిమ గోదావరి", party: "YSRCP" },
    { handle: "@KottuSatyanaray", name: "కొట్టు సత్యనారాయణ (Ex-Dy CM & Endowments Minister, Tadepalligudem)", district: "పశ్చిమ గోదావరి", party: "YSRCP" },

    // ==========================================
    // 11. ఏలూరు (Eluru)
    // ==========================================
    { handle: "@Chintamaneni_P", name: "చింతమనేని ప్రభాకర్ (Denduluru MLA)", district: "ఏలూరు", party: "TDP" },
    { handle: "@BadetiRadha", name: "బడేటి రాధాకృష్ణయ్య (చంటి) (Eluru MLA)", district: "ఏలూరు", party: "TDP" },
    { handle: "@K_ParthaSarathi", name: "కొలుసు పార్థసారథి (Housing, I&PR Minister, Nuzvid MLA)", district: "ఏలూరు", party: "TDP" },
    { handle: "@SongaRoshanTDP", name: "సొంగా రోషన్ కుమార్ (Chintalapudi MLA)", district: "ఏలూరు", party: "TDP" },
    { handle: "@PuttaMaheshMP", name: "పుట్టా మహేష్ కుమార్ (Eluru MP)", district: "ఏలూరు", party: "TDP" },
    { handle: "@MaddipatiV_TDP", name: "మద్దిపాటి వెంకటరాజు (Gopalapuram / Polavaram region)", district: "ఏలూరు", party: "TDP" },
    { handle: "@ChirriBalaraju", name: "చిర్రి బాలరాజు (Polavaram MLA)", district: "ఏలూరు", party: "JSP" },
    { handle: "@AllaNaniYSRCP", name: "ఆళ్ల కాళీ కృష్ణ శ్రీనివాస్ (ఆళ్ల నాని) (Ex-Dy CM & Health Minister, Eluru)", district: "ఏలూరు", party: "YSRCP" },
    { handle: "@AbbayaChowdary", name: "కొఠారు అబ్బయ్య చౌదరి (Ex-MLA Denduluru)", district: "ఏలూరు", party: "YSRCP" },
    { handle: "@MekaPratapAppa", name: "మేకా వెంకట ప్రతాప్ అప్పారావు (Ex-MLA Nuzvid)", district: "ఏలూరు", party: "YSRCP" },
    { handle: "@TellamBalaraju", name: "తెల్లం బాలరాజు (Ex-MLA Polavaram)", district: "ఏలూరు", party: "YSRCP" },
    { handle: "@VunnamatlaEliz", name: "వున్నమట్ల ఎలిజా (Ex-MLA Chintalapudi)", district: "ఏలూరు", party: "YSRCP" },

    // ==========================================
    // 12. కృష్ణా (Krishna)
    // ==========================================
    { handle: "@KolluRavindra_", name: "కొల్లు రవీంద్ర (Mines, Geology & Excise Minister, Machilipatnam MLA)", district: "కృష్ణా", party: "TDP" },
    { handle: "@VenigandlaRamu", name: "వెనిగండ్ల రాము (Gudivada MLA)", district: "కృష్ణా", party: "TDP" },
    { handle: "@BodePrasadTDP", name: "బోడే ప్రసాద్ (Penamaluru MLA)", district: "కృష్ణా", party: "TDP" },
    { handle: "@YarlagaddaVR", name: "యార్లగడ్డ వెంకట్రావు (Gannavaram MLA)", district: "కృష్ణా", party: "TDP" },
    { handle: "@KagithaKP_TDP", name: "కాగిత కృష్ణ ప్రసాద్ (Pedana MLA)", district: "కృష్ణా", party: "TDP" },
    { handle: "@VarlaRamaiah", name: "వర్ల రామయ్య (TDP Politburo Member)", district: "కృష్ణా", party: "TDP" },
    { handle: "@VBalashowry", name: "వల్లభనేని బాలశౌరి (Machilipatnam MP)", district: "కృష్ణా", party: "JSP" },
    { handle: "@MandaliBuddhaP", name: "మండలి బుద్ధ ప్రసాద్ (Avanigadda MLA)", district: "కృష్ణా", party: "JSP" },
    { handle: "@Perni_Nani", name: "పేర్ని వెంకట్రామయ్య (నాని) (Ex-Transport Minister, Machilipatnam)", district: "కృష్ణా", party: "YSRCP" },
    { handle: "@PerniKittu", name: "పేర్ని కృష్ణమూర్తి (కిట్టు)", district: "కృష్ణా", party: "YSRCP" },
    { handle: "@KodaliNaniOffl", name: "కొడాలి శ్రీ వెంకటేశ్వరరావు (నాని) (Ex-Civil Supplies Minister, Gudivada)", district: "కృష్ణా", party: "YSRCP" },
    { handle: "@VamsiVallabhane", name: "వల్లభనేని వంశీ మోహన్ (Ex-MLA Gannavaram)", district: "కృష్ణా", party: "YSRCP" },
    { handle: "@SimhadriRamesh", name: "సింహాద్రి రమేష్ బాబు (Ex-MLA Avanigadda)", district: "కృష్ణా", party: "YSRCP" },
    { handle: "@JogiRameshYSRCP", name: "జోగి రమేష్ (Ex-Housing Minister, Pedana)", district: "కృష్ణా", party: "YSRCP" },

    // ==========================================
    // 13. ఎన్టీఆర్ (NTR)
    // ==========================================
    { handle: "@KesineniChinni", name: "కేశినేని శివనాథ్ (చిన్ని) (Vijayawada MP)", district: "ఎన్టీఆర్", party: "TDP" },
    { handle: "@Gadde_TDP", name: "గద్దె రామ్మోహన్ రావు (Vijayawada East MLA)", district: "ఎన్టీఆర్", party: "TDP" },
    { handle: "@BondaUmaTDP", name: "బోండా ఉమామహేశ్వరరావు (Vijayawada Central MLA)", district: "ఎన్టీఆర్", party: "TDP" },
    { handle: "@yschowdary", name: "వై.ఎస్. చౌదరి (సుజనా చౌదరి) (Vijayawada West MLA)", district: "ఎన్టీఆర్", party: "BJP" },
    { handle: "@DevineniUma", name: "దేవినేని ఉమామహేశ్వరరావు (Ex-Water Resources Minister)", district: "ఎన్టీఆర్", party: "TDP" },
    { handle: "@VasanthaV_KP", name: "వసంత వెంకట కృష్ణ ప్రసాద్ (Mylavaram MLA)", district: "ఎన్టీఆర్", party: "TDP" },
    { handle: "@SriramTatayya", name: "శ్రీరామ్ రాజగోపాల్ (తాతయ్య) (Jaggayyapeta MLA)", district: "ఎన్టీఆర్", party: "TDP" },
    { handle: "@TiruvuruMLA_TDP", name: "కొలికపూడి శ్రీనివాసరావు (Tiruvuru MLA)", district: "ఎన్టీఆర్", party: "TDP" },
    { handle: "@DevineniAvi", name: "దేవినేని అవినాష్ (Vijayawada East Incharge)", district: "ఎన్టీఆర్", party: "YSRCP" },
    { handle: "@MalladiVishnu", name: "మల్లాది విష్ణు (Ex-MLA Vijayawada Central)", district: "ఎన్టీఆర్", party: "YSRCP" },
    { handle: "@Vellampalli_S", name: "వెలంపల్లి శ్రీనివాసరావు (Ex-Endowments Minister, Vijayawada West)", district: "ఎన్టీఆర్", party: "YSRCP" },
    { handle: "@kesineni_nani", name: "కేశినేని శ్రీనివాస్ (నాని) (Ex-MP Vijayawada)", district: "ఎన్టీఆర్", party: "YSRCP" },
    { handle: "@KokkiligaddaR", name: "కొక్కిలిగడ్డ రక్షణనిధి (Ex-MLA Tiruvuru)", district: "ఎన్టీఆర్", party: "YSRCP" },
    { handle: "@SamineniUdaya", name: "సామినేని ఉదయభాను (Ex-MLA Jaggayyapeta)", district: "ఎన్టీఆర్", party: "YSRCP" },

    // ==========================================
    // 14. గుంటూరు (Guntur)
    // ==========================================
    { handle: "@naralokesh", name: "నారా లోకేష్ (HRD, IT, Electronics & RTG Minister, Mangalagiri MLA)", district: "గుంటూరు", party: "TDP" },
    { handle: "@PemmasaniOnX", name: "డాక్టర్ పెమ్మసాని చంద్రశేఖర్ (Union MoS for Rural Dev & Communications, Guntur MP)", district: "గుంటూరు", party: "TDP" },
    { handle: "@nadendla_m", name: "నాదెండ్ల మనోహర్ (Food, Civil Supplies Minister, Tenali MLA, JSP PAC Chairman)", district: "గుంటూరు", party: "JSP" },
    { handle: "@Dhulipalla_N", name: "ధూళిపాళ్ల నరేంద్ర కుమార్ (Ponnur MLA)", district: "గుంటూరు", party: "TDP" },
    { handle: "@TenaliSravan", name: "తెనాలి శ్రావణ్ కుమార్ (Tadikonda MLA)", district: "గుంటూరు", party: "TDP" },
    { handle: "@GallaMadhaviTDP", name: "గల్లా మాధవి (Guntur West MLA)", district: "గుంటూరు", party: "TDP" },
    { handle: "@NaseerAhmedTDP", name: "మహమ్మద్ నసీర్ అహ్మద్ (Guntur East MLA)", district: "గుంటూరు", party: "TDP" },
    { handle: "@JayGalla", name: "గల్లా జయదేవ్ (Ex-MP Guntur)", district: "గుంటూరు", party: "TDP" },
    { handle: "@AllaRKReddy", name: "ఆళ్ల రామకృష్ణారెడ్డి (ఆర్కే) (Ex-MLA Mangalagiri)", district: "గుంటూరు", party: "YSRCP" },
    { handle: "@VidadalaRajini", name: "విడదల రజిని (Ex-Health Minister, Guntur West)", district: "గుంటూరు", party: "YSRCP" },
    { handle: "@MdMusthafaYSR", name: "మహమ్మద్ ముస్తఫా షేక్ (Ex-MLA Guntur East)", district: "గుంటూరు", party: "YSRCP" },
    { handle: "@KilariVenkatR", name: "కిలారి వెంకట రోశయ్య (Ex-MLA Ponnur)", district: "గుంటూరు", party: "YSRCP" },
    { handle: "@UndavalliSridev", name: "డాక్టర్ ఉండవల్లి శ్రీదేవి (Ex-MLA Tadikonda)", district: "గుంటూరు", party: "TDP" },
    { handle: "@AnnambhotlaSiva", name: "అన్నాబత్తుని శివకుమార్ (Ex-MLA Tenali)", district: "గుంటూరు", party: "YSRCP" },

    // ==========================================
    // 15. బాపట్ల (Bapatla)
    // ==========================================
    { handle: "@Anagani_SP", name: "అనగాని సత్యప్రసాద్ (Revenue, Stamps & Registration Minister, Repalle MLA)", district: "బాపట్ల", party: "TDP" },
    { handle: "@Gottipati_Ravi", name: "గొట్టిపాటి రవికుమార్ (Energy Minister, Addanki MLA)", district: "బాపట్ల", party: "TDP" },
    { handle: "@VegesnaVarma", name: "వేగేశన నరేంద్ర వర్మ (Bapatla MLA)", district: "బాపట్ల", party: "TDP" },
    { handle: "@KrishnaPrasadAP", name: "తెన్నేటి కృష్ణ ప్రసాద్ (Bapatla MP, Ex-DGP)", district: "బాపట్ల", party: "TDP" },
    { handle: "@DrSwamiDasTDP", name: "డాక్టర్ ఎం. స్వామిదాస్ (Santhanuthalapadu MLA)", district: "బాపట్ల", party: "TDP" },
    { handle: "@ChallaAnuradhaT", name: "చల్లా అనురాధ (Vemuru MLA)", district: "బాపట్ల", party: "TDP" },
    { handle: "@YeluriSambasiva", name: "ఏలూరి సాంబశివరావు (Parchur MLA)", district: "బాపట్ల", party: "TDP" },
    { handle: "@KonaRaghupathi", name: "కోన రఘుపతి (Ex-Dy Speaker, Bapatla)", district: "బాపట్ల", party: "YSRCP" },
    { handle: "@Mopidevi_VR", name: "మోపిదేవి వెంకటరమణ (Ex-Rajya Sabha MP & Minister)", district: "బాపట్ల", party: "TDP" },
    { handle: "@MeruguNagarjun", name: "మేరుగ నాగార్జున (Ex-Social Welfare Minister, Vemuru)", district: "బాపట్ల", party: "YSRCP" },
    { handle: "@NandigamSuresh", name: "నందిగం సురేష్ (Ex-MP Bapatla)", district: "బాపట్ల", party: "YSRCP" },
    { handle: "@TJR_Sudhakar", name: "టి.జె.ఆర్. సుధాకర్ బాబు (Ex-MLA Santhanuthalapadu)", district: "బాపట్ల", party: "YSRCP" },

    // ==========================================
    // 16. పల్నాడు (Palnadu)
    // ==========================================
    { handle: "@Prathipati_PR", name: "ప్రత్తిపాటి పుల్లారావు (Chilakaluripet MLA, Ex-Minister)", district: "పల్నాడు", party: "TDP" },
    { handle: "@KannaLakshmiBJP", name: "కన్నా లక్ష్మీనారాయణ (Sattenapalli MLA, Ex-Minister)", district: "పల్నాడు", party: "TDP" },
    { handle: "@Julakanti_BR", name: "జూలకంటి బ్రహ్మానందరెడ్డి (Macherla MLA)", district: "పల్నాడు", party: "TDP" },
    { handle: "@Yarapatineni_SR", name: "యరపతినేని శ్రీనివాసరావు (Gurazala MLA)", district: "పల్నాడు", party: "TDP" },
    { handle: "@Chadalavada_AB", name: "డాక్టర్ చదలవాడ అరవింద బాబు (Narasaraopet MLA)", district: "పల్నాడు", party: "TDP" },
    { handle: "@LavuDevarayalu", name: "లావు శ్రీకృష్ణ దేవరాయలు (Narasaraopet MP, TDP Lok Sabha Leader)", district: "పల్నాడు", party: "TDP" },
    { handle: "@DGV_Rao_Vinukond", name: "జి.వి. ఆంజనేయులు (Vinukonda MLA)", district: "పల్నాడు", party: "TDP" },
    { handle: "@KurapatiSridhar", name: "కురపాటి శ్రీధర్ (Pedakurapadu MLA)", district: "పల్నాడు", party: "TDP" },
    { handle: "@AmbatiRambabu", name: "అంబటి రాంబాబు (Ex-Water Resources Minister, Sattenapalli)", district: "పల్నాడు", party: "YSRCP" },
    { handle: "@DrGopireddySR", name: "డాక్టర్ గోపిరెడ్డి శ్రీనివాసరెడ్డి (Ex-MLA Narasaraopet)", district: "పల్నాడు", party: "YSRCP" },
    { handle: "@PinnelliRKReddy", name: "పిన్నెల్లి రామకృష్ణారెడ్డి (Ex-Government Whip, Macherla)", district: "పల్నాడు", party: "YSRCP" },
    { handle: "@KasuMaheshYSR", name: "కాసు మహేష్ రెడ్డి (Ex-MLA Gurazala)", district: "పల్నాడు", party: "YSRCP" },
    { handle: "@BollaBrahmaNaid", name: "బొల్లా బ్రహ్మనాయుడు (Ex-MLA Vinukonda)", district: "పల్నాడు", party: "YSRCP" },
    { handle: "@NamburuSankara", name: "నంబూరు శంకరరావు (Ex-MLA Pedakurapadu)", district: "పల్నాడు", party: "YSRCP" },

    // ==========================================
    // 17. ప్రకాశం (Prakasam)
    // ==========================================
    { handle: "@Damacharla_JR", name: "దామచర్ల జనార్దనరావు (Ongole MLA)", district: "ప్రకాశం", party: "TDP" },
    { handle: "@DBVSwamyTDP", name: "డోలా శ్రీ బాలవీరాంజనేయ స్వామి (Social Welfare Minister, Kondapi MLA)", district: "ప్రకాశం", party: "TDP" },
    { handle: "@AshokReddyMLA", name: "ముత్తుముల అశోక్ రెడ్డి (Giddalur MLA)", district: "ప్రకాశం", party: "TDP" },
    { handle: "@MaguntaSReddy", name: "మాగుంట శ్రీనివాసులు రెడ్డి (Ongole MP)", district: "ప్రకాశం", party: "TDP" },
    { handle: "@RaghavaMagunta", name: "మాగుంట రాఘవ రెడ్డి", district: "ప్రకాశం", party: "TDP" },
    { handle: "@MukkuUgraNaras", name: "ముక్కు ఉగ్ర నరసింహారెడ్డి (Kanigiri MLA)", district: "ప్రకాశం", party: "TDP" },
    { handle: "@Balineni_AP", name: "బాలినేని శ్రీనివాసరెడ్డి (Ex-Minister, Ongole)", district: "ప్రకాశం", party: "JSP" },
    { handle: "@BuchepalliSPR", name: "బూచేపల్లి శివప్రసాద్ రెడ్డి (Darsi MLA)", district: "ప్రకాశం", party: "YSRCP" },
    { handle: "@ChandrasekharMLA", name: "తాటిపర్తి చంద్రశేఖర్ (Yerragondapalem MLA)", district: "ప్రకాశం", party: "YSRCP" },
    { handle: "@KPKondareddy", name: "కుందూరు నాగార్జున రెడ్డి (Markapuram)", district: "ప్రకాశం", party: "YSRCP" },
    { handle: "@AnnaRambabuYSR", name: "అన్నా రాంబాబు (Ex-MLA Giddalur)", district: "ప్రకాశం", party: "YSRCP" },
    { handle: "@BurraMadhuSudan", name: "బుర్రా మధుసూదన్ యాదవ్ (Ex-MLA Kanigiri)", district: "ప్రకాశం", party: "YSRCP" },

    // ==========================================
    // 18. శ్రీ పొట్టి శ్రీరాములు నెల్లూరు (Nellore)
    // ==========================================
    { handle: "@Dr_NarayanaP", name: "డాక్టర్ పొంగూరు నారాయణ (Municipal Admin & Urban Dev Minister, Nellore City MLA)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "TDP" },
    { handle: "@AnamReddy_TDP", name: "ఆనం రామనారాయణ రెడ్డి (Endowments Minister, Atmakur MLA)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "TDP" },
    { handle: "@Somireddycm", name: "సోమిరెడ్డి చంద్రమోహన్ రెడ్డి (Sarvepalli MLA, Ex-Minister)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "TDP" },
    { handle: "@kotamreddy_NLR", name: "కోటంరెడ్డి శ్రీధర్ రెడ్డి (Nellore Rural MLA)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "TDP" },
    { handle: "@Prashanthi_VPR", name: "వేమిరెడ్డి ప్రశాంతి రెడ్డి (Kovur MLA)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "TDP" },
    { handle: "@Vemireddy_VPR", name: "వేమిరెడ్డి ప్రభాకర్ రెడ్డి (Nellore MP)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "TDP" },
    { handle: "@KurugondlaRK", name: "కురుగొండ్ల రామకృష్ణ (Venkatagiri MLA)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "TDP" },
    { handle: "@SureshKakarla_", name: "కాకర్ల సురేష్ (Udayagiri MLA)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "TDP" },
    { handle: "@sunilkumarpasam", name: "పాశం సునీల్ కుమార్ (Gudur MLA)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "TDP" },
    { handle: "@Dr_nelavalaMLA", name: "డాక్టర్ నెలవల విజయశ్రీ (Sullurpeta MLA)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "TDP" },
    { handle: "@AKYOnline", name: "పోలుబోయిన అనిల్ కుమార్ యాదవ్ (Ex-Irrigation Minister)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "YSRCP" },
    { handle: "@kakanigovardhan", name: "కాకాని గోవర్ధన్ రెడ్డి (Ex-Agriculture Minister, Sarvepalli)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "YSRCP" },
    { handle: "@MekapatiVikram", name: "మేకపాటి విక్రమ్ రెడ్డి (Ex-MLA Atmakur)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "YSRCP" },
    { handle: "@MekapatiRMR", name: "మేకపాటి రాజమోహన్ రెడ్డి (Senior YSRCP Leader / Ex-MP)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "YSRCP" },
    { handle: "@NallapureddyPR", name: "నల్లపురెడ్డి ప్రసన్నకుమార్ రెడ్డి (Ex-MLA Kovur)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "YSRCP" },
    { handle: "@KilivetiSanjeev", name: "కిలివేటి సంజీవయ్య (Ex-MLA Sullurpeta)", district: "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు", party: "YSRCP" },

    // ==========================================
    // 19. కర్నూలు (Kurnool)
    // ==========================================
    { handle: "@TGBharath", name: "టి.జి. భరత్ (Industries & Commerce, Food Processing Minister, Kurnool MLA)", district: "కర్నూలు", party: "TDP" },
    { handle: "@KotlaSuryaReddy", name: "కోట్ల జయసూర్యప్రకాష్ రెడ్డి (Dhone MLA, Ex-Union Minister)", district: "కర్నూలు", party: "TDP" },
    { handle: "@BVJayanageswar", name: "బి.వి. జయనాగేశ్వరరెడ్డి (Yemmiganur MLA)", district: "కర్నూలు", party: "TDP" },
    { handle: "@JayaramGummanur", name: "గుమ్మనూరు జయరాం (Guntakal MLA, Ex-Minister)", district: "కర్నూలు", party: "TDP" },
    { handle: "@NagarajuBastip", name: "బస్తిపాటి నాగరాజు (పంచలింగాల) (Kurnool MP)", district: "కర్నూలు", party: "TDP" },
    { handle: "@ManiGandhiTDP", name: "బొగ్గుల దస్తగిరి / మణిగాంధీ (Kodumur)", district: "కర్నూలు", party: "TDP" },
    { handle: "@ThikkaReddyTDP", name: "కె. తిక్కారెడ్డి (Mantralayam)", district: "కర్నూలు", party: "TDP" },
    { handle: "@BugganaRajendra", name: "బుగ్గన రాజేంద్రనాథ్ రెడ్డి (Ex-Finance Minister, Dhone)", district: "కర్నూలు", party: "YSRCP" },
    { handle: "@HafeezKhanYSRCP", name: "అబ్దుల్ హఫీజ్ ఖాన్ (Ex-MLA Kurnool)", district: "కర్నూలు", party: "YSRCP" },
    { handle: "@BalanagiReddyY", name: "వై. బాలనాగిరెడ్డి (Mantralayam MLA)", district: "కర్నూలు", party: "YSRCP" },
    { handle: "@KChennakesavaR", name: "కె. చెన్నకేశవ రెడ్డి (Ex-MLA Yemmiganur)", district: "కర్నూలు", party: "YSRCP" },
    { handle: "@YVenkatramiRedd", name: "వై. వెంకట్రామిరెడ్డి (Ex-MLA Guntakal)", district: "కర్నూలు", party: "YSRCP" },
    { handle: "@ButtaRenuka", name: "బుట్టా రేణుక (Ex-MP Kurnool)", district: "కర్నూలు", party: "YSRCP" },

    // ==========================================
    // 20. నంద్యాల (Nandyal)
    // ==========================================
    { handle: "@NMDFarooqTDP", name: "ఎన్.ఎండి. ఫరూక్ (Law & Justice, Minority Welfare Minister, Nandyal MLA)", district: "నంద్యాల", party: "TDP" },
    { handle: "@BCJanardhanTDP", name: "బి.సి. జనార్దన్ రెడ్డి (Roads & Buildings Minister, Banaganapalle MLA)", district: "నంద్యాల", party: "TDP" },
    { handle: "@bhuma_akhilapriya", name: "భూమా అఖిలప్రియ (Allagadda MLA, Ex-Tourism Minister)", district: "నంద్యాల", party: "TDP" },
    { handle: "@BuddaRajasekhar", name: "బుడ్డా రాజశేఖర్ రెడ్డి (Srisailam MLA)", district: "నంద్యాల", party: "TDP" },
    { handle: "@BhumaBrahmaTDP", name: "భూమా బ్రహ్మానంద రెడ్డి (Nandyal)", district: "నంద్యాల", party: "TDP" },
    { handle: "@GithaJayasurya", name: "గిత్తా జయసూర్య (Nandikotkur MLA)", district: "నంద్యాల", party: "TDP" },
    { handle: "@KotlaHarshavard", name: "కోట్ల హర్షవర్ధన్ రెడ్డి (Panyam)", district: "నంద్యాల", party: "TDP" },
    { handle: "@ByreddyRSR", name: "బైరెడ్డి రాజశేఖర్ రెడ్డి (Rayalaseema Pariraskhana Samithi)", district: "నంద్యాల", party: "BJP" },
    { handle: "@SilpaRaviReddy", name: "శిల్పా రవిచంద్ర కిషోర్ రెడ్డి (Ex-MLA Nandyal)", district: "నంద్యాల", party: "YSRCP" },
    { handle: "@KatasaniRBR", name: "కాటసాని రాంభూపాల్ రెడ్డి (Ex-MLA Panyam)", district: "నంద్యాల", party: "YSRCP" },
    { handle: "@GangulaBrijendra", name: "గంగుల బ్రిజేంద్రారెడ్డి (నాని) (Ex-MLA Allagadda)", district: "నంద్యాల", party: "YSRCP" },
    { handle: "@ShilpaChakrapan", name: "శిల్పా చక్రపాణి రెడ్డి (Ex-MLA Srisailam)", district: "నంద్యాల", party: "YSRCP" },
    { handle: "@KatasaniPrasada", name: "కాటసాని ప్రసాద్ రెడ్డి (Ex-MLA Banaganapalle)", district: "నంద్యాల", party: "YSRCP" },
    { handle: "@ByreddySiddarth", name: "బైరెడ్డి సిద్ధార్థ రెడ్డి (YSRCP State Youth Wing President)", district: "నంద్యాల", party: "YSRCP" },

    // ==========================================
    // 21. అనంతపురం (Anantapur)
    // ==========================================
    { handle: "@PayyavulaKeshav", name: "పయ్యావుల కేశవ్ (Finance, Planning & Commercial Taxes Minister, Uravakonda MLA)", district: "అనంతపురం", party: "TDP" },
    { handle: "@ParitalaSunitha", name: "పరిటాల సునీత (Raptadu MLA, Ex-Minister)", district: "అనంతపురం", party: "TDP" },
    { handle: "@ParitalaSreeram", name: "పరిటాల శ్రీరామ్ (TDP Youth Leader, Dharmavaram/Raptadu)", district: "అనంతపురం", party: "TDP" },
    { handle: "@DaggupatiVP_TDP", name: "దగ్గుపాటి వెంకటేశ్వర ప్రసాద్ (Anantapur Urban MLA)", district: "అనంతపురం", party: "TDP" },
    { handle: "@AmbicaLakshmiMP", name: "అంబికా లక్ష్మీనారాయణ (Anantapur MP)", district: "అనంతపురం", party: "TDP" },
    { handle: "@JCPavanReddy", name: "జేసీ పవన్ కుమార్ రెడ్డి (Tadipatri)", district: "అనంతపురం", party: "TDP" },
    { handle: "@JCPrabhakarTDP", name: "జేసీ ప్రభాకర్ రెడ్డి (Tadipatri Municipal Chairman, Ex-MLA)", district: "అనంతపురం", party: "TDP" },
    { handle: "@AsmithReddyTDP", name: "జేసీ అస్మిత్ రెడ్డి (Tadipatri MLA)", district: "అనంతపురం", party: "TDP" },
    { handle: "@BandaruShravani", name: "బండారు శ్రావణి శ్రీ (Singanamala MLA)", district: "అనంతపురం", party: "TDP" },
    { handle: "@KSuryaNarayanaT", name: "కలివెంకట సూర్యనారాయణ (Guntakal)", district: "అనంతపురం", party: "TDP" },
    { handle: "@AnanthaVRReddy", name: "అనంత వెంకటరామిరెడ్డి (Ex-MLA Anantapur Urban)", district: "అనంతపురం", party: "YSRCP" },
    { handle: "@TopudurthiPR", name: "తోపుదుర్తి ప్రకాష్ రెడ్డి (Ex-MLA Raptadu)", district: "అనంతపురం", party: "YSRCP" },
    { handle: "@KethireddyPedda", name: "కేతిరెడ్డి పెద్దారెడ్డి (Ex-MLA Tadipatri)", district: "అనంతపురం", party: "YSRCP" },
    { handle: "@VisweswaraReddy", name: "వై. విశ్వేశ్వరరెడ్డి (Ex-MLA Uravakonda)", district: "అనంతపురం", party: "YSRCP" },
    { handle: "@JonnalagaddaPad", name: "జొన్నలగడ్డ పద్మావతి (Ex-MLA Singanamala)", district: "అనంతపురం", party: "YSRCP" },

    // ==========================================
    // 22. శ్రీ సత్యసాయి (Sri Sathya Sai)
    // ==========================================
    { handle: "@satyakumar_y", name: "వై. సత్యకుమార్ యాదవ్ (Health, Medical & Family Welfare Minister, Dharmavaram MLA)", district: "శ్రీ సత్యసాయి", party: "BJP" },
    { handle: "@SavithaPalle_TDP", name: "సవితా పల్లె (BC Welfare, Handlooms & Textiles Minister, Penukonda MLA)", district: "శ్రీ సత్యసాయి", party: "TDP" },
    { handle: "@BalakrishnaTDP", name: "నందమూరి బాలకృష్ణ (Hindupur MLA)", district: "శ్రీ సత్యసాయి", party: "TDP" },
    { handle: "@SindhuraPalle", name: "పల్లె సింధూర రెడ్డి (Puttaparthi MLA)", district: "శ్రీ సత్యసాయి", party: "TDP" },
    { handle: "@KandikuntaVP", name: "కందికుంట వెంకట ప్రసాద్ (Kadiri MLA)", district: "శ్రీ సత్యసాయి", party: "TDP" },
    { handle: "@BKParthaTDP", name: "బి.కె. పార్థసారథి (Hindupur MP)", district: "శ్రీ సత్యసాయి", party: "TDP" },
    { handle: "@VaradapuramSuri", name: "గోనుగుంట్ల సూర్యనారాయణ (వరదాపురం సూరి) (Dharmavaram)", district: "శ్రీ సత్యసాయి", party: "TDP" },
    { handle: "@PalleRaghunatha", name: "పల్లె రఘునాథ రెడ్డి (Ex-Minister, Puttaparthi)", district: "శ్రీ సత్యసాయి", party: "TDP" },
    { handle: "@KethireddyVRR", name: "కేతిరెడ్డి వెంకట్రామిరెడ్డి (Ex-MLA Dharmavaram, Good Morning Dharmavaram)", district: "శ్రీ సత్యసాయి", party: "YSRCP" },
    { handle: "@SankaraYSRCP", name: "మాలగుండ్ల శంకరనారాయణ (Ex-BC Welfare Minister, Penukonda)", district: "శ్రీ సత్యసాయి", party: "YSRCP" },
    { handle: "@DuddukuntaSR", name: "దుద్దుకుంట శ్రీధర్ రెడ్డి (Ex-MLA Puttaparthi)", district: "శ్రీ సత్యసాయి", party: "YSRCP" },
    { handle: "@PVSiddaReddy", name: "డాక్టర్ పి.వి. సిద్ధారెడ్డి (Ex-MLA Kadiri)", district: "శ్రీ సత్యసాయి", party: "YSRCP" },
    { handle: "@K_Iqbal_MLC", name: "మహ్మద్ ఇక్బాల్ (MLC, Ex-IPS, Hindupur)", district: "శ్రీ సత్యసాయి", party: "YSRCP" },

    // ==========================================
    // 23. వైఎస్ఆర్ కడప (YSR Kadapa)
    // ==========================================
    { handle: "@ysjagan", name: "వై.ఎస్. జగన్ మోహన్ రెడ్డి (Ex-Chief Minister, Pulivendula MLA, YSRCP President)", district: "వైఎస్ఆర్ కడప", party: "YSRCP" },
    { handle: "@YSAvinashReddy", name: "వై.ఎస్. అవినాష్ రెడ్డి (Kadapa MP)", district: "వైఎస్ఆర్ కడప", party: "YSRCP" },
    { handle: "@realyssharmila", name: "వై.ఎస్. షర్మిల (APCC President)", district: "వైఎస్ఆర్ కడప", party: "INC" },
    { handle: "@MadhaviReddyTDP", name: "రెడ్డప్పగారి మాధవి రెడ్డి (Kadapa MLA)", district: "వైఎస్ఆర్ కడప", party: "TDP" },
    { handle: "@VaradarajuluR", name: "ఎం. వరదరాజుల రెడ్డి (Proddatur MLA)", district: "వైఎస్ఆర్ కడప", party: "TDP" },
    { handle: "@BhupeshReddyTDP", name: "చడిపిరాళ్ల భూపేష్ సుబ్బరామిరెడ్డి (Mydukur MLA)", district: "వైఎస్ఆర్ కడప", party: "TDP" },
    { handle: "@PuttaSudhakarY", name: "పుట్టా సుధాకర్ యాదవ్ (Kamalapuram MLA, Ex-TTD Chairman)", district: "వైఎస్ఆర్ కడప", party: "TDP" },
    { handle: "@BTechRavi_TDP", name: "మారేడ్డి రవీంద్రనాథ్ రెడ్డి (బిటెక్ రవి) (Pulivendula TDP)", district: "వైఎస్ఆర్ కడప", party: "TDP" },
    { handle: "@AmzathBashaYSR", name: "అంజాద్ బాషా షేక్ బెపారి (Ex-Dy CM & Minority Welfare Minister, Kadapa)", district: "వైఎస్ఆర్ కడప", party: "YSRCP" },
    { handle: "@RachamalluSPR", name: "రాచమల్లు శివప్రసాద్ రెడ్డి (Ex-MLA Proddatur)", district: "వైఎస్ఆర్ కడప", party: "YSRCP" },
    { handle: "@PRavindranathR", name: "పోచంరెడ్డి రవీంద్రనాథ్ రెడ్డి (Ex-MLA Kamalapuram)", district: "వైఎస్ఆర్ కడప", party: "YSRCP" },
    { handle: "@RaghuramiReddy", name: "శెట్టిపల్లె రఘురామిరెడ్డి (Ex-MLA Mydukur)", district: "వైఎస్ఆర్ కడప", party: "YSRCP" },

    // ==========================================
    // 24. అన్నమయ్య (Annamayya)
    // ==========================================
    { handle: "@RamprasadReddyM", name: "మండిపల్లి రాంప్రసాద్ రెడ్డి (Transport, Youth & Sports Minister, Rayachoti MLA)", district: "అన్నమయ్య", party: "TDP" },
    { handle: "@ChallaBabuTDP", name: "చల్లా రామచంద్రారెడ్డి (చల్లా బాబు) (Pileru MLA)", district: "అన్నమయ్య", party: "TDP" },
    { handle: "@SugavasiSubbu", name: "సుగవాసి సుబ్రహ్మణ్యం (Rajampet MLA)", district: "అన్నమయ్య", party: "TDP" },
    { handle: "@ShahjahanBashaT", name: "మహమ్మద్ షాజహాన్ బాషా (Madanapalle MLA)", district: "అన్నమయ్య", party: "TDP" },
    { handle: "@JayachandraTDP", name: "దాసరిపల్లె జయచంద్రారెడ్డి (Thamballapalle)", district: "అన్నమయ్య", party: "TDP" },
    { handle: "@MidhunReddyPV", name: "పెద్దిరెడ్డి వెంకట మిథున్ రెడ్డి (Rajampet MP, YSRCP Lok Sabha Floor Leader)", district: "అన్నమయ్య", party: "YSRCP" },
    { handle: "@PReddyOfficial", name: "పెద్దిరెడ్డి రామచంద్రారెడ్డి (Punganur MLA, Ex-Minister for Energy & Mines)", district: "అన్నమయ్య", party: "YSRCP" },
    { handle: "@DwarakanathR", name: "పెద్దిరెడ్డి ద్వారకానాథ్ రెడ్డి (Thamballapalle MLA)", district: "అన్నమయ్య", party: "YSRCP" },
    { handle: "@SrikanthGadikot", name: "గడికోట శ్రీకాంత్ రెడ్డి (Ex-MLA & Chief Whip, Rayachoti)", district: "అన్నమయ్య", party: "YSRCP" },
    { handle: "@MedaMallikarjun", name: "మేడా వెంకట మల్లికార్జున రెడ్డి (Ex-MLA Rajampet)", district: "అన్నమయ్య", party: "YSRCP" },
    { handle: "@ChintalaRCR", name: "చింతల రామచంద్రారెడ్డి (Ex-MLA Pileru)", district: "అన్నమయ్య", party: "YSRCP" },
    { handle: "@NawazBashaYSR", name: "మహమ్మద్ నవాజ్ బాషా (Ex-MLA Madanapalle)", district: "అన్నమయ్య", party: "YSRCP" },

    // ==========================================
    // 25. చిత్తూరు (Chittoor)
    // ==========================================
    { handle: "@ncbn", name: "నారా చంద్రబాబు నాయుడు (Chief Minister of Andhra Pradesh, Kuppam MLA, TDP National President)", district: "చిత్తూరు", party: "TDP" },
    { handle: "@GurajalaJagan", name: "గురజాల జగన్ మోహన్ (Chittoor MLA)", district: "చిత్తూరు", party: "TDP" },
    { handle: "@MuraliMohanTDP", name: "కలికిరి మురళీ మోహన్ (Puthalapattu MLA)", district: "చిత్తూరు", party: "TDP" },
    { handle: "@PulivarthiNani", name: "పులివర్తి వెంకట మణిప్రసాద్ (నాని) (Chandragiri MLA)", district: "చిత్తూరు", party: "TDP" },
    { handle: "@VMThomasTDP", name: "డాక్టర్ వి.ఎం. థామస్ (G.D. Nellore MLA)", district: "చిత్తూరు", party: "TDP" },
    { handle: "@DrDaggumallaMP", name: "దగ్గుమళ్ల ప్రసాద్ రావు (Chittoor MP, Ex-IRS)", district: "చిత్తూరు", party: "TDP" },
    { handle: "@ChevireddyBR", name: "చెవిరెడ్డి భాస్కర్ రెడ్డి (Ex-MLA Chandragiri, Ex-TUDA Chairman)", district: "చిత్తూరు", party: "YSRCP" },
    { handle: "@MohithReddyC", name: "చెవిరెడ్డి మోహిత్ రెడ్డి (Chandragiri)", district: "చిత్తూరు", party: "YSRCP" },
    { handle: "@NarayanaSwamyGD", name: "కె. నారాయణస్వామి (Ex-Dy CM & Excise Minister, G.D. Nellore)", district: "చిత్తూరు", party: "YSRCP" },
    { handle: "@JangilapalliSR", name: "ఎం. బాబు / జంగాలపల్లి శ్రీనివాసులు (Chittoor)", district: "చిత్తూరు", party: "YSRCP" },
    { handle: "@KRJ_Bharath", name: "కె.ఆర్.జె. భరత్ (MLC, Kuppam YSRCP Incharge)", district: "చిత్తూరు", party: "YSRCP" },

    // ==========================================
    // 26. తిరుపతి (Tirupati)
    // ==========================================
    { handle: "@AraniSrinivas", name: "ఆరణి శ్రీనివాసులు (Tirupati MLA)", district: "తిరుపతి", party: "JSP" },
    { handle: "@BojjalaSudhir", name: "బొజ్జల వెంకట సుధీర్ రెడ్డి (Srikalahasti MLA)", district: "తిరుపతి", party: "TDP" },
    { handle: "@GaliBhanuTDP", name: "గాలి భాను ప్రకాష్ (Nagari MLA)", district: "తిరుపతి", party: "TDP" },
    { handle: "@KonetiAdimulam", name: "కోనేటి ఆదిమూలం (Satyavedu MLA)", district: "తిరుపతి", party: "TDP" },
    { handle: "@GuruTirupati", name: "మద్దెల గురుమూర్తి (Tirupati MP)", district: "తిరుపతి", party: "YSRCP" },
    { handle: "@RojaSelvamaniRK", name: "ఆర్.కె. రోజా సెల్వమణి (Ex-Tourism Minister, Nagari)", district: "తిరుపతి", party: "YSRCP" },
    { handle: "@Bhumana_YSR", name: "భూమన కరుణాకర్ రెడ్డి (Ex-TTD Chairman, Ex-MLA Tirupati)", district: "తిరుపతి", party: "YSRCP" },
    { handle: "@AbhinayReddyB", name: "భూమన అభినయ్ రెడ్డి (Ex-Deputy Mayor, Tirupati)", district: "తిరుపతి", party: "YSRCP" },
    { handle: "@BiyyapuMR", name: "బియ్యపు మధుసూదన్ రెడ్డి (Ex-MLA Srikalahasti)", district: "తిరుపతి", party: "YSRCP" },
    { handle: "@BalliKalyanCh", name: "బల్లి కళ్యాణ్ చక్రవర్తి (MLC)", district: "తిరుపతి", party: "YSRCP" }
];

const targetPath = path.join(__dirname, '..', 'andhra_leaders_feeds.json');
fs.writeFileSync(targetPath, JSON.stringify(leaders, null, 2), 'utf8');
console.log(`Successfully generated andhra_leaders_feeds.json with ${leaders.length} leaders!`);
