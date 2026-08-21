
import React, { useState } from 'react';
import { app } from '../services/firebase';
import * as _functions from 'firebase/functions';

const { getFunctions, httpsCallable } = _functions as any;

const GreetingsManagerPage: React.FC = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const handleTrigger = async () => {
        if (!window.confirm("నేటి పండుగలు మరియు చారిత్రక విశేషాల కోసం కార్డులను తయారు చేయాలా?")) return;
        setIsProcessing(true);
        setStatus("AI కార్డులు తయారవుతున్నాయి... దయచేసి వేచి ఉండండి.");
        try {
            const processFn = httpsCallable(getFunctions(app, 'asia-south1'), 'processGreetings');
            const result: any = await processFn();
            
            const gSuccess = result.data.greetingResult?.success;
            const hSuccess = result.data.historyResult?.success;

            if (gSuccess || hSuccess) {
                let msg = "విజయం! ";
                if (gSuccess && result.data.greetingResult.occasion) msg += `గ్రీటింగ్ (${result.data.greetingResult.occasion}) `;
                if (hSuccess && result.data.historyResult.event) msg += `చరిత్ర (${result.data.historyResult.event}) `;
                setStatus(msg + "పోస్ట్ చేయబడింది.");
            } else {
                const gError = result.data.greetingResult?.error;
                const hError = result.data.historyResult?.error;
                setStatus(`లోపం: ${gError || hError || "కార్డులు తయారు చేయడంలో సమస్య ఏర్పడింది."}`);
            }
        } catch (error: any) {
            setStatus(`Error: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="font-mallanna text-black animate-fade-in">
            <div className="bg-gradient-to-r from-orange-500 to-red-600 p-8 rounded-[2.5rem] text-white shadow-xl mb-8">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white text-2xl">
                        📜
                    </div>
                    <div>
                        <h2 className="text-3xl font-ramabhadra leading-tight">AI Special Cards</h2>
                        <p className="text-orange-100 text-sm font-bold uppercase tracking-widest opacity-80">గ్రీటింగ్స్ & చరిత్రలో ఈ రోజు</p>
                    </div>
                </div>
                <p className="text-orange-50 mb-6 opacity-90">
                    ఈ టూల్ ద్వారా మీరు ఒకే క్లిక్‌తో నేటి పండుగ శుభాకాంక్షలు (9:16) మరియు చరిత్రలో ఈ రోజు (16:9) కార్డులను ఆటోమేటిక్‌గా తయారు చేయవచ్చు.
                </p>
                <button 
                    onClick={handleTrigger} 
                    disabled={isProcessing} 
                    className="bg-white text-orange-600 px-10 py-4 rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                >
                    {isProcessing ? <div className="w-6 h-6 border-3 border-orange-600 border-t-transparent rounded-full animate-spin"></div> : '✨'}
                    {isProcessing ? 'తయారవుతోంది...' : 'Generate Today\'s Special Cards'}
                </button>
            </div>

            {status && (
                <div className={`p-6 rounded-2xl border font-bold text-lg animate-slide-up ${status.includes('విజయం') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                    {status}
                </div>
            )}

            <div className="mt-10 bg-white p-8 rounded-[2.5rem] border shadow-sm">
                <h3 className="font-ramabhadra text-2xl text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-purple-600 rounded-full"></span>
                    ఎలా పనిచేస్తుంది?
                </h3>
                <ul className="space-y-4 text-gray-600 text-lg">
                    <li className="flex gap-3">
                        <span className="text-purple-600 font-bold">1.</span>
                        <span>ప్రతిరోజూ ఉదయం 6 గంటలకు AI ఆటోమేటిక్‌గా నేటి పండుగను చెక్ చేస్తుంది.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="text-purple-600 font-bold">2.</span>
                        <span>ఒకవేళ ఏదైనా పండుగ ఉంటే, దానికి తగినట్లుగా తెలుగులో శుభాకాంక్షలు మరియు ఒక అందమైన ఇమేజ్‌ను Nano Banana (Gemini AI) సహాయంతో తయారు చేస్తుంది.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="text-purple-600 font-bold">3.</span>
                        <span>ఈ ఇమేజ్ 9:16 (Vertical) సైజులో ఉంటుంది మరియు ఫీడ్‌లో ఫుల్ స్క్రీన్‌గా కనిపిస్తుంది.</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="text-purple-600 font-bold">4.</span>
                        <span>దీనికి ఎటువంటి అదనపు టెక్స్ట్ కంటెంట్ ఉండదు, కేవలం ఇమేజ్ మాత్రమే వార్తగా కనిపిస్తుంది.</span>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default GreetingsManagerPage;
