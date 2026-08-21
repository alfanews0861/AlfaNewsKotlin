
import React from 'react';

interface FooterProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const HomeIcon = ({ active }: { active: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${active ? 'text-red-600' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);

const LocalIcon = ({ active }: { active: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${active ? 'text-red-600' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

const ClassifiedsIcon = ({ active }: { active: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${active ? 'text-red-600' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4zm0 4h16v2H4z" />
  </svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${active ? 'text-red-600' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const GooglePlusIcon = () => (
    <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center border border-gray-100 transform active:scale-90 transition-transform">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 13H5V11H11V5H13V11H19V13H13V19H11V13Z" fill="url(#google_plus_gradient)" />
            <defs>
                <linearGradient id="google_plus_gradient" x1="5" y1="5" x2="19" y2="19" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4285F4" offset="0%" />
                    <stop stopColor="#EA4335" offset="33%" />
                    <stop stopColor="#FBBC05" offset="66%" />
                    <stop stopColor="#34A853" offset="100%" />
                </linearGradient>
            </defs>
        </svg>
    </div>
);

const Footer: React.FC<FooterProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="h-[64px] w-full bg-black border-t border-gray-800 flex justify-around items-center z-50 shrink-0 pb-safe">
      <button 
        onClick={() => onTabChange('home')} 
        className="flex flex-col items-center justify-center w-full h-full"
      >
        <HomeIcon active={activeTab === 'home'} />
        <span className={`text-[10px] mt-1 font-mallanna ${activeTab === 'home' ? 'text-white' : 'text-gray-500'}`}>హోమ్</span>
      </button>

      <button 
        onClick={() => onTabChange('local')} 
        className="flex flex-col items-center justify-center w-full h-full"
      >
        <LocalIcon active={activeTab === 'local'} />
        <span className={`text-[10px] mt-1 font-mallanna ${activeTab === 'local' ? 'text-white' : 'text-gray-500'}`}>లోకల్</span>
      </button>

      {/* NEW PLUS BUTTON */}
      <button 
        onClick={() => onTabChange('create')} 
        className="flex flex-col items-center justify-center w-full h-full"
      >
        <GooglePlusIcon />
        <span className={`text-[10px] mt-1 font-mallanna ${activeTab === 'create' ? 'text-white' : 'text-gray-500'}`}>పోస్ట్</span>
      </button>

      <button 
        onClick={() => onTabChange('classifieds')} 
        className="flex flex-col items-center justify-center w-full h-full"
      >
        <ClassifiedsIcon active={activeTab === 'classifieds'} />
        <span className={`text-[10px] mt-1 font-mallanna ${activeTab === 'classifieds' ? 'text-white' : 'text-gray-500'}`}>క్లాసిఫైడ్స్</span>
      </button>

      <button 
        onClick={() => onTabChange('profile')} 
        className="flex flex-col items-center justify-center w-full h-full"
      >
        <ProfileIcon active={activeTab === 'profile'} />
        <span className={`text-[10px] mt-1 font-mallanna ${activeTab === 'profile' ? 'text-white' : 'text-gray-500'}`}>ప్రొఫైల్</span>
      </button>
    </div>
  );
};

export default Footer;
