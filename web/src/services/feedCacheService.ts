import type { NewsPost } from '../types';

export interface CachedHomeFeedResponse {
  ok: boolean;
  type: 'home';
  col: string;
  state: string | null;
  district: string | null;
  cachedAt: number;
  main: NewsPost[];
  statePosts: NewsPost[];
  local: NewsPost[];
  greeting: NewsPost | null;
  cursors: {
    mainLastTs: number | null;
    stateLastTs: number | null;
    localLastTs: number | null;
  };
}

export interface CachedLocalFeedResponse {
  ok: boolean;
  type: 'local';
  col: string;
  state: string | null;
  district: string | null;
  cachedAt: number;
  posts: NewsPost[];
  cursors: {
    lastTs: number | null;
  };
}

export interface CachedPortalFeedResponse {
  ok: boolean;
  type: 'portal';
  col: string;
  state: string | null;
  cachedAt: number;
  posts: NewsPost[];
  cursors: {
    lastTs: number | null;
  };
}

export interface CachedFeedParams {
  type: 'home' | 'local' | 'portal';
  col: string;
  state?: string | null;
  district?: string | null;
  limit?: number;
}

const PROD_FEED_ORIGIN = 'https://alfanews.app';
const DEFAULT_TIMEOUT_MS = 2800;

export function resolveFeedApiBaseUrl(hostname?: string): string {
  const host = (
    hostname ??
    (typeof window !== 'undefined' ? window.location.hostname : '')
  ).toLowerCase();

  if (
    host === 'alfanews.app' ||
    host === 'www.alfanews.app' ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com')
  ) {
    return '/api/feed';
  }
  return `${PROD_FEED_ORIGIN}/api/feed`;
}

export function buildCachedFeedUrl(params: CachedFeedParams, hostname?: string): string {
  const base = resolveFeedApiBaseUrl(hostname);
  const qs = new URLSearchParams();
  qs.set('type', params.type);
  qs.set('col', params.col || 'news');
  if (params.state && params.state.trim()) {
    qs.set('state', params.state.trim());
  }
  if (params.district && params.district.trim()) {
    qs.set('district', params.district.trim());
  }
  if (params.limit && Number.isFinite(params.limit) && params.limit > 0) {
    qs.set('limit', String(Math.floor(params.limit)));
  }
  return `${base}?${qs.toString()}`;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T | null> {
  if (typeof fetch !== 'function') return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    const data = await res.json();
    if (!data || data.ok !== true) return null;
    return data as T;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchCachedHomeFeed(params: {
  col: string;
  state?: string | null;
  district?: string | null;
  limit?: number;
}): Promise<CachedHomeFeedResponse | null> {
  const url = buildCachedFeedUrl({
    type: 'home',
    col: params.col,
    state: params.state,
    district: params.district,
    limit: params.limit ?? 25,
  });
  const data = await fetchJsonWithTimeout<CachedHomeFeedResponse>(url);
  if (!data) return null;
  if (
    (!Array.isArray(data.main) || data.main.length === 0) &&
    (!Array.isArray(data.statePosts) || data.statePosts.length === 0) &&
    (!Array.isArray(data.local) || data.local.length === 0)
  ) {
    return null;
  }
  return data;
}

export async function fetchCachedLocalFeed(params: {
  col: string;
  state?: string | null;
  district?: string | null;
  limit?: number;
}): Promise<CachedLocalFeedResponse | null> {
  const url = buildCachedFeedUrl({
    type: 'local',
    col: params.col,
    state: params.state,
    district: params.district,
    limit: params.limit ?? 20,
  });
  const data = await fetchJsonWithTimeout<CachedLocalFeedResponse>(url);
  if (!data || !Array.isArray(data.posts) || data.posts.length === 0) {
    return null;
  }
  return data;
}

export async function fetchCachedPortalFeed(params: {
  col: string;
  state?: string | null;
  limit?: number;
}): Promise<CachedPortalFeedResponse | null> {
  const url = buildCachedFeedUrl({
    type: 'portal',
    col: params.col,
    state: params.state,
    limit: params.limit ?? 30,
  });
  const data = await fetchJsonWithTimeout<CachedPortalFeedResponse>(url);
  if (!data || !Array.isArray(data.posts) || data.posts.length === 0) {
    return null;
  }
  return data;
}
