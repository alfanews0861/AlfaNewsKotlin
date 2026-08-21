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
        userId: currentUser.id, title, description, price: Number(price), category, location, contactPhone, imageUrl, timestamp: serverTimestamp(),
      });
      alert("ప్రకటన పబ్లిష్ అయింది!");
      onSuccess();
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="bg-white p-4 h-full overflow-y-auto">
      <h2 className="text-2xl font-ramabhadra mb-4">కొత్త ప్రకటన</h2>
      <form onSubmit={handleSubmit} className="space-y-4 pb-20">
        <input type="text" placeholder="వస్తువు పేరు" value={title} onChange={e => setTitle(e.target.value)} className="w-full border p-3 rounded" required />
        <input type="number" placeholder="ధర (₹)" value={price} onChange={e => setPrice(e.target.value)} className="w-full border p-3 rounded" required />
        <input type="tel" placeholder="ఫోన్ నెంబర్" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="w-full border p-3 rounded" required />
        <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="w-full" required />
        <textarea placeholder="పూర్తి వివరాలు" value={description} onChange={e => setDescription(e.target.value)} className="w-full border p-3 rounded" rows={4} />
        <div className="flex gap-2">
            <button type="submit" disabled={isSubmitting} className="flex-1 bg-red-600 text-white p-3 rounded font-bold">{isSubmitting ? 'లోడింగ్...' : 'పోస్ట్ చేయి'}</button>
            <button type="button" onClick={onCancel} className="flex-1 bg-gray-500 text-white p-3 rounded">రద్దు</button>
        </div>
      </form>
    </div>
  );
};

export default PostClassifiedAd;