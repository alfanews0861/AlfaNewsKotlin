
import React, { useState, useEffect } from 'react';
import NewsFeed from './src/components/NewsFeed';
import LocalNewsFeed from './src/components/LocalNewsFeed';
import LoginScreen from './src/components/LoginScreen';
import AdminPanel from './src/components/AdminPanel';
import Footer from './src/components/Footer';
import Classifieds from './src/components/Classifieds';
import ContactUsPage from './src/components/policy/ContactUsPage';
import ReporterProfileView from './src/components/ReporterProfileView';
import CreateMenu from './src/components/CreateMenu';
import { User, UserRole, Language } from './types';
import { auth, db } from './src/services/firebase';
import * as _auth from 'firebase/auth';
import * as _firestore from 'firebase/firestore';
import { getGuestId } from './src/services/analyticsService';
import PrivacyPolicyPage from './src/components/policy/PrivacyPolicyPage';
import TermsOfServicePage from './src/components/policy/TermsOfServicePage';
import AboutUsPage from './src/components/policy/AboutUsPage';
import ContentPolicyPage from './src/components/policy/ContentPolicyPage';
import DisclaimerPage from './src/components/policy/DisclaimerPage';
import AdPolicyPage from './src/components/policy/AdPolicyPage';
import DataCollectionPolicyPage from './src/components/policy/DataCollectionPolicyPage';

const { onAuthStateChanged, signOut } = _auth as any;
const { doc, getDoc, setDoc, serverTimestamp, onSnapshot } = _firestore as any;

