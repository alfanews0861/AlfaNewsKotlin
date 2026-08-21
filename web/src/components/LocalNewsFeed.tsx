
import React, { useState, useEffect, useCallback, useRef } from 'react';
import NewsCard from './NewsCard';
import { NewsPost, Language, User, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';

const { collection, query, where, orderBy, limit, getDocs, startAfter } = _firestore as any;

interface LocalNewsFeedProps {
  language: Language;
  onProfileClick: () => void;
  currentUser: User | null;
  onLoadComplete?: () => void;
  onReporterClick: (id: string) => void;
}

const LocalNewsFeed: React.FC<LocalNewsFeedProps> = ({ language, onProfileClick, currentUser, onLoadComplete, onReporterClick }) => {
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  
  const hasMoreRef = useRef(true);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const lastVisible = useRef<any>(null);
  const fetchingRef = useRef(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [activeDistrict, setActiveDistrict] = useState<string | null>(() => {
    return currentUser?.district || localStorage.getItem('user_local_district') || null;
  });

  const [showSelector, setShowSelector] = useState(false);
  const [tempState, setTempState] = useState<'AP' | 'TS'>(() => {
      const savedDistrict = currentUser?.district || localStorage.getItem('user_local_district');
      if (savedDistrict && AP_DISTRICTS.includes(savedDistrict)) return 'AP';
      return 'TS';
  });

  useEffect(() => {
    if (currentUser?.district && currentUser.district !== activeDistrict) {
      setActiveDistrict(currentUser.district);
      localStorage.setItem('user_local_district', currentUser.district);
      setTempState(AP_DISTRICTS.includes(currentUser.district) ? 'AP' : 'TS');
    }
  }, [currentUser?.district]);

  const getTimestampValue = (timestamp: any) => {
      if (!timestamp) return Date.now();
      if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
      if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000;
      return Date.now();
  };

  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation || activeDistrict) return;
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        // Use free Nominatim reverse geocoding instead of Gemini to avoid API key issues on client
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`);
        const data = await response.json();
        
        const districtName = data.address?.state_district || data.address?.county || '';
        
        // Simple mapping logic (can be expanded)
        const districtList = [...TS_DISTRICTS, ...AP_DISTRICTS];
        let detected = null;
        
        for (const d of districtList) {
            // Basic matching, assuming Nominatim returns english names like "Hyderabad District"
            // This is a simplified fallback since we removed Gemini
            if (districtName.toLowerCase().includes('hyderabad')) detected = 'హైదరాబాద్';
            else if (districtName.toLowerCase().includes('rangareddy')) detected = 'రంగారెడ్డి';
            else if (districtName.toLowerCase().includes('visakhapatnam')) detected = 'విశాఖపట్నం';
            else if (districtName.toLowerCase().includes('vijayawada') || districtName.toLowerCase().includes('krishna')) detected = 'కృష్ణా';
            // Add more mappings as needed, or just default to a known one if matched
        }

        if (detected) {
            setActiveDistrict(detected);
            localStorage.setItem('user_local_district', detected);
        }
      } catch (err) { console.error(err); } finally { setIsDetecting(false); }
    }, () => setIsDetecting(false), { timeout: 10000 });
  }, [activeDistrict]);

  const fetchLocalNews = useCallback(async (isInitial = false) => {
    if (fetchingRef.current || (!isInitial && !hasMoreRef.current)) return;
    fetchingRef.current = true;
    
    const cacheKey = `alfa_local_news_cache_${activeDistrict || 'none'}`;

    if (isInitial) {
        const cachedStr = sessionStorage.getItem(cacheKey);
        if (cachedStr) {
            try {
                const cached = JSON.parse(cachedStr);
                // 3-minute TTL
                if (Date.now() - cached.timestamp < 3 * 60 * 1000) {
                    setNews(cached.news);
                    lastVisible.current = cached.cursor;
                    setLoading(false);
                    fetchingRef.current = false;
                    setHasMore(true); // Assume more might exist
                    if (onLoadComplete) {
                        onLoadComplete();
                        setTimeout(() => { if (feedRef.current) feedRef.current.scrollTop = 0; }, 100);
                    }
                    return; // Skip server fetch
                }
            } catch (e) {
                console.error("Cache parse error", e);
            }
        }

        setLoading(true);
        lastVisible.current = null;
        setHasMore(true);
        setNews([]);
    }

    try {
        const newsRef = collection(db, 'news');
        const FETCH_LIMIT = 10;
        let q = query(
            newsRef, 
            ...(activeDistrict ? [where('district', '==', activeDistrict)] : []),
            orderBy('timestamp', 'desc'), 
            limit(FETCH_LIMIT)
        );

        if (!isInitial && lastVisible.current) {
            const ts = _firestore.Timestamp.fromMillis(lastVisible.current);
            q = query(
                newsRef, 
                ...(activeDistrict ? [where('district', '==', activeDistrict)] : []),
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
                uniqueNew.sort((a: NewsPost, b: NewsPost) => b.timestamp - a.timestamp);
                
                const finalNews = isInitial ? uniqueNew : [...prev, ...uniqueNew];
                
                if (isInitial) {
                    sessionStorage.setItem(cacheKey, JSON.stringify({
                        timestamp: Date.now(),
                        news: finalNews,
                        cursor: lastVisible.current
                    }));
                }
                
                return finalNews;
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
  }, [activeDistrict, onLoadComplete]);

  useEffect(() => { detectLocation(); }, [detectLocation]);
  
  useEffect(() => { 
    fetchLocalNews(true); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDistrict]); // Intentionally omitting fetchLocalNews

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
      <div className="absolute top-2 left-2 p-2 z-30 flex items-center pointer-events-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
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
                      <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">రాష్ట్రం (State)</label>
                      <select 
                          value={tempState} 
                          onChange={(e) => setTempState(e.target.value as 'AP' | 'TS')}
                          className="bg-black/50 border border-white/10 text-white text-sm rounded-lg p-2.5 outline-none font-mallanna appearance-none focus:border-red-500 transition-colors"
                      >
                          <option value="TS" className="text-black bg-white">తెలంగాణ</option>
                          <option value="AP" className="text-black bg-white">ఆంధ్ర ప్రదేశ్</option>
                      </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">జిల్లా (District)</label>
                      <select 
                          value={activeDistrict || ''} 
                          onChange={(e) => {
                              const val = e.target.value;
                              setActiveDistrict(val || null);
                              if (val) localStorage.setItem('user_local_district', val);
                              else localStorage.removeItem('user_local_district');
                              setShowSelector(false);
                          }}
                          className="bg-black/50 border border-white/10 text-white text-sm rounded-lg p-2.5 outline-none font-mallanna appearance-none focus:border-red-500 transition-colors"
                      >
                          <option value="" className="text-black bg-white">అన్ని ప్రాంతాలు</option>
                          {(tempState === 'TS' ? TS_DISTRICTS : AP_DISTRICTS).sort().map(d => (
                              <option key={d} value={d} className="text-black bg-white">{d}</option>
                          ))}
                      </select>
                  </div>
              </div>
          )}
      </div>

      {loading && news.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center bg-black">
              <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-500 font-mallanna text-lg">వార్తలను సేకరిస్తున్నాము...</p>
           </div>
      ) : (
          <div ref={feedRef} className="flex-1 overflow-y-auto snap-y snap-mandatory no-scrollbar bg-black overscroll-none scroll-smooth">
              {news.length === 0 && !loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
                       <p className="font-mallanna text-xl">ప్రస్తుతం వార్తలు ఏవీ లేవు.</p>
                       <button onClick={() => setShowSelector(true)} className="mt-4 text-red-600 font-bold underline">జిల్లా మార్చండి</button>
                  </div>
              ) : (
                  <>
                    {news.map((post) => (
                        <div key={post.id} className="w-full h-full snap-start snap-always shrink-0 bg-black">
                            <NewsCard post={post} language={language} onProfileClick={onProfileClick} currentUser={currentUser} onCategoryClick={() => {}} onReporterClick={onReporterClick} />
                        </div>
                    ))}
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
    </div>
  );
};

export default LocalNewsFeed;
