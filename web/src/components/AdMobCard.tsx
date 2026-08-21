
import React, { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

const AdMobCard: React.FC = () => {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const adElement = document.querySelector('.adsbygoogle:not([data-adsbygoogle-status])');
        if (typeof window !== 'undefined' && adElement) {
          const rect = adElement.getBoundingClientRect();
          if (rect.width > 0) {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
          } else {
            console.warn("AdMob: Ad container has 0 width, skipping push.");
          }
        }
      } catch (e) {
        console.warn("AdMob initialization failed:", e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full h-full snap-start snap-always shrink-0 bg-black flex flex-col relative overflow-hidden border-b border-gray-900">
      {/* Brand Header Overlay */}
      <div className="absolute top-6 left-6 z-10 flex items-center gap-2 opacity-30">
          <span className="font-poppins font-bold text-xl text-white">alfa</span>
          <span className="font-poppins font-semibold text-xl text-red-600">news</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {/* Ad Container */}
        <div className="w-full max-w-[360px] bg-gray-900/40 rounded-xl p-4 flex flex-col items-center justify-center border border-white/5">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-4">Advertisement</p>
            
            <div className="w-full min-h-[250px] bg-black/20 rounded flex items-center justify-center overflow-hidden">
                <ins className="adsbygoogle"
                    style={{ display: 'block', width: '300px', height: '250px' }}
                    data-ad-client="ca-pub-5787901991150360"
                    data-ad-slot="9154425628"></ins>
            </div>
            
            <p className="text-[9px] text-gray-600 mt-4 text-center font-mallanna">ప్రకటనలను చూడటం ద్వారా మీరు మా ఉచిత సేవను కొనసాగించడానికి సహాయపడుతున్నారు.</p>
        </div>
      </div>

      <div className="absolute bottom-10 w-full text-center">
          <p className="text-[8px] text-gray-700 font-bold uppercase tracking-[0.4em] font-inter">Sponsored Content</p>
      </div>
      
      {/* Visual Accents */}
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-red-600/5 rounded-full blur-[120px] pointer-events-none"></div>
    </div>
  );
};

export default AdMobCard;
