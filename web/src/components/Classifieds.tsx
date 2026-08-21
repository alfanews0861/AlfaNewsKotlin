import React, { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _auth from 'firebase/auth';
import { ClassifiedAd, ClassifiedCategories, User, UserRole } from '../types';
import ClassifiedAdCard from './ClassifiedAdCard';
import PostClassifiedAd from './PostClassifiedAd';

// Workaround for Firebase v9 imports in certain TS environments
const { collection, query, orderBy, onSnapshot, where, deleteDoc, doc, Timestamp, writeBatch, serverTimestamp, limit } = _firestore as any;
const { onAuthStateChanged } = _auth as any;

// Category Icons
const RealEstateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const VehicleIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>; // Placeholder for speed/vehicle
const ElectronicsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
const JobsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
const ServicesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const FurnitureIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>; // Box icon as furniture placeholder
const OthersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>;
const AllIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;

const categoryIcons: Record<string, any> = {
  'స్థిరాస్తి (Real Estate)': RealEstateIcon,
  'వాహనాలు (Vehicles)': VehicleIcon,
  'ఎలక్ట్రానిక్స్ (Electronics)': ElectronicsIcon,
  'ఉద్యోగాలు (Jobs)': JobsIcon,
  'సేవలు (Services)': ServicesIcon,
  'ఫర్నిచర్ (Furniture)': FurnitureIcon,
  'ఇతర (Others)': OthersIcon,
  'All': AllIcon
};

const Classifieds: React.FC = () => {
  const [view, setView] = useState<'feed' | 'post' | 'my-ads'>('feed');
  const [ads, setAds] = useState<ClassifiedAd[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: any) => {
      if (firebaseUser) {
        setCurrentUser({
           id: firebaseUser.uid,
           name: firebaseUser.displayName || 'User',
           role: UserRole.SUBSCRIBER,
           email: firebaseUser.email || undefined,
           phone: firebaseUser.phoneNumber || undefined
        } as User);
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Ads
  useEffect(() => {
    setLoading(true);
    try {
        const adsRef = collection(db, 'classifieds');
        let q = query(adsRef, orderBy('timestamp', 'desc'), limit(50));

        if (view === 'my-ads' && currentUser) {
            q = query(adsRef, where('userId', '==', currentUser.id), orderBy('timestamp', 'desc'), limit(50));
        }

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
          const fetchedAds = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            const ts = data.timestamp instanceof Timestamp ? data.timestamp.toDate().getTime() : Date.now();
            return { id: doc.id, ...data, timestamp: ts } as ClassifiedAd;
          });
          setAds(fetchedAds);
          setLoading(false);
        }, (error: any) => {
            console.error("Error fetching ads:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    } catch (e) {
        console.error("Setup error in Classifieds:", e);
        setLoading(false);
    }
  }, [view, currentUser]);

  const handleDelete = async (adId: string) => {
    if (window.confirm("ఈ ప్రకటనను శాశ్వతంగా తొలగించాలనుకుంటున్నారా?")) {
        try {
            await deleteDoc(doc(db, 'classifieds', adId));
        } catch (e) {
            console.error("Delete error", e);
            alert("తొలగించడం విఫలమైంది.");
        }
    }
  };

  const generateMockData = async () => {
      if (!window.confirm("ప్రతి కేటగిరీకి 10 నకిలీ (Mock) ప్రకటనలను జోడించమంటారా?")) return;
      
      setIsGenerating(true);
      const batch = writeBatch(db);
      const categories = ClassifiedCategories;
      
      const mockTitles: Record<string, string[]> = {
          'స్థిరాస్తి (Real Estate)': ['2BHK ప్లాట్ అమ్మబడును', 'వ్యవసాయ భూమి అమ్మకానికి ఉంది', 'హైదరాబాద్‌లో ఇండిపెండెంట్ హౌస్', 'కమర్షియల్ షాప్ రెంట్', 'ఓపెన్ ప్లాట్ అమ్మకం'],
          'వాహనాలు (Vehicles)': ['Maruti Swift 2020 అమ్మబడును', 'Royal Enfield 350cc', 'Tractor అమ్మకానికి ఉంది', 'Honda Activa తక్కువ ధరకు', 'Innova Crysta 2018'],
          'ఎలక్ట్రానిక్స్ (Electronics)': ['iPhone 13 Pro అమ్మబడును', 'Samsung Smart TV 55 Inch', 'Dell Laptop i5', 'Sony Camera Kit', 'Washing Machine'],
          'ఉద్యోగాలు (Jobs)': ['డేటా ఎంట్రీ ఆపరేటర్ కావలెను', 'డెలివరీ బాయ్స్ కావలెను', 'సేల్స్ ఎగ్జిక్యూటివ్ జాబ్', 'అకౌంటెంట్ కావలెను', 'రిసెప్షనిస్ట్ ఉద్యోగం'],
          'సేవలు (Services)': ['ఇంటి పెయింటింగ్ సర్వీస్', 'Plumber అందుబాటులో ఉన్నారు', 'AC రిపేర్ సర్వీస్', 'Wedding Photography', 'Catering Services'],
          'ఫర్నిచర్ (Furniture)': ['Sofa Set అమ్మబడును', 'Dining Table 6 Seater', 'Wooden Bed King Size', 'Office Chair', 'Study Table'],
          'ఇతర (Others)': ['వ్యవసాయ పరికరాలు', 'పురాతన నాణేలు', 'జిమ్ సామాగ్రి', 'పుస్తకాల సెట్', 'పెట్స్ (కుక్క పిల్లలు)']
      };

      try {
        let count = 0;
        for (const cat of categories) {
            const titles = mockTitles[cat] || ['సాధారణ ప్రకటన'];
            for (let i = 0; i < 10; i++) {
                const titleBase = titles[i % titles.length];
                const adRef = doc(collection(db, "classifieds"));
                batch.set(adRef, {
                    userId: 'SYSTEM_MOCK',
                    userName: 'ఆల్ఫా అడ్మిన్',
                    title: `${titleBase} - ${i + 1}`,
                    description: `ఇది ఒక టెస్ట్ ప్రకటన. ${cat} కేటగిరీలో ఈ వస్తువు/సేవ అందుబాటులో ఉంది. ఆసక్తి ఉన్నవారు వెంటనే సంప్రదించండి. కండిషన్ చాలా బాగుంది.`,
                    price: Math.floor(Math.random() * 50000) + 500,
                    category: cat,
                    location: i % 2 === 0 ? 'హైదరాబాద్' : 'విజయవాడ',
                    contactPhone: '9876543210',
                    imageUrl: `https://source.unsplash.com/random/400x300?${cat.split(' ')[0]}`, // Random image from Unsplash based on keyword
                    timestamp: serverTimestamp()
                });
                count++;
            }
        }
        await batch.commit();
        alert(`${count} మాక్ ప్రకటనలు విజయవంతంగా జోడించబడ్డాయి!`);
      } catch (e) {
          console.error("Mock generation failed", e);
          alert("మాక్ డేటా జనరేషన్ విఫలమైంది.");
      } finally {
          setIsGenerating(false);
      }
  };

  const filteredAds = selectedCategory === 'All' 
    ? ads 
    : ads.filter(ad => ad.category === selectedCategory);

  if (view === 'post') {
    if (!currentUser) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-white p-6 text-center">
                <p className="text-xl mb-4 text-gray-800">ప్రకటన ఇవ్వడానికి దయచేసి లాగిన్ అవ్వండి.</p>
                <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold">లాగిన్ పేజీకి వెళ్ళండి</button>
                <button onClick={() => setView('feed')} className="mt-4 text-gray-500 underline">వెనక్కి వెళ్ళు</button>
            </div>
        );
    }
    return <PostClassifiedAd currentUser={currentUser} onSuccess={() => setView('feed')} onCancel={() => setView('feed')} />;
  }

  return (
    <div className="h-full w-full bg-gray-100 flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="bg-white shadow-sm z-20 shrink-0">
          <div className="p-4 flex justify-between items-center border-b">
             <h1 className="font-ramabhadra text-2xl text-red-600">క్లాసిఫైడ్స్</h1>
             <div className="flex gap-2">
                 {/* Feed/My Ads Toggles */}
                 <div className="flex bg-gray-100 rounded-lg p-1">
                    <button 
                        onClick={() => { setView('feed'); setSelectedCategory('All'); }}
                        className={`px-3 py-1 text-sm rounded-md font-bold ${view === 'feed' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}
                    >
                        అన్నీ
                    </button>
                    <button 
                        onClick={() => setView('my-ads')}
                        className={`px-3 py-1 text-sm rounded-md font-bold ${view === 'my-ads' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}
                    >
                        నావి
                    </button>
                 </div>
                 <button 
                    onClick={() => setView('post')} 
                    className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm font-bold shadow-sm hover:bg-red-700"
                 >
                    + పోస్ట్
                 </button>
             </div>
          </div>
          
          {/* Categories GRID (Fixed, Non-scrolling) */}
          {view === 'feed' && (
            <div className="p-3 bg-white border-b grid grid-cols-4 gap-2">
                <button 
                    onClick={() => setSelectedCategory('All')}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${selectedCategory === 'All' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-100 text-gray-600'}`}
                >
                    <AllIcon />
                    <span className="text-[10px] mt-1 font-bold">అన్నీ</span>
                </button>

                {ClassifiedCategories.map(cat => {
                    const Icon = categoryIcons[cat] || OthersIcon;
                    const label = cat.split(' ')[0]; // Take Telugu part only
                    const isActive = selectedCategory === cat;
                    
                    return (
                        <button 
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${isActive ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-100 text-gray-600'}`}
                        >
                            <Icon />
                            <span className="text-[10px] mt-1 font-bold truncate w-full text-center">{label}</span>
                        </button>
                    );
                })}
            </div>
          )}
      </div>

      {/* Ads Content Area */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 pb-24 relative">
         {loading ? (
             <div className="flex items-center justify-center h-64">
                 <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
             </div>
         ) : filteredAds.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                 </svg>
                 <p className="text-lg">ప్రకటనలు ఏవీ లేవు.</p>
                 <button onClick={() => setView('post')} className="mt-4 text-red-600 font-bold underline">మొదటి ప్రకటన ఇవ్వండి</button>
             </div>
         ) : (
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                 {filteredAds.map(ad => (
                     <div key={ad.id || Math.random().toString()} className="h-full">
                         <ClassifiedAdCard 
                            ad={ad} 
                            isOwner={currentUser?.id === ad.userId}
                            onDelete={view === 'my-ads' ? handleDelete : undefined}
                         />
                     </div>
                 ))}
             </div>
         )}

         {/* Mock Data Generator Button (Development Helper) */}
         <div className="mt-8 mb-4 text-center">
             <button 
                onClick={generateMockData} 
                disabled={isGenerating}
                className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded hover:bg-gray-300"
             >
                {isGenerating ? 'Generating...' : '🛠 Load Mock Data (Dev Only)'}
             </button>
         </div>
      </div>
    </div>
  );
};

export default Classifieds;