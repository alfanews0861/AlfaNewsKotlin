import React, { useState, useEffect } from 'react';
import { NewsPost, User, UserRole, Language } from '../../types';
import { X, Clock, MapPin, Share2, Volume2, VolumeX, Type, Sparkles, MessageCircle, Heart, Check, Bookmark, ArrowLeft, Hash, Building2, User as UserIcon } from 'lucide-react';
import { formatRelativeTimeTelugu, FALLBACK_NEWS_IMAGE } from './portalUtils';
import { extractYoutubeVideoId } from '../NewsCard';
import CommentSection from '../CommentSection';
import { VerifiedBadge } from '../VerifiedBadge';
import { isReporterVerified } from '../../services/reporterVerification';
import { getNewsUrl } from '../../utils/router';

interface ArticleViewModalProps {
  post: NewsPost;
  onClose: () => void;
  currentUser: User | null;
  onSelectRelatedPost: (post: NewsPost) => void;
  relatedPosts: NewsPost[];
}

export const ArticleViewModal: React.FC<ArticleViewModalProps> = ({
  post,
  onClose,
  currentUser,
  onSelectRelatedPost,
  relatedPosts,
}) => {
  const [fontSizeOffset, setFontSizeOffset] = useState(0); // -2, 0, +2, +4
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // 1. Full Story Priority: "vaartha poorthy vaartha ne vaadu , poorthy vaartha lekapothe maatrame short news vaadu"
  const fullStoryTelugu = post.fullStory?.telugu?.trim();
  const fullStoryEnglish = post.fullStory?.english?.trim();
  const shortContentTelugu = post.content?.telugu?.trim();
  const shortContentEnglish = post.content?.english?.trim();

  const finalHeadline = post.headline?.telugu || post.headline?.english || '';
  const finalArticleBody = fullStoryTelugu || shortContentTelugu || fullStoryEnglish || shortContentEnglish || '';
  const isUsingFullStory = Boolean(fullStoryTelugu || fullStoryEnglish);

  const image = post.mediaUrl || post.mediaUrls?.[0] || FALLBACK_NEWS_IMAGE;
  const youtubeId = extractYoutubeVideoId(post.youtubeUrl);
  const author = post.reporter?.name || 'ఆల్ఫా న్యూస్ డెస్క్';
  const category = post.category || post.categories?.[0] || 'వార్తలు';

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

  // Paragraph formatting
  const paragraphs = finalArticleBody
    .split(/\r?\n\r?\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Sync hash
  useEffect(() => {
    window.location.hash = `#/news/${post.id}`;
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [post.id]);

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

  const getShareableArticleUrl = () => {
    const activeRef = (currentUser && (currentUser.role === UserRole.REPORTER || currentUser.role === UserRole.STAFF_REPORTER) && currentUser.id && currentUser.id !== 'guest-user')
      ? currentUser.id
      : (post.reporter?.id && !post.reporter.id.startsWith('BOT_') && !post.reporter.id.startsWith('SYSTEM_') && post.reporter.id !== 'ALFA_DESK' ? post.reporter.id : null);
    const refQuery = activeRef ? `?ref=${encodeURIComponent(activeRef)}` : '';
    return `https://alfanews.app${getNewsUrl(post)}${refQuery}`;
  };

  const handleShareWhatsApp = () => {
    const articleUrl = getShareableArticleUrl();
    const text = `*${finalHeadline}*\n\nపూర్తి వార్త చదవడానికి క్లిక్ చేయండి:\n${articleUrl}\n\n- ఆల్ఫా న్యూస్ తెలుగు`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = () => {
    const articleUrl = getShareableArticleUrl();
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex justify-center p-0 sm:p-4 animate-fade-in">
      <div 
        className="bg-white w-full max-w-4xl min-h-screen sm:min-h-0 sm:my-6 rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in text-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP BAR / NAVIGATION */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-700 transition-colors flex items-center gap-1 text-sm font-ramabhadra"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">తిరిగి వెళ్ళండి</span>
            </button>
            <span className="text-gray-300">|</span>
            <span className="bg-red-50 text-red-700 border border-red-200 text-xs font-ramabhadra font-bold px-2.5 py-0.5 rounded-full">
              {category}
            </span>
            {post.isSpecialStory && (
              <span className="bg-yellow-400 text-red-950 text-xs font-ramabhadra font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3 h-3 fill-red-950" />
                స్పెషల్ స్టోరీ
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Font Size Button */}
            <button
              onClick={() => setFontSizeOffset((prev) => (prev >= 4 ? -2 : prev + 2))}
              className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-0.5 text-xs font-poppins font-bold"
              title="ఫాంట్ సైజు మార్చండి"
            >
              <Type className="w-4 h-4" />
              <span>A{fontSizeOffset > 0 ? `+${fontSizeOffset}` : fontSizeOffset < 0 ? fontSizeOffset : ''}</span>
            </button>

            {/* Audio Listen Button */}
            <button
              onClick={toggleSpeech}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-ramabhadra ${
                isSpeaking ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="వార్తను వినండి (Audio)"
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isSpeaking ? 'ఆపండి' : 'వినండి'}</span>
            </button>

            {/* WhatsApp Share */}
            <button
              onClick={handleShareWhatsApp}
              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              title="వాట్సాప్‌లో షేర్ చేయండి"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors ml-1"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* ARTICLE SCROLLABLE CONTAINER */}
        <div className="p-4 sm:p-8 flex-1 overflow-y-auto">
          {/* HEADLINE */}
          <h1 className="font-ramabhadra text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-950 leading-tight mb-4">
            {finalHeadline}
          </h1>

          {/* BYLINE & METADATA */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-gray-200 text-xs sm:text-sm text-gray-600 font-mallanna">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm shadow">
                {author.charAt(0) || 'ఆ'}
              </div>
              <div>
                <p className="font-ramabhadra text-gray-900 font-semibold text-sm flex items-center gap-1.5">
                  <span>{author}</span>
                  {isReporterVerified(post.reporter?.id, post.reporter?.name) && <VerifiedBadge size={14} />}
                </p>
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-red-500" />
                    {formatRelativeTimeTelugu(post.timestamp)}
                  </span>
                  {post.location && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-red-500" />
                        {post.location}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Indicator badge if this is full story */}
            <div className="flex items-center gap-2">
              {isUsingFullStory ? (
                <span className="bg-emerald-50 text-emerald-700 text-xs font-ramabhadra font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                  ✓ సమగ్ర కథనం
                </span>
              ) : (
                <span className="bg-gray-100 text-gray-600 text-xs font-ramabhadra px-2.5 py-0.5 rounded-full">
                  సంక్షిప్త వార్త
                </span>
              )}
            </div>
          </div>

          {/* FEATURED MEDIA (YouTube / Video / Image) */}
          <div className="mb-6 rounded-2xl overflow-hidden bg-slate-900 shadow-md">
            {youtubeId ? (
              <div className="aspect-[16/9] w-full">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0`}
                  title={finalHeadline}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : post.mediaType === 'VIDEO' || post.mediaType === 'video' ? (
              <div className="aspect-[16/9] w-full flex items-center justify-center bg-black">
                <video src={image} controls className="max-h-[500px] w-full object-contain" />
              </div>
            ) : (
              <div className="relative aspect-[16/9] w-full bg-slate-100">
                <img
                  src={image}
                  alt={finalHeadline}
                  className="w-full h-full object-cover"
                  onError={(e: any) => { e.target.src = FALLBACK_NEWS_IMAGE; }}
                />
              </div>
            )}
          </div>

          {/* ARTICLE BODY TEXT */}
          {/* Typography: "vaartha la font lu manamu vaadutunnave vaadu" -> font-mallanna */}
          <div
            className="font-mallanna text-gray-900 leading-relaxed space-y-4 my-6 select-text"
            style={{ fontSize: `${18 + fontSizeOffset}px`, lineHeight: 1.8 }}
          >
            {paragraphs.map((p, idx) => (
              <p key={idx} className="first-letter:text-2xl first-letter:font-ramabhadra first-letter:text-red-700">
                {p}
              </p>
            ))}
          </div>

          {/* Article Topics, Entities & SEO Metadata Badges */}
          {(cleanTags.length > 0 || cleanPeople.length > 0 || cleanLocations.length > 0 || cleanOrgs.length > 0) && (
            <div className="my-6 pt-4 border-t border-gray-100 space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-gray-200/80">
              {/* 1. Hashtags / Topics */}
              {cleanTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-ramabhadra text-gray-500 flex items-center gap-1 shrink-0">
                    <Hash className="w-3.5 h-3.5 text-red-600" />
                    <span>హ్యాష్ ట్యాగ్‌లు:</span>
                  </span>
                  {cleanTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center text-xs sm:text-sm font-mallanna px-2.5 py-0.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-100 transition-colors"
                    >
                      #{tag}
                    </span>
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
                    <span
                      key={idx}
                      className="inline-flex items-center text-xs sm:text-sm font-mallanna px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-100 font-medium"
                    >
                      {person}
                    </span>
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
                  {cleanLocations.map((loc, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center text-xs sm:text-sm font-mallanna px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100"
                    >
                      {loc}
                    </span>
                  ))}
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
                    <span
                      key={idx}
                      className="inline-flex items-center text-xs sm:text-sm font-mallanna px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-800 border border-purple-100"
                    >
                      {org}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ENGAGEMENT & SHARING BAR */}
          <div className="py-4 border-t border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 my-8">
            <div className="flex items-center gap-3">
              <button
                onClick={handleLike}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-ramabhadra transition-colors ${
                  isLiked
                    ? 'border-red-500 bg-red-50 text-red-600'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-600 text-red-600' : ''}`} />
                <span>{likeCount} లైక్స్</span>
              </button>

              <button
                onClick={() => setShowComments(!showComments)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-ramabhadra"
              >
                <MessageCircle className="w-4 h-4 text-blue-600" />
                <span>వ్యాఖ్యలు</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShareWhatsApp}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-ramabhadra font-bold shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>వాట్సాప్‌లో షేర్</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-xl text-xs font-ramabhadra font-bold"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Bookmark className="w-3.5 h-3.5" />}
                <span>{copied ? 'కాపీ అయింది!' : 'లింక్ కాపీ'}</span>
              </button>
            </div>
          </div>

          {/* COMMENTS SECTION (Collapsible) */}
          {showComments && (
            <div className="mb-10 bg-gray-50 p-4 sm:p-6 rounded-2xl border border-gray-200">
              <CommentSection
                postId={post.id}
                initialCommentCount={post.comments || 0}
                currentUser={currentUser}
                onClose={() => setShowComments(false)}
                onCommentPosted={() => {}}
                onLoginRequest={() => {}}
              />
            </div>
          )}

          {/* RELATED STORIES */}
          {relatedPosts.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="font-ramabhadra text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-2 h-5 bg-red-600 rounded-sm"></span>
                సంబంధిత వార్తలు
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {relatedPosts.slice(0, 3).map((rPost) => {
                  const rHeadline = rPost.headline?.telugu || rPost.headline?.english || '';
                  const rImg = rPost.mediaUrl || rPost.mediaUrls?.[0] || FALLBACK_NEWS_IMAGE;
                  return (
                    <div
                      key={rPost.id}
                      onClick={() => onSelectRelatedPost(rPost)}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="aspect-[16/9] w-full overflow-hidden bg-gray-100">
                          <img
                            src={rImg}
                            alt={rHeadline}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e: any) => { e.target.src = FALLBACK_NEWS_IMAGE; }}
                          />
                        </div>
                        <div className="p-3">
                          <h4 className="font-ramabhadra text-sm font-bold text-gray-900 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                            {rHeadline}
                          </h4>
                        </div>
                      </div>
                      <div className="p-3 pt-0 text-xs font-mallanna text-gray-500">
                        {formatRelativeTimeTelugu(rPost.timestamp)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArticleViewModal;
