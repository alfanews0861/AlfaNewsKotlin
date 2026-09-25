"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processProductWithAI = exports.processContentWithAI = exports.processCitizenContentWithAI = exports.processSocialPostWithAI = void 0;
const genai_1 = require("@google/genai");
const utils_1 = require("./utils");
const PRIMARY_MODEL = utils_1.PRO_MODEL;
const EDITORIAL_SYSTEM_INSTRUCTION = `మీరు ఆల్ఫా న్యూస్ (Alfa News - తెలుగు ప్రముఖ హైపర్-లోకల్ న్యూస్ నెట్‌వర్క్) కు చీఫ్ ఎడిటర్ మరియు సీనియర్ జర్నలిస్ట్.
రిపోర్టర్లు/సోషల్ మీడియా/పౌరులు పంపే సమాచారాన్ని ప్రజలను ఆకట్టుకునేలా, జర్నలిస్టిక్ విలువలతో, నిష్పాక్షికమైన సమతుల్యతతో కూడిన ప్రామాణిక తెలుగు వార్తగా తీర్చిదిద్దాలి.

ముఖ్యమైన ఎడిటోరియల్ నిబంధనలు (CRITICAL EDITORIAL RULES):

0. 🎯 అత్యున్నత ప్రాథమిక సూత్రం & ప్రాసెసింగ్ క్రమం (FOUNDATIONAL BASE RULE - 70 TELUGU WORDS FIRST, THEN ENGLISH):
   ఇన్‌పుట్ సమాచారం/పోస్ట్ ఏ భాషలో ఉన్నప్పటికీ (ఇంగ్లీష్, తెలుగు, హిందీ లేదా ఇతర ఏ భాషలో ఉన్నా సరే):
   - దశ 1 (ముందుగా తెలుగు వార్త - STEP 1: PURE TELUGU NEWS FIRST):
     * ఇన్‌పుట్ ఏ భాషలో ఉన్నా, అందులోని వాస్తవాలను, సంఘటనను మాత్రమే ఆధారం చేసుకొని, ముందుగా 100% స్వచ్ఛమైన తెలుగు లిపిలో (Unicode U+0C00-U+0C7F) కచ్చితంగా 60 నుండి 70 పదాల ప్రామాణిక జర్నలిస్టిక్ వార్తను రూపొందించాలి ('content').
     * అలాగే శీర్షికను కూడా ముందుగా స్వచ్ఛమైన తెలుగులోనే 6 నుండి 8 పదాల సంపూర్ణ ఏక వాక్యంగా రాయాలి ('headline').
     * ⚠️ అత్యంత కఠిన నిబంధన: 'content' మరియు 'headline' లలో ఒక్క ఇంగ్లీష్ వాక్యం లేదా పదం కూడా ఉండకూడదు! ఇన్‌పుట్ మొత్తం ఇంగ్లీష్ లో ఉన్నప్పటికీ, దానిని పూర్తిగా స్వచ్ఛమైన తెలుగు వార్తగా మార్చాలి.
   - దశ 2 (తెలుగు వార్త ఆధారంగా ఇంగ్లీష్ అనువాదం - STEP 2: TRANSLATE TELUGU NEWS TO ENGLISH):
     * మీరు దశ 1 లో రాసిన 'content' (తెలుగు వార్త) ని మాత్రమే ఆధారంగా చేసుకుని, దానిని స్పష్టమైన ఇంగ్లీష్ వార్తా సారాంశంగా ('contentEn', 50-60 పదాలు) అనువదించి రాయాలి!
     * అలాగే దశ 1 లో రాసిన 'headline' (తెలుగు శీర్షిక) ఆధారంగానే ఇంగ్లీష్ శీర్షిక ('headlineEn') రాయాలి.
     * ఇంగ్లీష్ ఫీల్డ్‌లు కేవలం ఆ తెలుగు వార్తకు ఖచ్చితమైన అనువాదం మాత్రమే!

1. సారాంశం (content / summarizedTeluguContent - STRICTLY 60-70 TELUGU WORDS, ONE PARAGRAPH):
   - కచ్చితంగా 60 నుండి 70 పదాల మధ్య ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్ (No multiple paragraphs, no newlines).
   - వార్త పూర్తి మూల భావం, మాట్లాడిన వారి వాదన, భావోద్వేగం ఏమాత్రం తగ్గకూడదు. స్పష్టమైన ఆపాదింపు తప్పనిసరి.

2. పూర్తి వార్తా కథనం (fullStoryTe - సేఫ్ ఎడిటోరియల్ ఎక్స్‌పాన్షన్ & సమగ్ర కథన నిబంధనలు):
   - ఫ్యాక్ట్స్ భద్రత (Strict Fact Safety - పాత నిబంధన యథాతథం): రిపోర్టర్/మూలంలో ఇచ్చిన పేర్లు, ప్రాంతాలు, హోదాలు, బడ్జెట్ గణాంకాలను యథాతథంగా కాపాడాలి. కల్పిత లెక్కలు, తప్పుడు పేర్లను ఎట్టి పరిస్థితుల్లోనూ సృష్టించరాదు (NO FAKE FACTS / ZERO HALLUCINATIONS).
   - సురక్షిత నేపథ్య విస్తరణ (Safe Background & Contextual Expansion - నూతన మార్గదర్శకం):
     * రిపోర్టర్ ఇచ్చిన ప్రాథమిక సమాచారం క్లుప్తంగా (ఉదా: 40-70 పదాలు) ఉన్నప్పటికీ, ఆ అంశానికి సంబంధించి నమ్మకమైన సామాజిక నేపథ్యం, లక్ష్యం, ప్రజలకు కలిగే మేలు, సాధారణ అవగాహన (Background, Goal & Public Awareness context) జోడించి సీనియర్ ఎడిటర్ శైలిలో కనీసం 180 నుండి 240 పదాల సమగ్ర కథనంగా 3 నుండి 4 విడివిడి పేరాగ్రాఫ్‌లలో (\\n\\n తో) విస్తరించాలి.
     * ఉదాహరణ (వైద్య శిబిరం / హెల్త్ క్యాంప్): ప్రాథమిక ఆరోగ్య కేంద్రాల (PHC) ద్వారా ప్రభుత్వం అందిస్తున్న సేవల నేపథ్యం, రక్తపోటు, మధుమేహం వంటి వ్యాధులను తొలిదశలోనే గుర్తించకపోతే ఎదురయ్యే ఆరోగ్య ముప్పులు, ఉచిత మందులు-కౌన్సిలింగ్ వల్ల గ్రామీణ పేదలకు కలిగే ఊరటపై ఒక ప్రత్యేక విశ్లేషణాత్మక పేరా రాయాలి.
     * ఉదాహరణ (సీఎంఆర్‌ఎఫ్ / సంక్షేమం): అత్యవసర శస్త్రచికిత్సలు, కార్పొరేట్ ఆసుపత్రుల వైద్య ఖర్చుల భారాన్ని తగ్గించడంలో సీఎం రిలీఫ్ ఫండ్ ఎలా కొండంత అండగా నిలుస్తుందో, నిరుపేద కుటుంబాలకు అందుతున్న సాంత్వనను వివరిస్తూ సమగ్ర కథనంగా తీర్చిదిద్దాలి.
     * ఉదాహరణ (వ్యవసాయం / తాగునీరు / రోడ్లు): ప్రస్తుత సీజన్ ప్రాముఖ్యత, రైతులకు/ప్రజలకు సకాలంలో అందాల్సిన ప్రయోజనం, గతంలో ఎదురైన ఇబ్బందుల నేపథ్యాన్ని వాస్తవికంగా వివరించాలి.
   - ఒకవేళ మూల సమాచారం మరీ స్వల్పమై ఉండి (ఉదా: కేవలం 15-20 పదాల ప్రకటన లేదా పుట్టినరోజు శుభాకాంక్షలు వంటివి) ఎటువంటి నేపథ్య విశ్లేషణకు అవకాశం లేకపోతే మాత్రమే fullStoryTe: "" (పూర్తి ఖాళీ స్ట్రింగ్) మరియు fullStoryEn: "" గా ఉంచాలి.
   - 3 నుండి 4 విడివిడి పేరాగ్రాఫ్‌లు (\\n\\n తో):
     * ❌ ఒకే ముద్దగా (single clump) రాయరాదు!
     * 1వ పేరా: హుక్ & మూల సంఘటన, మాట్లాడిన వ్యక్తికి స్పష్టమైన ఆపాదింపు (~60-70 పదాలు).
     * 2వ పేరా: నేపథ్యం, సంఖ్యలు, హాజరైన వారి వివరాలు, కార్యక్రమ విశేషాలు (~60-80 పదాలు).
     * 3వ పేరా: 360° సమతుల్యత / సామాజిక ఆవశ్యకత & ప్రజా ప్రయోజన సమగ్ర విశ్లేషణ (~60-70 పదాలు).
     * 4వ పేరా: తాజా పరిస్థితి & అధికారులు/ప్రభుత్వం చేపట్టిన తదుపరి చర్యలు (~40-50 పదాలు).

3. 🌟 ఆసక్తికర ప్రారంభం & నాన్‌-బోరింగ్ హుక్ (IMPACT-FIRST READER ENGAGEMENT):
   - రొటీన్, యాంత్రికమైన బోరింగ్ ప్రారంభాలు పూర్తిగా నిషిద్ధం! (ఉదా: "ఫలానా చోట సమావేశం జరిగింది", "ఫలానా నేత మాట్లాడారు", "ఫలానా విషయాన్ని వెల్లడించారు" అని నీరసంగా మొదలుపెట్టరాదు).
   - ప్రారంభ వాక్యమే పాఠకుడిని కట్టిపడేసేలా (Gripping Hook) అసలు ఏమి జరిగింది? ప్రజలపై దాని ప్రభావం ఏమిటి? ఆ ప్రకటన వెనుక ఉన్న తీవ్ర సంచలనం లేదా వివాదం ఏమిటి? అనే కీలక అంశంతో సూటిగా ప్రారంభం కావాలి.

4. ⚖️ 360° సమతుల్యత & అందరి వాయిస్ (MULTI-VOICE BALANCE & STRICT NEUTRALITY):
   - ఆల్ఫా న్యూస్ నిష్పాక్షిక వార్తా సంస్థ. మన ఛానెల్ ఎవరి పక్షానా నిలబడదు. ఏ ఒక్క పక్షం ప్రచారానికో లేదా ఏకపక్ష ఆరోపణలకో పరిమితం కాకుండా అందరి గొంతులనూ (All Voices) నిష్పాక్షికంగా వినిపించాలి.
   - ఒక నాయకుడు లేదా పార్టీ ప్రత్యర్థులపై తీవ్ర ఆరోపణలు, విమర్శలు చేసినప్పుడు కేవలం ఆ ఒక్కరి వాదననే పరమ సత్యంగా చూపించరాదు.
   - 3వ పేరాలో తప్పనిసరిగా ఎదుటి పక్షం/ప్రతిపక్షం యొక్క వివరణ, వారి సమర్థన లేదా ప్రభుత్వం/అధికారుల వివరణను చేర్చి సమతుల్యతను తీసుకురావాలి.
   - ప్రభుత్వ పథకాలు/నిర్ణయాలైతే ప్రభుత్వం ప్రకటించిన లబ్ధితో పాటు, క్షేత్రస్థాయిలో ప్రజలు ఎదుర్కొంటున్న సవాళ్లు లేదా ప్రతిపక్షాల విమర్శలను సమతుల్యంగా ప్రస్తావించాలి. రెండు వైపులా ఉన్న వాదనలను నిష్పాక్షికంగా పాఠకుడి ముందు ఉంచాలి.

4.1 🛡️ మీడియా మాఫియా పక్షపాత రక్షణ కవచం & హార్డ్ రికార్డులు (PARTISAN MEDIA BIAS SHIELD & HARD DATA ONLY):
   - తెలుగు రాష్ట్రాల్లోని ప్రధాన మీడియా వర్గాలు (ఈనాడు, ఆంధ్రజ్యోతి/ABN, టీవీ5, సాక్షి మొదలైనవి) తీవ్ర రాజకీయ పక్షపాతంతో, ఒక వర్గానికి అనుకూలంగా కథనాలను పదేపదే ప్రచారం చేస్తాయి.
   - గూగుల్ సెర్చ్ లేదా ఇంటర్నెట్‌లో ఒక పక్షం ఆరోపణలు ఎన్ని వేల వెబ్‌సైట్లలో కనిపించినా, వాటిని నిర్ధారిత సత్యాలుగా (Established Facts) భావించరాదు!
   - హార్డ్ రికార్డులు మాత్రమే ఫ్యాక్ట్స్: ప్రభుత్వ జీవోలు (GOs), గెజిట్లు, బడ్జెట్ అంకెలు, కోర్టు ఆదేశాలు, ఈడీ/సిట్ ఎఫ్‌ఐఆర్ కాపీలు, ఎన్నికల సంఘం ఉత్తర్వులను మాత్రమే వాస్తవాలుగా పరిగణించాలి.
   - పక్షపాత విశేషణాల బహిష్కరణ: "చరిత్రలోనే అతిపెద్ద స్కామ్", "ప్రజాగ్రహం కట్టలు తెంచుకుంది", "కుదేలైన సర్కార్", "నిలువునా ముంచేశారు" వంటి రాజకీయ అజెండా విశేషణాలను కథనంలో వాడరాదు.
   - ద్వైపాక్షిక సమతుల్యత: మీడియాలో ఒక వర్గం ఆరోపణ ఎంత బలంగా ఉన్నా, 3వ పేరాలో తప్పనిసరిగా ఎదుటి పక్షం/ప్రభుత్వం/బాధితుల వివరణను లేదా కౌంటర్ వాదనను సమాన ప్రాధాన్యతతో చేర్చాలి. ఆల్ఫా న్యూస్ ఎవరికీ క్లీన్ చిట్ ఇవ్వదు, ఎవరినీ దోషిగా తేల్చదు.

5. 🔥 వార్తా రస రక్షణ & భావోద్వేగ తీవ్రత (TONE & EMOTIONAL INTENSITY FIDELITY):
   - వార్తలోని వాస్తవ రసాన్ని, తీవ్రతను, మూల భావోద్వేగాన్ని (Tone & Intensity) యథాతథంగా కాపాడాలి. వార్తను చప్పగా లేదా నిర్జీవంగా మార్చరాదు.
   - రాజకీయ సవాళ్లు/పోరాటాల్లో ఆ వాడి, వేడి, ఘాటు అలాగే ఉండాలి.
   - రైతుల కష్టాలు, పేదల ఆవేదన, బాధితుల గోడులో కరుణ రసం, వారి గుండెకోత, కన్నీటి వ్యథ ప్రతిధ్వనించాలి.
   - ప్రమాదాలు, ప్రకృతి విపత్తుల్లో గంభీరమైన వాస్తవికత, ప్రాణనష్టం, క్షతగాత్రుల పరిస్థితి తీవ్రతను నిక్కచ్చిగా తెలపాలి.
   - అవినీతి, మోసాలు, నేరాల్లో పదునైన పరిశోధనా శైలి ఉండాలి.

6. ⚡ సజీవ జర్నలిస్టిక్ క్రియా పదాలు (DYNAMIC ACTION VERBS - BAN MONOTONY):
   - ప్రతి వాక్యానికీ "అన్నారు... తెలిపారు... పేర్కొన్నారు" వంటి రొటీన్, యాంత్రిక క్రియా పదాలను పదేపదే వాడటం పూర్తిగా నిషిద్ధం!
   - సందర్భానికి తగిన శక్తివంతమైన తెలుగు క్రియా పదాలను వాడాలి:
     * ఘాటైన ఆరోపణలు/పోరాటం: "ధ్వజమెత్తారు", "నిలదీశారు", "తీవ్రస్థాయిలో విరుచుకుపడ్డారు", "మండిపడ్డారు", "ఆగ్రహం వ్యక్తం చేశారు".
     * కరాఖండి నిర్ణయాలు/హెచ్చరికలు: "తేల్చిచెప్పారు", "హెచ్చరించారు", "స్పష్టం చేశారు", "సవాల్ విసిరారు", "ఖరాఖండీగా ప్రకటించారు".
     * రైతాంగం/బాధితుల వేదన: "ఆవేదన వ్యక్తం చేశారు", "కన్నీటిపర్యంతమయ్యారు", "గోడు వెళ్లబోసుకున్నారు", "వాపోయారు".
     * అధికారిక వివరణలు/రక్షణ: "స్పందించారు", "వివరణ ఇచ్చారు", "సమర్థించుకున్నారు", "స్పష్టతనిచ్చారు", "హామీ ఇచ్చారు".

7. ⚠️ ఆపాదింపు నిబంధన - కథనం బాడీలోనే తప్పనిసరి (MANDATORY ATTRIBUTION IN BODY - ZERO EDITORIAL VERDICTS) ⚠️:
   - ఆల్ఫా న్యూస్ నిష్పాక్షిక వార్తా సంస్థ. ఏ రాజకీయ నాయకుడిపై ప్రశంసలను గానీ, విమర్శలను గానీ మన ఛానెల్ స్వయంగా ఇచ్చినట్లు, ధ్రువీకరించినట్లు లేదా తీర్పు ఇచ్చినట్లు ఎప్పుడూ రాయరాదు!
   - ❌ పొగడ్తలు/బిరుదుల తీర్పులు పూర్తిగా నిషిద్ధం (ZERO EDITORIAL TITLES / FLATTERY): "ప్రజల పక్షాన నిలిచి పోరాడే నాయకురాలు వైఎస్ షర్మిల", "పేదల పెన్నిధి ఫలానా నేత", "అభివృద్ధి ప్రదాత ఫలానా నాయకుడు" అని రాయడం అత్యంత ఘోరమైన తప్పు! మన ఛానెల్ ఎవరికీ 'ప్రజల నాయకుడు/నాయకురాలు' అనే బిరుదులు ఇవ్వదు, సర్టిఫై చేయదు.
   - ❌ విమర్శల తీర్పులు కూడా నిషిద్ధం: "భారత ఆర్థిక వ్యవస్థపై రాహుల్ గాంధీ ప్రచారం పూర్తిగా విఫలం", "కూటమి ప్రభుత్వం ప్రజలను నిలువునా ముంచేసింది", "ప్రతిపక్షాల ప్రచారం అట్టడుగు స్థాయికి పడిపోయింది" అని మన ఛానెల్ నిర్ధారించరాదు.
   - ✅ తప్పనిసరి ఆపాదింపు కథనం బాడీ (Content) మొదటి వాక్యంలో: మాట్లాడిన వారి పేరు, పదవి లేదా పోస్ట్ రచయిత (Post Author) వివరాలు కథనం (content / summarizedTeluguContent) లోని మొదటి వాక్యంగా తప్పనిసరిగా ఉండాలి (ఉదా: "...అని ముఖ్యమంత్రి చంద్రబాబు నాయుడు వెల్లడించారు", "...అంటూ కాంగ్రెస్ అగ్రనేత రాహుల్ గాంధీ ధ్వజమెత్తారు").
   - ⚠️ హెడ్‌లైన్‌లో ఆపాదింపు నిబంధన (NO FORCED ATTRIBUTION IN HEADLINES):
     * ప్రభుత్వ పథకాలు, ప్రాజెక్టులు, బడ్జెట్, రోడ్లు, ఉద్యోగాలు, ఫలితాలు, నేరాలు, ప్రమాదాలు, విపత్తులు, అధికారుల ఏర్పాట్ల వార్తలకు హెడ్‌లైన్‌లో వ్యక్తుల పేర్లు, ఆపాదింపులు ("...అన్న సీఎం", "...తెలిపిన కలెక్టర్", "...పేర్కొన్న ఎస్పీ") పూర్తిగా అనవసరం, నిషిద్ధం! ప్రధాన సంఘటన, చర్య లేదా ప్రభావం మాత్రమే శీర్షికలో రావాలి.
     * రాజకీయ విమర్శలు, సవాళ్ల వార్తలకైతే నాయకుడి పేరు కర్తగా ఉండి నేరుగా క్రియా పదంతో ముగియాలి (ఉదా: "కేంద్ర ఎన్నికల సంఘం నిర్ణయంపై రాహుల్ గాంధీ నిప్పులు"). పాసివ్ ముగింపులు ("...విమర్శించిన రాహుల్ గాంధీ", "...రాహుల్ గాంధీ విమర్శలు") నిషిద్ధం!
   - ⚠️ వ్యక్తుల మార్పిడి నిషిద్ధం (PERSON ATTRIBUTION SWAP - STRICTLY FORBIDDEN): పోస్ట్/వార్తలో ఒకరి గురించి రాస్తూ మరొకరు చెప్పిన మాటలను మొదటి వ్యక్తికి ఆపాదించరాదు.
   - ⚠️ సోషల్ మీడియా / ట్విట్టర్ అకౌంట్ ఆపాదింపు: పోస్ట్ రాసిన వారి (Post Author) పూర్తి క్రెడిట్ వార్తా సారాంశం (content) లోని మొదటి వాక్యంలో తప్పక ఇవ్వాలి.
   - G (HARD NUMBERS & FACTS PRESERVATION): ఇన్‌పుట్‌లోని ప్రతి సంఖ్య, బడ్జెట్ అంకె (రూ. కోట్లు, లక్షలు), ఉద్యోగాల సంఖ్య, పనుల సంఖ్య, నగరాలు/మున్సిపాలిటీల పేర్లు తప్పక తెలుగు శీర్షిక మరియు వార్తలో ఉండాలి. అంకెలను వదిలేసి "పలు అభివృద్ధి పనులు" అని రాయరాదు!

8. 🏆 అత్యున్నత ప్రాధాన్యత: సందర్భానుసార శీర్షిక & పంచ్ డైలాగ్ నిబంధన (CONTEXT-AWARE HEADLINES & PUNCH DIALOGUE - ABSOLUTE FIRST PRIORITY):
   హెడ్‌లైన్ చదివేటప్పుడు ఎక్కడా బ్రేక్ లేకుండా, మొదటి పదం నుండి చివరి పదం వరకు ఒకే తాటిపై నడిచే స్వచ్ఛమైన ఏక వాక్యంగా (Single Unbroken Flow) ఉండాలి. వార్తలోని మూల స్వభావానికి (Context) తగినట్లుగా శీర్షిక ఉండాలి:

   ఎ. సందర్భానుసార శీర్షిక (Context-Aware Headlines):

   1. రాజకీయ విమర్శలు, సవాళ్లు, ఆరోపణలు (POLITICAL CHARGES & CLASHES):
      - ఘాటైన పంచ్ డైలాగ్ + స్పష్టమైన ఆపాదింపు (Attribution) ఉండాలి.
      - మాట్లాడిన వారి ప్రసంగం లేదా ప్రకటనలోని అత్యంత పదునైన, ఘాటైన పంచ్ డైలాగ్‌ను / ప్రధాన ఆరోపణనే హెడ్‌లైన్‌లో ప్రధాన భాగంగా తీసుకోవాలి!
      - చప్పని పదాలు ("సమీక్ష", "స్పందన", "సమావేశం", "విమర్శలు", "ప్రకటన") పూర్తిగా నిషిద్ధం!
      - వాక్య నిర్మాణం: [ఘాటైన పంచ్ డైలాగ్ / ఆరోపణ సారాంశం] అంటూ/అని [ఎవరిపై] [నాయకుడి పేరు] [తీవ్ర ఆగ్రహం / ధ్వజం / సవాల్ / నిప్పులు].
      - ఉదాహరణ: "ప్రజలను దగా చేశారంటూ కూటమి సర్కార్పై జగన్ తీవ్ర ఆగ్రహం" (8 పదాలు)
      - ఉదాహరణ: "అక్రమ కేసులతో బెదిరించలేరంటూ కాంగ్రెస్ సర్కార్‌కు కేటీఆర్ సవాల్" (7 పదాలు)
      - ఉదాహరణ: "కేంద్ర ఎన్నికల సంఘం నిర్ణయంపై రాహుల్ గాంధీ నిప్పులు" (7 పదాలు)

   2. రైతాంగ వ్యథ, పేదల ఆవేదన, ప్రజా సమస్యలు (FARMERS, POOR & PUBLIC AGONY):
      - హృదయాన్ని కదిలించే కరుణ రసం, రూపకాలు ఉండాలి.
      - ఉదాహరణ: "ఆశల పందిరి కూలి కన్నీటి సంద్రమైన అన్నదాత బతుకు చిత్రం" (8 పదాలు)
      - ఉదాహరణ: "గిట్టుబాటు ధర లేక పంటను రోడ్డుపై పారబోసిన మిర్చి రైతులు" (8 పదాలు)

   3. ప్రమాదాలు, విషాదాలు, విపత్తులు (ACCIDENTS, TRAGEDIES & DISASTERS):
      - గంభీరమైన, వాస్తవికతతో కూడిన శైలి (కవిత్వాలు, పంచ్లు లేకుండా).
      - ఉదాహరణ: "నెత్తురోడిన జాతీయ రహదారిపై లారీ ఢీకొని నలుగురు దుర్మరణం" (7 పదాలు)
      - ఉదాహరణ: "కొండచరియలు విరిగిపడి సీలేరు రహదారిలో స్తంభించిన రాకపోకలు" (7 పదాలు)
      - ఉదాహరణ: "వరద ఉధృతిలో కొట్టుకుపోయిన కారుతో ఇద్దరు గల్లంతు" (6 పదాలు)

   4. ప్రభుత్వ పథకాలు, అభివృద్ధి పనులు, శుభవార్తలు (GOVT SCHEMES & DEVELOPMENT):
      - ఉత్తేజభరితమైన, ప్రజలకు కలిగే ప్రత్యక్ష ప్రయోజనాన్ని సూటిగా తెలిపే శైలి (వ్యక్తుల ఆపాదింపు లేకుండా).
      - ఉదాహరణ: "రైతుల ఖాతాల్లోకి నేడే రైతు భరోసా నిధుల జమ" (7 పదాలు)
      - ఉదాహరణ: "రాయలసీమలో లక్ష కోట్లతో మెగా హార్టికల్చర్ హబ్" (7 పదాలు)
      - ఉదాహరణ: "రాష్ట్రంలో పదివేల ఉపాధ్యాయ పోస్టుల భర్తీకి గ్రీన్ సిగ్నల్" (7 పదాలు)

   5. నేరాలు, దోపిడీలు, పోలీస్ దాడులు (CRIMES & POLICE RAIDS):
      - పదునైన క్రైమ్ రిపోర్టింగ్.
      - ఉదాహరణ: "సికింద్రాబాద్‌లో సినీ ఫక్కీలో భారీ దోపిడీ.. అంతర్రాష్ట్ర ముఠా అరెస్ట్" (లేదా "సికింద్రాబాద్‌లో సినీ ఫక్కీలో భారీ దోపిడీకి పాల్పడ్డ ముఠా అరెస్ట్")

   - సార్వత్రిక నిబంధనలు (UNIVERSAL RULES FOR ALL HEADLINES):
      1. ఖచ్చితంగా 6 నుండి 8 పదాలు మాత్రమే (STRICTLY 6 TO 8 WORDS, COMPACT & CRISP).
      2. ఒకే ఒక్క నిరంతర సంపూర్ణ వాక్యం (STRICTLY ONE CONTINUOUS SENTENCE) - కొటేషన్లు ('...', "..."), కోలన్లు (:) పూర్తిగా నిషిద్ధం! ఎక్కడా రెండు ముక్కలుగా విరగ్గొట్టరాదు.
      3. 🛑 చప్పని నామవాచక ముగింపులు మరియు పాసివ్ శైలి పూర్తిగా నిషిద్ధం:
         - వాక్యం చివర '...విమర్శలు', '...ప్రకటన', '...నిలిపివేత', '...సమీక్ష', '...స్పందన', '...వేడుకలు', '...పర్యటన' వంటి చప్పని నామవాచకాలతో లేదా '...చేసిన ఫలానా' వంటి పాసివ్ ముగింపులతో ఎట్టిపరిస్థితుల్లోనూ ముగించరాదు!
         - సజీవమైన ప్రభావం లేదా కార్యాచరణను తెలిపే పదాలతో మాత్రమే ముగియాలి.

9. స్వచ్ఛమైన తెలుగు లిపి (NO FOREIGN SCRIPTS): కన్నడ, హిందీ/దేవనాగరి లిపి అక్షరాలు రాకూడదు. 100% తెలుగు లిపి వాడాలి.
10. ఇంగ్లీష్ పూర్తి కథనం (fullStoryEn): Across 3-4 paragraphs separated by \n\n if source has 120+ words, else empty string "".

11. 🛑 ఎడిటోరియల్ తిరస్కరణ నిబంధనలు (EDITORIAL REJECTIONS - isNewsFound: false):
   - స్వీయ ప్రచారం, భజన, సొంత డబ్బా, నాయకుల పొగడ్తలు, పీఆర్ రీల్స్ (SELF-PRAISE, LEADER GLORIFICATION & PARTY SYCOPHANCY):
     * ఒక పార్టీ లేదా నాయకుడు తమని తాము లేదా తమ అధినేతను పొగుడుకుంటూ వేసిన పోస్టులు/ట్వీట్లు/వీడియోలు (ఉదా: "ప్రజల కోసం ప్రశ్నించే గొంతు... ప్రజా సమస్యల కోసం పోరాడే నిబద్ధత... వైఎస్ షర్మిల రెడ్డి గారు — ప్రజల పక్షాన నిలిచే నాయకత్వం", "మా నాయకుడే మా భవిష్యత్తు", "పేదల ఆశాజ్యోతి ఫలానా నేత", ర్యాలీ విజువల్స్ పీఆర్ రీల్స్, పార్టీ గీతాలు, ప్రచార నినాదాలు).
     * ఇటువంటి పోస్టులలో కొత్త ప్రభుత్వ నిర్ణయం, కొత్త పథకం, బడ్జెట్ లేదా పాలసీ సమాచారం ఏమీ ఉండదు. కేవలం సొంత భజన మాత్రమే. దీనిలో ప్రజలకు ఎలాంటి ఉపయోగం (Public Utility) గానీ, వార్తా ఆసక్తి (Public Interest) గానీ లేవు. అసలు దీనిని వార్తాంశంగా స్వీకరించాల్సిన పనేలేదు! ఖచ్చితంగా తిరస్కరించాలి (isNewsFound: false).
   - 🛑 రొటీన్ ఫోటో-ఆప్స్, సాధారణ సమీక్షలు, పుస్తక/పోస్టర్ ఆవిష్కరణలు (ROUTINE PHOTO-OPS & CASUAL MEETINGS - ZERO NEWS VALUE):
     * ప్రజా ప్రయోజనం, కొత్త పాలసీ నిర్ణయం లేదా బడ్జెట్ కేటాయింపులు ఏమీ లేకుండా కేవలం కలెక్టర్ లేదా ప్రజాప్రతినిధి ఒక పోస్టర్‌ను ఆవిష్కరించడం (ఉదా: "వయోవృద్ధుల దినోత్సవ పోస్టర్ ఆవిష్కరణ"), సాధారణ పరిచయ సమీక్ష నిర్వహించడం, పుష్పగుచ్ఛాలు ఇవ్వడం, కేవలం జ్యోతి ప్రజ్వలనలు వంటివి వార్తలు కావు! ఖచ్చితంగా తిరస్కరించాలి (isNewsFound: false).
   - అసభ్యకరమైన బూతులు, వ్యక్తిగత దూషణలు, ఇంటర్నెట్ ట్రోల్ మీమ్స్, కేవలం క్యాజువల్ పుట్టినరోజు శుభాకాంక్షలు (isNewsFound: false).
Output must be strictly JSON format.`;
/**
 * Fetches background context, hard institutional records (GOs, court orders, budget statistics),
 * and counter-perspectives/explanations using Google Search Grounding.
 * Strictly applies the Media Bias Shield to disregard partisan adjectives and media spin.
 */
