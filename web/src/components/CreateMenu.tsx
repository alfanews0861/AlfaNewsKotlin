
import React from 'react';
import { User, UserRole } from '../types';

interface CreateMenuProps {
    user: User | null;
    onAction: (action: 'citizen' | 'news' | 'classified' | 'job_application') => void;
    onClose: () => void;
}

const CreateMenu: React.FC<CreateMenuProps> = ({ user, onAction, onClose }) => {
    const canPostNews = user && [UserRole.REPORTER, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE, UserRole.ADMIN].includes(user.role);

    return (
        <div className="h-full w-full bg-white flex flex-col items-center justify-center p-6 animate-fade-in font-mallanna">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-ramabhadra text-gray-800 mb-2">మీరు ఏమి పోస్ట్ చేయాలనుకుంటున్నారు?</h2>
                    <p className="text-gray-500">మీ కంటెంట్‌ని ప్రపంచానికి తెలియజేయండి.</p>
                </div>

                {/* 1. Citizen Journalism - Visible to everyone */}
                <button 
                    onClick={() => onAction('citizen')}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 rounded-2xl shadow-lg flex items-center justify-between transform active:scale-95 transition-all group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">📢</div>
                        <div className="text-left">
                            <span className="block text-2xl font-bold font-ramabhadra">సిటిజన్ జర్నలిజం</span>
                            <span className="text-xs text-blue-100 opacity-80 uppercase font-bold tracking-wider">Public submission</span>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 opacity-50 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>

                {/* 2. Post News - Staff Only */}
                {canPostNews && (
                    <button 
                        onClick={() => onAction('news')}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white p-5 rounded-2xl shadow-lg flex items-center justify-between transform active:scale-95 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">📝</div>
                            <div className="text-left">
                                <span className="block text-2xl font-bold font-ramabhadra">కొత్త వార్తను పోస్ట్ చెయ్యి</span>
                                <span className="text-xs text-red-100 opacity-80 uppercase font-bold tracking-wider">Reporter / Staff Desk</span>
                            </div>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 opacity-50 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                )}

                {/* 3. Post Classified - Visible to everyone */}
                <button 
                    onClick={() => onAction('classified')}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white p-5 rounded-2xl shadow-lg flex items-center justify-between transform active:scale-95 transition-all group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🏷️</div>
                        <div className="text-left">
                            <span className="block text-2xl font-bold font-ramabhadra">కొత్త క్లాసిఫైడ్ పోస్ట్</span>
                            <span className="text-xs text-orange-100 opacity-80 uppercase font-bold tracking-wider">Buy, Sell or Services</span>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 opacity-50 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>

                {/* 4. Apply for Reporter */}
                <button 
                    onClick={() => onAction('job_application')}
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-5 rounded-2xl shadow-lg flex items-center justify-between transform active:scale-95 transition-all group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">🤝</div>
                        <div className="text-left">
                            <span className="block text-2xl font-bold font-ramabhadra">రిపోర్టర్‌గా చేరండి</span>
                            <span className="text-xs text-emerald-100 opacity-80 uppercase font-bold tracking-wider">Join Alfa News</span>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 opacity-50 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>

                <button 
                    onClick={onClose}
                    className="w-full py-4 text-gray-500 font-bold hover:text-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    తిరిగి వెళ్ళు
                </button>
            </div>
        </div>
    );
};

export default CreateMenu;
