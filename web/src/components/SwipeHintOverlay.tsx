import React, { useState, useEffect } from 'react';

interface SwipeHintOverlayProps {
  onDismiss?: () => void;
}

const SwipeHintOverlay: React.FC<SwipeHintOverlayProps> = ({ onDismiss }) => {
  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem('alfa_swipe_hint_seen');
    } catch {
      return true;
    }
  });

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem('alfa_swipe_hint_seen', 'true');
    } catch (_) {}
    if (onDismiss) onDismiss();
  };

  useEffect(() => {
    if (!visible) return;

    // Auto dismiss after 8 seconds
    const timer = setTimeout(() => {
      dismiss();
    }, 8000);

    // Also dismiss on first user touch / scroll
    const handleTouchOrScroll = () => {
      dismiss();
    };

    window.addEventListener('touchstart', handleTouchOrScroll, { once: true, passive: true });
    window.addEventListener('scroll', handleTouchOrScroll, { once: true, passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('touchstart', handleTouchOrScroll);
      window.removeEventListener('scroll', handleTouchOrScroll);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 animate-fade-in cursor-pointer select-none pointer-events-auto"
    >
      <div className="flex flex-col items-center">
        {/* Large Glowing Up-Arrow Button with Animated Bounce */}
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-t from-red-600 via-red-500 to-red-600 border-2 border-white/80 shadow-[0_0_35px_rgba(239,68,68,0.85)] animate-bounce mb-2">
          {/* Subtle pulse ring behind */}
          <div className="absolute inset-0 rounded-full border border-white animate-ping opacity-30 pointer-events-none" />
          
          {/* Bold Large Up Arrow SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-9 h-9 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]"
          >
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </div>

        {/* Clear Prominent Instruction Card */}
        <div className="px-5 py-2.5 rounded-2xl bg-black/90 border border-red-500/60 shadow-[0_4px_25px_rgba(0,0,0,0.9)] backdrop-blur-md flex flex-col items-center text-center">
          <span className="font-ramabhadra text-sm font-bold text-white tracking-wide">
            తదుపరి వార్త కోసం పైకి స్వైప్ చేయండి
          </span>
          <span className="text-[11px] text-red-400 font-mallanna mt-0.5 tracking-wider">
            Swipe Up for Next News ↑
          </span>
        </div>
      </div>
    </div>
  );
};

export default SwipeHintOverlay;
