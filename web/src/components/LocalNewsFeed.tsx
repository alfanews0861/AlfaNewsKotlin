
import React, { useState, useEffect, useCallback, useRef } from 'react';
import NewsCard from './NewsCard';
import AdMobCard from './AdMobCard';
import AppDownloadPopup from './AppDownloadPopup';
import SwipeHintOverlay from './SwipeHintOverlay';
import { preloadImages } from '../utils/imageHelper';
import { NewsPost, Language, User } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import {
  ALL_EDITIONS_LIST,
  EDITIONS,
  getBodyFontClass,
  getCollectionForEdition,
  getDistrictDisplayName,
  getSiblingMandalsInConstituency,
  getStoredStateCode,
  resolveStateCode,
  type StateCode,
} from '../data/editions';
import { getDistrictAliases } from '../utils/newsFilter';
import { t } from '../utils/translations';
import { fetchCachedLocalFeed } from '../services/feedCacheService';

const { collection, query, where, orderBy, limit, getDocs, startAfter } = _firestore as any;

interface LocalNewsFeedProps {
  language: Language;
  onProfileClick: () => void;
  currentUser: User | null;
  onLoadComplete?: () => void;
  onReporterClick: (id: string) => void;
  selectedState?: StateCode | null;
  selectedDistrict?: string | null;
  hideHeader?: boolean;
}

