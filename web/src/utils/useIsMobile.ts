import { useState, useEffect } from 'react';

/**
 * Checks whether the current environment should render the mobile view.
 * 
 * Auto-detection logic:
 * 1. URL parameter override: ?view=mobile or ?view=desktop
 * 2. Session override: sessionStorage.getItem('alfa_view_mode')
 * 3. User-Agent mobile regex (Android, iPhone, iPad, etc.)
 * 4. Screen width < 768px (standard mobile/tablet breakpoint)
 */
export function detectIsMobile(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Explicit URL parameter override
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view')?.toLowerCase();
    if (viewParam === 'mobile') {
      sessionStorage.setItem('alfa_view_mode', 'mobile');
      return true;
    }
    if (viewParam === 'desktop') {
      sessionStorage.setItem('alfa_view_mode', 'desktop');
      return false;
    }

    // 2. Saved session preference override
    const saved = sessionStorage.getItem('alfa_view_mode');
    if (saved === 'mobile') return true;
    if (saved === 'desktop') return false;

    // 3. Mobile User Agent regex
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);

    // 4. Viewport width check (phones and small screens)
    const isSmallScreen = window.innerWidth < 768;

    return isMobileUA || isSmallScreen;
  } catch {
    return window.innerWidth < 768;
  }
}

/**
 * React hook that dynamically tracks whether mobile view is active.
 * Updates on resize, orientation change, or manual toggle.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(detectIsMobile);

  useEffect(() => {
    const update = () => {
      setIsMobile(detectIsMobile());
    };

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return isMobile;
}

/**
 * Switch view mode manually between desktop and mobile.
 */
export function setManualViewMode(mode: 'mobile' | 'desktop' | 'auto') {
  if (typeof window === 'undefined') return;
  if (mode === 'auto') {
    sessionStorage.removeItem('alfa_view_mode');
  } else {
    sessionStorage.setItem('alfa_view_mode', mode);
  }
  window.dispatchEvent(new Event('resize'));
}
