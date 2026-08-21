
import React, { useState, ChangeEvent, useEffect } from 'react';
import { db, storage, app } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _storage from 'firebase/storage';
import * as _functions from 'firebase/functions';
import { User, NewsPost, TS_DISTRICTS, AP_DISTRICTS, PostFormat } from '../types';
import { analyzeNewsMetadata } from '../services/geminiService';

const { collection, addDoc, serverTimestamp, doc, updateDoc } = _firestore as any;
const { ref, uploadBytes, getDownloadURL } = _storage as any;
const { getFunctions, httpsCallable } = _functions as any;

interface PostNewsPageProps {
  user: User;
  postToEdit?: NewsPost | null;
  onActionComplete: () => void;
}

const CATEGORIES = ['రాజకీయం', 'ఆంధ్ర ప్రదేశ్', 'తెలంగాణ', 'క్రైమ్', 'వినోదం', 'క్రీడలు', 'వ్యాపారం', 'టెక్నాలజీ', 'లైఫ్ స్టైల్', 'భక్తి', 'వ్యవసాయం', 'విద్య/ఉద్యోగాలు', 'ఆరోగ్యం', 'ఇతరాలు'];

const PostNewsPage: React.FC<PostNewsPageProps> = ({ user, postToEdit, onActionComplete }) => {
    const isEditMode = !!postToEdit;
    const [headline, setHeadline] = useState('');
    const [content, setContent] = useState('');
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState('రాజకీయం');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [isLocalNews, setIsLocalNews] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        if (isEditMode && postToEdit) {
            setHeadline(postToEdit.headline?.telugu || '');
            setContent(postToEdit.content?.telugu || '');
            setMediaPreview(postToEdit.mediaUrl);
            setSelectedCategory(postToEdit.categories?.find(c => CATEGORIES.includes(c)) || 'రాజకీయం');
            setSelectedDistrict(postToEdit.district || '');
            setIsLocalNews(postToEdit.categories?.includes('Local') || false);
        }
    }, [isEditMode, postToEdit]);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setMediaFile(file);
            setMediaPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDistrict) { alert("జిల్లాను ఎంచుకోండి."); return; }
        setIsSubmitting(true);
        setStatusMessage('ప్రాసెస్ అవుతోంది...');

        try {
            const functions = getFunctions(app, 'asia-south1');
            const processFn = httpsCallable(functions, 'processNewPostContent');
            
            setStatusMessage('AI విశ్లేషిస్తోంది...');
            const [aiResult, metadata]: [any, any] = await Promise.all([
                processFn({ content, headline }).catch((e: any) => { console.error(e); return { data: {} }; }),
                analyzeNewsMetadata(headline, content)
            ]);
            
            const aiData = aiResult?.data || {};
            const { summarizedTeluguContent, generatedTeluguHeadline, englishHeadline, englishContent } = aiData;

            let mediaUrl = postToEdit?.mediaUrl || '';
            if (mediaFile) {
                setStatusMessage('మీడియా అప్‌లోడ్ అవుతోంది...');
                
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

                const storageRef = ref(storage, `news-media/${Date.now()}_${fileToUpload.name}`);
                const uploadRes = await uploadBytes(storageRef, fileToUpload);
                mediaUrl = await getDownloadURL(uploadRes.ref);
            }

            // SMART CATEGORIZATION:
            // Use AI detected category if it's more specific, otherwise use selected
            const finalCategory = metadata.category !== 'ఇతరాలు' ? metadata.category : selectedCategory;
            
            const finalCategories = [finalCategory];
            if (isLocalNews && selectedDistrict) {
                finalCategories.push("Local");
                finalCategories.push(selectedDistrict);
            }

            const baseData = {
                headline: { telugu: generatedTeluguHeadline || headline, english: englishHeadline || "" },
                content: { telugu: summarizedTeluguContent || content, english: englishContent || "" },
                mediaUrl,
                mediaType: mediaFile?.type.startsWith('video') ? 'video' : (isEditMode ? postToEdit?.mediaType : 'image'),
                postFormat: PostFormat.VERTICAL,
                categories: Array.from(new Set(finalCategories)), 
                category: finalCategory,
                tags: metadata.keywords || [],
                entities: metadata.entities || { people: [], organizations: [], locations: [] },
                location: selectedDistrict || 'General',
                district: selectedDistrict || 'General',
                state: 'General',
                tone: metadata.tone || 'తటస్థ వార్త'
            };

            if (isEditMode) {
                await updateDoc(doc(db, 'news', postToEdit!.id), {
                    ...baseData,
                    updatedAt: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'news'), {
                    ...baseData,
                    timestamp: serverTimestamp(),
                    reporter: { id: user.id, name: user.name },
                    likes: 0,
                    comments: 0,
                    shares: 0
                });
            }
            onActionComplete();
        } catch (e: any) { alert("Error: " + e.message); } finally { setIsSubmitting(false); }
    };

    const inputClass = "w-full border-2 p-4 rounded-xl text-xl mb-4 text-black";

    return (
        <div className="bg-white p-5 rounded-2xl shadow-xl font-mallanna text-black">
            <h2 className="text-3xl font-ramabhadra mb-6">{isEditMode ? 'సవరించండి' : 'కొత్త వార్త'}</h2>
            <form onSubmit={handleSubmit}>
                <input type="text" className={inputClass} value={headline} onChange={e => setHeadline(e.target.value)} placeholder="హెడ్ లైన్..." required />
                <textarea rows={6} className={inputClass} value={content} onChange={e => setContent(e.target.value)} placeholder="వార్త వివరాలు..." required />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select className={inputClass} value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="flex flex-col mb-4">
                        <select className="w-full border-2 p-4 rounded-xl text-xl text-black mb-2" value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)}>
                            <option value="">జిల్లాను ఎంచుకోండి (ఐచ్ఛికం)</option>
                            {[...TS_DISTRICTS, ...AP_DISTRICTS].map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <label className="flex items-center gap-2 px-2 cursor-pointer">
                            <input type="checkbox" checked={isLocalNews} onChange={e => setIsLocalNews(e.target.checked)} className="w-5 h-5" />
                            <span className="text-lg">ఇది స్థానిక (Local) వార్త</span>
                        </label>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-gray-500 mb-2">మీడియా అప్‌లోడ్ (ఫోటో/వీడియో)</label>
                    <input type="file" onChange={handleFileChange} className="w-full" />
                </div>
                {mediaPreview && <img src={mediaPreview} className="w-full h-48 object-cover rounded-xl mb-4" alt="Preview" />}

                <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white font-bold py-5 rounded-2xl text-2xl shadow-xl active:scale-95 transition-all">
                    {isSubmitting ? statusMessage : 'పబ్లిష్ చేయండి'}
                </button>
            </form>
        </div>
    );
};

export default PostNewsPage;
