
import React, { useState } from 'react';
import { User, UserRole, Language, NewsPost } from '../types';
import PostNewsPage from './PostNewsPage';
import UserManagementPage from './UserManagementPage';
import ReporterManagementPage from './ReporterManagementPage';
import ManagePostsPage from './ManagePostsPage';
import UserProfilePage from './UserProfilePage';
import AdminNotificationsPage from './AdminNotificationsPage';
import DailyReportPage from './DailyReportPage';

interface AdminPanelProps {
  user: User;
  onClose: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  onLogout: () => void;
  onLoginRequest?: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ user, onClose, language, setLanguage, onLogout, onLoginRequest }) => {
  const [activePage, setActivePage] = useState('profile');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null);

  const allPages = [
    { id: 'profile', label: 'ప్రొఫైల్ (Profile)', component: UserProfilePage, roles: [UserRole.GUEST, UserRole.SUBSCRIBER, UserRole.REPORTER, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN], inMenu: true },
    { id: 'post', label: 'వార్తను పోస్ట్ చేయండి', component: PostNewsPage, roles: [UserRole.REPORTER, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN], inMenu: true },
    { id: 'manage', label: 'వార్తలను నిర్వహించండి', component: ManagePostsPage, roles: [UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN], inMenu: true },
    { id: 'dailyReport', label: 'డైలీ రిపోర్ట్ (Daily Report)', component: DailyReportPage, roles: [UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN], inMenu: true },
    { id: 'manageUsers', label: 'వినియోగదారు నిర్వహణ', component: UserManagementPage, roles: [UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN], inMenu: true },
    { id: 'reporterManagement', label: 'రిపోర్టర్ల నిర్వహణ (Reporter Management)', component: ReporterManagementPage, roles: [UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN], inMenu: true },
    { id: 'adminNotify', label: 'Push Notifications (అలర్ట్స్)', component: AdminNotificationsPage, roles: [UserRole.ADMIN], inMenu: true },
  ];
  
  const accessiblePages = allPages.filter(page => page.roles.includes(user.role));
  const menuItems = accessiblePages.filter(page => page.inMenu);

  const handleMenuClick = (pageId: string) => {
    if (pageId === 'job_application_external') {
        onClose();
        // Since we don't have a direct way to trigger App's setActiveTab from here,
        // we can use a custom event or hash. Let's use hash for simplicity:
        window.location.hash = '#/apply-reporter';
        return;
    }
    if (activePage === 'post' && pageId !== 'post') { setEditingPost(null); }
    setActivePage(pageId);
    setIsMenuOpen(false);
  };

  const renderActivePage = () => {
    const page = accessiblePages.find(p => p.id === activePage);
    if (!page) return <div className="p-6 text-xl text-black">అనుమతి లేదు.</div>;
    
    switch (activePage) {
        case 'profile': return <UserProfilePage user={user} language={language} setLanguage={setLanguage} onNavigate={handleMenuClick} onLoginRequest={onLoginRequest} />;
        case 'post': return <PostNewsPage user={user} postToEdit={editingPost} onActionComplete={() => setActivePage('manage')} />;
        case 'manage': return <ManagePostsPage onEditPost={(p) => { setEditingPost(p); setActivePage('post'); }} currentUser={user} />;
        case 'dailyReport': return <DailyReportPage onEditPost={(p) => { setEditingPost(p); setActivePage('post'); }} currentUser={user} />;
        case 'manageUsers': return <UserManagementPage currentUser={user} />;
        case 'reporterManagement': return <ReporterManagementPage currentUser={user} />;
        case 'adminNotify': return <AdminNotificationsPage />;
        default: return <div className="p-6 text-black">Page not found</div>;
    }
  };

  return (
    <div className="absolute inset-0 bg-white z-50 flex font-mallanna text-black overflow-hidden">
      <div className={`absolute inset-y-0 left-0 bg-gray-900 text-white w-72 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0 z-30 shadow-2xl`}>
        <div className="p-6 font-bold text-2xl border-b border-gray-800 flex items-center gap-2">
            <span className="w-2 h-6 bg-red-600 rounded-full"></span>
            Admin Panel
        </div>
        <nav className="overflow-y-auto h-full pb-24">
          <ul>
            {menuItems.map(item => (
              <li key={item.id}>
                <button onClick={() => handleMenuClick(item.id)} className={`w-full text-left p-5 hover:bg-gray-800 text-xl transition-colors ${activePage === item.id ? 'bg-red-600 font-bold' : 'text-gray-300'}`}>
                  {item.label}
                </button>
              </li>
            ))}
             {user.role !== UserRole.GUEST && (
                 <li><button onClick={onLogout} className="w-full text-left p-5 text-red-400 hover:bg-gray-800 text-xl font-bold">లాగౌట్ (Logout)</button></li>
             )}
          </ul>
        </nav>
      </div>

      <div className="flex-1 flex flex-col h-full min-w-0 bg-gray-50">
        <header className="bg-white p-4 flex items-center justify-between z-10 shrink-0 shadow-sm border-b border-gray-200">
            <div className="flex items-center gap-3 overflow-hidden">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-gray-800 p-2 -ml-2 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16" /></svg>
                </button>
                <h1 className="text-2xl font-ramabhadra text-black truncate">
                    {allPages.find(p => p.id === activePage)?.label || 'Admin Panel'}
                </h1>
            </div>
            <button onClick={onClose} className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors">Close</button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 pb-20">
          <div className={activePage === 'reporterManagement' ? "w-full mx-auto" : "max-w-4xl mx-auto"}>
             {renderActivePage()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPanel;
