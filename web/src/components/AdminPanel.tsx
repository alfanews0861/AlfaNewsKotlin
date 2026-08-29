import React, { useState } from 'react';
import { User, UserRole, Language, NewsPost } from '../types';
import PostNewsPage from './PostNewsPage';
import UserManagementPage from './UserManagementPage';
import ReporterManagementPage from './ReporterManagementPage';
import ManagePostsPage from './ManagePostsPage';
import UserProfilePage from './UserProfilePage';
import AdminNotificationsPage from './AdminNotificationsPage';
import DailyReportPage from './DailyReportPage';
import ManageSurveysPage from './ManageSurveysPage';
import AdsManagerPage from './AdsManagerPage';
import AppConfigPage from './AppConfigPage';
import AffiliateSettingsPage from './AffiliateSettingsPage';
import AdminReporterMessagingPage from './AdminReporterMessagingPage';
import WebScrapingPage from './WebScrapingPage';
import RssFeedsPage from './RssFeedsPage';
import GNewsPage from './GNewsPage';
import SocialMediaFeedsPage from './SocialMediaFeedsPage';
import WhatsappManagerPage from './WhatsappManagerPage';
import SocialAutoPostPage from './SocialAutoPostPage';

interface AdminPanelProps {
  user: User;
  onClose: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  onLogout: () => void;
  onLoginRequest?: () => void;
  unreadMessagesCount?: number;
  initialPage?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
  roles: UserRole[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  onClose,
  language,
  setLanguage,
  onLogout,
  onLoginRequest,
  unreadMessagesCount = 0,
  initialPage = 'profile'
}) => {
  const [activePage, setActivePage] = useState(initialPage);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null);
  const [chatTargetReporterId, setChatTargetReporterId] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialPage) {
      setActivePage(initialPage);
    }
  }, [initialPage]);

  const navSections: NavSection[] = [
    {
      title: 'వార్తా విభాగం (Content & News)',
      items: [
        { id: 'profile', label: 'ప్రొఫైల్ (Profile)', icon: '👤', roles: [UserRole.GUEST, UserRole.SUBSCRIBER, UserRole.REPORTER, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN] },
        { id: 'post', label: 'వార్తను పోస్ట్ చేయండి', icon: '✍️', roles: [UserRole.REPORTER, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN] },
        { id: 'manage', label: 'వార్తల నిర్వహణ (Manage News)', icon: '📑', roles: [UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN] },
        { id: 'manageSurveys', label: 'సర్వేల నిర్వహణ (Surveys & Polls)', icon: '📊', roles: [UserRole.REPORTER, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN] },
        { id: 'dailyReport', label: 'డైలీ రిపోర్ట్ (Daily Report)', icon: '📈', roles: [UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN] },
      ]
    },
    {
      title: 'రిపోర్టర్లు & యూజర్లు (Reporters & Users)',
      items: [
        { id: 'reporterManagement', label: 'రిపోర్టర్ల నిర్వహణ (Reporters)', icon: '🪪', roles: [UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN] },
        { id: 'messages', label: 'రిపోర్టర్ డెస్క్ చాట్ (Reporter Chat)', icon: '💬', roles: [UserRole.GUEST, UserRole.SUBSCRIBER, UserRole.REPORTER, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN] },
        { id: 'manageUsers', label: 'వినియోగదారుల నిర్వహణ (Users)', icon: '👥', roles: [UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN] },
      ]
    },
    {
      title: 'యాడ్స్ & మానిటైజేషన్ (Ads & Revenue)',
      items: [
        { id: 'ads', label: 'లోకల్ యాడ్స్ మేనేజర్ (Ads Manager)', icon: '📢', roles: [UserRole.REPORTER, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN] },
        { id: 'affiliate_settings', label: 'అఫిలియేట్ API సెట్టింగ్స్ (Affiliate)', icon: '🛍️', roles: [UserRole.ADMIN] },
      ]
    },
    {
      title: 'నోటిఫికేషన్లు & సిస్టమ్ (Alerts & App)',
      items: [
        { id: 'adminNotify', label: 'పుష్ నోటిఫికేషన్లు (Push Alerts)', icon: '🔔', roles: [UserRole.ADMIN] },
        { id: 'appConfig', label: 'యాప్ కాన్ఫిగరేషన్ (App Config)', icon: '⚙️', roles: [UserRole.ADMIN] },
      ]
    },
    {
      title: 'ఆటోమేషన్ & స్క్రాపింగ్ (Scraping Hub)',
      items: [
        { id: 'socialAutoPost', label: 'డిస్ట్రిక్ట్ సోషల్ ఆటో-పోస్ట్ (FB & Insta)', icon: '🚀', badge: 'NEW', roles: [UserRole.ADMIN] },
        { id: 'webScraping', label: 'వెబ్ స్క్రాపర్ (Web Scraper)', icon: '🌐', badge: 'RESTORED', roles: [UserRole.ADMIN] },
        { id: 'rssFeeds', label: 'RSS ఫీడ్స్ (RSS Feeds)', icon: '📡', roles: [UserRole.ADMIN] },
        { id: 'gnews', label: 'గూగుల్ న్యూస్ (Google News)', icon: '📰', roles: [UserRole.ADMIN] },
        { id: 'socialMedia', label: 'సోషల్ మీడియా ఫీడ్స్ (Social Feeds)', icon: '🐦', roles: [UserRole.ADMIN] },
        { id: 'whatsapp', label: 'వాట్సాప్ మేనేజర్ (WhatsApp)', icon: '📱', roles: [UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN] },
      ]
    }
  ];

  // Flatten accessible items
  const allAccessibleItems = navSections.flatMap(section => 
    section.items.filter(item => item.roles.includes(user.role))
  );

  const handleMenuClick = (pageId: string) => {
    if (pageId === 'job_application_external') {
      onClose();
      window.location.hash = '#/apply-reporter';
      return;
    }
    if (activePage === 'post' && pageId !== 'post') {
      setEditingPost(null);
    }
    setActivePage(pageId);
    setIsMenuOpen(false);
  };

  const renderActivePage = () => {
    const isAccessible = allAccessibleItems.some(item => item.id === activePage);
    if (!isAccessible && activePage !== 'profile') {
      return (
        <div className="bg-white p-8 rounded-[2rem] border text-center text-red-600 font-bold text-lg">
          ఈ పేజీని చూసేందుకు మీకు అనుమతి లేదు.
        </div>
      );
    }

    switch (activePage) {
      case 'profile':
        return (
          <UserProfilePage
            user={user}
            language={language}
            setLanguage={setLanguage}
            onNavigate={handleMenuClick}
            onLoginRequest={onLoginRequest}
            unreadMessagesCount={unreadMessagesCount}
          />
        );
      case 'post':
        return (
          <PostNewsPage
            user={user}
            postToEdit={editingPost}
            onActionComplete={() => setActivePage('manage')}
          />
        );
      case 'manage':
        return (
          <ManagePostsPage
            onEditPost={(p) => {
              setEditingPost(p);
              setActivePage('post');
            }}
            currentUser={user}
          />
        );
      case 'manageSurveys':
        return <ManageSurveysPage currentUser={user} language={language} />;
      case 'dailyReport':
        return (
          <DailyReportPage
            onEditPost={(p) => {
              setEditingPost(p);
              setActivePage('post');
            }}
            currentUser={user}
          />
        );
      case 'reporterManagement':
        return <ReporterManagementPage currentUser={user} />;
      case 'messages':
        return (
          <AdminReporterMessagingPage
            currentUser={user}
            initialReporterId={chatTargetReporterId}
            onBackToPanel={() => setActivePage('profile')}
          />
        );
      case 'manageUsers':
        return <UserManagementPage currentUser={user} />;
      case 'ads':
        return <AdsManagerPage currentUser={user} />;
      case 'affiliate_settings':
        return <AffiliateSettingsPage />;
      case 'adminNotify':
        return <AdminNotificationsPage />;
      case 'appConfig':
        return <AppConfigPage />;
      case 'socialAutoPost':
        return <SocialAutoPostPage currentUser={user} />;
      case 'webScraping':
        return <WebScrapingPage />;
      case 'rssFeeds':
        return <RssFeedsPage />;
      case 'gnews':
        return <GNewsPage />;
      case 'socialMedia':
        return <SocialMediaFeedsPage />;
      case 'whatsapp':
        return <WhatsappManagerPage user={user} onClose={() => setActivePage('profile')} language={language} />;
      default:
        return <div className="p-6 text-black">Page not found</div>;
    }
  };

  const getActiveTitle = () => {
    const item = allAccessibleItems.find(i => i.id === activePage);
    return item ? `${item.icon} ${item.label}` : 'Admin Panel';
  };

  return (
    <div className="absolute inset-0 bg-white z-50 flex font-mallanna text-black overflow-hidden">
      {/* Sidebar Navigation */}
      <div
        className={`absolute inset-y-0 left-0 bg-gray-900 text-white w-72 md:w-80 transform ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out md:relative md:translate-x-0 z-30 shadow-2xl flex flex-col`}
      >
        {/* Header Logo */}
        <div className="p-5 font-bold text-2xl border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-7 bg-red-600 rounded-full"></span>
            <span className="font-ramabhadra tracking-wide text-white">AlfaNews Admin</span>
          </div>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="md:hidden text-gray-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        {/* User Role Pill */}
        <div className="px-5 py-3 bg-gray-950/60 border-b border-gray-800/80 flex items-center justify-between text-xs font-bold">
          <span className="text-gray-400 truncate max-w-[140px]">{user.name || 'User'}</span>
          <span className="bg-red-600/20 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            {user.role}
          </span>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5 pb-20 custom-scrollbar">
          {navSections.map((section, sIdx) => {
            const accessibleSectionItems = section.items.filter(item => item.roles.includes(user.role));
            if (accessibleSectionItems.length === 0) return null;

            return (
              <div key={sIdx} className="space-y-1">
                <div className="px-3 text-[11px] font-black tracking-wider uppercase text-gray-500 mb-1">
                  {section.title}
                </div>
                {accessibleSectionItems.map(item => {
                  const isActive = activePage === item.id;
                  const isMessageItem = item.id === 'messages';
                  const showUnread = isMessageItem && unreadMessagesCount > 0;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleMenuClick(item.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-base font-semibold transition-all flex items-center justify-between ${
                        isActive
                          ? 'bg-red-600 text-white font-bold shadow-md'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-lg">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        {showUnread && (
                          <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                            {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                          </span>
                        )}
                        {item.badge && (
                          <span className="text-[9px] bg-purple-500/30 text-purple-300 border border-purple-400/30 px-1.5 py-0.5 rounded-md font-mono font-bold">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {user.role !== UserRole.GUEST && (
            <div className="pt-2 border-t border-gray-800">
              <button
                onClick={onLogout}
                className="w-full text-left px-3.5 py-2.5 rounded-xl text-base font-bold text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors flex items-center gap-2.5"
              >
                <span>🚪</span>
                <span>లాగౌట్ (Logout)</span>
              </button>
            </div>
          )}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-gray-50">
        <header className="bg-white p-4 flex items-center justify-between z-10 shrink-0 shadow-sm border-b border-gray-200">
          <div className="flex items-center gap-3 overflow-hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden text-gray-800 p-2 -ml-2 shrink-0 hover:bg-gray-100 rounded-xl"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-2xl font-ramabhadra text-gray-900 truncate">
              {getActiveTitle()}
            </h1>
          </div>
          <button
            onClick={onClose}
            className="bg-gray-100 text-gray-800 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-sm text-sm"
          >
            మూసివేయి (Close)
          </button>
        </header>

        <main className={`flex-1 min-h-0 flex flex-col ${activePage === 'messages' ? 'overflow-hidden p-2 md:p-3 bg-gray-100/70' : 'overflow-y-auto p-2 md:p-4 pb-16 bg-gray-50'}`}>
          <div className={activePage === 'reporterManagement' || activePage === 'dailyReport' || activePage === 'messages' || activePage === 'manage' ? 'w-full h-full flex flex-col min-h-0' : 'max-w-6xl w-full mx-auto'}>
            {renderActivePage()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPanel;
