
import React, { forwardRef } from 'react';
import { User } from '../types';

interface HiddenIdCardProps {
  user: User;
  displayPhoto: string;
  displaySignature: string;
}

const HiddenIdCard = forwardRef<HTMLDivElement, HiddenIdCardProps>(({ user, displayPhoto, displaySignature }, ref) => {
  return (
    <div style={{ position: 'absolute', top: 0, left: '-9999px', zIndex: -100 }}>
        <div ref={ref} className="card-container w-[320px] bg-white rounded-xl shadow-2xl overflow-hidden relative flex flex-col box-border">
            {/* Lanyard Hole Mockup */}
            <div className="absolute top-2.5 left-1/2 transform -translate-x-1/2 w-14 h-1.5 bg-gray-200 rounded-full z-10 opacity-50"></div>

            {/* Header */}
            <div className="pt-6 pb-2 text-center bg-white">
                <h1 className="font-poppins font-black text-2xl tracking-tight text-gray-900 leading-none">
                    alfanews
                </h1>
                <p className="text-[9px] text-gray-500 font-bold tracking-[0.1em] mt-0.5 font-inter uppercase">
                    Digital News Media Network
                </p>
            </div>

            {/* RED PRESS BAND */}
            <div className="bg-[#FF0000] text-white text-center py-1.5 relative shadow-sm">
                <span className="font-serif font-bold text-xl tracking-[0.25em] uppercase">
                    PRESS
                </span>
            </div>

            {/* Main Content Area */}
            <div className="px-5 py-3.5 flex flex-col items-center bg-white flex-grow">
                <div className="w-24 h-28 rounded-lg border-2 border-gray-300 p-0.5 shadow-sm mb-2.5 bg-white relative">
                    <img 
                        src={displayPhoto} 
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

            {/* Footer */}
            <div className="px-5 pb-3.5 pt-1 flex justify-between items-end bg-white">
                <div className="flex flex-col items-start w-[140px]">
                    <div className="h-8 w-full flex items-end justify-start mb-0.5">
                        <img 
                            src={displaySignature || '/authorized_signature.png'} 
                            className="h-7 max-w-full object-contain" 
                            alt="Sign" 
                            crossOrigin="anonymous"
                        />
                    </div>
                    <p className="text-[7.5px] text-gray-600 font-bold uppercase tracking-wider border-t border-black pt-0.5 w-full text-left">
                        Authorised Signatory
                    </p>
                </div>
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
    </div>
  );
});

export default HiddenIdCard;
