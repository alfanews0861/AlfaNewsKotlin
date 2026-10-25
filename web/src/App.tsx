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
import { useAppRoute, navigateTo } from './utils/router';
import { updatePageSeo } from './utils/seoManager';

const { onAuthStateChanged, signOut } = _auth as any;
const { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, query, where, getDocs } = _firestore as any;

const App: React.FC = () => {
  const [showLogin, setShowLogin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved as Language) || Language.TELUGU;
  });

  const [authChecked, setAuthChecked] = useState(false);
  const route = useAppRoute();

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
          let legacyData: any = null;
          try {
            if (firebaseUser.email) {
              const qEmail = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
              const snap = await getDocs(qEmail);
              if (!snap.empty) {
                legacyData = snap.docs[0].data();
              }
            }
            if (!legacyData && firebaseUser.phoneNumber) {
              const clean10 = firebaseUser.phoneNumber.replace(/[^0-9]/g, '').slice(-10);
              const qPhone1 = query(collection(db, 'users'), where('phone', '==', firebaseUser.phoneNumber));
              let snapPhone = await getDocs(qPhone1);
              if (!snapPhone.empty) {
                legacyData = snapPhone.docs[0].data();
              } else if (clean10) {
                const qPhone2 = query(collection(db, 'users'), where('phone', '==', clean10));
                snapPhone = await getDocs(qPhone2);
                if (!snapPhone.empty) {
                  legacyData = snapPhone.docs[0].data();
                } else {
                  const qPhone3 = query(collection(db, 'users'), where('phoneNumber', '==', clean10));
                  snapPhone = await getDocs(qPhone3);
                  if (!snapPhone.empty) {
                    legacyData = snapPhone.docs[0].data();
                  }
                }
              }
              if (!legacyData && clean10) {
                try {
                  const qApp = query(collection(db, 'reporter_applications'), where('phone', '==', clean10));
                  const snapApp = await getDocs(qApp);
                  if (!snapApp.empty) {
                    const appData = snapApp.docs[0].data();
                    legacyData = {
                      name: appData.fullName || appData.name || firebaseUser.displayName || 'Reporter',
                      role: UserRole.REPORTER,
                      district: appData.district || '',
                      assignedMandal: appData.assignedMandal || appData.mandal || '',
                      mandal: appData.assignedMandal || appData.mandal || ''
                    };
                  }
                } catch {}
              }
            }
          } catch (e) {
            console.warn('Failed to query legacy user profile:', e);
          }

          const isAdminAuth = firebaseUser.email?.toLowerCase() === 'alfanews0861@gmail.com' ||
            Boolean(firebaseUser.phoneNumber?.includes('9173811009')) ||
            legacyData?.role === UserRole.ADMIN;
          const isPermanentReporterAuth = firebaseUser.email?.toLowerCase() === 'alfanewsservice@gmail.com' ||
            legacyData?.email?.toLowerCase() === 'alfanewsservice@gmail.com';
          const hasReporterAttrs = Boolean(legacyData?.assignedMandal || legacyData?.previouslyDowngraded || isPermanentReporterAuth);
          const initialRole = isAdminAuth ? UserRole.ADMIN : (isPermanentReporterAuth ? UserRole.REPORTER : (legacyData?.role || UserRole.SUBSCRIBER));

          const newUser: any = {
            id: firebaseUser.uid,
            name: legacyData?.name || firebaseUser.displayName || (isAdminAuth ? 'శ్రీకాంత్ రెడ్డి' : (isPermanentReporterAuth ? 'Alfa News Service' : 'New User')),
            email: firebaseUser.email || legacyData?.email || '',
            photoUrl: firebaseUser.photoURL || legacyData?.photoUrl || '',
            role: initialRole,
            ...(isPermanentReporterAuth ? { assignedMandal: 'నెల్లూరు అర్బన్', mandal: 'నెల్లూరు అర్బన్', district: 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు', isProtectedSenior: true } : {}),
            ...(legacyData || {})
          };
          if (isAdminAuth) {
            newUser.role = UserRole.ADMIN;
          } else if (hasReporterAttrs || isPermanentReporterAuth) {
            newUser.role = UserRole.REPORTER;
            newUser.previouslyDowngraded = false;
          }
          await setDoc(userRef, { ...newUser, createdAt: legacyData?.createdAt || serverTimestamp(), lastLogin: serverTimestamp() }, { merge: true });
        }

        userUnsub = onSnapshot(userRef, (docSnap: any) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            const isAdmin = firebaseUser.email?.toLowerCase() === 'alfanews0861@gmail.com' ||
              Boolean(firebaseUser.phoneNumber?.includes('9173811009')) ||
              userData.role === UserRole.ADMIN;
            const isPermanentReporter = firebaseUser.email?.toLowerCase() === 'alfanewsservice@gmail.com' ||
              userData.email?.toLowerCase() === 'alfanewsservice@gmail.com';
            const hasReporterAttrs = Boolean(userData.assignedMandal || (userData.previouslyDowngraded && userData.downgradedReason === 'INACTIVITY') || isPermanentReporter);
            const effectiveRole = isAdmin ? UserRole.ADMIN : (isPermanentReporter ? UserRole.REPORTER : ((userData.role === UserRole.SUBSCRIBER && hasReporterAttrs) ? UserRole.REPORTER : userData.role));
            const effectiveDistrict = isPermanentReporter ? 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు' : (userData.district || '');
            const effectiveMandal = isPermanentReporter ? 'నెల్లూరు అర్బన్' : (userData.assignedMandal || userData.mandal || '');
            setCurrentUser({ id: docSnap.id, ...userData, role: effectiveRole, district: effectiveDistrict, assignedMandal: effectiveMandal, mandal: effectiveMandal } as User);
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

  // Policy Pages Router
  if (route.type === 'policy') {
    const policyPages: Record<string, { component: React.FC; title: string; teTitle: string }> = {
      'privacy-policy': { component: PrivacyPolicyPage, title: 'Privacy Policy', teTitle: 'గోప్యతా విధానం (Privacy Policy)' },
      terms: { component: TermsOfServicePage, title: 'Terms of Service', teTitle: 'నిబంధనలు & షరతులు (Terms)' },
      about: { component: AboutUsPage, title: 'About Us', teTitle: 'మా గురించి (About Us)' },
      contact: { component: ContactUsPage, title: 'Contact Us', teTitle: 'సంప్రదించండి (Contact Us)' },
      'content-policy': { component: ContentPolicyPage, title: 'Content Policy', teTitle: 'కంటెంట్ పాలసీ (Content Policy)' },
      disclaimer: { component: DisclaimerPage, title: 'Disclaimer', teTitle: 'డిస్క్లైమర్ (Disclaimer)' },
      'ad-policy': { component: AdPolicyPage, title: 'Ad Policy', teTitle: 'ప్రకటనల విధానం (Ad Policy)' },
      'data-collection': { component: DataCollectionPolicyPage, title: 'Data Collection Policy', teTitle: 'డేటా సేకరణ పాలసీ' },
    };

    const policyInfo = policyPages[route.policy];
    if (policyInfo) {
      const PolicyComponent = policyInfo.component;
      // Update SEO
      updatePageSeo({
        title: `${policyInfo.teTitle} - Alfa News Telugu`,
        description: `ఆల్ఫా న్యూస్ తెలుగు - ${policyInfo.teTitle} వివరాలు.`,
        url: `https://alfanews.app/${route.policy}`,
        type: 'website',
      });

      return (
        <div className="min-h-screen bg-gray-50 flex flex-col animate-fade-in font-mallanna">
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  navigateTo('/');
                }
              }}
              className="flex items-center gap-1.5 text-gray-700 hover:text-red-600 font-ramabhadra text-sm font-semibold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>← ప్రధాన వార్తల పోర్టల్</span>
            </button>
            <span className="font-ramabhadra text-lg font-bold text-gray-900 capitalize">
              {policyInfo.teTitle}
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
      {route.type === 'reporter' ? (
        /* 1. REPORTER PROFILE VIEW */
        <div className="min-h-screen bg-gray-50 flex flex-col font-mallanna">
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  navigateTo('/');
                }
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
              reporterId={route.reporterId}
              currentUser={currentUser}
              onBack={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  navigateTo('/');
                }
              }}
              onPostClick={(postId) => {
                navigateTo(`/news/${postId}`);
              }}
            />
          </div>
        </div>
      ) : (
        /* 2. MAIN FULL NEWS WEBSITE PORTAL */
        <PortalHome
          currentUser={currentUser}
          onLoginClick={() => setShowLogin(true)}
          onAdminClick={() => setShowAdmin(true)}
          onOpenClassifieds={() => navigateTo('/classifieds')}
          onOpenPolicyPage={(policyRoute) => {
            navigateTo(`/${policyRoute}`);
          }}
          initialPostId={route.type === 'news' ? route.id : null}
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
