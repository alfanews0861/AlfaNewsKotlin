import React, { useState, useRef, useEffect } from 'react';
import { NewsPost, Language, User, AnalyticsEventType } from '../types';
import CommentSection from './CommentSection';
import html2canvas from 'html2canvas';
import { logAnalyticsEvent } from '../services/analyticsService';
import { updateInterests } from '../services/interestService';
import { Heart, MessageCircle, Share2, BookOpen, ChevronDown, X, CheckCircle2 } from 'lucide-react';

export const getReadNewsIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem('alfa_read_news_ids');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

export const markNewsAsRead = (postId: string) => {
  if (!postId) return;
  try {
    const current = getReadNewsIds();
    if (!current.has(postId)) {
      current.add(postId);
      const arr = Array.from(current).slice(-500); // Keep max 500 recent read IDs
      localStorage.setItem('alfa_read_news_ids', JSON.stringify(arr));
      window.dispatchEvent(new CustomEvent('alfa_read_news_updated', { detail: postId }));
    }
  } catch (_) {}
};

const LikeIcon = ({ filled }: { filled: boolean }) => (
  <Heart className={`h-6 w-6 transition-transform duration-300 ${filled ? 'text-red-500 fill-red-500 scale-110' : 'text-white'}`} strokeWidth={1.5} />
);

const ShareIcon = () => (
  <Share2 className="h-6 w-6 text-white" strokeWidth={1.5} />
);

const CommentIcon = () => (
  <MessageCircle className="h-6 w-6 text-white" strokeWidth={1.5} />
);

export const extractYoutubeVideoId = (url?: string | null): string | null => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  
  const match = trimmed.match(/^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/|live\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/i);
  if (match && match[1] && match[1].length === 11) {
    return match[1];
  }
  
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
};

interface NewsCardProps {
  post: NewsPost;
  language: Language;
  onProfileClick: () => void;
  currentUser: User | null;
  onCategoryClick: (category: string) => void;
  onReporterClick: (reporterId: string) => void;
}

