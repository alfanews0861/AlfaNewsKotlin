import React, { useState, useEffect } from 'react';
import MobileHeader from './MobileHeader';
import Footer from './Footer';
import NewsFeed from './NewsFeed';
import LocalNewsFeed from './LocalNewsFeed';
import CreateMenu from './CreateMenu';
import Classifieds from './Classifieds';
import UserProfilePage from './UserProfilePage';
import CitizenPostPage from './CitizenPostPage';
import PostNewsPage from './PostNewsPage';
import PostClassifiedAd from './PostClassifiedAd';
import JoinReporterPage from './JoinReporterPage';
import DistrictPickerModal from './DistrictPickerModal';
import PreferencesModal from './PreferencesModal';
import { User, Language, UserRole } from '../types';
import { navigateTo } from '../utils/router';
import { syncWebDistrictTopic } from '../services/pushNotificationService';
import {
  getBodyFontClass,
  getDistrictDisplayName,
  getStoredStateCode,
  resolveStateCode,
  validateLanguageForState,
  type StateCode,
} from '../data/editions';

interface MobileAppViewProps {
  currentUser: User | null;
  language: Language;
  setLanguage: (lang: Language) => void;
  onLoginClick: () => void;
  onAdminClick: () => void;
  initialPostId?: string | null;
  initialTab?: string;
  onOpenPolicyPage?: (route: string) => void;
}

