import React, { useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { app } from '../services/firebase';
import * as _functions from 'firebase/functions';

// Workaround for Firebase v9 imports in certain TS environments
const { getFunctions, httpsCallable } = _functions as any;

interface JobApplicationPageProps {
  onBack: () => void;
}

const JobApplicationPage: React.FC<JobApplicationPageProps> = ({ onBack }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    location: '',
    experience: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
        const functions = getFunctions(app, 'asia-south1');
        const sendEmail = httpsCallable(functions, 'sendContactEmail');

        // Prepare the message based on job app
        let fullMessage = `Reporter Application Details:\n`;
        fullMessage += `Location: ${formData.location}\n`;
        fullMessage += `Experience: ${formData.experience}\n`;
        fullMessage += `Email: ${formData.email}\n\n`;
        fullMessage += `Message:\n${formData.message}`;

        // Call Cloud Function to send Email via SMTP
        await sendEmail({
            name: formData.name,
            phone: formData.phone,
            message: fullMessage
        });

        alert("మీ అప్లికేషన్ మాకు విజయవంతంగా చేరింది! మా ప్రతినిధి మిమ్మల్ని త్వరలో సంప్రదిస్తారు.");
        setSubmitted(true);
    } catch (error: any) {
        console.error("Error sending message:", error);
        let errorMessage = "అప్లికేషన్ సమర్పించడంలో సాంకేతిక లోపం ఏర్పడింది. దయచేసి కాసేపటి తర్వాత ప్రయత్నించండి.";
        
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (submitted) {
    return (
      <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center p-6 text-center h-full text-black">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-sm w-full">
           <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
             <Send size={40} />
           </div>
           <h2 className="text-2xl font-bold text-gray-900 mb-3 font-ramabhadra">మీ అప్లికేషన్ సమర్పించబడింది!</h2>
           <p className="text-gray-600 mb-8 font-mallanna text-lg">మేము త్వరలో మిమ్మల్ని సంప్రదిస్తాము.</p>
           <button
             onClick={onBack}
             className="w-full bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition"
           >
             వెనక్కి వెళ్ళండి
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 flex flex-col h-full overflow-hidden text-black font-mallanna animate-fade-in relative z-50">
      <div className="bg-white shadow-sm flex items-center px-4 py-3 shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full mr-2">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold font-ramabhadra flex-1">రిపోర్టర్‌గా చేరండి</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
        <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
           <div className="p-6 border-b border-gray-100 bg-red-50 text-center">
             <h2 className="text-xl font-bold text-red-900 mb-2 font-ramabhadra">ఆల్ఫా న్యూస్ తో కలిసి పనిచేయండి!</h2>
             <p className="text-sm text-red-800 font-bold">మీ ప్రాంతంలో జరిగే వార్తలను ప్రజలకు అందించడానికి మాతో చేరండి.</p>
           </div>
           
           <form onSubmit={handleSubmit} className="p-6 space-y-5">
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">పూర్తి పేరు (Full Name) *</label>
               <input
                 type="text"
                 name="name"
                 required
                 value={formData.name}
                 onChange={handleChange}
                 className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                 placeholder="మీ పేరు"
               />
             </div>
             
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">ఫోన్ నంబర్ (Phone Number) *</label>
               <input
                 type="tel"
                 name="phone"
                 required
                 value={formData.phone}
                 onChange={handleChange}
                 className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                 placeholder="ఉదా: 9876543210"
               />
             </div>

             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">ఈమెయిల్ (Email) (ఆప్షనల్)</label>
               <input
                 type="email"
                 name="email"
                 value={formData.email}
                 onChange={handleChange}
                 className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                 placeholder="మీ ఈమెయిల్ ఐడి"
               />
             </div>
             
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">మీ ప్రాంతం (Location) *</label>
               <input
                 type="text"
                 name="location"
                 required
                 value={formData.location}
                 onChange={handleChange}
                 className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                 placeholder="గ్రామం/మండలం/జిల్లా"
               />
             </div>
             
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">అనుభవం (Experience)</label>
               <input
                 type="text"
                 name="experience"
                 value={formData.experience}
                 onChange={handleChange}
                 className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                 placeholder="ఉదా: 2 సంవత్సరాలు లేదా ఫ్రెషర్"
               />
             </div>
             
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1">మాతో ఎందుకు చేరాలి అనుకుంటున్నారు? *</label>
               <textarea
                 name="message"
                 required
                 value={formData.message}
                 onChange={handleChange}
                 rows={4}
                 className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold resize-none"
                 placeholder="మీ గురించి కొద్దిగా రాయండి..."
               ></textarea>
             </div>
             
             <div className="pt-2">
               <button
                 type="submit"
                 disabled={isSubmitting}
                 className="w-full bg-red-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-red-700 transition flex items-center justify-center disabled:opacity-70 shadow-md"
               >
                 {isSubmitting ? 'సమర్పిస్తోంది...' : (
                   <>
                     <Send size={20} className="mr-2" />
                     అప్లికేషన్ సమర్పించండి
                   </>
                 )}
               </button>
             </div>
           </form>
        </div>
      </div>
    </div>
  );
};

export default JobApplicationPage;
