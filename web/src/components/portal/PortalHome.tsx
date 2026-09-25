import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NewsPost, User } from '../../types';
import { db } from '../../services/firebase';
import * as _firestore from 'firebase/firestore';
import PortalHeader from './PortalHeader';
import BreakingNewsTicker from './BreakingNewsTicker';
import HeadlinesSlider from './HeadlinesSlider';
import SpecialStoriesSection from './SpecialStoriesSection';
import CategorySection from './CategorySection';
import Sidebar from './Sidebar';
import ArticleViewModal from './ArticleViewModal';
import SpecialStoryModal from './SpecialStoryModal';
import PortalFooter from './PortalFooter';
import { Search, Loader2, Sparkles, Filter, RefreshCw, PenTool } from 'lucide-react';
import { formatRelativeTimeTelugu, FALLBACK_NEWS_IMAGE } from './portalUtils';

const { collection, query, where, orderBy, limit, getDocs, Timestamp, onSnapshot } = _firestore as any;

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
  const [allPosts, setAllPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPost, setSelectedPost] = useState<NewsPost | null>(null);
  const [specialStoryModalOpen, setSpecialStoryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);

  const getTs = (data: any) => {
    if (!data.timestamp) return Date.now();
    if (data.timestamp instanceof Timestamp) return data.timestamp.toMillis();
    return typeof data.timestamp === 'number' ? data.timestamp : Date.now();
  };

  // Fetch News from Firestore
  useEffect(() => {
    let isMounted = true;
    async function loadPortalNews() {
      try {
        setLoading(true);
        const newsRef = collection(db, 'news');
        // Fetch top recent approved news
        const q = query(
          newsRef,
          where('approved', '==', true),
          orderBy('timestamp', 'desc'),
          limit(100)
        );

        const snap = await getDocs(q);
        if (!isMounted) return;

        const postsList: NewsPost[] = snap.docs.map((d: any) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            timestamp: getTs(data),
          } as NewsPost;
        });

        setAllPosts(postsList);

        // Check if initialPostId was requested
        if (initialPostId) {
          const matched = postsList.find((p) => p.id === initialPostId);
          if (matched) {
            setSelectedPost(matched);
          } else {
            // Fetch directly
            try {
              const { doc, getDoc } = _firestore as any;
              const directDoc = await getDoc(doc(db, 'news', initialPostId));
              if (directDoc.exists()) {
                setSelectedPost({ id: directDoc.id, ...directDoc.data(), timestamp: getTs(directDoc.data()) } as NewsPost);
              }
            } catch (_) {}
          }
        }
      } catch (err) {
        console.error('Failed to load portal news:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPortalNews();
    return () => { isMounted = false; };
  }, [initialPostId]);

  // Check URL hash for direct /#news/postId
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/news/')) {
        const pId = hash.replace('#/news/', '');
        if (pId) {
          const found = allPosts.find((p) => p.id === pId);
          if (found) setSelectedPost(found);
        }
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [allPosts]);

  // Filtered news by Category
  const categoryPosts = useMemo(() => {
    if (selectedCategory === 'all') return allPosts;

    if (selectedCategory === 'స్పెషల్ స్టోరీస్') {
      return allPosts.filter(
        (p) =>
          p.isSpecialStory === true ||
          p.webOnly === true ||
          p.category === 'స్పెషల్ స్టోరీస్' ||
          p.categories?.includes('స్పెషల్ స్టోరీస్')
      );
    }

    return allPosts.filter((p) => {
      const cat = p.category || '';
      const cats = p.categories || [];
      const dist = p.district || '';
      const state = p.state || '';
      const target = selectedCategory.toLowerCase();

      return (
        cat.toLowerCase().includes(target) ||
        cats.some((c) => c.toLowerCase().includes(target)) ||
        dist.toLowerCase().includes(target) ||
        state.toLowerCase().includes(target)
      );
    });
  }, [allPosts, selectedCategory]);

  // Search Results
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

  // Category Buckets for Home Page
  const apPosts = useMemo(() => {
    return allPosts.filter((p) => {
      const text = `${p.category || ''} ${p.district || ''} ${p.state || ''} ${p.location || ''} ${p.categories?.join(' ') || ''}`.toLowerCase();
      return text.includes('ఆంధ్ర') || text.includes('ap') || text.includes('amaravati') || text.includes('విజయవాడ') || text.includes('విశాఖ');
    });
  }, [allPosts]);

  const tsPosts = useMemo(() => {
    return allPosts.filter((p) => {
      const text = `${p.category || ''} ${p.district || ''} ${p.state || ''} ${p.location || ''} ${p.categories?.join(' ') || ''}`.toLowerCase();
      return text.includes('తెలంగాణ') || text.includes('ts') || text.includes('hyderabad') || text.includes('హైదరాబాద్') || text.includes('వరంగల్');
    });
  }, [allPosts]);

  const politicsPosts = useMemo(() => {
    return allPosts.filter((p) => {
      const text = `${p.category || ''} ${p.categories?.join(' ') || ''}`.toLowerCase();
      return text.includes('రాజకీయ') || text.includes('జాతీయం') || text.includes('politics');
    });
  }, [allPosts]);

  const cinemaPosts = useMemo(() => {
    return allPosts.filter((p) => {
      const text = `${p.category || ''} ${p.categories?.join(' ') || ''}`.toLowerCase();
      return text.includes('సినిమా') || text.includes('వినోదం') || text.includes('entertainment');
    });
  }, [allPosts]);

  const sportsPosts = useMemo(() => {
    return allPosts.filter((p) => {
      const text = `${p.category || ''} ${p.categories?.join(' ') || ''}`.toLowerCase();
      return text.includes('స్పోర్ట్స్') || text.includes('క్రీడలు') || text.includes('sports') || text.includes('క్రికెట్');
    });
  }, [allPosts]);

  const handleStoryCreated = (newPost: NewsPost) => {
    setAllPosts((prev) => [newPost, ...prev]);
    setSelectedPost(newPost);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 flex flex-col font-mallanna selection:bg-red-100 selection:text-red-900">
      {/* 1. PORTAL HEADER */}
      <PortalHeader
        currentUser={currentUser}
        onLoginClick={onLoginClick}
        onAdminClick={onAdminClick}
        onSpecialStoryClick={() => setSpecialStoryModalOpen(true)}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSearchClick={() => setShowSearchModal(true)}
        onOpenClassifieds={onOpenClassifieds}
      />

      {/* 2. BREAKING NEWS TICKER */}
      <BreakingNewsTicker posts={allPosts} onSelectPost={(p) => setSelectedPost(p)} />

      {/* 3. MAIN PORTAL CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
            <p className="font-ramabhadra text-lg text-gray-700">వార్తలు లోడ్ అవుతున్నాయి...</p>
          </div>
        ) : selectedCategory !== 'all' ? (
          /* ========================================= */
          /* CATEGORY FILTER VIEW (When a category is clicked) */
          /* ========================================= */
          <div className="animate-fade-in">
            {/* Category Breadcrumb Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
              <div>
                <span className="text-xs text-red-600 font-semibold uppercase tracking-wider font-poppins">
                  CATEGORY VIEW
                </span>
                <h1 className="font-ramabhadra text-2xl sm:text-3xl font-bold text-gray-950 mt-0.5">
                  {selectedCategory}
                </h1>
                <p className="text-xs text-gray-500 mt-1 font-mallanna">
                  మొత్తం {categoryPosts.length} వార్తలు అందుబాటులో ఉన్నాయి.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedCategory === 'స్పెషల్ స్టోరీస్' && (
                  <button
                    onClick={() => setSpecialStoryModalOpen(true)}
                    className="bg-yellow-400 hover:bg-yellow-300 text-red-950 font-ramabhadra text-xs font-bold px-3.5 py-2 rounded-xl shadow flex items-center gap-1.5"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>+ కొత్త స్పెషల్ స్టోరీ</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-ramabhadra text-xs font-bold px-3.5 py-2 rounded-xl transition-colors"
                >
                  ← హోమ్‌కి వెళ్ళండి
                </button>
              </div>
            </div>

            {/* Grid of Medium Thumbnails */}
            {categoryPosts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {categoryPosts.map((post) => {
                  const hLine = post.headline?.telugu || post.headline?.english || '';
                  const img = post.mediaUrl || post.mediaUrls?.[0] || FALLBACK_NEWS_IMAGE;
                  return (
                    <div
                      key={post.id}
                      onClick={() => setSelectedPost(post)}
                      className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        {/* Medium-sized thumbnail */}
                        <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                          <img
                            src={img}
                            alt={hLine}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e: any) => { e.target.src = FALLBACK_NEWS_IMAGE; }}
                          />
                          {post.isSpecialStory && (
                            <span className="absolute top-2 left-2 bg-yellow-400 text-red-950 text-[10px] font-ramabhadra font-bold px-2 py-0.5 rounded shadow">
                              స్పెషల్ స్టోరీ
                            </span>
                          )}
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

                          <h3 className="font-ramabhadra text-base font-bold text-gray-900 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                            {hLine}
                          </h3>

                          <p className="font-mallanna text-xs sm:text-sm text-gray-600 line-clamp-2 mt-1.5 leading-relaxed">
                            {post.fullStory?.telugu || post.content?.telugu || ''}
                          </p>
                        </div>
                      </div>

                      <div className="px-4 pb-3">
                        <span className="text-xs font-ramabhadra text-red-600 font-semibold group-hover:underline">
                          పూర్తి వార్త చదవండి →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center text-gray-500 bg-white rounded-2xl border border-gray-200">
                <p className="font-ramabhadra text-base">ఈ వర్గంలో వార్తలు ఏవీ లేవు.</p>
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="mt-3 text-sm text-red-600 font-ramabhadra font-bold hover:underline"
                >
                  హోమ్ పేజీకి తిరిగి వెళ్లండి
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ========================================= */
          /* HOMEPAGE FULL PORTAL VIEW */
          /* ========================================= */
          <div className="space-y-8">
            {/* 1. TOP HEADLINES SLIDER & HOT NEWS */}
            <HeadlinesSlider
              posts={allPosts}
              onSelectPost={(post) => setSelectedPost(post)}
            />

            {/* 2. ⭐ SPECIAL STORIES HIGHLIGHT SECTION */}
            <SpecialStoriesSection
              posts={allPosts}
              onSelectPost={(post) => setSelectedPost(post)}
              onOpenComposer={() => setSpecialStoryModalOpen(true)}
            />

            {/* 3. MAIN CONTENT (Left 8 Cols) & SIDEBAR (Right 4 Cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN: Category-wise News Sections (8 Cols) */}
              <div className="lg:col-span-8 space-y-8">
                {/* ఆంధ్రప్రదేశ్ వార్తలు */}
                <CategorySection
                  title="ఆంధ్రప్రదేశ్ వార్తలు"
                  categoryKey="ఆంధ్రప్రదేశ్"
                  posts={apPosts}
                  onSelectPost={(post) => setSelectedPost(post)}
                  onViewMore={(cat) => setSelectedCategory(cat)}
                />

                {/* తెలంగాణ వార్తలు */}
                <CategorySection
                  title="తెలంగాణ వార్తలు"
                  categoryKey="తెలంగాణ"
                  posts={tsPosts}
                  onSelectPost={(post) => setSelectedPost(post)}
                  onViewMore={(cat) => setSelectedCategory(cat)}
                />

                {/* రాజకీయాలు & జాతీయం */}
                <CategorySection
                  title="రాజకీయం & జాతీయం"
                  categoryKey="రాజకీయాలు"
                  posts={politicsPosts}
                  onSelectPost={(post) => setSelectedPost(post)}
                  onViewMore={(cat) => setSelectedCategory(cat)}
                />

                {/* సినిమా & వినోదం */}
                <CategorySection
                  title="సినిమా & ఎంటర్‌టైన్‌మెంట్"
                  categoryKey="సినిమా"
                  posts={cinemaPosts}
                  onSelectPost={(post) => setSelectedPost(post)}
                  onViewMore={(cat) => setSelectedCategory(cat)}
                />

                {/* క్రీడలు */}
                <CategorySection
                  title="క్రీడలు & ఇతర వార్తలు"
                  categoryKey="స్పోర్ట్స్"
                  posts={sportsPosts}
                  onSelectPost={(post) => setSelectedPost(post)}
                  onViewMore={(cat) => setSelectedCategory(cat)}
                />
              </div>

              {/* RIGHT COLUMN: Sidebar (Weather, Cartoons, Poll, Trending) (4 Cols) */}
              <div className="lg:col-span-4 sticky top-28">
                <Sidebar
                  posts={allPosts}
                  onSelectPost={(post) => setSelectedPost(post)}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. ARTICLE VIEW MODAL (Full News Reader) */}
      {selectedPost && (
        <ArticleViewModal
          post={selectedPost}
          onClose={() => {
            setSelectedPost(null);
            if (window.location.hash.startsWith('#/news/')) {
              window.location.hash = '';
              window.history.replaceState(null, '', ' ');
            }
          }}
          currentUser={currentUser}
          onSelectRelatedPost={(p) => setSelectedPost(p)}
          relatedPosts={allPosts.filter((p) => p.id !== selectedPost.id).slice(0, 6)}
        />
      )}

      {/* 5. SPECIAL STORY COMPOSER MODAL */}
      {specialStoryModalOpen && (
        <SpecialStoryModal
          currentUser={currentUser}
          onClose={() => setSpecialStoryModalOpen(false)}
          onStoryCreated={handleStoryCreated}
        />
      )}

      {/* 6. SEARCH MODAL */}
      {showSearchModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center p-4 pt-16 sm:pt-24 animate-fade-in"
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
                        setSelectedPost(post);
                      }}
                      className="py-3 flex items-start gap-3 hover:bg-gray-50 p-2 rounded-xl cursor-pointer"
                    >
                      <div className="flex-1">
                        <h4 className="font-ramabhadra text-sm font-bold text-gray-900 leading-snug">
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

      {/* 7. PORTAL FOOTER */}
      <PortalFooter
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenPolicyPage={(route) => onOpenPolicyPage(route)}
        onOpenClassifieds={onOpenClassifieds}
      />
    </div>
  );
};

export default PortalHome;