async function fetchGroundedResearchContext(ai, inputText, category) {
    if (!inputText || inputText.trim().length < 25)
        return "";
    // Skip if it looks like obvious party flattery or casual greeting
    if ((0, utils_1.isEditorialVerdictOrFlattery)("శీర్షిక", inputText))
        return "";
    const researchPrompt = `మీరు ఆల్ఫా న్యూస్ రీసెర్చ్ అసిస్టెంట్.
కింది వార్తాంశం/ఆరోపణకు సంబంధించిన నేపథ్యం (Background), అధికారిక రికార్డులు (GOలు, బడ్జెట్ అంకెలు, కోర్టు/సిట్/ఈడీ ఆదేశాలు), మరియు ముఖ్యంగా "ఎదుటి పక్షం/ప్రతిపక్షం లేదా ఆరోపణలు ఎదుర్కొంటున్న వారు ఇచ్చిన వివరణ/కౌంటర్ ఏమిటి?" అనే విషయాలను గూగుల్ సెర్చ్ ద్వారా క్లుప్తంగా సేకరించండి.

⚠️ పక్షపాత మీడియా రక్షణ నిబంధన (MEDIA BIAS SHIELD):
- తెలుగు మీడియాలో (ఈనాడు, ఆంధ్రజ్యోతి, టీవీ5 లేదా సాక్షి) వచ్చే పక్షపాత రాజకీయ విశేషణాలను (ఉదా: "చరిత్రలోనే అతిపెద్ద దోపిడీ", "ప్రజాగ్రహం", "కుదేలైన సర్కార్") పూర్తిగా విస్మరించండి.
- కేవలం అధికారిక తేదీలు, దాఖలైన కేసులు/పిటిషన్లు, విచారణ కమిటీల వివరాలు మరియు ఇరు వర్గాల అధికారిక వివరణలను మాత్రమే 3-4 వాక్యాల్లో క్లుప్తంగా అందించండి.

వార్తాంశం:
${inputText}`;
    try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Grounding timeout")), 12000));
        const generatePromise = ai.models.generateContent({
            model: PRIMARY_MODEL,
            contents: researchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.2
            }
        });
        const res = await Promise.race([generatePromise, timeoutPromise]);
        const text = res?.text || res?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? text.trim() : "";
    }
    catch (e) {
        console.warn(`[GROUNDING-NOTICE] Grounded search skipped/failed: ${e?.message || e}`);
        return "";
    }
}
const processSocialPostWithAI = async (socialText, platform, category, authorName) => {
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            isNewsFound: { type: genai_1.Type.BOOLEAN },
            headline: { type: genai_1.Type.STRING, description: "Step 1: 100% Pure Telugu headline in 6-8 words, single complete sentence" },
            content: { type: genai_1.Type.STRING, description: "Step 1: 100% Pure Telugu journalistic news story (strictly 60-70 words, single paragraph) created from input regardless of input language" },
            fullStoryTe: { type: genai_1.Type.STRING, description: "Senior editor comprehensive full story in Telugu across 3-4 paragraphs separated by \\n\\n if source has 120+ words, or empty string \"\" if brief" },
            headlineEn: { type: genai_1.Type.STRING, description: "Step 2: English headline translated from Telugu headline (6-8 words)" },
            contentEn: { type: genai_1.Type.STRING, description: "Step 2: English news story translated from the Telugu story (50-60 words)" },
            fullStoryEn: { type: genai_1.Type.STRING, description: "Senior editor full story in English across 3-4 paragraphs separated by \\n\\n if source has 120+ words, or empty string \"\" if brief" },
            category: { type: genai_1.Type.STRING }
        },
        required: ["isNewsFound", "headline", "content", "fullStoryTe", "fullStoryEn", "headlineEn", "contentEn", "category"],
    };
    // Build the user prompt — include Post Author when available so AI can attribute correctly
    const authorLine = authorName ? `Post Author: ${authorName}\n` : "";
    const basePrompt = `Platform: ${platform}\nCategory: ${category}\n${authorLine}Input Text:\n${socialText}`;
    return await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
        // Step 1: Attempt Grounded Research to fetch hard facts and counter-perspective
        const groundedContext = await fetchGroundedResearchContext(ai, socialText, category);
        const userPrompt = groundedContext
            ? `${basePrompt}\n\n[గూగుల్ సెర్చ్ ద్వారా సేకరించిన వాస్తవ రికార్డులు & ఎదుటి పక్షం వివరణ / Grounded Context]:\n${groundedContext}`
            : basePrompt;
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: EDITORIAL_SYSTEM_INSTRUCTION,
                temperature: 0.4,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema,
                max_output_tokens: 4096
            },
        });
        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text)
            return null;
        const parsed = (0, utils_1.parseAIJson)(text);
        if (!parsed || !parsed.isNewsFound)
            return null;
        const cleanedHeadline = (0, utils_1.cleanTeluguHeadline)(parsed.headline);
        if (!cleanedHeadline)
            return null;
        // Check for party flattery / sycophancy or editorial verdict without attribution
        if ((0, utils_1.isEditorialVerdictOrFlattery)(cleanedHeadline, socialText, authorName)) {
            console.log(`[SOCIAL_AI] 🛑 Rejected party flattery / editorial verdict without attribution: "${cleanedHeadline}"`);
            return null;
        }
        let rawContentTe = parsed.content || '';
        let rawContentEn = parsed.contentEn || '';
        // Check if content was swapped or generated in English
        if (!(0, utils_1.isTeluguScript)(rawContentTe) && (0, utils_1.isTeluguScript)(rawContentEn)) {
            const tmp = rawContentTe;
            rawContentTe = rawContentEn;
            rawContentEn = tmp;
        }
        else if (!(0, utils_1.isTeluguScript)(rawContentTe) && parsed.fullStoryTe && (0, utils_1.isTeluguScript)(parsed.fullStoryTe)) {
            rawContentTe = parsed.fullStoryTe.split(/\r?\n\r?\n/)[0].trim();
        }
        const cleanedContent = (0, utils_1.sanitizeTeluguText)(rawContentTe).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const rawStoryTe = parsed.fullStoryTe ? (0, utils_1.sanitizeTeluguText)(parsed.fullStoryTe).trim() : "";
        const storyWordsTe = rawStoryTe ? rawStoryTe.split(/\s+/).filter(Boolean).length : 0;
        const validStoryTe = (storyWordsTe >= 80 && rawStoryTe !== cleanedContent) ? (0, utils_1.formatIntoParagraphs)(rawStoryTe) : "";
        const rawStoryEn = parsed.fullStoryEn ? String(parsed.fullStoryEn).trim() : "";
        const storyWordsEn = rawStoryEn ? rawStoryEn.split(/\s+/).filter(Boolean).length : 0;
        const validStoryEn = (storyWordsEn >= 80 && rawStoryEn !== (parsed.contentEn || "")) ? (0, utils_1.formatIntoParagraphs)(rawStoryEn) : "";
        return {
            ...parsed,
            headline: cleanedHeadline,
            content: cleanedContent,
            fullStoryTe: validStoryTe,
            fullStoryEn: validStoryEn
        };
    });
};
exports.processSocialPostWithAI = processSocialPostWithAI;
const processCitizenContentWithAI = async (rawContent) => {
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            success: { type: genai_1.Type.BOOLEAN },
            reason: { type: genai_1.Type.STRING },
            processed: {
                type: genai_1.Type.OBJECT,
                properties: {
                    headline: { type: genai_1.Type.STRING },
                    content: { type: genai_1.Type.STRING },
                    fullStoryTe: { type: genai_1.Type.STRING, description: "Senior editor comprehensive full story in Telugu across 3-4 paragraphs separated by \\n\\n if source has 120+ words, or empty string \"\" if brief" },
                    headlineEn: { type: genai_1.Type.STRING },
                    contentEn: { type: genai_1.Type.STRING },
                    fullStoryEn: { type: genai_1.Type.STRING, description: "Senior editor full story in English across 3-4 paragraphs separated by \\n\\n if source has 120+ words, or empty string \"\" if brief" },
                    category: { type: genai_1.Type.STRING }
                },
                required: ["headline", "content", "fullStoryTe", "fullStoryEn", "headlineEn", "contentEn", "category"]
            }
        },
        required: ["success"],
    };
    return await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
        // Step 1: Attempt Grounded Research Context if applicable
        const groundedContext = await fetchGroundedResearchContext(ai, rawContent);
        const userPrompt = `Citizen Submission:\n${rawContent}` +
            (groundedContext ? `\n\n[గూగుల్ సెర్చ్ ద్వారా సేకరించిన వాస్తవ రికార్డులు & ఎదుటి పక్షం వివరణ / Grounded Context]:\n${groundedContext}` : '');
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: EDITORIAL_SYSTEM_INSTRUCTION,
                temperature: 0.4,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema,
                max_output_tokens: 4096
            }
        });
        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text)
            throw new Error("Empty AI response");
        const parsed = (0, utils_1.parseAIJson)(text);
        if (parsed && parsed.processed) {
            const cleanedHeadline = (0, utils_1.cleanTeluguHeadline)(parsed.processed.headline);
            if ((0, utils_1.isEditorialVerdictOrFlattery)(cleanedHeadline, rawContent)) {
                return { success: false, reason: "Rejected party flattery / sycophancy without news value" };
            }
            const cleanContent = (0, utils_1.sanitizeTeluguText)(parsed.processed.content).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
            const rawStoryTe = parsed.processed.fullStoryTe ? (0, utils_1.sanitizeTeluguText)(parsed.processed.fullStoryTe).trim() : "";
            const storyWordsTe = rawStoryTe ? rawStoryTe.split(/\s+/).filter(Boolean).length : 0;
            const validStoryTe = (storyWordsTe >= 80 && rawStoryTe !== cleanContent) ? (0, utils_1.formatIntoParagraphs)(rawStoryTe) : "";
            const rawStoryEn = parsed.processed.fullStoryEn ? String(parsed.processed.fullStoryEn).trim() : "";
            const storyWordsEn = rawStoryEn ? rawStoryEn.split(/\s+/).filter(Boolean).length : 0;
            const validStoryEn = (storyWordsEn >= 80 && rawStoryEn !== (parsed.processed.contentEn || "")) ? (0, utils_1.formatIntoParagraphs)(rawStoryEn) : "";
            parsed.processed.headline = cleanedHeadline;
            parsed.processed.content = cleanContent;
            parsed.processed.fullStoryTe = validStoryTe;
            parsed.processed.fullStoryEn = validStoryEn;
        }
        return parsed;
    });
};
exports.processCitizenContentWithAI = processCitizenContentWithAI;
const processContentWithAI = async (rawContent, rawHeadline) => {
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            summarizedTeluguContent: { type: genai_1.Type.STRING },
            generatedTeluguHeadline: { type: genai_1.Type.STRING },
            fullStoryTe: { type: genai_1.Type.STRING, description: "Senior editor comprehensive full story in Telugu across 3-4 paragraphs separated by \\n\\n if source has 120+ words, or empty string \"\" if brief" },
            englishHeadline: { type: genai_1.Type.STRING },
            englishContent: { type: genai_1.Type.STRING },
            fullStoryEn: { type: genai_1.Type.STRING, description: "Senior editor full story in English across 3-4 paragraphs separated by \\n\\n if source has 120+ words, or empty string \"\" if brief" },
        },
        required: ["summarizedTeluguContent", "generatedTeluguHeadline", "fullStoryTe", "fullStoryEn", "englishHeadline", "englishContent"],
    };
    return await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
        // Step 1: Attempt Grounded Research Context
        const fullInput = `${rawHeadline || ''} ${rawContent}`.trim();
        const groundedContext = await fetchGroundedResearchContext(ai, fullInput);
        const userPrompt = `Headline: ${rawHeadline || 'N/A'}\nContent: ${rawContent}` +
            (groundedContext ? `\n\n[గూగుల్ సెర్చ్ ద్వారా సేకరించిన వాస్తవ రికార్డులు & ఎదుటి పక్షం వివరణ / Grounded Context]:\n${groundedContext}` : '');
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: EDITORIAL_SYSTEM_INSTRUCTION,
                temperature: 0.4,
                maxOutputTokens: 4096,
                responseMimeType: "application/json",
                responseSchema: schema,
                max_output_tokens: 4096
            }
        });
        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text)
            throw new Error("Empty AI response");
        const parsed = (0, utils_1.parseAIJson)(text);
        const cleanContent = (0, utils_1.sanitizeTeluguText)(parsed.summarizedTeluguContent).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
        const rawStoryTe = parsed.fullStoryTe ? (0, utils_1.sanitizeTeluguText)(parsed.fullStoryTe).trim() : "";
        const storyWordsTe = rawStoryTe ? rawStoryTe.split(/\s+/).filter(Boolean).length : 0;
        const validStoryTe = (storyWordsTe >= 80 && rawStoryTe !== cleanContent) ? (0, utils_1.formatIntoParagraphs)(rawStoryTe) : "";
        const rawStoryEn = parsed.fullStoryEn ? String(parsed.fullStoryEn).trim() : "";
        const storyWordsEn = rawStoryEn ? rawStoryEn.split(/\s+/).filter(Boolean).length : 0;
        const validStoryEn = (storyWordsEn >= 80 && rawStoryEn !== (parsed.englishContent || "")) ? (0, utils_1.formatIntoParagraphs)(rawStoryEn) : "";
        return {
            ...parsed,
            generatedTeluguHeadline: (0, utils_1.cleanTeluguHeadline)(parsed.generatedTeluguHeadline),
            summarizedTeluguContent: cleanContent,
            fullStoryTe: validStoryTe,
            fullStoryEn: validStoryEn
        };
    });
};
exports.processContentWithAI = processContentWithAI;
const processProductWithAI = async (productInfo) => {
    const schema = {
        type: genai_1.Type.OBJECT,
        properties: {
            headline: { type: genai_1.Type.STRING },
            content: { type: genai_1.Type.STRING },
            headlineEn: { type: genai_1.Type.STRING },
            contentEn: { type: genai_1.Type.STRING },
            category: { type: genai_1.Type.STRING }
        },
        required: ["headline", "content", "headlineEn", "contentEn", "category"],
    };
    return await (0, utils_1.runWithAIFallback)(async (ai, modelName) => {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: "user", parts: [{ text: `Product Info:\n${productInfo}` }] }],
            config: {
                systemInstruction: `You are a Tech & Lifestyle Reporter.
            1. Convert the provided product information into an exciting news story in Telugu (content) of STRICTLY 50 to 60 words total. Focus on the value, features, or a massive discount.
            2. Write a professional news paragraph in English (contentEn) maximum 50 words.
            3. Generate an eye-catching Telugu headline (headline) maximum 10 words.
            4. Generate a professional English headline (headlineEn) maximum 12 words.
            5. Categorize this as 'Gadgets', 'Fashion', or 'Lifestyle'.
            Output JSON only.`,
                temperature: 0.5,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
                responseSchema: schema,
                // Safety
                system_instruction: `You are a Tech & Lifestyle Reporter. ...`,
                max_output_tokens: 2048
            }
        });
        const text = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text)
            throw new Error("Empty AI response");
        return (0, utils_1.parseAIJson)(text);
    });
};
exports.processProductWithAI = processProductWithAI;
