import React, { useState, useEffect, useRef, useCallback } from 'react';
import NewsCard, { getReadNewsIds } from './NewsCard';
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

// 🌐 UNIVERSAL GLOBAL KEYWORDS (Excluded state-specific politics and state names)
const strictlyGlobalKeywords = [
  "సినిమా", "స్పోర్ట్స్", "క్రీడలు", "జాతీయం", "అంతర్జాతీయం", "వ్యాపారం", 
  "ఆరోగ్యం", "విద్య", "టెక్నాలజీ", "వ్యవసాయం", "భక్తి", 
  "వినోదం", "ప్రపంచం", "లైఫ్ స్టైల్", "జనరల్", "భారతదేశం", "సినిమా వార్తలు"
];

const universalDistrictsList = [
  "General", "Sports", "Health", "Technology", "Business", 
  "Entertainment", "Cinema", "National", "International", 
  "Crime", "Education", "Agriculture", "Devotional", "Lifestyle", 
  "జనరల్", "భారతదేశం", "ప్రపంచం", "జాతీయం", "అంతర్జాతీయం"
];

export const mapDistrictToState = (district?: string | null): 'Telangana' | 'Andhra Pradesh' | null => {
  if (!district) return null;
  const clean = district.trim().replace(/జిల్లా|డిస్ట్రిక్ట్|district/gi, '').trim().toLowerCase();

  const tsList = [
    "telangana", "ts", "tg", "తెలంగాణ", "తెలంగాణా", "hyderabad", "హైదరాబాద్", "secunderabad", "సికింద్రాబాద్",
    "cyberabad", "సైబరాబాద్", "adilabad", "ఆదిలాబాద్", "bhadradri", "కొత్తగూడెం", "kothagudem",
    "hanumakonda", "hanamkonda", "హన్మకొండ", "హనుమకొండ", "warangal", "వరంగల్", "jagtial", "జగిత్యాల",
    "jangaon", "జనగాం", "bhupalpally", "భూపాలపల్లి", "gadwal", "గద్వాల", "kamareddy", "కామారెడ్డి",
    "karimnagar", "కరీంనగర్", "khammam", "ఖమ్మం", "asifabad", "ఆసిఫాబాద్", "mahabubabad", "మహబూబాబాద్",
    "mahabubnagar", "మహబూబ్ నగర్", "mancherial", "మంచిర్యాల", "medak", "మెదక్", "medchal", "మేడ్చల్",
    "malkajgiri", "మల్కాజిగిరి", "mulugu", "ములుగు", "nagarkurnool", "నాగర్ కర్నూల్", "nalgonda", "నల్గొండ",
    "narayanpet", "నారాయణపేట", "nirmal", "నిర్మల్", "nizamabad", "నిజామాబాద్", "peddapalli", "పెద్దపల్లి",
    "sircilla", "సిరిసిల్ల", "rangareddy", "రంగారెడ్డి", "sangareddy", "సంగారెడ్డి", "siddipet", "సిద్దిపేట",
    "suryapet", "సూర్యాపేట", "vikarabad", "వికారాబాద్", "wanaparthy", "వనపర్తి", "yadadri", "యాదాద్రి", "bhuvanagiri", "భువనగిరి"
  ];

  const apList = [
    "andhra pradesh", "andhrapradesh", "ap", "andhra", "ఆంధ్రప్రదేశ్", "ఆంధ్ర ప్రదేశ్", "ఆంధ్ర",
    "alluri", "అల్లూరి", "paderu", "పాడేరు", "anakapalli", "అనకాపల్లి", "anantapur", "అనంతపురం",
    "annamayya", "అన్నమయ్య", "rayachoti", "రాయచోటి", "bapatla", "బాపట్ల", "chittoor", "చిత్తూరు",
    "konaseema", "కోనసీమ", "amalapuram", "అమలాపురం", "east godavari", "తూర్పు గోదావరి", "rajahmundry", "రాజమండ్రి",
    "eluru", "ఏలూరు", "guntur", "గుంటూరు", "kakinada", "కాకినాడ", "krishna", "కృష్ణా", "machilipatnam", "మచిలీపట్నం",
    "kurnool", "కర్నూలు", "nandyal", "నంద్యాల", "ntr", "ఎన్టీఆర్", "vijayawada", "విజయవాడ",
    "palnadu", "పల్నాడు", "narasaraopeta", "నరసరావుపేట", "manyam", "మన్యం", "parvathipuram", "పార్వతీపురం",
    "prakasam", "ప్రకాశం", "ongole", "ఒంగోలు", "markapur", "మార్కాపురం", "polavaram", "పోలవరం", "madanapalle", "మదనపల్లె",
    "nellore", "నెల్లూరు", "sathya sai", "సత్యసాయి", "puttaparthi", "పుట్టపర్తి", "srikakulam", "శ్రీకాకుళం",
    "tirupati", "తిరుపతి", "tirumala", "తిరుమల", "visakhapatnam", "విశాఖపట్నం", "vizag", "వైజాగ్",
    "vizianagaram", "విజయనగరం", "west godavari", "పశ్చిమ గోదావరి", "bhimavaram", "భీమవరం", "kadapa", "కడప", "amaravati", "అమరావతి"
  ];

  if (tsList.some(item => clean.includes(item) || item.includes(clean))) return 'Telangana';
  if (apList.some(item => clean.includes(item) || item.includes(clean))) return 'Andhra Pradesh';
  return null;
};

