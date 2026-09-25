import React from 'react';
import { NewsPost } from '../../types';
import { Clock, MapPin, ChevronRight } from 'lucide-react';
import { formatRelativeTimeTelugu, FALLBACK_NEWS_IMAGE } from './portalUtils';

interface CategorySectionProps {
  title: string;
  categoryKey: string;
  posts: NewsPost[];
  onSelectPost: (post: NewsPost) => void;
  onViewMore: (categoryKey: string) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  title,
  categoryKey,
  posts,
  onSelectPost,
  onViewMore,
}) => {
  if (posts.length === 0) return null;

  const leadPost = posts[0];
  const sidePosts = posts.slice(1, 5);

  return (
    <div className="w-full mb-10">
      {/* Category Header */}
      <div className="flex items-center justify-between border-b-2 border-red-600 pb-2 mb-5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-6 bg-red-600 rounded-sm"></span>
          <h2 className="font-ramabhadra text-xl sm:text-2xl font-bold text-gray-900">
            {title}
          </h2>
        </div>
        <button
          onClick={() => onViewMore(categoryKey)}
          className="text-xs sm:text-sm font-ramabhadra font-semibold text-red-600 hover:text-red-800 flex items-center gap-0.5 group"
        >
          <span>మరిన్ని చూడండి</span>
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Grid: 1 Primary Card (Medium-Large) + 3-4 Grid Cards (Medium Thumbnails) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Lead Card (Desktop 5 cols) */}
        {leadPost && (
          <div
            onClick={() => onSelectPost(leadPost)}
            className="md:col-span-5 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
          >
            <div>
              {/* Medium-sized 16:9 Thumbnail */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                <img
                  src={leadPost.mediaUrl || leadPost.mediaUrls?.[0] || FALLBACK_NEWS_IMAGE}
                  alt={leadPost.headline?.telugu || ''}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e: any) => { e.target.src = FALLBACK_NEWS_IMAGE; }}
                />
                <span className="absolute top-2.5 left-2.5 bg-red-600 text-white text-[11px] font-ramabhadra px-2.5 py-0.5 rounded-full shadow">
                  {leadPost.category || title}
                </span>
              </div>

              <div className="p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 font-mallanna mb-1.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-red-500" />
                    {formatRelativeTimeTelugu(leadPost.timestamp)}
                  </span>
                  {leadPost.location && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-red-500" />
                        {leadPost.location}
                      </span>
                    </>
                  )}
                </div>

                <h3 className="font-ramabhadra text-lg sm:text-xl font-bold text-gray-900 group-hover:text-red-600 transition-colors leading-snug line-clamp-2 mb-2">
                  {leadPost.headline?.telugu || leadPost.headline?.english}
                </h3>

                <p className="font-mallanna text-sm text-gray-600 line-clamp-3 leading-relaxed">
                  {leadPost.fullStory?.telugu || leadPost.content?.telugu || leadPost.content?.english || ''}
                </p>
              </div>
            </div>

            <div className="p-4 pt-0">
              <span className="text-xs font-ramabhadra font-bold text-red-600 group-hover:underline">
                పూర్తి కథనం చదవండి →
              </span>
            </div>
          </div>
        )}

        {/* Side Grid Cards with Medium Thumbnails (Desktop 7 cols: 2x2 grid) */}
        <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sidePosts.map((post) => {
            const hLine = post.headline?.telugu || post.headline?.english || '';
            const img = post.mediaUrl || post.mediaUrls?.[0] || FALLBACK_NEWS_IMAGE;
            return (
              <div
                key={post.id}
                onClick={() => onSelectPost(post)}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Medium Thumbnail (16:9 ratio) */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                    <img
                      src={img}
                      alt={hLine}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e: any) => { e.target.src = FALLBACK_NEWS_IMAGE; }}
                    />
                  </div>

                  <div className="p-3">
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mallanna mb-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-red-500" />
                        {formatRelativeTimeTelugu(post.timestamp)}
                      </span>
                      {post.location && (
                        <>
                          <span>•</span>
                          <span className="truncate">{post.location}</span>
                        </>
                      )}
                    </div>

                    <h4 className="font-ramabhadra text-sm sm:text-base font-bold text-gray-900 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                      {hLine}
                    </h4>
                  </div>
                </div>

                <div className="px-3 pb-3">
                  <span className="text-xs text-red-600 font-mallanna font-medium group-hover:underline">
                    చదవండి →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CategorySection;
