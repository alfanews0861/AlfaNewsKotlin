import React, { useState, useEffect } from 'react';
import { NewsPost } from '../../types';
import { Zap, ChevronRight } from 'lucide-react';

interface BreakingNewsTickerProps {
  posts: NewsPost[];
  onSelectPost: (post: NewsPost) => void;
}

export const BreakingNewsTicker: React.FC<BreakingNewsTickerProps> = ({ posts, onSelectPost }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const displayPosts = posts.slice(0, 8);

  useEffect(() => {
    if (displayPosts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayPosts.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [displayPosts.length]);

  if (displayPosts.length === 0) return null;

  const currentPost = displayPosts[currentIndex];
  const headline = currentPost?.headline?.telugu || currentPost?.headline?.english || '';

  return (
    <div className="w-full bg-slate-900 border-b border-slate-800 text-white shadow-sm overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-3">
        {/* FLASH NEWS BADGE */}
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-ramabhadra text-xs md:text-sm font-bold px-3 py-1 rounded-md shrink-0 shadow-sm animate-pulse">
          <Zap className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300" />
          <span>తాజా ముఖ్యాంశాలు</span>
        </div>

        {/* HEADLINE TEXT (Fade in transition) */}
        <div 
          onClick={() => onSelectPost(currentPost)}
          className="flex-1 min-w-0 cursor-pointer group flex items-center justify-between gap-2 overflow-hidden"
        >
          <p 
            key={currentPost.id + currentIndex}
            className="font-ramabhadra text-sm md:text-base text-gray-200 group-hover:text-yellow-300 truncate transition-colors animate-fade-in"
          >
            {headline}
          </p>

          <span className="hidden sm:inline-flex items-center text-xs text-gray-400 group-hover:text-white shrink-0 font-mallanna">
            చదవండి <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </span>
        </div>

        {/* Counter indicator */}
        <div className="hidden md:flex items-center gap-1 text-xs text-gray-400 font-poppins shrink-0">
          <span>{currentIndex + 1}</span>
          <span>/</span>
          <span>{displayPosts.length}</span>
        </div>
      </div>
    </div>
  );
};

export default BreakingNewsTicker;
