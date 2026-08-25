
import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../services/firebase';
import * as _auth from 'firebase/auth';

const { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} = _auth as any;

import { googleProvider } from '../services/firebase';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onClose: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onClose }) => {
  const [activeTab, setActiveTab] = useState<'phone' | 'email'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<any | null>(null);

  useEffect(() => {
    if (activeTab === 'phone' && !verifierRef.current && recaptchaContainerRef.current) {
        try {
            const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
                'size': 'invisible',
                'callback': () => { console.log("Recaptcha verified"); }
            });
            verifierRef.current = verifier;
        } catch (e) {
            console.error("Recaptcha Init Error:", e);
        }
    }
    return () => {
        if (verifierRef.current) {
            try { verifierRef.current.clear(); } catch(e){}
            verifierRef.current = null;
        }
    };
  }, [activeTab]);

  const handleSendOtp = async () => {
    setErrorMsg(null);
    if (!phoneNumber || phoneNumber.length < 10) {
        setErrorMsg("సరైన మొబైల్ నంబర్ నమోదు చేయండి.");
        return;
    }
    setIsLoading(true);
    try {
        if (!verifierRef.current) {
            // Re-init if it failed
            verifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, { 'size': 'invisible' });
        }
        const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
        const confirmation = await signInWithPhoneNumber(auth, formattedNumber, verifierRef.current);
        setConfirmationResult(confirmation);
        setIsOtpSent(true);
    } catch (error: any) {
        console.error("Error sending OTP:", error);
        setErrorMsg(`OTP పంపడం విఫలమైంది: ${error.message}. దయచేసి పేజీని రీలోడ్ చేయండి.`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
      setErrorMsg(null);
      if (!otp || !confirmationResult) { setErrorMsg("దయచేసి OTP నమోదు చేయండి."); return; }
      setIsLoading(true);
      try {
          await confirmationResult.confirm(otp);
          onLoginSuccess();
      } catch (error: any) {
          setErrorMsg("OTP తప్పుగా ఉంది లేదా గడువు ముగిసింది.");
      } finally { setIsLoading(false); }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);
    try {
        if (isSignUp) {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
        onLoginSuccess();
    } catch (error: any) {
        setErrorMsg(error.message);
    } finally { setIsLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
        await signInWithPopup(auth, googleProvider);
        onLoginSuccess();
    } catch (error: any) {
        console.error("Google Login Error:", error);
        if (error.code === 'auth/popup-closed-by-user') {
            setErrorMsg("లాగిన్ పాప్-అప్ క్లోజ్ చేయబడింది. ఒకవేళ పాప్-అప్ రాకపోతే, బ్రౌజర్ సెట్టింగ్స్ లో 'Pop-ups' అనుమతించండి లేదా కింద ఉన్న 'Redirect Login' ప్రయత్నించండి.");
        } else if (error.code === 'auth/unauthorized-domain') {
            setErrorMsg("ఈ డొమైన్ (Domain) ఫైర్ బేస్ లో అనుమతించబడలేదు. దయచేసి Firebase Console లో Authorized Domains చెక్ చేయండి.");
        } else {
            setErrorMsg(`Google లాగిన్ విఫలమైంది: ${error.message}.`);
        }
    } finally { setIsLoading(false); }
  };

  const handleGoogleLoginRedirect = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
        const { signInWithRedirect } = _auth as any;
        await signInWithRedirect(auth, googleProvider);
    } catch (error: any) {
        setErrorMsg(`Redirect లాగిన్ విఫలమైంది: ${error.message}`);
        setIsLoading(false);
    }
  };

  const isPreview = typeof window !== 'undefined' && (window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost'));

  const inputClass = "w-full bg-white border-2 border-gray-100 rounded-2xl px-6 py-4 text-xl text-black font-semibold focus:outline-none focus:border-red-500 focus:bg-white transition-all placeholder:text-gray-400 placeholder:font-normal shadow-sm";

  return (
    <div className="fixed inset-0 bg-white z-[80] flex flex-col animate-fade-in font-mallanna">
      <div ref={recaptchaContainerRef}></div>
      
      {/* Custom Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-50">
        <div className="flex items-center gap-1">
             <span className="font-poppins font-bold text-2xl text-blue-500">alfa</span>
             <span className="font-poppins font-bold text-2xl text-red-600">news</span>
        </div>
        <button onClick={onClose} className="text-gray-400 p-2 rounded-full bg-gray-50 active:scale-90 transition-all">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pt-10 overflow-y-auto">
        <h2 className="text-3xl font-ramabhadra text-gray-900 mb-2">స్వాగతం</h2>
        <p className="text-gray-500 text-xl mb-8">కొనసాగించడానికి లాగిన్ అవ్వండి</p>

        <div className="flex w-full max-w-sm mb-8 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
            <button onClick={() => { setActiveTab('phone'); setErrorMsg(null); }} className={`flex-1 py-3 rounded-xl text-lg font-bold transition-all ${activeTab === 'phone' ? 'bg-white text-red-600 shadow-md' : 'text-gray-400'}`}>మొబైల్</button>
            <button onClick={() => { setActiveTab('email'); setErrorMsg(null); }} className={`flex-1 py-3 rounded-xl text-lg font-bold transition-all ${activeTab === 'email' ? 'bg-white text-red-600 shadow-md' : 'text-gray-400'}`}>ఈమెయిల్</button>
        </div>

        {errorMsg && (
            <div className="w-full max-w-sm mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium text-center">
                {errorMsg}
            </div>
        )}

        <div className="w-full max-w-sm space-y-5">
            {activeTab === 'phone' ? (
                !isOtpSent ? (
                    <>
                        <div className="space-y-1">
                           <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Phone Number</label>
                           <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="9876543210" className={inputClass} />
                        </div>
                        <button onClick={handleSendOtp} disabled={isLoading} className="w-full bg-red-600 text-white font-bold text-xl py-5 rounded-2xl shadow-xl active:scale-95 transition-all">
                            {isLoading ? 'పంపుతోంది...' : 'OTP పంపండి'}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="space-y-1">
                           <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Enter OTP</label>
                           <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="XXXXXX" maxLength={6} className={inputClass + " text-center tracking-[0.5em]"} />
                        </div>
                        <button onClick={handleVerifyOtp} disabled={isLoading} className="w-full bg-green-600 text-white font-bold text-xl py-5 rounded-2xl shadow-xl active:scale-95 transition-all">లాగిన్ అవ్వండి</button>
                        <button onClick={() => setIsOtpSent(false)} className="w-full text-gray-500 font-bold text-lg py-2">నెంబర్ మార్చండి</button>
                    </>
                )
            ) : (
                <form onSubmit={handleEmailSubmit} className="space-y-5">
                    {isSignUp && <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="మీ పేరు" className={inputClass} required />}
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="మీ ఈమెయిల్" className={inputClass} required />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="పాస్‌వర్డ్" className={inputClass} required />
                    <button type="submit" disabled={isLoading} className="w-full bg-red-600 text-white font-bold text-xl py-5 rounded-2xl shadow-xl active:scale-95 transition-all">
                        {isLoading ? 'లోడింగ్...' : (isSignUp ? 'ఖాతా సృష్టించండి' : 'లాగిన్ అవ్వండి')}
                    </button>
                    <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="w-full text-gray-600 text-xl font-bold text-center underline decoration-gray-200">
                        {isSignUp ? 'ఇప్పటికే ఖాతా ఉందా? లాగిన్ అవ్వండి' : 'కొత్త ఖాతా సృష్టించండి'}
                    </button>
                </form>
            )}

            <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-400 font-bold">లేదా</span></div>
            </div>

            <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-100 text-gray-700 font-bold text-lg py-4 rounded-2xl shadow-sm active:scale-95 transition-all">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google తో లాగిన్
            </button>

            <button onClick={handleGoogleLoginRedirect} disabled={isLoading} className="w-full text-blue-600 font-bold text-lg py-2 underline">
                Redirect Login (పాప్-అప్ రాకపోతే ఇది నొక్కండి)
            </button>

            {isPreview && (
                <div className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-blue-600 text-sm font-bold mb-2 text-center">Preview Mode: Testing Only</p>
                    <button 
                        onClick={async () => {
                            setIsLoading(true);
                            try {
                                // Attempt to sign in with a known test account or just bypass for preview
                                // For now, let's just show a message or try a common test email if it exists
                                alert("Preview లో టెస్టింగ్ కోసం 'Email' ట్యాబ్ లో test@alfanews.app / 123456 ప్రయత్నించండి.");
                            } finally { setIsLoading(false); }
                        }} 
                        className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm"
                    >
                        Demo Login Info
                    </button>
                </div>
            )}
        </div>
      </div>
      
      <div className="p-8 text-center text-gray-300 text-sm">
          Alfa News © 2024 • సురక్షితమైన లాగిన్
      </div>
    </div>
  );
};

export default LoginScreen;
