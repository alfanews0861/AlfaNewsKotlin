import React from 'react';
import { MapPin, ChevronDown, Settings2, Monitor } from 'lucide-react';
import { setManualViewMode } from '../utils/useIsMobile';

interface MobileHeaderProps {
  district?: string | null;
  onDistrictClick: () => void;
  onSettingsClick: () => void;
  showDistrictSelector?: boolean;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  district,
  onDistrictClick,
  onSettingsClick,
  showDistrictSelector = true,
}) => {
  const displayDistrict = district?.trim() || 'జిల్లా ఎంచుకోండి';

  return (
    <header className="h-14 w-full bg-[#0B192C] border-b border-white/10 flex items-center justify-between px-3.5 z-40 shrink-0 select-none shadow-md">
      {/* Left: Brand Logo */}
      <div className="flex items-center gap-1 cursor-pointer" onClick={() => window.location.reload()}>
        <span className="font-poppins font-black text-2xl text-white tracking-tight">alfa</span>
        <span className="font-poppins font-bold text-2xl text-red-600 tracking-tight">news</span>
      </div>

      {/* Right: District Selector & Actions */}
      <div className="flex items-center gap-2">
        {showDistrictSelector && (
          <button
            onClick={onDistrictClick}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 border border-white/15 text-white transition-all max-w-[170px]"
            title="జిల్లా మార్చండి"
          >
            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span className="font-mallanna text-sm font-semibold truncate leading-none">
              {displayDistrict}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </button>
        )}

        {/* Preferences / Settings */}
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 border border-white/15 text-white transition-all"
          title="వర్గాల ప్రాధాన్యతలు (Preferences)"
        >
          <Settings2 className="w-4 h-4" />
        </button>

        {/* Desktop View Switcher (Subtle) */}
        <button
          onClick={() => setManualViewMode('desktop')}
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 text-gray-400 hover:text-white transition-all hidden xs:flex"
          title="డెస్క్‌టాప్ వెర్షన్ (Desktop View)"
        >
          <Monitor className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export default MobileHeader;
