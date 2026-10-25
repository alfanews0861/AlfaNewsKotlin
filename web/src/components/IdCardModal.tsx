
import React, { useEffect, useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { User } from '../types';

interface IdCardModalProps {
  show: boolean;
  onClose: () => void;
  user: User;
  displayPhoto: string;
  displaySignature: string;
}

// Convert image URL to Data URL to prevent CORS taint in html2canvas
const toDataUrlSafe = async (url: string, fallbackUrl?: string): Promise<string> => {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('Fetch failed');
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch (_e) {
    if (fallbackUrl && fallbackUrl !== url) {
      try {
        const fbRes = await fetch(fallbackUrl);
        if (fbRes.ok) {
          const blob = await fbRes.blob();
          return await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(fallbackUrl);
            reader.readAsDataURL(blob);
          });
        }
      } catch (_fbErr) {}
      return fallbackUrl;
    }
    return url;
  }
};

const IdCardModal: React.FC<IdCardModalProps> = ({ show, onClose, user, displayPhoto, displaySignature }) => {
  const [scale, setScale] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);
  const [resolvedPhoto, setResolvedPhoto] = useState(displayPhoto);
  const [resolvedSignature, setResolvedSignature] = useState(displaySignature || '/authorized_signature.png');
  const cardRef = useRef<HTMLDivElement>(null);

  // Pre-resolve signature and photo to ensure 100% presence in downloaded file
  useEffect(() => {
    let isMounted = true;
    const preload = async () => {
      const sig = await toDataUrlSafe(displaySignature || '/authorized_signature.png', '/authorized_signature.png');
      const photo = await toDataUrlSafe(displayPhoto);
      if (isMounted) {
        setResolvedSignature(sig);
        setResolvedPhoto(photo);
      }
    };
    if (show) {
      preload();
    }
    return () => { isMounted = false; };
  }, [show, displaySignature, displayPhoto]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      // Ensure images are fully decoded before capturing
      const images = cardRef.current.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );

      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: Math.max(3, window.devicePixelRatio || 2),
        backgroundColor: '#ffffff',
        logging: false
      } as any);

      // High Quality JPG export (0.98 quality)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.98);
      const link = document.createElement('a');
      const safeName = (user.name || 'Reporter').trim().replace(/\s+/g, '_');
      link.download = `AlfaNews_ID_Card_${safeName}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('ID card download error:', err);
      alert('ఐడీ కార్డు డౌన్‌లోడ్ చేయడంలో సమస్య వచ్చింది.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Logic to shrink card to fit BOTH width and height of the screen centrally
  useEffect(() => {
    if (!show) return;

    const handleResize = () => {
        if (cardRef.current) {
            const cardWidth = 320; // Standard CR80 printable proportion
            const cardHeight = cardRef.current.offsetHeight || 510; 
            
            const paddingX = 20;
            const paddingY = 80; // Vertical padding for close button & download button
            
            const availableWidth = window.innerWidth - paddingX;
            const availableHeight = window.innerHeight - paddingY;

            const scaleX = availableWidth < cardWidth ? availableWidth / cardWidth : 1;
            const scaleY = availableHeight < cardHeight ? availableHeight / cardHeight : 1;

            const finalScale = Math.min(scaleX, scaleY, 1);
            setScale(finalScale);
        }
    };

    handleResize();
    const timer = setTimeout(handleResize, 100);
    window.addEventListener('resize', handleResize);
    
    return () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(timer);
    };
  }, [show, user]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 h-[100dvh] w-screen bg-black/90 backdrop-blur-sm z-[100] flex flex-col items-center justify-center overflow-hidden animate-slide-down">
        <style>{`
            @keyframes slideDown {
                from { transform: translateY(-100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .animate-slide-down {
                animation: slideDown 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            }
        `}</style>

        {/* Close Button - Fixed at Top Right */}
        <button 
            onClick={onClose}
            className="absolute top-5 right-5 text-white hover:text-red-500 p-2 z-[110] bg-white/10 rounded-full backdrop-blur-md transition-all border border-white/20 shadow-xl"
            aria-label="Close"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {/* Card Wrapper - Centered with CR-80 Standard Printable Proportion */}
        <div 
            style={{ 
                transform: `scale(${scale})`, 
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease-out'
            }} 
            className="shadow-2xl relative"
        >
            {/* DIRECT HTML CARD DISPLAY (CR-80 Printable Proportion ~ 1 : 1.58) */}
            <div ref={cardRef} className="w-[320px] bg-white rounded-xl overflow-hidden relative flex flex-col box-border shrink-0 select-none shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                {/* Lanyard Hole Mockup */}
                <div className="absolute top-2.5 left-1/2 transform -translate-x-1/2 w-14 h-1.5 bg-gray-200 rounded-full z-10 opacity-50"></div>

                {/* 1. Logo alfanews */}
                <div className="pt-6 pb-2 text-center bg-white">
                    <h1 className="font-poppins font-black text-2xl tracking-tight text-gray-900 leading-none">
                        alfanews
                    </h1>
                    <p className="text-[9px] text-gray-500 font-bold tracking-[0.1em] mt-0.5 font-inter uppercase">
                        Digital News Media Network
                    </p>
                </div>

                {/* 2. RED PRESS BAND */}
                <div className="bg-[#FF0000] text-white text-center py-1.5 relative shadow-sm">
                    <span className="font-serif font-bold text-xl tracking-[0.25em] uppercase">
                        PRESS
                    </span>
                </div>

                {/* 3. Main Content Area */}
                <div className="px-5 py-3.5 flex flex-col items-center bg-white flex-grow">
                    <div className="w-24 h-28 rounded-lg border-2 border-gray-300 p-0.5 shadow-sm mb-2.5 bg-white relative">
                        <img 
                            src={resolvedPhoto} 
                            className="w-full h-full object-cover object-top rounded-[4px]" 
                            alt="Profile"
                            crossOrigin="anonymous"
                        />
                    </div>
                    <h2 className="text-xl font-bold text-black font-ramabhadra text-center leading-tight">
                        {user.name}
                    </h2>
                    <p className="text-[#D32F2F] font-bold text-xs uppercase tracking-wider mt-0.5 mb-3 font-inter">
                        {user.role === 'ADMIN' ? 'ADMIN' : user.role === 'REPORTER' ? 'REPORTER' : user.role === 'REGIONAL_INCHARGE' ? 'REGIONAL INCHARGE' : 'STAFF REPORTER'}
                    </p>
                    <div className="w-full space-y-1.5 font-inter">
                        <div className="flex items-center text-xs">
                            <span className="w-16 font-bold text-gray-400 uppercase tracking-wide shrink-0">ID NO</span>
                            <div className="flex-grow mx-2 border-b border-dotted border-gray-300 relative top-1"></div>
                            <span className="font-bold text-gray-900 font-mono text-xs">{user.id.substring(0, 8).toUpperCase()}</span>
                        </div>
                        <div className="flex items-center text-xs">
                            <span className="w-16 font-bold text-gray-400 uppercase tracking-wide shrink-0">Location</span>
                            <div className="flex-grow mx-2 border-b border-dotted border-gray-300 relative top-1"></div>
                            <span className="font-bold text-gray-900 text-right truncate max-w-[130px]">{user.address || user.district || 'ఆంధ్రప్రదేశ్ / తెలంగాణ'}</span>
                        </div>
                        <div className="flex items-center text-xs">
                            <span className="w-16 font-bold text-gray-400 uppercase tracking-wide shrink-0">Contact</span>
                            <div className="flex-grow mx-2 border-b border-dotted border-gray-300 relative top-1"></div>
                            <span className="font-bold text-gray-900 font-mono text-xs">{user.phone ? user.phone.replace('+91', '') : 'N/A'}</span>
                        </div>
                        <div className="flex items-center text-xs">
                            <span className="w-16 font-bold text-gray-400 uppercase tracking-wide shrink-0">Valid Upto</span>
                            <div className="flex-grow mx-2 border-b border-dotted border-gray-300 relative top-1"></div>
                            <span className="font-bold text-gray-900 text-xs">31-12-2027</span>
                        </div>
                    </div>
                </div>

                {/* 4. Footer: QR Code & Authorised Signatory */}
                <div className="px-5 pb-3.5 pt-1 flex justify-between items-end bg-white">
                    {/* Authorised Signature on Left */}
                    <div className="flex flex-col items-start w-[140px]">
                        <div className="h-8 w-full flex items-end justify-start mb-0.5">
                            <img 
                                src={resolvedSignature} 
                                className="h-7 max-w-full object-contain" 
                                alt="Authorised Signature" 
                                crossOrigin="anonymous"
                            />
                        </div>
                        <p className="text-[7.5px] text-gray-600 font-bold uppercase tracking-wider border-t border-black pt-0.5 w-full text-left">
                            Authorised Signatory
                        </p>
                    </div>

                    {/* QR Code on Right */}
                    <div className="flex flex-col items-end">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://alfanews.app/verify/${user.id}`)}`} 
                            className="w-10 h-10 object-contain" 
                            alt="QR Code" 
                            crossOrigin="anonymous"
                        />
                        <p className="text-[6.5px] text-gray-500 font-bold uppercase tracking-widest text-right w-full mt-0.5">
                            SCAN TO VERIFY
                        </p>
                    </div>
                </div>
                <div className="h-2 w-full bg-[#1a1a1a]"></div>
            </div>
            
            {/* Download Button (High-Quality JPG) */}
            <div className="flex justify-center mt-3">
                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>{isDownloading ? 'డౌన్‌లోడ్ అవుతోంది...' : 'ఐడీ కార్డు డౌన్‌లోడ్ చేయండి (JPG)'}</span>
                </button>
            </div>
        </div>
    </div>
  );
};

export default IdCardModal;
