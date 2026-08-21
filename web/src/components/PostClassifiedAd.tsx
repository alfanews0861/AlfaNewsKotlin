
import React, { useState } from 'react';
import { ClassifiedCategories, User } from '../types';
import { db, storage } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _storage from 'firebase/storage';

const { collection, addDoc, serverTimestamp } = _firestore as any;
const { ref, uploadBytes, getDownloadURL } = _storage as any;

interface PostClassifiedAdProps {
  currentUser: User;
  onSuccess: () => void;
  onCancel: () => void;
}

const PostClassifiedAd: React.FC<PostClassifiedAdProps> = ({ currentUser, onSuccess, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(ClassifiedCategories[0]);
  const [location, setLocation] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price || !imageFile) { alert("ప్రకటన వివరాలు పూర్తి చేయండి."); return; }
    setIsSubmitting(true);
    try {
      const storageRef = ref(storage, `classifieds-media/${Date.now()}-${imageFile.name}`);
      const uploadResult = await uploadBytes(storageRef, imageFile);
      const imageUrl = await getDownloadURL(uploadResult.ref);
      await addDoc(collection(db, 'classifieds'), {
        userId: currentUser.id, 
        userName: currentUser.name,
        title, 
        description, 
        price: Number(price), 
        category, 
        location, 
        contactPhone, 
        imageUrl, 
        timestamp: serverTimestamp(),
      });
      alert("ప్రకటన పబ్లిష్ అయింది!");
      onSuccess();
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const inputClass = "w-full border border-gray-300 p-3 rounded-lg text-lg text-gray-900 bg-white focus:ring-2 focus:ring-red-500 outline-none";

  return (
    <div className="absolute inset-0 bg-white flex flex-col text-black font-mallanna z-10">
      <div className="p-4 bg-gray-100 border-b flex justify-between items-center shrink-0">
         <h2 className="text-2xl font-ramabhadra text-gray-800">కొత్త ప్రకటన</h2>
         <button onClick={onCancel} className="text-red-600 font-bold text-lg">రద్దు</button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-4 pb-20">
            <div className="space-y-1">
                <label className="font-bold text-gray-700">వస్తువు పేరు</label>
                <input type="text" placeholder="ఉదా: బైక్ అమ్మబడును" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} required />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="font-bold text-gray-700">ధర (₹)</label>
                    <input type="number" placeholder="ధర" value={price} onChange={e => setPrice(e.target.value)} className={inputClass} required />
                </div>
                <div className="space-y-1">
                    <label className="font-bold text-gray-700">కేటగిరి</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className={inputClass}>
                        {ClassifiedCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
            </div>

            <div className="space-y-1">
                <label className="font-bold text-gray-700">లొకేషన్</label>
                <input type="text" placeholder="మీ ఊరు/నగరం" value={location} onChange={e => setLocation(e.target.value)} className={inputClass} required />
            </div>

            <div className="space-y-1">
                <label className="font-bold text-gray-700">ఫోన్ నెంబర్</label>
                <input type="tel" placeholder="9876543210" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={inputClass} required />
            </div>

            <div className="space-y-1">
                <label className="font-bold text-gray-700">ఫోటో</label>
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="w-full text-gray-900" required />
            </div>

            <div className="space-y-1">
                <label className="font-bold text-gray-700">వివరాలు</label>
                <textarea placeholder="పూర్తి వివరాలు ఇక్కడ రాయండి..." value={description} onChange={e => setDescription(e.target.value)} className={inputClass} rows={4} />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white p-4 rounded-xl font-bold text-xl shadow-lg">
                {isSubmitting ? 'పబ్లిష్ అవుతోంది...' : 'ప్రకటనను పోస్ట్ చేయి'}
            </button>
        </form>
      </div>
    </div>
  );
};

export default PostClassifiedAd;
