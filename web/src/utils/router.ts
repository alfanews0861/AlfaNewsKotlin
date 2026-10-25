import { useState, useEffect } from 'react';
import { ALL_DISTRICTS, isDistrictMatch } from './newsFilter';

export type AppRoute =
  | { type: 'home' }
  | { type: 'news'; id: string }
  | { type: 'category'; category: string; slug: string }
  | { type: 'district'; district: string }
  | { type: 'classifieds' }
  | { type: 'reporter'; reporterId: string }
  | { type: 'policy'; policy: string };

export const CATEGORY_SLUG_MAP: Record<string, string> = {
  'andhra-pradesh': 'ఆంధ్రప్రదేశ్',
  'ap': 'ఆంధ్రప్రదేశ్',
  'telangana': 'తెలంగాణ',
  'ts': 'తెలంగాణ',
  'districts': 'జిల్లా వార్తలు',
  'district-news': 'జిల్లా వార్తలు',
  'politics': 'రాజకీయం',
  'political': 'రాజకీయం',
  'cinema': 'సినిమా',
  'entertainment': 'సినిమా',
  'movies': 'సినిమా',
  'sports': 'క్రీడలు',
  'crime': 'క్రైమ్',
  'business': 'వ్యాపారం',
  'technology': 'టెక్నాలజీ',
  'tech': 'టెక్నాలజీ',
  'education': 'విద్య',
  'jobs': 'విద్య',
  'devotion': 'భక్తి',
  'spiritual': 'భక్తి',
  'agriculture': 'వ్యవసాయం',
  'health': 'ఆరోగ్యం',
  'national': 'జాతీయం',
  'international': 'అంతర్జాతీయం',
  'world': 'అంతర్జాతీయం',
  'special': 'స్పెషల్ స్టోరీస్',
  'special-stories': 'స్పెషల్ స్టోరీస్',
};

// Reverse map for clean English URL slugs
export const TELUGU_TO_SLUG_MAP: Record<string, string> = {
  'ఆంధ్రప్రదేశ్': 'andhra-pradesh',
  'తెలంగాణ': 'telangana',
  'జిల్లా వార్తలు': 'districts',
  'రాజకీయం': 'politics',
  'సినిమా': 'cinema',
  'క్రీడలు': 'sports',
  'క్రైమ్': 'crime',
  'వ్యాపారం': 'business',
  'టెక్నాలజీ': 'technology',
  'విద్య': 'education',
  'భక్తి': 'devotion',
  'వ్యవసాయం': 'agriculture',
  'ఆరోగ్యం': 'health',
  'జాతీయం': 'national',
  'అంతర్జాతీయం': 'international',
  'స్పెషల్ స్టోరీస్': 'special',
};

export const POLICY_ROUTES = [
  'privacy-policy',
  'terms',
  'about',
  'contact',
  'content-policy',
  'disclaimer',
  'ad-policy',
  'data-collection',
];

export function getCategorySlug(categoryName: string): string {
  if (TELUGU_TO_SLUG_MAP[categoryName]) {
    return TELUGU_TO_SLUG_MAP[categoryName];
  }
  return encodeURIComponent(categoryName.trim().replace(/\s+/g, '-').toLowerCase());
}

/**
 * Creates a clean, human-readable slug from a news article headline.
 * Preserves Unicode letters (Telugu, English, numbers) while removing punctuation.
 */
export function createNewsSlug(headline?: string): string {
  if (!headline) return 'vaartha';
  const clean = headline
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return clean || 'vaartha';
}

/**
 * Generates the full SEO-optimized URL path for a news article with title slug.
 * Format: /news/<article-title-slug>--<postId>
 */
export function getNewsUrl(post: { id: string; headline?: { telugu?: string; english?: string } | string }): string {
  if (!post || !post.id) return '/';
  let title = '';
  if (typeof post.headline === 'string') {
    title = post.headline;
  } else if (post.headline && typeof post.headline === 'object') {
    title = post.headline.telugu || post.headline.english || '';
  }
  const slug = createNewsSlug(title);
  return `/news/${encodeURIComponent(slug)}--${post.id}`;
}

