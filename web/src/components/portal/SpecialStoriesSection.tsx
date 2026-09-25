import React from 'react';
import { NewsPost } from '../../types';
import { Sparkles, PenTool, Clock, MapPin, ArrowRight, ShieldCheck } from 'lucide-react';
import { formatRelativeTimeTelugu, FALLBACK_SPECIAL_IMAGE } from './portalUtils';

interface SpecialStoriesSectionProps {
  posts: NewsPost[];
  onSelectPost: (post: NewsPost) => void;
  onOpenComposer: () => void;
}

export const SpecialStoriesSection: React.FC<SpecialStoriesSectionProps> = ({
  posts,
  onSelectPost,
  onOpenComposer,
}) => {
  // Filter special stories
  const specialStories = posts.filter(
    (p) =>
      p.isSpecialStory === true ||
      p.webOnly === true ||
      p.category === 'స్పెషల్ స్టోరీస్' ||
      p.categories?.includes('స్పెషల్ స్టోరీస్')
  );

  return (
    <section className="w-full mb-10">
      {/* 1. SECTION HEADER (Gold & Crimson Highlights) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-900 via-rose-900 to-amber-900 text-white p-5 sm:p-6 mb-6 shadow-md border-2 border-amber-400/40">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-yellow-400 text-red-950 text-xs font-ramabhadra font-bold px-3 py-0.5 rounded-full flex items-center gap-1 shadow">
                <Sparkles className="w-3.5 h-3.5 fill-red-950" />
                వెబ్‌సైట్ ప్రత్యేకం
              </span>
              <span className="text-yellow-200 text-xs font-poppins tracking-wider font-semibold">
                EXCLUSIVE STORIES
              </span>
            </div>
            <h2 className="font-ramabhadra text-2xl sm:text-3xl font-bold text-white tracking-wide">
              ఆల్ఫా స్పెషల్ స్టోరీస్
            </h2>
            <p className="font-mallanna text-sm sm:text-base text-amber-100/90 mt-1 max-w-xl">
              లోతైన విశ్లేషణలు, గ్రౌండ్ రిపోర్ట్‌లు మరియు ప్రత్యేక పరిశోధనాత్మక కథనాలు.
            </p>
          </div>

          {/* Action button to publish from web app */}
          <button
            onClick={onOpenComposer}
            className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-red-950 font-ramabhadra font-bold px-4 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 text-sm shrink-0"
            title="AI ప్రాసెస్ లేకుండా నేరుగా వెబ్‌సైట్‌లో ప్రచురించండి"
          >
            <PenTool className="w-4 h-4 text-red-950" />
            <span>+ స్పెషల్ స్టోరీ రాయండి</span>
          </button>
        </div>

        {/* Decorative corner glow */}
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-yellow-400/10 rounded-full blur-2xl pointer-events-none"></div>
      </div>

      {/* 2. SPECIAL STORIES CARDS GRID */}
      {specialStories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {specialStories.slice(0, 6).map((post) => {
            const headline = post.headline?.telugu || post.headline?.english || '';
            const story = post.fullStory?.telugu || post.content?.telugu || '';
            const image = post.mediaUrl || post.mediaUrls?.[0] || FALLBACK_SPECIAL_IMAGE;
            const author = post.reporter?.name || 'ఆల్ఫా స్పెషల్ డెస్క్';

            return (
              <div
                key={post.id}
                onClick={() => onSelectPost(post)}
                className="bg-white rounded-2xl overflow-hidden border border-amber-200/80 shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail Image (Medium-sized 16:9) */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-900">
                    <img
                      src={image}
                      alt={headline}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e: any) => { e.target.src = FALLBACK_SPECIAL_IMAGE; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                    
                    {/* Badge */}
                    <div className="absolute top-3 left-3">
                      <span className="bg-yellow-400 text-red-950 text-[11px] font-ramabhadra font-bold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                        <Sparkles className="w-3 h-3 fill-red-950" />
                        స్పెషల్ స్టోరీ
                      </span>
                    </div>

                    {/* Author Byline */}
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white text-xs font-mallanna">
                      <span className="flex items-center gap-1 font-semibold text-yellow-300 truncate">
                        <ShieldCheck className="w-3.5 h-3.5 text-yellow-300" />
                        {author}
                      </span>
                      <span className="text-gray-300 shrink-0">
                        {formatRelativeTimeTelugu(post.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5">
                    <h3 className="font-ramabhadra text-lg sm:text-xl font-bold text-gray-900 group-hover:text-red-700 transition-colors line-clamp-2 leading-snug mb-2">
                      {headline}
                    </h3>
                    <p className="font-mallanna text-sm text-gray-600 line-clamp-3 leading-relaxed">
                      {story}
                    </p>
                  </div>
                </div>

                {/* Footer read link */}
                <div className="px-5 pb-4 pt-2 border-t border-gray-100 flex items-center justify-between text-xs font-mallanna text-red-700 font-semibold group-hover:text-red-800">
                  <span className="flex items-center gap-1 text-gray-400">
                    <Clock className="w-3.5 h-3.5" /> 3 నిమిషాల పఠనం
                  </span>
                  <span className="flex items-center gap-1 font-ramabhadra">
                    పూర్తి కథనం చదవండి <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State / Prompt to Create First Special Story */
        <div className="bg-amber-50/70 border border-dashed border-amber-300 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-2xl mb-3 shadow-inner">
            ✍️
          </div>
          <h3 className="font-ramabhadra text-lg font-bold text-gray-800">
            ఇంకా స్పెషల్ స్టోరీస్ ప్రచురించబడలేదు
          </h3>
          <p className="font-mallanna text-sm text-gray-600 max-w-md mt-1 mb-4">
            ఆల్ఫా న్యూస్ వెబ్‌సైట్ ప్రత్యేకం! AI ప్రాసెస్ లేకుండా మీరు రాసిన వార్తను యథాతథంగా వెబ్‌సైట్‌లో ప్రచురించడానికి ఇప్పుడే మొదటి స్పెషల్ స్టోరీ రాయండి.
          </p>
          <button
            onClick={onOpenComposer}
            className="bg-red-600 hover:bg-red-700 text-white font-ramabhadra px-5 py-2 rounded-xl text-sm font-bold shadow hover:shadow-md transition-all flex items-center gap-2"
          >
            <PenTool className="w-4 h-4" />
            మొదటి స్పెషల్ స్టోరీని ప్రారంభించండి
          </button>
        </div>
      )}
    </section>
  );
};

export default SpecialStoriesSection;
