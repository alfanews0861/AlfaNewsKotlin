import React, { useState, useEffect, useCallback } from 'react';
import NewsFeed from './components/NewsFeed';
import LocalNewsFeed from './components/LocalNewsFeed';
import LoginScreen from './components/LoginScreen';
import AdminPanel from './components/AdminPanel';
import Footer from './components/Footer';
import Classifieds from './components/Classifieds';
import ContactUsPage from './components/policy/ContactUsPage';
import JoinReporterPage from './components/JoinReporterPage';
import ReporterProfileView from './components/ReporterProfileView';
import CreateMenu from './components/CreateMenu';
import InstallPrompt from './components/InstallPrompt';
import { User, UserRole, Language } from './types';
import { auth, db } from './services/firebase';
import * as _auth from 'firebase/auth';
import * as _firestore from 'firebase/firestore';
import { getGuestId } from './services/analyticsService';
import { requestNotificationPermission, listenForForegroundMessages } from './services/pushNotificationService';
import { updateAppBadge } from './services/badgeService';
import PrivacyPolicyPage from './components/policy/PrivacyPolicyPage';
import TermsOfServicePage from './components/policy/TermsOfServicePage';
import AboutUsPage from './components/policy/AboutUsPage';
import ContentPolicyPage from './components/policy/ContentPolicyPage';
import DisclaimerPage from './components/policy/DisclaimerPage';
import AdPolicyPage from './components/policy/AdPolicyPage';
import DataCollectionPolicyPage from './components/policy/DataCollectionPolicyPage';