export function parsePath(pathname: string, hash: string): AppRoute {
  // Helper to extract post ID from slug--id or plain id format
  const extractNewsId = (rawSegment: string): string => {
    let decoded = rawSegment;
    try {
      decoded = decodeURIComponent(rawSegment);
    } catch (_) {
      decoded = rawSegment;
    }
    const parts = decoded.split('--');
    return parts.pop() || '';
  };

  // 1. Support legacy hash URLs by parsing them if present
  let cleanPath = pathname;
  if (hash && hash.startsWith('#/')) {
    const hashRoute = hash.substring(2); // remove '#/'
    if (hashRoute.startsWith('news/')) {
      const segment = hashRoute.replace('news/', '').split('?')[0];
      const id = extractNewsId(segment);
      if (id) return { type: 'news', id };
    } else if (hashRoute.startsWith('r/')) {
      const rId = hashRoute.replace('r/', '').split('?')[0];
      if (rId) return { type: 'reporter', reporterId: rId };
    } else if (hashRoute.startsWith('s/')) {
      const sId = hashRoute.replace('s/', '').split('?')[0];
      const id = extractNewsId(sId);
      if (id) return { type: 'news', id };
    } else if (hashRoute.startsWith('category/')) {
      const rawCat = decodeURIComponent(hashRoute.replace('category/', '').split('?')[0]);
      const teluguCat = CATEGORY_SLUG_MAP[rawCat.toLowerCase()] || rawCat;
      return { type: 'category', category: teluguCat, slug: rawCat };
    } else if (hashRoute === 'classifieds') {
      return { type: 'classifieds' };
    } else if (POLICY_ROUTES.includes(hashRoute.toLowerCase())) {
      return { type: 'policy', policy: hashRoute.toLowerCase() };
    }
  }

  // Normalize pathname: trim trailing slashes (except root)
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }

  // 2. News Article
  if (cleanPath.startsWith('/news/')) {
    const segment = cleanPath.replace('/news/', '').split('/')[0].split('?')[0];
    const id = extractNewsId(segment);
    if (id) return { type: 'news', id };
  }
  if (cleanPath.startsWith('/ad/')) {
    const segment = cleanPath.replace('/ad/', '').split('/')[0].split('?')[0];
    const id = extractNewsId(segment);
    if (id) return { type: 'news', id };
  }
  if (cleanPath.startsWith('/s/')) {
    const segment = cleanPath.replace('/s/', '').split('/')[0].split('?')[0];
    const id = extractNewsId(segment);
    if (id) return { type: 'news', id };
  }

  // 3. Category
  if (cleanPath.startsWith('/category/')) {
    const rawSlug = decodeURIComponent(cleanPath.replace('/category/', '').split('/')[0].split('?')[0]);
    const lowerSlug = rawSlug.toLowerCase();
    const resolvedTelugu = CATEGORY_SLUG_MAP[lowerSlug] || rawSlug;
    return { type: 'category', category: resolvedTelugu, slug: rawSlug };
  }

  // 4. District
  if (cleanPath.startsWith('/district/')) {
    const rawDist = decodeURIComponent(cleanPath.replace('/district/', '').split('/')[0].split('?')[0]);
    const matched = ALL_DISTRICTS.find((d) => isDistrictMatch(d, rawDist)) || rawDist;
    return { type: 'district', district: matched };
  }

  // 5. Classifieds
  if (cleanPath === '/classifieds') {
    return { type: 'classifieds' };
  }

  // 6. Reporter Profile
  if (cleanPath.startsWith('/reporter/')) {
    const rId = cleanPath.replace('/reporter/', '').split('/')[0].split('?')[0];
    if (rId) return { type: 'reporter', reporterId: rId };
  }
  if (cleanPath.startsWith('/r/')) {
    const rId = cleanPath.replace('/r/', '').split('/')[0].split('?')[0];
    if (rId) return { type: 'reporter', reporterId: rId };
  }

  // 7. Policy Pages
  const potentialPolicy = cleanPath.replace('/', '').toLowerCase();
  if (POLICY_ROUTES.includes(potentialPolicy)) {
    return { type: 'policy', policy: potentialPolicy };
  }

  // Default: Homepage
  return { type: 'home' };
}

export function navigateTo(url: string, options?: { replace?: boolean }) {
  if (typeof window === 'undefined') return;

  const current = window.location.pathname + window.location.search;
  if (current === url && !window.location.hash) return;

  if (options?.replace) {
    window.history.replaceState(null, '', url);
  } else {
    window.history.pushState(null, '', url);
  }

  // Notify all listening components
  window.dispatchEvent(new Event('app-route-change'));
}

export function useAppRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(() => {
    if (typeof window === 'undefined') return { type: 'home' };
    return parsePath(window.location.pathname, window.location.hash);
  });

  useEffect(() => {
    const handleRouteChange = () => {
      const parsed = parsePath(window.location.pathname, window.location.hash);
      setRoute(parsed);

      // Clean up hash if converted to real path
      if (window.location.hash && window.location.hash.startsWith('#/')) {
        let targetPath = '/';
        if (parsed.type === 'news') targetPath = `/news/${parsed.id}`;
        else if (parsed.type === 'category') targetPath = `/category/${getCategorySlug(parsed.category)}`;
        else if (parsed.type === 'district') targetPath = `/district/${encodeURIComponent(parsed.district)}`;
        else if (parsed.type === 'classifieds') targetPath = '/classifieds';
        else if (parsed.type === 'policy') targetPath = `/${parsed.policy}`;
        else if (parsed.type === 'reporter') targetPath = `/reporter/${parsed.reporterId}`;
        
        window.history.replaceState(null, '', targetPath);
      }
    };

    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('app-route-change', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('app-route-change', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  return route;
}
