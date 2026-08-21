
import React, { useState } from 'react';
import { User, Language, UserRole } from '../types';
import { auth, db, storage } from '../services/firebase';
import * as _auth from 'firebase/auth';
import * as _firestore from 'firebase/firestore';
import * as _storage from 'firebase/storage';
import EditProfileModal from './EditProfileModal';
import IdCardModal from './IdCardModal';

const { signOut } = _auth as any;
const { doc, updateDoc, deleteDoc } = _firestore as any;
const { ref, uploadBytes, getDownloadURL } = _storage as any;

interface UserProfilePageProps {
  user: User;
  language: Language;
  setLanguage: (lang: Language) => void;
  onNavigate: (pageId: string) => void;
  onLoginRequest?: () => void;
}

const UserProfilePage: React.FC<UserProfilePageProps> = ({ user, language, setLanguage, onNavigate, onLoginRequest }) => {
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [showIdCard, setShowIdCard] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(user.pushEnabled !== false);

  const toggleNotifications = async () => {
    const newValue = !pushEnabled;
    setPushEnabled(newValue);
    try {
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, { pushEnabled: newValue });
    } catch (e) {
        console.error("Failed to update push settings", e);
    }
  };

  const handleLogout = () => signOut(auth);
  
  const handleDelete = async () => {
    if (window.confirm("ఖాతాను పూర్తిగా తొలగించాలనుకుంటున్నారా? ఈ చర్యను రద్దు చేయలేము.")) {
        try {
            await deleteDoc(doc(db, 'users', user.id));
            await signOut(auth);
        } catch(e) {
            console.error(e);
            alert("ఖాతా తొలగించడంలో సమస్య ఏర్పడింది.");
        }
    }
  };

  const handleSaveProfile = async (newName: string, newAddress: string, newDistrict: string, newPhoto: File | null, newSignature: File | null) => {
      setIsSaving(true);
      try {
          let photoUrl = user.photoUrl;
          let signatureUrl = user.signatureUrl;

          if (newPhoto) {
              const photoRef = ref(storage, `user-profiles/${user.id}/${Date.now()}_photo`);
              await uploadBytes(photoRef, newPhoto);
              photoUrl = await getDownloadURL(photoRef);
          }

          if (newSignature) {
              const signRef = ref(storage, `signatures/${user.id}/${Date.now()}_sign`);
              await uploadBytes(signRef, newSignature);
              signatureUrl = await getDownloadURL(signRef);
          }

          const userRef = doc(db, 'users', user.id);
          const updates: any = {
              name: newName,
              address: newAddress,   
              district: newDistrict, 
              photoUrl: photoUrl,
              signatureUrl: signatureUrl
          };
          await updateDoc(userRef, updates);
          setEditModalOpen(false);
      } catch (e: any) {
          console.error("Profile save error:", e);
          alert("ప్రొఫైల్ అప్‌డేట్ విఫలమైంది.");
      } finally {
          setIsSaving(false);
      }
  };

  const isStaff = [UserRole.REPORTER, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN].includes(user.role);

  // Single-color icons for policy links
  const getPolicyIcon = (id: string) => {
    const cls = "h-5 w-5 text-gray-400"; // Monochromatic color
    switch(id) {
        case 'about': return <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>;
        case 'contact': return <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>;
        case 'privacy-policy': return <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>;
        case 'terms': return <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>;
        case 'content-policy': return <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>;
        case 'disclaimer': return <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>;
        case 'ad-policy': return <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 19H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V9h2v2zm10 8h-8v-2h8v2zm0-4h-8v-2h8v2zm0-4h-8V9h8v2z"/></svg>;
        case 'data-collection': return <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>;
        default: return <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>;
    }
  };

  const policyLinks = [
      { id: 'about', label: 'మా గురించి (About Us)' },
      { id: 'contact', label: 'మమ్మల్ని సంప్రదించండి (Contact)' },
      { id: 'privacy-policy', label: 'గోప్యతా విధానం (Privacy Policy)' },
      { id: 'terms', label: 'సేవా నిబంధనలు (Terms)' },
      { id: 'content-policy', label: 'కంటెంట్ విధానం (Content Policy)' },
      { id: 'disclaimer', label: 'నిరాకరణ (Disclaimer)' },
      { id: 'ad-policy', label: 'ప్రకటనల విధానం (Ad Policy)' },
      { id: 'data-collection', label: 'డేటా సేకరణ విధానం (Data Policy)' },
  ];

  if (user.role === UserRole.GUEST) {
    return (
        <div className="flex flex-col items-center min-h-full p-4 pb-24 bg-gray-50 animate-fade-in font-mallanna">
            <div className="mt-8 mb-8 text-center w-full max-w-sm">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mx-auto mb-5 border-4 border-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                </div>
                <h2 className="text-3xl font-ramabhadra text-gray-900 font-bold mb-2">నమస్కారం!</h2>
                <p className="text-gray-500 text-lg">నిజమైన వార్తలు, మీ అరచేతిలో.</p>
            </div>
            <button onClick={onLoginRequest} className="w-full max-w-sm bg-red-600 text-white py-4 rounded-2xl font-bold text-xl shadow-xl hover:bg-red-700 active:scale-95 transition-all mb-8">లాగిన్ / సైన్ అప్</button>
        </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 relative animate-fade-in bg-gray-50 min-h-full pt-4 font-mallanna text-black">
      <div className="bg-white rounded-3xl mx-3 p-6 shadow-md border border-gray-100 flex flex-col items-center text-center">
        <img src={user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} className="w-24 h-24 rounded-full border-4 border-white shadow-lg object-cover mb-3" alt="Profile" />
        <h2 className="text-2xl font-ramabhadra text-gray-900 font-bold leading-tight">{user.name}</h2>
        <p className="text-gray-500 text-sm mb-1">{user.email || user.phone}</p>
        
        {/* ADDED ADDRESS DISPLAY */}
        {(user.address || user.district) && (
            <div className="mt-1 flex flex-col items-center">
                {user.address && <p className="text-gray-600 text-sm font-bold">{user.address}</p>}
                {user.district && <p className="text-gray-400 text-xs">{user.district}</p>}
            </div>
        )}

        <div className="flex gap-3 mt-4 w-full max-w-sm">
            <button onClick={() => setEditModalOpen(true)} className="flex-1 bg-black text-white py-3 rounded-xl font-bold text-sm shadow">Edit Profile</button>
            {isStaff && <button onClick={() => setShowIdCard(true)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-bold text-sm">View ID Card</button>}
        </div>
      </div>

      <div className="px-3 space-y-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-ramabhadra text-lg text-gray-800 mb-4 font-bold">భాష (Language)</h3>
            <div className="flex bg-gray-100 p-1.5 rounded-xl">
                <button onClick={() => setLanguage(Language.TELUGU)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${language === Language.TELUGU ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>తెలుగు</button>
                <button onClick={() => setLanguage(Language.ENGLISH)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${language === Language.ENGLISH ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>English</button>
            </div>
            {/* Subtle toggle as requested */}
            <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center opacity-40 hover:opacity-100 transition-opacity">
                <span className="text-xs font-bold text-gray-500">అలర్ట్స్ (Alerts)</span>
                <button onClick={toggleNotifications} className={`w-8 h-4 rounded-full transition-colors ${pushEnabled ? 'bg-blue-400' : 'bg-gray-300'} relative`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${pushEnabled ? 'translate-x-4.5' : 'translate-x-0.5'}`}></div>
                </button>
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
            <button onClick={() => onNavigate('job_application_external')} className="w-full bg-red-50 text-left p-4 flex justify-between items-center hover:bg-red-100 transition">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-white rounded-full flex items-center justify-center shadow-sm text-lg">🤝</div>
                    <div>
                        <span className="block font-bold text-red-900 font-ramabhadra text-lg leading-tight">రిపోర్టర్‌గా చేరండి</span>
                        <span className="block text-xs font-bold text-red-700">జాయిన్ ఆల్ఫా న్యూస్ (Apply Now)</span>
                    </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1-1.414 0z" clipRule="evenodd" /></svg>
            </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {policyLinks.map((p, i) => (
                <button key={p.id} onClick={() => window.location.hash = `#/${p.id}`} className={`w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 ${i !== policyLinks.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <div className="flex items-center gap-3">
                        {getPolicyIcon(p.id)}
                        <span className="font-bold text-gray-700">{p.label}</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1-1.414 0z" clipRule="evenodd" /></svg>
                </button>
            ))}
        </div>

        <div className="flex flex-col gap-3 pt-2">
            <button onClick={handleLogout} className="w-full bg-white border border-gray-300 text-gray-800 p-3 rounded-xl font-bold hover:bg-gray-50 transition-colors">లాగౌట్ (Logout)</button>
            <button onClick={handleDelete} className="w-full text-red-500 py-3 font-bold text-xs">ఖాతాను తొలగించండి (Delete Account)</button>
        </div>
      </div>

      <EditProfileModal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} user={user} isStaff={isStaff} defaultPhoto={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} defaultSignature="https://via.placeholder.com/150?text=Signature" onSave={handleSaveProfile} saving={isSaving} />
      <IdCardModal show={showIdCard} onClose={() => setShowIdCard(false)} user={user} displayPhoto={user.photoUrl || "https://via.placeholder.com/150"} displaySignature={user.signatureUrl || "https://via.placeholder.com/150?text=Signature"} />
    </div>
  );
};

export default UserProfilePage;