const NewsCard: React.FC<NewsCardProps> = ({ post, language, onProfileClick, currentUser, onReporterClick }) => {
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [shareCount, setShareCount] = useState(post.shares || 0);
  const [commentCount, setCommentCount] = useState(post.comments || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showFullStory, setShowFullStory] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isRead, setIsRead] = useState<boolean>(() => getReadNewsIds().has(post.id));
  
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasScrolledToBottom = useRef(false);
  const isSkipped = useRef(true);

  const headline = language === Language.TELUGU ? (post.headline?.telugu || '') : (post.headline?.english || '');
  const content = language === Language.TELUGU ? (post.content?.telugu || '') : (post.content?.english || '');

  const fullStoryText = (language === Language.TELUGU ? post.fullStory?.telugu : post.fullStory?.english) || '';
  const hasSubstantialFullStory = Boolean(
    fullStoryText.trim() &&
    fullStoryText.trim().split(/\s+/).filter(Boolean).length >= 100 &&
    fullStoryText.trim() !== content.trim()
  );

  // Extract YouTube ID if present in youtubeUrl, mediaUrl, or mediaUrls
  const youtubeCandidate = post.youtubeUrl || 
    (post.mediaUrl && (post.mediaUrl.includes('youtu') || post.mediaType === 'video' || (post.mediaType as any) === 'VIDEO') ? post.mediaUrl : null) ||
    (post.mediaUrls?.find(u => u && u.includes('youtu')));
  const youtubeVideoId = extractYoutubeVideoId(youtubeCandidate);

  // --- FAKE COUNTERS LOGIC ---
  useEffect(() => {
    if ((post.likes === 0 || !post.likes) && post.id) {
      const fakeLikes = Math.floor(Math.random() * (180 - 40 + 1)) + 40;
      const fakeShares = Math.floor(Math.random() * (45 - 10 + 1)) + 10;
      setLikeCount(fakeLikes);
      setShareCount(fakeShares);
    }
  }, [post.id, post.likes]);

  useEffect(() => {
    const handleReadEvent = () => {
      setIsRead(getReadNewsIds().has(post.id));
    };
    window.addEventListener('alfa_read_news_updated', handleReadEvent);
    return () => window.removeEventListener('alfa_read_news_updated', handleReadEvent);
  }, [post.id]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          startTimeRef.current = Date.now();
          isSkipped.current = true;
          hasScrolledToBottom.current = false;
          
          if (videoRef.current) {
            videoRef.current.play().catch(e => console.log("Auto-play prevented", e));
          }

          // If user stays more than 2.5 seconds, mark article as read
          setTimeout(() => {
            if (startTimeRef.current && entry.isIntersecting) {
              isSkipped.current = false;
              markNewsAsRead(post.id);
              setIsRead(true);
            }
          }, 2500);

        } else {
          if (videoRef.current) {
            videoRef.current.pause();
          }
          if (startTimeRef.current) {
            const duration = (Date.now() - startTimeRef.current) / 1000;
            
            if (isSkipped.current && duration < 3) {
              logAnalyticsEvent(AnalyticsEventType.SKIP, post, currentUser?.id, duration);
            } else if (duration > 2) {
              logAnalyticsEvent(duration > 10 ? AnalyticsEventType.ENGAGED_VIEW : AnalyticsEventType.VIEW, post, currentUser?.id, duration);
              if (currentUser) updateInterests(currentUser, post);
              markNewsAsRead(post.id);
              setIsRead(true);
            }
            
            startTimeRef.current = null;
          }
        }
      });
    }, { threshold: 0.6 });

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [post, currentUser]);

  // Scroll Depth Tracking
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (hasScrolledToBottom.current) return;
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (isAtBottom) {
      hasScrolledToBottom.current = true;
      markNewsAsRead(post.id);
      setIsRead(true);
      logAnalyticsEvent(AnalyticsEventType.SCROLL_DEPTH, post, currentUser?.id);
    }
  };

  const handleLike = () => {
    if (!currentUser) { onProfileClick(); return; }
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    if (currentUser) updateInterests(currentUser, post);
    markNewsAsRead(post.id);
    setIsRead(true);
  };

  const handleShare = async () => {
    if (isSharing || !cardRef.current) return;
    setIsSharing(true);
    markNewsAsRead(post.id);
    setIsRead(true);

    const shareText = `🔴 ${headline}\n\nhttps://alfanews.app/news/${post.id}`;
    try {
      let shareFile: File | null = null;
      try {
        const canvas = await html2canvas(cardRef.current, {
          useCORS: true,
          scale: 2,
          backgroundColor: '#000000',
          logging: false,
          ignoreElements: (element: Element) => element.classList?.contains('share-ignore')
        } as any);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
        if (blob) {
          shareFile = new File([blob], `alfanews_${post.id}.jpg`, { type: 'image/jpeg' });
        }
      } catch (screenshotErr) {
        console.warn("Could not capture DOM screenshot, falling back to text:", screenshotErr);
      }

      if (shareFile && navigator.canShare && navigator.canShare({ files: [shareFile] })) {
        await navigator.share({
          files: [shareFile],
          title: headline,
          text: shareText
        });
        if (currentUser) updateInterests(currentUser, post);
      } else if (navigator.share) {
        await navigator.share({ title: 'Alfa News', text: shareText });
        if (currentUser) updateInterests(currentUser, post);
      } else {
        await navigator.clipboard.writeText(shareText);
        alert("లింక్ కాపీ చేయబడింది!");
      }
    } catch (e) {
      console.error("Share error:", e);
    } finally {
      setIsSharing(false);
    }
  };

  const formattedDate = post.timestamp ? new Date(post.timestamp).toLocaleDateString('te-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const formattedTime = post.timestamp ? new Date(post.timestamp).toLocaleTimeString('te-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

  const getSourceDisplay = (urlStr: string) => {
    try {
      const parsedUrl = new URL(urlStr);
      const hostname = parsedUrl.hostname.replace('www.', '');
      
      if (hostname.includes('twitter.com') || hostname.includes('x.com') || hostname.includes('nitter')) {
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
          const username = parts[0];
          return { label: `@${username}`, href: `https://x.com/${username}` };
        }
      }
      
      if (hostname.includes('facebook.com')) {
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
          let username = parts[0];
          if ((username === 'pages' || username === 'groups' || username === 'profile.php' || username === 'watch') && parts.length > 1) {
            username = parts[1];
          }
          return { label: `@${username}`, href: `https://facebook.com/${username}` };
        }
      }

      return { label: hostname, href: urlStr };
    } catch (e) {
      return { label: 'Source', href: urlStr };
    }
  };

  const sourceDisplay = post.originalUrl ? getSourceDisplay(post.originalUrl) : null;

  const getOptimizedImageUrl = (url: string) => {
    const DEFAULT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/alfa-news-31bf7.firebasestorage.app/o/news-media%2Fbg.png?alt=media&token=70bb37fd-c13d-4f97-84e1-11fb6c0d1061";
    if (!url || url.trim() === '') return DEFAULT_IMAGE;
    if (url.includes('wsrv.nl')) return url;
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=webp`;
  };

  if (post.type === 'greeting') {
    return (
      <>
        <div ref={cardRef} className="w-full h-full snap-start snap-always shrink-0 overflow-hidden text-white bg-black flex flex-col relative">
          <div className="absolute inset-0 w-full h-full">
            <img 
              src={getOptimizedImageUrl(post.mediaUrl)} 
              alt="Greeting" 
              className="w-full h-full object-cover object-top" 
              loading="lazy" 
              referrerPolicy="no-referrer" 
            />
          </div>

          {/* Right Action Bar */}
          <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 z-20">
            <button onClick={handleLike} className="flex flex-col items-center gap-1 group">
              <div className="p-2.5 rounded-full bg-black/30 backdrop-blur-md border border-white/10 group-active:scale-90 transition-transform">
                <LikeIcon filled={isLiked} />
              </div>
              <span className="text-[11px] font-bold text-white shadow-sm">{likeCount}</span>
            </button>
            <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1 group">
              <div className="p-2.5 rounded-full bg-black/30 backdrop-blur-md border border-white/10 group-active:scale-90 transition-transform">
                <CommentIcon />
              </div>
              <span className="text-[11px] font-bold text-white shadow-sm">{commentCount}</span>
            </button>
            <button onClick={handleShare} className="flex flex-col items-center gap-1 group">
              <div className="p-2.5 rounded-full bg-black/30 backdrop-blur-md border border-white/10 group-active:scale-90 transition-transform">
                {isSharing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <ShareIcon />}
              </div>
              <span className="text-[11px] font-bold text-white shadow-sm">{shareCount}</span>
            </button>
          </div>

          {/* Bottom Info with Read Status */}
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-16 pb-8 px-6">
            <div className="flex items-center gap-2 mb-1">
              {isRead ? (
                <span className="bg-white/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm">✓ చదివారు</span>
              ) : (
                <span className="bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm">కొత్తది</span>
              )}
            </div>
            <h2 className="text-2xl text-white font-ramabhadra leading-tight">
              {headline}
            </h2>
          </div>
        </div>

        {showComments && (
          <CommentSection 
            postId={post.id} initialCommentCount={post.comments} currentUser={currentUser}
            onClose={() => setShowComments(false)}
            onCommentPosted={() => {}}
            onLoginRequest={onProfileClick}
          />
        )}
      </>
    );
  }

  if (post.type === 'history') {
    const [date, ...descriptionParts] = content.split('\n\n');
    const description = descriptionParts.join('\n\n');
    return (
      <>
        <div ref={cardRef} className="w-full h-full snap-start snap-always shrink-0 overflow-hidden text-white bg-black flex flex-col relative border-b border-white/5">
          <div className="h-[45%] w-full relative shrink-0 overflow-hidden bg-zinc-900">
            <img src={getOptimizedImageUrl(post.mediaUrl)} alt="History" className="w-full h-full object-cover object-top" loading="lazy" referrerPolicy="no-referrer" />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent"></div>
          </div>
          <div className="flex-1 flex flex-col p-6 relative bg-black">
            <div className="flex items-center gap-2 mb-1">
              {isRead && <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md">✓ చదివారు</span>}
            </div>
            <h1 className="font-ramabhadra text-2xl leading-tight mb-2 text-white">{headline}</h1>
            <p className="text-sm text-red-500 font-bold mb-4">{date}</p>
            <p className="font-mallanna text-lg leading-[1.6] text-gray-300">{description}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div ref={cardRef} className="w-full h-full snap-start snap-always shrink-0 overflow-hidden text-white bg-black flex flex-col relative border-b border-white/5">
        {/* Top Media Section (45%) */}
        <div className="h-[45%] w-full relative shrink-0 overflow-hidden bg-zinc-900">
          {youtubeVideoId ? (
            <div className="w-full h-full relative bg-black flex items-center justify-center">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&mute=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1`}
                title={headline || "YouTube Video"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          ) : post.mediaType === 'video' ? (
            <video ref={videoRef} src={post.mediaUrl} className="w-full h-full object-cover object-top" loop muted playsInline preload="none" />
          ) : (
            <img src={getOptimizedImageUrl(post.mediaUrl)} alt="News" className="w-full h-full object-cover object-top" loading="lazy" referrerPolicy="no-referrer" />
          )}
          {/* Subtle bottom shadow on image */}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
          {sourceDisplay && (
            <a 
              href={sourceDisplay.href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="absolute bottom-2 left-2 text-[10px] text-white/70 hover:text-white transition-colors z-10 font-bold tracking-wider"
            >
              Source: {sourceDisplay.label}
            </a>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col p-4 relative overflow-hidden bg-black">
          <div className="flex h-full gap-4">
            <div className="flex-1 flex flex-col animate-slide-up overflow-hidden">
              {/* Headline with Read Distinction */}
              <h1 className={`font-ramabhadra text-xl md:text-2xl leading-tight mb-2 font-medium transition-colors ${isRead ? 'text-gray-300' : 'text-white'}`}>
                {headline}
              </h1>
              
              {/* Meta Section with Dotted Borders */}
              <div className="py-1.5 border-y border-dotted border-white/20 mb-3 flex flex-wrap items-center gap-x-2 text-[10px] font-mallanna text-gray-400">
                {/* Clear Read Indicator Badge */}
                {isRead ? (
                  <span className="bg-emerald-950/90 text-emerald-400 border border-emerald-800/80 font-bold px-1.5 py-0.5 rounded text-[9px]">
                    ✓ చదివారు
                  </span>
                ) : (
                  <span className="bg-red-600/90 text-white font-bold px-1.5 py-0.5 rounded text-[9px]">
                    కొత్తది
                  </span>
                )}

                {post.isCitizen || post.reporter?.name === 'సిటిజెన్ పోస్ట్' ? (
                  <span className="text-red-500 font-bold">
                    {language === 'te' ? 'సిటిజెన్ పోస్ట్' : 'Citizen Post'}
                  </span>
                ) : (
                  <span 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      const target = post.reporter?.id || post.reporter?.name;
                      if (target) onReporterClick(target); 
                    }} 
                    className="text-red-500 font-bold cursor-pointer hover:underline"
                  >
                    {post.reporter?.name || 'Reporter'}
                  </span>
                )}
                <span>-</span>
                <span>
                  {post.location === 'General' ? 'జనరల్' : 
                   post.location === 'India' ? 'భారతదేశం' : 
                   post.location === 'World' ? 'ప్రపంచం' : 
                   post.location || 'జనరల్'}
                </span>
                <span>-</span>
                <span>{formattedDate}</span>
                <span>-</span>
                <span>{formattedTime}</span>
              </div>
              
              {/* Full News Content */}
              <div 
                ref={contentRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto no-scrollbar pr-1 pb-24"
              >
                <p className={`font-mallanna text-base md:text-lg leading-[1.4] whitespace-pre-wrap mb-3 transition-colors ${isRead ? 'text-gray-400' : 'text-gray-200'}`}>
                  {content}
                </p>

                {/* Full Story Pill Button - Only shown when story has >= 100 words */}
                {hasSubstantialFullStory && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFullStory(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 mb-4 rounded-full bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{language === Language.TELUGU ? "పూర్తి వార్త చదవండి" : "Read Full Story"}</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
                
                {/* Tags & Entities Section */}
                {(post.tags?.length || post.entities?.people?.length || post.entities?.organizations?.length) && (
                  <div className="mt-4 space-y-3 pb-6">
                    {/* Tags */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-white/10 rounded-full text-[10px] font-mallanna text-gray-300">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Entities */}
                    {post.entities && (
                      <div className="space-y-2">
                        {post.entities.people && post.entities.people.length > 0 && (
                          <div className="flex flex-wrap gap-x-2 items-center">
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">వ్యక్తులు:</span>
                            {post.entities.people.map((p, idx) => (
                              <span key={idx} className="text-[11px] font-mallanna text-gray-400">
                                {p}{idx < post.entities!.people.length - 1 ? ',' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {post.entities.organizations && post.entities.organizations.length > 0 && (
                          <div className="flex flex-wrap gap-x-2 items-center">
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">సంస్థలు:</span>
                            {post.entities.organizations.map((o, idx) => (
                              <span key={idx} className="text-[11px] font-mallanna text-gray-400">
                                {o}{idx < post.entities!.organizations.length - 1 ? ',' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Action Bar */}
            <div className="flex flex-col items-center gap-5 justify-end pb-12 shrink-0">
              <button onClick={handleLike} className="flex flex-col items-center gap-1 group">
                <div className="p-1.5 rounded-full bg-white/5 group-active:scale-90 transition-transform">
                  <LikeIcon filled={isLiked} />
                </div>
                <span className="text-[10px] font-bold text-gray-400">{likeCount}</span>
              </button>
              <button onClick={() => setShowComments(true)} className="flex flex-col items-center gap-1 group">
                <div className="p-1.5 rounded-full bg-white/5 group-active:scale-90 transition-transform">
                  <CommentIcon />
                </div>
                <span className="text-[10px] font-bold text-gray-400">{commentCount}</span>
              </button>
              <button onClick={handleShare} className="flex flex-col items-center gap-1 group">
                <div className="p-1.5 rounded-full bg-white/5 group-active:scale-90 transition-transform">
                  {isSharing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <ShareIcon />}
                </div>
                <span className="text-[10px] font-bold text-gray-400">{shareCount}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showComments && (
        <CommentSection 
          postId={post.id} initialCommentCount={post.comments} currentUser={currentUser}
          onClose={() => setShowComments(false)}
          onCommentPosted={() => {}}
          onLoginRequest={onProfileClick}
        />
      )}

      {showFullStory && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center animate-fade-in"
          onClick={() => setShowFullStory(false)}
        >
          <div 
            className="w-full max-w-lg h-[90vh] bg-zinc-950 border-t border-white/10 rounded-t-2xl flex flex-col overflow-hidden shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar / Drag Handle */}
            <div className="flex flex-col items-center pt-2 pb-1 px-4 border-b border-white/10">
              <div className="w-10 h-1 rounded-full bg-white/20 mb-3"></div>
              <div className="w-full flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <span className="bg-red-600/20 text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded">
                    {post.category || (language === Language.TELUGU ? "ప్రత్యేక కథనం" : "Special Story")}
                  </span>
                  {post.location && (
                    <span className="text-gray-400 text-xs font-mallanna">• {post.location}</span>
                  )}
                </div>
                <button 
                  onClick={() => setShowFullStory(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Story Content */}
            <div className="flex-1 overflow-y-auto p-5 text-gray-100">
              <h1 className="font-ramabhadra text-xl md:text-2xl leading-tight mb-3 text-white">
                {headline}
              </h1>
              <div className="flex items-center gap-2 text-xs text-gray-400 pb-3 mb-3 border-b border-white/10 font-mallanna">
                <span className="text-red-400 font-bold">{post.reporter?.name || "Alfa News Desk"}</span>
                <span>|</span>
                <span>{formattedDate} {formattedTime}</span>
              </div>
              <div className="font-mallanna text-base md:text-lg leading-[1.6] space-y-3 text-gray-200 whitespace-pre-wrap">
                {post.fullStory && ((language === Language.TELUGU ? post.fullStory.telugu : post.fullStory.english) || '').trim().length > 0
                  ? (language === Language.TELUGU ? post.fullStory.telugu : post.fullStory.english)
                  : content}
              </div>
              <div className="mt-8 p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 text-xs text-gray-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{language === Language.TELUGU ? "ఆల్ఫా న్యూస్ ఎడిటోరియల్ సమగ్ర కథనం" : "Alfa News Verified Comprehensive Story"}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NewsCard;
