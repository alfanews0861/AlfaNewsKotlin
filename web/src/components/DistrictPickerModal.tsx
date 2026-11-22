import React, { useState } from 'react';
import { X, Search, Check, MapPin, Navigation } from 'lucide-react';
import {
  ALL_EDITIONS_LIST,
  EDITIONS,
  LANGUAGE_LABELS,
  getBodyFontClass,
  getDistrictDisplayName,
  getHeadlineFontClass,
  resolveStateCode,
  suggestStateFromCoords,
  validateLanguageForState,
  type LanguageCode,
  type StateCode,
} from '../data/editions';
import { Language } from '../types';
import { t } from '../utils/translations';

interface DistrictPickerModalProps {
  currentState?: StateCode | string | null;
  currentDistrict?: string | null;
  currentLanguage?: Language | LanguageCode;
  onSelectDistrict: (district: string | null) => void;
  onSelectEdition?: (selection: {
    stateCode: StateCode;
    district: string | null;
    language: Language;
  }) => void;
  onClose: () => void;
}

const DistrictPickerModal: React.FC<DistrictPickerModalProps> = ({
  currentState,
  currentDistrict,
  currentLanguage = Language.TELUGU,
  onSelectDistrict,
  onSelectEdition,
  onClose,
}) => {
  const initialState: StateCode =
    resolveStateCode(currentState) ||
    resolveStateCode(currentDistrict) ||
    'TS';

  const [selectedState, setSelectedState] = useState<StateCode>(initialState);
  const [selectedLang, setSelectedLang] = useState<LanguageCode>(() =>
    validateLanguageForState(initialState, currentLanguage)
  );
  const [search, setSearch] = useState('');
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [gpsSuggestion, setGpsSuggestion] = useState<StateCode | null>(null);

  const activeEdition = EDITIONS[selectedState];
  const headlineFont = getHeadlineFontClass(selectedLang);
  const bodyFont = getBodyFontClass(selectedLang);

  const handleStateClick = (code: StateCode) => {
    setSelectedState(code);
    setSearch('');
    // Strict State-Bound Language: switch automatically to the state's primary language
    setSelectedLang(EDITIONS[code].primaryLanguage);
  };

  const handleDetectGps = () => {
    if (!navigator.geolocation) return;
    setGpsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const suggested = suggestStateFromCoords(pos.coords.latitude, pos.coords.longitude);
        if (suggested) {
          setGpsSuggestion(suggested);
          setSelectedState(suggested);
          setSelectedLang(EDITIONS[suggested].primaryLanguage);
        }
        setGpsDetecting(false);
      },
      () => setGpsDetecting(false),
      { timeout: 8000 }
    );
  };

  const commitSelection = (district: string | null) => {
    const validLang = validateLanguageForState(selectedState, selectedLang) as Language;
    if (onSelectEdition) {
      onSelectEdition({
        stateCode: selectedState,
        district,
        language: validLang,
      });
    } else {
      try {
        localStorage.setItem('user_selected_state', selectedState);
        localStorage.setItem('app_language', validLang);
      } catch {}
      onSelectDistrict(district);
    }
    onClose();
  };

  const q = search.toLowerCase().trim();
  const filteredDistricts = activeEdition.districts.filter((d) => {
    if (!q) return true;
    const display = getDistrictDisplayName(d, selectedLang).toLowerCase();
    return d.toLowerCase().includes(q) || display.includes(q);
  });

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in ${bodyFont}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl animate-slide-up text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Exact Existing Colors Preserved */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-500" />
            <h3 className={`${headlineFont} text-lg text-white`}>
              {t(selectedLang, 'choose_edition_title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label={t(selectedLang, 'close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GPS Initial Suggestion Bar (Optional — Manual State Selection Always Available) */}
        <div className="px-3 pt-2.5 pb-1.5 bg-black/40 border-b border-white/5 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDetectGps}
            disabled={gpsDetecting}
            className="flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-200 transition-colors"
          >
            <Navigation className={`w-3.5 h-3.5 text-red-500 ${gpsDetecting ? 'animate-spin' : ''}`} />
            <span>
              {gpsDetecting ? t(selectedLang, 'detecting_location') : t(selectedLang, 'detect_location')}
            </span>
          </button>

          {/* Strict State-Bound Language Switcher (ONLY languages supported by selected state!) */}
          <div className="flex items-center gap-1">
            {activeEdition.supportedLanguages.map((langCode) => {
              const active = selectedLang === langCode;
              return (
                <button
                  key={langCode}
                  type="button"
                  onClick={() => setSelectedLang(langCode)}
                  className={`px-2.5 py-1.5 min-h-[36px] rounded-lg text-xs transition-all ${
                    active
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {LANGUAGE_LABELS[langCode].nativeName}
                </button>
              );
            })}
          </div>
        </div>

        {gpsSuggestion && (
          <div className="px-3 py-1.5 bg-red-600/15 border-b border-red-500/20 text-xs text-red-300 shrink-0">
            {t(selectedLang, 'gps_suggestion_prefix')} {EDITIONS[gpsSuggestion].nativeName} ({EDITIONS[gpsSuggestion].name})
          </div>
        )}

        {/* 9-State Grid Selector */}
        <div className="p-3 bg-black/40 border-b border-white/5 shrink-0">
          <div className="grid grid-cols-3 gap-1.5">
            {ALL_EDITIONS_LIST.map((ed) => {
              const isActive = selectedState === ed.code;
              const stateFont = getHeadlineFontClass(ed.primaryLanguage);
              return (
                <button
                  key={ed.code}
                  type="button"
                  onClick={() => handleStateClick(ed.code)}
                  className={`py-2 px-2 min-h-[44px] rounded-xl text-xs transition-all flex flex-col items-center justify-center leading-tight ${
                    isActive
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-white/5 text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className={`${stateFont} text-[13px] truncate max-w-full`}>
                    {ed.nativeName}
                  </span>
                  <span className="text-[10px] opacity-75">
                    {ed.districts.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(selectedLang, 'search_district')}
              className={`w-full pl-9 pr-4 py-2.5 min-h-[44px] bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-red-500 transition-colors ${bodyFont} placeholder:text-gray-500`}
            />
          </div>
        </div>

        {/* District List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 no-scrollbar">
          {/* State-wide option */}
          <button
            type="button"
            onClick={() => commitSelection(null)}
            className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all ${
              !currentDistrict && initialState === selectedState
                ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-200'
            }`}
          >
            <span className={`${headlineFont} text-base`}>
              {activeEdition.nativeName} — {t(selectedLang, 'all_districts_state')}
            </span>
            {!currentDistrict && initialState === selectedState && (
              <Check className="w-4 h-4 text-red-400" />
            )}
          </button>

          {filteredDistricts.map((district) => {
            const isSelected = currentDistrict === district;
            const displayName = getDistrictDisplayName(district, selectedLang);
            return (
              <button
                key={district}
                type="button"
                onClick={() => commitSelection(district)}
                className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all ${
                  isSelected
                    ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-gray-200'
                }`}
              >
                <div className="flex flex-col items-start text-left">
                  <span className={`${bodyFont} text-lg leading-tight`}>{displayName}</span>
                  {displayName !== district && (
                    <span className="text-[11px] text-gray-400">{district}</span>
                  )}
                </div>
                {isSelected && <Check className="w-4 h-4 text-red-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DistrictPickerModal;
