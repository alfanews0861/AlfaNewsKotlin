import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NewsPost, User } from '../../types';
import { db } from '../../services/firebase';
import * as _firestore from 'firebase/firestore';
import PortalHeader from './PortalHeader';
import BreakingNewsTicker from './BreakingNewsTicker';
import HeadlinesSlider from './HeadlinesSlider';
import SpecialStoriesSection from './SpecialStoriesSection';
import CategorySection from './CategorySection';
import Sidebar from './Sidebar';
import ArticleViewPage from './ArticleViewPage';
import PortalAdBanner from './PortalAdBanner';
import PortalFooter from './PortalFooter';
import Classifieds from '../Classifieds';
import { Search, Loader2, MapPin, ArrowLeft, Hash } from 'lucide-react';
import { formatRelativeTimeTelugu, FALLBACK_NEWS_IMAGE } from './portalUtils';
import {
  filterPostsByCategory,
  AP_DISTRICTS,
  TS_DISTRICTS,
  ALL_DISTRICTS,
  isDistrictMatch,
} from '../../utils/newsFilter';
import { updatePageSeo, updateHomeSeo, updateCategorySeo, updateDistrictSeo } from '../../utils/seoManager';
import { useAppRoute, navigateTo, getCategorySlug, getNewsUrl } from '../../utils/router';

const { collection, query, where, orderBy, limit, getDocs, Timestamp, doc, getDoc, startAfter } = _firestore as any;

const CATEGORY_QUERY_MAP: Record<string, string[]> = {
  'రాజకీయం': ['Politics', 'రాజకీయం'],
  'రాజకీయాలు': ['Politics', 'రాజకీయం'],
  'సినిమా': ['Cinema', 'సినిమా', 'వినోదం'],
  'వినోదం': ['Cinema', 'సినిమా', 'వినోదం'],
  'క్రీడలు': ['Sports', 'క్రీడలు'],
  'స్పోర్ట్స్': ['Sports', 'క్రీడలు'],
  'క్రైమ్': ['Crime', 'క్రైమ్'],
  'వ్యాపారం': ['Business', 'వ్యాపారం'],
  'బిజినెస్': ['Business', 'వ్యాపారం'],
  'జాతీయం': ['National', 'జాతీయం'],
  'అంతర్జాతీయం': ['International', 'అంతర్జాతీయం'],
  'టెక్నాలజీ': ['Technology', 'టెక్నాలజీ'],
  'వ్యవసాయం': ['Agriculture', 'వ్యవసాయం'],
  'ఆరోగ్యం': ['Health', 'ఆరోగ్యం'],
  'విద్య': ['Education', 'విద్య'],
  'భక్తి': ['Devotional', 'భక్తి'],
};

interface PortalHomeProps {
  currentUser: User | null;
  onLoginClick: () => void;
  onAdminClick: () => void;
  onOpenClassifieds: () => void;
  onOpenPolicyPage: (route: string) => void;
  initialPostId?: string | null;
}

