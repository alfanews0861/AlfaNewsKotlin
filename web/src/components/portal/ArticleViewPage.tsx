import React, { useState, useEffect, useMemo } from 'react';
import { NewsPost, User, UserRole } from '../../types';
import { Clock, MapPin, Share2, Volume2, VolumeX, Heart, Check, Bookmark, ArrowLeft, User as UserIcon, MessageSquare, ExternalLink, Hash, Building2, X, Smartphone, Sparkles } from 'lucide-react';
import { formatRelativeTimeTelugu, FALLBACK_NEWS_IMAGE } from './portalUtils';
import { extractYoutubeVideoId } from '../NewsCard';
import CommentSection from '../CommentSection';
import { VerifiedBadge } from '../VerifiedBadge';
import { isReporterVerified } from '../../services/reporterVerification';
import { updatePageSeo } from '../../utils/seoManager';
import { getNewsUrl, navigateTo, getTopicUrl } from '../../utils/router';
import { ALL_DISTRICTS, isDistrictMatch } from '../../utils/newsFilter';
import { getPreferredPlayStoreUrl, openNativePlayStore } from '../../utils/playStoreHelper';
import { getLocalizedText, getBodyFontClass, getCollectionForEdition, resolveStateCode } from '../../data/editions';
import PortalAdBanner from './PortalAdBanner';

interface ArticleViewPageProps {
  post: NewsPost;
  onBack: () => void;
  currentUser: User | null;
  onSelectRelatedPost: (post: NewsPost) => void;
  relatedPosts: NewsPost[];
}

