
import React, { useState, useEffect } from 'react';
import { User, UserRole, LocalAd, AdStatus } from '../types';
import { db, storage } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _storage from 'firebase/storage';

const { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, orderBy } = _firestore as any;
const { ref, uploadBytes, getDownloadURL } = _storage as any;

const TS_DISTRICTS = [
    'ఆదిలాబాద్', 'భద్రాద్రి కొత్తగూడెం', 'హన్మకొండ', 'హైదరాబాద్', 'జగిత్యాల', 'జనగాం', 'జయశంకర్ భూపాలపల్లి', 
    'జోగులాంబ గద్వాల', 'కామారెడ్డి', 'కరీంనగర్', 'ఖమ్మం', 'కుమ్రం భీమ్ ఆసిఫాబాద్', 'మహబూబాబాద్', 'మహబూబ్ నగర్', 
    'మంచిర్యాల', 'మెదక్', 'మేడ్చల్ మల్కాజిగిరి', 'ములుగు', 'నాగర్ కర్నూల్', 'నల్గొండ', 'నారాయణపేట', 'నిర్మల్', 
    'నిజామాబాద్', 'పెద్దపల్లి', 'రాజన్న సిరిసిల్ల', 'రంగారెడ్డి', 'సంగారెడ్డి', 'సిద్దిపేట', 'సూర్యాపేట', 
    'వికారాబాద్', 'వనపర్తి', 'వరంగల్', 'యాదాద్రి భువనగిరి'
];

const AP_DISTRICTS = [
    'అల్లూరి సీతారామరాజు', 'అనకాపల్లి', 'అనంతపురం', 'అన్నమయ్య', 'బాపట్ల', 'చిత్తూరు', 'కోనసీమ', 
    'తూర్పు గోదావరి', 'ఏలూరు', 'గుంటూరు', 'కాకినాడ', 'కృష్ణా', 'కర్నూలు', 'నంద్యాల', 'ఎన్టీఆర్', 
    'పల్నాడు', 'పార్వతీపురం మన్యం', 'ప్రకాశం', 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు', 'శ్రీ సత్యసాయి', 
    'శ్రీకాకుళం', 'తిరుపతి', 'విశాఖపట్నం', 'విజయనగరం', 'పశ్చిమ గోదావరి', 'వైఎస్ఆర్ కడప'
];

interface AdsManagerPageProps {
  currentUser: User;
}

