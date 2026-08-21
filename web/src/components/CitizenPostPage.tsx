
import React, { useState } from 'react';
import { db, storage, app } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _storage from 'firebase/storage';
import * as _functions from 'firebase/functions';
import { User, TS_DISTRICTS, AP_DISTRICTS } from '../types';

const { collection, addDoc, serverTimestamp } = _firestore as any;
const { ref, uploadBytes, getDownloadURL } = _storage as any;
const { getFunctions, httpsCallable } = _functions as any;

interface CitizenPostPageProps {
    user: User;
    onClose: () => void;
}

import { MANDAL_DATA } from '../data/mandalData';

const CitizenPostPage: React.FC<CitizenPostPageProps> = ({ user, onClose }) => {
    const [content, setContent] = useState('');
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [selectedState, setSelectedState] = useState('TS');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedMandal, setSelectedMandal] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setMediaFile(file);
            setMediaPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content || !selectedDistrict || !selectedMandal) { alert("దయచేసి అన్ని వివరాలను పూర్తి చేయండి."); return; }
        if (!agreedToTerms) { alert("దయచేసి నిబంధనలను అంగీకరించండి."); return; }
        
        setIsSubmitting(true);
        setStatusMessage('సబ్ ఎడిటర్లు సమీక్షిస్తున్నారు...');

        try {
            const functions = getFunctions(app, 'asia-south1');
            const checkContentFn = httpsCallable(functions, 'processCitizenPost');
            const res: any = await checkContentFn({ content });
            
            if (!res.data.success) {
                alert(`వార్త తిరస్కరించబడింది: \n\n${res.data.reason}`);
                setIsSubmitting(false);
                return;
            }

            setStatusMessage('ఎడిటింగ్ జరుగుతోంది...');
            let mediaUrl = "";
            if (mediaFile) {
                let fileToUpload = mediaFile;
                if (mediaFile.type.startsWith('image/')) {
                    // Create a canvas to convert the image to WebP
                    const img = new Image();
                    const objectUrl = URL.createObjectURL(mediaFile);
                    
                    await new Promise((resolve, reject) => {
                        img.onload = () => resolve(null);
                        img.onerror = reject;
                        img.src = objectUrl;
                    });
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        const webpBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.8));
                        if (webpBlob) {
                            fileToUpload = new File([webpBlob], `${mediaFile.name.split('.')[0]}.webp`, { type: 'image/webp' });
                        }
                    }
                    URL.revokeObjectURL(objectUrl);
                }

                const storageRef = ref(storage, `citizen-media/${Date.now()}-${fileToUpload.name}`);
                const uploadRes = await uploadBytes(storageRef, fileToUpload);
                mediaUrl = await getDownloadURL(uploadRes.ref);
            }

            const processedData = res.data.processed;

            await addDoc(collection(db, 'news'), {
                headline: { telugu: processedData.headline, english: processedData.headlineEn },
                content: { telugu: processedData.content, english: processedData.contentEn },
                mediaUrl,
                mediaType: mediaFile?.type.startsWith('video') ? 'video' : 'image',
                location: selectedMandal,
                district: selectedDistrict,
                state: selectedState,
                category: processedData.category || 'జనరల్',
                timestamp: serverTimestamp(),
                reporter: { id: user.id, name: isAnonymous ? 'అజ్ఞాత పౌరుడు' : user.name },
                isCitizen: true,
                userConfirmed: true
            });

            setStatusMessage('పబ్లిష్ అయ్యింది!');
            setTimeout(() => {
                alert("ధన్యవాదాలు! మీ ప్రజా సమస్య విజయవంతంగా పబ్లిష్ చేయబడింది.");
                onClose();
            }, 1000);
        } catch (e: any) { 
            console.error(e);
            alert("వార్త పంపడంలో లోపం ఏర్పడింది. దయచేసి మళ్ళీ ప్రయత్নন্দండి."); 
            setIsSubmitting(false);
        }
    };

    const labelClass = "block text-gray-700 font-bold text-sm uppercase tracking-widest mb-1 ml-1";
    const inputClass = "w-full border-2 border-gray-300 rounded-xl p-4 text-xl !text-black !bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold shadow-sm";
    const selectClass = "w-full border-2 border-gray-300 rounded-xl p-4 text-xl !text-black !bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold shadow-sm appearance-none cursor-pointer";
    
    const mandalsToDisplay = MANDAL_DATA[selectedDistrict] || MANDAL_DATA['default'];

    return (
        <div className="absolute inset-0 bg-white flex flex-col font-mallanna animate-fade-in text-black z-10">
            <div className="p-4 border-b flex justify-between items-center bg-blue-600 text-white shrink-0 shadow-md">
                <h2 className="text-2xl font-ramabhadra">సిటిజన్ జర్నలిజం (ప్రజా సమస్య)</h2>
                <button onClick={onClose} className="font-bold text-lg p-2 bg-white/20 rounded-lg">రద్దు</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-900 text-lg">
                    <p className="font-bold mb-1 font-ramabhadra">ముఖ్య గమనిక:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                        <li>ప్రజా సమస్యలు, రోడ్లు, డ్రైనేజీ సమస్యల వంటివి మాత్రమే పంపండి.</li>
                        <li>పుట్టినరోజులు, పెళ్లిళ్లు, వ్యక్తిగత వార్తలు నిషిద్ధం.</li>
                        <li>మా సిస్టమ్ వ్యక్తిగత వార్తలను గుర్తించి తిరస్కరిస్తుంది.</li>
                    </ul>
                </div>

                <div className="space-y-2">
                    <label className={labelClass}>సమస్య వివరాలు</label>
                    <textarea rows={5} value={content} onChange={e => setContent(e.target.value)} className={inputClass} placeholder="రోడ్లు బాలేవు, నీటి సమస్య ఉంది వంటి వివరాలు రాయండి..." required />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className={labelClass}>రాష్ట్రం</label>
                        <div className="relative">
                            <select className={selectClass} value={selectedState} onChange={e => { setSelectedState(e.target.value); setSelectedDistrict(''); setSelectedMandal(''); }}>
                                <option value="TS" className="text-black bg-white">తెలంగాణ</option>
                                <option value="AP" className="text-black bg-white">ఆంధ్రప్రదేశ్</option>
                            </select>
                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">▼</div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className={labelClass}>జిల్లా</label>
                        <div className="relative">
                            <select className={selectClass} value={selectedDistrict} onChange={e => { setSelectedDistrict(e.target.value); setSelectedMandal(''); }} required>
                                <option value="" className="text-black bg-white">జిల్లాను ఎంచుకోండి</option>
                                {(selectedState === 'TS' ? TS_DISTRICTS : AP_DISTRICTS).map(d => (
                                    <option key={d} value={d} className="text-black bg-white">{d}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">▼</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className={labelClass}>మండలం / పట్టణం</label>
                    <div className="relative">
                        <select className={selectClass} value={selectedMandal} onChange={e => setSelectedMandal(e.target.value)} required>
                            <option value="" className="text-black bg-white">మండలాన్ని ఎంచుకోండి</option>
                            {mandalsToDisplay.map(m => (
                                <option key={m} value={m} className="text-black bg-white">{m}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">▼</div>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border-2 border-dashed border-gray-200">
                    <label className={labelClass}>ఫోటో లేదా వీడియో (ఐచ్ఛికం)</label>
                    <input type="file" onChange={handleFileChange} className="w-full !text-black font-bold mt-2" />
                    {mediaPreview && (
                         <div className="mt-4 rounded-lg overflow-hidden border border-gray-300 shadow-sm">
                            {mediaFile?.type.startsWith('video') ? (
                                <video src={mediaPreview} className="w-full h-40 object-cover" controls />
                            ) : (
                                <img src={mediaPreview} className="w-full h-40 object-cover" />
                            )}
                         </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 shadow-sm">
                        <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="w-6 h-6 rounded accent-blue-600 mt-1" />
                        <div className="flex flex-col">
                            <span className="font-bold text-blue-900">పేరు వెల్లడించవద్దు (Anonymous)</span>
                            <span className="text-xs text-blue-600">మీ పేరు కాకుండా 'అజ్ఞాత పౌరుడు' అని కనిపిస్తుంది.</span>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-100 shadow-sm">
                        <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="w-6 h-6 rounded accent-yellow-600 mt-1" required />
                        <div className="flex flex-col">
                            <span className="font-bold text-yellow-900">నిబంధనలకు అంగీకరిస్తున్నాను</span>
                            <span className="text-[11px] text-yellow-800 leading-tight">నేను పంపే వార్త వాస్తవమని మరియు దీనికి నేనే పూర్తి బాధ్యత వహిస్తానని అంగీకరిస్తున్నాను. అవాస్తవ సమాచారం పంపితే చట్టపరమైన చర్యలకు సిద్ధమని ధృవీకరిస్తున్నాను.</span>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting} 
                    className={`w-full ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white py-5 rounded-2xl font-bold text-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3`}
                >
                    {isSubmitting ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                    {isSubmitting ? statusMessage : 'వార్తను పంపండి'}
                </button>
            </div>
        </div>
    );
};

export default CitizenPostPage;
