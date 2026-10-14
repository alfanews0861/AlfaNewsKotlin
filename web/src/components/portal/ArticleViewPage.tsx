import React, { useState, useEffect } from 'react';
import { NewsPost, User } from '../../types';
import { Clock, MapPin, Share2, Volume2, VolumeX, Heart, Check, Bookmark, ArrowLeft, User as UserIcon, MessageSquare, ExternalLink } from 'lucide-react';
import { formatRelativeTimeTelugu, FALLBACK_NEWS_IMAGE } from './portalUtils';
import { extractYoutubeVideoId } from '../NewsCard';
import CommentSection from '../CommentSection';
import { VerifiedBadge } from '../VerifiedBadge';
import { isReporterVerified } from '../../services/reporterVerification';
import { updatePageSeo } from '../../utils/seoManager';

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

  // Full Story Priority
  const fullStoryTelugu = post.fullStory?.telugu?.trim();
  const fullStoryEnglish = post.fullStory?.english?.trim();
  const shortContentTelugu = post.content?.telugu?.trim();
  const shortContentEnglish = post.content?.english?.trim();

  const finalHeadline = post.headline?.telugu || post.headline?.english || '';
  const finalArticleBody = fullStoryTelugu || shortContentTelugu || fullStoryEnglish || shortContentEnglish || '';
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

  // Dynamic SEO Update on Mount / Post change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    updatePageSeo({
      title: finalHeadline,
      description: finalArticleBody.slice(0, 160),
      image: image,
      url: `https://alfanews.app/#/news/${post.id}`,
      type: 'article',
      publishedTime: post.timestamp ? new Date(post.timestamp).toISOString() : new Date().toISOString(),
      author: author,
      category: category,
    });

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

  const handleShareWhatsApp = () => {
    const text = `*${finalHeadline}*\n\nపూర్తి వార్త చదవడానికి క్లిక్ చేయండి:\nhttps://alfanews.app/#/news/${post.id}\n\n- ఆల్ఫా న్యూస్ తెలుగు`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareTwitter = () => {
    const text = `${finalHeadline}\nhttps://alfanews.app/#/news/${post.id}\nvia @AlfaNewsTelugu`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = () => {
    const url = `https://alfanews.app/#/news/${post.id}`;
    navigator.clipboard.writeText(url);
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
    <article className="w-full max-w-5xl mx-auto py-4 sm:py-6 px-2 sm:px-4 animate-fade-in font-mallanna" itemScope itemType="https://schema.org/NewsArticle">
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

        {/* Full Story Paragraphs */}
        <div itemProp="articleBody" className="text-gray-800 text-base sm:text-lg leading-loose space-y-5 font-mallanna">
          {paragraphs.map((p, idx) => (
            <p key={idx} className="leading-loose text-justify text-gray-800">
              {p}
            </p>
          ))}
        </div>

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
            href="https://play.google.com/store/apps/details?id=com.alfanews.telugu"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-red-600 hover:bg-red-700 text-white font-ramabhadra text-xs px-4 py-2.5 rounded-xl shrink-0 shadow transition-colors flex items-center gap-1.5"
          >
            <span>ప్లే స్టోర్ నుండి డౌన్‌లోడ్</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Comments Section */}
        {showComments && (
          <CommentSection
            postId={post.id}
            initialCommentCount={post.comments || 0}
            currentUser={currentUser}
            onClose={() => setShowComments(false)}
            onCommentPosted={() => {}}
            onLoginRequest={() => {}}
          />
        )}
      </div>

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
    </article>
  );
};

export default ArticleViewPage;