export const MobileAppView: React.FC<MobileAppViewProps> = ({
  currentUser,
  language,
  setLanguage,
  onLoginClick,
  onAdminClick,
  initialPostId,
  initialTab = 'home',
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [activeState, setActiveState] = useState<StateCode>(() => {
    return (
      resolveStateCode(currentUser?.stateCode) ||
      resolveStateCode(currentUser?.state) ||
      resolveStateCode(currentUser?.district) ||
      getStoredStateCode()
    );
  });
  const [activeDistrict, setActiveDistrict] = useState<string | null>(() => {
    return currentUser?.district || localStorage.getItem('user_local_district') || null;
  });
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [preferencesVersion, setPreferencesVersion] = useState(0);
  const [createSubView, setCreateSubView] = useState<'citizen' | 'news' | 'classified' | 'job_application' | null>(null);

  // Keep state & district in sync with currentUser
  useEffect(() => {
    const resolvedUserState =
      resolveStateCode(currentUser?.stateCode) ||
      resolveStateCode(currentUser?.state) ||
      resolveStateCode(currentUser?.district);
    if (resolvedUserState && resolvedUserState !== activeState) {
      setActiveState(resolvedUserState);
      localStorage.setItem('user_selected_state', resolvedUserState);
    }
    if (currentUser?.district && currentUser.district !== activeDistrict) {
      setActiveDistrict(currentUser.district);
      localStorage.setItem('user_local_district', currentUser.district);
    }
  }, [currentUser?.stateCode, currentUser?.state, currentUser?.district]);

  // If a shared news post link is loaded, always open on home feed
  useEffect(() => {
    if (initialPostId) {
      setActiveTab('home');
      setCreateSubView(null);
    }
  }, [initialPostId]);

  const handleDistrictSelect = (district: string | null) => {
    setActiveDistrict(district);
    if (district) {
      localStorage.setItem('user_local_district', district);
      const inferredState = resolveStateCode(district);
      if (inferredState) {
        setActiveState(inferredState);
        localStorage.setItem('user_selected_state', inferredState);
        const validLang = validateLanguageForState(inferredState, language) as Language;
        if (validLang !== language) setLanguage(validLang);
      }
    } else {
      localStorage.removeItem('user_local_district');
    }
    syncWebDistrictTopic(district);
  };

  const handleEditionSelect = (selection: {
    stateCode: StateCode;
    district: string | null;
    language: Language;
  }) => {
    setActiveState(selection.stateCode);
    localStorage.setItem('user_selected_state', selection.stateCode);
    setActiveDistrict(selection.district);
    if (selection.district) {
      localStorage.setItem('user_local_district', selection.district);
    } else {
      localStorage.removeItem('user_local_district');
    }
    const validLang = validateLanguageForState(selection.stateCode, selection.language) as Language;
    setLanguage(validLang);
    localStorage.setItem('app_language', validLang);
    syncWebDistrictTopic(selection.district);
  };

  const guestUser: User = {
    id: 'guest-user',
    name: 'Guest',
    role: UserRole.GUEST,
    photoUrl: '',
    email: '',
    phone: '',
  };

  const effectiveUser = currentUser || guestUser;

  const bodyFontClass = getBodyFontClass(language);

  return (
    <div className={`h-[100dvh] w-full bg-black flex flex-col overflow-hidden select-none ${bodyFontClass} relative`}>
      {/* 1. TOP HEADER (Android LogoHeader clone) */}
      <MobileHeader
        district={activeDistrict ? getDistrictDisplayName(activeDistrict, language) : null}
        userId={currentUser?.id || null}
        onDistrictClick={() => setShowDistrictModal(true)}
        onSettingsClick={() => setShowPreferencesModal(true)}
        showDistrictSelector={activeTab === 'home' || activeTab === 'local'}
      />

      {/* 2. MAIN CONTENT AREA (Flex-1, snapping cards or views) */}
      <main className="flex-1 w-full relative overflow-hidden bg-black">
        {/* TAB 1: HOME FEED (40/30/30 Mixing + Strict State Isolation + Vertical Snapping Feed) */}
        {activeTab === 'home' && (
          <div className="h-full w-full">
            <NewsFeed
              language={language}
              currentUser={currentUser}
              onProfileClick={onLoginClick}
              initialPostId={initialPostId}
              hideHeader={true}
              selectedState={activeState}
              selectedDistrict={activeDistrict}
              refreshVersion={preferencesVersion}
              onReporterClick={(reporterId) => {
                navigateTo(`/reporter/${reporterId}`);
              }}
            />
          </div>
        )}

        {/* TAB 2: LOCAL FEED (Mandal/Tehsil -> Constituency -> District Vertical Snapping Feed) */}
        {activeTab === 'local' && (
          <div className="h-full w-full">
            <LocalNewsFeed
              language={language}
              currentUser={currentUser}
              onProfileClick={onLoginClick}
              selectedState={activeState}
              selectedDistrict={activeDistrict}
              hideHeader={true}
              onReporterClick={(reporterId) => {
                navigateTo(`/reporter/${reporterId}`);
              }}
            />
          </div>
        )}

        {/* TAB 3: CREATE MENU & SUB-ACTIONS */}
        {activeTab === 'create' && (
          <div className="h-full w-full overflow-y-auto bg-black text-white">
            {createSubView === null && (
              <CreateMenu
                user={currentUser}
                onAction={(action) => setCreateSubView(action)}
                onClose={() => setActiveTab('home')}
              />
            )}

            {createSubView === 'citizen' && (
              <div className="h-full w-full overflow-y-auto p-4 bg-zinc-950">
                <CitizenPostPage
                  user={effectiveUser}
                  onClose={() => setCreateSubView(null)}
                />
              </div>
            )}

            {createSubView === 'news' && (
              <div className="h-full w-full overflow-y-auto p-4 bg-zinc-950">
                <PostNewsPage
                  user={effectiveUser}
                  onActionComplete={() => {
                    setCreateSubView(null);
                    setActiveTab('home');
                  }}
                />
              </div>
            )}

            {createSubView === 'classified' && (
              <div className="h-full w-full overflow-y-auto p-4 bg-zinc-950">
                <PostClassifiedAd
                  currentUser={effectiveUser}
                  onSuccess={() => {
                    setCreateSubView(null);
                    setActiveTab('classifieds');
                  }}
                  onCancel={() => setCreateSubView(null)}
                />
              </div>
            )}

            {createSubView === 'job_application' && (
              <div className="h-full w-full flex flex-col bg-gray-50">
                <JoinReporterPage
                  user={currentUser}
                  language={language}
                  onClose={() => setCreateSubView(null)}
                  onLoginRequest={onLoginClick}
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CLASSIFIEDS */}
        {activeTab === 'classifieds' && (
          <div className="h-full w-full overflow-y-auto bg-zinc-950 text-white">
            <Classifieds />
          </div>
        )}

        {/* TAB 5: PROFILE / LOGIN */}
        {activeTab === 'profile' && (
          <div className="h-full w-full overflow-y-auto bg-zinc-950 text-white">
            {currentUser ? (
              <UserProfilePage
                user={currentUser}
                language={language}
                setLanguage={setLanguage}
                onNavigate={(pageId) => {
                  if (pageId === 'admin') {
                    onAdminClick();
                  } else if (pageId === 'home') {
                    setActiveTab('home');
                  }
                }}
                onLoginRequest={onLoginClick}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center mb-4 shadow-inner">
                  <span className="font-poppins font-black text-3xl text-red-500">A</span>
                </div>
                <h2 className="font-ramabhadra text-2xl text-white mb-2">ఆల్ఫా న్యూస్ ప్రొఫైల్</h2>
                <p className="font-mallanna text-gray-400 text-lg mb-6 max-w-xs">
                  మీ ప్రాధాన్యతలు, సేవ్ చేసిన వార్తలు మరియు రిపోర్టర్ వివరాల కోసం లాగిన్ అవ్వండి.
                </p>
                <button
                  onClick={onLoginClick}
                  className="w-full max-w-xs py-3 px-6 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-base font-ramabhadra shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  లాగిన్ / రిజిస్టర్ అవ్వండి
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 3. BOTTOM FOOTER WITH ICONS (Android Footer clone) */}
      <Footer
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'profile' && !currentUser) {
            onLoginClick();
          } else {
            setCreateSubView(null);
            setActiveTab(tab);
          }
        }}
      />

      {/* 4. EDITION & DISTRICT PICKER MODAL */}
      {showDistrictModal && (
        <DistrictPickerModal
          currentState={activeState}
          currentDistrict={activeDistrict}
          currentLanguage={language}
          onSelectDistrict={handleDistrictSelect}
          onSelectEdition={handleEditionSelect}
          onClose={() => setShowDistrictModal(false)}
        />
      )}

      {/* 5. PREFERENCES MODAL */}
      {showPreferencesModal && (
        <PreferencesModal
          currentUser={currentUser}
          onClose={() => setShowPreferencesModal(false)}
          onSave={() => {
            setShowPreferencesModal(false);
            setPreferencesVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
};

export default MobileAppView;
