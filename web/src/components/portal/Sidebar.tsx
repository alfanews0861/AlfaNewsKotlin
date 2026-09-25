import React, { useState, useEffect } from 'react';
import { NewsPost } from '../../types';
import { CloudSun, Wind, Droplets, Image as ImageIcon, Flame, Smartphone, Share2, ThumbsUp, CheckCircle, ExternalLink, HelpCircle } from 'lucide-react';
import { formatRelativeTimeTelugu } from './portalUtils';

interface SidebarProps {
  posts: NewsPost[];
  onSelectPost: (post: NewsPost) => void;
  onSelectCartoon?: (cartoonPost: NewsPost) => void;
}

interface WeatherCity {
  name: string;
  lat: number;
  lon: number;
}

const TELUGU_CITIES: WeatherCity[] = [
  { name: 'విజయవాడ', lat: 16.5062, lon: 80.6480 },
  { name: 'హైదరాబాద్', lat: 17.3850, lon: 78.4867 },
  { name: 'విశాఖపట్నం', lat: 17.6868, lon: 83.2185 },
  { name: 'తిరుపతి', lat: 13.6288, lon: 79.4192 },
  { name: 'వరంగల్', lat: 17.9689, lon: 79.5941 },
  { name: 'గుంటూరు', lat: 16.3067, lon: 80.4365 },
  { name: 'కర్నూలు', lat: 15.8281, lon: 78.0373 },
];

