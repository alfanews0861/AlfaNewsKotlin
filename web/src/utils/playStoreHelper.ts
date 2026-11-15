/**
 * Utility for handling Google Play Store deep links and Android Intents.
 * 
 * Standard https://play.google.com/ URLs often cause WhatsApp / Facebook / Instagram
 * in-app browser webviews to display a web page prompting for a Google account login.
 * 
 * Using Android Intent URLs (intent://details?id=...#Intent;scheme=market;package=com.android.vending;end)
 * forces Android to bypass the in-app browser webview and directly open the native Google Play Store app.
 */

export interface PlayStoreUrls {
  intentUrl: string;
  marketUrl: string;
  webUrl: string;
}

/**
 * Builds Play Store URLs with deferred deep link and referral tracking parameters.
 */
export function getPlayStoreUrls(postId?: string | null, refId?: string | null): PlayStoreUrls {
  const cleanPostId = postId?.trim() || '';
  const cleanRef = refId?.trim() || '';

  const refParam = cleanRef
    ? `&ref_${encodeURIComponent(cleanRef)}&referrer_uid=${encodeURIComponent(cleanRef)}&utm_campaign=referral_${encodeURIComponent(cleanRef)}`
    : '';

  const referrerParam = encodeURIComponent(
    cleanPostId ? `news_id=${cleanPostId}${refParam}` : `source=web_portal${refParam}`
  );

  const intentUrl = `intent://details?id=com.alfanews.telugu&referrer=${referrerParam}#Intent;scheme=market;package=com.android.vending;end`;
  const marketUrl = `market://details?id=com.alfanews.telugu&referrer=${referrerParam}`;
  const webUrl = `https://play.google.com/store/apps/details?id=com.alfanews.telugu&referrer=${referrerParam}`;

  return { intentUrl, marketUrl, webUrl };
}

/**
 * Returns the best URL for <a> tags depending on client platform:
 * - Android: intent:// URL (opens native Play Store directly without sign-in prompt)
 * - Desktop / iOS: https://play.google.com/ URL
 */
export function getPreferredPlayStoreUrl(postId?: string | null, refId?: string | null): string {
  const { intentUrl, webUrl } = getPlayStoreUrls(postId, refId);
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  return isAndroid ? intentUrl : webUrl;
}

/**
 * Opens Google Play Store natively on Android, or via web on desktop/iOS.
 */
export function openNativePlayStore(postId?: string | null, refId?: string | null): void {
  const { intentUrl, marketUrl, webUrl } = getPlayStoreUrls(postId, refId);
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  if (isAndroid) {
    try {
      window.location.href = intentUrl;
    } catch (_) {
      try {
        window.location.href = marketUrl;
      } catch (__) {
        window.location.href = webUrl;
      }
    }
  } else {
    window.open(webUrl, '_blank', 'noopener,noreferrer');
  }
}
