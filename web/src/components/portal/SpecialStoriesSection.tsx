import React from 'react';
import { NewsPost } from '../../types';
import { Sparkles, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { formatRelativeTimeTelugu, FALLBACK_SPECIAL_IMAGE } from './portalUtils';

interface SpecialStoriesSectionProps {
  posts: NewsPost[];
  onSelectPost: (post: NewsPost) => void;
  onOpenComposer?: () => void;
}

export const SpecialStoriesSection: React.FC<SpecialStoriesSectionProps> = ({
  posts,
  onSelectPost,
}) => {
  // Filter special stories
  const specialStories = posts.filter(
    (p) =>
      p.isSpecialStory === true ||
      p.webOnly === true ||
      p.category === 'స్పెషల్ స్టోరీస్' ||
      p.categories?.includes('స్పెషల్ స్టోరీస్')
  );

  // If no special stories exist, do not clutter the homepage
  if (specialStories.length === 0) {
    return null;
  }

  return (
    <section className="w-full mb-8 font-mallanna">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-3 mb-5 border-b-2 border-red-600">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-red-600" />
          <h2 className="font-ramabhadra text-xl sm:text-2xl text-gray-900">
            ప్రత్యేక కథనాలు (Special Stories)
          </h2>
        </div>
      </div>

      {/* Cards Grid */}
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
              className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Thumbnail Image */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-900">
                  <img
                    src={image}
                    alt={headline}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e: any) => {
                      e.target.src = FALLBACK_SPECIAL_IMAGE;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>

                  {/* Author Byline */}
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white text-xs font-mallanna">
                    <span className="flex items-center gap-1 text-yellow-300 truncate">
                      <ShieldCheck className="w-3.5 h-3.5 text-yellow-300" />
                      {author}
                    </span>
                    <span className="text-gray-300 shrink-0">
                      {formatRelativeTimeTelugu(post.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-4">
                  <h3 className="font-ramabhadra text-base sm:text-lg text-gray-900 group-hover:text-red-700 transition-colors line-clamp-2 leading-snug mb-1.5">
                    {headline}
                  </h3>
                  <p className="font-mallanna text-xs sm:text-sm text-gray-600 line-clamp-3 leading-relaxed">
                    {story}
                  </p>
                </div>
              </div>

              {/* Footer read link */}
              <div className="px-4 pb-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs font-mallanna text-red-700 group-hover:text-red-800">
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
    </section>
  );
};

export default SpecialStoriesSection;