export const Sidebar: React.FC<SidebarProps> = ({ posts, onSelectPost }) => {
  // 1. Weather State
  const [selectedCity, setSelectedCity] = useState<WeatherCity>(TELUGU_CITIES[0]);
  const [temp, setTemp] = useState<number | null>(31);
  const [humidity, setHumidity] = useState<number | null>(68);
  const [windSpeed, setWindSpeed] = useState<number | null>(12);
  const [conditionText, setConditionText] = useState<string>('ఎండ / నిర్మలంగా ఉంది');
  const [weatherLoading, setWeatherLoading] = useState(false);

  // 2. Cartoon State & Lightbox
  const [cartoonModalOpen, setCartoonModalOpen] = useState(false);

  // 3. Poll State
  const [pollVoted, setPollVoted] = useState<number | null>(() => {
    const saved = localStorage.getItem('alfa_sidebar_poll_vote');
    return saved !== null ? Number(saved) : null;
  });
  const [pollVotes, setPollVotes] = useState({ 0: 64, 1: 36 });

  // Fetch Weather using Open-Meteo (Free, reliable, no key needed)
  useEffect(() => {
    let isMounted = true;
    async function fetchWeather() {
      try {
        setWeatherLoading(true);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedCity.lat}&longitude=${selectedCity.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia%2FKolkata`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather fetch failed');
        const data = await res.json();
        if (!isMounted) return;

        const current = data.current;
        if (current) {
          setTemp(Math.round(current.temperature_2m));
          setHumidity(current.relative_humidity_2m);
          setWindSpeed(Math.round(current.wind_speed_10m));

          const code = current.weather_code;
          if (code === 0) setConditionText('నిర్మలంగా ఉంది');
          else if (code <= 3) setConditionText('కొద్దిగా మేఘావృతం');
          else if (code <= 48) setConditionText('పొగమంచు');
          else if (code <= 67) setConditionText('తేలికపాటి వర్షం');
          else if (code <= 82) setConditionText('భారీ వర్షం');
          else setConditionText('ఉరుములతో కూడిన జల్లులు');
        }
      } catch (e) {
        console.warn('Weather fetch error:', e);
      } finally {
        if (isMounted) setWeatherLoading(false);
      }
    }
    fetchWeather();
    return () => { isMounted = false; };
  }, [selectedCity]);

  // Find cartoon post from Firestore news items or fallback
  const cartoonPost = posts.find((p) => p.type === 'cartoon' || p.category === 'కార్టూన్' || p.categories?.includes('కార్టూన్'));
  const cartoonImg = cartoonPost?.mediaUrl || cartoonPost?.mediaUrls?.[0] || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=60';
  const cartoonHeadline = cartoonPost?.headline?.telugu || 'నేటి రాజకీయ కార్టూన్';
  const cartoonPunchline = cartoonPost?.fullStory?.telugu || cartoonPost?.content?.telugu || 'ప్రజల నాడిని పట్టే వ్యంగ్యాస్త్రం!';

  // Trending / Most read posts
  const trendingPosts = [...posts]
    .sort((a, b) => ((b as any).views || b.likes || 0) - ((a as any).views || a.likes || 0))
    .slice(0, 5);

  const handleVote = (optionIndex: number) => {
    if (pollVoted !== null) return;
    setPollVoted(optionIndex);
    localStorage.setItem('alfa_sidebar_poll_vote', String(optionIndex));
    setPollVotes((prev: any) => ({
      ...prev,
      [optionIndex]: (prev[optionIndex] || 0) + 1,
    }));
  };

  const handleShareCartoon = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `*ఆల్ఫా న్యూస్ నేటి కార్టూన్: ${cartoonHeadline}*\n${cartoonPunchline}\n\nమరిన్ని తాజా తెలుగు వార్తల కోసం: https://alfa-news-31bf7.web.app`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <aside className="w-full space-y-6">
      {/* 1. వాతావరణం (WEATHER WIDGET) */}
      <div className="bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800 text-white rounded-2xl p-5 shadow-sm overflow-hidden relative">
        <div className="flex items-center justify-between mb-3 border-b border-white/20 pb-2">
          <div className="flex items-center gap-1.5 font-ramabhadra text-base font-bold">
            <CloudSun className="w-5 h-5 text-yellow-300" />
            <span>వాతావరణం</span>
          </div>

          {/* City Selector */}
          <select
            value={selectedCity.name}
            onChange={(e) => {
              const found = TELUGU_CITIES.find((c) => c.name === e.target.value);
              if (found) setSelectedCity(found);
            }}
            className="bg-black/30 text-white text-xs font-ramabhadra px-2.5 py-1 rounded-lg border border-white/30 focus:outline-none cursor-pointer"
          >
            {TELUGU_CITIES.map((c) => (
              <option key={c.name} value={c.name} className="text-gray-900 font-ramabhadra">
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {weatherLoading ? (
          <div className="py-6 text-center text-xs font-mallanna text-sky-200">
            వాతావరణ సమాచారం లోడ్ అవుతోంది...
          </div>
        ) : (
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-poppins text-4xl sm:text-5xl font-bold tracking-tight">
                  {temp ?? 31}°
                </span>
                <span className="text-sm font-poppins text-sky-200">C</span>
              </div>
              <p className="font-mallanna text-sm font-semibold text-sky-100 mt-1">
                {conditionText}
              </p>
            </div>

            <div className="space-y-1.5 text-xs font-mallanna text-sky-100 border-l border-white/20 pl-3">
              <div className="flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-sky-300" />
                <span>తేమ: {humidity}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-sky-300" />
                <span>గాలి: {windSpeed} కి.మీ/గం</span>
              </div>
              <div className="text-[11px] text-sky-200/80 mt-1">
                ప్రాంతం: {selectedCity.name}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. నేటి కార్టూన్ (DAILY EDITORIAL CARTOON) */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-ramabhadra text-base font-bold">
            <ImageIcon className="w-4 h-4 text-white" />
            <span>నేటి కార్టూన్</span>
          </div>
          <span className="text-xs font-mallanna text-amber-100 bg-amber-600/60 px-2 py-0.5 rounded">
            ఆల్ఫా వ్యంగ్య చిత్రం
          </span>
        </div>

        <div className="p-4">
          <div
            onClick={() => setCartoonModalOpen(true)}
            className="relative rounded-xl overflow-hidden cursor-pointer group bg-gray-100 aspect-[4/3] border border-gray-200"
          >
            <img
              src={cartoonImg}
              alt={cartoonHeadline}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="bg-white text-gray-900 font-ramabhadra text-xs font-bold px-3 py-1.5 rounded-lg shadow">
                పెద్దదిగా చూడండి 🔍
              </span>
            </div>
          </div>

          <div className="mt-3">
            <h4 className="font-ramabhadra text-sm font-bold text-gray-900 leading-snug">
              {cartoonHeadline}
            </h4>
            <p className="font-mallanna text-xs text-gray-600 mt-1 line-clamp-2 italic">
              "{cartoonPunchline}"
            </p>
          </div>

          <button
            onClick={handleShareCartoon}
            className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-ramabhadra font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>వాట్సాప్‌లో షేర్ చేయండి</span>
          </button>
        </div>
      </div>

      {/* 3. ఎక్కువగా చదివినవి (TRENDING / MOST READ) */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b-2 border-red-600 pb-2 mb-3">
          <Flame className="w-5 h-5 text-red-600 fill-red-600" />
          <h3 className="font-ramabhadra text-lg font-bold text-gray-900">
            ఎక్కువగా చదివినవి
          </h3>
        </div>

        <div className="divide-y divide-gray-100">
          {trendingPosts.map((post, idx) => {
            const hLine = post.headline?.telugu || post.headline?.english || '';
            const img = post.mediaUrl || post.mediaUrls?.[0];
            return (
              <div
                key={post.id}
                onClick={() => onSelectPost(post)}
                className="py-3 flex items-start gap-3 group cursor-pointer"
              >
                {/* Number Rank Badge */}
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-poppins font-bold shrink-0 mt-0.5 ${
                  idx === 0 ? 'bg-red-600 text-white' : idx === 1 ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <h4 className="font-ramabhadra text-sm font-semibold text-gray-900 group-hover:text-red-600 line-clamp-2 leading-snug">
                    {hLine}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mallanna mt-1">
                    <span>{formatRelativeTimeTelugu(post.timestamp)}</span>
                    {post.location && (
                      <>
                        <span>•</span>
                        <span>{post.location}</span>
                      </>
                    )}
                  </div>
                </div>

                {img && (
                  <img
                    src={img}
                    alt=""
                    className="w-14 h-12 object-cover rounded-lg shrink-0 group-hover:opacity-90"
                    onError={(e: any) => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. ఆల్ఫా లైవ్ పోల్ (LIVE OPINION POLL) */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm border border-slate-700">
        <div className="flex items-center gap-2 text-yellow-400 font-ramabhadra text-base font-bold mb-2">
          <HelpCircle className="w-5 h-5 text-yellow-400" />
          <span>ఆల్ఫా ఒపీనియన్ పోల్</span>
        </div>

        <p className="font-ramabhadra text-sm text-gray-100 leading-snug mb-4">
          రాష్ట్రంలో ప్రస్తుత అభివృద్ధి కార్యక్రమాల అమలుపై మీ అభిప్రాయం ఏమిటి?
        </p>

        <div className="space-y-2.5">
          {[
            { id: 0, text: 'చాలా సంతృప్తికరంగా ఉంది', percent: pollVotes[0] },
            { id: 1, text: 'ఇంకా మెరుగుపడాలి', percent: pollVotes[1] },
          ].map((opt) => {
            const isSelected = pollVoted === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleVote(opt.id)}
                disabled={pollVoted !== null}
                className={`w-full text-left p-3 rounded-xl border transition-all relative overflow-hidden ${
                  isSelected
                    ? 'border-yellow-400 bg-yellow-400/10'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-800/80'
                }`}
              >
                {/* Percentage fill bar when voted */}
                {pollVoted !== null && (
                  <div
                    className="absolute inset-y-0 left-0 bg-yellow-400/20 transition-all duration-700 pointer-events-none"
                    style={{ width: `${opt.percent}%` }}
                  ></div>
                )}

                <div className="relative z-10 flex items-center justify-between text-xs sm:text-sm font-ramabhadra">
                  <span className="flex items-center gap-1.5">
                    {isSelected && <CheckCircle className="w-4 h-4 text-yellow-400" />}
                    {opt.text}
                  </span>
                  {pollVoted !== null && (
                    <span className="font-poppins font-bold text-yellow-400">
                      {opt.percent}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {pollVoted !== null && (
          <p className="text-[11px] text-gray-400 font-mallanna mt-3 text-center">
            ధన్యవాదాలు! మీ అభిప్రాయం విజయవంతంగా నమోదైంది.
          </p>
        )}
      </div>

      {/* 5. ఆల్ఫా న్యూస్ మొబైల్ యాప్ డౌన్‌లోడ్ బ్యానర్ */}
      <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-2xl p-5 shadow-md text-center relative overflow-hidden">
        <Smartphone className="w-8 h-8 text-yellow-300 mx-auto mb-2" />
        <h4 className="font-ramabhadra text-lg font-bold">
          క్షణ క్షణ వార్తల కోసం
        </h4>
        <p className="font-mallanna text-xs text-red-100 mt-1 mb-4">
          ఆల్ఫా న్యూస్ ఆండ్రాయిడ్ యాప్‌ను డౌన్‌లోడ్ చేసుకోండి. వేగవంతమైన నోటిఫికేషన్లు పొందండి.
        </p>
        <a
          href="https://play.google.com/store/apps/details?id=com.alfanews.telugu"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-white text-red-700 hover:bg-yellow-300 hover:text-red-900 font-ramabhadra font-bold text-xs px-4 py-2.5 rounded-xl shadow transition-transform hover:scale-105"
        >
          <span>గూగుల్ ప్లే స్టోర్‌లో పొందండి</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* 6. SIDEBAR SPONSORED AD (300x250) */}
      <div className="w-full h-[250px] bg-gray-50 border border-gray-200 rounded-2xl flex flex-col items-center justify-center p-4 text-center text-gray-400">
        <span className="text-[10px] font-poppins uppercase tracking-widest text-gray-400 border border-gray-300 px-2 py-0.5 rounded mb-2">
          SPONSORED
        </span>
        <p className="font-ramabhadra text-sm font-semibold text-gray-700">
          మీ వ్యాపారాన్ని అభివృద్ధి చేసుకోండి
        </p>
        <p className="font-mallanna text-xs text-gray-500 mt-1 mb-3">
          ఆల్ఫా న్యూస్ లో ప్రకటనల కోసం నేడే సంప్రదించండి.
        </p>
        <a
          href="https://api.whatsapp.com/send?phone=919305980736&text=Hi%2C%20I%20want%20to%20advertise%20on%20AlfaNews%20Sidebar"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs bg-red-600 hover:bg-red-700 text-white font-ramabhadra font-bold px-3 py-1.5 rounded-lg shadow"
        >
          ప్రకటన ఇవ్వండి
        </a>
      </div>

      {/* CARTOON FULL LIGHTBOX MODAL */}
      {cartoonModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setCartoonModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="font-ramabhadra text-lg font-bold text-gray-900">
                {cartoonHeadline}
              </h3>
              <button
                onClick={() => setCartoonModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="my-4 max-h-[70vh] overflow-auto rounded-xl bg-gray-100">
              <img src={cartoonImg} alt={cartoonHeadline} className="w-full h-auto object-contain" />
            </div>

            <p className="font-mallanna text-sm text-gray-700 italic border-l-4 border-amber-500 pl-3 py-1">
              "{cartoonPunchline}"
            </p>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={handleShareCartoon}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-ramabhadra text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                వాట్సాప్‌లో షేర్ చేయండి
              </button>
              <button
                onClick={() => setCartoonModalOpen(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-ramabhadra text-xs font-bold px-4 py-2 rounded-lg"
              >
                మూసివేయండి
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
