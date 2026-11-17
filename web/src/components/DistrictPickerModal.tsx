import React, { useState } from 'react';
import { AP_DISTRICTS, TS_DISTRICTS } from '../types';
import { X, Search, Check, MapPin } from 'lucide-react';

interface DistrictPickerModalProps {
  currentDistrict?: string | null;
  onSelectDistrict: (district: string | null) => void;
  onClose: () => void;
}

const DistrictPickerModal: React.FC<DistrictPickerModalProps> = ({
  currentDistrict,
  onSelectDistrict,
  onClose,
}) => {
  const [selectedState, setSelectedState] = useState<'AP' | 'TS'>(() => {
    if (currentDistrict && AP_DISTRICTS.includes(currentDistrict)) return 'AP';
    return 'TS';
  });
  const [search, setSearch] = useState('');

  const list = selectedState === 'AP' ? AP_DISTRICTS : TS_DISTRICTS;
  const filtered = list.filter((d) => d.toLowerCase().includes(search.toLowerCase().trim()));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-mallanna"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-slide-up text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-500" />
            <h3 className="font-ramabhadra text-lg text-white">మీ జిల్లాను ఎంచుకోండి</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* State Toggle Tabs */}
        <div className="grid grid-cols-2 p-3 gap-2 bg-black/40 border-b border-white/5 shrink-0">
          <button
            onClick={() => setSelectedState('AP')}
            className={`py-2 px-4 rounded-xl text-sm font-ramabhadra transition-all ${
              selectedState === 'AP'
                ? 'bg-red-600 text-white font-bold shadow-md'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            ఆంధ్రప్రదేశ్ ({AP_DISTRICTS.length})
          </button>
          <button
            onClick={() => setSelectedState('TS')}
            className={`py-2 px-4 rounded-xl text-sm font-ramabhadra transition-all ${
              selectedState === 'TS'
                ? 'bg-red-600 text-white font-bold shadow-md'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            తెలంగాణ ({TS_DISTRICTS.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="జిల్లా పేరును వెతకండి..."
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-red-500 transition-colors font-mallanna placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* District List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 no-scrollbar">
          {/* All Districts option */}
          <button
            onClick={() => {
              onSelectDistrict(null);
              onClose();
            }}
            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
              !currentDistrict
                ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-200'
            }`}
          >
            <span className="font-ramabhadra text-base">అన్ని జిల్లాలు (Universal Feed)</span>
            {!currentDistrict && <Check className="w-4 h-4 text-red-400" />}
          </button>

          {filtered.map((district) => {
            const isSelected = currentDistrict === district;
            return (
              <button
                key={district}
                onClick={() => {
                  onSelectDistrict(district);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-gray-200'
                }`}
              >
                <span className="font-mallanna text-lg leading-none">{district}</span>
                {isSelected && <Check className="w-4 h-4 text-red-400" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DistrictPickerModal;
