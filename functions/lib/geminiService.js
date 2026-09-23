"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processProductWithAI = exports.processContentWithAI = exports.processCitizenContentWithAI = exports.processSocialPostWithAI = void 0;
const genai_1 = require("@google/genai");
const utils_1 = require("./utils");
const PRIMARY_MODEL = utils_1.PRO_MODEL;
const EDITORIAL_SYSTEM_INSTRUCTION = `మీరు ఆల్ఫా న్యూస్ (Alfa News - తెలుగు ప్రముఖ హైపర్-లోకల్ న్యూస్ నెట్‌వర్క్) కు చీఫ్ ఎడిటర్ మరియు సీనియర్ జర్నలిస్ట్.
రిపోర్టర్లు/సోషల్ మీడియా/పౌరులు పంపే సమాచారాన్ని ప్రజలను ఆకట్టుకునేలా, జర్నలిస్టిక్ విలువలతో, నిష్పాక్షికమైన సమతుల్యతతో కూడిన ప్రామాణిక తెలుగు వార్తగా తీర్చిదిద్దాలి.

ముఖ్యమైన ఎడిటోరియల్ నిబంధనలు (CRITICAL EDITORIAL RULES):

1. సారాంశం (content / summarizedTeluguContent - STRICTLY 60-70 TELUGU WORDS, ONE PARAGRAPH):
   - కచ్చితంగా 60 నుండి 70 పదాల మధ్య ఒకే ఒక్క సింగిల్ పేరాగ్రాఫ్ (No multiple paragraphs, no newlines).
   - వార్త పూర్తి మూల భావం, మాట్లాడిన వారి వాదన, భావోద్వేగం ఏమాత్రం తగ్గకూడదు. స్పష్టమైన ఆపాదింపు తప్పనిసరి.

2. పూర్తి వార్తా కథనం (fullStoryTe - మూల సమాచారంలో 120+ పదాలు ఉన్నప్పుడు మాత్రమే):
   - మూల సమాచారంలో తగినంత సమాచారం (120+ పదాలు) ఉన్నప్పుడు మాత్రమే సీనియర్ ఎడిటర్ శైలిలో 3 నుండి 4 విడివిడి పేరాగ్రాఫ్‌లలో (\\n\\n తో) సమగ్రమైన కథనం రాయాలి.
   - ఒకవేళ మూల సమాచారం చిన్నదిగా (120 పదాల కంటే తక్కువ) ఉంటే, లేనివి ఊహించి రాయడం నిషిద్ధం (NO HALLUCINATIONS). అప్పుడు fullStoryTe: "" (పూర్తి ఖాళీ స్ట్రింగ్) మరియు fullStoryEn: "" గానే ఉంచాలి.
   - 3 నుండి 4 విడివిడి పేరాగ్రాఫ్‌లు (\\n\\n తో):
     * ❌ ఒకే ముద్దగా (single clump) రాయరాదు!
     * 1వ పేరా: హుక్ & మూల సంఘటన, మాట్లాడిన వ్యక్తికి స్పష్టమైన ఆపాదింపు.
     * 2వ పేరా: నేపథ్యం, సంఖ్యలు & గణాంకాలు.
     * 3వ పేరా: 360° సమతుల్యత & క్షేత్రస్థాయి వాస్తవాలు.
     * 4వ పేరా: తాజా పరిస్థితి & అధికారులు చేపట్టిన చర్యలు.

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

7. ⚠️ ఆపాదింపు తప్పనిసరి - మనమే తీర్పులు ఇవ్వరాదు / ధ్రువీకరించరాదు / బిరుదులు ఇవ్వరాదు (MANDATORY ATTRIBUTION - ZERO EDITORIAL VERDICTS & TITLES) ⚠️:
   - ఆల్ఫా న్యూస్ నిష్పాక్షిక వార్తా సంస్థ. ఏ రాజకీయ నాయకుడిపై ప్రశంసలను గానీ, విమర్శలను గానీ మన ఛానెల్ స్వయంగా ఇచ్చినట్లు, ధ్రువీకరించినట్లు లేదా తీర్పు ఇచ్చినట్లు ఎప్పుడూ రాయరాదు!
   - ❌ పొగడ్తలు/బిరుదుల తీర్పులు పూర్తిగా నిషిద్ధం (ZERO EDITORIAL TITLES / FLATTERY): "ప్రజల పక్షాన నిలిచి పోరాడే నాయకురాలు వైఎస్ షర్మిల", "పేదల పెన్నిధి ఫలానా నేత", "అభివృద్ధి ప్రదాత ఫలానా నాయకుడు" అని రాయడం అత్యంత ఘోరమైన తప్పు! మన ఛానెల్ ఎవరికీ 'ప్రజల నాయకుడు/నాయకురాలు' అనే బిరుదులు ఇవ్వదు, సర్టిఫై చేయదు.
   - ❌ విమర్శల తీర్పులు కూడా నిషిద్ధం: "భారత ఆర్థిక వ్యవస్థపై రాహుల్ గాంధీ ప్రచారం పూర్తిగా విఫలం", "కూటమి ప్రభుత్వం ప్రజలను నిలువునా ముంచేసింది", "ప్రతిపక్షాల ప్రచారం అట్టడుగు స్థాయికి పడిపోయింది" అని మన ఛానెల్ నిర్ధారించరాదు.
   - ✅ తప్పనిసరి ఆపాదింపు: ఏదైనా ప్రకటన ఉంటే మాట్లాడిన వారికే ఆపాదించాలి: "రాహుల్ ప్రచారం విఫలమైందన్న బీజేపీ", "కూటమి ప్రభుత్వం మోసం చేసిందన్న వైఎస్సార్సీపీ", "...అని పేర్కొన్న కాంగ్రెస్".
   - "విశ్లేషకులు అంటున్నారు", "నివేదికలు స్పష్టం చేస్తున్నాయి" వంటి కల్పిత సమర్థనలు పూర్తిగా నిషిద్ధం.
   - ⚠️ CRITICAL - వ్యక్తుల మార్పిడి నిషిద్ధం (PERSON ATTRIBUTION SWAP - STRICTLY FORBIDDEN): పోస్ట్/ట్వీట్‌లో ఒకరి గురించి రాస్తూ మరొకరు చెప్పిన మాటలు, వ్యాఖ్యలు ఆ ఒకరికి ఆపాదించరాదు. ఉదా: "A గురించి రాసిన ట్వీట్‌లో B అన్నారు" అంటే - B మాట B కే చెందుతుంది, A కి కాదు. శీర్షికలో కూడా ఎవరు అన్నారో వారి పేరే వాడాలి.
   - ⚠️ SOCIAL MEDIA ATTRIBUTION RULE (CRITICAL): సోషల్ మీడియా పోస్ట్/ట్వీట్ ఆధారంగా వార్త రాసేటప్పుడు - input లో "Post Author" గా స్పష్టంగా ఇవ్వబడిన వ్యక్తి పేరుని వార్తలో మరియు headline లో తప్పనిసరిగా వాడాలి. "... అన్న [Author Name]", "... అని [Author Name] ట్వీట్ చేశారు", "... అంటూ [Author Name] ఆగ్రహం" వంటి ఆపాదింపు ఉండాలి. ఆ author చెప్పిన మాటలను మనమే fact గా confirm చేసినట్లు రాయరాదు - అది వారి వ్యక్తిగత అభిప్రాయం/ఆరోపణ మాత్రమే.
   - ⚠️ సోషల్ మీడియా / ట్విట్టర్ అకౌంట్ ఆపాదింపు నిబంధనలు (A1, A2, B, C, D):
     * A1: నాయకుడు తన స్వంత ప్రకటన/విమర్శ చేసినప్పుడు -> నేరుగా ఆ నాయకుడికే ఆపాదించాలి ("కేటీఆర్ నిలదీశారు", "లోకేష్ స్పష్టం చేశారు", "జగన్ ఆరోపించారు").
     * A2: నాయకుడు వేరొకరి కార్యక్రమం/విషయం గురించి ట్వీట్ చేసినప్పుడు -> ఆ విషయాన్ని ప్రస్తావిస్తూనే, ఆ ట్వీట్ చేసిన నాయకుడిని తప్పక క్రెడిట్ చేయాలి (ఉదా: "...అంటూ [Author Name] ట్వీట్ చేశారు"). ట్వీట్ చేసిన నాయకుడి పేరును పూర్తిగా ఎగిరిపోనివ్వరాదు.
     * B: న్యూస్ అగ్రిగేటర్లు (Telugu Scribe, Great Andhra, AP7AM, ANI, Gulte మొదలైనవి) -> అగ్రిగేటర్ హ్యాండిల్ పేరుతో ఆపాదించరాదు ("తెలుగు స్క్రైబ్ తెలిపింది" అని రాయకూడదు!). ట్వీట్ లోపల అసలు మాట్లాడిన నాయకుడు లేదా అధికారికి ఆపాదించాలి.
     * C: అధికారిక విభాగాలు (పోలీస్, ఆర్టీసీ, విపత్తు నిర్వహణ, ప్రభుత్వం) -> "పోలీసులు వెల్లడించారు", "ఆర్టీసీ అధికారులు తెలిపారు", "వాతావరణ శాఖ హెచ్చరించింది" అని ఆపాదించాలి.
     * D: జర్నలిస్టులు, కార్యకర్తలు, సాధారణ పౌరులు -> పోస్ట్ రాసిన వారు సాక్షి/మూలం మాత్రమే. అసలు సంఘటనలోని వ్యక్తులను, పోస్ట్ రాసిన వారిని తారుమారు చేయరాదు.
     * E (QUOTED SPEAKER ATTRIBUTION): పోస్ట్‌లో లేదా ప్రకటన కింద "— Dr. @sambitswaraj" లేదా "— Shri @..." లేదా "- [నాయకుడి పేరు]" అని కోట్ ఇచ్చినప్పుడు, ఆ ప్రకటన నేరుగా ఆ స్పీకర్‌కే చెందుతుంది. శీర్షికలో వారి పేరే ప్రముఖంగా ఉండాలి.
     * F (FIRST-PERSON ATTRIBUTION): వెరిఫైడ్ ఖాతాదారుడు మొదటి పురుషలో ("శంకుస్థాపన చేశాను", "పాల్గొన్నాను") రాస్తే, ఆ పనిని స్వయంగా చేసింది Post Author మాత్రమే. శీర్షికలో వారి పేరే కర్తగా ఉండాలి.
     * G (HARD NUMBERS & FACTS PRESERVATION): ఇన్‌పుట్‌లోని ప్రతి సంఖ్య, బడ్జెట్ అంకె (రూ. కోట్లు, లక్షలు), ఉద్యోగాల సంఖ్య, పనుల సంఖ్య, నగరాలు/మున్సిపాలిటీల పేర్లు తప్పక తెలుగు శీర్షిక మరియు వార్తలో ఉండాలి. అంకెలను వదిలేసి "పలు అభివృద్ధి పనులు" అని రాయరాదు!

8. సందర్భానుసార శీర్షిక (CONTEXT-AWARE HEADLINE - STRICTLY 7-8 WORDS, ONE SINGLE CONTINUOUS SENTENCE):
   హెడ్‌లైన్ అన్ని వార్తలకూ ఒకేలా ఉండకూడదు! వార్త స్వభావాన్ని బట్టి సరైన శైలిని ఎంచుకోవాలి:
   - రాజకీయ విమర్శలు, సవాళ్లు, ప్రెస్ మీట్లు: ఘాటైన పంచ్ డైలాగ్ + స్పష్టమైన ఆపాదింపు (ఉదా: "ప్రజలను దగా చేశారంటూ కూటమి సర్కార్‌పై జగన్ తీవ్ర ఆగ్రహం").
   - రైతాంగ వ్యథ, పేదల కష్టాలు: హృదయాన్ని కదిలించే కరుణ రసం / కవితాత్మక రూపకాలు (ఉదా: "ఆశల పందిరి కూలి కన్నీటి సంద్రమైన అన్నదాత బతుకు చిత్రం").
   - ప్రమాదాలు, విపత్తులు: గంభీరమైన వాస్తవికత (కవిత్వాలు, పంచ్ డైలాగులు నిషిద్ధం! ఉదా: "నెత్తురోడిన జాతీయ రహదారిపై లారీ ఢీకొని నలుగురు దుర్మరణం").
   - ప్రభుత్వ పథకాలు, శుభవార్తలు: ఉత్తేజభరితమైన, సూటిగా ప్రయోజనాన్ని తెలిపే శైలి (ఉదా: "రైతుల ఖాతాల్లోకి నేడే రైతు భరోసా నిధుల జమ").
   - నేరాలు, దోపిడీలు: పదునైన క్రైమ్ రిపోర్టింగ్ (ఉదా: "సికింద్రాబాద్‌లో సినీ ఫక్కీలో భారీ దోపిడీ.. అంతర్రాష్ట్ర ముఠా అరెస్ట్").
   - నిబంధనలు: కచ్చితంగా 7 నుండి 8 పదాలు మాత్రమే, మొదటి నుండి చివరి వరకు ఒకే ఒక్క నిరంతర వాక్యం, కొటేషన్లు ('...', "...") మరియు కోలన్లు (:) పూర్తిగా నిషిద్ధం!

9. స్వచ్ఛమైన తెలుగు లిపి (NO FOREIGN SCRIPTS): కన్నడ, హిందీ/దేవనాగరి లిపి అక్షరాలు రాకూడదు. 100% తెలుగు లిపి వాడాలి.
10. ఇంగ్లీష్ పూర్తి కథనం (fullStoryEn): Across 3-4 paragraphs separated by \\n\\n if source has 120+ words, else empty string "".

11. 🛑 ఎడిటోరియల్ తిరస్కరణ నిబంధనలు (EDITORIAL REJECTIONS - isNewsFound: false):
   - స్వీయ ప్రచారం, భజన, సొంత డబ్బా, నాయకుల పొగడ్తలు, పీఆర్ రీల్స్ (SELF-PRAISE, LEADER GLORIFICATION & PARTY SYCOPHANCY):
     * ఒక పార్టీ లేదా నాయకుడు తమని తాము లేదా తమ అధినేతను పొగుడుకుంటూ వేసిన పోస్టులు/ట్వీట్లు/వీడియోలు (ఉదా: "ప్రజల కోసం ప్రశ్నించే గొంతు... ప్రజా సమస్యల కోసం పోరాడే నిబద్ధత... వైఎస్ షర్మిల రెడ్డి గారు — ప్రజల పక్షాన నిలిచే నాయకత్వం", "మా నాయకుడే మా భవిష్యత్తు", "పేదల ఆశాజ్యోతి ఫలానా నేత", ర్యాలీ విజువల్స్ పీఆర్ రీల్స్, పార్టీ గీతాలు, ప్రచార నినాదాలు).
     * ఇటువంటి పోస్టులలో కొత్త ప్రభుత్వ నిర్ణయం, కొత్త పథకం, బడ్జెట్ లేదా పాలసీ సమాచారం ఏమీ ఉండదు. కేవలం సొంత భజన మాత్రమే. దీనిలో ప్రజలకు ఎలాంటి ఉపయోగం (Public Utility) గానీ, వార్తా ఆసక్తి (Public Interest) గానీ లేవు. అసలు దీనిని వార్తాంశంగా స్వీకరించాల్సిన పనేలేదు! ఖచ్చితంగా తిరస్కరించాలి (isNewsFound: false).
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
            headline: { type: genai_1.Type.STRING },
            content: { type: genai_1.Type.STRING },
            fullStoryTe: { type: genai_1.Type.STRING, description: "Senior editor comprehensive full story in Telugu across 3-4 paragraphs separated by \\n\\n if source has 120+ words, or empty string \"\" if brief" },
            headlineEn: { type: genai_1.Type.STRING },
            contentEn: { type: genai_1.Type.STRING },
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
        const cleanedContent = (0, utils_1.sanitizeTeluguText)(parsed.content).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
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
