
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

  const isStaff = [UserRole.REPORTER, UserRole.EDITOR, UserRole.ADMIN].includes(user.role);

  const getPolicyIcon = (id: string) => {
      const className = "h-5 w-5 text-gray-500";
      switch(id) {
          case 'about': return <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>;
          case 'contact': return <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>;
          case 'privacy-policy': return <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2.166 10.324A.75.75 0 012.592 9.5l.395-.131c3.08-.98 6.55-1.572 8.527-1.127 2.036-.458 5.71 1.281 8.527 1.127a.75.75 0 01.395.131l.009.006c.002.002.005.003.007.005.035.022.091.059.167.112.152.106.376.27.64.482.528.423 1.24 1.045 1.82 1.856.577.808 1.026 1.815 1.22 2.98.196 1.173.064 2.47-.56 3.738-.636 1.29-1.66 2.37-2.91 3.125-1.25.755-2.736 1.19-4.32 1.353-1.594.162-3.236-.056-4.68-.696-1.428-.632-2.67-1.63-3.61-2.906-.946-1.282-1.547-2.827-1.673-4.526a.75.75 0 01.125-.515zM10 12a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>; 
          case 'terms': return <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>;
          case 'content-policy': return <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm12 1a1 1 0 110 2 1 1 0 010-2zm0 3a1 1 0 110 2 1 1 0 010-2zm0 3a1 1 0 110 2 1 1 0 010-2zM5 7h5v2H5V7zm5 4H5v2h5v-2z" clipRule="evenodd" /></svg>;
          case 'disclaimer': return <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
          case 'ad-policy': return <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>;
          case 'data-collection': return <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>;
          default: return <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>;
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

            <div className="w-full max-w-sm space-y-4 mb-8">
                <button 
                    onClick={onLoginRequest}
                    className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-xl shadow-xl hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                    లాగిన్ / సైన్ అప్
                </button>
                <p className="text-center text-gray-400 text-sm px-4">
                    వార్తలపై స్పందించడానికి మరియు మీ ప్రాంత వార్తలను చూడటానికి లాగిన్ అవ్వండి.
                </p>
            </div>

            <div className="w-full max-w-sm bg-white p-5 rounded-2xl shadow-md border border-gray-100 mb-6">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Settings / సెట్టింగ్స్</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-base font-bold text-gray-600 block mb-2">భాషను ఎంచుకోండి (Language)</label>
                        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                            <button 
                                onClick={() => setLanguage(Language.TELUGU)} 
                                className={`flex-1 py-2 rounded-lg text-base font-bold transition-all ${language === Language.TELUGU ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                            >
                                తెలుగు
                            </button>
                            <button 
                                onClick={() => setLanguage(Language.ENGLISH)} 
                                className={`flex-1 py-2 rounded-lg text-base font-bold transition-all ${language === Language.ENGLISH ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                            >
                                English
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="w-full max-w-sm">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 pl-2">Legal & Support</h3>
                <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                    {policyLinks.map((p, i) => (
                        <button 
                            key={p.id} 
                            onClick={() => window.location.hash = `#/${p.id}`} 
                            className={`w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 transition-colors ${i !== policyLinks.length - 1 ? 'border-b border-gray-100' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="p-2 bg-gray-50 rounded-xl text-gray-400">
                                    {getPolicyIcon(p.id)}
                                </span>
                                <span className="font-bold text-gray-700 text-lg">{p.label.split(' (')[0]}</span>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 relative animate-fade-in bg-gray-50 min-h-full pt-4 font-mallanna">
      <div className="bg-white rounded-3xl mx-3 p-6 shadow-md border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-gray-800 to-black z-0"></div>
        <div className="relative z-10 mt-8">
            <div className="relative inline-block">
                <img 
                    src={user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} 
                    className="w-28 h-28 rounded-full border-4 border-white shadow-xl object-cover bg-white" 
                    alt="Profile" 
                />
            </div>
        </div>
        <h2 className="text-2xl font-ramabhadra text-gray-900 mt-3 font-bold">{user.name}</h2>
        <p className="text-gray-500 text-sm">{user.email || user.phone}</p>
        
        <div className="flex flex-wrap justify-center gap-2 mt-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${isStaff ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                {user.role}
            </span>
        </div>

        <div className="flex gap-3 mt-6 w-full max-w-sm">
            <button 
                onClick={() => setEditModalOpen(true)}
                className="flex-1 bg-black text-white py-3 rounded-xl font-bold text-sm shadow hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
            >
                Edit Profile
            </button>
            {isStaff && (
                <button 
                    onClick={() => setShowIdCard(true)}
                    className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                    View ID Card
                </button>
            )}
        </div>
      </div>

      <div className="px-3 space-y-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-ramabhadra text-lg text-gray-800 mb-4 font-bold">సెట్టింగ్స్ (Settings)</h3>
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Language / భాష</label>
                <div className="flex bg-gray-100 p-1.5 rounded-xl">
                    <button onClick={() => setLanguage(Language.TELUGU)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${language === Language.TELUGU ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>తెలుగు</button>
                    <button onClick={() => setLanguage(Language.ENGLISH)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${language === Language.ENGLISH ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}>English</button>
                </div>
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest p-4 pb-0">Policy & Legal</h3>
            {policyLinks.map((p, i) => (
                <button 
                    key={p.id} 
                    onClick={() => window.location.hash = `#/${p.id}`} 
                    className={`w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 transition-colors ${i !== policyLinks.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                    <div className="flex items-center gap-3">
                        <span className="p-2 bg-gray-50 rounded-xl text-gray-400">
                            {getPolicyIcon(p.id)}
                        </span>
                        <span className="font-bold text-gray-700 text-lg">{p.label.split(' (')[0]}</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                </button>
            ))}
        </div>

        <div className="flex flex-col gap-3 pt-2">
            <button onClick={handleLogout} className="w-full bg-white border border-gray-300 text-gray-800 p-3 rounded-xl font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">లాగౌట్ (Logout)</button>
            <button onClick={handleDelete} className="w-full text-red-500 py-3 font-bold text-xs">ఖాతాను తొలగించండి (Delete Account)</button>
        </div>
      </div>

      <EditProfileModal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} user={user} isStaff={isStaff} defaultPhoto={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} defaultSignature="https://via.placeholder.com/150?text=Signature" onSave={handleSaveProfile} saving={isSaving} />
      <IdCardModal show={showIdCard} onClose={() => setShowIdCard(false)} user={user} displayPhoto={user.photoUrl || "https://via.placeholder.com/150"} displaySignature={user.signatureUrl || "https://via.placeholder.com/150?text=Signature"} />
    </div>
  );
};

export default UserProfilePage;