const LocalNewsFeed: React.FC<LocalNewsFeedProps> = ({
  language,
  onProfileClick,
  currentUser,
  onLoadComplete,
  onReporterClick,
  selectedState,
  selectedDistrict,
  hideHeader = false,
}) => {
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const seenPostsCountRef = useRef<Set<string>>(new Set());

  // 🎯 3-News Dismissible App Download Popup Trigger:
  useEffect(() => {
    if (!news || news.length === 0) return;
    const mediaUrls = news.slice(0, 8).map(p => p.mediaUrl);
    preloadImages(mediaUrls, 640);
  }, [news]);

  useEffect(() => {
    const checkSeenCount = (postId?: string) => {
      if (postId) {
        seenPostsCountRef.current.add(postId);
      }
      if (seenPostsCountRef.current.size >= 3) {
        const dismissed = sessionStorage.getItem('alfa_app_popup_dismissed');
        if (!dismissed) {
          setShowDownloadPopup(true);
        }
      }
    };

    const handleReadEvent = (e: any) => {
      checkSeenCount(e.detail);
    };

    window.addEventListener('alfa_read_news_updated', handleReadEvent);
    return () => window.removeEventListener('alfa_read_news_updated', handleReadEvent);
  }, []);
  
  const hasMoreRef = useRef(true);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const lastVisible = useRef<any>(null);
  const fetchingRef = useRef(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [activeDistrict, setActiveDistrict] = useState<string | null>(() => {
    return selectedDistrict || currentUser?.district || localStorage.getItem('user_local_district') || null;
  });

  useEffect(() => {
    if (selectedDistrict !== undefined && selectedDistrict !== activeDistrict) {
      setActiveDistrict(selectedDistrict);
    }
  }, [selectedDistrict]);

  const [showSelector, setShowSelector] = useState(false);
  const [tempState, setTempState] = useState<StateCode>(() => {
      return (
          resolveStateCode(selectedState) ||
          resolveStateCode(currentUser?.district || localStorage.getItem('user_local_district')) ||
          getStoredStateCode()
      );
  });

  useEffect(() => {
    const nextState =
      resolveStateCode(selectedState) ||
      resolveStateCode(activeDistrict) ||
      resolveStateCode(currentUser?.stateCode) ||
      resolveStateCode(currentUser?.state);
    if (nextState && nextState !== tempState) {
      setTempState(nextState);
    }
  }, [selectedState, activeDistrict, currentUser?.stateCode, currentUser?.state]);

  useEffect(() => {
    if (currentUser?.district && currentUser.district !== activeDistrict) {
      setActiveDistrict(currentUser.district);
      localStorage.setItem('user_local_district', currentUser.district);
      const st = resolveStateCode(currentUser.district);
      if (st) setTempState(st);
    }
  }, [currentUser?.district]);

  const effectiveState: StateCode = resolveStateCode(selectedState) || resolveStateCode(activeDistrict) || tempState;
  const targetCollection = getCollectionForEdition(effectiveState, language);
  const userPreferredMandal = (currentUser?.assignedMandal || currentUser?.mandal || localStorage.getItem('user_local_mandal') || '').trim();

  const getTimestampValue = (timestamp: any) => {
      if (!timestamp) return Date.now();
      if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
      if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
      return Date.now();
  };

  /**
   * 3-Tier Local Priority (ALL 9 States):
   * Tier 1: User's own Mandal / Tehsil / Taluka / Sub-Division
   * Tier 2: Sibling Mandals / Tehsils in the same Assembly Constituency
   * Tier 3: Rest of the District (ordered by recency)
   */
  const sortByThreeTierLocality = useCallback((posts: NewsPost[]): NewsPost[] => {
      if (!userPreferredMandal || !activeDistrict) {
          return [...posts].sort((a, b) => b.timestamp - a.timestamp);
      }
      const mandalLow = userPreferredMandal.toLowerCase();
      const siblingSet = new Set(
          getSiblingMandalsInConstituency(activeDistrict, userPreferredMandal).map((m) => m.toLowerCase())
      );

      const getTier = (p: NewsPost): number => {
          const pMandal = (p.mandal || p.location || '').toLowerCase();
          if (pMandal && (pMandal === mandalLow || pMandal.includes(mandalLow))) return 0;
          if (pMandal && Array.from(siblingSet).some((sib) => pMandal.includes(sib))) return 1;
          return 2;
      };

      return [...posts].sort((a, b) => {
          const tierDiff = getTier(a) - getTier(b);
          if (tierDiff !== 0) return tierDiff;
          return b.timestamp - a.timestamp;
      });
  }, [activeDistrict, userPreferredMandal]);

  const fetchLocalNews = useCallback(async (isInitial = false) => {
    if (fetchingRef.current || (!isInitial && !hasMoreRef.current)) return;
    fetchingRef.current = true;

    // Direct fresh live server news ONLY — zero news disk/session cache!
    if (isInitial) {
        setLoading(true);
        lastVisible.current = null;
        setHasMore(true);
        setNews([]);
    }

    try {
        // 🌐 PHASE 2: Server-Side Edge Cache (/api/feed?type=local) on Page 1 — Zero Firestore Egress!
        if (isInitial) {
            const cachedLocal = await fetchCachedLocalFeed({
                col: targetCollection,
                state: effectiveState,
                district: activeDistrict,
                limit: 15,
            });
            if (cachedLocal && cachedLocal.posts.length > 0) {
                lastVisible.current =
                    cachedLocal.cursors?.lastTs ??
                    cachedLocal.posts[cachedLocal.posts.length - 1]?.timestamp ??
                    null;
                const sorted = sortByThreeTierLocality(cachedLocal.posts);
                setNews(sorted);
                if (cachedLocal.posts.length < 10) setHasMore(false);
                return;
            }
        }

        const newsRef = collection(db, targetCollection);
        const FETCH_LIMIT = 15;
        const distAliases = activeDistrict
            ? Array.from(new Set([activeDistrict, ...getDistrictAliases(activeDistrict)])).slice(0, 10)
            : [];

        const distConstraint = activeDistrict
            ? (distAliases.length > 1
                ? [where('approved', '==', true), where('district', 'in', distAliases)]
                : [where('approved', '==', true), where('district', '==', activeDistrict)])
            : [where('approved', '==', true)];

        let q = query(
            newsRef,
            ...distConstraint,
            orderBy('timestamp', 'desc'),
            limit(FETCH_LIMIT)
        );

        if (!isInitial && lastVisible.current) {
            const ts = _firestore.Timestamp.fromMillis(lastVisible.current);
            q = query(
                newsRef,
                ...distConstraint,
                orderBy('timestamp', 'desc'),
                startAfter(ts),
                limit(FETCH_LIMIT)
            );
        }

        const snap = await getDocs(q);
        if (snap.empty) {
            setHasMore(false);
        } else {
            const fetchedPosts = snap.docs.map((d: any) => ({
                id: d.id,
                ...d.data(),
                timestamp: getTimestampValue(d.data().timestamp)
            } as NewsPost));

            lastVisible.current = getTimestampValue(snap.docs[snap.docs.length - 1].data().timestamp);

            setNews(prev => {
                const seenIds = new Set(prev.map((p) => p.id));
                const uniqueNew = fetchedPosts.filter((p: NewsPost) => !seenIds.has(p.id));
                const sortedNew = sortByThreeTierLocality(uniqueNew);
                return isInitial ? sortedNew : [...prev, ...sortedNew];
            });

            if (snap.docs.length < FETCH_LIMIT) setHasMore(false);
        }
    } catch (e) { console.error("Local fetch error:", e); } finally {
        setLoading(false);
        fetchingRef.current = false;
        if (isInitial && onLoadComplete) {
          onLoadComplete();
          setTimeout(() => { if (feedRef.current) feedRef.current.scrollTop = 0; }, 100);
        }
    }
  }, [activeDistrict, targetCollection, sortByThreeTierLocality, onLoadComplete]);

  useEffect(() => {
    fetchLocalNews(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDistrict, effectiveState, targetCollection]);

  useEffect(() => {
    if (loading || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !fetchingRef.current) {
        fetchLocalNews();
      }
    }, { rootMargin: '1000px', threshold: 0.1 });

    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, hasMore]); // Intentionally omitting fetchLocalNews

  return (
    <div className="relative h-full w-full bg-black overflow-hidden flex flex-col">
      {!hideHeader && (
        <>
          <div className="absolute top-2 left-2 p-2 z-30 flex items-center pointer-events-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] whitespace-nowrap shrink-0">
              <span className="font-poppins font-bold text-3xl text-white">alfa</span>
              <span className="font-poppins font-semibold text-3xl text-red-600">news</span>
          </div>

          <div className="absolute top-4 right-4 z-40">
              <button 
                 onClick={() => setShowSelector(!showSelector)} 
                 className="bg-black/80 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-2xl transition-transform active:scale-95"
              >
                {isDetecting ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-500">
                      <path fillRule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                    </svg>
                )}
                <span className="text-white font-mallanna text-[13px] font-bold">
                    {isDetecting ? 'గుర్తిస్తున్నాము...' : (activeDistrict || 'అన్ని ప్రాంతాలు')}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-gray-400 transition-transform ${showSelector ? 'rotate-180' : ''}`}>
                   <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>

              {showSelector && (
                  <div className="absolute top-full right-0 mt-3 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl w-56 flex flex-col gap-4 animate-fade-in origin-top-right">
                      <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] text-gray-400 uppercase tracking-wider">{t(language, 'select_state')}</label>
                          <select 
                              value={tempState} 
                              onChange={(e) => setTempState(e.target.value as StateCode)}
                              className={`bg-black/50 border border-white/10 text-white text-sm rounded-lg p-2.5 outline-none ${getBodyFontClass(language)} appearance-none focus:border-red-500 transition-colors`}
                          >
                              {ALL_EDITIONS_LIST.map((ed) => (
                                  <option key={ed.code} value={ed.code} className="text-black bg-white">
                                      {ed.nativeName} ({ed.name})
                                  </option>
                              ))}
                          </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] text-gray-400 uppercase tracking-wider">{t(language, 'select_district')}</label>
                          <select 
                              value={activeDistrict || ''} 
                              onChange={(e) => {
                                  const val = e.target.value;
                                  setActiveDistrict(val || null);
                                  localStorage.setItem('user_selected_state', tempState);
                                  if (val) localStorage.setItem('user_local_district', val);
                                  else localStorage.removeItem('user_local_district');
                                  setShowSelector(false);
                              }}
                              className={`bg-black/50 border border-white/10 text-white text-sm rounded-lg p-2.5 outline-none ${getBodyFontClass(language)} appearance-none focus:border-red-500 transition-colors`}
                          >
                              <option value="" className="text-black bg-white">{t(language, 'all_districts_state')}</option>
                              {[...EDITIONS[tempState].districts].sort().map(d => (
                                  <option key={d} value={d} className="text-black bg-white">
                                      {getDistrictDisplayName(d, language)}
                                  </option>
                              ))}
                          </select>
                      </div>
                  </div>
              )}
          </div>
        </>
      )}

      {loading && news.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center bg-black">
              <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              <p className={`mt-4 text-gray-400 ${getBodyFontClass(language)} text-lg`}>{t(language, 'news_preparing')}</p>
           </div>
      ) : (
          <div ref={feedRef} className="flex-1 overflow-y-auto snap-y snap-mandatory no-scrollbar bg-black overscroll-none scroll-smooth">
              {news.length === 0 && !loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
                       <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                       <p className={`${getBodyFontClass(language)} text-lg`}>{t(language, 'news_preparing')}</p>
                  </div>
              ) : (
                  <>
                    {news.map((post, index) => {
                        const elements = [
                            <div key={post.id} className="w-full h-full snap-start snap-always shrink-0 bg-black">
                                <NewsCard post={post} language={language} onProfileClick={onProfileClick} currentUser={currentUser} onCategoryClick={() => {}} onReporterClick={onReporterClick} />
                            </div>
                        ];
                        // 🎯 Every 5 news articles: Render AdMob Card
                        if ((index + 1) % 5 === 0) {
                            elements.push(
                                <div key={`ad-${post.id}-${index}`} className="w-full h-full snap-start snap-always shrink-0 bg-black">
                                    <AdMobCard />
                                </div>
                            );
                        }
                        return elements;
                    })}
                    {hasMore && (
                        <div ref={sentinelRef} className="h-60 flex items-center justify-center text-gray-500 font-mallanna bg-black snap-start">
                            <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                            వార్తలు వస్తున్నాయి...
                        </div>
                    )}
                  </>
              )}
          </div>
      )}

      {/* 🎯 Animated Swipe Up Hint for New Users */}
      <SwipeHintOverlay />

      {/* 🎯 3-News Dismissible App Download Popup */}
      {showDownloadPopup && (
        <AppDownloadPopup
          postId={news[2]?.id || news[0]?.id || null}
          onClose={() => {
            setShowDownloadPopup(false);
            sessionStorage.setItem('alfa_app_popup_dismissed', 'true');
          }}
        />
      )}
    </div>
  );
};

export default LocalNewsFeed;
