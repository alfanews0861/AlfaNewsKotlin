import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Award, Download, Share2, Star, Sparkles, MapPin, Newspaper, ShieldCheck, X } from 'lucide-react';

// Unified wsrv.nl proxy helper for CORS-safe image capture in html2canvas
const getProxiedUrl = (url?: string) => {
  if (!url) return '';
  if (url.includes('firebasestorage.googleapis.com') || url.startsWith('data:') || url.includes('wsrv.nl')) return url;
  let cleanUrl = url.startsWith('//') ? `https:${url}` : url;
  return `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=webp&n=-1`;
};

export interface StarReporterData {
  id: string;
  name: string;
  photoUrl?: string;
  role?: string;
  district?: string;
  mandal?: string;
  points?: number;
  totalStories?: number;
}

interface StarReporterCardProps {
  data: StarReporterData;
  isModal?: boolean;
  onClose?: () => void;
}

export const StarReporterCard: React.FC<StarReporterCardProps> = ({ data, isModal, onClose }) => {
  const posterRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const reporterIdCode = `ALFA-${data.id.slice(-6).toUpperCase()}`;
  const totalNews = data.totalStories ?? 0;
  const points = data.points ?? (totalNews * 10);
  const mandal = data.mandal || 'స్థానిక మండలం';
  const district = data.district || 'ఆంధ్రప్రదేశ్ / తెలంగాణ';
  const photo = data.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'R')}&background=0D1B2A&color=E0E1DD&size=256`;

  const handleDownload = async () => {
    if (!posterRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(posterRef.current, {
        useCORS: true,
        scale: 2.5,
        backgroundColor: '#0a0f1d',
        logging: false
      } as any);
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `AlfaNews_Star_Reporter_${data.name.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Poster download error:', err);
      alert('పోస్టర్ డౌన్‌లోడ్ చేయడంలో సమస్య వచ్చింది.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!posterRef.current) return;
    setIsSharing(true);
    const shareText = `🌟 ఆల్ఫా న్యూస్ స్టార్ విలేకరి 🌟\n\n👤 విలేకరి: ${data.name}\n📍 మండలం: ${mandal} | జిల్లా: ${district}\n📰 వార్తా కథనాలు: ${totalNews} | 🏆 పాయింట్లు: ${points}\n\nప్రజల పక్షాన నిరంతరం నిజమైన వార్తలను అందించే మన మండల స్టార్ విలేకరి!\n📲 ఆల్ఫా న్యూస్ యాప్‌ను డౌన్‌లోడ్ చేసుకోండి:\nhttps://alfanews.app`;

    try {
      let shareFile: File | null = null;
      try {
        const canvas = await html2canvas(posterRef.current, {
          useCORS: true,
          scale: 2,
          backgroundColor: '#0a0f1d',
          logging: false
        } as any);
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png', 0.95));
        if (blob) {
          shareFile = new File([blob], `AlfaNews_Star_Reporter_${data.name.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
        }
      } catch (cErr) {
        console.warn('Canvas export failed, falling back to text share:', cErr);
      }

      if (shareFile && navigator.canShare && navigator.canShare({ files: [shareFile] })) {
        await navigator.share({
          files: [shareFile],
          title: `ఆల్ఫా న్యూస్ స్టార్ విలేకరి - ${data.name}`,
          text: shareText
        });
      } else if (navigator.share) {
        await navigator.share({
          title: `ఆల్ఫా న్యూస్ స్టార్ విలేకరి - ${data.name}`,
          text: shareText
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert('పోస్టర్ వివరాలు కాపీ చేయబడ్డాయి! మీరు వాట్సాప్‌లో పేస్ట్ చేయవచ్చు.');
      }
    } catch (sErr) {
      console.error('Share error:', sErr);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      {/* Visual Poster Element (Captured by html2canvas) */}
      <div
        ref={posterRef}
        className="w-full relative overflow-hidden rounded-3xl shadow-2xl p-6 flex flex-col items-center text-center text-white border-2 border-amber-400/40 font-mallanna"
        style={{
          background: 'linear-gradient(145deg, #070b14 0%, #0d172e 45%, #181335 100%)'
        }}
      >
        {/* Subtle Background Glows */}
        <div className="absolute -top-16 -left-16 w-44 h-44 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-44 h-44 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header / Branding */}
        <div className="flex items-center justify-between w-full border-b border-amber-400/20 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-black text-white text-base shadow-md">
              A
            </div>
            <div className="text-left">
              <span className="block font-ramabhadra text-amber-400 font-bold text-base leading-none">ఆల్ఫా న్యూస్</span>
              <span className="text-[10px] text-gray-400 tracking-wider uppercase font-sans">ALFA NEWS TELUGU</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-400/15 border border-amber-400/40 px-2.5 py-1 rounded-full">
            <Sparkles className="text-amber-400 w-3.5 h-3.5 animate-pulse" />
            <span className="text-xs font-bold text-amber-300 font-ramabhadra">అధికారిక గుర్తింపు</span>
          </div>
        </div>

        {/* Star Reporter Banner */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black px-4 py-1 rounded-full shadow-lg text-sm uppercase tracking-wide">
            <Star className="w-4 h-4 fill-slate-950" />
            <span>స్టార్ విలేకరి • STAR REPORTER</span>
            <Star className="w-4 h-4 fill-slate-950" />
          </div>
        </div>

        {/* Profile Image with Golden Frame */}
        <div className="relative mb-3">
          <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-amber-500 via-yellow-200 to-amber-600 shadow-xl">
            <img
              src={getProxiedUrl(photo)}
              alt={data.name}
              className="w-full h-full rounded-full object-cover bg-slate-900"
              crossOrigin="anonymous"
            />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-1 rounded-full border-2 border-slate-900 shadow" title="వెరిఫైడ్ రిపోర్టర్">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Reporter Name & Mandal */}
        <h2 className="font-ramabhadra text-2xl font-black text-white mb-1 tracking-tight">
          {data.name}
        </h2>
        <div className="flex items-center justify-center gap-1.5 text-amber-300 text-sm font-semibold mb-3">
          <MapPin className="w-4 h-4 text-red-400 shrink-0" />
          <span>{mandal} • {district}</span>
        </div>

        {/* ID Badge */}
        <div className="text-[11px] font-mono font-bold bg-slate-800/80 text-gray-300 px-3 py-0.5 rounded-md border border-slate-700 mb-4">
          ID: {reporterIdCode}
        </div>

        {/* Performance Statistics Grid */}
        <div className="grid grid-cols-2 gap-3 w-full mb-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-blue-400 text-xs font-semibold mb-1">
              <Newspaper className="w-3.5 h-3.5" />
              <span>వార్తా కథనాలు</span>
            </div>
            <span className="text-2xl font-black text-white">{totalNews}</span>
            <span className="text-[10px] text-gray-400">ప్రచురితమైనవి</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold mb-1">
              <Award className="w-3.5 h-3.5" />
              <span>స్టార్ పాయింట్లు</span>
            </div>
            <span className="text-2xl font-black text-amber-300">{points}</span>
            <span className="text-[10px] text-gray-400">గౌరవ పాయింట్లు</span>
          </div>
        </div>

        {/* Motivational Citation in Telugu */}
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-2.5 w-full mb-3">
          <p className="text-xs text-amber-200 leading-relaxed font-mallanna font-semibold">
            &ldquo;ప్రజల సమస్యలను వెలుగులోకి తెస్తూ, నిష్పక్షపాత వార్తలతో మన సమాజ సేవలో అగ్రగామిగా నిలిచిన మన మండల అధికారిక విలేకరి.&rdquo;
          </p>
        </div>

        {/* Poster Footer */}
        <div className="w-full flex items-center justify-between text-[11px] text-gray-400 border-t border-slate-800/80 pt-2 font-sans">
          <span>alfanews.app</span>
          <span className="text-amber-400 font-bold">హైపర్‌లోకల్ న్యూస్ నెట్‌వర్క్</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5 w-full mt-4">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 text-sm font-ramabhadra"
        >
          <Download className="w-4 h-4" />
          <span>{isDownloading ? 'డౌన్‌లోడ్ అవుతోంది...' : 'HD పోస్టర్ డౌన్‌లోడ్'}</span>
        </button>

        <button
          onClick={handleShare}
          disabled={isSharing}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 text-sm font-ramabhadra"
        >
          <Share2 className="w-4 h-4" />
          <span>{isSharing ? 'షేర్ అవుతోంది...' : 'వాట్సాప్ స్టేటస్ షేర్'}</span>
        </button>
      </div>
    </div>
  );
};

export const StarReporterPosterModal: React.FC<StarReporterCardProps> = (props) => {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full relative shadow-2xl">
        <button
          onClick={props.onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors z-10"
          title="మూసివేయి"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="mb-3 text-center">
          <h3 className="text-lg font-ramabhadra font-bold text-amber-400">స్టార్ విలేకరి సోషల్ పోస్టర్</h3>
          <p className="text-xs text-gray-400">సోషల్ మీడియా, వాట్సాప్ స్టేటస్ మరియు గుర్తింపు కోసం డౌన్‌లోడ్ చేయండి</p>
        </div>
        <StarReporterCard {...props} />
      </div>
    </div>
  );
};

export default StarReporterCard;
