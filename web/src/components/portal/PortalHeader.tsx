import React, { useState, useEffect } from 'react';
import { User, Language } from '../../types';
import { Search, Flame, PenTool, User as UserIcon, LogIn, Menu, X, Smartphone, Globe, Bell } from 'lucide-react';

interface PortalHeaderProps {
  currentUser: User | null;
  onLoginClick: () => void;
  onAdminClick: () => void;
  onSpecialStoryClick: () => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onSearchClick: () => void;
  onOpenClassifieds: () => void;
  selectedDistrict?: string;
  onSelectDistrict?: (dist: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'తాజా వార్తలు' },
  { id: 'స్పెషల్ స్టోరీస్', label: '⭐ స్పెషల్ స్టోరీస్', isSpecial: true },
  { id: 'ఆంధ్రప్రదేశ్', label: 'ఆంధ్రప్రదేశ్' },
  { id: 'తెలంగాణ', label: 'తెలంగాణ' },
  { id: 'జిల్లా వార్త', label: 'జిల్లాలు' },
  { id: 'జాతీయం', label: 'జాతీయం' },
  { id: 'అంతర్జాతీయం', label: 'అంతర్జాతీయం' },
  { id: 'రాజకీయాలు', label: 'రాజకీయం' },
  { id: 'సినిమా', label: 'సినిమా' },
  { id: 'స్పోర్ట్స్', label: 'క్రీడలు' },
  { id: 'వ్యాపారం', label: 'బిజినెస్' },
  { id: 'classifieds', label: 'క్లాసిఫైడ్స్' },
];

