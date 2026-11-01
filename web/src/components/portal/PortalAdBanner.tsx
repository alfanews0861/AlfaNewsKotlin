import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface PortalAdBannerProps {
  slot?: string;
  format?: 'auto' | 'horizontal' | 'rectangle';
  variant?: 'under-slider' | 'sidebar' | 'in-feed' | 'in-article' | 'header';
  className?: string;
}

export const PortalAdBanner: React.FC<PortalAdBannerProps> = ({
  slot = '7964147976',
  format = 'auto',
  variant = 'under-slider',
  className = '',
}) => {
  const insRef = useRef<HTMLModElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    const timer = setTimeout(() => {
      try {
        if (
          insRef.current &&
          !insRef.current.getAttribute('data-adsbygoogle-status')
        ) {
          const rect = insRef.current.getBoundingClientRect();
          if (rect.width > 0) {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            initializedRef.current = true;
          }
        }
      } catch (e) {
        console.warn('AdSense render skipped:', e);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, []);

  if (variant === 'header') {
    return (
      <div
        className={`hidden md:flex flex-1 max-w-[640px] lg:max-w-[728px] min-h-[76px] lg:min-h-[90px] bg-white border border-gray-200/90 rounded-xl p-1.5 shadow-xs flex-col items-center justify-center overflow-hidden transition-all ${className}`}
      >
        <div className="w-full flex items-center justify-between text-[9px] text-gray-400 font-poppins uppercase tracking-wider mb-0.5 px-1">
          <span className="font-mallanna text-[10px]">ప్రకటన</span>
          <span>SPONSORED / ADVERTISEMENT</span>
        </div>
        <div className="w-full min-h-[60px] lg:min-h-[70px] flex items-center justify-center overflow-hidden">
          <ins
            ref={insRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', minHeight: '60px' }}
            data-ad-client="ca-pub-5787901991150360"
            data-ad-slot={slot}
            data-ad-format="horizontal"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    );
  }

  if (variant === 'under-slider') {
    return (
      <div
        className={`w-full bg-white border border-gray-200/90 rounded-2xl p-2 sm:p-2.5 shadow-sm overflow-hidden flex flex-col items-center justify-center transition-all ${className}`}
      >
        <div className="w-full flex items-center justify-between text-[10px] text-gray-400 font-poppins uppercase tracking-wider mb-1 px-1">
          <span className="font-mallanna text-[11px] text-gray-400">ప్రకటన</span>
          <span>SPONSORED / ADVERTISEMENT</span>
        </div>
        <div className="w-full min-h-[90px] flex items-center justify-center overflow-hidden">
          <ins
            ref={insRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', minHeight: '90px' }}
            data-ad-client="ca-pub-5787901991150360"
            data-ad-slot={slot}
            data-ad-format={format}
            data-full-width-responsive="true"
          />
        </div>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div
        className={`w-full bg-white border border-gray-200 rounded-2xl p-3 shadow-sm flex flex-col items-center justify-center text-center overflow-hidden ${className}`}
      >
        <div className="w-full flex items-center justify-between text-[10px] text-gray-400 font-poppins uppercase tracking-wider mb-2 px-1">
          <span className="font-mallanna text-[11px]">ప్రకటన</span>
          <span>SPONSORED</span>
        </div>
        <div className="w-full min-h-[250px] flex items-center justify-center overflow-hidden">
          <ins
            ref={insRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '300px', height: '250px' }}
            data-ad-client="ca-pub-5787901991150360"
            data-ad-slot={slot || '9154425628'}
            data-ad-format="rectangle"
            data-full-width-responsive="true"
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-2 font-mallanna">
          ఆల్ఫా న్యూస్ పార్టనర్ ప్రకటన
        </p>
      </div>
    );
  }

  if (variant === 'in-article') {
    return (
      <div
        className={`my-6 w-full bg-slate-50/80 border border-gray-200/80 rounded-2xl p-2.5 sm:p-3 shadow-sm flex flex-col items-center justify-center overflow-hidden ${className}`}
      >
        <div className="w-full flex items-center justify-between text-[10px] text-gray-400 font-poppins uppercase tracking-wider mb-1 px-1">
          <span className="font-mallanna text-[11px]">ప్రకటన</span>
          <span>ADVERTISEMENT</span>
        </div>
        <div className="w-full min-h-[90px] sm:min-h-[120px] flex items-center justify-center overflow-hidden">
          <ins
            ref={insRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', minHeight: '90px' }}
            data-ad-client="ca-pub-5787901991150360"
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    );
  }

  // in-feed / generic banner
  return (
    <div
      className={`w-full bg-white border border-gray-200/90 rounded-2xl p-2 sm:p-3 shadow-sm overflow-hidden flex flex-col items-center justify-center my-6 ${className}`}
    >
      <div className="w-full flex items-center justify-between text-[10px] text-gray-400 font-poppins uppercase tracking-wider mb-1 px-1">
        <span className="font-mallanna text-[11px] text-gray-400">ప్రకటన</span>
        <span>ADVERTISEMENT</span>
      </div>
      <div className="w-full min-h-[90px] flex items-center justify-center overflow-hidden">
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', minHeight: '90px' }}
          data-ad-client="ca-pub-5787901991150360"
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
};

export default PortalAdBanner;