const AdsManagerPage: React.FC<AdsManagerPageProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'my_ads' | 'admin'>('create');
  
  // Create Ad State
  const [adImage, setAdImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [targetState, setTargetState] = useState('ALL');
  const [targetDistrict, setTargetDistrict] = useState('ALL');
  const [viewsOrdered, setViewsOrdered] = useState<number>(10000);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // My Ads State
  const [myAds, setMyAds] = useState<LocalAd[]>([]);
  const [loadingMyAds, setLoadingMyAds] = useState(false);

  // Admin State
  const [pendingAds, setPendingAds] = useState<LocalAd[]>([]);

  // Config
  const MIN_AMOUNT = 2000;
  const COST_PER_VIEW = 0.20; // 20 paise per view

  const totalAmount = Math.max(MIN_AMOUNT, viewsOrdered * COST_PER_VIEW);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAdImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adImage) {
        alert("దయచేసి యాడ్ బ్యానర్‌ను అప్‌లోడ్ చేయండి.");
        return;
    }

    setIsSubmitting(true);
    try {
        // Upload Image
        const storageRef = ref(storage, `local-ads/${Date.now()}-${adImage.name}`);
        const uploadResult = await uploadBytes(storageRef, adImage);
        const bannerUrl = await getDownloadURL(uploadResult.ref);

        const newAd: Omit<LocalAd, 'id'> = {
            userId: currentUser.id,
            userName: currentUser.name,
            bannerUrl,
            targetState,
            targetDistrict,
            viewsOrdered,
            viewsCurrent: 0,
            costPerView: COST_PER_VIEW,
            totalAmount,
            status: AdStatus.PENDING_PAYMENT, // Initial Status
            createdAt: Date.now()
        };

        await addDoc(collection(db, 'local_ads'), newAd);
        alert(`యాడ్ రిక్వెస్ట్ సబ్మిట్ చేయబడింది! పేమెంట్ కోసం అడ్మిన్ మిమ్మల్ని సంప్రదిస్తారు. (Amount: ₹${totalAmount})`);
        
        // Reset
        setAdImage(null);
        setImagePreview(null);
        setViewsOrdered(10000);
        setActiveTab('my_ads');
        fetchMyAds();

    } catch (error) {
        console.error("Error creating ad:", error);
        alert("యాడ్ సబ్మిట్ చేయడంలో లోపం ఏర్పడింది.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const fetchMyAds = async () => {
      setLoadingMyAds(true);
      try {
          const q = query(collection(db, 'local_ads'), where('userId', '==', currentUser.id), orderBy('createdAt', 'desc'));
          const snapshot = await getDocs(q);
          const ads = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as LocalAd));
          setMyAds(ads);
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingMyAds(false);
      }
  };

  const fetchPendingAds = async () => {
      if (currentUser.role !== UserRole.ADMIN) return;
      try {
          // Fetch ads that are pending payment or approval
          const q = query(collection(db, 'local_ads'), orderBy('createdAt', 'desc'));
          const snapshot = await getDocs(q);
          const ads = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as LocalAd));
          setPendingAds(ads.filter((ad: LocalAd) => ad.status !== AdStatus.COMPLETED && ad.status !== AdStatus.REJECTED));
      } catch (e) {
          console.error(e);
      }
  };

  useEffect(() => {
      if (activeTab === 'my_ads') fetchMyAds();
      if (activeTab === 'admin') fetchPendingAds();
  }, [activeTab]);

  const handleAdminAction = async (adId: string, action: 'APPROVE' | 'REJECT' | 'MARK_PAID') => {
      try {
          const adRef = doc(db, 'local_ads', adId);
          let updates = {};
          
          if (action === 'MARK_PAID') {
              updates = { status: AdStatus.PENDING_APPROVAL };
          } else if (action === 'APPROVE') {
              updates = { status: AdStatus.ACTIVE, approvedAt: Date.now() };
          } else if (action === 'REJECT') {
              updates = { status: AdStatus.REJECTED };
          }

          await updateDoc(adRef, updates);
          fetchPendingAds(); // Refresh
      } catch (e) {
          console.error(e);
          alert("Action failed");
      }
  };

  return (
    <div className="bg-white rounded-lg shadow min-h-[80vh]">
      {/* Tabs */}
      <div className="flex border-b">
        <button 
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-4 text-xl font-bold ${activeTab === 'create' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}
        >
            కొత్త యాడ్
        </button>
        <button 
            onClick={() => setActiveTab('my_ads')}
            className={`flex-1 py-4 text-xl font-bold ${activeTab === 'my_ads' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}
        >
            నా యాడ్స్
        </button>
        {currentUser.role === UserRole.ADMIN && (
            <button 
                onClick={() => setActiveTab('admin')}
                className={`flex-1 py-4 text-xl font-bold ${activeTab === 'admin' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}
            >
                అడ్మిన్
            </button>
        )}
      </div>

      <div className="p-6">
        {/* CREATE TAB */}
        {activeTab === 'create' && (
            <form onSubmit={handleCreateAd} className="space-y-6 max-w-2xl mx-auto">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
                    <h3 className="font-bold text-lg mb-2">నిబంధనలు:</h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                        <li>కేవలం బ్యానర్ ఇమేజ్ మాత్రమే చూపబడుతుంది. లింకులు, ఫోన్ నెంబర్లు క్లిక్ చేస్తే రావు (ఇమేజ్‌లో ఉంటే పర్వాలేదు).</li>
                        <li>కనీస ఛార్జీ ₹{MIN_AMOUNT}.</li>
                        <li>ప్రతి వ్యూ కి ₹{COST_PER_VIEW} ఛార్జ్ చేయబడుతుంది.</li>
                    </ul>
                </div>

                {/* Image Upload */}
                <div>
                    <label className="block text-xl font-medium text-gray-700 mb-2">యాడ్ బ్యానర్ (Fixed Size)</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 relative">
                        <input type="file" onChange={handleImageChange} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" />
                        {imagePreview ? (
                            <img src={imagePreview} alt="Preview" className="h-40 mx-auto object-contain" />
                        ) : (
                            <div className="text-gray-500">
                                <p className="text-lg">ఇక్కడ క్లిక్ చేసి ఇమేజ్ అప్‌లోడ్ చేయండి</p>
                                <p className="text-sm">(JPG, PNG, GIF Allowed)</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Targeting */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xl font-medium text-gray-700 mb-2">రాష్ట్రం</label>
                        <select 
                            value={targetState} 
                            onChange={e => { setTargetState(e.target.value); setTargetDistrict('ALL'); }}
                            className="w-full border p-3 rounded-lg text-lg"
                        >
                            <option value="ALL">అందరికీ (Default)</option>
                            <option value="TS">తెలంగాణ</option>
                            <option value="AP">ఆంధ్రప్రదేశ్</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xl font-medium text-gray-700 mb-2">జిల్లా</label>
                        <select 
                            value={targetDistrict}
                            onChange={e => setTargetDistrict(e.target.value)}
                            disabled={targetState === 'ALL'}
                            className="w-full border p-3 rounded-lg text-lg disabled:bg-gray-100"
                        >
                            <option value="ALL">రాష్ట్రం మొత్తం</option>
                            {targetState === 'TS' && TS_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                            {targetState === 'AP' && AP_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>

                {/* Views & Billing */}
                <div>
                    <label className="block text-xl font-medium text-gray-700 mb-2">ఎన్ని వ్యూస్ కావాలి?</label>
                    <input 
                        type="number" 
                        min="1000"
                        step="1000"
                        value={viewsOrdered}
                        onChange={e => setViewsOrdered(Number(e.target.value))}
                        className="w-full border p-3 rounded-lg text-lg"
                    />
                </div>

                <div className="bg-gray-100 p-4 rounded-lg flex justify-between items-center">
                    <span className="text-xl font-bold">మొత్తం చెల్లించాల్సినది:</span>
                    <span className="text-3xl font-bold text-red-600">₹ {totalAmount.toLocaleString()}</span>
                </div>

                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-red-600 text-white font-bold text-xl py-4 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                    {isSubmitting ? 'ప్రాసెస్ జరుగుతోంది...' : 'సబ్మిట్ చేయండి'}
                </button>
            </form>
        )}

        {/* MY ADS TAB */}
        {activeTab === 'my_ads' && (
            <div className="space-y-4">
                {loadingMyAds ? <p>Loading...</p> : myAds.length === 0 ? <p>మీరు ఇంకా ఏ యాడ్స్ పోస్ట్ చేయలేదు.</p> : (
                    myAds.map(ad => (
                        <div key={ad.id} className="border rounded-lg p-4 flex flex-col md:flex-row gap-4">
                            <img src={ad.bannerUrl} alt="Ad" className="w-full md:w-32 h-20 object-cover rounded bg-black" />
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-lg">{ad.targetDistrict === 'ALL' ? (ad.targetState === 'ALL' ? 'అందరికీ' : `${ad.targetState} మొత్తం`) : ad.targetDistrict}</p>
                                        <p className="text-sm text-gray-500">Ordered: {ad.viewsOrdered.toLocaleString()} Views</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-sm font-bold ${
                                        ad.status === AdStatus.ACTIVE ? 'bg-green-100 text-green-800' : 
                                        ad.status === AdStatus.COMPLETED ? 'bg-gray-200 text-gray-800' :
                                        ad.status === AdStatus.REJECTED ? 'bg-red-100 text-red-800' :
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {ad.status}
                                    </span>
                                </div>
                                {/* Progress Bar */}
                                <div className="mt-2">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span>Progress</span>
                                        <span>{ad.viewsCurrent} / {ad.viewsOrdered}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min(100, (ad.viewsCurrent / ad.viewsOrdered) * 100)}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}

        {/* ADMIN TAB */}
        {activeTab === 'admin' && currentUser.role === UserRole.ADMIN && (
            <div className="space-y-4">
                <h3 className="font-bold text-xl mb-4">Pending Approvals</h3>
                {pendingAds.length === 0 ? <p>No pending ads.</p> : pendingAds.map(ad => (
                    <div key={ad.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex gap-4">
                             <img src={ad.bannerUrl} className="w-32 h-20 object-cover bg-black" />
                             <div className="flex-1">
                                 <p className="font-bold">User: {ad.userName}</p>
                                 <p>Target: {ad.targetDistrict}, {ad.targetState}</p>
                                 <p>Amount: ₹{ad.totalAmount} (for {ad.viewsOrdered} views)</p>
                                 <p className="text-sm text-gray-500">ID: {ad.id}</p>
                             </div>
                        </div>
                        <div className="mt-4 flex gap-2 justify-end">
                            {ad.status === AdStatus.PENDING_PAYMENT && (
                                <button onClick={() => handleAdminAction(ad.id, 'MARK_PAID')} className="bg-blue-600 text-white px-4 py-2 rounded">Mark Paid</button>
                            )}
                            {ad.status === AdStatus.PENDING_APPROVAL && (
                                <>
                                    <button onClick={() => handleAdminAction(ad.id, 'APPROVE')} className="bg-green-600 text-white px-4 py-2 rounded">Approve & Live</button>
                                    <button onClick={() => handleAdminAction(ad.id, 'REJECT')} className="bg-red-600 text-white px-4 py-2 rounded">Reject</button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default AdsManagerPage;