export const PortalHome: React.FC<PortalHomeProps> = ({
  currentUser,
  onLoginClick,
  onAdminClick,
  onOpenClassifieds,
  onOpenPolicyPage,
  initialPostId,
}) => {
  const currentRoute = useAppRoute();
  const [allPosts, setAllPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPost, setSelectedPost] = useState<NewsPost | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [districtTab, setDistrictTab] = useState<'AP' | 'TS'>('AP');

  const [hasMoreCategory, setHasMoreCategory] = useState<boolean>(true);
  const [loadingMoreCategory, setLoadingMoreCategory] = useState<boolean>(false);
  const [hasMoreHome, setHasMoreHome] = useState<boolean>(true);
  const [loadingMoreHome, setLoadingMoreHome] = useState<boolean>(false);

  const getTs = (data: any) => {
    if (!data.timestamp) return Date.now();
    if (data.timestamp instanceof Timestamp) return data.timestamp.toMillis();
    return typeof data.timestamp === 'number' ? data.timestamp : Date.now();
  };

  // Helper to merge posts without duplicates
  const mergePosts = useCallback((newPosts: NewsPost[]) => {
    setAllPosts((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const filteredNew = newPosts.filter((p) => !existingIds.has(p.id));
      if (filteredNew.length === 0) return prev;
      return [...prev, ...filteredNew].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    });
  }, []);

  // 1. Initial Load of Portal News
  useEffect(() => {
    let isMounted = true;
    async function loadPortalNews() {
      try {
        setLoading(true);

        const targetId = initialPostId || (currentRoute.type === 'news' ? currentRoute.id : null);

        // 🛡️ Web Session Cache (3-minute TTL): Prevents search bots, crawlers, and rapid tab/back navigation from re-querying 75+ Firestore reads
        const CACHE_KEY = 'portal_home_posts_v5';
        const CACHE_TIME_KEY = 'portal_home_posts_time_v5';
        const CACHE_TTL = 3 * 60 * 1000; // 3 minutes fresh cache

        try {
          const cachedJson = sessionStorage.getItem(CACHE_KEY);
          const cachedTime = Number(sessionStorage.getItem(CACHE_TIME_KEY) || 0);
          if (cachedJson && (Date.now() - cachedTime < CACHE_TTL)) {
            const cachedPosts: NewsPost[] = JSON.parse(cachedJson);
            if (Array.isArray(cachedPosts) && cachedPosts.length > 0) {
              setAllPosts(cachedPosts);
              setLoading(false);
              if (targetId) {
                const matched = cachedPosts.find((p) => p.id === targetId);
                if (matched) {
                  setSelectedPost(matched);
                  const targetUrl = getNewsUrl(matched);
                  if (typeof window !== 'undefined' && window.location.pathname !== targetUrl && !window.location.pathname.endsWith(`--${targetId}`)) {
                    window.history.replaceState(null, '', targetUrl);
                  }
                }
              }
              return;
            }
          }
        } catch (_) {}

        const newsRef = collection(db, 'news');
        // ⚡ SERVER FAST PATH (<300ms): Fetch top 25 latest approved news and render IMMEDIATELY
        const genSnap = await getDocs(
          query(newsRef, where('approved', '==', true), orderBy('timestamp', 'desc'), limit(25))
        );

        if (!isMounted) return;

        const combinedDocs: NewsPost[] = [];
        const seenIds = new Set<string>();

        if (genSnap && !genSnap.empty) {
          genSnap.docs.forEach((d: any) => {
            if (!seenIds.has(d.id)) {
              seenIds.add(d.id);
              combinedDocs.push({
                id: d.id,
                ...d.data(),
                timestamp: getTs(d.data()),
              } as NewsPost);
            }
          });
          setAllPosts([...combinedDocs]);
          // ⚡ Dismiss loading spinner immediately in <300ms!
          setLoading(false);
        }

        // Check if targetId was requested
        if (targetId) {
          const matched = combinedDocs.find((p) => p.id === targetId);
          if (matched) {
            setSelectedPost(matched);
            const targetUrl = getNewsUrl(matched);
            if (typeof window !== 'undefined' && window.location.pathname !== targetUrl && !window.location.pathname.endsWith(`--${targetId}`)) {
              window.history.replaceState(null, '', targetUrl);
            }
          } else {
            getDoc(doc(db, 'news', targetId)).then((directDoc: any) => {
              if (directDoc.exists() && isMounted) {
                const fetched = {
                  id: directDoc.id,
                  ...directDoc.data(),
                  timestamp: getTs(directDoc.data()),
                } as NewsPost;
                setSelectedPost(fetched);
                setAllPosts((prev) => [fetched, ...prev.filter(p => p.id !== fetched.id)]);
                const targetUrl = getNewsUrl(fetched);
                if (typeof window !== 'undefined' && window.location.pathname !== targetUrl && !window.location.pathname.endsWith(`--${targetId}`)) {
                  window.history.replaceState(null, '', targetUrl);
                }
              }
            }).catch(() => {});
          }
        }

        // 🚀 Background category blending (non-blocking)
        Promise.allSettled([
          getDocs(query(newsRef, where('approved', '==', true), where('categories', 'array-contains', 'Politics'), orderBy('timestamp', 'desc'), limit(10))),
          getDocs(query(newsRef, where('approved', '==', true), where('categories', 'array-contains', 'Cinema'), orderBy('timestamp', 'desc'), limit(10))),
          getDocs(query(newsRef, where('approved', '==', true), where('categories', 'array-contains', 'Sports'), orderBy('timestamp', 'desc'), limit(10))),
          getDocs(query(newsRef, where('state', 'in', ['AP', 'Andhra Pradesh', 'Andhra']), orderBy('timestamp', 'desc'), limit(10))),
          getDocs(query(newsRef, where('state', 'in', ['TS', 'Telangana', 'TG']), orderBy('timestamp', 'desc'), limit(10))),
        ]).then((results) => {
          if (!isMounted) return;
          let added = false;
          results.forEach((res) => {
            if (res.status === 'fulfilled' && res.value && !res.value.empty) {
              res.value.docs.forEach((d: any) => {
                if (!seenIds.has(d.id)) {
                  seenIds.add(d.id);
                  combinedDocs.push({
                    id: d.id,
                    ...d.data(),
                    timestamp: getTs(d.data()),
                  } as NewsPost);
                  added = true;
                }
              });
            }
          });

          if (added) {
            combinedDocs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            setAllPosts([...combinedDocs]);
          }
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(combinedDocs.slice(0, 100)));
            sessionStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
          } catch (_) {}
        }).catch(() => {});
      } catch (err) {
        console.error('Failed to load portal news:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPortalNews();
    return () => {
      isMounted = false;
    };
  }, [initialPostId]);

  // 2. React to URL route changes (Back/Forward, direct URL entry, pushState)
  useEffect(() => {
    if (currentRoute.type === 'news') {
      const postId = currentRoute.id;
      if (selectedPost && selectedPost.id === postId) {
        const targetUrl = getNewsUrl(selectedPost);
        if (typeof window !== 'undefined' && window.location.pathname !== targetUrl && !window.location.pathname.endsWith(`--${postId}`)) {
          window.history.replaceState(null, '', targetUrl);
        }
        return;
      }
      const existing = allPosts.find((p) => p.id === postId);
      if (existing) {
        setSelectedPost(existing);
        const targetUrl = getNewsUrl(existing);
        if (typeof window !== 'undefined' && window.location.pathname !== targetUrl && !window.location.pathname.endsWith(`--${postId}`)) {
          window.history.replaceState(null, '', targetUrl);
        }
      } else {
        // Direct fetch from Firestore for deep link / refresh resilience
        getDoc(doc(db, 'news', postId)).then((snap: any) => {
          if (snap.exists()) {
            const fetched = { id: snap.id, ...snap.data(), timestamp: getTs(snap.data()) } as NewsPost;
            setAllPosts((prev) => [fetched, ...prev.filter((p) => p.id !== fetched.id)]);
            setSelectedPost(fetched);
            const targetUrl = getNewsUrl(fetched);
            if (typeof window !== 'undefined' && window.location.pathname !== targetUrl && !window.location.pathname.endsWith(`--${postId}`)) {
              window.history.replaceState(null, '', targetUrl);
            }
          } else {
            // Check localAds
            getDoc(doc(db, 'localAds', postId)).then((adSnap: any) => {
              if (adSnap.exists()) {
                const fetched = { id: adSnap.id, ...adSnap.data(), timestamp: getTs(adSnap.data()) } as NewsPost;
                setAllPosts((prev) => [fetched, ...prev.filter((p) => p.id !== fetched.id)]);
                setSelectedPost(fetched);
                const targetUrl = getNewsUrl(fetched);
                if (typeof window !== 'undefined' && window.location.pathname !== targetUrl && !window.location.pathname.endsWith(`--${postId}`)) {
                  window.history.replaceState(null, '', targetUrl);
                }
              }
            }).catch(() => {});
          }
        }).catch((err: any) => {
          console.warn('Error fetching deep-linked post:', err);
        });
      }
    } else if (currentRoute.type === 'topic') {
      if (selectedPost) setSelectedPost(null);
      setSelectedCategory(currentRoute.topic);
      updatePageSeo({
        title: `${currentRoute.topic} తాజా వార్తలు, కథనాలు`,
        description: `${currentRoute.topic} కు సంబంధించిన సమగ్ర తాజా వార్తలు, బ్రేకింగ్ అప్‌డేట్స్ మరియు విశ్లేషణలు - ఆల్ఫా న్యూస్ తెలుగు.`,
        url: `https://alfanews.app/topic/${encodeURIComponent(currentRoute.topic)}`,
        type: 'website',
        category: currentRoute.topic,
        breadcrumbs: [
          { name: 'హోమ్', url: 'https://alfanews.app/' },
          { name: `#${currentRoute.topic}`, url: `https://alfanews.app/topic/${encodeURIComponent(currentRoute.topic)}` },
        ],
      });
    } else if (currentRoute.type === 'category') {
      if (selectedPost) setSelectedPost(null);
      setSelectedCategory(currentRoute.category);
      updateCategorySeo(currentRoute.category, `/category/${currentRoute.slug}`);
    } else if (currentRoute.type === 'district') {
      if (selectedPost) setSelectedPost(null);
      setSelectedCategory(currentRoute.district);
      updateDistrictSeo(currentRoute.district, `/district/${encodeURIComponent(currentRoute.district)}`);
    } else if (currentRoute.type === 'classifieds') {
      if (selectedPost) setSelectedPost(null);
      setSelectedCategory('classifieds');
      updatePageSeo({
        title: 'ఆల్ఫా క్లాసిఫైడ్స్ - వర్గీకృత ప్రకటనలు',
        description: 'ఆల్ఫా క్లాసిఫైడ్స్ - ఉద్యోగాలు, స్థిరాస్తి, వాహనాలు, ఎలక్ట్రానిక్స్ మరియు సేవల ప్రకటనలు.',
        url: 'https://alfanews.app/classifieds',
        type: 'website',
        category: 'క్లాసిఫైడ్స్',
      });
    } else if (currentRoute.type === 'home') {
      if (selectedPost) setSelectedPost(null);
      setSelectedCategory('all');
      updateHomeSeo();
    }
  }, [currentRoute, allPosts, selectedPost]);

  // 3. User Navigation Handlers (Updates Address Bar + SEO + View State)
  const handleSelectPost = useCallback((post: NewsPost) => {
    navigateTo(getNewsUrl(post));
    setSelectedPost(post);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectCategory = useCallback((cat: string) => {
    if (cat === 'all') {
      navigateTo('/');
    } else if (cat === 'classifieds') {
      navigateTo('/classifieds');
    } else {
      navigateTo(`/category/${getCategorySlug(cat)}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectDistrict = useCallback((district: string) => {
    navigateTo(`/district/${encodeURIComponent(district)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBackFromArticle = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigateTo('/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleGoHome = useCallback(() => {
    navigateTo('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // 4. On-Demand Category / District Fetcher (Guarantees no category is empty)
  useEffect(() => {
    if (selectedCategory === 'all' || selectedCategory === 'classifieds' || selectedPost) return;

    let isMounted = true;
    async function fetchCategorySpecificNews() {
      try {
        setCategoryLoading(true);
        const newsRef = collection(db, 'news');
        let q: any = null;

        const isAp = selectedCategory === 'ఆంధ్రప్రదేశ్' || selectedCategory === 'ap';
        const isTs = selectedCategory === 'తెలంగాణ' || selectedCategory === 'ts';
        const isDistGroup = selectedCategory === 'జిల్లా వార్తలు' || selectedCategory === 'districts_menu';
        const matchedDist = ALL_DISTRICTS.find((d) => isDistrictMatch(d, selectedCategory));
        const catTags = CATEGORY_QUERY_MAP[selectedCategory];

        if (isAp) {
          try {
            const snapAp = await getDocs(
              query(
                newsRef,
                where('approved', '==', true),
                where('state', 'in', ['AP', 'Andhra Pradesh', 'Andhra']),
                orderBy('timestamp', 'desc'),
                limit(20)
              )
            );
            if (isMounted && snapAp && !snapAp.empty) {
              const fetched: NewsPost[] = snapAp.docs.map((d: any) => ({
                id: d.id,
                ...d.data(),
                timestamp: getTs(d.data()),
              } as NewsPost));
              mergePosts(fetched);
            }
          } catch (err) {
            console.warn('AP query fallback:', err);
          }
        } else if (isTs) {
          try {
            const snapTs = await getDocs(
              query(
                newsRef,
                where('approved', '==', true),
                where('state', 'in', ['TS', 'Telangana', 'TG']),
                orderBy('timestamp', 'desc'),
                limit(20)
              )
            );
            if (isMounted && snapTs && !snapTs.empty) {
              const fetched: NewsPost[] = snapTs.docs.map((d: any) => ({
                id: d.id,
                ...d.data(),
                timestamp: getTs(d.data()),
              } as NewsPost));
              mergePosts(fetched);
            }
          } catch (err) {
            console.warn('TS query fallback:', err);
          }
        } else if (matchedDist) {
          q = query(
            newsRef,
            where('approved', '==', true),
            where('district', '==', matchedDist),
            orderBy('timestamp', 'desc'),
            limit(20)
          );
        } else if (isDistGroup) {
          q = query(
            newsRef,
            where('approved', '==', true),
            where('state', '==', districtTab),
            orderBy('timestamp', 'desc'),
            limit(20)
          );
        } else if (catTags && catTags.length > 0) {
          const results = await Promise.allSettled(
            catTags.map((tag) =>
              getDocs(
                query(
                  newsRef,
                  where('approved', '==', true),
                  where('categories', 'array-contains', tag),
                  orderBy('timestamp', 'desc'),
                  limit(20)
                )
              )
            )
          );
          if (isMounted) {
            results.forEach((res) => {
              if (res.status === 'fulfilled' && res.value && !res.value.empty) {
                const fetched: NewsPost[] = res.value.docs.map((d: any) => ({
                  id: d.id,
                  ...d.data(),
                  timestamp: getTs(d.data()),
                } as NewsPost));
                mergePosts(fetched);
              }
            });
          }
        }

        if (q) {
          const snap = await getDocs(q);
          if (isMounted && snap && !snap.empty) {
            const fetchedPosts: NewsPost[] = snap.docs.map((d: any) => {
              const data = d.data();
              return {
                id: d.id,
                ...data,
                timestamp: getTs(data),
              } as NewsPost;
            });
            mergePosts(fetchedPosts);
          }
        }
      } catch (e) {
        console.warn('On-demand category fetch failed (using local posts):', e);
      } finally {
        if (isMounted) setCategoryLoading(false);
      }
    }

    fetchCategorySpecificNews();
    return () => {
      isMounted = false;
    };
  }, [selectedCategory, selectedPost, districtTab, mergePosts]);

  // 5. Filtered Posts for Category View
  const categoryPosts = useMemo(() => {
    return filterPostsByCategory(allPosts, selectedCategory);
  }, [allPosts, selectedCategory]);

  // Load More handler for Category View (Pagination through database)
  const handleLoadMoreCategory = useCallback(async () => {
    if (loadingMoreCategory || !hasMoreCategory || !categoryPosts.length) return;
    setLoadingMoreCategory(true);
    try {
      const oldestPost = categoryPosts[categoryPosts.length - 1];
      const oldestTs = oldestPost?.timestamp || Date.now();
      const newsRef = collection(db, 'news');

      const isAp = selectedCategory === 'ఆంధ్రప్రదేశ్' || selectedCategory === 'ap';
      const isTs = selectedCategory === 'తెలంగాణ' || selectedCategory === 'ts';
      const matchedDist = ALL_DISTRICTS.find((d) => isDistrictMatch(d, selectedCategory));
      const catTags = CATEGORY_QUERY_MAP[selectedCategory];

      let fetched: NewsPost[] = [];

      if (isAp) {
        const snap = await getDocs(
          query(
            newsRef,
            where('approved', '==', true),
            where('state', 'in', ['AP', 'Andhra Pradesh', 'Andhra']),
            where('timestamp', '<', oldestTs),
            orderBy('timestamp', 'desc'),
            limit(30)
          )
        );
        fetched = snap.docs.map((d: any) => ({ id: d.id, ...d.data(), timestamp: getTs(d.data()) } as NewsPost));
      } else if (isTs) {
        const snap = await getDocs(
          query(
            newsRef,
            where('approved', '==', true),
            where('state', 'in', ['TS', 'Telangana', 'TG']),
            where('timestamp', '<', oldestTs),
            orderBy('timestamp', 'desc'),
            limit(30)
          )
        );
        fetched = snap.docs.map((d: any) => ({ id: d.id, ...d.data(), timestamp: getTs(d.data()) } as NewsPost));
      } else if (matchedDist) {
        const snap = await getDocs(
          query(
            newsRef,
            where('approved', '==', true),
            where('district', '==', matchedDist),
            where('timestamp', '<', oldestTs),
            orderBy('timestamp', 'desc'),
            limit(30)
          )
        );
        fetched = snap.docs.map((d: any) => ({ id: d.id, ...d.data(), timestamp: getTs(d.data()) } as NewsPost));
      } else if (catTags && catTags.length > 0) {
        const primaryTag = catTags[0];
        const snap = await getDocs(
          query(
            newsRef,
            where('approved', '==', true),
            where('categories', 'array-contains', primaryTag),
            where('timestamp', '<', oldestTs),
            orderBy('timestamp', 'desc'),
            limit(30)
          )
        );
        fetched = snap.docs.map((d: any) => ({ id: d.id, ...d.data(), timestamp: getTs(d.data()) } as NewsPost));
      } else {
        const snap = await getDocs(
          query(
            newsRef,
            where('approved', '==', true),
            where('timestamp', '<', oldestTs),
            orderBy('timestamp', 'desc'),
            limit(30)
          )
        );
        fetched = snap.docs.map((d: any) => ({ id: d.id, ...d.data(), timestamp: getTs(d.data()) } as NewsPost));
      }

      if (fetched.length > 0) {
        mergePosts(fetched);
        if (fetched.length < 30) setHasMoreCategory(false);
      } else {
        setHasMoreCategory(false);
      }
    } catch (err) {
      console.error('Failed to load more category posts:', err);
      setHasMoreCategory(false);
    } finally {
      setLoadingMoreCategory(false);
    }
  }, [categoryPosts, hasMoreCategory, loadingMoreCategory, mergePosts, selectedCategory]);

  // Load More handler for Homepage Feed (Pagination through database)
  const handleLoadMoreHome = useCallback(async () => {
    if (loadingMoreHome || !hasMoreHome || !allPosts.length) return;
    setLoadingMoreHome(true);
    try {
      const oldestPost = allPosts[allPosts.length - 1];
      const oldestTs = oldestPost?.timestamp || Date.now();
      const newsRef = collection(db, 'news');

      const snap = await getDocs(
        query(
          newsRef,
          where('approved', '==', true),
          where('timestamp', '<', oldestTs),
          orderBy('timestamp', 'desc'),
          limit(50)
        )
      );

      if (!snap.empty) {
        const fetched: NewsPost[] = snap.docs.map((d: any) => ({
          id: d.id,
          ...d.data(),
          timestamp: getTs(d.data()),
        } as NewsPost));
        mergePosts(fetched);
        if (snap.docs.length < 50) setHasMoreHome(false);
      } else {
        setHasMoreHome(false);
      }
    } catch (err) {
      console.error('Failed to load more home posts:', err);
      setHasMoreHome(false);
    } finally {
      setLoadingMoreHome(false);
    }
  }, [allPosts, hasMoreHome, loadingMoreHome, mergePosts]);

  // Identify if in district mode
  const isDistrictCategory = selectedCategory === 'జిల్లా వార్తలు' || selectedCategory === 'districts_menu';

  // Identify state for district view breadcrumbs
  const districtState = useMemo(() => {
    if (AP_DISTRICTS.includes(selectedCategory)) return 'AP';
    if (TS_DISTRICTS.includes(selectedCategory)) return 'TS';
    if (isDistrictCategory) return districtTab;
    return null;
  }, [selectedCategory, isDistrictCategory, districtTab]);

  // Main Top Headlines for Homepage Slider (excludes hyper-local mandals, prioritizes state/national/politics/breaking)
  const mainTopPosts = useMemo(() => {
    const topPosts = allPosts.filter((p) => {
      const pAny = p as any;
      const isMandalNews = Boolean(p.mandal || pAny.assignedMandal);
      if (isMandalNews) return false;

      const isBreaking = pAny.isBreaking === true || pAny.isFlash === true;
      const isUniversal =
        p.state === 'AP' ||
        p.state === 'TS' ||
        p.state === 'Andhra Pradesh' ||
        p.state === 'Telangana' ||
        p.category === 'జాతీయం' ||
        p.category === 'రాజకీయం' ||
        p.category === 'సినిమా' ||
        p.category === 'Politics' ||
        p.category === 'National' ||
        p.category === 'Cinema' ||
        p.category === 'Crime' ||
        p.category === 'Sports' ||
        p.category === 'Business';
      const isSpecial = p.isSpecialStory === true || p.category === 'స్పెషల్ స్టోరీస్';

      return isBreaking || isUniversal || isSpecial;
    });

    return topPosts.length >= 3 ? topPosts.slice(0, 8) : allPosts.slice(0, 8);
  }, [allPosts]);

  // Search filter
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allPosts.filter((p) => {
      const hTe = p.headline?.telugu?.toLowerCase() || '';
      const hEn = p.headline?.english?.toLowerCase() || '';
      const cTe = p.content?.telugu?.toLowerCase() || '';
      const loc = p.location?.toLowerCase() || '';
      return hTe.includes(q) || hEn.includes(q) || cTe.includes(q) || loc.includes(q);
    });
  }, [allPosts, searchQuery]);

  // Section Buckets for Homepage
  const apPosts = useMemo(() => filterPostsByCategory(allPosts, 'ఆంధ్రప్రదేశ్'), [allPosts]);
  const tsPosts = useMemo(() => filterPostsByCategory(allPosts, 'తెలంగాణ'), [allPosts]);
  const politicsPosts = useMemo(() => filterPostsByCategory(allPosts, 'రాజకీయం'), [allPosts]);
  const cinemaPosts = useMemo(() => filterPostsByCategory(allPosts, 'సినిమా'), [allPosts]);
  const sportsPosts = useMemo(() => filterPostsByCategory(allPosts, 'క్రీడలు'), [allPosts]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 flex flex-col font-mallanna selection:bg-red-100 selection:text-red-900">
      {/* 1. PORTAL HEADER */}
      <PortalHeader
        currentUser={currentUser}
        onLoginClick={onLoginClick}
        onAdminClick={onAdminClick}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        onSearchClick={() => setShowSearchModal(true)}
        onOpenClassifieds={() => handleSelectCategory('classifieds')}
        onSelectDistrict={handleSelectDistrict}
      />

      {/* 2. BREAKING NEWS TICKER */}
      <BreakingNewsTicker posts={allPosts} onSelectPost={handleSelectPost} />

      {/* 3. MAIN PORTAL CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
            <p className="font-ramabhadra text-lg text-gray-700">వార్తలు లోడ్ అవుతున్నాయి...</p>
          </div>
        ) : selectedPost ? (
          /* ======================================================= */
          /* 3A. IN-BODY ARTICLE VIEW (With Right Sidebar)           */
          /* ======================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
            <div className="lg:col-span-8">
              <ArticleViewPage
                post={selectedPost}
                currentUser={currentUser}
                onBack={handleBackFromArticle}
                onSelectRelatedPost={handleSelectPost}
                relatedPosts={allPosts.filter((p) => p.id !== selectedPost.id).slice(0, 6)}
              />
            </div>
            <div className="lg:col-span-4 sticky top-28 hidden lg:block">
              <Sidebar
                posts={allPosts}
                onSelectPost={handleSelectPost}
              />
            </div>
          </div>
        ) : selectedCategory === 'classifieds' ? (
          /* ======================================================= */
          /* 3B. CLASSIFIEDS VIEW (FULL PORTAL FRAME)                */
          /* ======================================================= */
          <div className="animate-fade-in font-mallanna space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs text-red-600 font-ramabhadra mb-1">ఆల్ఫా పోర్టల్ • వర్గీకృత ప్రకటనలు</div>
                <h1 className="font-ramabhadra text-2xl sm:text-3xl text-gray-950">ఆల్ఫా క్లాసిఫైడ్స్ (Classifieds)</h1>
                <p className="text-xs text-gray-500 mt-1">ఇళ్ళు, స్థలాలు, వాహనాలు, ఉద్యోగాలు, ఎలక్ట్రానిక్స్ మరియు సేవల ప్రకటనలు</p>
              </div>
              <button
                onClick={handleGoHome}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-ramabhadra px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>హోమ్‌కి వెళ్ళండి</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-8 bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
                <Classifieds />
              </div>
              <div className="lg:col-span-4 sticky top-28">
                <Sidebar posts={allPosts} onSelectPost={handleSelectPost} />
              </div>
            </div>
          </div>
        ) : selectedCategory !== 'all' ? (
          /* ======================================================= */
          /* 3C. CATEGORY & DISTRICT VIEW (Slider + Grid + Sidebar)   */
          /* ======================================================= */
          <div className="animate-fade-in font-mallanna space-y-8">
            {/* Category / District Breadcrumb Header */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-red-600 font-ramabhadra">
                    <span>{currentRoute.type === 'topic' ? 'టాపిక్ / ట్యాగ్ వార్తలు' : 'వర్గం'}</span>
                    {(districtState || isDistrictCategory) && (
                      <>
                        <span>•</span>
                        <span>{districtTab === 'TS' ? 'తెలంగాణ జిల్లాలు' : 'ఆంధ్రప్రదేశ్ జిల్లాలు'}</span>
                      </>
                    )}
                  </div>
                  <h1 className="font-ramabhadra text-2xl sm:text-3xl text-gray-950 mt-1 flex items-center gap-2">
                    {currentRoute.type === 'topic' ? (
                      <Hash className="w-6 h-6 text-red-600 shrink-0" />
                    ) : (
                      (districtState || isDistrictCategory) && <MapPin className="w-6 h-6 text-red-600" />
                    )}
                    <span>{currentRoute.type === 'topic' ? `#${selectedCategory}` : selectedCategory}</span>
                  </h1>
                  <p className="text-xs text-gray-500 mt-1">
                    మొత్తం {categoryPosts.length} వార్తలు అందుబాటులో ఉన్నాయి.
                    {categoryLoading && ' (మరిన్ని వార్తలు అన్వేషిస్తున్నాం...)'}
                  </p>
                </div>

                <button
                  onClick={handleGoHome}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-ramabhadra px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>హోమ్‌కి వెళ్ళండి</span>
                </button>
              </div>

              {/* District Switcher Pills (If in a district view or 'జిల్లా వార్తలు') */}
              {(districtState || isDistrictCategory) && (
                <div className="mt-4 pt-3 border-t border-gray-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDistrictTab('AP')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-ramabhadra transition-all ${
                        districtTab === 'AP' ? 'bg-red-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      ఆంధ్రప్రదేశ్ ({AP_DISTRICTS.length} జిల్లాలు)
                    </button>
                    <button
                      onClick={() => setDistrictTab('TS')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-ramabhadra transition-all ${
                        districtTab === 'TS' ? 'bg-red-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      తెలంగాణ ({TS_DISTRICTS.length} జిల్లాలు)
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {(districtTab === 'AP' ? AP_DISTRICTS : TS_DISTRICTS).map((d) => (
                      <button
                        key={d}
                        onClick={() => handleSelectDistrict(d)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-ramabhadra whitespace-nowrap transition-all ${
                          selectedCategory === d
                            ? 'bg-red-600 text-white shadow-sm'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Category Top Headlines Slider & Side Hot News */}
            {categoryPosts.length >= 3 && (
              <HeadlinesSlider
                posts={categoryPosts}
                onSelectPost={handleSelectPost}
              />
            )}

            {/* 12-Column Grid: Left 8 Cols (News Grid) + Right 4 Cols (Sidebar) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-8">
                {categoryPosts.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    {categoryPosts.slice(categoryPosts.length >= 3 ? 7 : 0).map((post) => {
                      const hLine = post.headline?.telugu || post.headline?.english || '';
                      const img = post.mediaUrl || post.mediaUrls?.[0] || FALLBACK_NEWS_IMAGE;
                      return (
                        <div
                          key={post.id}
                          onClick={() => handleSelectPost(post)}
                          className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                        >
                          <div>
                            {/* 16:9 Thumbnail */}
                            <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                              <img
                                src={img}
                                alt={hLine}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                onError={(e: any) => {
                                  e.target.src = FALLBACK_NEWS_IMAGE;
                                }}
                              />
                            </div>

                            <div className="p-4">
                              <div className="flex items-center gap-2 text-xs text-gray-500 font-mallanna mb-1">
                                <span>{formatRelativeTimeTelugu(post.timestamp)}</span>
                                {post.location && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{post.location}</span>
                                  </>
                                )}
                              </div>

                              <h3 className="font-ramabhadra text-base text-gray-900 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                                {hLine}
                              </h3>

                              <p className="font-mallanna text-xs sm:text-sm text-gray-600 line-clamp-2 mt-1.5 leading-relaxed">
                                {post.content?.telugu || post.fullStory?.telugu || ''}
                              </p>
                            </div>
                          </div>

                          <div className="px-4 pb-3">
                            <span className="text-xs font-ramabhadra text-red-600 group-hover:underline">
                              పూర్తి వార్త చదవండి →
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                    {categoryPosts.length > 0 && (
                      <PortalAdBanner
                        slot="7964147976"
                        format="auto"
                        variant="in-feed"
                        className="my-6"
                      />
                    )}

                    {categoryPosts.length > 0 && hasMoreCategory && (
                      <div className="mt-8 text-center">
                        <button
                          onClick={handleLoadMoreCategory}
                          disabled={loadingMoreCategory}
                          className="inline-flex items-center gap-2 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 font-ramabhadra px-7 py-3 rounded-2xl border border-red-200 shadow-sm hover:shadow transition-all text-sm active:scale-95 disabled:opacity-60"
                        >
                          {loadingMoreCategory ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                              డేటాబేస్ నుండి మరిన్ని వార్తలు లోడ్ అవుతున్నాయి...
                            </>
                          ) : (
                            <>
                              మరిన్ని వార్తలు చూడండి (Load More News) ↓
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-16 text-center text-gray-500 bg-white rounded-2xl border border-gray-200">
                    {categoryLoading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                        <p className="font-ramabhadra text-base">వార్తలను సేకరిస్తున్నాం...</p>
                      </div>
                    ) : (
                      <>
                        <p className="font-ramabhadra text-base">
                          {currentRoute.type === 'topic'
                            ? `'#${selectedCategory}' టాపిక్‌కు సంబంధించి ప్రస్తుతానికి వార్తలు అందుబాటులో లేవు.`
                            : 'ఈ వర్గంలో వార్తలు ఏవీ లేవు.'}
                        </p>
                        <button
                          onClick={handleGoHome}
                          className="mt-3 text-sm text-red-600 font-ramabhadra hover:underline"
                        >
                          హోమ్ పేజీకి తిరిగి వెళ్లండి
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Right 4 Cols: Sidebar */}
              <div className="lg:col-span-4 sticky top-28">
                <Sidebar
                  posts={allPosts}
                  onSelectPost={handleSelectPost}
                />
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================= */
          /* 3D. HOMEPAGE FULL PORTAL VIEW                           */
          /* ======================================================= */
          <div className="space-y-8 font-mallanna">
            {/* 1. TOP HEADLINES SLIDER & HOT NEWS (Main top news only) */}
            <HeadlinesSlider
              posts={mainTopPosts}
              onSelectPost={handleSelectPost}
            />

            {/* 2. SPECIAL STORIES HIGHLIGHT SECTION (Only renders if special stories exist) */}
            <SpecialStoriesSection
              posts={allPosts}
              onSelectPost={handleSelectPost}
            />

            {/* 3. MAIN CONTENT (Left 8 Cols) & SIDEBAR (Right 4 Cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN: Category Sections (8 Cols) */}
              <div className="lg:col-span-8 space-y-8">
                {/* ఆంధ్రప్రదేశ్ వార్తలు */}
                <CategorySection
                  title="ఆంధ్రప్రదేశ్ వార్తలు"
                  categoryKey="ఆంధ్రప్రదేశ్"
                  posts={apPosts}
                  onSelectPost={handleSelectPost}
                  onViewMore={handleSelectCategory}
                />

                {/* తెలంగాణ వార్తలు */}
                <CategorySection
                  title="తెలంగాణ వార్తలు"
                  categoryKey="తెలంగాణ"
                  posts={tsPosts}
                  onSelectPost={handleSelectPost}
                  onViewMore={handleSelectCategory}
                />

                {/* Homepage In-Feed Responsive AdSense Banner */}
                <PortalAdBanner
                  slot="7964147976"
                  format="auto"
                  variant="in-feed"
                  className="my-4"
                />

                {/* రాజకీయం & జాతీయం */}
                <CategorySection
                  title="రాజకీయం & జాతీయం"
                  categoryKey="రాజకీయం"
                  posts={politicsPosts}
                  onSelectPost={handleSelectPost}
                  onViewMore={handleSelectCategory}
                />

                {/* సినిమా & వినోదం */}
                <CategorySection
                  title="సినిమా & వినోదం"
                  categoryKey="సినిమా"
                  posts={cinemaPosts}
                  onSelectPost={handleSelectPost}
                  onViewMore={handleSelectCategory}
                />

                {/* క్రీడలు */}
                <CategorySection
                  title="క్రీడలు & ఇతర వార్తలు"
                  categoryKey="క్రీడలు"
                  posts={sportsPosts}
                  onSelectPost={handleSelectPost}
                  onViewMore={handleSelectCategory}
                />

                {hasMoreHome && (
                  <div className="pt-4 text-center">
                    <button
                      onClick={handleLoadMoreHome}
                      disabled={loadingMoreHome}
                      className="inline-flex items-center gap-2 bg-white hover:bg-red-50 text-red-600 font-ramabhadra px-7 py-3 rounded-2xl border border-red-200 shadow-sm hover:shadow transition-all text-sm active:scale-95 disabled:opacity-60"
                    >
                      {loadingMoreHome ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                          మరిన్ని తాజా వార్తలను లోడ్ చేస్తున్నాం...
                        </>
                      ) : (
                        <>
                          మరిన్ని తాజా వార్తలను లోడ్ చేయండి (Load More News) ↓
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Sidebar (Weather, Cartoons, Poll, Trending) (4 Cols) */}
              <div className="lg:col-span-4 sticky top-28">
                <Sidebar
                  posts={allPosts}
                  onSelectPost={handleSelectPost}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. SEARCH MODAL */}
      {showSearchModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center p-4 pt-16 sm:pt-24 animate-fade-in font-mallanna"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ఏ వార్త గురించి వెతకాలనుకుంటున్నారు? టైప్ చేయండి..."
                autoFocus
                className="w-full text-base font-ramabhadra outline-none text-gray-900"
              />
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
              >
                ✕
              </button>
            </div>

            {searchQuery && (
              <div className="mt-4 max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                {searchResults.length > 0 ? (
                  searchResults.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => {
                        setShowSearchModal(false);
                        handleSelectPost(post);
                      }}
                      className="py-3 flex items-start gap-3 hover:bg-gray-50 p-2 rounded-xl cursor-pointer"
                    >
                      <div className="flex-1">
                        <h4 className="font-ramabhadra text-sm text-gray-900 leading-snug">
                          {post.headline?.telugu || post.headline?.english}
                        </h4>
                        <span className="text-xs text-gray-500 font-mallanna mt-0.5 block">
                          {formatRelativeTimeTelugu(post.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-gray-500 font-mallanna text-sm">
                    ఫలితాలు ఏవీ లభించలేదు.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. PORTAL FOOTER */}
      <PortalFooter
        onSelectCategory={handleSelectCategory}
        onOpenPolicyPage={(route) => onOpenPolicyPage(route)}
        onOpenClassifieds={() => handleSelectCategory('classifieds')}
      />
    </div>
  );
};

export default PortalHome;
