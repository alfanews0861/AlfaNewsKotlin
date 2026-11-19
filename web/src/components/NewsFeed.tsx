
import React, { useState, useEffect, useRef, useCallback } from 'react';
import NewsCard from './NewsCard';
import AdMobCard from './AdMobCard';
import AppDownloadPopup from './AppDownloadPopup';
import SwipeHintOverlay from './SwipeHintOverlay';
import { preloadImages } from '../utils/imageHelper';
import { NewsPost, Language, User } from '../types';
import { db } from '../services/firebase';
import {
  getUserCategoryScores,
  getUserKeywordScores,
  getUserPreferredCategories,
  getUserReporterScores,
} from '../services/analyticsService';
import { getDistrictAliases } from '../utils/newsFilter';
import {
  blendHomeFeed,
  buildUserInterestProfileFromStorage,
  expandCategoriesForFirestoreQuery,
  isPostAllowedForHomeFeed,
  pickFastPathTop3,
} from '../utils/newsFeedBlender';
import * as _firestore from 'firebase/firestore';
import { Settings2 } from 'lucide-react';
import PreferencesModal from './PreferencesModal';

const { collection, query, where, orderBy, limit, getDocs, Timestamp, startAfter, doc, getDoc } = _firestore as any;

interface NewsFeedProps {
  language: Language;
  onProfileClick: () => void;
  currentUser: User | null;
  onLoadComplete?: () => void;
  onReporterClick?: (id: string) => void;
  initialPostId?: string | null;
  hideHeader?: boolean;
  selectedDistrict?: string | null;
  refreshVersion?: number;
}

