import React, { useState, useEffect, useRef } from 'react';
import { NewsPost } from '../../types';
import { ChevronLeft, ChevronRight, Clock, MapPin, Sparkles } from 'lucide-react';
import { formatRelativeTimeTelugu, FALLBACK_NEWS_IMAGE } from './portalUtils';

interface HeadlinesSliderProps {
  posts: NewsPost[];
  onSelectPost: (post: NewsPost) => void;
}

export const HeadlinesSlider: React.FC<HeadlinesSliderProps> = ({ posts, onSelectPost }) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<any>(null);

  // Take first 5 posts for carousel, and next 2 for side hot news
  const sliderPosts = posts.slice(0, 5);
  const sidePosts = posts.slice(5, 7);

  useEffect(() => {
    if (sliderPosts.length <= 1 || isPaused) return;
    timerRef.current = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % sliderPosts.length);
    }, 5000);
    return () => clearInterval(timerRef.current);
  }, [sliderPosts.length, isPaused]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSlide((prev) => (prev - 1 + sliderPosts.length) % sliderPosts.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSlide((prev) => (prev + 1) % sliderPosts.length);
  };

  if (sliderPosts.length === 0) return null;

  const currentSlide = sliderPosts[activeSlide];
  const slideHeadline = currentSlide?.headline?.telugu || currentSlide?.headline?.english || '';
  const slideSummary = currentSlide?.fullStory?.telugu || currentSlide?.content?.telugu || currentSlide?.content?.english || '';
  const slideImage = currentSlide?.mediaUrl || currentSlide?.mediaUrls?.[0] || FALLBACK_NEWS_IMAGE;
  const slideCategory = currentSlide?.category || currentSlide?.categories?.[0] || 'ప్రధాన వార్త';

  return (
    <div className="w-full mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT / MAIN: Top Headlines Slider (8 Cols on Desktop) */}
        <div 
          className="lg:col-span-8 relative bg-slate-900 rounded-2xl overflow-hidden shadow-lg group cursor-pointer aspect-[16/10] sm:aspect-[16/9] flex flex-col justify-end"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onClick={() => onSelectPost(currentSlide)}
        >
          {/* Slide Background Image */}
          <div className="absolute inset-0">
            <img
              src={slideImage}
              alt={slideHeadline}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              onError={(e: any) => { e.target.src = FALLBACK_NEWS_IMAGE; }}
            />
            {/* Gradient Overlays for High Contrast Readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent"></div>
          </div>

          {/* Top Badges (Category & Live indicator) */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <span className="bg-red-600 text-white text-xs font-ramabhadra font-bold px-3 py-1 rounded-full shadow-md">
              {slideCategory}
            </span>
            {currentSlide.isSpecialStory && (
              <span className="bg-yellow-400 text-red-950 text-xs font-ramabhadra font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                <Sparkles className="w-3 h-3 fill-red-950" />
                స్పెషల్ స్టోరీ
              </span>
            )}
          </div>

          {/* Slider Arrows */}
          <button
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
            aria-label="Next slide"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Slide Content Box */}
          <div className="relative z-10 p-5 sm:p-7 text-white animate-fade-in">
            {/* Metadata (Time & Location) */}
            <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-300 font-mallanna mb-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-red-400" />
                {formatRelativeTimeTelugu(currentSlide.timestamp)}
              </span>
              {currentSlide.location && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-red-400" />
                    {currentSlide.location}
                  </span>
                </>
              )}
            </div>

            {/* Headline */}
            <h2 className="font-ramabhadra text-xl sm:text-2xl md:text-3xl font-bold text-white group-hover:text-yellow-300 transition-colors leading-snug line-clamp-2 mb-2">
              {slideHeadline}
            </h2>

            {/* Brief Excerpt */}
            <p className="font-mallanna text-sm sm:text-base text-gray-200 line-clamp-2 hidden sm:block max-w-2xl">
              {slideSummary}
            </p>

            {/* Slide Dots Indicator */}
            <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
              {sliderPosts.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSlide(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    activeSlide === idx ? 'w-8 bg-red-500' : 'w-2 bg-white/50 hover:bg-white'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Top Stories / Side Cards (4 Cols on Desktop) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-red-700 text-white px-4 py-2 rounded-xl flex items-center justify-between">
            <span className="font-ramabhadra text-base font-bold flex items-center gap-1.5">
              🔥 హాట్ న్యూస్
            </span>
            <span className="text-xs font-mallanna text-red-100">ముఖ్య కథనాలు</span>
          </div>

          {sidePosts.map((post) => {
            const hLine = post.headline?.telugu || post.headline?.english || '';
            const img = post.mediaUrl || post.mediaUrls?.[0] || FALLBACK_NEWS_IMAGE;
            const cat = post.category || post.categories?.[0] || 'తాజా వార్త';
            return (
              <div
                key={post.id}
                onClick={() => onSelectPost(post)}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col sm:flex-row lg:flex-col flex-1"
              >
                {/* Medium-sized thumbnail */}
                <div className="relative aspect-[16/9] sm:w-48 lg:w-full overflow-hidden bg-gray-100 shrink-0">
                  <img
                    src={img}
                    alt={hLine}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e: any) => { e.target.src = FALLBACK_NEWS_IMAGE; }}
                  />
                  <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm text-white text-[11px] font-ramabhadra px-2 py-0.5 rounded">
                    {cat}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <h3 className="font-ramabhadra text-base font-bold text-gray-900 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                    {hLine}
                  </h3>
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-500 font-mallanna">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-red-500" />
                      {formatRelativeTimeTelugu(post.timestamp)}
                    </span>
                    <span className="text-red-600 font-medium group-hover:underline">
                      పూర్తి వార్త చదవండి →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HeadlinesSlider;