export const inferStateFromPost = (post: NewsPost): 'Telangana' | 'Andhra Pradesh' | null => {
  if (post.state) {
    const sState = mapDistrictToState(post.state);
    if (sState) return sState;
  }
  if (post.district) {
    const dState = mapDistrictToState(post.district);
    if (dState) return dState;
  }
  if (post.category) {
    const cState = mapDistrictToState(post.category);
    if (cState) return cState;
  }
  if (post.categories) {
    for (const cat of post.categories) {
      const cState = mapDistrictToState(cat);
      if (cState) return cState;
    }
  }
  if (post.tags) {
    for (const tag of post.tags) {
      const tState = mapDistrictToState(tag);
      if (tState) return tState;
    }
  }

  const text = `${post.headline?.telugu || ''} ${post.headline?.english || ''} ${post.content?.telugu || ''} ${post.content?.english || ''}`.toLowerCase();

  const tsTerms = [
    "రేవంత్", "కేసీఆర్", "కేటీఆర్", "హరీశ్ రావు", "హరీష్ రావు", "భట్టి విక్రమార్క",
    "ఈటల", "బండి సంజయ్", "కిషన్ రెడ్డి", "బీఆర్ఎస్", "బిఆర్ఎస్", "brs", "trs", "టీఆర్ఎస్",
    "హైడ్రా", "hydraa", "ghmc", "hmda", "తెలంగాణ", "telangana", "కాళేశ్వరం", "సింగరేణి", "యాదాద్రి"
  ];

  const apTerms = [
    "చంద్రబాబు", "పవన్ కళ్యాణ్", "పవన్", "లోకేష్", "లోకేశ్", "జగన్", "వైసీపీ", "వైసిపి",
    "ysrcp", "టీడీపీ", "టిడిపి", "tdp", "జనసేన", "janasena", "jsp", "తిరుమల", "ttd",
    "అమరావతి", "పోలవరం", "విశాఖ ఉక్కు", "ఆంధ్రప్రదేశ్", "andhra pradesh", "ఆంధ్ర"
  ];

  let tsScore = 0;
  let apScore = 0;
  for (const term of tsTerms) {
    if (text.includes(term.toLowerCase())) tsScore++;
  }
  for (const term of apTerms) {
    if (text.includes(term.toLowerCase())) apScore++;
  }

  if (tsScore > apScore && tsScore > 0) return 'Telangana';
  if (apScore > tsScore && apScore > 0) return 'Andhra Pradesh';
  return null;
};

export const isPostAllowedForState = (post: NewsPost, userState: 'Telangana' | 'Andhra Pradesh' | null): boolean => {
  if (!userState) return true;
  const postState = inferStateFromPost(post);
  if (postState && postState !== userState) return false;
  const postDistState = mapDistrictToState(post.district);
  if (postDistState && postDistState !== userState) return false;
  return true;
};

const isGlobalPost = (post: NewsPost): boolean => {
  if (post.isGlobal) return true;
  if (universalDistrictsList.some(d => d.toLowerCase() === post.district?.toLowerCase())) return true;
  if (post.category && strictlyGlobalKeywords.some(kw => post.category?.toLowerCase().includes(kw.toLowerCase()))) return true;
  if (post.categories && post.categories.some(c => strictlyGlobalKeywords.some(kw => c.toLowerCase().includes(kw.toLowerCase())))) return true;
  return false;
};

