import React from 'react';
import { openNativePlayStore } from '../utils/playStoreHelper';
import { X, Star, Bell, MapPin, Zap, Download } from 'lucide-react';

interface AppDownloadPopupProps {
  onClose: () => void;
  postId?: string | null;
}

const AppDownloadPopup: React.FC<AppDownloadPopupProps> = ({ onClose, postId }) => {
  const handleDownload = () => {
    openNativePlayStore(postId || null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in font-mallanna"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border border-white/15 rounded-3xl p-6 shadow-2xl relative text-center text-white overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Accent */}
        <div className="absolute -top-20 -left-20 w-44 h-44 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-gray-300 hover:text-white transition-all z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center shadow-lg shadow-red-600/30 mb-4 border border-white/20">
          <span className="font-poppins font-black text-2xl text-white tracking-wider">A</span>
        </div>

        {/* Headline */}
        <h3 className="font-ramabhadra text-xl text-white leading-tight mb-2">
          ఆల్ఫా న్యూస్ యాప్
        </h3>
        <p className="font-mallanna text-base text-gray-300 leading-snug mb-5">
          మరిన్ని తాజా వార్తల కోసం మన అల్ఫాన్యూస్ యాప్ డౌన్‌లోడ్ చేసుకోండి!
        </p>

        {/* Features list */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 mb-5 text-left space-y-2.5">
          <div className="flex items-center gap-2.5 text-xs text-gray-200">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span>క్షణాల్లో వేగవంతమైన బ్రేకింగ్ న్యూస్</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-gray-200">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>మీ స్వంత మండలం & జిల్లా తాజా వార్తలు</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-gray-200">
            <Bell className="w-4 h-4 text-blue-400 shrink-0" />
            <span>ముఖ్యమైన వార్తలకు లైవ్ నోటిఫికేషన్లు</span>
          </div>
        </div>

        {/* Rating Badge */}
        <div className="flex items-center justify-center gap-1.5 mb-5 text-xs text-amber-400 font-bold">
          <div className="flex text-amber-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <span className="text-gray-300 ml-1">4.8 Rating • 100% ఉచితం</span>
        </div>

        {/* CTA Download Button */}
        <button
          onClick={handleDownload}
          className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-98 text-white font-bold text-base font-ramabhadra flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer mb-3"
        >
          <Download className="w-5 h-5" />
          <span>డౌన్‌లోడ్ చేసుకోండి (Google Play)</span>
        </button>

        {/* Dismiss Button */}
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xs underline font-mallanna py-1 transition-colors cursor-pointer"
        >
          తర్వాత చూద్దాం (వార్తలు చదవండి)
        </button>
      </div>
    </div>
  );
};

export default AppDownloadPopup;
