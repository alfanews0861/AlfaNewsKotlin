
import React, { useState, useEffect, useRef, useCallback } from 'react';
import NewsCard from './NewsCard';
import AdMobCard from './AdMobCard';
import AppDownloadPopup from './AppDownloadPopup';
import SwipeHintOverlay from './SwipeHintOverlay';
import { preloadImages } from '../utils/imageHelper';
import { NewsPost, Language, User, UserInterest } from '../types';
import { db } from '../services/firebase';
import { getUserPreferredCategory } from '../services/analyticsService';
import * as _firestore from 'firebase/firestore';
import { Settings2 } from 'lucide-react';
import PreferencesModal from './PreferencesModal';

const { collection, query, where, orderBy, limit, getDocs, Timestamp, startAfter, doc, getDoc } = _firestore as any;

const rankPosts = (posts: NewsPost[], interests: UserInterest | undefined) => {
    // 1 point of interest equals +4 hours of effective "freshness"
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

    return [...posts].sort((a, b) => {
        const getScore = (post: NewsPost) => {
            let score = 0;
            const features = [...(post.categories || []), ...(post.tags || []), ...(post.keywords || [])];
            if (interests) {
                features.forEach(feature => {
                    score += (interests[feature.toLowerCase()] || 0);
                });
            }
            // 🎯 Category Priority: Politics #1 (+10 pts = +40 hrs), Cinema #2 (+6 pts = +24 hrs)
            const allText = [post.category, ...(post.categories || []), ...(post.tags || [])].join(' ').toLowerCase();
            if (allText.includes('రాజకీయం') || allText.includes('రాజకీయాలు') || allText.includes('రాజకీయ') || allText.includes('politics') || allText.includes('political')) {
                score += 10;
            } else if (allText.includes('సినిమా') || allText.includes('వినోదం') || allText.includes('cinema') || allText.includes('entertainment') || allText.includes('movies') || allText.includes('ఓటీటీ') || allText.includes('ott') || allText.includes('చిత్రసీమ') || allText.includes('టాలీవుడ్')) {
                score += 6;
            }
            return score;
        };
        
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        
        const effectiveTsA = a.timestamp + (scoreA * FOUR_HOURS_MS);
        const effectiveTsB = b.timestamp + (scoreB * FOUR_HOURS_MS);
        
        return effectiveTsB - effectiveTsA;
    });
};

interface NewsFeedProps {
  language: Language;
  onProfileClick: () => void;
  currentUser: User | null;
  onLoadComplete?: () => void;
  onReporterClick?: (id: string) => void;
  initialPostId?: string | null;
  hideHeader?: boolean;
}

const strictlyGlobalKeywords = [
  "సినిమా", "స్పోర్ట్స్", "జాతీయం", "అంతర్జాతీయం", "వ్యాపారం", 
  "ఆరోగ్యం", "విద్య", "టెక్నాలజీ", "వ్యవసాయం", "భక్తి", 
  "వినోదం", "ప్రపంచం", "క్రైమ్", "లైఫ్ స్టైల్", "జనరల్", "రాష్ట్రం",
  "రాష్ట్ర వార్తలు", "ముఖ్యాంశాలు", "బ్రేకింగ్", "వైరల్", "తాజా వార్తలు",
  "ఆంధ్రప్రదేశ్", "తెలంగాణ", "భారతదేశం", "రాజకీయం", "సినిమా వార్తలు"
];

const globalDistrictsList = [
  "General", "State", "Sports", "Health", "Technology", "Business", 
  "Entertainment", "Cinema", "National", "International", "Politics", 
  "Crime", "Education", "Agriculture", "Devotional", "Lifestyle", 
  "AndhraPradesh", "Telangana", "ఆంధ్రప్రదేశ్", "తెలంగాణ", "జనరల్", "భారతదేశం", "ప్రపంచం"
];

const isGlobalPost = (post: NewsPost): boolean => {
  if (post.isGlobal) return true;
  if (!post.district || globalDistrictsList.some(d => d.toLowerCase() === post.district?.toLowerCase())) return true;
  if (post.category && strictlyGlobalKeywords.some(kw => post.category?.toLowerCase().includes(kw.toLowerCase()))) return true;
  if (post.categories && post.categories.some(c => strictlyGlobalKeywords.some(kw => c.toLowerCase().includes(kw.toLowerCase())))) return true;
  return false;
};

