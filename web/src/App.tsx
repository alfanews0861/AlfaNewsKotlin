import React, { useState, useEffect } from 'react';
import PortalHome from './components/portal/PortalHome';
import LoginScreen from './components/LoginScreen';
import AdminPanel from './components/AdminPanel';
import Classifieds from './components/Classifieds';
import ContactUsPage from './components/policy/ContactUsPage';
import ReporterProfileView from './components/ReporterProfileView';
import { User, UserRole, Language } from './types';
import { auth, db } from './services/firebase';
import * as _auth from 'firebase/auth';
import * as _firestore from 'firebase/firestore';
import { getGuestId } from './services/analyticsService';
import PrivacyPolicyPage from './components/policy/PrivacyPolicyPage';
import TermsOfServicePage from './components/policy/TermsOfServicePage';
import AboutUsPage from './components/policy/AboutUsPage';
import ContentPolicyPage from './components/policy/ContentPolicyPage';
import DisclaimerPage from './components/policy/DisclaimerPage';
import AdPolicyPage from './components/policy/AdPolicyPage';
import DataCollectionPolicyPage from './components/policy/DataCollectionPolicyPage';
import { ArrowLeft, Loader2 } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedReporterId, setSelectedReporterId] = useState<string | null>(null);
  const [deepLinkPostId, setDeepLinkPostId] = useState<string | null>(null);

  const guestUser: User = {
    id: 'guest-user',
    name: 'Guest',
    role: UserRole.GUEST,
    photoUrl: '',
    email: '',
    phone: '',
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

      // Handle /news/:id or /ad/:id
      if (pathname.startsWith('/news/') || pathname.startsWith('/ad/')) {
        const segments = pathname.split('/').filter(Boolean);
        const postId = segments.pop();
        if (postId && postId !== 'news' && postId !== 'ad') {
          setDeepLinkPostId(postId);
          setActiveTab('home');
        }
      }

      if (hash.startsWith('#/r/')) {
        const rId = hash.split('#/r/')[1];
        if (rId) {
          setSelectedReporterId(rId);
          setActiveTab('reporter');
        }
      } else if (hash.startsWith('#/news/')) {
        const pId = hash.replace('#/news/', '');
        if (pId) {
          setDeepLinkPostId(pId);
        }
      } else if (hash.startsWith('#/s/')) {
        const pId = hash.split('#/s/')[1];
        if (pId) {
          setDeepLinkPostId(pId);
          setActiveTab('home');
        }
      } else if (hash === '#/classifieds') {
        setActiveTab('classifieds');
      } else if (hash === '' || hash === '#/' || hash === '#') {
        if (activeTab === 'reporter') {
          setActiveTab('home');
          setSelectedReporterId(null);
        }
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [activeTab]);

  const getRoute = (hash: string) => {
    if (!hash) return '';
    if (hash.startsWith('#/r/') || hash.startsWith('#/s/') || hash.startsWith('#/news/')) return 'dynamic';
    return hash.replace('#/', '').replace('#', '').toLowerCase();
  };

  const route = getRoute(currentHash);

  // Policy Pages Router
  if (route !== 'dynamic' && route !== '' && route !== 'classifieds') {
    const policyPages: Record<string, React.FC> = {
      'privacy-policy': PrivacyPolicyPage,
      terms: TermsOfServicePage,
      about: AboutUsPage,
      contact: ContactUsPage,
      'content-policy': ContentPolicyPage,
      disclaimer: DisclaimerPage,
      'ad-policy': AdPolicyPage,
      'data-collection': DataCollectionPolicyPage,
    };
    const PolicyComponent = policyPages[route];
    if (PolicyComponent) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col animate-fade-in font-mallanna">
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
            <button
              onClick={() => {
                window.location.hash = '';
                setActiveTab('home');
              }}
              className="flex items-center gap-1.5 text-gray-700 hover:text-red-600 font-ramabhadra text-sm font-semibold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>హోమ్‌కి వెళ్ళండి</span>
            </button>
            <span className="font-ramabhadra text-lg font-bold text-gray-900 capitalize">
              {route.replace(/-/g, ' ')}
            </span>
            <div className="w-20"></div>
          </div>
          <div className="max-w-4xl mx-auto w-full p-6 text-black bg-white my-6 rounded-2xl shadow-sm border border-gray-200">
            <PolicyComponent />
          </div>
        </div>
      );
    }
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white font-mallanna">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
        <p className="text-xl font-ramabhadra">ఆల్ఫా న్యూస్ లోడ్ అవుతోంది...</p>
      </div>
    );
  }

  return (
    <>
      {/* 1. CLASSIFIEDS VIEW */}
      {activeTab === 'classifieds' ? (
        <div className="min-h-screen bg-gray-50 flex flex-col font-mallanna">
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
            <button
              onClick={() => {
                window.location.hash = '';
                setActiveTab('home');
              }}
              className="flex items-center gap-1.5 text-gray-700 hover:text-red-600 font-ramabhadra text-sm font-semibold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>← ప్రధాన వార్తల పోర్టల్</span>
            </button>
            <span className="font-ramabhadra text-lg font-bold text-gray-900">
              ఆల్ఫా క్లాసిఫైడ్స్
            </span>
            <div className="w-20"></div>
          </div>
          <div className="max-w-7xl mx-auto w-full p-4 flex-1">
            <Classifieds />
          </div>
        </div>
      ) : activeTab === 'reporter' && selectedReporterId ? (
        /* 2. REPORTER PROFILE VIEW */
        <div className="min-h-screen bg-gray-50 flex flex-col font-mallanna">
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
            <button
              onClick={() => {
                window.location.hash = '';
                setActiveTab('home');
                setSelectedReporterId(null);
              }}
              className="flex items-center gap-1.5 text-gray-700 hover:text-red-600 font-ramabhadra text-sm font-semibold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>← వెనుకకు</span>
            </button>
            <span className="font-ramabhadra text-lg font-bold text-gray-900">
              రిపోర్టర్ ప్రొఫైల్
            </span>
            <div className="w-20"></div>
          </div>
          <div className="max-w-4xl mx-auto w-full p-4 flex-1">
            <ReporterProfileView
              reporterId={selectedReporterId}
              currentUser={currentUser}
              onBack={() => {
                window.location.hash = '';
                setActiveTab('home');
                setSelectedReporterId(null);
              }}
              onPostClick={(postId) => {
                setDeepLinkPostId(postId);
                setActiveTab('home');
                window.location.hash = `#/news/${postId}`;
              }}
            />
          </div>
        </div>
      ) : (
        /* 3. MAIN FULL NEWS WEBSITE PORTAL */
        <PortalHome
          currentUser={currentUser}
          onLoginClick={() => setShowLogin(true)}
          onAdminClick={() => setShowAdmin(true)}
          onOpenClassifieds={() => setActiveTab('classifieds')}
          onOpenPolicyPage={(policyRoute) => {
            window.location.hash = `#/${policyRoute}`;
          }}
          initialPostId={deepLinkPostId}
        />
      )}

      {/* ADMIN / REPORTER PROFILE PANEL MODAL */}
      {showAdmin && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-center p-0 sm:p-4 animate-fade-in text-gray-900">
          <div className="bg-white w-full max-w-5xl h-full sm:h-[90vh] sm:my-auto rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white shrink-0">
              <span className="font-ramabhadra text-lg font-bold">
                యూజర్ ప్రొఫైల్ & అడ్మిన్ ప్యానెల్
              </span>
              <button
                onClick={() => setShowAdmin(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AdminPanel
                user={currentUser || guestUser}
                onClose={() => setShowAdmin(false)}
                language={language}
                setLanguage={setLanguage}
                onLogout={() => {
                  signOut(auth);
                  setShowAdmin(false);
                }}
                onLoginRequest={() => {
                  setShowAdmin(false);
                  setShowLogin(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLogin && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in text-gray-900">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative">
            <button
              onClick={() => setShowLogin(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
            >
              ✕
            </button>
            <LoginScreen
              onLoginSuccess={() => setShowLogin(false)}
              onClose={() => setShowLogin(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default App;
