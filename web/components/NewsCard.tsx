
import React, { useState, useRef, useEffect } from 'react';
import { NewsPost, Language, User, AnalyticsEventType, LocalAd } from '../types';
import CommentSection from './CommentSection';
import html2canvas from 'html2canvas';
import { logAnalyticsEvent } from '../services/analyticsService';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';

const { doc, updateDoc, increment } = _firestore as any;

const LikeIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 ${className}`} viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>;
const CommentIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>;
const ShareIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 8.81C7.5 8.31 6.79 8 6 8c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>;
const LoadingSpinner = () => <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>;

interface NewsCardProps {
  post: NewsPost;
  language: Language;
  onProfileClick: () => void;
  currentUser: User | null;
  systemAd?: LocalAd;
  // Added missing properties to fix the error in NewsFeed.tsx
  onCategoryClick: (category: string) => void;
  onReporterClick: (reporterId: string) => void;
}

const NewsCard: React.FC<NewsCardProps> = ({ post, language, onProfileClick, currentUser, systemAd, onCategoryClick, onReporterClick }) => {
  const headline = language === Language.TELUGU ? post.headline.telugu : post.headline.english;
  const content = language === Language.TELUGU ? post.content.telugu : post.content.english;

  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [shareCount, setShareCount] = useState(post.shares || 0);
  const [commentCount, setCommentCount] = useState(post.comments || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const adIncrementedRef = useRef(false);

  // --- FAKE COUNTERS LOGIC ---
  useEffect(() => {
    if ((post.likes === 0 || !post.likes) && post.id) {
        const initFakeCounters = async () => {
            const fakeLikes = Math.floor(Math.random() * (180 - 40 + 1)) + 40;
            const fakeShares = Math.floor(Math.random() * (45 - 10 + 1)) + 10;
            setLikeCount(fakeLikes);
            setShareCount(fakeShares);
            try {
                const postRef = doc(db, 'news', post.id);
                await updateDoc(postRef, { likes: fakeLikes, shares: fakeShares });
            } catch (e) { console.warn("Counters update skipped:", e); }
        };
        initFakeCounters();
    }
  }, [post.id, post.likes]);

  // --- ANALYTICS & AD VIEW COUNTING ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            startTimeRef.current = Date.now();
            if (systemAd && !adIncrementedRef.current) {
                adIncrementedRef.current = true;
                try {
                    const adRef = doc(db, 'local_ads', systemAd.id);
                    updateDoc(adRef, { viewsCurrent: increment(1) }).catch(console.error);
                } catch(e) { console.error(e); }
            }
          } else {
            if (startTimeRef.current) {
              const duration = (Date.now() - startTimeRef.current) / 1000;
              if (duration > 2) {
                logAnalyticsEvent(
                  duration > 10 ? AnalyticsEventType.ENGAGED_VIEW : AnalyticsEventType.VIEW,
                  post,
                  currentUser?.id,
                  duration
                );
              }
              startTimeRef.current = null;
            }
          }
        });
      },
      { threshold: 0.6 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => { if (cardRef.current) observer.unobserve(cardRef.current); };
  }, [post, currentUser, systemAd]);

  const formattedTimestamp = post.timestamp ? new Date(post.timestamp).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  }) : '';

  const handleLike = () => {
    if (!currentUser) { onProfileClick(); return; }
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    logAnalyticsEvent(AnalyticsEventType.LIKE, post, currentUser.id);
  };

  const handleShare = async () => {
    if (isSharing || !cardRef.current) return;
    setIsSharing(true);
    
    const shareText = `${headline}\nhttps://alfanews.app/news/${post.id}\n\nShared via AlfaNews`;

    try {
        updateDoc(doc(db, 'news', post.id), { shares: increment(1) }).catch(console.error);
        setShareCount(prev => prev + 1);

        const canvas = await html2canvas(cardRef.current, {
            useCORS: true,
            scale: 2,
            backgroundColor: '#000000',
            ignoreElements: (element) => element.tagName === 'VIDEO',
            onclone: (clonedDoc) => {
                const container = clonedDoc.getElementById(`content-container-${post.id}`);
                if (container) {
                    const overlay = clonedDoc.createElement('div');
                    overlay.style.cssText = "position:absolute;bottom:0;left:0;width:100%;height:45%;background:linear-gradient(to top, black 80%, transparent 100%);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:30px;z-index:99;text-align:center;";
                    overlay.innerHTML = `<div style="background-color:#DC2626;padding:8px 20px;border-radius:30px;box-shadow:0 4px 6px rgba(0,0,0,0.3);margin-bottom:10px;"><span style="color:white;font-weight:bold;font-size:16px;">ALFA NEWS TELUGU</span></div><div style="color:#f3f4f6;font-size:12px;font-weight:600;">మరిన్ని వార్తల కోసం Play Store నుండి డౌన్లోడ్ చేసుకోండి</div>`;
                    container.appendChild(overlay);
                }
            }
        });

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        if (blob && navigator.share) {
            const file = new File([blob], `alfa-news-${post.id}.jpg`, { type: 'image/jpeg' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Alfa News', text: shareText });
            } else {
                await navigator.share({ title: 'Alfa News', text: shareText, url: playStoreUrl });
            }
        } else if (navigator.share) {
             await navigator.share({ title: 'Alfa News', text: shareText, url: playStoreUrl });
        } else {
            await navigator.clipboard.writeText(shareText);
            alert("లింక్ కాపీ చేయబడింది!");
        }
    } catch (e) { console.error(e); } finally { setIsSharing(false); }
  };

  const displayAd = systemAd ? systemAd.bannerUrl : post.localAdUrl;

  return (
    <>
      <div ref={cardRef} className="w-full h-full snap-start snap-always shrink-0 overflow-hidden text-white bg-black flex flex-col">
        {/* Media (35%) */}
        <div className="relative w-full bg-black overflow-hidden" style={{ height: '35%' }}>
          {post.mediaType === 'image' ? (
            <img src={post.mediaUrl} alt={headline} className="w-full h-full object-cover object-top" />
          ) : (
            <video src={post.mediaUrl} className="w-full h-full object-cover object-top" autoPlay loop muted playsInline />
          )}
        </div>

        {/* Ad Space (15%) */}
        <div className="w-full bg-gray-900 border-y border-gray-800 shrink-0" style={{ height: '15%' }}>
             {displayAd && <img src={displayAd} alt="Ad" className="w-full h-full object-fill" />}
        </div>
        
        {/* Content Container (50%) */}
        <div id={`content-container-${post.id}`} className="relative px-4 pb-4 pt-4 flex flex-1 overflow-hidden bg-black">
          <div className="w-[90%] flex flex-col h-full">
            <div className="flex-1 overflow-y-auto no-scrollbar">
                <h1 className="font-ramabhadra text-2xl leading-tight mb-2">{headline}</h1>
                <div className="font-mallanna text-sm text-gray-400 mb-3">
                <span onClick={(e) => { e.stopPropagation(); onReporterClick(post.reporter?.id || post.reporter?.name || ''); }} className="cursor-pointer hover:underline">{post.reporter?.name || 'Reporter'}</span> • <span onClick={(e) => { e.stopPropagation(); onCategoryClick(post.category); }} className="cursor-pointer hover:underline">{post.location}</span> • <span>{formattedTimestamp}</span>
                </div>
                <p className="font-mallanna text-lg leading-relaxed">{content}</p>
            </div>
          </div>

          <div className="w-[10%] flex flex-col items-center justify-end space-y-6 pb-6 shrink-0">
             <button onClick={handleLike} className="flex flex-col items-center">
                <LikeIcon className={isLiked ? 'text-red-500' : 'text-white'} />
                <span className="text-xs mt-1">{likeCount}</span>
            </button>
            <button onClick={handleShare} className="flex flex-col items-center">
                {isSharing ? <LoadingSpinner /> : <ShareIcon />}
                <span className="text-xs mt-1">{shareCount}</span>
            </button>
            <button onClick={() => setShowComments(true)} className="flex flex-col items-center">
                <CommentIcon />
                <span className="text-xs mt-1">{commentCount}</span>
            </button>
          </div>
        </div>
      </div>
      {showComments && (
        <CommentSection 
          postId={post.id}
          initialCommentCount={commentCount}
          currentUser={currentUser}
          onClose={() => setShowComments(false)}
          onCommentPosted={() => setCommentCount(prev => prev + 1)}
          onLoginRequest={onProfileClick}
        />
      )}
    </>
  );
};

export default NewsCard;
