import React, { useState, useRef, useEffect } from 'react';
import { NewsPost, Language, User, AnalyticsEventType } from '../types';
import CommentSection from './CommentSection';
import html2canvas from 'html2canvas';
import { logAnalyticsEvent } from '../services/analyticsService';
import { updateInterests } from '../services/interestService';
import { Heart, MessageCircle, Share2, BookOpen, ChevronDown, ChevronUp, X, CheckCircle2 } from 'lucide-react';

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
  const rawContent = language === Language.TELUGU ? (post.content?.telugu || '') : (post.content?.english || '');

  // 🛡️ Automatic Language Recovery: If Telugu is active but content is in English,
  // recover Telugu text from fullStory.telugu first paragraph if available.
  const content = React.useMemo(() => {
    if (language === Language.TELUGU && post.fullStory?.telugu) {
      const engCount = (rawContent.match(/[a-zA-Z]/g) || []).length;
      const telCount = (rawContent.match(/[\u0C00-\u0C7F]/g) || []).length;
      if (engCount > 25 && engCount > telCount * 2) {
        const firstPara = post.fullStory.telugu.split(/\r?\n\r?\n/)[0].trim();
        if (firstPara) return firstPara;
      }
    }
    return rawContent;
  }, [language, rawContent, post.fullStory?.telugu]);

  const fullStoryText = (language === Language.TELUGU ? post.fullStory?.telugu : post.fullStory?.english) || '';
  const fullStoryWords = fullStoryText.trim().split(/\s+/).filter(Boolean).length;
  const contentWords = content.trim().split(/\s+/).filter(Boolean).length;
  const isReporterPost = post.isReporter === true || (Boolean(post.reporter) && post.reporter?.name !== 'సిటిజెన్ పోస్ట్');

  // 🌟 STRICT LENGTH GATE: షార్ట్ న్యూస్ కి, పూర్తి కథనానికి మధ్య కనీసం 80-100 పదాలు/అక్షరాల వ్యత్యాసం ఉండాలి.
  // కేవలం పేరాలుగా విడదీసినా ఒకే టెక్స్ట్ అయితే బటన్ ఎట్టి పరిస్థితుల్లోనూ చూపించకూడదు.
  const hasSubstantialFullStory = Boolean(
    fullStoryText.trim() &&
    fullStoryWords >= 90 &&
    fullStoryText.replace(/\s+/g, ' ').trim() !== content.replace(/\s+/g, ' ').trim() &&
    fullStoryWords >= (contentWords + 30) &&
    fullStoryText.length >= (content.length + 100)
  );

  const storyScrollRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0);
  const scrollStartTopRef = useRef<number>(0);
  const isAtBottomStartRef = useRef<boolean>(false);
  const isAtTopStartRef = useRef<boolean>(false);

  const handleStoryTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    touchStartYRef.current = touch.clientY;
    touchStartXRef.current = touch.clientX;
    const el = storyScrollRef.current;
    if (el) {
      scrollStartTopRef.current = el.scrollTop;
      isAtTopStartRef.current = el.scrollTop <= 15;
      isAtBottomStartRef.current = el.scrollHeight - (el.scrollTop + el.clientHeight) <= 30;
    }
  };

  const handleStoryTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    const deltaY = touch.clientY - touchStartYRef.current;
    const deltaX = touch.clientX - touchStartXRef.current;
    const el = storyScrollRef.current;

    // Check if vertical motion is dominant and exceeds minimum swipe threshold (45px)
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 45) {
      // 1. Swipe DOWN to close when at top
      if (deltaY > 45 && (isAtTopStartRef.current || (el && el.scrollTop <= 15))) {
        setShowFullStory(false);
        return;
      }

      // 2. Swipe UP to close when at bottom (after reading through)
      const isCurrentlyAtBottom = el ? el.scrollHeight - (el.scrollTop + el.clientHeight) <= 30 : false;
      if (deltaY < -45 && (isAtBottomStartRef.current || isCurrentlyAtBottom)) {
        setShowFullStory(false);
        return;
      }
    }
  };

  // Split story into 3-4 clean, readable paragraphs
  const getStoryParagraphs = (rawText: string): string[] => {
    if (!rawText || !rawText.trim()) return [];

    // 1. If text has explicit double newline / newline separation
    const splitByNewlines = rawText
      .split(/\n\s*\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (splitByNewlines.length >= 2) {
      return splitByNewlines;
    }

    // 2. Fallback for single clump text (legacy/unformatted stories):
    // Split cleanly at Telugu/English sentence boundaries (. ! ? ।)
    const cleanText = rawText.replace(/\s+/g, ' ').trim();
    const sentences = cleanText.split(/(?<=[.!?।])\s*/).map(s => s.trim()).filter(Boolean);

    if (sentences.length >= 4) {
      const k = 4;
      const result: string[] = [];
      const baseSize = Math.floor(sentences.length / k);
      const remainder = sentences.length % k;
      let start = 0;
      for (let i = 0; i < k; i++) {
        const chunkSize = baseSize + (i < remainder ? 1 : 0);
        if (chunkSize > 0 && start < sentences.length) {
          result.push(sentences.slice(start, start + chunkSize).join(' '));
          start += chunkSize;
        }
      }
      return result.length > 0 ? result : [cleanText];
    } else if (sentences.length === 3) {
      return sentences;
    } else if (sentences.length === 2) {
      return sentences;
    } else if (sentences.length === 1 && sentences[0].length > 180) {
      const clauses = sentences[0].split(/(?<=[,;—–])\s+/).map(c => c.trim()).filter(Boolean);
      if (clauses.length >= 3) {
        const k = 3;
        const result: string[] = [];
        const baseSize = Math.floor(clauses.length / k);
        const remainder = clauses.length % k;
        let start = 0;
        for (let i = 0; i < k; i++) {
          const chunkSize = baseSize + (i < remainder ? 1 : 0);
          if (chunkSize > 0 && start < clauses.length) {
            result.push(clauses.slice(start, start + chunkSize).join(' '));
            start += chunkSize;
          }
        }
        return result;
      } else if (clauses.length === 2) {
        return clauses;
      }
    }

    return [cleanText];
  };

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

  const handleFullStoryShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    const storyParas = getStoryParagraphs(
      post.fullStory && ((language === Language.TELUGU ? post.fullStory.telugu : post.fullStory.english) || '').trim().length > 0
        ? (language === Language.TELUGU ? post.fullStory.telugu : post.fullStory.english)
        : content
    );
    const fullStoryBody = storyParas.join("\n\n");
    const deepLinkUrl = `https://alfanews.app/news/${post.id}`;
    const footer = language === Language.TELUGU 
      ? `📲 మరిన్ని తాజా స్థానిక వార్తలకు ఇప్పుడే డౌన్‌లోడ్ చేసుకోండి ఆల్ఫా న్యూస్:\n${deepLinkUrl}`
      : `📲 For more latest local news, download Alfa News now:\n${deepLinkUrl}`;
    const shareText = `🔴 ${headline}\n\n${fullStoryBody}\n\n${footer}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: headline,
          text: shareText
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert(language === Language.TELUGU ? "పూర్తి వార్త లింక్ కాపీ చేయబడింది!" : "Full story copied to clipboard!");
      }
    } catch (e) {
      console.error("Full story share error:", e);
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
          <div className="h-[45%] w-full relative shrink-0 overflow-hidden bg-zinc-950 flex items-center justify-center">
            <img 
              src={getOptimizedImageUrl(post.mediaUrl)} 
              alt="" 
              aria-hidden="true" 
              className="absolute inset-0 w-full h-full object-cover blur-xl opacity-30 pointer-events-none scale-110" 
              loading="lazy" 
              referrerPolicy="no-referrer" 
            />
            <img 
              src={getOptimizedImageUrl(post.mediaUrl)} 
              alt="History" 
              className="w-full h-full object-cover md:object-contain object-center relative z-0" 
              loading="lazy" 
              referrerPolicy="no-referrer" 
            />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10"></div>
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
        <div className="h-[45%] w-full relative shrink-0 overflow-hidden bg-zinc-950 flex items-center justify-center">
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
            <>
              <video 
                src={post.mediaUrl} 
                className="absolute inset-0 w-full h-full object-cover blur-xl opacity-30 pointer-events-none scale-110" 
                muted 
                playsInline 
              />
              <video 
                ref={videoRef} 
                src={post.mediaUrl} 
                className="w-full h-full object-cover md:object-contain object-center relative z-0" 
                loop 
                muted 
                playsInline 
                preload="none" 
              />
            </>
          ) : (
            <>
              <img 
                src={getOptimizedImageUrl(post.mediaUrl)} 
                alt="" 
                aria-hidden="true" 
                className="absolute inset-0 w-full h-full object-cover blur-xl opacity-30 pointer-events-none scale-110" 
                loading="lazy" 
                referrerPolicy="no-referrer" 
              />
              <img 
                src={getOptimizedImageUrl(post.mediaUrl)} 
                alt="News" 
                className="w-full h-full object-cover md:object-contain object-center relative z-0" 
                loading="lazy" 
                referrerPolicy="no-referrer" 
              />
            </>
          )}
          {/* Subtle bottom shadow on image */}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10"></div>
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
            className="w-full max-w-lg h-[85vh] bg-zinc-950 border-t border-white/10 rounded-t-2xl flex flex-col overflow-hidden shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {/* Top Bar / Drag Handle */}
            <div 
              className="flex flex-col items-center pt-2 pb-1 px-4 border-b border-white/10 select-none cursor-pointer"
              onTouchStart={(e) => {
                touchStartYRef.current = e.touches[0].clientY;
                touchStartXRef.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
                const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
                if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 35) {
                  setShowFullStory(false);
                }
              }}
            >
              <div className="w-10 h-1 rounded-full bg-white/30 mb-3"></div>
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
                  className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Story Content */}
            <div 
              ref={storyScrollRef}
              onTouchStart={handleStoryTouchStart}
              onTouchEnd={handleStoryTouchEnd}
              className="flex-1 overflow-y-auto p-5 text-gray-100 no-scrollbar"
            >
              <h1 className="font-ramabhadra text-xl md:text-2xl leading-tight mb-3 text-white">
                {headline}
              </h1>
              <div className="flex items-center gap-2 text-xs text-gray-400 pb-3 mb-3 border-b border-white/10 font-mallanna">
                <span className="text-red-400 font-bold">{post.reporter?.name || "Alfa News Desk"}</span>
                <span>|</span>
                <span>{formattedDate} {formattedTime}</span>
              </div>

              {/* Media (Photo / Video) below Headline & Meta */}
              {youtubeVideoId ? (
                <div className="mb-4 rounded-xl overflow-hidden border border-white/10 bg-black aspect-video shadow-md">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=0&mute=0&playsinline=1&rel=0&modestbranding=1`}
                    title={headline || "YouTube Video"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              ) : post.mediaType === 'video' && post.mediaUrl ? (
                <div className="mb-4 rounded-xl overflow-hidden border border-white/10 bg-black shadow-md">
                  <video src={post.mediaUrl} controls className="w-full max-h-72 object-cover" playsInline />
                </div>
              ) : post.mediaUrl ? (
                <div className="mb-4 rounded-xl overflow-hidden border border-white/10 bg-zinc-900 shadow-md">
                  <img 
                    src={getOptimizedImageUrl(post.mediaUrl)} 
                    alt={headline} 
                    className="w-full max-h-72 object-cover object-top" 
                    loading="lazy" 
                    referrerPolicy="no-referrer" 
                  />
                  {sourceDisplay && (
                    <div className="px-3 py-1.5 bg-black/70 text-[10px] text-gray-400 font-mallanna flex items-center justify-between">
                      <span>మూలం: {sourceDisplay.label}</span>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Full Story Paragraphs (3-4 paragraphs) */}
              <div className="font-mallanna text-base md:text-lg leading-[1.7] space-y-4 text-gray-200">
                {getStoryParagraphs(
                  post.fullStory && ((language === Language.TELUGU ? post.fullStory.telugu : post.fullStory.english) || '').trim().length > 0
                    ? (language === Language.TELUGU ? post.fullStory.telugu : post.fullStory.english)
                    : content
                ).map((para, idx) => (
                  <p key={idx} className="leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>

              {/* Verified Editorial Badge - Only shown when there is genuine full story */}
              {hasSubstantialFullStory && (
                <div className="mt-8 p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{language === Language.TELUGU ? "ఆల్ఫా న్యూస్ ఎడిటోరియల్ సమగ్ర కథనం" : "Alfa News Verified Comprehensive Story"}</span>
                </div>
              )}

              {/* WhatsApp-styled Share Button */}
              <button
                onClick={handleFullStoryShare}
                className="w-full mt-6 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.98] text-white font-bold flex items-center justify-center gap-2.5 shadow-lg transition-all"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01C17.18 3.03 14.69 2 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42 1.55 1.56 2.41 3.63 2.41 5.83 0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32C4.24 14.99 3.8 13.47 3.8 11.91c.01-4.54 3.7-8.24 8.25-8.24zM8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.22.89 2.39 1.01 2.56.13.17 1.75 2.67 4.23 3.73.59.26 1.04.41 1.4.53.59.19 1.13.16 1.56.1.48-.07 1.48-.6 1.69-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.28-.24-.13-1.44-.72-1.66-.8-.23-.08-.39-.12-.55.12-.17.25-.64.8-.79.96-.14.17-.29.19-.53.07-.24-.13-1.03-.38-1.96-1.21-.73-.65-1.22-1.45-1.36-1.69-.14-.25-.02-.38.11-.5.11-.12.25-.3.37-.44.12-.14.16-.24.24-.4.08-.17.04-.3-.02-.43-.06-.12-.55-1.32-.76-1.82-.2-.48-.41-.42-.56-.42-.15-.01-.32-.01-.56-.1z"/>
                </svg>
                <span>{language === Language.TELUGU ? "వాట్సాప్‌లో షేర్ చేయండి" : "Share on WhatsApp"}</span>
              </button>

              {/* AdMob Box Ad (Medium Rectangle 300x250) after story ends */}
              <div className="mt-6 pt-2 pb-12 flex flex-col items-center justify-center select-none">
                <div className="w-[300px] h-[250px] rounded-xl bg-zinc-900/90 border border-white/10 flex flex-col items-center justify-between p-3.5 relative overflow-hidden shadow-xl">
                  {/* Background decoration */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-red-600/5 pointer-events-none" />
                  
                  {/* Top Bar with Ad Label */}
                  <div className="w-full flex items-center justify-between z-10">
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase">
                      ప్రకటన • Ad
                    </span>
                    <span className="text-[10px] text-gray-500 font-mallanna">Google AdMob</span>
                  </div>

                  {/* Ad Body Content */}
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-2 py-1 z-10">
                    <div className="w-12 h-12 rounded-full bg-red-600/15 border border-red-500/30 flex items-center justify-center mb-2 shadow-inner">
                      <span className="text-red-500 font-bold text-sm tracking-tighter">ALFA</span>
                    </div>
                    <h3 className="text-white font-semibold text-xs mb-1">ఆల్ఫా న్యూస్ యాప్ ఇప్పుడే పొందండి</h3>
                    <p className="text-gray-400 text-[11px] font-mallanna leading-tight">హైపర్-లోకల్ వార్తలు, లైవ్ అప్‌డేట్స్ మరియు బ్రేకింగ్ న్యూస్ క్షణాల్లో మీ మొబైల్‌లో!</p>
                  </div>

                  {/* Ad CTA Button */}
                  <a
                    href="https://play.google.com/store/apps/details?id=com.alfanews.telugu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 rounded-lg bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white text-xs font-bold text-center transition-all shadow-md z-10"
                  >
                    ఉచితంగా డౌన్‌లోడ్ చేసుకోండి (Install Free)
                  </a>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-[10px] text-gray-500 font-mallanna">
                  <span>ప్రకటన భాగస్వామ్యం • AdMob Network</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NewsCard;