const NewsFeed: React.FC<NewsFeedProps> = ({
  language,
  onProfileClick,
  currentUser,
  onLoadComplete,
  onReporterClick,
  initialPostId,
  hideHeader = false,
  selectedDistrict,
  refreshVersion = 0,
}) => {
  const hasMoreRef = useRef(true);
  
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const seenPostsCountRef = useRef<Set<string>>(new Set());
  const newsRefState = useRef<NewsPost[]>([]);

  useEffect(() => {
    newsRefState.current = news;
  }, [news]);

  // 🎯 Preload images for the top cards for instant vertical swiping
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

  // Sync ref with state
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);
  
  // DocumentSnapshot cursors for clean, zero-gap Firestore pagination
  const prefCursor = useRef<any>(null);
  const localCursor = useRef<any>(null);
  const mainCursor = useRef<any>(null);
  
  const feedRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadSeqRef = useRef(0);

  const getTs = (data: any) => {
      if (!data.timestamp) return Date.now();
      if (data.timestamp instanceof Timestamp) return data.timestamp.toMillis();
      if (typeof data.timestamp?.toMillis === 'function') return data.timestamp.toMillis();
      return typeof data.timestamp === 'number' ? data.timestamp : Date.now();
  };

  const fetchStream = async (
      constraints: any[],
      cursorDoc: any,
      count: number
  ): Promise<{ posts: NewsPost[]; cursor: any; count: number }> => {
      try {
          const newsRef = collection(db, 'news');
          const q = cursorDoc
            ? query(newsRef, ...constraints, orderBy('timestamp', 'desc'), startAfter(cursorDoc), limit(count))
            : query(newsRef, ...constraints, orderBy('timestamp', 'desc'), limit(count));
          const snap = await getDocs(q);
          return {
              posts: snap.docs.map((d: any) => ({ id: d.id, ...d.data(), timestamp: getTs(d.data()) } as NewsPost)),
              cursor: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : cursorDoc,
              count: snap.docs.length
          };
      } catch (e) {
          console.error("Fetch Stream Error:", e);
          return { posts: [] as NewsPost[], cursor: cursorDoc, count: 0 };
      }
  };

  const getExplicitLocalPrefs = (): string[] | null => {
      try {
          const raw = localStorage.getItem('alfa_explicit_prefs');
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : null;
      } catch {
          return null;
      }
  };

  const userPrefs = React.useMemo(() => ({
      preferredCategories: currentUser?.preferredCategories,
      categoryScores: currentUser?.categoryScores,
      interests: currentUser?.interests
  }), [currentUser?.preferredCategories, currentUser?.categoryScores, currentUser?.interests]);

  const effectiveDistrict = selectedDistrict !== undefined
      ? selectedDistrict
      : (currentUser?.district || localStorage.getItem('user_local_district'));

  const loadMixedFeed = useCallback(async (isInitial = false) => {
    if (fetchingRef.current || (!isInitial && !hasMoreRef.current)) return;
    fetchingRef.current = true;
    const seq = isInitial ? ++loadSeqRef.current : loadSeqRef.current;

    const explicitLocalPrefs = getExplicitLocalPrefs();
    const localScores = getUserCategoryScores();
    const localKeywords = getUserKeywordScores();
    const localReporters = getUserReporterScores();

    const interestProfile = buildUserInterestProfileFromStorage(
        currentUser,
        localScores,
        localKeywords,
        localReporters,
        explicitLocalPrefs
    );

    const rawPreferredForQuery = [
        ...(userPrefs.preferredCategories || []),
        ...(explicitLocalPrefs || []),
        ...getUserPreferredCategories(6),
        ...interestProfile.preferredCanonicalKeys.slice(0, 4),
    ];
    const expandedPrefCats = expandCategoriesForFirestoreQuery(rawPreferredForQuery, 10);

    try {
        // Direct server news: Zero disk cache
        const districtAliases = effectiveDistrict
            ? Array.from(new Set([effectiveDistrict, ...getDistrictAliases(effectiveDistrict)])).slice(0, 10)
            : [];

        const localPromise = effectiveDistrict
            ? (districtAliases.length > 1
                ? fetchStream([where('approved', '==', true), where('district', 'in', districtAliases)], localCursor.current, isInitial ? 15 : 10)
                : fetchStream([where('approved', '==', true), where('district', '==', effectiveDistrict)], localCursor.current, isInitial ? 15 : 10))
            : Promise.resolve({ posts: [] as NewsPost[], cursor: null, count: 0 });

        const prefPromise = expandedPrefCats.length > 0
            ? fetchStream([where('approved', '==', true), where('categories', 'array-contains-any', expandedPrefCats)], prefCursor.current, isInitial ? 20 : 12)
            : Promise.resolve({ posts: [] as NewsPost[], cursor: null, count: 0 });

        // Primary general stream uses (approved == true, timestamp desc) — NEVER uses broken where('district', 'in', [...18])!
        const mainPromise = fetchStream(
            [where('approved', '==', true)],
            mainCursor.current,
            isInitial ? 45 : 30
        );

        const greetingPromise = isInitial && !initialPostId
            ? fetchStream([where('approved', '==', true), where('type', '==', 'greeting')], null, 1)
            : Promise.resolve({ posts: [] as NewsPost[], cursor: null, count: 0 });

        // ⚡ PARALLEL SERVER FAST PATH (< 250ms): Launched at T=0ms alongside main/local/pref!
        // Immediately renders Top 3 diverse fresh posts while full 40/30/30 queries are already in flight.
        let fastPathAnchors: NewsPost[] = [];
        if (isInitial) {
            const fastPromise = fetchStream([where('approved', '==', true)], null, 10);
            const fastRes = await fastPromise;
            if (seq !== loadSeqRef.current) return;

            const fastAllowed = fastRes.posts.filter(
                p => p.type !== 'greeting' && p.type !== 'survey' && isPostAllowedForHomeFeed(p, effectiveDistrict)
            );
            const fastTop3 = pickFastPathTop3(fastAllowed, interestProfile, effectiveDistrict, 3);
            if (fastTop3.length > 0) {
                fastPathAnchors = fastTop3;
                setNews(prev => {
                    const initialInPrev = initialPostId ? prev.find(p => p.id === initialPostId) : null;
                    if (initialInPrev) {
                        return [initialInPrev, ...fastTop3.filter(p => p.id !== initialPostId)];
                    }
                    return fastTop3;
                });
                setLoading(false);
                if (onLoadComplete) onLoadComplete();
            }
        }

        // Await full parallel blending streams (already in flight since T=0ms!)
        const [prefRes, localRes, mainRes, greetingRes] = await Promise.all([
            prefPromise,
            localPromise,
            mainPromise,
            greetingPromise,
        ]);

        if (seq !== loadSeqRef.current) return;

        prefCursor.current = prefRes.cursor;
        localCursor.current = localRes.cursor;
        mainCursor.current = mainRes.cursor;

        const combinedRaw = [
            ...prefRes.posts,
            ...localRes.posts,
            ...mainRes.posts,
            ...greetingRes.posts,
        ];

        const filteredRaw = combinedRaw.filter(p => isPostAllowedForHomeFeed(p, effectiveDistrict));

        if (isInitial) {
            // If Fast Path returned empty (e.g. network hiccup), pick 3 anchors from main stream
            const effectiveAnchors = fastPathAnchors.length > 0
                ? fastPathAnchors
                : pickFastPathTop3(
                    filteredRaw
                        .filter(p => p.type !== 'greeting' && p.type !== 'survey')
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, 10),
                    interestProfile,
                    effectiveDistrict,
                    3
                );

            const blended = blendHomeFeed({
                posts: filteredRaw,
                fastPathAnchors: effectiveAnchors,
                userDistrict: effectiveDistrict,
                profile: interestProfile,
            });

            setNews(prev => {
                const initialInPrev = initialPostId ? prev.find(p => p.id === initialPostId) : null;
                if (initialInPrev) {
                    return [initialInPrev, ...blended.filter(p => p.id !== initialPostId)];
                }
                return blended;
            });
        } else {
            const existingPosts = newsRefState.current;
            const seenIds = new Set(existingPosts.map(p => p.id));
            const unseenNew = filteredRaw.filter(p => !seenIds.has(p.id));
            const blendedNext = blendHomeFeed({
                posts: unseenNew,
                fastPathAnchors: [],
                tailPrefix: existingPosts.slice(-6),
                userDistrict: effectiveDistrict,
                profile: interestProfile,
            });

            if (blendedNext.length > 0) {
                setNews(prev => {
                    const prevIds = new Set(prev.map(p => p.id));
                    const uniqueAppend = blendedNext.filter(p => !prevIds.has(p.id));
                    return uniqueAppend.length > 0 ? [...prev, ...uniqueAppend] : prev;
                });
            }
        }

        if (prefRes.count === 0 && localRes.count === 0 && mainRes.count === 0) {
            setHasMore(false);
        }
    } catch (e) {
        console.error("Mixed Feed Error:", e);
    } finally {
        if (seq === loadSeqRef.current) {
            setLoading(false);
            fetchingRef.current = false;
            if (isInitial && onLoadComplete) onLoadComplete();
        }
    }
  }, [currentUser, userPrefs, effectiveDistrict, onLoadComplete, initialPostId]);

  useEffect(() => {
    let isCancelled = false;

    const init = async () => {
        setLoading(true);
        setNews([]);
        prefCursor.current = null;
        localCursor.current = null;
        mainCursor.current = null;
        fetchingRef.current = false;
        setHasMore(true);

        // ⚡ Fast-path for shared link: fetch shared article immediately so it opens instantly on home page
        if (initialPostId) {
            try {
                const docSnap = await getDoc(doc(db, 'news', initialPostId));
                if (!isCancelled && docSnap.exists()) {
                    const deepPost = { id: docSnap.id, ...docSnap.data(), timestamp: getTs(docSnap.data()) } as NewsPost;
                    setNews([deepPost]);
                    setLoading(false);
                }
            } catch (e) {
                console.warn("Shared link fast-load error:", e);
            }
        }

        await loadMixedFeed(true);

        if (!isCancelled && feedRef.current) {
            feedRef.current.scrollTop = 0;
        }
    };
    init();

    return () => {
        isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPostId, effectiveDistrict, refreshVersion]); // Reloads cleanly on shared link, district switch, or preference save

  useEffect(() => {
    if (loading || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !fetchingRef.current) {
        loadMixedFeed();
      }
    }, { rootMargin: '1200px', threshold: 0 });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, hasMore]); // Intentionally omitting loadMixedFeed


  return (
    <div className="relative h-full w-full bg-black overflow-hidden flex flex-col">
      {!hideHeader && (
        <div className="absolute top-0 left-0 right-0 p-3 z-30 flex items-center justify-between drop-shadow-md bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center pointer-events-none whitespace-nowrap shrink-0">
                <span className="font-poppins font-bold text-2xl text-white">alfa</span>
                <span className="font-poppins font-semibold text-2xl text-red-600">news</span>
            </div>
            <button 
                onClick={() => setShowPreferences(true)}
                className="p-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white shadow-lg active:scale-95 transition-transform"
            >
                <Settings2 className="w-5 h-5" />
            </button>
        </div>
      )}
      {loading && news.length === 0 && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
              <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-white font-mallanna text-xl">వార్తలు సిద్ధమవుతున్నాయి...</p>
          </div>
      )}
      <div ref={feedRef} className="flex-1 w-full overflow-y-auto snap-y snap-mandatory no-scrollbar relative z-10 bg-black overscroll-none scroll-smooth">
        {news.map((post, index) => {
            const elements = [
                <div key={post.id} className="w-full h-full snap-start snap-always shrink-0 bg-black">
                    <NewsCard 
                      post={post} 
                      language={language} 
                      onProfileClick={onProfileClick} 
                      currentUser={currentUser} 
                      onReporterClick={onReporterClick || (() => {})} 
                      onCategoryClick={() => {}} 
                    />
                </div>
            ];
            
            // 🎯 Every 5 news articles: Render full-screen Ad Card matching Android App
            if ((index + 1) % 5 === 0) {
                elements.push(
                    <div key={`ad-${post.id}-${index}`} className="w-full h-full snap-start snap-always shrink-0 bg-black">
                        <AdMobCard />
                    </div>
                );
            }
            return elements;
        })}
        <div ref={sentinelRef} className="h-60 flex flex-col items-center justify-center text-gray-700 font-mallanna bg-black">
            {hasMore ? (
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>మరిన్ని వార్తలు...</span>
                </div>
            ) : news.length > 0 ? (
                <div className="italic opacity-30 text-xs">ముగిసింది.</div>
            ) : null}
        </div>
      </div>

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

      {showPreferences && (
          <PreferencesModal 
              currentUser={currentUser} 
              onClose={() => setShowPreferences(false)} 
              onSave={() => {
                  // Reload feed with new preferences
                  setLoading(true);
                  setNews([]);
                  prefCursor.current = null;
                  localCursor.current = null;
                  mainCursor.current = null;
                  fetchingRef.current = false;
                  setHasMore(true);
                  loadMixedFeed(true);
              }} 
          />
      )}
    </div>
  );
};

export default React.memo(NewsFeed);
