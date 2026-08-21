import React, { useState, useEffect } from 'react';

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Automatically show our custom UI after 3 seconds
      setTimeout(() => {
          const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
          if (!isInstalled) {
            setShowPrompt(true);
          }
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    setShowPrompt(false);
    // Show the native prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, so clear it
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[100] animate-fade-in">
        <div className="bg-white rounded-2xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.3)] border border-gray-100 flex flex-col gap-4">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-red-500/20">
                    <span className="text-white text-2xl font-bold font-ramabhadra">న</span>
                </div>
                <div className="flex-1">
                    <h3 className="text-black font-ramabhadra text-xl font-bold leading-tight">Alfa News</h3>
                    <p className="text-gray-500 font-mallanna text-lg leading-tight">డెస్క్టాప్ మీద షార్ట్ కట్ పెట్టమంటావా?</p>
                </div>
            </div>
            <div className="flex gap-3 mt-1">
                <button 
                    onClick={handleInstallClick}
                    className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition-all text-lg font-mallanna"
                >
                    అవును, పెట్టు
                </button>
                <button 
                    onClick={() => setShowPrompt(false)}
                    className="flex-1 bg-gray-100 text-gray-500 font-bold py-3 rounded-xl active:scale-95 transition-all text-lg font-mallanna"
                >
                    వద్దు
                </button>
            </div>
        </div>
    </div>
  );
};

export default InstallPrompt;