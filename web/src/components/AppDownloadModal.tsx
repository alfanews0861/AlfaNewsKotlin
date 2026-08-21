import React from 'react';

const AppDownloadModal: React.FC = () => {
    const handleDownload = () => {
        window.open('https://play.google.com/store/apps/details?id=com.alfanews.telugu', '_blank');
    };

    return (
        <div className="w-full h-full snap-start snap-always shrink-0 bg-black flex items-center justify-center p-[5%]">
            <div className="w-[90%] h-[90%] bg-zinc-900 rounded-3xl flex flex-col items-center justify-center p-8 text-center border border-white/10 shadow-2xl">
                <h2 className="font-ramabhadra text-2xl text-white mb-8 leading-relaxed">
                    మరిన్ని తాజా వార్తల కోసం మన అల్ఫాన్యూస్ అప్ డౌన్లోడ్ చేసుకోండి
                </h2>
                <button 
                    onClick={handleDownload}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full text-lg transition-all shadow-lg active:scale-95"
                >
                    Download
                </button>
            </div>
        </div>
    );
};

export default AppDownloadModal;