const NewsFeed: React.FC<NewsFeedProps> = ({
  language,
  onProfileClick,
  currentUser,
  onLoadComplete,
  onReporterClick,
  initialPostId,
  hideHeader = false,
}) => {
  const hasMoreRef = useRef(true);
  
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);
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

  // Sync ref with state
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);
  
  const prefCursor = useRef<any>(null);
  const localCursor = useRef<any>(null);
  const globalCursor = useRef<any>(null);
  const greetingCursor = useRef<any>(null);
  
  const feedRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const getTs = (data: any) => {
      if (!data.timestamp) return Date.now();
      if (data.timestamp instanceof Timestamp) return data.timestamp.toMillis();
      return typeof data.timestamp === 'number' ? data.timestamp : Date.now();
  };

  const fetchStream = async (constraints: any[], cursorTs: number | null, count: number) => {
      try {
          const newsRef = collection(db, 'news');
          let q = query(newsRef, ...constraints, orderBy('timestamp', 'desc'), limit(count));
          if (cursorTs) {
              const ts = Timestamp.fromMillis(cursorTs);
              q = query(newsRef, ...constraints, orderBy('timestamp', 'desc'), startAfter(ts), limit(count));
          }
          const snap = await getDocs(q);
          return {
              posts: snap.docs.map((d: any) => ({ id: d.id, ...d.data(), timestamp: getTs(d.data()) } as NewsPost)),
              cursor: snap.docs.length > 0 ? getTs(snap.docs[snap.docs.length - 1].data()) : cursorTs,
              count: snap.docs.length
          };
      } catch (e) {
          console.error("Fetch Stream Error:", e);
          return { posts: [], cursor: cursorTs, count: 0 };
      }
  };

  const userPrefs = React.useMemo(() => ({
      preferredCategories: currentUser?.preferredCategories,
      interests: currentUser?.interests
  }), [currentUser?.preferredCategories, currentUser?.interests]);

  const loadMixedFeed = useCallback(async (isInitial = false) => {
    if (fetchingRef.current || (!isInitial && !hasMoreRef.current)) return;
    fetchingRef.current = true;

    const implicitCategory = getUserPreferredCategory();
    const explicitCategories = userPrefs.preferredCategories || 
        (localStorage.getItem('alfa_explicit_prefs') ? JSON.parse(localStorage.getItem('alfa_explicit_prefs')!) : null);
    
    const userDistrict = currentUser?.district || localStorage.getItem('user_local_district');
    const cacheKey = `alfa_news_cache_${userDistrict || 'global'}_${implicitCategory || 'none'}`;

    try {
        // Direct server news: Zero disk cache

        // 40/30/30 MIXING LOGIC:
        let prefPromise = Promise.resolve({posts:[], cursor:null, count:0});
        
        if (explicitCategories && explicitCategories.length > 0) {
            const catsToFetch = explicitCategories.slice(0, 10);
            prefPromise = fetchStream([where('categories', 'array-contains-any', catsToFetch)], prefCursor.current, 4);
        } else if (implicitCategory) {
            prefPromise = fetchStream([where('categories', 'array-contains', implicitCategory)], prefCursor.current, 4);
        }

        const [prefRes, localRes, globalRes, greetingRes] = await Promise.all([
            prefPromise,
            userDistrict ? fetchStream([where('district', '==', userDistrict)], localCursor.current, 6) : Promise.resolve({posts:[], cursor:null, count:0}),
            fetchStream([where('district', 'in', ["General", "State", "Sports", "Health", "Technology", "Business", "Entertainment", "Cinema", "National", "International", "Politics", "Crime", "Education", "Agriculture", "Devotional", "Lifestyle", "AndhraPradesh", "Telangana"])], globalCursor.current, 10),
            fetchStream([where('categories', 'array-contains', 'Greetings')], greetingCursor.current, 1)
        ]);

        prefCursor.current = prefRes.cursor;
        localCursor.current = localRes.cursor;
        globalCursor.current = globalRes.cursor;
        greetingCursor.current = greetingRes.cursor;

        const combinedRaw = [...prefRes.posts, ...localRes.posts, ...globalRes.posts, ...greetingRes.posts];

        // Filter out posts: allow if global OR if district matches user's district
        const filteredRaw = combinedRaw.filter(p => {
            if (isGlobalPost(p)) return true;
            if (userDistrict && p.district?.toLowerCase() === userDistrict.toLowerCase()) return true;
            return false;
        });

        // Ensure the combined array is globally sorted by timestamp FIRST before any ranked processing
        filteredRaw.sort((a, b) => b.timestamp - a.timestamp);

        setNews(prev => {
            const seen = new Set(prev.map(p => p.id));
            const uniqueInBatch = filteredRaw.filter(p => !seen.has(p.id));
            const uniqueMap = new Map();
            uniqueInBatch.forEach(p => uniqueMap.set(p.id, p));
            
            const newPosts = Array.from(uniqueMap.values());
            const rankedNewPosts = rankPosts(newPosts, userPrefs.interests);
            
            // 🎯 Ensure shared post (initialPostId) stays at index 0 on home feed
            const initialInPrev = initialPostId ? prev.find(p => p.id === initialPostId) : null;
            if (initialInPrev) {
                return [initialInPrev, ...rankedNewPosts.filter(p => p.id !== initialPostId)];
            }

            const finalNews = isInitial ? rankedNewPosts : [...prev, ...rankedNewPosts];
            return finalNews;
        });

        if (prefRes.count === 0 && localRes.count === 0 && globalRes.count === 0) {
            setHasMore(false);
        }
    } catch (e) {
        console.error("Mixed Feed Error:", e);
    } finally {
        setLoading(false);
        fetchingRef.current = false;
        if (isInitial && onLoadComplete) onLoadComplete();
    }
  }, [userPrefs, currentUser?.district, onLoadComplete, initialPostId]);

  useEffect(() => {
    let isCancelled = false;

    const init = async () => {
        setLoading(true);
        setNews([]);
        prefCursor.current = null;
        localCursor.current = null;
        globalCursor.current = null;
        greetingCursor.current = null;
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
  }, [initialPostId]); // Intentionally omitting loadMixedFeed to prevent feed reset on interest updates

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
                  globalCursor.current = null;
                  setHasMore(true);
                  loadMixedFeed(true);
              }} 
          />
      )}
    </div>
  );
};

export default React.memo(NewsFeed);
