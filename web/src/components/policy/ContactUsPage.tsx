import React, { useState, useEffect } from 'react';
import { app } from '../../services/firebase';
import * as _functions from 'firebase/functions';
import { TS_DISTRICTS, AP_DISTRICTS } from '../../types';

// Workaround for Firebase v9 imports in certain TS environments
const { getFunctions, httpsCallable } = _functions as any;

import { MANDAL_DATA } from '../../data/mandalData';

const INQUIRY_TYPES = [
    'రిపోర్టర్ గా చేరండి (Join as Reporter)',
    'సాధారణ సందేశం (General Inquiry)',
    'ప్రకటనల కోసం (For Advertisements)',
    'ఇతర (Other)'
];

const ContactUsPage: React.FC = () => {
  const [inquiryType, setInquiryType] = useState(INQUIRY_TYPES[0]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  const [selectedState, setSelectedState] = useState('TS');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedMandal, setSelectedMandal] = useState('');
  
  const [experience, setExperience] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse location hash if someone clicked "Apply for Reporter"
  useEffect(() => {
     if (window.location.hash.includes('apply-reporter')) {
         setInquiryType('రిపోర్టర్ గా చేరండి (Join as Reporter)');
     }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !phone || !message || !selectedDistrict || !selectedMandal) {
        alert("దయచేసి జిల్లా మరియు మండలంతో సహా అన్ని వివరాలను పూరించండి.");
        return;
    }

    setIsSubmitting(true);

    try {
        const functions = getFunctions(app, 'asia-south1');
        const sendEmail = httpsCallable(functions, 'sendContactEmail');

        // Compile all the data into the message block
        let compiledMessage = `Subject / Type: ${inquiryType}\n\n`;
        compiledMessage += `Name: ${name}\n`;
        compiledMessage += `Phone: ${phone}\n`;
        if (email) compiledMessage += `Email: ${email}\n`;
        
        compiledMessage += `Location: ${selectedMandal}, ${selectedDistrict}, ${selectedState}\n`;
        if (experience) compiledMessage += `Experience: ${experience}\n`;
        
        compiledMessage += `\nMessage:\n${message}`;

        // Call Cloud Function to send Email via SMTP
        await sendEmail({
            name: name,
            phone: phone,
            message: compiledMessage
        });

        alert("మీ సందేశం మాకు విజయవంతంగా చేరింది! మా ప్రతినిధి మిమ్మల్ని త్వరలో సంప్రదిస్తారు.");
        
        // Clear form
        setName('');
        setPhone('');
        setEmail('');
        setExperience('');
        setMessage('');
        setSelectedDistrict('');
        setSelectedMandal('');

    } catch (error: any) {
        console.error("Error sending message:", error);
        let errorMessage = "సందేశం పంపడంలో సాంకేతిక లోపం ఏర్పడింది. దయచేసి కాసేపటి తర్వాత ప్రయత్నించండి.";
        
        if (error.code === 'failed-precondition') {
             errorMessage = "సర్వర్‌లో మెయిల్ కాన్ఫిగరేషన్ లోపం ఉంది. దయచేసి అడ్మిన్‌ను సంప్రదించండి.";
        } else if (error.message) {
             console.log(error.message);
        }
        
        alert(errorMessage);
    } finally {
        setIsSubmitting(false);
    }
  };

  const mandalsToDisplay = MANDAL_DATA[selectedDistrict] || MANDAL_DATA['default'];

  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg text-xl leading-relaxed text-gray-800">
      <h1 className="font-ramabhadra text-3xl md:text-4xl text-gray-900 border-b-2 border-red-200 pb-2 mb-6">
        మమ్మల్ని సంప్రదించండి
      </h1>

      <div className="space-y-8">
        <p>
          మా వార్తా సేవ గురించి మీకు ఏవైనా ప్రశ్నలు, సూచనలు లేదా అభిప్రాయాలు ఉన్నాయా? మీరు మాతో రిపోర్టర్ గా పనిచేయాలనుకున్నా లేదా ప్రకటనలు ఇవ్వాలనుకున్నా ఈ ఫారమ్ ద్వారా మమ్మల్ని సంప్రదించవచ్చు.
        </p>

        {/* Contact Form Section */}
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            <h2 className="font-ramabhadra text-2xl text-red-700 mb-4">
               మీ వివరాలను పంపండి
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-gray-700 font-bold mb-1 text-lg">సందేశం రకం (Inquiry Type)</label>
                    <select 
                        value={inquiryType}
                        onChange={e => setInquiryType(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none bg-white"
                        disabled={isSubmitting}
                    >
                        {INQUIRY_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-gray-700 font-bold mb-1 text-lg">మీ పేరు (Name)</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="పూర్తి పేరు"
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none"
                        required
                        disabled={isSubmitting}
                    />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-gray-700 font-bold mb-1 text-lg">ఫోన్ నంబర్ (Phone)</label>
                        <input 
                            type="tel" 
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="మొబైల్ నంబర్"
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none"
                            required
                            disabled={isSubmitting}
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 font-bold mb-1 text-lg">ఈమెయిల్ (Email) (ఐచ్ఛికం)</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="మీ ఈమెయిల్ ఐడి"
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none"
                            disabled={isSubmitting}
                        />
                    </div>
                </div>

                {/* Location Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-gray-700 font-bold mb-1 text-lg">రాష్ట్రం</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none bg-white" 
                            value={selectedState} 
                            onChange={e => { setSelectedState(e.target.value); setSelectedDistrict(''); setSelectedMandal(''); }}
                            disabled={isSubmitting}
                        >
                            <option value="TS">తెలంగాణ</option>
                            <option value="AP">ఆంధ్రప్రదేశ్</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-gray-700 font-bold mb-1 text-lg">జిల్లా</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none bg-white" 
                            value={selectedDistrict} 
                            onChange={e => { setSelectedDistrict(e.target.value); setSelectedMandal(''); }} 
                            required
                            disabled={isSubmitting}
                        >
                            <option value="">జిల్లాను ఎంచుకోండి</option>
                            {(selectedState === 'TS' ? TS_DISTRICTS : AP_DISTRICTS).map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-gray-700 font-bold mb-1 text-lg">మండలం</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none bg-white" 
                            value={selectedMandal} 
                            onChange={e => setSelectedMandal(e.target.value)} 
                            required
                            disabled={isSubmitting}
                        >
                            <option value="">మండలాన్ని ఎంచుకోండి</option>
                            {mandalsToDisplay.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {inquiryType.includes('రిపోర్టర్') && (
                    <div>
                        <label className="block text-gray-700 font-bold mb-1 text-lg">జర్నలిజంలో అనుభవం (Experience)</label>
                        <input 
                            type="text" 
                            value={experience}
                            onChange={(e) => setExperience(e.target.value)}
                            placeholder="ఉదా: 2 సంవత్సరాలు లేదా ఫ్రెషర్"
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none"
                            disabled={isSubmitting}
                        />
                    </div>
                )}

                <div>
                    <label className="block text-gray-700 font-bold mb-1 text-lg">
                        {inquiryType.includes('రిపోర్టర్') ? 'మాతో ఎందుకు పని చేయాలనుకుంటున్నారు? (సందేశం)' : 'సందేశం'}
                    </label>
                    <textarea 
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        placeholder={inquiryType.includes('రిపోర్టర్') ? "మీ ఆసక్తులను ఇక్కడ రాయండి..." : "మీరు చెప్పాలనుకున్న విషయం ఇక్కడ రాయండి..."}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none"
                        required
                        disabled={isSubmitting}
                    ></textarea>
                </div>
                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className={`w-full text-white font-bold py-3 rounded-lg transition-colors text-lg ${isSubmitting ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 shadow-md transform active:scale-95'}`}
                >
                    {isSubmitting ? 'సమర్పిస్తోంది...' : 'వివరాలను సమర్పించండి'}
                </button>
            </form>
        </div>

        <div>
          <h2 className="font-ramabhadra text-2xl text-red-700 mb-2">
            సాధారణ విచారణల కోసం:
          </h2>
          <p>
            మీరు మమ్మల్ని ఇమెయిల్ ద్వారా సంప్రదించవచ్చు. మేము వీలైనంత త్వరగా మీకు ప్రత్యుత్తరం ఇస్తాము.
          </p>
          <p className="mt-2">
            <strong>ఇమెయిల్:</strong> <a href="mailto:contact@alfanews.app" className="text-blue-600 hover:underline">contact@alfanews.app</a>
          </p>
        </div>

        <div>
          <h2 className="font-ramabhadra text-2xl text-red-700 mb-2">
            మా కార్యాలయం:
          </h2>
          <p>
            మీరు మా కార్యాలయాన్ని సందర్శించాలనుకుంటే, దయచేసి ముందుగా అపాయింట్‌మెంట్ తీసుకోండి.
          </p>
          <address className="mt-2 not-italic bg-gray-100 p-4 rounded-lg border-l-4 border-red-600">
            <strong>Alfa News,</strong><br />
            Alfa New Gen Platforms,<br />
            Palam Najafgarh Road,<br />
            Sector 12 Dwarka,<br />
            Dwarka, Delhi, 110078
          </address>
        </div>
        
        <p className="pt-4 border-t border-gray-200 text-center text-sm">
          మేము మీ అభిప్రాయానికి విలువ ఇస్తాము మరియు మా సేవలను మెరుగుపరచడానికి నిరంతరం కృషి చేస్తాము.
        </p>
      </div>
    </div>
  );
};

export default ContactUsPage;
