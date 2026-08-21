
import React, { useState, useEffect, useRef, useCallback } from 'react';
import NewsCard from './NewsCard';
import { NewsPost, Language, User } from '../types';
import { db } from '../services/firebase';
import { getUserPreferredCategory } from '../services/analyticsService';
import * as _firestore from 'firebase/firestore';

const { collection, query, where, orderBy, limit, getDocs, Timestamp, startAfter, doc, getDoc } = _firestore as any;

interface NewsFeedProps {
  language: Language;
  onProfileClick: () => void;
  currentUser: User | null;
  onLoadComplete?: () => void;
  filterReporterId?: string | null;
  onReporterClick?: (id: string) => void;
  initialPostId?: string | null;
}

const NewsFeed: React.FC<NewsFeedProps> = ({ language, onProfileClick, currentUser, onLoadComplete, onReporterClick, initialPostId }) => {
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const prefCursor = useRef<any>(null);
  const localCursor = useRef<any>(null);
  const generalCursor = useRef<any>(null);
  
  const feedRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const getTimestamp = (postData: any) => {
      if (!postData.timestamp) return Date.now();
      if (postData.timestamp instanceof Timestamp) return postData.timestamp.toMillis();
      if (typeof postData.timestamp === 'number') return postData.timestamp;
      return Date.now();
  };

  const fetchFromStream = async (constraints: any[], lastCursor: any, count: number) => {
      try {
          const newsRef = collection(db, 'news');
          let q = query(newsRef, ...constraints, orderBy('timestamp', 'desc'), limit(count));
          if (lastCursor) {
              q = query(newsRef, ...constraints, orderBy('timestamp', 'desc'), startAfter(lastCursor), limit(count));
          }
          const snap = await getDocs(q);
          return {
              posts: snap.docs.map((d: any) => ({ 
                id: d.id, 
                ...d.data(), 
                timestamp: getTimestamp(d.data()) 
              } as NewsPost)),
              cursor: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : lastCursor,
              foundCount: snap.docs.length
          };
      } catch (e) {
          console.error("Fetch error:", e);
          return { posts: [], cursor: lastCursor, foundCount: 0 };
      }
  };

  const loadFeedBlock = useCallback(async (isInitial = false) => {
    if (fetchingRef.current || (!isInitial && !hasMore)) return;
    fetchingRef.current = true;

    const preferredCategory = getUserPreferredCategory();
    const userDistrict = currentUser?.district || localStorage.getItem('user_local_district');

    try {
        const streams = await Promise.all([
            preferredCategory ? fetchFromStream([where('category', '==', preferredCategory)], prefCursor.current, 5) : Promise.resolve({posts:[], cursor:null, foundCount:0}),
            userDistrict ? fetchFromStream([where('district', '==', userDistrict)], localCursor.current, 5) : Promise.resolve({posts:[], cursor:null, foundCount:0}),
            fetchFromStream([], generalCursor.current, 15)
        ]);

        const [prefRes, localRes, generalRes] = streams;
        prefCursor.current = prefRes.cursor;
        localCursor.current = localRes.cursor;
        generalCursor.current = generalRes.cursor;

        const rawBlock = [...prefRes.posts, ...localRes.posts, ...generalRes.posts];

        setNews(prev => {
            const seenIds = new Set(prev.map((p: NewsPost) => p.id));
            const uniqueNew = rawBlock.filter((p: NewsPost) => !seenIds.has(p.id));
            const combined = isInitial ? uniqueNew : [...prev, ...uniqueNew];
            
            return combined.sort((a: NewsPost, b: NewsPost) => b.timestamp - a.timestamp);
        });

        // Truly stop only if all streams return 0
        if (prefRes.foundCount === 0 && localRes.foundCount === 0 && generalRes.foundCount === 0) {
            setHasMore(false);
        }

    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
        fetchingRef.current = false;
        if (isInitial && onLoadComplete) {
          onLoadComplete();
        }
    }
  }, [currentUser, hasMore, onLoadComplete]);

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        setNews([]);
        prefCursor.current = null;
        localCursor.current = null;
        generalCursor.current = null;
        setHasMore(true);

        let initialPost: NewsPost | null = null;
        if (initialPostId) {
            try {
                const docSnap = await getDoc(doc(db, 'news', initialPostId));
                if (docSnap.exists()) {
                    initialPost = { id: docSnap.id, ...docSnap.data(), timestamp: getTimestamp(docSnap.data()) } as NewsPost;
                }
            } catch (e) {}
        }
        
        await loadFeedBlock(true);
        
        if (initialPost) {
            setNews(prev => [initialPost!, ...prev.filter(p => p.id !== initialPost!.id)]);
        }
        if (feedRef.current) feedRef.current.scrollTop = 0;
    };
    init();
  }, [initialPostId, loadFeedBlock]);

  useEffect(() => {
    if (loading || !hasMore) return;
    
    // Increased rootMargin to 1200px to fetch news way before user reaches the bottom
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !fetchingRef.current) {
        loadFeedBlock();
      }
    }, { rootMargin: '1200px', threshold: 0 });

    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loading, hasMore, loadFeedBlock]);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden flex flex-col">
      <div className="absolute top-2 left-2 p-2 z-30 flex items-center pointer-events-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
          <span className="font-poppins font-bold text-3xl text-white">alfa</span>
          <span className="font-poppins font-semibold text-3xl text-red-600">news</span>
      </div>

      {loading && news.length === 0 && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
              <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-white font-mallanna text-xl">వార్తలు లోడ్ అవుతున్నాయి...</p>
          </div>
      )}

      <div 
        ref={feedRef} 
        className="flex-1 w-full overflow-y-auto snap-y snap-mandatory no-scrollbar relative z-10 bg-black overscroll-none scroll-smooth"
      >
        {news.map((post) => (
           <div key={post.id} className="w-full h-full snap-start snap-always shrink-0 bg-black">
                <NewsCard 
                  post={post} 
                  language={language} 
                  onProfileClick={onProfileClick} 
                  currentUser={currentUser} 
                  onCategoryClick={() => {}} 
                  onReporterClick={onReporterClick || (() => {})} 
                />
           </div>
        ))}
        
        {/* Removed snap-start from the sentinel to prevent scroll-snap hanging */}
        <div ref={sentinelRef} className="h-60 flex flex-col items-center justify-center text-gray-500 font-mallanna bg-black">
            {hasMore ? (
                <div className="flex items-center">
                    <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                    వార్తలు వస్తున్నాయి...
                </div>
            ) : news.length > 0 ? (
                <div className="italic text-gray-700">చివరి వార్తకు చేరుకున్నారు.</div>
            ) : null}
        </div>
      </div>
    </div>
  );
};

export default NewsFeed;
