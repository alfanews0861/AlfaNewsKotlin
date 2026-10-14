import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types';
import { Search, Flame, User as UserIcon, LogIn, Menu, X, Smartphone, ChevronDown, MapPin } from 'lucide-react';
import { AP_DISTRICTS, TS_DISTRICTS } from '../../utils/newsFilter';

interface PortalHeaderProps {
  currentUser: User | null;
  onLoginClick: () => void;
  onAdminClick: () => void;
  onSpecialStoryClick?: () => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onSearchClick: () => void;
  onOpenClassifieds: () => void;
  selectedDistrict?: string;
  onSelectDistrict?: (dist: string, state?: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'తాజా వార్తలు' },
  { id: 'ఆంధ్రప్రదేశ్', label: 'ఆంధ్రప్రదేశ్' },
  { id: 'తెలంగాణ', label: 'తెలంగాణ' },
  { id: 'జిల్లా వార్తలు', label: 'జిల్లా వార్తలు', hasDropdown: true },
  { id: 'రాజకీయం', label: 'రాజకీయం' },
  { id: 'సినిమా', label: 'సినిమా' },
  { id: 'క్రీడలు', label: 'క్రీడలు' },
  { id: 'క్రైమ్', label: 'క్రైమ్' },
  { id: 'వ్యాపారం', label: 'వ్యాపారం' },
  { id: 'జాతీయం', label: 'జాతీయం' },
  { id: 'అంతర్జాతీయం', label: 'అంతర్జాతీయం' },
  { id: 'స్పెషల్ స్టోరీస్', label: 'స్పెషల్ స్టోరీస్' },
  { id: 'classifieds', label: 'క్లాసిఫైడ్స్' },
];

