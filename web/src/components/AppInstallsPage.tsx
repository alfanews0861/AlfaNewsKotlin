import React, { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { User, UserRole, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import {
  Download,
  Gift,
  Copy,
  Check,
  Phone,
  MessageSquare,
  RefreshCw,
  Star,
  Users,
  Smartphone,
  MapPin,
  Clock,
  Sparkles,
  Search,
  ExternalLink,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

const { collection, getDocs, query, orderBy, where, limit } = _firestore as any;

interface AppInstallsPageProps {
  currentUser?: User;
}

interface InstallReceipt {
  id: string;
  referrerUid: string;
  installId?: string;
  platform?: string;
  appVersion?: string;
  pointsAwarded?: number;
  installedAt?: any;
}

interface PromoterUser extends User {
  isReporterRole?: boolean;
}

const AppInstallsPage: React.FC<AppInstallsPageProps> = () => {
  const [promoters, setPromoters] = useState<PromoterUser[]>([]);
  const [recentInstalls, setRecentInstalls] = useState<InstallReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInstalls, setLoadingInstalls] = useState(false);
  const [copiedReferralId, setCopiedReferralId] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'ALL' | 'REPORTERS' | 'USERS' | 'LOGS'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');

  // Load Promoters (Reporters and General Users with referralCount)
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const usersMap = new Map<string, PromoterUser>();

      // 1. Fetch reporters (REPORTER, STAFF_REPORTER, REGIONAL_INCHARGE)
      try {
        const reporterSnap = await getDocs(
          query(
            collection(db, 'users'),
            where('role', 'in', [UserRole.REPORTER, UserRole.STAFF_REPORTER, UserRole.REGIONAL_INCHARGE]),
            limit(500)
          )
        );
        reporterSnap.docs.forEach((d: any) => {
          const data = d.data();
          const pUser: PromoterUser = {
            id: d.id,
            name: data.name || 'రిపోర్టర్',
            role: data.role || UserRole.REPORTER,
            phone: data.phone || '',
            district: data.district || '',
            assignedMandal: data.assignedMandal || data.mandal || '',
            referralCount: typeof data.referralCount === 'number' ? data.referralCount : 0,
            points: typeof data.points === 'number' ? data.points : 0,
            isReporterRole: true
          };
          usersMap.set(d.id, pUser);
        });
      } catch (err) {
        console.warn('Could not fetch reporters for referral tracking:', err);
      }

      // 2. Fetch users who have referralCount > 0 (includes regular subscribers/readers)
      try {
        const referralSnap = await getDocs(
          query(
            collection(db, 'users'),
            where('referralCount', '>', 0),
            orderBy('referralCount', 'desc'),
            limit(300)
          )
        );
        referralSnap.docs.forEach((d: any) => {
          const data = d.data();
          const existing = usersMap.get(d.id);
          const isReporterRole = existing
            ? existing.isReporterRole
            : (data.role === UserRole.REPORTER || data.role === UserRole.STAFF_REPORTER || data.role === UserRole.REGIONAL_INCHARGE);

          usersMap.set(d.id, {
            id: d.id,
            name: data.name || (isReporterRole ? 'రిపోర్టర్' : 'వినియోగదారుడు'),
            role: data.role || (isReporterRole ? UserRole.REPORTER : UserRole.SUBSCRIBER),
            phone: data.phone || existing?.phone || '',
            district: data.district || existing?.district || '',
            assignedMandal: data.assignedMandal || data.mandal || existing?.assignedMandal || '',
            referralCount: typeof data.referralCount === 'number' ? data.referralCount : (existing?.referralCount || 0),
            points: typeof data.points === 'number' ? data.points : (existing?.points || 0),
            isReporterRole
          });
        });
      } catch (err) {
        console.warn('Could not query referralCount > 0 from users:', err);
      }

      setPromoters(Array.from(usersMap.values()));
    } catch (error) {
      console.error('Error fetching referral promoters:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Live App Install Receipts from app_installs collection
  const fetchInstallReceipts = useCallback(async () => {
    setLoadingInstalls(true);
    try {
      const q = query(
        collection(db, 'app_installs'),
        orderBy('installedAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      const list: InstallReceipt[] = snap.docs.map((d: any) => ({
        id: d.id,
        ...d.data()
      }));
      setRecentInstalls(list);
    } catch (err) {
      console.warn('Could not fetch app_installs receipts:', err);
    } finally {
      setLoadingInstalls(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchInstallReceipts();
  }, [fetchData, fetchInstallReceipts]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let reporterInstalls = 0;
    let userInstalls = 0;
    let activePromoters = 0;

    promoters.forEach(p => {
      const count = p.referralCount || 0;
      if (count > 0) activePromoters++;
      if (p.isReporterRole) {
        reporterInstalls += count;
      } else {
        userInstalls += count;
      }
    });

    const totalFromPromoters = reporterInstalls + userInstalls;
    const totalInstalls = Math.max(totalFromPromoters, recentInstalls.length);
    const totalPoints = totalInstalls * 50;

    return {
      totalInstalls,
      reporterInstalls,
      userInstalls,
      activePromoters,
      totalPoints,
      receiptsCount: recentInstalls.length
    };
  }, [promoters, recentInstalls]);

  // Copy referral Play Store link
  const copyReferralLink = (uid: string) => {
    const playStoreLink = `https://play.google.com/store/apps/details?id=com.alfanews.telugu&referrer=utm_source%3Dshare%26utm_medium%3Dapp%26utm_campaign%3Dreferral_${uid}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(playStoreLink);
      setCopiedReferralId(uid);
      setTimeout(() => setCopiedReferralId(null), 2500);
    }
  };

  const getCleanPhone = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/\D/g, '').slice(-10);
  };

  // Filtered promoter list
  const filteredPromoters = useMemo(() => {
    const lower = searchTerm.toLowerCase().trim();

    return promoters
      .filter(p => {
        // Tab Filter
        if (activeTab === 'REPORTERS' && !p.isReporterRole) return false;
        if (activeTab === 'USERS' && p.isReporterRole) return false;

        // District Filter
        if (selectedDistrict !== 'ALL') {
          const dist = (p.district || '').trim();
          if (dist !== selectedDistrict.trim()) return false;
        }

        // Search Filter
        if (lower) {
          const matchName = (p.name || '').toLowerCase().includes(lower);
          const matchPhone = (p.phone || '').toLowerCase().includes(lower);
          const matchDistrict = (p.district || '').toLowerCase().includes(lower);
          const matchMandal = (p.assignedMandal || p.mandal || '').toLowerCase().includes(lower);
          const matchId = (p.id || '').toLowerCase().includes(lower);
          return matchName || matchPhone || matchDistrict || matchMandal || matchId;
        }

        return true;
      })
      .sort((a, b) => (b.referralCount || 0) - (a.referralCount || 0));
  }, [promoters, activeTab, selectedDistrict, searchTerm]);

  return (
    <div className="w-full space-y-6 font-mallanna text-gray-900">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-800 via-emerald-800 to-cyan-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-ramabhadra tracking-wide mb-2 text-emerald-100">
              <Sparkles size={13} className="text-amber-300" />
              <span>Alfa News యాప్ ప్రమోషన్ & ఇన్స్టాల్ ట్రాకర్</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-ramabhadra font-black text-white tracking-wide">
              యాప్ ఇన్‌స్టాల్స్ & రెఫరల్ ట్రాకింగ్ (App Installs Report)
            </h1>
            <p className="text-sm text-teal-100 mt-1 max-w-2xl">
              మన రిపోర్టర్లు మరియు యూజర్లు వార్తలను షేర్ చేసినప్పుడు జతచేసిన ట్రాకింగ్ కోడ్ ద్వారా వచ్చిన మొత్తం యాప్ డౌన్‌లోడ్లు, పాయింట్లు మరియు లైవ్ రికార్డులు.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchData();
                fetchInstallReceipts();
              }}
              disabled={loading || loadingInstalls}
              className="bg-white/20 hover:bg-white/30 text-white font-ramabhadra text-sm px-4 py-2.5 rounded-2xl backdrop-blur-sm border border-white/20 flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading || loadingInstalls ? 'animate-spin' : ''} />
              <span>{loading || loadingInstalls ? 'లోడ్ అవుతోంది...' : 'డేటా రిఫ్రెష్'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Installs */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-5 rounded-2xl shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-100 text-xs font-ramabhadra uppercase tracking-wider">మొత్తం ఇన్‌స్టాల్స్</p>
              <h3 className="text-3xl font-ramabhadra font-black mt-1">{metrics.totalInstalls}</h3>
              <p className="text-xs text-emerald-100 mt-1">ప్లే స్టోర్ డౌన్‌లోడ్లు</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Download className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Reporter Installs */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-700 text-white p-5 rounded-2xl shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-xs font-ramabhadra uppercase tracking-wider">రిపోర్టర్ల ఇన్‌స్టాల్స్</p>
              <h3 className="text-3xl font-ramabhadra font-black mt-1">{metrics.reporterInstalls}</h3>
              <p className="text-xs text-blue-100 mt-1">డెస్క్ & ఫీల్డ్ రిపోర్టర్లు</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* General User Installs */}
        <div className="bg-gradient-to-br from-purple-500 to-fuchsia-700 text-white p-5 rounded-2xl shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-purple-100 text-xs font-ramabhadra uppercase tracking-wider">యూజర్ల ఇన్‌స్టాల్స్</p>
              <h3 className="text-3xl font-ramabhadra font-black mt-1">{metrics.userInstalls}</h3>
              <p className="text-xs text-purple-100 mt-1">సాధారణ పాఠకులు / పౌరులు</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Total Points Awarded */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-5 rounded-2xl shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-amber-100 text-xs font-ramabhadra uppercase tracking-wider">పంపిణీ పాయింట్లు</p>
              <h3 className="text-3xl font-ramabhadra font-black mt-1">{metrics.totalPoints.toLocaleString()}</h3>
              <p className="text-xs text-amber-100 mt-1">50 పాయింట్లు / ఇన్‌స్టాల్</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Gift className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Live Receipts Count */}
        <div className="bg-gradient-to-br from-cyan-600 to-blue-700 text-white p-5 rounded-2xl shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-cyan-100 text-xs font-ramabhadra uppercase tracking-wider">లైవ్ రసీదులు</p>
              <h3 className="text-3xl font-ramabhadra font-black mt-1">{metrics.receiptsCount}</h3>
              <p className="text-xs text-cyan-100 mt-1">ఇటీవలి లాగ్ రికార్డులు</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-5">
        {/* Navigation Tabs & Search / Filter Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 border-b border-gray-100 pb-5">
          {/* Segments */}
          <div className="flex flex-wrap bg-gray-100 p-1.5 rounded-2xl gap-1">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-xl font-ramabhadra text-sm font-bold transition-all ${
                activeTab === 'ALL'
                  ? 'bg-teal-700 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              👥 అందరూ ({promoters.length})
            </button>
            <button
              onClick={() => setActiveTab('REPORTERS')}
              className={`px-4 py-2 rounded-xl font-ramabhadra text-sm font-bold transition-all ${
                activeTab === 'REPORTERS'
                  ? 'bg-teal-700 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              🪪 రిపోర్టర్లు ({promoters.filter(p => p.isReporterRole).length})
            </button>
            <button
              onClick={() => setActiveTab('USERS')}
              className={`px-4 py-2 rounded-xl font-ramabhadra text-sm font-bold transition-all ${
                activeTab === 'USERS'
                  ? 'bg-teal-700 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              👤 వినియోగదారులు ({promoters.filter(p => !p.isReporterRole).length})
            </button>
            <button
              onClick={() => setActiveTab('LOGS')}
              className={`px-4 py-2 rounded-xl font-ramabhadra text-sm font-bold transition-all ${
                activeTab === 'LOGS'
                  ? 'bg-teal-700 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              ⚡ లైవ్ ఇన్‌స్టాల్ లాగ్‌లు ({recentInstalls.length})
            </button>
          </div>

          {/* Search & District Dropdown */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="పేరు, ఫోన్, మండలం లేదా UID..."
                value={searchTerm}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-xl py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-teal-500 bg-white outline-none"
              />
            </div>

            <select
              value={selectedDistrict}
              onChange={e => setSelectedDistrict(e.target.value)}
              className="border border-gray-300 rounded-xl py-2 px-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-teal-500 bg-white outline-none"
            >
              <option value="ALL">అన్ని జిల్లాలు (All Districts)</option>
              <optgroup label="తెలంగాణ (TS)">
                {TS_DISTRICTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </optgroup>
              <optgroup label="ఆంధ్రప్రదేశ్ (AP)">
                {AP_DISTRICTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* TAB: PROMOTERS LEADERBOARD TABLE */}
        {activeTab !== 'LOGS' && (
          <div className="overflow-x-auto w-full border border-gray-200 rounded-2xl shadow-sm bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs font-ramabhadra text-gray-700 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3.5 text-center w-14">ర్యాంక్</th>
                  <th scope="col" className="px-4 py-3.5 text-left">వ్యక్తి పేరు / హోదా</th>
                  <th scope="col" className="px-4 py-3.5 text-left">జిల్లా & మండలం</th>
                  <th scope="col" className="px-4 py-3.5 text-left">సంప్రదింపు (Phone)</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-emerald-700">ఇన్‌స్టాల్స్ సంఖ్య</th>
                  <th scope="col" className="px-4 py-3.5 text-center text-amber-700">క్రెడిట్ పాయింట్లు</th>
                  <th scope="col" className="px-4 py-3.5 text-right">ట్రాకింగ్ లింక్</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 font-ramabhadra">
                      <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-teal-600" />
                      ప్రమోటర్ల వివరాలు లోడ్ అవుతున్నాయి...
                    </td>
                  </tr>
                ) : filteredPromoters.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 font-ramabhadra font-bold">
                      ఎలాంటి రికార్డులు కనుగొనబడలేదు.
                    </td>
                  </tr>
                ) : (
                  filteredPromoters.map((p, idx) => {
                    const cleanPhone = getCleanPhone(p.phone);
                    const rankBadge = idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`;
                    const isTopThree = idx < 3;
                    const count = p.referralCount || 0;

                    return (
                      <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${isTopThree && count > 0 ? 'bg-amber-50/20' : ''}`}>
                        {/* Rank */}
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span
                            className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-black ${
                              idx === 0
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : idx === 1
                                ? 'bg-slate-200 text-slate-800'
                                : idx === 2
                                ? 'bg-orange-100 text-orange-900'
                                : 'text-gray-500 font-mono'
                            }`}
                          >
                            {rankBadge}
                          </span>
                        </td>

                        {/* Name & Role */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div
                              className={`h-9 w-9 rounded-full font-bold flex items-center justify-center shrink-0 ${
                                p.isReporterRole
                                  ? 'bg-teal-100 text-teal-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {p.name ? p.name.charAt(0).toUpperCase() : p.isReporterRole ? 'R' : 'U'}
                            </div>
                            <div className="ml-3">
                              <span className="text-sm font-bold text-gray-900 block font-ramabhadra">{p.name}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    p.isReporterRole
                                      ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                      : 'bg-purple-50 text-purple-700 border border-purple-200'
                                  }`}
                                >
                                  {p.isReporterRole ? 'రిపోర్టర్' : 'సాధారణ వినియోగదారుడు'}
                                </span>
                                {p.role === UserRole.STAFF_REPORTER && (
                                  <span className="text-[10px] bg-red-50 text-red-700 font-bold px-1.5 py-0.5 rounded">స్టాఫ్</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* District & Mandal */}
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-700 font-semibold">
                          <div className="flex items-center gap-1">
                            <MapPin size={13} className="text-red-500 shrink-0" />
                            <span>
                              {p.district || 'ఆంధ్ర/తెలంగాణ'}
                              {p.assignedMandal || p.mandal ? ` - ${p.assignedMandal || p.mandal}` : ''}
                            </span>
                          </div>
                        </td>

                        {/* Phone & WhatsApp */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {p.phone ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-gray-900 text-xs">{p.phone}</span>
                              <a
                                href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
                                  `నమస్కారం ${p.name} గారు, Alfa News యాప్ ప్రమోషన్‌లో మీ లింక్ ద్వారా ${count} మంది యాప్ ఇన్‌స్టాల్ చేసుకున్నారు. మీ క్రెడిట్ పాయింట్లు: ${count * 50}. మీకు మా అభినందనలు! - Alfa News టీమ్`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-green-600 hover:text-green-800 p-1 hover:bg-green-50 rounded-lg transition-colors"
                                title="వాట్సాప్ అభినందన సందేశం పంపండి"
                              >
                                <MessageSquare size={15} />
                              </a>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs font-mono">UID: {p.id.slice(0, 8)}...</span>
                          )}
                        </td>

                        {/* Total Installs */}
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-black font-ramabhadra ${
                              count > 0
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            📱 {count}
                          </span>
                        </td>

                        {/* Points */}
                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-black text-amber-700 font-mono">
                          +{count * 50} pts
                        </td>

                        {/* Copy Link */}
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => copyReferralLink(p.id)}
                            className="bg-gray-100 hover:bg-teal-50 text-gray-700 hover:text-teal-700 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-gray-200 inline-flex items-center gap-1 transition-all"
                            title="ఈ యూజర్ యొక్క ప్రత్యేక Play Store డౌన్‌లోడ్ లింక్ కాపీ చేయండి"
                          >
                            {copiedReferralId === p.id ? (
                              <>
                                <Check size={12} className="text-green-600" />
                                <span className="text-green-600 font-ramabhadra">కాపీ అయింది!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span className="font-ramabhadra">లింక్ కాపీ</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB: LIVE APP INSTALL RECEIPTS LOG */}
        {activeTab === 'LOGS' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h4 className="font-ramabhadra text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>⚡ ప్రత్యక్ష యాప్ ఇన్‌స్టాల్ రసీదులు (Live App Install Logs)</span>
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  వినియోగదారులు మరియు రిపోర్టర్ల షేర్ లింక్‌ల ద్వారా తాజా యాప్ డౌన్‌లోడ్‌ల ప్రత్యక్ష సర్వర్ రికార్డులు (`app_installs` కలెక్షన్).
                </p>
              </div>
              <button
                onClick={fetchInstallReceipts}
                disabled={loadingInstalls}
                className="bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-ramabhadra font-bold px-3 py-1.5 rounded-xl border border-teal-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={loadingInstalls ? 'animate-spin' : ''} />
                <span>రిఫ్రెష్</span>
              </button>
            </div>

            {loadingInstalls ? (
              <p className="text-center text-gray-500 py-10 text-sm font-ramabhadra">లైవ్ రికార్డులు లోడ్ అవుతున్నాయి...</p>
            ) : recentInstalls.length === 0 ? (
              <p className="text-center text-gray-500 py-10 text-sm font-ramabhadra font-bold">ఇటీవలి ఇన్‌స్టాల్ రసీదులు ఇంకా లేవు.</p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50 text-gray-600 uppercase font-bold font-ramabhadra">
                    <tr>
                      <th className="px-3.5 py-3 text-left">సమయం & తేదీ</th>
                      <th className="px-3.5 py-3 text-left">ప్రమోటర్ (రిపోర్టర్ / యూజర్)</th>
                      <th className="px-3.5 py-3 text-left">ప్లాట్‌ఫారమ్</th>
                      <th className="px-3.5 py-3 text-left">యాప్ వెర్షన్</th>
                      <th className="px-3.5 py-3 text-center">క్రెడిట్ పాయింట్లు</th>
                      <th className="px-3.5 py-3 text-right">ఇన్‌స్టాల్ ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {recentInstalls.map((inst: InstallReceipt) => {
                      const promoter = promoters.find(p => p.id === inst.referrerUid);
                      const promoterName = promoter
                        ? `${promoter.name} (${promoter.isReporterRole ? 'రిపోర్టర్' : 'యూజర్'} - ${promoter.district || 'TS/AP'})`
                        : (inst.referrerUid || 'N/A');

                      let timeStr = 'ఇప్పుడే';
                      if (inst.installedAt) {
                        try {
                          const dt = inst.installedAt.toDate
                            ? inst.installedAt.toDate()
                            : inst.installedAt.toMillis
                            ? new Date(inst.installedAt.toMillis())
                            : new Date(inst.installedAt);
                          timeStr = dt.toLocaleString('te-IN', {
                            timeZone: 'Asia/Kolkata',
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                        } catch {
                          timeStr = 'ఇప్పుడే';
                        }
                      }

                      return (
                        <tr key={inst.id} className="hover:bg-gray-50">
                          <td className="px-3.5 py-2.5 whitespace-nowrap text-gray-700 font-semibold">{timeStr}</td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap font-bold text-gray-900 font-ramabhadra">
                            <span className="flex items-center gap-1.5">
                              {promoter?.isReporterRole ? (
                                <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                              )}
                              {promoterName}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap text-gray-600 uppercase font-mono">{inst.platform || 'android'}</td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap text-gray-500 font-mono">{inst.appVersion || '-'}</td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap text-center font-black text-emerald-700 font-mono">
                            +{inst.pointsAwarded || 50} pts
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap text-right font-mono text-[10px] text-gray-400 truncate max-w-[140px]">
                            {inst.installId || inst.id}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppInstallsPage;
