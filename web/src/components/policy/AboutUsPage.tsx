
import React from 'react';

const AboutUsPage: React.FC = () => {
  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg text-xl leading-relaxed text-gray-800">
      <h1 className="font-ramabhadra text-3xl md:text-4xl text-gray-900 border-b-2 border-red-200 pb-2 mb-6">
        మా గురించి (About Us)
      </h1>

      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600 mb-6 font-mallanna">
          <h2 className="font-bold text-xl text-blue-900 mb-2 font-ramabhadra">వార్తల విప్లవం - అల్ఫా న్యూస్</h2>
          <p className="text-lg">
            <strong>Alfa News Telugu</strong> అనేది ఒక ఆధునిక <strong>News Aggregator</strong> అప్లికేషన్. మేము వివిధ విశ్వసనీయ వార్తా వనరులు, వెబ్‌సైట్‌లు మరియు సోషల్ మీడియా నుండి సమాచారాన్ని సేకరించి, మా పాఠకులకు క్లుప్తంగా, "సూటిగా, సుత్తి లేకుండా" అందిస్తాము. మా లక్ష్యం కేవలం సమాచారాన్ని సంక్షిప్తీకరించి (Summarized), తక్కువ సమయంలో ఎక్కువ విషయాలు తెలుసుకునేలా చేయడం.
          </p>
        </div>

        <p className="font-mallanna text-xl">
          ఈ రోజుల్లో సమయం చాలా విలువైందని మేము అర్థం చేసుకున్నాము, అందుకే మేము ప్రతి వార్తను కేవలం 60 పదాలలో, అత్యంత వేగంగా మీ ముందుకు తీసుకువస్తున్నాము.
        </p>
        
        <h2 className="font-ramabhadra text-2xl md:text-3xl text-red-700 pt-4">
          మా లక్ష్యం (Our Mission)
        </h2>
        <p className="font-mallanna text-xl">
          వార్తా ప్రపంచంలో ఒక నమ్మకమైన మరియు ముఖ్యమైన వేదికగా నిలవడమే మా దృష్టి. మేము కేవలం వార్తలను నివేదించడమే కాకుండా, వాటి వెనుక ఉన్న వాస్తవాలను లోతుగా విశ్లేషించి, మా పాఠకులకు పూర్తి అవగాహన కల్పించాలనుకుంటున్నాము. ఆంధ్రప్రదేశ్ మరియు తెలంగాణలోని ప్రతి జిల్లా, ప్రతి మండలం వార్తలను సామాన్యుడికి కూడా సులభంగా అర్థమయ్యేలా అందించడమే మా ప్రథమ కర్తవ్యం.
        </p>

        <h2 className="font-ramabhadra text-2xl md:text-3xl text-red-700 pt-4">
          మా విలువలు
        </h2>
        <ul className="list-disc list-inside space-y-3 pl-4">
          <li><strong className="font-semibold">నిజాయితీ:</strong> మేము అందించే ప్రతి వార్తలో వాస్తవికత మరియు పారదర్శకతను పాటిస్తాము.</li>
          <li><strong className="font-semibold">వేగం:</strong> సంఘటన జరిగిన వెంటనే, మేము దానిని మీ ముందుకు తీసుకువస్తాము.</li>
          <li><strong className="font-semibold">క్లుప్తత:</strong> అనవసరమైన వివరాలు లేకుండా, వార్త యొక్క సారాంశాన్ని మాత్రమే అందిస్తాము.</li>
          <li><strong className="font-semibold">ప్రజా పక్షం:</strong> మేము ఎల్లప్పుడూ ప్రజల పక్షాన నిలబడి, వారి గొంతును వినిపిస్తాము.</li>
        </ul>

        {/* DMCA Section */}
        <div className="mt-8 border-t-2 border-gray-100 pt-6">
            <h2 className="font-ramabhadra text-2xl md:text-3xl text-gray-800 mb-4">
              DMCA / Takedown Policy
            </h2>
            <div className="bg-gray-100 p-5 rounded-lg border border-gray-300">
                <p className="text-base text-gray-700 mb-3">
                    మేము ఇతరుల కాపీరైట్ మరియు మేధో సంపత్తి హక్కులను గౌరవిస్తాము. మా యాప్‌లో ఉన్న ఏదైనా కంటెంట్, ఇమేజ్ లేదా వీడియో పట్ల మీకు అభ్యంతరం ఉంటే, లేదా అది మీ కాపీరైట్‌ను ఉల్లంఘిస్తుందని మీరు భావిస్తే, దయచేసి మాకు తెలియజేయండి.
                </p>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-2 bg-white p-3 rounded border border-gray-200">
                    <span className="font-bold text-red-600">Email:</span>
                    <a href="mailto:contact@alfanews.app" className="text-blue-600 font-bold hover:underline">contact@alfanews.app</a>
                </div>
                <p className="text-sm text-gray-600 mt-3 font-semibold">
                    మీ అభ్యర్థనను స్వీకరించిన <span className="text-red-600">24 గంటల్లో</span> మేము సంబంధిత కంటెంట్‌ను సమీక్షించి, తొలగిస్తాము.
                </p>
            </div>
        </div>

        <p className="pt-4">
          మా ప్రయాణంలో మాతో చేరినందుకు ధన్యవాదాలు. మీ సూచనలు మరియు అభిప్రాయాలు మాకు ఎంతో విలువైనవి.
        </p>
      </div>
    </div>
  );
};

export default AboutUsPage;
