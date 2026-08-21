
import React, { useState, useEffect, useCallback, useRef } from 'react';
import NewsCard from './NewsCard';
import { NewsPost, Language, User, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { db } from '../services/firebase';
import { GoogleGenAI } from "@google/genai";
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
  
  const lastVisible = useRef<any>(null);
  const fetchingRef = useRef(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [activeDistrict, setActiveDistrict] = useState<string | null>(() => {
    return currentUser?.district || localStorage.getItem('user_local_district') || null;
  });

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
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const districtList = [...TS_DISTRICTS, ...AP_DISTRICTS].join(', ');
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-preview',
            contents: `Identify which district from this list: [${districtList}] the coordinates (Lat: ${latitude}, Lng: ${longitude}) belong to. Return ONLY the district name in Telugu.`,
        });
        const detected = response.text?.trim();
        if (detected && [...TS_DISTRICTS, ...AP_DISTRICTS].includes(detected)) {
            setActiveDistrict(detected);
            localStorage.setItem('user_local_district', detected);
        }
      } catch (err) { console.error(err); } finally { setIsDetecting(false); }
    }, () => setIsDetecting(false), { timeout: 10000 });
  }, [activeDistrict]);

  const fetchLocalNews = useCallback(async (isInitial = false) => {
    if (fetchingRef.current || (!isInitial && !hasMore)) return;
    fetchingRef.current = true;
    if (isInitial) {
        setLoading(true);
        lastVisible.current = null;
        setHasMore(true);
        setNews([]);
    }

    try {
        const newsRef = collection(db, 'news');
        const FETCH_LIMIT = 20;
        let q = query(
            newsRef, 
            ...(activeDistrict ? [where('district', '==', activeDistrict)] : []),
            orderBy('timestamp', 'desc'), 
            limit(FETCH_LIMIT)
        );

        if (!isInitial && lastVisible.current) {
            q = query(
                newsRef, 
                ...(activeDistrict ? [where('district', '==', activeDistrict)] : []),
                orderBy('timestamp', 'desc'), 
                startAfter(lastVisible.current), 
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

            lastVisible.current = snap.docs[snap.docs.length - 1];

            setNews(prev => {
                const seenIds = new Set(prev.map((p) => p.id));
                const uniqueNew = fetchedPosts.filter((p) => !seenIds.has(p.id));
                const combined = isInitial ? uniqueNew : [...prev, ...uniqueNew];
                return combined.sort((a, b) => b.timestamp - a.timestamp);
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
  }, [activeDistrict, hasMore, onLoadComplete]);

  useEffect(() => { detectLocation(); }, [detectLocation]);
  useEffect(() => { fetchLocalNews(true); }, [activeDistrict, fetchLocalNews]);

  useEffect(() => {
    if (loading || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !fetchingRef.current) {
        fetchLocalNews();
      }
    }, { rootMargin: '1000px', threshold: 0.1 });

    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loading, hasMore, fetchLocalNews]);

  return (
    <div className="relative h-full w-full bg-black overflow-hidden flex flex-col">
      <div className="absolute top-2 left-2 p-2 z-30 flex items-center pointer-events-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
          <span className="font-poppins font-bold text-3xl text-white">alfa</span>
          <span className="font-poppins font-semibold text-3xl text-red-600">news</span>
      </div>

      <div className="absolute top-4 right-4 z-30">
          <button onClick={onProfileClick} className="bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xl transition-transform active:scale-95">
            {isDetecting ? <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>}
            <span className="text-white font-mallanna text-[11px] font-bold">{isDetecting ? 'గుర్తిస్తున్నాము...' : (activeDistrict || 'అన్ని ప్రాంతాలు')}</span>
          </button>
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
                       <button onClick={onProfileClick} className="mt-4 text-red-600 font-bold underline">జిల్లా మార్చండి</button>
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
