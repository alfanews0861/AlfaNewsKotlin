const DEFAULT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/alfa-news-31bf7.firebasestorage.app/o/news-media%2Fbg.png?alt=media&token=70bb37fd-c13d-4f97-84e1-11fb6c0d1061";

/**
 * Returns an optimized Cloudflare-backed WebP image URL via wsrv.nl proxy.
 * Reduces raw 2-10MB mobile uploads down to ~25KB WebP at 640px width.
 */
export const getOptimizedImageUrl = (url?: string | null, width = 640): string => {
  if (!url || typeof url !== 'string' || url.trim() === '') return DEFAULT_IMAGE;
  if (url.includes('wsrv.nl')) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=webp&q=75`;
};

/**
 * Preloads images into the browser HTTP / memory cache ahead of time.
 */
export const preloadImages = (urls: (string | undefined | null)[], width = 640): void => {
  if (typeof window === 'undefined') return;
  urls.forEach((url) => {
    if (url && typeof url === 'string' && !url.includes('youtu')) {
      const img = new Image();
      img.src = getOptimizedImageUrl(url, width);
    }
  });
};
