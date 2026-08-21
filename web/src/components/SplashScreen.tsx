
import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onFinished: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinished }) => {
  const [visible, setVisible] = useState(true);
  const [textIndex, setTextIndex] = useState(0);
  const taglines = ["సూటిగా", "సుత్తి లేకుండా", "క్లుప్తంగా"];

  useEffect(() => {
    const textTimer = setInterval(() => {
      setTextIndex(prev => (prev < taglines.length - 1 ? prev + 1 : prev));
    }, 600);

    const finishTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onFinished, 500);
    }, 2800);

    return () => {
      clearInterval(textTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinished, taglines.length]);

  return (
    <div className={`fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="relative mb-10">
            <div className="w-28 h-28 bg-gradient-to-br from-red-600 to-red-800 rounded-3xl rotate-12 flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.4)] animate-pulse">
                <span className="text-white text-6xl font-ramabhadra -rotate-12">న</span>
            </div>
            <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                <div className="w-6 h-6 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        </div>

        <div className="text-center">
            <h1 className="font-poppins font-black text-4xl text-white tracking-tighter mb-2">
                alfa<span className="text-red-600">news</span>
            </h1>
            <div className="h-8 flex items-center justify-center gap-3">
                {taglines.map((text, i) => (
                    <span 
                        key={i} 
                        className={`font-ramabhadra text-xl transition-all duration-500 ${i <= textIndex ? 'opacity-100 translate-y-0 text-red-500' : 'opacity-0 translate-y-4 text-gray-800'}`}
                    >
                        {text}
                    </span>
                ))}
            </div>
        </div>

        <div className="absolute bottom-12 text-gray-500 font-bold text-xs uppercase tracking-[0.3em]">
            Version 11.0 Pro
        </div>
    </div>
  );
};

export default SplashScreen;
