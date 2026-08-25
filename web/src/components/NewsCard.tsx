
import React, { useState, useRef, useEffect } from 'react';
import { NewsPost, Language, User, AnalyticsEventType } from '../types';
import CommentSection from './CommentSection';
import html2canvas from 'html2canvas';
import { logAnalyticsEvent } from '../services/analyticsService';
import { updateInterests } from '../services/interestService';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import { Heart, MessageCircle, Share2 } from 'lucide-react';

const { doc, updateDoc, increment } = _firestore as any;

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
  
  const match = trimmed.match(/^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/i);
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
  const [isSharing, setIsSharing] = useState(false);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasScrolledToBottom = useRef(false);
  const isSkipped = useRef(true); // Default to true, set to false if user stays > 3s

  const headline = language === Language.TELUGU ? (post.headline?.telugu || '') : (post.headline?.english || '');
  const content = language === Language.TELUGU ? (post.content?.telugu || '') : (post.content?.english || '');

  // Extract YouTube ID if present in youtubeUrl or mediaUrl
  const youtubeVideoId = extractYoutubeVideoId(post.youtubeUrl || (post.mediaType === 'video' || post.mediaUrl?.includes('youtu') ? post.mediaUrl : null));

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
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            startTimeRef.current = Date.now();
            isSkipped.current = true;
            hasScrolledToBottom.current = false;
            
            if (videoRef.current) {
                videoRef.current.play().catch(e => console.log("Auto-play prevented", e));
            }

            // If user stays more than 3 seconds, it's not a "skip"
            setTimeout(() => {
                if (startTimeRef.current && entry.isIntersecting) {
                    isSkipped.current = false;
                }
            }, 3000);

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
              }
              
              startTimeRef.current = null;
            }
          }
        });
      }, { threshold: 0.6 }
    );
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
        logAnalyticsEvent(AnalyticsEventType.SCROLL_DEPTH, post, currentUser?.id);
    }
  };

  const handleLike = () => {
    if (!currentUser) { onProfileClick(); return; }
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    if (currentUser) updateInterests(currentUser, post);
  };

  const handleShare = async () => {
    if (isSharing || !cardRef.current) return;
    setIsSharing(true);
    const shareText = `🔴 ${headline}\n\nhttps://alfanews.app/news/${post.id}`;
    try {
        // 📸 9:16 Real Browser Screenshot Capture via html2canvas
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
          return {
            label: `@${username}`,
            href: `https://x.com/${username}`
          };
        }
      }
      
      if (hostname.includes('facebook.com')) {
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
          let username = parts[0];
          if ((username === 'pages' || username === 'groups' || username === 'profile.php' || username === 'watch') && parts.length > 1) {
             username = parts[1];
          }
          return {
            label: `@${username}`,
            href: `https://facebook.com/${username}`
          };
        }
      }

      return {
        label: hostname,
        href: urlStr
      };
    } catch (e) {
      return { label: 'Source', href: urlStr };
    }
  };

  const sourceDisplay = post.originalUrl ? getSourceDisplay(post.originalUrl) : null;

  // Helper function to optimize image URLs
  const getOptimizedImageUrl = (url: string) => {
    const DEFAULT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/alfa-news-31bf7.firebasestorage.app/o/news-media%2Fbg.png?alt=media&token=70bb37fd-c13d-4f97-84e1-11fb6c0d1061";
    if (!url || url.trim() === '') return DEFAULT_IMAGE;
    // If it's already using wsrv.nl, return as is
    if (url.includes('wsrv.nl')) return url;
    // Otherwise, wrap it
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

          {/* Right Action Bar - Floating for greetings */}
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

          {/* Bottom Info - Greeting Text with Gradient Background */}
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-16 pb-8 px-6">
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
                    {/* Headline */}
                    <h1 className="font-ramabhadra text-xl md:text-2xl leading-tight mb-2 text-white font-medium">{headline}</h1>
                    
                    {/* Meta Section with Dotted Borders */}
                    <div className="py-1.5 border-y border-dotted border-white/20 mb-3 flex flex-wrap items-center gap-x-2 text-[10px] font-mallanna text-gray-400">
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
                    
                    {/* Full News Content with reduced line height */}
                    <div 
                        ref={contentRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto no-scrollbar pr-1 pb-24"
                    >
                        <p className="font-mallanna text-base md:text-lg leading-[1.4] text-gray-300 opacity-95 whitespace-pre-wrap mb-4">{content}</p>
                        
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
    </>
  );
};

export default NewsCard;
