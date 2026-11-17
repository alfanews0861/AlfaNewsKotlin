import React from 'react';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg text-lg leading-relaxed text-gray-800 max-w-4xl mx-auto font-mallanna">
      <h1 className="font-ramabhadra text-2xl md:text-3xl text-gray-900 border-b-2 border-red-500 pb-2 mb-6">
        గోప్యతా విధానం (Privacy Policy)
      </h1>

      <div className="space-y-6">
        <p className="text-gray-600 text-sm">
          <strong>చివరి నవీకరణ (Last Updated):</strong> 17 నవంబర్ 2026
        </p>

        <p>
          Alfa News Telugu (<a href="https://alfanews.app/" className="text-red-600 hover:underline">https://alfanews.app/</a>) మా సందర్శకులు మరియు పాఠకుల గోప్యతను అత్యంత గౌరవిస్తుంది. ఈ గోప్యతా విధాన పత్రం Alfa News Telugu ద్వారా ఏ రకమైన సమాచారం సేకరించబడుతుంది, రికార్డ్ చేయబడుతుంది మరియు దానిని మేము ఎలా ఉపయోగిస్తాము అనే వివరాలను తెలియజేస్తుంది.
        </p>

        {/* 1. Google AdSense and DoubleClick Cookie (Mandatory for AdSense Approval) */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
          <h2 className="font-ramabhadra text-xl text-red-700">
            గూగుల్ అడ్సెన్స్ మరియు కుక్కీలు (Google AdSense & DoubleClick DART Cookies)
          </h2>
          <p>
            మా వెబ్‌సైట్‌లో ప్రకటనలను ప్రదర్శించడానికి మేము గూగుల్ (Google) వంటి మూడవ పక్ష ప్రకటన విక్రేతలతో కలిసి పనిచేస్తాము.
          </p>
          <ul className="list-disc list-inside space-y-2 pl-2 text-gray-700">
            <li>
              <strong>Google Third-Party Vendor:</strong> గూగుల్ ఒక మూడవ పక్ష విక్రేతగా మా సైట్‌లో ప్రకటనలను అందించడానికి కుక్కీలను (Cookies) ఉపయోగిస్తుంది.
            </li>
            <li>
              <strong>DoubleClick DART Cookie:</strong> గూగుల్ తన DART కుక్కీ ద్వారా మా వెబ్‌సైట్ మరియు ఇంటర్నెట్‌లోని ఇతర సైట్‌లలో యూజర్లు గతంలో చేసిన సందర్శనల ఆధారంగా వారికి అనువైన ప్రకటనలను అందిస్తుంది.
            </li>
            <li>
              <strong>వ్యక్తిగతీకరించిన ప్రకటనల నియంత్రణ (Opt-Out):</strong> వినియోగదారులు Google Ads Settings పేజీని సందర్శించడం ద్వారా వ్యక్తిగతీకరించిన ప్రకటనల కోసం DART కుక్కీ వినియోగాన్ని నిలిపివేయవచ్చు (Opt-Out):{' '}
              <a 
                href="https://adssettings.google.com/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-red-600 font-bold hover:underline"
              >
                https://adssettings.google.com/
              </a>
            </li>
            <li>
              వినియోగదారులు ఇతర మూడవ పక్ష ప్రకటన విక్రేతల కుక్కీల వాడకాన్ని{' '}
              <a 
                href="https://www.aboutads.info/choices/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-red-600 font-bold hover:underline"
              >
                www.aboutads.info
              </a>{' '}
              ద్వారా కూడా నిలిపివేయవచ్చు.
            </li>
          </ul>
        </div>

        {/* 2. Log Files */}
        <h2 className="font-ramabhadra text-xl text-red-700 pt-2">
          లాగ్ ఫైల్స్ (Log Files)
        </h2>
        <p>
          Alfa News Telugu లాగ్ ఫైళ్ళను ఉపయోగించడంలో ప్రామాణిక పద్ధతిని అనుసరిస్తుంది. సందర్శకులు వెబ్‌సైట్‌లను సందర్శించినప్పుడు ఈ ఫైళ్లు సందర్శకులను లాగ్ చేస్తాయి. లాగ్ ఫైల్స్ సేకరించిన సమాచారంలో ఇంటర్నెట్ ప్రోటోకాల్ (IP) చిరునామాలు, బ్రౌజర్ రకం, ఇంటర్నెట్ సర్వీస్ ప్రొవైడర్ (ISP), తేదీ మరియు సమయ స్టాంప్, పేజీలను సూచించడం/నిష్క్రమించడం మరియు క్లిక్‌ల సంఖ్య ఉండవచ్చు. ఇవి వ్యక్తిగతంగా గుర్తించదగిన ఏ సమాచారానికీ లింక్ చేయబడవు.
        </p>

        {/* 3. Information We Collect */}
        <h2 className="font-ramabhadra text-xl text-red-700 pt-2">
          మేము సేకరించే సమాచారం
        </h2>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li>
            <strong>స్వచ్ఛంద సమాచారం:</strong> మీరు మమ్మల్ని నేరుగా సంప్రదించినప్పుడు, మీ పేరు, ఇమెయిల్ చిరునామా, ఫోన్ నంబర్ మరియు మీరు మాకు పంపే సందేశం యొక్క కంటెంట్‌ను మేము స్వీకరించవచ్చు.
          </li>
          <li>
            <strong>ఖాతా నమోదు:</strong> మీరు ఖాతా కోసం నమోదు చేసుకున్నప్పుడు (ఉదా: రిపోర్టర్ లేదా సిటిజెన్ జర్నలిజం లాగిన్), మేము మీ సంప్రదింపు సమాచారాన్ని సేకరించవచ్చు.
          </li>
        </ul>

        {/* 4. Children's Privacy */}
        <h2 className="font-ramabhadra text-xl text-red-700 pt-2">
          పిల్లల సమాచార రక్షణ (Children's Information)
        </h2>
        <p>
          ఇంటర్నెట్‌ను ఉపయోగిస్తున్నప్పుడు పిల్లలకు రక్షణ కల్పించడం మా ప్రాధాన్యతలలో మరొక ముఖ్యమైన భాగం. Alfa News Telugu 13 ఏళ్ల కంటే తక్కువ వయస్సు ఉన్న పిల్లల నుండి ఎలాంటి వ్యక్తిగత గుర్తింపు సమాచారాన్ని ఉద్దేశపూర్వకంగా సేకరించదు. మీ పిల్లలు మా వెబ్‌సైట్‌లో ఈ రకమైన సమాచారాన్ని అందించారని మీరు భావిస్తే, వెంటనే మమ్మల్ని సంప్రదించండి; మేము ఆ సమాచారాన్ని మా రికార్డుల నుండి వెంటనే తొలగిస్తాము.
        </p>

        {/* 5. Contact Us */}
        <div className="pt-4 border-t border-gray-200">
          <h2 className="font-ramabhadra text-xl text-red-700 mb-2">
            మమ్మల్ని సంప్రదించండి (Contact Information)
          </h2>
          <p>
            మా గోప్యతా విధానం గురించి మీకు ఏవైనా సందేహాలు లేదా అభ్యంతరాలు ఉంటే, దయచేసి మమ్మల్ని సంప్రదించండి:
          </p>
          <p className="mt-2 text-gray-800">
            <strong>సంపాదక కార్యాలయం (Editorial Desk):</strong> Alfa News Telugu<br />
            <strong>ఇమెయిల్ (Email):</strong>{' '}
            <a href="mailto:alfanews0861@gmail.com" className="text-red-600 font-bold hover:underline">
              alfanews0861@gmail.com
            </a><br />
            <strong>వెబ్‌సైట్:</strong>{' '}
            <a href="https://alfanews.app/" className="text-red-600 hover:underline">
              https://alfanews.app/
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