const NewsFeed: React.FC<NewsFeedProps> = ({ language, onProfileClick, currentUser, onLoadComplete, onReporterClick, initialPostId }) => {
  const hasMoreRef = useRef(true);
  
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);

  // Read News Visibility & Filtering
  const [hideReadNews, setHideReadNews] = useState<boolean>(() => {
    return localStorage.getItem('alfa_hide_read_news') === 'true';
  });
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadNewsIds());

  useEffect(() => {
    const handleReadUpdate = () => {
      setReadIds(getReadNewsIds());
    };
    window.addEventListener('alfa_read_news_updated', handleReadUpdate);
    return () => window.removeEventListener('alfa_read_news_updated', handleReadUpdate);
  }, []);

  const toggleHideRead = () => {
    const nextVal = !hideReadNews;
    setHideReadNews(nextVal);
    localStorage.setItem('alfa_hide_read_news', String(nextVal));
  };

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
                    if (Date.now() - cached.timestamp < 3 * 60 * 1000) {
                        setNews(cached.news);
                        prefCursor.current = cached.cursors.pref;
                        localCursor.current = cached.cursors.local;
                        globalCursor.current = cached.cursors.global;
                        greetingCursor.current = cached.cursors.greeting;
                        setLoading(false);
                        fetchingRef.current = false;
                        if (onLoadComplete) onLoadComplete();
                        return;
                    }
                } catch (e) {
                    console.error("Cache parse error", e);
                }
            }
        }

        // 40/30/30 MIXING LOGIC:
        let prefPromise = Promise.resolve({posts:[], cursor:null, count:0});
        
        if (explicitCategories && explicitCategories.length > 0) {
            const catsToFetch = explicitCategories.slice(0, 10);
            prefPromise = fetchStream([where('categories', 'array-contains-any', catsToFetch)], prefCursor.current, 4);
        } else if (implicitCategory) {
            prefPromise = fetchStream([where('categories', 'array-contains', implicitCategory)], prefCursor.current, 4);
        }

        const userState = mapDistrictToState(userDistrict);
        const globalDistrictsForQuery = userState === 'Andhra Pradesh'
          ? ["General", "State", "Sports", "Health", "Technology", "Business", "Entertainment", "Cinema", "National", "International", "Crime", "Education", "Agriculture", "Devotional", "Lifestyle", "AndhraPradesh", "AP", "ఆంధ్రప్రదేశ్"]
          : userState === 'Telangana'
          ? ["General", "State", "Sports", "Health", "Technology", "Business", "Entertainment", "Cinema", "National", "International", "Crime", "Education", "Agriculture", "Devotional", "Lifestyle", "Telangana", "TS", "తెలంగాణ", "Hyderabad", "హైదరాబాద్"]
          : ["General", "State", "Sports", "Health", "Technology", "Business", "Entertainment", "Cinema", "National", "International", "Crime", "Education", "Agriculture", "Devotional", "Lifestyle", "AndhraPradesh", "Telangana"];

        const [prefRes, localRes, globalRes, greetingRes] = await Promise.all([
            prefPromise,
            userDistrict ? fetchStream([where('district', '==', userDistrict)], localCursor.current, 6) : Promise.resolve({posts:[], cursor:null, count:0}),
            userDistrict ? fetchStream([where('district', 'in', globalDistrictsForQuery)], globalCursor.current, 10) : fetchStream([], globalCursor.current, 15),
            fetchStream([where('categories', 'array-contains', 'Greetings')], greetingCursor.current, 1)
        ]);

        prefCursor.current = prefRes.cursor;
        localCursor.current = localRes.cursor;
        globalCursor.current = globalRes.cursor;
        greetingCursor.current = greetingRes.cursor;

        const combinedRaw = [...prefRes.posts, ...localRes.posts, ...globalRes.posts, ...greetingRes.posts];

        let filteredRaw = combinedRaw.filter(p => {
            // 🛑 STRICT STATE ISOLATION (రెండు రాష్ట్రాల వార్తలు & ప్రాంతీయ రాజకీయాల విభజన)
            if (!isPostAllowedForState(p, userState)) return false;
            if (!userDistrict) return true;
            if (isGlobalPost(p)) return true;
            if (userDistrict && (p.district?.toLowerCase() === userDistrict.toLowerCase() || p.categories?.includes(userDistrict))) return true;
            return false;
        });

        if (filteredRaw.length === 0 && isInitial) {
            const emergencyRes = await fetchStream([], null, 15);
            if (emergencyRes.posts.length > 0) {
                filteredRaw = emergencyRes.posts;
                globalCursor.current = emergencyRes.cursor;
            }
        }

        filteredRaw.sort((a, b) => b.timestamp - a.timestamp);

        setNews(prev => {
            const seen = new Set(prev.map(p => p.id));
            const uniqueInBatch = filteredRaw.filter(p => !seen.has(p.id));
            const uniqueMap = new Map();
            uniqueInBatch.forEach(p => uniqueMap.set(p.id, p));
            
            const newPosts = Array.from(uniqueMap.values());
            const rankedNewPosts = rankPosts(newPosts, userPrefs.interests);
            
            const finalNews = isInitial ? rankedNewPosts : [...prev, ...rankedNewPosts];
            
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
  }, [initialPostId]);

  useEffect(() => {
    if (loading || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !fetchingRef.current) {
        loadMixedFeed();
      }
    }, { rootMargin: '1200px', threshold: 0 });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loading, hasMore]);

  // Read News Filter calculation
  const displayedNews = hideReadNews ? news.filter(p => !readIds.has(p.id)) : news;
  const hiddenReadCount = news.filter(p => readIds.has(p.id)).length;

  return (
    <div className="relative h-full w-full bg-black overflow-hidden flex flex-col">
      {/* Header controls */}
      <div className="absolute top-0 left-0 right-0 p-3 z-30 flex items-center justify-between drop-shadow-md bg-gradient-to-b from-black/70 via-black/40 to-transparent">
          <div className="flex items-center pointer-events-none whitespace-nowrap shrink-0">
              <span className="font-poppins font-bold text-2xl text-white">alfa</span>
              <span className="font-poppins font-semibold text-2xl text-red-600">news</span>
          </div>

          <div className="flex items-center gap-2">
              {/* Hide / Show Read News Toggle Button */}
              {hiddenReadCount > 0 && (
                <button
                  onClick={toggleHideRead}
                  className={`px-3 py-1.5 rounded-full border text-xs font-bold font-mallanna flex items-center gap-1.5 shadow-md active:scale-95 transition-all backdrop-blur-md ${
                    hideReadNews
                      ? 'bg-red-600/90 text-white border-red-500/50 animate-pulse'
                      : 'bg-white/10 text-gray-200 border-white/20 hover:bg-white/20'
                  }`}
                  title={hideReadNews ? "చదివిన వార్తలను చూపించు" : "చదివిన వార్తలను దాచు"}
                >
                  <span>{hideReadNews ? '👁️‍🗨️' : '👁️'}</span>
                  <span>{hideReadNews ? `చూపించు (${hiddenReadCount})` : 'చదివినవి దాచు'}</span>
                </button>
              )}

              <button 
                  onClick={() => setShowPreferences(true)}
                  className="p-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white shadow-lg active:scale-95 transition-transform"
              >
                  <Settings2 className="w-5 h-5" />
              </button>
          </div>
      </div>

      {loading && news.length === 0 && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black">
              <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-white font-mallanna text-xl">వార్తలు సిద్ధమవుతున్నాయి...</p>
          </div>
      )}

      <div ref={feedRef} className="flex-1 w-full overflow-y-auto snap-y snap-mandatory no-scrollbar relative z-10 bg-black overscroll-none scroll-smooth">
        {/* If all loaded posts are hidden because they are read */}
        {hideReadNews && displayedNews.length === 0 && news.length > 0 && (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center snap-start snap-always bg-black">
            <span className="text-5xl mb-3">✓</span>
            <h3 className="font-ramabhadra text-2xl text-white font-bold mb-2">అన్ని వార్తలు చదివారు!</h3>
            <p className="font-mallanna text-gray-400 text-base mb-6 max-w-xs">
              ఈ పేజీలోని {hiddenReadCount} వార్తలను మీరు ఇప్పటికే చదివారు. వాటిని మళ్లీ చూడటానికి క్రింది బటన్ క్లిక్ చేయండి.
            </p>
            <button
              onClick={toggleHideRead}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-bold font-mallanna text-base shadow-lg active:scale-95 transition-all flex items-center gap-2"
            >
              <span>👁️</span>
              <span>చదివిన వార్తలను చూపించు</span>
            </button>
          </div>
        )}

        {displayedNews.map((post, index) => {
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