const App: React.FC = () => {
  const [showLogin, setShowLogin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved as Language) || Language.TELUGU;
  });

  const [authChecked, setAuthChecked] = useState(false);
  const [newsReady, setNewsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [newsFeedKey, setNewsFeedKey] = useState(0); 

  const [homeViewMode, setHomeViewMode] = useState<'feed' | 'profile'>('feed');
  const [selectedReporterId, setSelectedReporterId] = useState<string | null>(null);
  const [deepLinkPostId, setDeepLinkPostId] = useState<string | null>(null);

  const guestUser: User = {
      id: 'guest-user',
      name: 'Guest',
      role: UserRole.GUEST,
      photoUrl: '', 
      email: '',
      phone: ''
  };

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  useEffect(() => {
    getGuestId();
  }, []);

  useEffect(() => {
    let userUnsub: any = null;
    const authUnsub = onAuthStateChanged(auth, async (firebaseUser: any) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
             const newUser: User = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'New User',
                email: firebaseUser.email || '',
                photoUrl: firebaseUser.photoURL || '',
                role: UserRole.SUBSCRIBER, 
              };
              await setDoc(userRef, { ...newUser, createdAt: serverTimestamp() });
        }

        userUnsub = onSnapshot(userRef, (docSnap: any) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                setCurrentUser({ id: docSnap.id, ...userData } as User);
            }
        });
        setShowLogin(false);
      } else {
        if (userUnsub) userUnsub();
        setCurrentUser(null);
      }
      setAuthChecked(true);
    });
    return () => {
        authUnsub();
        if (userUnsub) userUnsub();
    };
  }, []);

  const [currentHash, setCurrentHash] = useState(window.location.hash);
  
  useEffect(() => {
    const handleHash = () => {
        const hash = window.location.hash;
        const pathname = window.location.pathname;
        setCurrentHash(hash);
        
        // Handle /news/:id or /ad/:id redirect
        if (pathname.startsWith('/news/') || pathname.startsWith('/ad/')) {
            const segments = pathname.split('/').filter(Boolean);
            const pathType = segments[0] || 'news';
            const postId = segments.pop();
            if (postId && postId !== 'news' && postId !== 'ad') {
                const packageName = "com.alfanews.telugu";
                const playStoreUrl = `https://play.google.com/store/apps/details?id=${packageName}&referrer=news_id%3D${postId}`;
                const intentUrl = `intent://${pathType}/${postId}#Intent;scheme=alfanews;package=${packageName};S.browser_fallback_url=${encodeURIComponent(playStoreUrl)};end`;
                
                const isAndroid = /Android/i.test(navigator.userAgent);
                if (isAndroid) {
                    window.location.replace(intentUrl);
                    return;
                } else {
                    // Redirect non-Android directly to Play Store or show targeted banner
                    setDeepLinkPostId(postId);
                    setHomeViewMode('feed');
                    setActiveTab('home');
                    setNewsFeedKey(prev => prev + 1);
                }
            }
        }

        if (hash.startsWith('#/r/')) {
            const rId = hash.split('#/r/')[1];
            if (rId) {
                setSelectedReporterId(rId);
                setHomeViewMode('profile');
                setActiveTab('home');
            }
        }
        else if (hash.startsWith('#/s/')) {
            const postId = hash.split('#/s/')[1];
            if (postId) {
                setDeepLinkPostId(postId);
                setHomeViewMode('feed');
                setActiveTab('home');
                setNewsFeedKey(prev => prev + 1); 

                const isAndroid = /Android/i.test(navigator.userAgent);
                if (isAndroid) {
                    const packageName = "com.alfanews.telugu";
                    const playStoreUrl = `https://play.google.com/store/apps/details?id=${packageName}&referrer=news_id%3D${postId}`;
                    const intentUrl = `intent://news/${postId}#Intent;scheme=alfanews;package=${packageName};S.browser_fallback_url=${encodeURIComponent(playStoreUrl)};end`;
                    window.location.replace(intentUrl);
                    return;
                }
            }
        }
        else if (hash === '' || hash === '#/' || hash === '#') {
            if (homeViewMode === 'profile') {
                setHomeViewMode('feed');
                setSelectedReporterId(null);
            }
        }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [homeViewMode]);

  const getRoute = (hash: string) => {
    if (!hash) return '';
    if (hash.startsWith('#/r/') || hash.startsWith('#/s/')) return 'dynamic';
    return hash.replace('#/', '').replace('#', '').toLowerCase();
  };

  const route = getRoute(currentHash);
  
  if (route !== 'dynamic' && route !== '') {
      const policyPages: Record<string, React.FC> = {
          'privacy-policy': PrivacyPolicyPage,
          'terms': TermsOfServicePage,
          'about': AboutUsPage,
          'contact': ContactUsPage,
          'content-policy': ContentPolicyPage,
          'disclaimer': DisclaimerPage,
          'ad-policy': AdPolicyPage,
          'data-collection': DataCollectionPolicyPage
      };
      const PolicyComponent = policyPages[route];
      if (PolicyComponent) {
          return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in">
                <div className="flex items-center px-4 py-3 bg-white border-b border-gray-200 shadow-sm shrink-0 sticky top-0 z-10">
                    <button onClick={() => window.history.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-700 transition-colors active:scale-95">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="ml-2 font-ramabhadra text-lg font-bold text-gray-800 capitalize truncate">{route.replace(/-/g, ' ')}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 text-black bg-gray-50"><PolicyComponent /></div>
            </div>
          );
      }
  }

  const handleReporterClick = (reporterId: string) => { window.location.hash = `#/r/${reporterId}`; };
  const handleBackFromProfile = () => { window.history.back(); };
  const handlePostClickFromProfile = (postId: string) => {
      setDeepLinkPostId(postId);
      setHomeViewMode('feed'); 
      window.location.hash = ''; 
      setNewsFeedKey(prev => prev + 1);
  };
  
  const handleFooterHomeClick = () => {
      setHomeViewMode('feed');
      setSelectedReporterId(null);
      setDeepLinkPostId(null);
      if (window.location.hash) { window.location.hash = ''; window.history.replaceState(null, '', ' '); }
      if (activeTab === 'home') { setNewsFeedKey(prev => prev + 1); }
      setActiveTab('home');
  };

  const handleCreateAction = (action: 'citizen' | 'news' | 'classified') => {
      if (action === 'news') {
          setActiveTab('profile');
          setShowAdmin(true); 
      } else if (action === 'classified') {
          setActiveTab('classifieds');
      } else if (action === 'citizen') {
          setActiveTab('contact');
      }
  };

  const SplashScreenOverlay = () => (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black bg-cover bg-center"
         style={{ backgroundImage: 'url("https://firebasestorage.googleapis.com/v0/b/alfa-news-31bf7.firebasestorage.app/o/news-media%2Fbg.png?alt=media&token=70bb37fd-c13d-4f97-84e1-11fb6c0d1061")' }}>
        <div className="flex flex-col items-center pb-32">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-black font-mallanna text-xl font-bold">లోడ్ అవుతోంది...</p>
        </div>
    </div>
  );

  if (!authChecked) return <SplashScreenOverlay />;

  return (
    <>
        {activeTab === 'home' && !newsReady && homeViewMode === 'feed' && <SplashScreenOverlay />}
        <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden flex flex-col bg-black text-white">
            <div className="w-full relative flex-1 overflow-hidden">
                {activeTab === 'home' && (
                    <>
                        {homeViewMode === 'feed' && (
                            <NewsFeed 
                                key={newsFeedKey}
                                language={language} 
                                onProfileClick={() => setShowLogin(true)} 
                                currentUser={currentUser} 
                                onLoadComplete={() => setNewsReady(true)}
                                filterReporterId={selectedReporterId}
                                onReporterClick={handleReporterClick}
                                initialPostId={deepLinkPostId} 
                            />
                        )}
                        {homeViewMode === 'profile' && selectedReporterId && (
                            <ReporterProfileView 
                                reporterId={selectedReporterId}
                                onBack={handleBackFromProfile}
                                onPostClick={handlePostClickFromProfile}
                            />
                        )}
                    </>
                )}
                
                {activeTab === 'local' && (
                    <LocalNewsFeed 
                        key={`local-feed-${currentUser?.district || 'guest'}`} 
                        language={language} 
                        onProfileClick={() => !currentUser ? setShowLogin(true) : setActiveTab('profile')} 
                        currentUser={currentUser} 
                        onLoadComplete={() => {}}
                        onReporterClick={handleReporterClick}
                    />
                )}

                {activeTab === 'create' && (
                    <CreateMenu 
                        user={currentUser} 
                        onAction={handleCreateAction} 
                        onClose={() => setActiveTab('home')} 
                    />
                )}

                {activeTab === 'classifieds' && <Classifieds />}
                {activeTab === 'contact' && <div className="h-full overflow-y-auto bg-white p-4 text-black"><ContactUsPage /></div>}
                
                {activeTab === 'profile' && (
                    <div className="absolute inset-0 z-40 text-black">
                        <AdminPanel 
                            user={currentUser || guestUser} 
                            onClose={() => { setShowAdmin(false); setActiveTab('home'); }} 
                            language={language} 
                            setLanguage={setLanguage} 
                            onLogout={() => { signOut(auth); setShowAdmin(false); setActiveTab('home'); }} 
                            onLoginRequest={() => setShowLogin(true)}
                        />
                    </div>
                )}
            </div>
            
            {showLogin && (
                <div className="text-black">
                    <LoginScreen 
                        onLoginSuccess={() => {setShowLogin(false);}} 
                        onClose={() => { setShowLogin(false); }} 
                    />
                </div>
            )}
            
            <Footer activeTab={activeTab} onTabChange={(tab) => {
                if (tab === 'home') {
                    handleFooterHomeClick();
                } else {
                    setActiveTab(tab);
                }
                if (tab === 'profile') setShowAdmin(true);
            }} />
        </div>
    </>
  );
};

export default App;