export const PortalHeader: React.FC<PortalHeaderProps> = ({
  currentUser,
  onLoginClick,
  onAdminClick,
  selectedCategory,
  onSelectCategory,
  onSearchClick,
  onOpenClassifieds,
  selectedDistrict,
  onSelectDistrict,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);
  const [activeDistrictTab, setActiveDistrictTab] = useState<'AP' | 'TS'>('AP');
  const [mobileDistrictsOpen, setMobileDistrictsOpen] = useState(false);
  const [mobileStateExpanded, setMobileStateExpanded] = useState<'AP' | 'TS' | null>('AP');

  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDistrictDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategoryClick = (catId: string) => {
    if (catId === 'classifieds') {
      onSelectCategory('classifieds');
    } else if (catId === 'జిల్లా వార్తలు' || catId === 'districts_menu') {
      onSelectCategory('జిల్లా వార్తలు');
      setDistrictDropdownOpen((prev) => !prev);
      return;
    } else {
      onSelectCategory(catId);
    }
    setDistrictDropdownOpen(false);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDistrictSelect = (district: string, state: 'AP' | 'TS') => {
    setDistrictDropdownOpen(false);
    setMobileMenuOpen(false);
    if (onSelectDistrict) {
      onSelectDistrict(district, state);
    }
    onSelectCategory(district);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="w-full bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 transition-all font-mallanna">
      {/* 1. TOP SUB-BAR (Live Date, Editions, Social & App link) */}
      <div className="bg-slate-900 text-gray-300 text-xs py-1.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Left: Live Telugu Date & Edition */}
          <div className="flex items-center gap-3 font-mallanna text-sm">
            <span className="text-red-400 flex items-center gap-1">
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
              className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2.5 py-0.5 rounded text-xs transition-colors"
            >
              <Smartphone className="w-3 h-3" />
              <span>ఆల్ఫా యాప్</span>
            </a>
          </div>
        </div>
      </div>

      {/* 2. MAIN LOGO & AD BANNER SECTION */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* LOGO - Official Android App Icon */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div 
            onClick={() => handleCategoryClick('all')} 
            className="cursor-pointer flex items-center gap-3 group select-none"
          >
            {/* App Icon */}
            <img
              src="/app_icon.png"
              alt="Alfa News Telugu Logo"
              className="w-12 h-12 md:w-14 md:h-14 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform border border-red-100"
            />

            {/* Logo Text */}
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="font-ramabhadra text-3xl md:text-4xl text-red-600 tracking-tight leading-none">
                  ఆల్ఫా
                </span>
                <span className="font-ramabhadra text-2xl md:text-3xl text-slate-800 leading-none">
                  న్యూస్
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] md:text-xs tracking-widest text-slate-500 uppercase font-poppins">
                  ALFA NEWS TELUGU
                </span>
                <span className="text-[10px] text-red-600 font-mallanna bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
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
        <div className="hidden md:flex flex-1 max-w-[640px] lg:max-w-[728px] h-[76px] bg-gradient-to-r from-amber-50 via-rose-50 to-orange-50 border border-amber-200 rounded-xl items-center justify-between px-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center gap-3.5 z-10">
            <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center text-lg shadow-sm">
              📢
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-poppins uppercase">
                  AD SPACE
                </span>
                <p className="font-ramabhadra text-sm text-gray-900 leading-tight">
                  మీ వ్యాపార ప్రకటనల కోసం ఆల్ఫా న్యూస్ ఎంచుకోండి!
                </p>
              </div>
              <p className="font-mallanna text-xs text-gray-600 mt-0.5">
                లక్షలాది తెలుగు పాఠకులకు చేరువవ్వండి • ప్రకటనల కోసం: <a href="mailto:contact@alfanews.app" className="text-red-600 font-poppins hover:underline">contact@alfanews.app</a>
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = 'mailto:contact@alfanews.app?subject=Advertisement%20Enquiry'}
            className="z-10 bg-red-600 hover:bg-red-700 text-white text-xs font-ramabhadra px-3.5 py-2 rounded-lg shadow transition-all hover:scale-105 shrink-0"
          >
            సంప్రదించండి
          </button>
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-yellow-200/40 to-transparent pointer-events-none"></div>
        </div>
      </div>

      {/* 3. TOP MENU BAR (Category navigation & District Dropdown) */}
      <nav className="bg-red-700 text-white border-t border-red-800 shadow-inner relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Categories List */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto no-scrollbar py-1">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id || (cat.hasDropdown && (AP_DISTRICTS.includes(selectedCategory) || TS_DISTRICTS.includes(selectedCategory)));
              
              if (cat.hasDropdown) {
                return (
                  <div key={cat.id} className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => {
                        onSelectCategory('జిల్లా వార్తలు');
                        setDistrictDropdownOpen((prev) => !prev);
                      }}
                      className={`px-3 py-2 text-sm sm:text-base font-ramabhadra whitespace-nowrap transition-all rounded-md flex items-center gap-1 ${
                        isSelected || districtDropdownOpen
                          ? 'bg-white text-red-700 shadow-sm'
                          : 'text-white/95 hover:bg-red-800/80 hover:text-white'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${districtDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* DISTRICTS MEGA DROPDOWN (DESKTOP) */}
                    {districtDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-[680px] bg-white text-gray-900 rounded-2xl shadow-2xl border border-gray-200 p-5 z-50 animate-fade-in font-mallanna">
                        {/* State Selection Tabs */}
                        <div className="flex items-center gap-3 pb-3 border-b border-gray-200 mb-4">
                          <button
                            onClick={() => setActiveDistrictTab('AP')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-ramabhadra transition-all ${
                              activeDistrictTab === 'AP'
                                ? 'bg-red-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <MapPin className="w-4 h-4" />
                            <span>ఆంధ్రప్రదేశ్ జిల్లాలు ({AP_DISTRICTS.length})</span>
                          </button>

                          <button
                            onClick={() => setActiveDistrictTab('TS')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-ramabhadra transition-all ${
                              activeDistrictTab === 'TS'
                                ? 'bg-red-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <MapPin className="w-4 h-4" />
                            <span>తెలంగాణ జిల్లాలు ({TS_DISTRICTS.length})</span>
                          </button>
                        </div>

                        {/* Districts Grid */}
                        <div className="max-h-[380px] overflow-y-auto pr-2">
                          <p className="text-xs text-gray-500 mb-2 font-mallanna">
                            మీ జిల్లా వార్తలను చదవడానికి క్రింది జిల్లాను ఎంచుకోండి:
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {(activeDistrictTab === 'AP' ? AP_DISTRICTS : TS_DISTRICTS).map((district) => {
                              const isDistActive = selectedCategory === district;
                              return (
                                <button
                                  key={district}
                                  onClick={() => handleDistrictSelect(district, activeDistrictTab)}
                                  className={`text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-ramabhadra transition-all truncate ${
                                    isDistActive
                                      ? 'bg-red-50 text-red-700 border border-red-300'
                                      : 'hover:bg-red-50 hover:text-red-700 text-gray-700'
                                  }`}
                                  title={district}
                                >
                                  {district}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Dropdown Footer */}
                        <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                          <span>ఆల్ఫా న్యూస్ - సమగ్ర జిల్లా సమాచారం</span>
                          <button
                            onClick={() => setDistrictDropdownOpen(false)}
                            className="text-red-600 hover:underline font-ramabhadra"
                          >
                            మూసివేయి ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`px-3 py-2 text-sm sm:text-base font-ramabhadra whitespace-nowrap transition-all rounded-md flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-white text-red-700 shadow-sm'
                      : 'text-white/95 hover:bg-red-800/80 hover:text-white'
                  }`}
                >
                  {cat.label}
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

            {/* Login / Profile Button */}
            {currentUser ? (
              <button
                onClick={onAdminClick}
                className="flex items-center gap-1.5 bg-red-800 hover:bg-red-900 text-white px-3 py-1.5 rounded-lg text-xs font-ramabhadra transition-colors"
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
                className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-ramabhadra transition-colors"
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
        <div className="md:hidden bg-slate-900 text-white border-t border-slate-800 px-4 py-4 animate-fade-in space-y-4 max-h-[85vh] overflow-y-auto font-mallanna">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs text-gray-400 font-mallanna">{currentDateStr}</span>
            <button
              onClick={() => { setMobileMenuOpen(false); onSearchClick(); }}
              className="flex items-center gap-1 text-xs text-red-400 font-ramabhadra"
            >
              <Search className="w-3.5 h-3.5" />
              <span>శోధించండి</span>
            </button>
          </div>

          {/* Mobile Categories Grid */}
          <div className="space-y-2 font-ramabhadra text-sm">
            {CATEGORIES.map((cat) => {
              if (cat.hasDropdown) {
                return (
                  <div key={cat.id} className="border border-slate-800 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between bg-slate-800/80">
                      <button
                        onClick={() => {
                          onSelectCategory('జిల్లా వార్తలు');
                          setMobileMenuOpen(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex-1 flex items-center gap-1.5 px-3 py-2.5 text-left text-white"
                      >
                        <MapPin className="w-4 h-4 text-red-400" />
                        <span>జిల్లా వార్తలు</span>
                      </button>
                      <button
                        onClick={() => setMobileDistrictsOpen(!mobileDistrictsOpen)}
                        className="p-2.5 text-gray-300 hover:text-white"
                        aria-label="జిల్లాల జాబితా"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${mobileDistrictsOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Expandable sub-menus for Andhra Pradesh & Telangana */}
                    {mobileDistrictsOpen && (
                      <div className="p-3 bg-slate-950/70 space-y-3">
                        {/* Sub-menu 1: Andhra Pradesh */}
                        <div>
                          <button
                            onClick={() => setMobileStateExpanded(mobileStateExpanded === 'AP' ? null : 'AP')}
                            className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-800 text-xs text-amber-300 rounded-lg"
                          >
                            <span>ఆంధ్రప్రదేశ్ జిల్లాలు ({AP_DISTRICTS.length})</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${mobileStateExpanded === 'AP' ? 'rotate-180' : ''}`} />
                          </button>
                          {mobileStateExpanded === 'AP' && (
                            <div className="grid grid-cols-2 gap-1.5 mt-2 max-h-48 overflow-y-auto pl-1">
                              {AP_DISTRICTS.map((d) => (
                                <button
                                  key={d}
                                  onClick={() => handleDistrictSelect(d, 'AP')}
                                  className="text-left text-xs text-gray-300 hover:text-white hover:bg-slate-800 px-2 py-1.5 rounded truncate"
                                >
                                  {d}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Sub-menu 2: Telangana */}
                        <div>
                          <button
                            onClick={() => setMobileStateExpanded(mobileStateExpanded === 'TS' ? null : 'TS')}
                            className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-800 text-xs text-cyan-300 rounded-lg"
                          >
                            <span>తెలంగాణ జిల్లాలు ({TS_DISTRICTS.length})</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${mobileStateExpanded === 'TS' ? 'rotate-180' : ''}`} />
                          </button>
                          {mobileStateExpanded === 'TS' && (
                            <div className="grid grid-cols-2 gap-1.5 mt-2 max-h-48 overflow-y-auto pl-1">
                              {TS_DISTRICTS.map((d) => (
                                <button
                                  key={d}
                                  onClick={() => handleDistrictSelect(d, 'TS')}
                                  className="text-left text-xs text-gray-300 hover:text-white hover:bg-slate-800 px-2 py-1.5 rounded truncate"
                                >
                                  {d}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-red-600 text-white'
                      : 'text-gray-300 hover:bg-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
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
                className="flex items-center gap-2 text-sm text-red-400 font-ramabhadra"
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