const { onAuthStateChanged, signOut } = _auth as any;
const { doc, getDoc, setDoc, onSnapshot, collection, query, where } = _firestore as any;

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
  const [adminInitialPage, setAdminInitialPage] = useState<string>('profile');
  const [newsFeedKey, setNewsFeedKey] = useState(0); 
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  const [homeViewMode, setHomeViewMode] = useState<'feed' | 'profile'>('feed');
  const [selectedReporterId, setSelectedReporterId] = useState<string | null>(null);
  const [deepLinkPostId, setDeepLinkPostId] = useState<string | null>(() => {
    // Parse deep link on initial load (for Desktop fallback)
    const path = window.location.pathname;
    const hash = window.location.hash;
    
    if (path.includes('/news/')) {
      const parts = path.split('/news/');
      if (parts[1]) return parts[1].split('/')[0];
    }
    
    if (hash.includes('/s/')) {
      const parts = hash.split('/s/');
      if (parts[1]) return parts[1].split('/')[0];
    }
    
    return null;
  });

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash.startsWith('#/apply-reporter')) {
        setActiveTab('apply-reporter');
      }
    };
    
    // Initial check
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    getGuestId();
    listenForForegroundMessages();
    
    // Request permission on first interaction
    const handleFirstInteraction = () => {
      if (auth.currentUser) requestNotificationPermission(auth.currentUser.uid);
      window.removeEventListener('click', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
    };
  }, []);

  useEffect(() => {
    const { onAuthStateChanged, getRedirectResult } = _auth as any;
    
    // Handle redirect result
    if (getRedirectResult) {
      getRedirectResult(auth).catch((error: any) => {
        console.error("Redirect login error:", error);
      });
    }

    let userUnsub: any = null;
    const authUnsub = onAuthStateChanged(auth, async (firebaseUser: any) => {
      if (firebaseUser) {
        // Set a temporary user immediately so UI updates instantly and doesn't show the login button again
        setCurrentUser(prev => prev || {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.phoneNumber || 'User',
          email: firebaseUser.email || '',
          phone: firebaseUser.phoneNumber || '',
          photoUrl: firebaseUser.photoURL || '',
          role: firebaseUser.email === 'alfanews0861@gmail.com' ? UserRole.ADMIN : UserRole.SUBSCRIBER,
          createdAt: Date.now(),
          lastLogin: Date.now()
        } as User);
        setShowLogin(false);

        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Update last login and ensure user doc exists
        try {
          const docSnap = await getDoc(userRef);
          const isAdminEmail = firebaseUser.email === 'alfanews0861@gmail.com';
          const targetRole = isAdminEmail ? UserRole.ADMIN : UserRole.SUBSCRIBER;

          if (!docSnap.exists()) {
            await setDoc(userRef, {
              name: firebaseUser.displayName || firebaseUser.phoneNumber || 'User',
              email: firebaseUser.email || '',
              phone: firebaseUser.phoneNumber || '',
              photoUrl: firebaseUser.photoURL || '',
              role: targetRole,
              createdAt: Date.now(),
              lastLogin: Date.now()
            });
          } else {
            const existingData = docSnap.data();
            if (isAdminEmail && existingData.role !== UserRole.ADMIN) {
              await setDoc(userRef, { lastLogin: Date.now(), role: UserRole.ADMIN }, { merge: true });
            } else {
              await setDoc(userRef, { lastLogin: Date.now() }, { merge: true });
            }
          }
        } catch (e) {
          console.error("Error updating user login info:", e);
        }

        userUnsub = onSnapshot(userRef, (docSnap: any) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            const newUser = { id: docSnap.id, ...userData } as User;
            
            // Compare user data ignoring lastLogin
            setCurrentUser(prev => {
              if (!prev) return newUser;
              const { lastLogin: oldLastLogin, ...oldUserWithoutLastLogin } = prev;
              const { lastLogin: newLastLogin, ...newUserWithoutLastLogin } = newUser;
              
              if (JSON.stringify(oldUserWithoutLastLogin) === JSON.stringify(newUserWithoutLastLogin)) {
                return prev;
              }
              return newUser;
            });
          } else {
            // Fallback if Firestore document creation failed or is delayed
            setCurrentUser({
              id: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.phoneNumber || 'User',
              email: firebaseUser.email || '',
              phone: firebaseUser.phoneNumber || '',
              photoUrl: firebaseUser.photoURL || '',
              role: firebaseUser.email === 'alfanews0861@gmail.com' ? UserRole.ADMIN : UserRole.SUBSCRIBER,
              createdAt: Date.now(),
              lastLogin: Date.now()
            } as User);
          }
        }, (error: any) => {
          console.error("Firestore onSnapshot error:", error);
          setCurrentUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.phoneNumber || 'User',
            email: firebaseUser.email || '',
            phone: firebaseUser.phoneNumber || '',
            photoUrl: firebaseUser.photoURL || '',
            role: firebaseUser.email === 'alfanews0861@gmail.com' ? UserRole.ADMIN : UserRole.SUBSCRIBER,
            createdAt: Date.now(),
            lastLogin: Date.now()
          } as User);
        });
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

  // 🔔 Real-Time Unread Messages & Reporter Desk Chat Badges Listener
  useEffect(() => {
    if (!currentUser || !currentUser.id || currentUser.id === 'guest') {
      setUnreadMessagesCount(0);
      updateAppBadge(0);
      return;
    }

    const isAdmin = [
      UserRole.ADMIN,
      UserRole.STAFF_REPORTER,
      UserRole.REGIONAL_INCHARGE
    ].includes(currentUser.role) || (currentUser.email === 'alfanews0861@gmail.com');
    const isReporter = currentUser.role === UserRole.REPORTER;

    let convUnsub: any = null;
    let msgUnsub: any = null;

    let unreadConv = 0;
    let unreadMsg = 0;

    const updateTotal = () => {
      const total = unreadConv + unreadMsg;
      setUnreadMessagesCount(total);
      updateAppBadge(total);
    };

    if (isAdmin) {
      // Admin listens to all reporter conversations with unread messages for admin
      const q = query(collection(db, 'reporter_conversations'), where('unreadCountForAdmin', '>', 0));
      convUnsub = onSnapshot(q, (snap: any) => {
        unreadConv = snap.docs.reduce((acc: number, d: any) => acc + Number(d.data()?.unreadCountForAdmin || 0), 0);
        updateTotal();
      }, () => {});
    } else if (isReporter) {
      // Reporter listens to their own conversation unread count for reporter
      const convRef = doc(db, 'reporter_conversations', currentUser.id);
      convUnsub = onSnapshot(convRef, (docSnap: any) => {
        unreadConv = docSnap.exists() ? Number(docSnap.data()?.unreadCountForReporter || 0) : 0;
        updateTotal();
      }, () => {});
    }

    // User personal messages / notices listener
    const msgRef = collection(db, 'users', currentUser.id, 'messages');
    msgUnsub = onSnapshot(msgRef, (snap: any) => {
      unreadMsg = snap.docs.filter((d: any) => !d.data()?.read).length;
      updateTotal();
    }, () => {});

    return () => {
      if (convUnsub) convUnsub();
      if (msgUnsub) msgUnsub();
    };
  }, [currentUser?.id, currentUser?.role, currentUser?.email]);

  const handleFooterHomeClick = useCallback(() => {
    setHomeViewMode('feed');
    setSelectedReporterId(null);
    setDeepLinkPostId(null);
    if (window.location.hash) { window.location.hash = ''; window.history.replaceState(null, '', ' '); }
    if (activeTab === 'home') { setNewsFeedKey(prev => prev + 1); }
    setActiveTab('home');
  }, [activeTab]);

  const handleCreateAction = useCallback((action: 'citizen' | 'news' | 'classified' | 'job_application') => {
    if (action === 'news') { 
      setAdminInitialPage('post');
      setActiveTab('profile'); 
      setShowAdmin(true); 
    } 
    else if (action === 'classified') { setActiveTab('classifieds'); } 
    else if (action === 'citizen') { setActiveTab('contact'); }
    else if (action === 'job_application') { 
      window.location.hash = '#/apply-reporter'; 
      setActiveTab('apply-reporter'); 
    }
  }, []);

  const handleProfileClick = useCallback(() => setShowLogin(true), []);
  const handleReporterClick = useCallback((id: string) => { 
    setSelectedReporterId(id); 
    setHomeViewMode('profile'); 
    setActiveTab('home');
  }, []);

  if (!authChecked) return <div className="h-full bg-black flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden flex flex-col bg-black text-white">
      <InstallPrompt />
      <div className="w-full relative flex-1 overflow-hidden">
        {activeTab === 'home' && (
          <>
            {homeViewMode === 'feed' && (
              <NewsFeed key={newsFeedKey} language={language} onProfileClick={handleProfileClick} currentUser={currentUser} onReporterClick={handleReporterClick} initialPostId={deepLinkPostId} />
            )}
            {homeViewMode === 'profile' && selectedReporterId && (
              <ReporterProfileView reporterId={selectedReporterId} onBack={() => setHomeViewMode('feed')} onPostClick={(pid) => { setDeepLinkPostId(pid); setHomeViewMode('feed'); }} currentUser={currentUser} />
            )}
          </>
        )}
        {activeTab === 'local' && <LocalNewsFeed language={language} onProfileClick={() => setShowLogin(true)} currentUser={currentUser} onReporterClick={handleReporterClick} />}
        {activeTab === 'create' && <CreateMenu user={currentUser} onAction={handleCreateAction} onClose={() => setActiveTab('home')} />}
        {activeTab === 'classifieds' && <Classifieds />}
        {activeTab === 'contact' && <div className="h-full overflow-y-auto bg-white p-4 text-black"><ContactUsPage /></div>}
        {activeTab === 'apply-reporter' && (
          <JoinReporterPage 
            user={currentUser} 
            onClose={() => {
              if (window.location.hash) { window.location.hash = ''; window.history.replaceState(null, '', ' '); }
              setActiveTab('home');
            }} 
            onLoginRequest={() => setShowLogin(true)} 
            onOpenChat={() => {
              if (window.location.hash) { window.location.hash = ''; window.history.replaceState(null, '', ' '); }
              setAdminInitialPage('messages');
              setActiveTab('profile');
              setShowAdmin(true);
            }}
          />
        )}
        {activeTab === 'profile' && (
          <div className="absolute inset-0 z-40 text-black">
            <AdminPanel 
              user={currentUser || {id:'guest', role:UserRole.GUEST, name:'Guest'} as User} 
              onClose={() => setActiveTab('home')} 
              language={language} 
              setLanguage={setLanguage} 
              onLogout={() => signOut(auth)} 
              onLoginRequest={() => setShowLogin(true)}
              unreadMessagesCount={unreadMessagesCount}
              initialPage={adminInitialPage}
            />
          </div>
        )}
      </div>
      {showLogin && <LoginScreen onLoginSuccess={() => setShowLogin(false)} onClose={() => setShowLogin(false)} />}
      {activeTab !== 'profile' && (
        <Footer 
          activeTab={activeTab} 
          unreadMessagesCount={unreadMessagesCount}
          onTabChange={(tab) => {
            if (tab === 'home') handleFooterHomeClick(); 
            else {
              if (tab === 'profile') setAdminInitialPage('profile');
              setActiveTab(tab);
            }
            if (tab === 'profile') setShowAdmin(true);
          }} 
        />
      )}
    </div>
  );
};

export default App;
