/**
 * Badge Service for Web App & PWA
 * 1. Web App Badging API (navigator.setAppBadge / navigator.clearAppBadge)
 * 2. Dynamic Favicon Badge using HTML5 Canvas
 * 3. Browser Tab Document Title unread counter
 */

let originalFaviconHref: string | null = null;
const ORIGINAL_TITLE = 'Alfa News - తాజా వార్తలు | Telugu Local News';

/**
 * Updates the app icon badge count across PWA, browser favicon, and document title.
 */
export function updateAppBadge(count: number): void {
  const safeCount = Math.max(0, Math.floor(count));

  // 1. PWA OS App Icon Badge (Android Home Screen, Windows Taskbar, macOS Dock, ChromeOS)
  if ('setAppBadge' in navigator && typeof (navigator as any).setAppBadge === 'function') {
    try {
      if (safeCount > 0) {
        (navigator as any).setAppBadge(safeCount).catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    } catch (_) {}
  }

  // 2. Document Title Unread Counter
  try {
    if (safeCount > 0) {
      document.title = `(${safeCount}) ${ORIGINAL_TITLE}`;
    } else {
      document.title = ORIGINAL_TITLE;
    }
  } catch (_) {}

  // 3. Dynamic Favicon Badge (HTML5 Canvas)
  try {
    updateFaviconBadge(safeCount);
  } catch (_) {}
}

/**
 * Clears the app badge and restores the default favicon and title.
 */
export function clearAppBadge(): void {
  updateAppBadge(0);
}

/**
 * Helper to dynamically draw a notification badge on the browser favicon.
 */
function updateFaviconBadge(count: number): void {
  if (typeof document === 'undefined') return;

  const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
  if (!favicon) return;

  if (!originalFaviconHref) {
    originalFaviconHref = favicon.href;
  }

  if (count <= 0) {
    if (originalFaviconHref) {
      favicon.href = originalFaviconHref;
    }
    return;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = originalFaviconHref || '/favicon.ico';

  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw original favicon
      ctx.drawImage(img, 0, 0, 32, 32);

      // Draw Red Notification Badge Circle
      const badgeText = count > 9 ? '9+' : String(count);
      const radius = 9;
      const x = 32 - radius;
      const y = radius;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = '#E53935'; // Vibrant Alert Red
      ctx.fill();

      // White Border
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Badge Number Text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, x, y + 0.5);

      // Apply new canvas data URL to favicon
      favicon.href = canvas.toDataURL('image/png');
    } catch (_) {
      // Ignore cross-origin canvas errors if any
    }
  };
}
