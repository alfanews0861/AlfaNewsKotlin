import React from 'react';
import { Smartphone, Mail, Phone, MapPin, Globe, ExternalLink, Heart } from 'lucide-react';

interface PortalFooterProps {
  onSelectCategory: (category: string) => void;
  onOpenPolicyPage: (route: string) => void;
  onOpenClassifieds: () => void;
}

export const PortalFooter: React.FC<PortalFooterProps> = ({
  onSelectCategory,
  onOpenPolicyPage,
  onOpenClassifieds,
}) => {
  return (
    <footer className="w-full bg-slate-950 text-gray-300 pt-12 pb-8 border-t-4 border-red-600 mt-16 font-mallanna">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-slate-800">
          {/* COLUMN 1: BRAND & ABOUT */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 text-white font-ramabhadra text-2xl font-bold shadow-md">
                ఆ
              </div>
              <div>
                <span className="font-ramabhadra text-2xl font-bold text-white tracking-tight">
                  ఆల్ఫా <span className="text-red-500">న్యూస్</span>
                </span>
                <p className="text-[10px] text-gray-400 font-poppins tracking-widest uppercase">
                  ALFA NEWS TELUGU
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              ఆల్ఫా న్యూస్ - తెలుగు ప్రజల కోసం నిరంతరం శ్రమించే స్వతంత్ర వార్తా మాధ్యమం. తాజా వార్తలు, వాస్తవ నివేదికలు, లోతైన విశ్లేషణలను ప్రజలకు నిష్పాక్షికంగా అందించడమే మా ధ్యేయం.
            </p>

            {/* Mobile App Download Card */}
            <div className="pt-2">
              <a
                href="https://play.google.com/store/apps/details?id=com.alfanews.telugu"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white px-3.5 py-2 rounded-xl transition-all hover:scale-105 group"
              >
                <Smartphone className="w-5 h-5 text-red-500" />
                <div className="text-left font-poppins">
                  <span className="block text-[9px] uppercase tracking-wider text-gray-400">GET IT ON</span>
                  <span className="block text-xs font-bold text-gray-100 group-hover:text-red-400">Google Play</span>
                </div>
              </a>
            </div>
          </div>

          {/* COLUMN 2: CATEGORIES */}
          <div>
            <h3 className="font-ramabhadra text-base font-bold text-white border-b-2 border-red-600 pb-1.5 mb-4 inline-block">
              వార్తా వర్గాలు
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => onSelectCategory('all')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • తాజా వార్తలు (Latest News)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('స్పెషల్ స్టోరీస్')}
                  className="hover:text-yellow-400 text-yellow-300 font-semibold transition-colors text-left flex items-center gap-1"
                >
                  ⭐ స్పెషల్ స్టోరీస్ (Special Stories)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('ఆంధ్రప్రదేశ్')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • ఆంధ్రప్రదేశ్ (Andhra Pradesh)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('తెలంగాణ')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • తెలంగాణ (Telangana)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('జిల్లా వార్త')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • జిల్లా వార్తలు (Districts News)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('రాజకీయాలు')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • రాజకీయం (Politics)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('సినిమా')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • సినిమా & ఎంటర్‌టైన్‌మెంట్ (Cinema)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectCategory('స్పోర్ట్స్')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • క్రీడలు (Sports)
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenClassifieds}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • క్లాసిఫైడ్స్ (Classifieds)
                </button>
              </li>
            </ul>
          </div>

          {/* COLUMN 3: POLICY & LEGAL PAGES */}
          <div>
            <h3 className="font-ramabhadra text-base font-bold text-white border-b-2 border-red-600 pb-1.5 mb-4 inline-block">
              ముఖ్యమైన లింకులు
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => onOpenPolicyPage('about')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • మా గురించి (About Us)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenPolicyPage('contact')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • సంప్రదించండి (Contact Us)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenPolicyPage('privacy-policy')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • ప్రైవసీ పాలసీ (Privacy Policy)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenPolicyPage('terms')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • నిబంధనలు (Terms & Conditions)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenPolicyPage('disclaimer')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • డిస్క్లైమర్ (Disclaimer)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenPolicyPage('ad-policy')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • ప్రకటనల విధానం (Ad Policy)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenPolicyPage('content-policy')}
                  className="hover:text-red-400 transition-colors text-left"
                >
                  • కంటెంట్ పాలసీ (Content Policy)
                </button>
              </li>
            </ul>
          </div>

          {/* COLUMN 4: CONTACT & SOCIAL CHANNELS */}
          <div className="space-y-4">
            <h3 className="font-ramabhadra text-base font-bold text-white border-b-2 border-red-600 pb-1.5 mb-4 inline-block">
              సంప్రదింపులు
            </h3>

            <div className="space-y-3 text-xs sm:text-sm text-gray-400">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>ఆల్ఫా న్యూస్ నెట్‌వర్క్, అమరావతి & హైదరాబాద్, ఆంధ్రప్రదేశ్ మరియు తెలంగాణ.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-red-500 shrink-0" />
                <a href="mailto:contact@alfanews.in" className="hover:text-white transition-colors">
                  contact@alfanews.in
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-red-500 shrink-0" />
                <a href="tel:9305980736" className="hover:text-white transition-colors font-poppins">
                  +91 93059 80736
                </a>
              </div>
            </div>

            {/* Social Media Links */}
            <div className="pt-2">
              <span className="block text-xs font-ramabhadra text-gray-300 font-bold mb-2">
                మమ్మల్ని అనుసరించండి:
              </span>
              <div className="flex items-center gap-2">
                <a
                  href="https://whatsapp.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-transform hover:scale-110 shadow"
                  title="WhatsApp"
                >
                  💬
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-transform hover:scale-110 shadow"
                  title="YouTube"
                >
                  ▶
                </a>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-transform hover:scale-110 shadow"
                  title="Facebook"
                >
                  f
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-transform hover:scale-110 shadow"
                  title="Twitter / X"
                >
                  𝕏
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Disclaimer */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>© 2026 Alfa News Telugu. సర్వహక్కులు ప్రత్యేకించబడినవి.</p>
          <p className="flex items-center gap-1">
            తెలుగు ప్రజల కోసం రూపొందించబడింది <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
          </p>
        </div>
      </div>
    </footer>
  );
};

export default PortalFooter;
