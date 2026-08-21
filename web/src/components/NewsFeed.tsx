
import React, { useState, useEffect, useRef, useCallback } from 'react';
import NewsCard from './NewsCard';
import AdCard from './AdCard';
import AppDownloadModal from './AppDownloadModal';
import { NewsPost, Language, User, UserInterest } from '../types';
import { db } from '../services/firebase';
import { getUserPreferredCategory } from '../services/analyticsService';
import * as _firestore from 'firebase/firestore';
import { Settings2 } from 'lucide-react';
import PreferencesModal from './PreferencesModal';

const { collection, query, where, orderBy, limit, getDocs, Timestamp, startAfter, doc, getDoc } = _firestore as any;

const rankPosts = (posts: NewsPost[], interests: UserInterest | undefined) => {
    if (!interests || Object.keys(interests).length === 0) return posts;
    
    // 1 point of interest equals +4 hours of effective "freshness"
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

    return posts.sort((a, b) => {
        const getScore = (post: NewsPost) => {
            let score = 0;
            const features = [...(post.categories || []), ...(post.tags || []), ...(post.keywords || [])];
            features.forEach(feature => {
                score += (interests[feature.toLowerCase()] || 0);
            });
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
}

const NewsFeed: React.FC<NewsFeedProps> = ({ language, onProfileClick, currentUser, onLoadComplete, onReporterClick, initialPostId }) => {
  const hasMoreRef = useRef(true);
  
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);

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
        if (isInitial) {
            const cachedStr = sessionStorage.getItem(cacheKey);
            if (cachedStr) {
                try {
                    const cached = JSON.parse(cachedStr);
                    // 3-minute TTL for cache to ensure freshness while saving reads
                    if (Date.now() - cached.timestamp < 3 * 60 * 1000) {
                        setNews(cached.news);
                        prefCursor.current = cached.cursors.pref;
                        localCursor.current = cached.cursors.local;
                        globalCursor.current = cached.cursors.global;
                        greetingCursor.current = cached.cursors.greeting;
                        setLoading(false);
                        fetchingRef.current = false;
                        if (onLoadComplete) onLoadComplete();
                        return; // Skip fetching from server
                    }
                } catch (e) {
                    console.error("Cache parse error", e);
                }
            }
        }

        // REFINED MIXING LOGIC:
        
        let prefPromise = Promise.resolve({posts:[], cursor:null, count:0});
        
        if (explicitCategories && explicitCategories.length > 0) {
            const catsToFetch = explicitCategories.slice(0, 10);
            prefPromise = fetchStream([where('categories', 'array-contains-any', catsToFetch)], prefCursor.current, 3);
        } else if (implicitCategory) {
            prefPromise = fetchStream([where('categories', 'array-contains', implicitCategory)], prefCursor.current, 3);
        }

        const [prefRes, localRes, globalRes, greetingRes] = await Promise.all([
            prefPromise,
            userDistrict ? fetchStream([where('district', '==', userDistrict)], localCursor.current, 5) : Promise.resolve({posts:[], cursor:null, count:0}),
            fetchStream([where('district', 'in', ["General", "State", "Sports", "Health", "Technology", "Business", "Entertainment", "Cinema", "National", "International", "Politics", "Crime", "Education", "Agriculture", "Devotional", "Lifestyle", "AndhraPradesh", "Telangana"])], globalCursor.current, 10),
            fetchStream([where('categories', 'array-contains', 'Greetings')], greetingCursor.current, 1)
        ]);

        prefCursor.current = prefRes.cursor;
        localCursor.current = localRes.cursor;
        globalCursor.current = globalRes.cursor;
        greetingCursor.current = greetingRes.cursor;

        const globalDistricts = ["General", "State", "Sports", "Health", "Technology", "Business", "Entertainment", "Cinema", "National", "International", "Politics", "Crime", "Education", "Agriculture", "Devotional", "Lifestyle", "AndhraPradesh", "Telangana"];
        const combinedRaw = [...prefRes.posts, ...localRes.posts, ...globalRes.posts, ...greetingRes.posts];

        // Filter out posts from other districts
        const filteredRaw = combinedRaw.filter(p => {
            // Global news is always allowed
            if (!p.district || globalDistricts.includes(p.district)) return true;
            
            // If user has a district, allow it
            if (userDistrict && p.district === userDistrict) return true;
            
            // Otherwise, it's a district news from a different district, so exclude it
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
            
            const finalNews = isInitial ? rankedNewPosts : [...prev, ...rankedNewPosts];
            
            // Save to cache if it's the initial load
            if (isInitial) {
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(),
                    news: finalNews,
                    cursors: {
                        pref: prefCursor.current,
                        local: localCursor.current,
                        global: globalCursor.current,
                        greeting: greetingCursor.current
                    }
                }));
            }
            
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
  }, [userPrefs, currentUser?.district, onLoadComplete]);

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        setNews([]);
        prefCursor.current = null;
        localCursor.current = null;
        globalCursor.current = null;
        greetingCursor.current = null;
        setHasMore(true);
        await loadMixedFeed(true);
        if (initialPostId) {
            try {
                const docSnap = await getDoc(doc(db, 'news', initialPostId));
                if (docSnap.exists()) {
                    const deepPost = { id: docSnap.id, ...docSnap.data(), timestamp: getTs(docSnap.data()) } as NewsPost;
                    setNews(prev => [deepPost, ...prev.filter(p => p.id !== initialPostId)]);
                }
            } catch (e) {}
        }
    };
    init();
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
            
            if ((index + 1) % 5 === 0) {
                elements.push(
                    <div key={`modal-${post.id}`} className="w-full h-full snap-start snap-always shrink-0 bg-black">
                        <AppDownloadModal />
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
