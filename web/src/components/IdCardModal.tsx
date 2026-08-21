
import React, { useEffect, useState, useRef } from 'react';
import { User } from '../types';

interface IdCardModalProps {
  show: boolean;
  onClose: () => void;
  user: User;
  displayPhoto: string;
  displaySignature: string;
}

const IdCardModal: React.FC<IdCardModalProps> = ({ show, onClose, user, displayPhoto, displaySignature }) => {
  const [scale, setScale] = useState(1);
  const cardRef = useRef<HTMLDivElement>(null);

  // Logic to shrink card to fit BOTH width and height of the screen centrally
  useEffect(() => {
    if (!show) return;

    const handleResize = () => {
        if (cardRef.current) {
            const cardWidth = 340; // Fixed CSS width
            const cardHeight = cardRef.current.offsetHeight || 600; 
            
            // Allow small padding around the card
            const paddingX = 20;
            const paddingY = 60; // Increased vertical padding for close button space
            
            const availableWidth = window.innerWidth - paddingX;
            const availableHeight = window.innerHeight - paddingY;

            // Calculate ratios
            const scaleX = availableWidth < cardWidth ? availableWidth / cardWidth : 1;
            const scaleY = availableHeight < cardHeight ? availableHeight / cardHeight : 1;

            // Take the smallest scale to ensure it fits entirely
            const finalScale = Math.min(scaleX, scaleY, 1);
            
            setScale(finalScale);
        }
    };

    // Calculate immediately and on resize
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
    <div className="fixed inset-0 h-[100dvh] w-screen bg-black z-[100] flex flex-col items-center justify-center overflow-hidden animate-slide-down">
        {/* Inline Style for the specific slide animation requested */}
        <style>{`
            @keyframes slideDown {
                from { transform: translateY(-100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .animate-slide-down {
                animation: slideDown 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            }
        `}</style>

        {/* Close Button - Fixed at Top Right */}
        <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-white hover:text-red-500 p-2 z-[110] bg-white/10 rounded-full backdrop-blur-md transition-all border border-white/20 shadow-xl"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {/* Card Wrapper - Centered */}
        <div 
            style={{ 
                transform: `scale(${scale})`, 
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease-out'
            }} 
            className="shadow-2xl relative"
        >
            
            {/* DIRECT HTML CARD DISPLAY */}
            <div ref={cardRef} className="w-[340px] bg-white rounded-xl overflow-hidden relative flex flex-col box-border shrink-0 select-none shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                {/* Lanyard Hole Mockup */}
                <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-16 h-2 bg-gray-200 rounded-full z-10 opacity-50"></div>

                {/* Header */}
                <div className="pt-10 pb-4 text-center bg-white">
                    <h1 className="font-poppins font-black text-3xl tracking-tight text-gray-900 leading-none">
                        alfanews
                    </h1>
                    <p className="text-[10px] text-gray-500 font-bold tracking-[0.1em] mt-1 font-inter uppercase">
                        Digital News Media Network
                    </p>
                </div>

                {/* RED PRESS BAND */}
                <div className="bg-[#C62828] text-white text-center py-2.5 relative shadow-sm">
                    <span className="font-serif font-bold text-2xl tracking-[0.3em] uppercase">
                        PRESS
                    </span>
                </div>

                {/* Main Content Area */}
                <div className="px-6 py-6 flex flex-col items-center bg-white flex-grow">
                    <div className="w-32 h-32 rounded-lg border-[3px] border-gray-800 p-0.5 shadow-sm mb-4 bg-white relative">
                        <img 
                            src={displayPhoto} 
                            className="w-full h-full object-cover object-top rounded-[4px]" 
                            alt="Profile"
                        />
                    </div>
                    <h2 className="text-3xl font-bold text-black font-ramabhadra text-center leading-tight">
                        {user.name}
                    </h2>
                    <p className="text-[#D32F2F] font-bold text-sm uppercase tracking-widest mt-1 mb-6 font-inter">
                        {user.role === 'ADMIN' ? 'ADMIN' : user.role === 'REPORTER' ? 'REPORTER' : user.role === 'REGIONAL_INCHARGE' ? 'REGIONAL INCHARGE' : 'STAFF REPORTER'}
                    </p>
                    <div className="w-full space-y-3 font-inter">
                        <div className="flex items-center text-xs">
                            <span className="w-20 font-bold text-gray-400 uppercase tracking-wide shrink-0">ID NO</span>
                            <div className="flex-grow mx-2 border-b-2 border-dotted border-gray-300 relative top-1"></div>
                            <span className="font-bold text-gray-900 font-mono text-sm">{user.id.substring(0, 8).toUpperCase()}</span>
                        </div>
                        <div className="flex items-center text-xs">
                            <span className="w-20 font-bold text-gray-400 uppercase tracking-wide shrink-0">Location</span>
                            <div className="flex-grow mx-2 border-b-2 border-dotted border-gray-300 relative top-1"></div>
                            <span className="font-bold text-gray-900 text-right truncate max-w-[120px]">{user.address || 'Telangana'}</span>
                        </div>
                        <div className="flex items-center text-xs">
                            <span className="w-20 font-bold text-gray-400 uppercase tracking-wide shrink-0">Contact</span>
                            <div className="flex-grow mx-2 border-b-2 border-dotted border-gray-300 relative top-1"></div>
                            <span className="font-bold text-gray-900 font-mono">{user.phone ? user.phone.replace('+91', '') : 'N/A'}</span>
                        </div>
                        <div className="flex items-center text-xs">
                            <span className="w-20 font-bold text-gray-400 uppercase tracking-wide shrink-0">Issued</span>
                            <div className="flex-grow mx-2 border-b-2 border-dotted border-gray-300 relative top-1"></div>
                            <span className="font-bold text-gray-900">{new Date().getFullYear()}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 pt-2 flex justify-between items-end bg-white">
                    <div className="flex flex-col items-start w-1/2">
                        <div className="h-10 w-full flex items-end justify-start mb-1">
                            <img 
                                src={displaySignature} 
                                className="h-8 object-contain opacity-80 mix-blend-multiply" 
                                alt="Sign" 
                            />
                        </div>
                        <p className="text-[7px] text-gray-400 font-bold uppercase tracking-wider border-t border-gray-300 pt-1 w-full text-left">
                            Authorized Signature
                        </p>
                    </div>
                    <div className="flex flex-col items-end w-1/2">
                        <div className="h-10 w-28 mb-1" style={{ background: `repeating-linear-gradient(90deg, #000 0px, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 7px, transparent 7px, transparent 9px, #000 9px, #000 10px, transparent 10px, transparent 13px, #000 13px, #000 15px, transparent 15px, transparent 19px, #000 19px, #000 22px, transparent 22px, transparent 24px)` }}></div>
                        <p className="text-[7px] text-gray-400 font-bold uppercase tracking-widest text-right w-full">
                            VERIFIED
                        </p>
                    </div>
                </div>
                <div className="h-3 w-full bg-[#1a1a1a] rounded-b-xl"></div>
            </div>
        </div>
    </div>
  );
};

export default IdCardModal;
