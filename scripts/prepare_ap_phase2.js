const fs = require('fs');

const candidates = [
    {
        url: '@RamanaiduTDP',
        sourceName: 'నిమ్మల రామానాయుడు - జలవనరుల శాఖ మంత్రి, పాలకొల్లు ఎమ్మెల్యే',
        category: 'రాజకీయం',
        district: 'పశ్చిమ గోదావరి'
    },
    {
        url: '@CollectorWg',
        sourceName: 'కలెక్టర్ పశ్చిమ గోదావరి (Collector West Godavari)',
        category: 'స్థానిక',
        district: 'పశ్చిమ గోదావరి'
    },
    {
        url: '@KonaseemaPolice',
        sourceName: 'కోనసీమ పోలీస్ (Dr.B.R. Ambedkar Konaseema District Police)',
        category: 'స్థానిక',
        district: 'కోనసీమ'
    },
    {
        url: '@HarishBalayogi',
        sourceName: 'గంటి హరీష్ మాధుర్ (బాలయోగి) - అమలాపురం ఎంపీ, టీడీపీ విప్',
        category: 'రాజకీయం',
        district: 'కోనసీమ'
    },
    {
        url: '@reddymagunta5',
        sourceName: 'మాగుంట శ్రీనివాసులు రెడ్డి - ఒంగోలు ఎంపీ',
        category: 'రాజకీయం',
        district: 'ప్రకాశం'
    },
    {
        url: '@MaguntaRaghava',
        sourceName: 'మాగుంట రాఘవ రెడ్డి - ఒంగోలు టీడీపీ నేత',
        category: 'రాజకీయం',
        district: 'ప్రకాశం'
    },
    {
        url: '@JanaDamacharla',
        sourceName: 'దామచర్ల జనార్దన్ రావు - ఒంగోలు ఎమ్మెల్యే, టీడీపీ అధ్యక్షుడు',
        category: 'రాజకీయం',
        district: 'ప్రకాశం'
    },
    {
        url: '@SilpaRaviReddy',
        sourceName: 'శిల్పా రవిచంద్ర కిషోర్ రెడ్డి - మాజీ ఎమ్మెల్యే, నంద్యాల వైఎస్సార్‌సీపీ ఇన్‌చార్జ్',
        category: 'రాజకీయం',
        district: 'నంద్యాల'
    },
    {
        url: '@bhuma_akhila',
        sourceName: 'భూమా అఖిల ప్రియ రెడ్డి - ఆళ్లగడ్డ ఎమ్మెల్యే, మాజీ మంత్రి',
        category: 'రాజకీయం',
        district: 'నంద్యాల'
    },
    {
        url: '@IParitalaSriram',
        sourceName: 'పరిటాల శ్రీరామ్ - ధర్మవరం టీడీపీ సమన్వయకర్త',
        category: 'రాజకీయం',
        district: 'శ్రీ సత్యసాయి'
    },
    {
        url: '@MadhavGorantla',
        sourceName: 'గోరంట్ల మాధవ్ - మాజీ ఎంపీ హిందూపురం',
        category: 'రాజకీయం',
        district: 'శ్రీ సత్యసాయి'
    },
    {
        url: '@ChevireddyMohit',
        sourceName: 'చెవిరెడ్డి మోహిత్ రెడ్డి - చంద్రగిరి వైఎస్సార్‌సీపీ ఇన్‌చార్జ్',
        category: 'రాజకీయం',
        district: 'తిరుపతి'
    },
    {
        url: '@ChintamaneniTDP',
        sourceName: 'చింతమనేని ప్రభాకర్ - దెందులూరు ఎమ్మెల్యే',
        category: 'రాజకీయం',
        district: 'ఏలూరు'
    },
    {
        url: '@allanani_ysrcp',
        sourceName: 'ఆళ్ల నాని (కాళీ కృష్ణ శ్రీనివాస్) - మాజీ ఉప ముఖ్యమంత్రి, ఎమ్మెల్సీ ఏలూరు',
        category: 'రాజకీయం',
        district: 'ఏలూరు'
    },
    {
        url: '@KolluROfficial',
        sourceName: 'కొల్లు రవీంద్ర - గనుల & ఎక్సైజ్ శాఖ మంత్రి, మచిలీపట్నం ఎమ్మెల్యే',
        category: 'రాజకీయం',
        district: 'కృష్ణా'
    },
    {
        url: '@VidadalaRajini',
        sourceName: 'విడదల రజిని - మాజీ వైద్య ఆరోగ్య శాఖ మంత్రి, చిలకలూరిపేట',
        category: 'రాజకీయం',
        district: 'పల్నాడు'
    },
    {
        url: '@AvanthiSrinivas',
        sourceName: 'ముత్తంశెట్టి శ్రీనివాసరావు (అవంతి) - మాజీ పర్యాటక శాఖ మంత్రి, భీమిలి',
        category: 'రాజకీయం',
        district: 'విశాఖపట్నం'
    },
    {
        url: '@PushpaSreevani',
        sourceName: 'పాముల పుష్ప శ్రీవాణి - మాజీ ఉప ముఖ్యమంత్రి, కురుపాం',
        category: 'రాజకీయం',
        district: 'పార్వతీపురం మన్యం'
    },
    {
        url: '@ramanaidu_tdp',
        sourceName: 'గవిరెడ్డి రామానాయుడు - మాజీ ఎమ్మెల్యే మాడుగుల',
        category: 'రాజకీయం',
        district: 'అనకాపల్లి'
    },
    {
        url: '@PemmasaniOnX',
        sourceName: 'డాక్టర్ పెమ్మసాని చంద్రశేఖర్ - కేంద్ర గ్రామీణాభివృద్ధి & కమ్యూనికేషన్ల శాఖ సహాయ మంత్రి, గుంటూరు ఎంపీ',
        category: 'రాజకీయం',
        district: 'గుంటూరు'
    },
    {
        url: '@JayGalla',
        sourceName: 'గల్లా జయదేవ్ - మాజీ ఎంపీ గుంటూరు',
        category: 'రాజకీయం',
        district: 'గుంటూరు'
    },
    {
        url: '@tgbharath',
        sourceName: 'టి.జి. భరత్ - పరిశ్రమల & వాణిజ్య శాఖ మంత్రి, కర్నూలు ఎమ్మెల్యే',
        category: 'రాజకీయం',
        district: 'కర్నూలు'
    },
    {
        url: '@KAKINADAPOLICE',
        sourceName: 'కాకినాడ పోలీస్ (Kakinada District Police)',
        category: 'స్థానిక',
        district: 'కాకినాడ'
    },
    {
        url: '@MithunReddyYSRC',
        sourceName: 'పెద్దిరెడ్డి మిథున్ రెడ్డి - రాజంపేట ఎంపీ, వైఎస్సార్‌సీపీ లోక్‌సభ ఫ్లోర్ లీడర్',
        category: 'రాజకీయం',
        district: 'అన్నమయ్య'
    }
];

fs.writeFileSync('C:\\AlfaKotlin\\andhra_phase2_verified_feeds.json', JSON.stringify(candidates, null, 2));
console.log(`Saved ${candidates.length} verified AP Phase 2 feeds to andhra_phase2_verified_feeds.json`);