export const PortalHeader: React.FC<PortalHeaderProps> = ({
  currentUser,
  onLoginClick,
  onAdminClick,
  onSpecialStoryClick,
  selectedCategory,
  onSelectCategory,
  onSearchClick,
  onOpenClassifieds,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentDateStr, setCurrentDateStr] = useState('');

  useEffect(() => {
    const days = ['ఆదివారం', 'సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'];
    const months = ['జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్', 'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'];
    const now = new Date();
    const dayName = days[now.getDay()];
    const dateNum = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    setCurrentDateStr(`${dayName}, ${dateNum} ${monthName} ${year}`);
  }, []);

  const handleCategoryClick = (catId: string) => {
    if (catId === 'classifieds') {
      onOpenClassifieds();
    } else {
      onSelectCategory(catId);
    }
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="w-full bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 transition-all">
      {/* 1. TOP SUB-BAR (Live Date, Editions, Social & App link) */}
      <div className="bg-slate-900 text-gray-300 text-xs py-1.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Left: Live Telugu Date & Edition */}
          <div className="flex items-center gap-3 font-mallanna text-sm">
            <span className="text-red-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block"></span>
              ప్రత్యక్ష ప్రసారం
            </span>
            <span className="text-gray-400 hidden sm:inline">|</span>
            <span className="text-gray-200">{currentDateStr}</span>
            <span className="text-gray-400 hidden md:inline">|</span>
            <div className="hidden md:flex items-center gap-2 text-gray-300">
              <span className="text-gray-400">ఎడిషన్:</span>
              <button onClick={() => onSelectCategory('ఆంధ్రప్రదేశ్')} className="hover:text-red-400 transition-colors">ఆంధ్రప్రదేశ్</button>
              <span>•</span>
              <button onClick={() => onSelectCategory('తెలంగాణ')} className="hover:text-red-400 transition-colors">తెలంగాణ</button>
              <span>•</span>
              <button onClick={() => onSelectCategory('జాతీయం')} className="hover:text-red-400 transition-colors">జాతీయం</button>
            </div>
          </div>

          {/* Right: Trending tags & App download link */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 text-xs font-mallanna text-gray-400">
              <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
              <span>ట్రెండింగ్:</span>
              <span className="text-white hover:text-red-400 cursor-pointer" onClick={() => onSelectCategory('ఆంధ్రప్రదేశ్')}>#అమరావతి</span>
              <span>•</span>
              <span className="text-white hover:text-red-400 cursor-pointer" onClick={() => onSelectCategory('తెలంగాణ')}>#హైదరాబాద్</span>
              <span>•</span>
              <span className="text-white hover:text-red-400 cursor-pointer" onClick={() => onSelectCategory('సినిమా')}>#సినిమా</span>
            </div>

            <a
              href="https://play.google.com/store/apps/details?id=com.alfanews.telugu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white font-medium px-2.5 py-0.5 rounded text-xs transition-colors"
            >
              <Smartphone className="w-3 h-3" />
              <span>ఆల్ఫా యాప్</span>
            </a>
          </div>
        </div>
      </div>

      {/* 2. MAIN LOGO & AD BANNER SECTION */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* LOGO */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div 
            onClick={() => handleCategoryClick('all')} 
            className="cursor-pointer flex items-center gap-3 group select-none"
          >
            {/* Logo Emblem */}
            <div className="relative flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-tr from-red-700 via-red-600 to-rose-500 text-white shadow-md shadow-red-200 group-hover:scale-105 transition-transform">
              <span className="font-ramabhadra text-2xl md:text-3xl font-bold">ఆ</span>
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-yellow-400 rounded-full border-2 border-white"></div>
            </div>

            {/* Logo Text */}
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="font-ramabhadra text-3xl md:text-4xl font-extrabold text-red-600 tracking-tight leading-none">
                  ఆల్ఫా
                </span>
                <span className="font-ramabhadra text-2xl md:text-3xl font-bold text-slate-800 leading-none">
                  న్యూస్
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] md:text-xs font-bold tracking-widest text-slate-500 uppercase font-poppins">
                  ALFA NEWS TELUGU
                </span>
                <span className="text-[10px] text-red-600 font-mallanna font-bold bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                  నిజం నిక్కచ్చిగా
                </span>
              </div>
            </div>
          </div>

          {/* Mobile menu hamburger button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={onSearchClick}
              className="p-2 text-gray-700 hover:text-red-600 rounded-lg hover:bg-gray-100"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-700 hover:text-red-600 rounded-lg hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* TOP AD BANNER (728x90 desktop / responsive) */}
        <div className="hidden md:flex flex-1 max-w-[640px] lg:max-w-[728px] h-[80px] bg-gradient-to-r from-amber-50 via-rose-50 to-orange-50 border border-amber-200 rounded-xl items-center justify-between px-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center gap-3.5 z-10">
            <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              📢
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded font-poppins uppercase">
                  AD SPACE
                </span>
                <p className="font-ramabhadra text-sm font-bold text-gray-900 leading-tight">
                  మీ వ్యాపార ప్రకటనల కోసం ఆల్ఫా న్యూస్ ఎంచుకోండి!
                </p>
              </div>
              <p className="font-mallanna text-xs text-gray-600 mt-0.5">
                లక్షలాది తెలుగు పాఠకులకు చేరువవ్వండి • ప్రకటనల కోసం: <span className="font-bold text-red-600 font-poppins">9305980736</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => window.open('https://api.whatsapp.com/send?phone=919305980736&text=Hi%2C%20I%20want%20to%20advertise%20on%20Alfa%20News', '_blank')}
            className="z-10 bg-red-600 hover:bg-red-700 text-white text-xs font-ramabhadra px-3.5 py-2 rounded-lg font-bold shadow transition-all hover:scale-105 shrink-0"
          >
            సంప్రదించండి
          </button>
          {/* Subtle background art */}
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-yellow-200/40 to-transparent pointer-events-none"></div>
        </div>
      </div>

      {/* 3. TOP MENU BAR (Category navigation & Quick actions) */}
      <nav className="bg-red-700 text-white border-t border-red-800 shadow-inner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Categories List (Scrollable on tablet/mobile) */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto no-scrollbar py-1">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`px-3 py-2 text-sm sm:text-base font-ramabhadra whitespace-nowrap transition-all rounded-md flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-white text-red-700 font-bold shadow-sm'
                      : cat.isSpecial
                      ? 'bg-yellow-400 text-red-950 font-bold hover:bg-yellow-300 shadow-sm animate-pulse-glow'
                      : 'text-white/95 hover:bg-red-800/80 hover:text-white'
                  }`}
                >
                  {cat.label}
                  {cat.isSpecial && (
                    <span className="bg-red-700 text-white text-[9px] px-1 py-0.2 rounded font-poppins uppercase tracking-wider font-bold">
                      EXCLUSIVE
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-red-800/60 shrink-0">
            {/* Search Button */}
            <button
              onClick={onSearchClick}
              className="p-2 text-white/90 hover:text-white hover:bg-red-800 rounded-lg transition-colors"
              title="వార్తలను వెతకండి"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Special Story Compose Button */}
            <button
              onClick={onSpecialStoryClick}
              className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-300 text-red-950 px-3 py-1.5 rounded-lg text-xs font-ramabhadra font-bold shadow-sm transition-all hover:scale-105 active:scale-95"
              title="వెబ్‌సైట్ ప్రత్యేకం: AI లేకుండా మీరే స్పెషల్ స్టోరీ ప్రచురించండి"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>స్పెషల్ స్టోరీ రాయండి</span>
            </button>

            {/* Login / Profile Button */}
            {currentUser ? (
              <button
                onClick={onAdminClick}
                className="flex items-center gap-1.5 bg-red-800 hover:bg-red-900 text-white px-3 py-1.5 rounded-lg text-xs font-ramabhadra font-medium transition-colors"
              >
                {currentUser.photoUrl ? (
                  <img src={currentUser.photoUrl} alt={currentUser.name} className="w-4 h-4 rounded-full" />
                ) : (
                  <UserIcon className="w-3.5 h-3.5" />
                )}
                <span className="max-w-[80px] truncate">{currentUser.name}</span>
              </button>
            ) : (
              <button
                onClick={onLoginClick}
                className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-ramabhadra font-medium transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>లాగిన్</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 4. MOBILE DRAWER MENU */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 text-white border-t border-slate-800 px-4 py-4 animate-fade-in space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs text-gray-400 font-mallanna">{currentDateStr}</span>
            <button
              onClick={onSpecialStoryClick}
              className="bg-yellow-400 text-red-950 px-3 py-1 rounded text-xs font-ramabhadra font-bold flex items-center gap-1"
            >
              <PenTool className="w-3 h-3" />
              <span>స్పెషల్ స్టోరీ రాయండి</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 font-ramabhadra text-sm">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className={`text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-red-600 text-white font-bold'
                    : 'text-gray-300 hover:bg-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            {currentUser ? (
              <button
                onClick={() => { setMobileMenuOpen(false); onAdminClick(); }}
                className="flex items-center gap-2 text-sm text-gray-200"
              >
                <UserIcon className="w-4 h-4 text-red-400" />
                <span>{currentUser.name} (ప్రొఫైల్)</span>
              </button>
            ) : (
              <button
                onClick={() => { setMobileMenuOpen(false); onLoginClick(); }}
                className="flex items-center gap-2 text-sm text-red-400 font-bold"
              >
                <LogIn className="w-4 h-4" />
                <span>లాగిన్ అవ్వండి</span>
              </button>
            )}

            <button
              onClick={() => { setMobileMenuOpen(false); onSearchClick(); }}
              className="p-2 text-gray-400 hover:text-white"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default PortalHeader;
