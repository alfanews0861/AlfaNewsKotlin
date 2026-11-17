import React from 'react';

const AdPolicyPage: React.FC = () => {
  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg text-lg leading-relaxed text-gray-800 max-w-4xl mx-auto font-mallanna">
      <h1 className="font-ramabhadra text-2xl md:text-3xl text-gray-900 border-b-2 border-red-500 pb-2 mb-6">
        ప్రకటనల విధానం (Advertising & AdSense Policy)
      </h1>

      <div className="space-y-6">
        <p>
          Alfa News Telugu (<a href="https://alfanews.app/" className="text-red-600 hover:underline">https://alfanews.app/</a>) సేవలను మా వినియోగదారులకు ఉచితంగా అందించడానికి, మేము మా వెబ్‌సైట్ మరియు మొబైల్ అప్లికేషన్‌లో ప్రకటనలను ప్రదర్శిస్తాము. ఈ విధానం మా ప్లాట్‌ఫారమ్‌పై ప్రకటనలు ఎలా పనిచేస్తాయో స్పష్టంగా వివరిస్తుంది.
        </p>

        <h2 className="font-ramabhadra text-xl text-red-700 pt-2">
          ప్రకటనల భాగస్వాములు & గూగుల్ అడ్సెన్స్ (Google AdSense & AdMob Partners)
        </h2>
        <p>
          మేము <strong>Google AdSense</strong> మరియు <strong>Google AdMob</strong> వంటి అంతర్జాతీయ ప్రమాణాలు కలిగిన మూడవ పక్ష ప్రకటనల నెట్‌వర్క్‌లతో కలిసి పనిచేస్తాము (Publisher ID: <code>pub-5787901991150360</code>). ఈ భాగస్వాములు పాఠకులకు అత్యంత సంబంధిత ప్రకటనలను చూపించడానికి కుక్కీలు, వెబ్ బీకాన్‌లు మరియు సాంకేతికతలను ఉపయోగిస్తారు.
        </p>

        <h2 className="font-ramabhadra text-xl text-red-700 pt-2">
          కంటెంట్ మరియు ప్రకటనల విభజన (Editorial Independence)
        </h2>
        <p>
          Alfa News Telugu సంపాదకీయ సమగ్రతకు ప్రాధాన్యతనిస్తుంది. మా వార్తా కథనాలు, విశ్లేషణలు మరియు రిపోర్టింగ్‌లు ప్రకటనదారుల ప్రభావానికి గురికావు. ప్రాయోజిత (Sponsored) కథనాలు లేదా వాణిజ్య ప్రకటనలు స్పష్టమైన 'ప్రకటన / Ad / Sponsored' లేబుల్‌తో మాత్రమే ప్రదర్శించబడతాయి.
        </p>

        <h2 className="font-ramabhadra text-xl text-red-700 pt-2">
          యూజర్ ఎంపికలు & ప్రకటనల సెట్టింగ్‌లు (Ad Settings & Opt-Out)
        </h2>
        <p>
          గూగుల్ ప్రకటనల నెట్‌వర్క్ ద్వారా మీ ప్రాధాన్యతలకు తగినట్లు వచ్చే ప్రకటనలను నియంత్రించడానికి మీరు గూగుల్ అధికారిక ప్రకటన సెట్టింగ్‌లను సందర్శించవచ్చు:{' '}
          <a 
            href="https://adssettings.google.com/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-red-600 font-bold hover:underline"
          >
            Google Ads Settings
          </a>.
        </p>

        <div className="pt-4 border-t border-gray-200">
          <p className="text-gray-600 text-sm">
            ప్రకటనల విధానం గురించి ఏవైనా ప్రశ్నలు ఉంటే దయచేసి మమ్మల్ని సంప్రదించండి:{' '}
            <a href="mailto:alfanews0861@gmail.com" className="text-red-600 font-bold hover:underline">
              alfanews0861@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdPolicyPage;
