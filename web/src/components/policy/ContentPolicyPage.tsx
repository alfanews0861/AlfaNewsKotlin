
import React from 'react';

const ContentPolicyPage: React.FC = () => {
  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg text-xl leading-relaxed text-gray-800">
      <h1 className="font-ramabhadra text-3xl md:text-4xl text-gray-900 border-b-2 border-red-200 pb-2 mb-6">
        కంటెంట్ విధానం (Content Policy)
      </h1>

      <div className="space-y-6">
        <p>
          Alfa News Telugu ప్లాట్‌ఫారమ్‌పై సురక్షితమైన మరియు గౌరవప్రదమైన వాతావరణాన్ని సృష్టించడానికి మేము కట్టుబడి ఉన్నాము. మా సేవలను ఉపయోగించే ప్రతి ఒక్కరూ (వినియోగదారులు, రిపోర్టర్లు, ఎడిటర్లు) ఈ కంటెంట్ విధానాన్ని తప్పనిసరిగా పాటించాలి. ఈ నియమాలను ఉల్లంఘించే కంటెంట్‌ను మేము తొలగించవచ్చు మరియు సంబంధిత ఖాతాలను నిలిపివేయవచ్చు.
        </p>

        <h2 className="font-ramabhadra text-2xl text-red-700 pt-4">
          DMCA & Copyright Takedown
        </h2>
        <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-base">
            <p className="font-bold text-red-800 mb-2">కాపీరైట్ ఉల్లంఘన ఫిర్యాదులు:</p>
            <p className="mb-2">
                ఎవరికైనా మా యాప్‌లోని ఏదైనా కంటెంట్ లేదా ఇమేజ్ పట్ల అభ్యంతరం ఉంటే, దయచేసి మాకు మెయిల్ చేయండి. మేము కాపీరైట్ చట్టాలను గౌరవిస్తాము మరియు ఉల్లంఘనలను తీవ్రంగా పరిగణిస్తాము.
            </p>
            <p className="font-semibold">
                Email: <a href="mailto:contact@alfanews.app" className="text-blue-700 underline">contact@alfanews.app</a>
            </p>
            <p className="mt-2 text-sm text-gray-600">
                మేము <strong>24 గంటల్లో</strong> స్పందించి, అభ్యంతరకరమైన కంటెంట్‌ను తొలగిస్తాము.
            </p>
        </div>

        <h2 className="font-ramabhadra text-2xl text-red-700 pt-4">
          నిషిద్ధ కంటెంట్
        </h2>
        <p>
          కింది రకాల కంటెంట్ మా ప్లాట్‌ఫారమ్‌పై ఖచ్చితంగా నిషిద్ధం:
        </p>
        <ul className="list-disc list-inside space-y-3 pl-4">
          <li>
            <strong className="font-semibold">ద్వేషపూరిత ప్రసంగం:</strong> జాతి, మతం, కులం, లింగం, లైంగిక గుర్తింపు, జాతీయత, లేదా వైకల్యం ఆధారంగా వ్యక్తులు లేదా సమూహాలపై హింసను ప్రేరేపించే, వివక్ష చూపే లేదా ద్వేషాన్ని ప్రచారం చేసే కంటెంట్.
          </li>
          <li>
            <strong className="font-semibold">వేధింపులు మరియు బెదిరింపులు:</strong> ఇతరులను లక్ష్యంగా చేసుకుని వేధించడం, బెదిరించడం లేదా భయపెట్టడం వంటివి.
          </li>
          <li>
            <strong className="font-semibold">అశ్లీలత మరియు లైంగిక కంటెంట్:</strong> అశ్లీల చిత్రాలు, వీడియోలు లేదా లైంగికంగా అసభ్యకరమైన కంటెంట్.
          </li>
          <li>
            <strong className="font-semibold">హింసాత్మక మరియు గ్రాఫిక్ కంటెంట్:</strong> అనవసరమైన హింసను, రక్తపాతాన్ని లేదా భయానక చిత్రాలను ప్రదర్శించడం. ముఖ్యంగా, తీవ్రవాద సంస్థలకు సంబంధించిన కంటెంట్.
          </li>
          <li>
            <strong className="font-semibold">తప్పుడు సమాచారం (Misinformation):</strong> ప్రజారోగ్యం, ఎన్నికల ప్రక్రియలు లేదా ప్రజా భద్రతకు హాని కలిగించే ఉద్దేశపూర్వక తప్పుడు లేదా తప్పుదారి పట్టించే సమాచారం.
          </li>
          <li>
            <strong className="font-semibold">వ్యక్తిగత గోప్యత ఉల్లంఘన:</strong> ఇతరుల అనుమతి లేకుండా వారి వ్యక్తిగత సమాచారాన్ని (ఫోన్ నంబర్లు, చిరునామాలు, మొదలైనవి) పంచుకోవడం.
          </li>
          <li>
            <strong className="font-semibold">చట్టవిరుద్ధమైన కార్యకలాపాలు:</strong> చట్టవిరుద్ధమైన చర్యలను ప్రోత్సహించే, సులభతరం చేసే లేదా ప్రచారం చేసే కంటెంట్.
          </li>
        </ul>
        
        <h2 className="font-ramabhadra text-2xl text-red-700 pt-4">
          వార్తల సమగ్రత
        </h2>
        <p>
          మా రిపోర్టర్లు మరియు ఎడిటర్లు వార్తలను ప్రచురించేటప్పుడు జర్నలిజం యొక్క ఉన్నత ప్రమాణాలను పాటించాలని మేము ఆశిస్తున్నాము. వార్తలు వాస్తవ-ఆధారితంగా, నిష్పక్షపాతంగా మరియు మూలాలను స్పష్టంగా పేర్కొనేవిగా ఉండాలి.
        </p>
        
        <h2 className="font-ramabhadra text-2xl text-red-700 pt-4">
          విధానాన్ని అమలు చేయడం
        </h2>
        <p>
          వినియోగదారులు మా విధానాలను ఉల్లంఘించే కంటెంట్‌ను నివేదించవచ్చు. మేము ప్రతి నివేదికను సమీక్షించి, మా విధానాల ప్రకారం తగిన చర్యలు తీసుకుంటాము. ఈ చర్యలలో కంటెంట్‌ను తొలగించడం, హెచ్చరిక జారీ చేయడం లేదా ఖాతాను శాశ్వతంగా నిషేధించడం వంటివి ఉండవచ్చు.
        </p>
      </div>
    </div>
  );
};

export default ContentPolicyPage;
