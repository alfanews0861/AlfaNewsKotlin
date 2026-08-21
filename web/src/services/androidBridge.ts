
/**
 * Alfa News - Android JS Bridge
 * Minimal bridge for native features like sharing.
 */

declare global {
  interface Window {
    AlfaAndroidBridge?: {
      shareNews?: (imageUri: string, text: string) => void;
    };
  }
}

export const shareToAndroidNative = (imageUri: string, text: string) => {
  if (window.AlfaAndroidBridge && typeof window.AlfaAndroidBridge.shareNews === 'function') {
    window.AlfaAndroidBridge.shareNews(imageUri, text);
  }
};