export const ArticleViewPage: React.FC<ArticleViewPageProps> = ({
  post,
  onBack,
  currentUser,
  onSelectRelatedPost,
  relatedPosts,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Full Story Priority across all 5 languages (te, hi, pa, gu, en)
  const postLang = (post.language as any) || 'te';
  const finalHeadline = getLocalizedText(post.headline, postLang);
  const finalArticleBody =
    getLocalizedText(post.fullStory, postLang) ||
    getLocalizedText(post.content, postLang) ||
    '';
  const image = post.mediaUrl || post.mediaUrls?.[0] || FALLBACK_NEWS_IMAGE;
  const youtubeId = extractYoutubeVideoId(post.youtubeUrl);
  const author = post.reporter?.name || 'ఆల్ఫా న్యూస్ డెస్క్';
  const category = post.category || post.categories?.[0] || 'వార్తలు';
  const isVerified = isReporterVerified(post.reporter?.id);

  // Paragraph formatting
  const paragraphs = finalArticleBody
    .split(/\r?\n\r?\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Active reporter referral tracking ID
  const activeRef = useMemo(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryRef = urlParams.get('ref');
      if (queryRef && queryRef.trim()) return queryRef.trim();
    } catch (_) {}
    if (currentUser && (currentUser.role === UserRole.REPORTER || currentUser.role === UserRole.STAFF_REPORTER) && currentUser.id && currentUser.id !== 'guest-user') {
      return currentUser.id;
    }
    const postRepId = post.reporter?.id;
    if (postRepId && !postRepId.startsWith('BOT_') && !postRepId.startsWith('SYSTEM_') && postRepId !== 'ALFA_DESK') {
      return postRepId;
    }
    return null;
  }, [post.reporter?.id, currentUser]);

  // Article URL with reporter referral query parameter for sharing
  const refQuery = activeRef ? `?ref=${encodeURIComponent(activeRef)}` : '';
  const articleUrl = `https://alfanews.app${getNewsUrl(post)}${refQuery}`;

  // App download URL with Android Intent support and referrer preservation
  const preferredPlayStoreUrl = useMemo(() => {
    return getPreferredPlayStoreUrl(post.id, activeRef);
  }, [post.id, activeRef]);

  // Attractive in-page App Download Popup after completing article reading
  const [showAppDownloadPopup, setShowAppDownloadPopup] = useState(false);
  const [popupDismissed, setPopupDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed previously in this session
    try {
      if (sessionStorage.getItem('alfa_app_popup_dismissed') === 'true') {
        setPopupDismissed(true);
        return;
      }
    } catch (_) {}

    let triggered = false;
    const handleScroll = () => {
      if (triggered || popupDismissed) return;
      const scrollPos = window.scrollY + window.innerHeight;
      const totalHeight = document.documentElement.scrollHeight;
      // Trigger when user has scrolled past 60% of the page (finishing reading the story)
      if (totalHeight > 600 && scrollPos / totalHeight >= 0.6) {
        triggered = true;
        setShowAppDownloadPopup(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Fallback: If user has been reading on the page for 10 seconds and has scrolled
    const timer = setTimeout(() => {
      if (!triggered && !popupDismissed && window.scrollY > 150) {
        triggered = true;
        setShowAppDownloadPopup(true);
      }
    }, 10000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, [popupDismissed]);

  const handleClosePopup = () => {
    setShowAppDownloadPopup(false);
    setPopupDismissed(true);
    try {
      sessionStorage.setItem('alfa_app_popup_dismissed', 'true');
    } catch (_) {}
  };

  // Clean and deduplicate SEO entity data
  const cleanTags = Array.from(new Set([
    ...(Array.isArray(post.tags) ? post.tags : []),
    ...(Array.isArray(post.keywords) ? post.keywords : [])
  ].filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim().replace(/^#/, ''))));

  const cleanPeople = Array.from(new Set((Array.isArray(post.entities?.people) ? post.entities.people : [])
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim())));

  const cleanLocations = Array.from(new Set([
    ...(Array.isArray(post.entities?.locations) ? post.entities.locations : []),
    post.location,
    post.district,
    post.mandal
  ].filter((l): l is string => typeof l === 'string' && l.trim().length > 0 && l.toLowerCase() !== 'null' && l.toLowerCase() !== 'none').map((l) => l.trim())));

  const cleanOrgs = Array.from(new Set((Array.isArray(post.entities?.organizations) ? post.entities.organizations : [])
    .filter((o): o is string => typeof o === 'string' && o.trim().length > 0).map((o) => o.trim())));

  // Dynamic SEO Update on Mount / Post change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    updatePageSeo({
      title: finalHeadline,
      description: finalArticleBody.slice(0, 160),
      image: image,
      url: articleUrl,
      type: 'article',
      publishedTime: post.timestamp ? new Date(post.timestamp).toISOString() : new Date().toISOString(),
      author: author,
      category: category,
      tags: cleanTags,
      people: cleanPeople,
      locations: cleanLocations,
      organizations: cleanOrgs,
      breadcrumbs: [
        { name: 'హోమ్', url: 'https://alfanews.app/' },
        { name: category, url: `https://alfanews.app/category/${encodeURIComponent(category)}` },
        { name: finalHeadline.slice(0, 40) + '...', url: articleUrl },
      ],
    });

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [post.id, finalHeadline, finalArticleBody, image, author, category, articleUrl]);

  // Handle Speech Synthesis
  const toggleSpeech = () => {
    if (!('speechSynthesis' in window)) {
      alert('ఈ బ్రౌజర్‌లో వాయిస్ సదుపాయం అందుబాటులో లేదు.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(`${finalHeadline}. ${finalArticleBody}`);
      utterance.lang = 'te-IN';
      utterance.rate = 0.95;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  const handleShareWhatsApp = () => {
    const text = `*${finalHeadline}*\n\nపూర్తి వార్త చదవడానికి క్లిక్ చేయండి:\n${articleUrl}\n\n- ఆల్ఫా న్యూస్ తెలుగు`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareTwitter = () => {
    const text = `${finalHeadline}\n${articleUrl}\nvia @AlfaNewsTelugu`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(articleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLike = () => {
    if (isLiked) {
      setLikeCount((prev) => Math.max(0, prev - 1));
      setIsLiked(false);
    } else {
      setLikeCount((prev) => prev + 1);
      setIsLiked(true);
    }
  };

  return (
    <article className={`w-full max-w-5xl mx-auto py-4 sm:py-6 px-2 sm:px-4 animate-fade-in ${getBodyFontClass(postLang)}`} itemScope itemType="https://schema.org/NewsArticle">
      {/* 1. Breadcrumb and Navigation */}
      <nav className="flex items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200 shadow-sm mb-6">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 overflow-x-auto no-scrollbar font-ramabhadra">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-gray-700 hover:text-red-600 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>హోమ్</span>
          </button>
          <span>/</span>
          <span className="text-red-600 shrink-0">{category}</span>
          {post.district && (
            <>
              <span>/</span>
              <span className="text-gray-700 shrink-0">{post.district}</span>
            </>
          )}
        </div>

        <button
          onClick={onBack}
          className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-ramabhadra px-3 py-1.5 rounded-xl transition-colors shrink-0"
        >
          ← వెనుకకు
        </button>
      </nav>

      {/* 2. Main Article Body Container */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 sm:p-8 md:p-10 mb-8">
        {/* Category & Location Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="bg-red-50 text-red-700 text-xs px-3 py-1 rounded-full border border-red-200 font-ramabhadra">
            {category}
          </span>
          {post.district && (
            <span className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full border border-blue-200 font-ramabhadra">
              {post.district}
            </span>
          )}
          {post.location && (
            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-200">
              <MapPin className="w-3.5 h-3.5 text-red-500" />
              <span>{post.location}</span>
            </span>
          )}
        </div>

        {/* Headline (H1) - Completely Unbolded Clean Font */}
        <h1
          itemProp="headline"
          className="font-ramabhadra text-2xl sm:text-3xl md:text-4xl text-gray-950 leading-snug sm:leading-snug mb-5"
        >
          {finalHeadline}
        </h1>

        {/* Byline & Date & Share Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-gray-100 mb-6 text-xs sm:text-sm text-gray-600">
          {/* Author info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-gray-900 font-ramabhadra">
                <span itemProp="author">{author}</span>
                {isVerified && <VerifiedBadge />}
              </div>
              <time
                itemProp="datePublished"
                dateTime={post.timestamp ? new Date(post.timestamp).toISOString() : ''}
                className="text-xs text-gray-500 font-mallanna block"
              >
                {formatRelativeTimeTelugu(post.timestamp)}
              </time>
            </div>
          </div>

          {/* Action buttons (Audio, WhatsApp, Twitter, Copy Link) */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={toggleSpeech}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-ramabhadra transition-colors"
              title="వార్తను వినండి"
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                  <span className="text-red-600">ఆపండి</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>వినండి</span>
                </>
              )}
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-xs font-ramabhadra transition-colors shadow-sm"
              title="WhatsApp లో షేర్ చేయండి"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>వాట్సాప్</span>
            </button>

            <button
              onClick={handleShareTwitter}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-ramabhadra transition-colors shadow-sm hidden sm:flex"
              title="Twitter లో షేర్ చేయండి"
            >
              <span>X (Twitter)</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-ramabhadra transition-colors"
              title="వార్త లింక్ కాపీ చేయండి"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Bookmark className="w-3.5 h-3.5" />}
              <span>{copied ? 'కాపీ అయింది' : 'కాపీ లింక్'}</span>
            </button>
          </div>
        </div>

        {/* Featured Image */}
        <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-100 mb-8 border border-gray-200 shadow-sm">
          <img
            itemProp="image"
            src={image}
            alt={finalHeadline}
            className="w-full h-full object-cover"
            onError={(e: any) => {
              e.target.src = FALLBACK_NEWS_IMAGE;
            }}
          />
        </div>

        {/* YouTube Video if present */}
        {youtubeId && (
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black mb-8 shadow-md">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title={finalHeadline}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Full Story Paragraphs with In-Article Ad & Mid-Article App Download CTA */}
        <div itemProp="articleBody" className="text-gray-800 text-base sm:text-lg leading-loose space-y-5 font-mallanna">
          {paragraphs.map((p, idx) => (
            <React.Fragment key={idx}>
              <p className="leading-loose text-justify text-gray-800">
                {p}
              </p>
              {/* Mid-Article AdSense Banner after paragraph 2 */}
              {idx === 1 && paragraphs.length > 2 && (
                <PortalAdBanner
                  slot="7964147976"
                  format="auto"
                  variant="in-article"
                />
              )}
              {/* Mid-Article App Download CTA after paragraph 3 (or short story) */}
              {(idx === 2 || (paragraphs.length <= 2 && idx === paragraphs.length - 1)) && (
                <div className="my-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-md border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img src="/app_icon.png" alt="Alfa News" className="w-12 h-12 rounded-xl object-cover shadow-sm shrink-0 border border-white/30" />
                    <div>
                      <h4 className="font-ramabhadra text-sm sm:text-base font-bold text-white">
                        మరిన్ని మీ ప్రాంత స్థానిక వార్తల కోసం Alfa News యాప్‌ను చూడండి
                      </h4>
                      <p className="font-mallanna text-xs sm:text-sm text-red-100 mt-0.5">
                        మీ గ్రామం, మండలం, జిల్లా తాజా అప్‌డేట్స్ & రాజకీయ విశ్లేషణలు క్షణాల్లో మీ ఫోన్‌లో!
                      </p>
                    </div>
                  </div>
                  <a
                    href={preferredPlayStoreUrl}
                    onClick={(e) => {
                      e.preventDefault();
                      openNativePlayStore(post.id, activeRef);
                    }}
                    className="w-full sm:w-auto text-center px-4 py-2.5 rounded-xl bg-white text-red-700 hover:bg-yellow-300 hover:text-red-900 font-ramabhadra text-xs font-bold shadow transition-all shrink-0 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>యాప్‌లో తెరవండి</span>
                  </a>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Article Topics, Entities & SEO Metadata Badges */}
        {(cleanTags.length > 0 || cleanPeople.length > 0 || cleanLocations.length > 0 || cleanOrgs.length > 0) && (
          <div className="mt-8 pt-6 border-t border-gray-100 space-y-3.5 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-gray-200/80">
            {/* 1. Hashtags / Topics */}
            {cleanTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-ramabhadra text-gray-500 flex items-center gap-1 shrink-0">
                  <Hash className="w-3.5 h-3.5 text-red-600" />
                  <span>హ్యాష్ ట్యాగ్‌లు:</span>
                </span>
                {cleanTags.map((tag, idx) => (
                  <a
                    key={idx}
                    href={getTopicUrl(tag)}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo(getTopicUrl(tag));
                    }}
                    className="inline-flex items-center text-xs sm:text-sm font-mallanna px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 hover:text-red-900 border border-red-200/80 transition-all hover:scale-105 active:scale-95 shadow-2xs cursor-pointer font-medium"
                    title={`#${tag} సంబంధిత వార్తలన్నీ చూడండి`}
                  >
                    #{tag}
                  </a>
                ))}
              </div>
            )}

            {/* 2. Key Personalities / People */}
            {cleanPeople.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-ramabhadra text-gray-500 flex items-center gap-1 shrink-0">
                  <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>వార్తలోని వ్యక్తులు:</span>
                </span>
                {cleanPeople.map((person, idx) => (
                  <a
                    key={idx}
                    href={getTopicUrl(person)}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo(getTopicUrl(person));
                    }}
                    itemProp="about"
                    itemScope
                    itemType="https://schema.org/Person"
                    className="inline-flex items-center text-xs sm:text-sm font-mallanna px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-800 hover:text-blue-950 border border-blue-200/80 font-medium transition-all hover:scale-105 active:scale-95 shadow-2xs cursor-pointer"
                    title={`${person} సంబంధిత వార్తలన్నీ చూడండి`}
                  >
                    <span itemProp="name">{person}</span>
                  </a>
                ))}
              </div>
            )}

            {/* 3. Locations / Places */}
            {cleanLocations.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-ramabhadra text-gray-500 flex items-center gap-1 shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>సంబంధిత ప్రాంతాలు:</span>
                </span>
                {cleanLocations.map((loc, idx) => {
                  const matchedDist = ALL_DISTRICTS.find((d) => isDistrictMatch(d, loc));
                  const locUrl = matchedDist ? `/district/${encodeURIComponent(matchedDist)}` : getTopicUrl(loc);
                  return (
                    <a
                      key={idx}
                      href={locUrl}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateTo(locUrl);
                      }}
                      itemProp="contentLocation"
                      itemScope
                      itemType="https://schema.org/Place"
                      className="inline-flex items-center text-xs sm:text-sm font-mallanna px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 hover:text-emerald-950 border border-emerald-200/80 font-medium transition-all hover:scale-105 active:scale-95 shadow-2xs cursor-pointer"
                      title={`${loc} ప్రాంతానికి సంబంధించిన వార్తలు చూడండి`}
                    >
                      <span itemProp="name">{loc}</span>
                    </a>
                  );
                })}
              </div>
            )}

            {/* 4. Organizations / Parties */}
            {cleanOrgs.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-ramabhadra text-gray-500 flex items-center gap-1 shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-purple-600" />
                  <span>సంస్థలు / పార్టీలు:</span>
                </span>
                {cleanOrgs.map((org, idx) => (
                  <a
                    key={idx}
                    href={getTopicUrl(org)}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo(getTopicUrl(org));
                    }}
                    itemProp="about"
                    itemScope
                    itemType="https://schema.org/Organization"
                    className="inline-flex items-center text-xs sm:text-sm font-mallanna px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-800 hover:text-purple-950 border border-purple-200/80 font-medium transition-all hover:scale-105 active:scale-95 shadow-2xs cursor-pointer"
                    title={`${org} సంస్థ/పార్టీకి సంబంధించిన వార్తలు చూడండి`}
                  >
                    <span itemProp="name">{org}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Interaction Bar (Like, Share) */}
        <div className="mt-8 pt-5 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-ramabhadra transition-all ${
                isLiked
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-600 text-red-600' : ''}`} />
              <span>{likeCount} లైక్స్</span>
            </button>

            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-ramabhadra transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>కామెంట్లు</span>
            </button>
          </div>

          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 text-green-600 hover:text-green-700 text-sm font-ramabhadra transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>షేర్ చేయండి</span>
          </button>
        </div>

        {/* App Promo Banner */}
        <div className="mt-8 p-5 bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 border border-red-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img src="/app_icon.png" alt="Alfa News App" className="w-12 h-12 rounded-2xl object-cover shadow-sm shrink-0" />
            <div>
              <h4 className="font-ramabhadra text-base text-gray-950">
                ఆల్ఫా న్యూస్ మొబైల్ యాప్‌లో మరింత వేగంగా వార్తలు చదవండి!
              </h4>
              <p className="font-mallanna text-xs sm:text-sm text-gray-600 mt-0.5">
                మీ గ్రామం, మండలం మరియు జిల్లా తాజా వార్తలు ప్రత్యక్ష నోటిఫికేషన్ల ద్వారా పొందండి.
              </p>
            </div>
          </div>
          <a
            href={preferredPlayStoreUrl}
            onClick={(e) => {
              e.preventDefault();
              openNativePlayStore(post.id, activeRef);
            }}
            className="bg-red-600 hover:bg-red-700 text-white font-ramabhadra text-xs px-4 py-2.5 rounded-xl shrink-0 shadow transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>ప్లే స్టోర్ నుండి డౌన్‌లోడ్</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Comments Section */}
        {showComments && (
          <CommentSection
            postId={post.id}
            collectionName={getCollectionForEdition(resolveStateCode((post as any).stateCode || post.state, post.district) || 'AP', (post as any).language)}
            initialCommentCount={post.comments || 0}
            currentUser={currentUser}
            onClose={() => setShowComments(false)}
            onCommentPosted={() => {}}
            onLoginRequest={() => {}}
          />
        )}
      </div>

      {/* Pre-Related Stories Responsive Ad Banner */}
      <PortalAdBanner
        slot="7964147976"
        format="auto"
        variant="in-feed"
        className="mb-8"
      />

      {/* 3. Related Stories Section */}
      {relatedPosts.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-ramabhadra text-xl text-gray-950">
              సంబంధిత వార్తలు (Related Stories)
            </h3>
            <button
              onClick={onBack}
              className="text-xs text-red-600 font-ramabhadra hover:underline"
            >
              మరిన్ని వార్తలు చూడండి →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {relatedPosts.slice(0, 6).map((rp) => {
              const rpHLine = rp.headline?.telugu || rp.headline?.english || '';
              const rpImg = rp.mediaUrl || rp.mediaUrls?.[0] || FALLBACK_NEWS_IMAGE;
              return (
                <div
                  key={rp.id}
                  onClick={() => onSelectRelatedPost(rp)}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                      <img
                        src={rpImg}
                        alt={rpHLine}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e: any) => {
                          e.target.src = FALLBACK_NEWS_IMAGE;
                        }}
                      />
                    </div>
                    <div className="p-4">
                      <div className="text-xs text-gray-500 font-mallanna mb-1">
                        {formatRelativeTimeTelugu(rp.timestamp)}
                      </div>
                      <h4 className="font-ramabhadra text-sm text-gray-900 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                        {rpHLine}
                      </h4>
                    </div>
                  </div>
                  <div className="px-4 pb-3">
                    <span className="text-xs font-ramabhadra text-red-600 group-hover:underline">
                      చదవండి →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. ATTRACTIVE POST-READING APP DOWNLOAD MODAL / DIALOG */}
      {showAppDownloadPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={handleClosePopup}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top decorative gradient header */}
            <div className="relative bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-6 text-white text-center pb-8">
              <button
                onClick={handleClosePopup}
                className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="మూసివేయండి"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-[11px] font-ramabhadra mb-3 backdrop-blur-xs">
                <Sparkles className="w-3 h-3 text-yellow-300" />
                <span>ఆల్ఫా న్యూస్ స్పెషల్</span>
              </div>

              <img
                src="/app_icon.png"
                alt="Alfa News App"
                className="w-16 h-16 rounded-2xl mx-auto shadow-lg object-cover border-2 border-white/40 mb-3"
              />

              <h3 className="font-ramabhadra text-lg sm:text-xl text-white leading-snug px-2">
                మరిన్ని మీ ప్రాంత స్థానిక వార్తలకు, రాజకీయ విశ్లేషణలకు మన Alfa News యాప్‌ను ఇప్పుడే డౌన్‌లోడ్ చేసుకోండి!
              </h3>
            </div>

            {/* Feature Highlights */}
            <div className="p-6 pt-5 bg-white">
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    ⚡
                  </div>
                  <div>
                    <h5 className="font-ramabhadra text-xs sm:text-sm text-gray-900 font-semibold">
                      మీ గ్రామం, మండలం, జిల్లా వార్తలు
                    </h5>
                    <p className="font-mallanna text-xs text-gray-500">
                      స్థానిక సమస్యలు, అభివృద్ధి పనులు, బ్రేకింగ్ అప్‌డేట్స్ తక్షణమే పొందండి.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    🗳️
                  </div>
                  <div>
                    <h5 className="font-ramabhadra text-xs sm:text-sm text-gray-900 font-semibold">
                      నిష్పాక్షిక రాజకీయ విశ్లేషణలు
                    </h5>
                    <p className="font-mallanna text-xs text-gray-500">
                      ఆంధ్రప్రదేశ్, తెలంగాణ రాజకీయ పరిణామాలపై ప్రత్యేక పరిశోధనాత్మక కథనాలు.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    🔔
                  </div>
                  <div>
                    <h5 className="font-ramabhadra text-xs sm:text-sm text-gray-900 font-semibold">
                      వేగవంతమైన లైవ్ అలర్ట్స్
                    </h5>
                    <p className="font-mallanna text-xs text-gray-500">
                      అతి తక్కువ డేటాతో తేలికగా, వేగంగా పనిచేసే మొబైల్ అనుభవం.
                    </p>
                  </div>
                </div>
              </div>

              {/* Primary Call-to-Action with Android Intent */}
              <a
                href={preferredPlayStoreUrl}
                onClick={(e) => {
                  e.preventDefault();
                  openNativePlayStore(post.id, activeRef);
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-ramabhadra text-sm font-bold shadow-lg shadow-red-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>📲 ప్లే స్టోర్ నుండి యాప్ డౌన్‌లోడ్ చేసుకోండి</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};

export default ArticleViewPage;
