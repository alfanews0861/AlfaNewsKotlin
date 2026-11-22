import React, { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Bell,
  BellOff,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Search,
  Star,
  Trash2,
  UserMinus,
} from 'lucide-react';
import { UserRole } from '../../types';
import { ALL_STATE_CODES, EDITIONS } from '../../data/editions';
import { getOptimizedImageUrl } from '../../utils/imageHelper';
import {
  buildReportersCsv,
  formatDisplayPhone,
  getClean10DigitPhone,
  paginateItems,
  STAGE_META_TE,
} from '../../utils/reporterManagementHelpers';
import { formatIstShortDate, getIstDateKey } from '../../utils/reporterTracking';
import { ReporterWithCounts, SortField, StageFilter } from './types';

interface ActiveReportersTabProps {
  reporters: ReporterWithCounts[];
  loading: boolean;
  updatingIds: Record<string, boolean>;
  onSelectReporter: (reporter: ReporterWithCounts) => void;
  onEditLocation: (reporter: ReporterWithCounts) => void;
  onRoleChangeRequest: (reporter: ReporterWithCounts, nextRole: UserRole) => void;
  onToggleExemption: (reporter: ReporterWithCounts) => void;
  onOpenPoster: (reporter: ReporterWithCounts) => void;
  onDowngradeRequest: (reporter: ReporterWithCounts) => void;
  onDeleteRequest: (reporter: ReporterWithCounts) => void;
  onOpenDeskChat?: (reporterId: string) => void;
  onExportSuccess: (count: number) => void;
}

const ReporterAvatar: React.FC<{ name?: string; photoUrl?: string }> = ({ name, photoUrl }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name || 'R').trim().charAt(0).toUpperCase();

  if (photoUrl && !imgFailed) {
    return (
      <img
        src={getOptimizedImageUrl(photoUrl, 96)}
        alt={name || 'Reporter'}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="h-9 w-9 rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100"
      />
    );
  }

  return (
    <div className="h-9 w-9 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-bold flex items-center justify-center shrink-0 text-sm">
      {initial}
    </div>
  );
};

const ActiveReportersTab: React.FC<ActiveReportersTabProps> = ({
  reporters,
  loading,
  updatingIds,
  onSelectReporter,
  onEditLocation,
  onRoleChangeRequest,
  onToggleExemption,
  onOpenPoster,
  onDowngradeRequest,
  onDeleteRequest,
  onOpenDeskChat,
  onExportSuccess,
}) => {
  const [search, setSearch] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');
  const [stageFilter, setStageFilter] = useState<StageFilter>('ALL');
  const [sortField, setSortField] = useState<SortField>('totalNewsCount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const kpis = useMemo(() => {
    let activeCount = 0;
    let day3Count = 0;
    let day7Count = 0;
    let admin10PlusCount = 0;
    let exemptCount = 0;

    for (const r of reporters) {
      if (r.inactivityStage === 'EXEMPT') exemptCount++;
      else if (r.inactivityStage === 'ADMIN_ALERTED_10D') admin10PlusCount++;
      else if (r.inactivityStage === 'REMINDED_7D') day7Count++;
      else if (r.inactivityStage === 'REMINDED_3D') day3Count++;
      else activeCount++;
    }

    return {
      total: reporters.length,
      activeCount,
      day3Count,
      day7Count,
      reminder3to9Count: day3Count + day7Count,
      admin10PlusCount,
      exemptCount,
    };
  }, [reporters]);

  const filteredReporters = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = reporters.filter((u) => {
      if (q) {
        const matchesText =
          (u.name || '').toLowerCase().includes(q) ||
          (u.phone || '').toLowerCase().includes(q) ||
          (u.district || '').toLowerCase().includes(q) ||
          (u.assignedMandal || u.mandal || '').toLowerCase().includes(q);
        if (!matchesText) return false;
      }

      if (selectedDistrict !== 'ALL' && (u.district || '').trim() !== selectedDistrict.trim()) {
        return false;
      }

      if (stageFilter !== 'ALL') {
        if (stageFilter === 'ACTIVE') {
          return u.inactivityStage === 'ACTIVE' || u.inactivityStage === 'NEW_NO_POSTS';
        }
        return u.inactivityStage === stageFilter;
      }

      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortField === 'name' || sortField === 'state' || sortField === 'district') {
        const aVal = String(a[sortField] || '').toLowerCase();
        const bVal = String(b[sortField] || '').toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = Number((a as any)[sortField] || 0);
      const bNum = Number((b as any)[sortField] || 0);
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });

    return list;
  }, [reporters, search, selectedDistrict, stageFilter, sortField, sortDirection]);

  // Reset to page 1 whenever filters or pageSize change
  useEffect(() => {
    setPage(1);
  }, [search, selectedDistrict, stageFilter, sortField, sortDirection, pageSize]);

  const pagination = useMemo(
    () => paginateItems(filteredReporters, page, pageSize),
    [filteredReporters, page, pageSize]
  );

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'name' || field === 'district' ? 'asc' : 'desc');
    }
  };

  const handleExportCsv = () => {
    const csvContent = buildReportersCsv(filteredReporters);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alfanews-reporters-${getIstDateKey(Date.now())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onExportSuccess(filteredReporters.length);
  };

  const hasActiveFilters = Boolean(search || selectedDistrict !== 'ALL' || stageFilter !== 'ALL');

  return (
    <div className="space-y-4">
      {/* Clickable 4-KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStageFilter('ALL')}
          className={`text-left bg-white rounded-xl p-4 border transition-colors ${
            stageFilter === 'ALL'
              ? 'border-teal-700 ring-1 ring-teal-700'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-semibold text-slate-500">మొత్తం యాక్టివ్ రిపోర్టర్లు</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-slate-900 mt-1">
            {kpis.total}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            మినహాయింపు: <span className="font-mono tabular-nums font-bold text-slate-700">{kpis.exemptCount}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStageFilter(stageFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
          className={`text-left bg-white rounded-xl p-4 border transition-colors ${
            stageFilter === 'ACTIVE'
              ? 'border-emerald-700 ring-1 ring-emerald-700'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-semibold text-slate-500">చురుకుగా (0–2 రోజులు)</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-emerald-700 mt-1">
            {kpis.activeCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">క్రమం తప్పకుండా వార్తలు</div>
        </button>

        <button
          type="button"
          onClick={() => setStageFilter(stageFilter === 'REMINDED_3D' ? 'REMINDED_7D' : 'REMINDED_3D')}
          className={`text-left bg-white rounded-xl p-4 border transition-colors ${
            stageFilter === 'REMINDED_3D' || stageFilter === 'REMINDED_7D'
              ? 'border-amber-700 ring-1 ring-amber-700'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-semibold text-slate-500">రిమైండర్ దశ (3–9 రోజులు)</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-amber-700 mt-1">
            {kpis.reminder3to9Count}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
            3–6d: {kpis.day3Count} · 7–9d: {kpis.day7Count}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setStageFilter(stageFilter === 'ADMIN_ALERTED_10D' ? 'ALL' : 'ADMIN_ALERTED_10D')
          }
          className={`text-left bg-white rounded-xl p-4 border transition-colors ${
            stageFilter === 'ADMIN_ALERTED_10D'
              ? 'border-rose-700 ring-1 ring-rose-700'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs font-semibold text-slate-500">అడ్మిన్ పరిశీలన (10+ రోజులు)</div>
          <div className="text-2xl font-mono tabular-nums font-bold text-rose-700 mt-1">
            {kpis.admin10PlusCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">నేరుగా సంప్రదించాల్సినవారు</div>
        </button>
      </div>

      {/* Filter, Search, Sort & CSV Export Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(
              [
                { id: 'ALL', label: `అందరు (${kpis.total})` },
                { id: 'ACTIVE', label: `చురుకైనవారు (${kpis.activeCount})` },
                { id: 'REMINDED_3D', label: `3–6 రోజులు (${kpis.day3Count})` },
                { id: 'REMINDED_7D', label: `7–9 రోజులు (${kpis.day7Count})` },
                { id: 'ADMIN_ALERTED_10D', label: `10+ రోజులు (${kpis.admin10PlusCount})` },
                { id: 'EXEMPT', label: `మినహాయింపు (${kpis.exemptCount})` },
              ] as const
            ).map((seg) => (
              <button
                key={seg.id}
                type="button"
                onClick={() => setStageFilter(seg.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  stageFilter === seg.id
                    ? 'bg-white text-teal-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {seg.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredReporters.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
            title="ప్రస్తుత ఫిల్టర్ చేసిన రిపోర్టర్ల జాబితాను CSV ఫైల్‌గా డౌన్‌లోడ్ చేయండి"
          >
            <Download size={14} className="text-teal-700" />
            <span>CSV డౌన్‌లోడ్ ({filteredReporters.length})</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Search */}
          <div className="md:col-span-5 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="పేరు, ఫోన్, జిల్లా లేదా మండలం వెతకండి..."
              value={search}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-teal-600 bg-white text-slate-900 outline-none"
            />
          </div>

          {/* District */}
          <div className="md:col-span-3">
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-teal-600 bg-white text-slate-900 font-semibold outline-none"
            >
              <option value="ALL">అన్ని జిల్లాలు (All 9 States)</option>
              {ALL_STATE_CODES.map((code) => (
                <optgroup key={code} label={`${EDITIONS[code].nameNative} (${code})`}>
                  {EDITIONS[code].districts.map((d) => (
                    <option key={`${code}_${d}`} value={d}>
                      {d}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Sort Field + Direction */}
          <div className="md:col-span-4 flex items-center gap-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="flex-1 border border-slate-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-teal-600 bg-white text-slate-900 font-semibold outline-none"
            >
              <option value="totalNewsCount">క్రమం: మొత్తం వార్తలు</option>
              <option value="todayNewsCount">క్రమం: ఈ రోజు వార్తలు</option>
              <option value="lastWeekNewsCount">క్రమం: గత 7 రోజులు</option>
              <option value="daysInactive">క్రమం: వార్త వేయని రోజులు</option>
              <option value="lastPostTimestamp">క్రమం: చివరి వార్త తేదీ</option>
              <option value="referralCount">క్రమం: యాప్ ఇన్‌స్టాల్స్</option>
              <option value="joinedAt">క్రమం: చేరిన తేదీ</option>
              <option value="district">క్రమం: జిల్లా</option>
              <option value="name">క్రమం: పేరు</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors shrink-0"
              title={sortDirection === 'desc' ? 'అవరోహణ (ఎక్కువ నుండి తక్కువ)' : 'ఆరోహణ (తక్కువ నుండి ఎక్కువ)'}
            >
              <ArrowDownUp size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* High-Density Paginated Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-xs font-bold text-slate-600">
              <tr>
                <th
                  scope="col"
                  onClick={() => handleHeaderSort('name')}
                  className="cursor-pointer px-4 py-3 text-left hover:bg-slate-100 whitespace-nowrap"
                >
                  రిపోర్టర్ · హోదా
                </th>
                <th
                  scope="col"
                  onClick={() => handleHeaderSort('district')}
                  className="cursor-pointer px-4 py-3 text-left hover:bg-slate-100 whitespace-nowrap"
                >
                  జిల్లా · మండలం
                </th>
                <th scope="col" className="px-4 py-3 text-left whitespace-nowrap">
                  సంప్రదింపు
                </th>
                <th
                  scope="col"
                  onClick={() => handleHeaderSort('todayNewsCount')}
                  className="cursor-pointer px-3 py-3 text-right hover:bg-slate-100 whitespace-nowrap"
                >
                  ఈ రోజు
                </th>
                <th
                  scope="col"
                  onClick={() => handleHeaderSort('lastWeekNewsCount')}
                  className="cursor-pointer px-3 py-3 text-right hover:bg-slate-100 whitespace-nowrap"
                >
                  7 రోజులు
                </th>
                <th
                  scope="col"
                  onClick={() => handleHeaderSort('totalNewsCount')}
                  className="cursor-pointer px-3 py-3 text-right hover:bg-slate-100 whitespace-nowrap"
                >
                  మొత్తం
                </th>
                <th
                  scope="col"
                  onClick={() => handleHeaderSort('referralCount')}
                  className="cursor-pointer px-3 py-3 text-right hover:bg-slate-100 whitespace-nowrap"
                >
                  ఇన్‌స్టాల్స్
                </th>
                <th
                  scope="col"
                  onClick={() => handleHeaderSort('daysInactive')}
                  className="cursor-pointer px-4 py-3 text-left hover:bg-slate-100 whitespace-nowrap"
                >
                  స్థితి · చివరి వార్త
                </th>
                <th scope="col" className="px-4 py-3 text-right whitespace-nowrap">
                  చర్యలు
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-200" />
                        <div className="space-y-1.5">
                          <div className="h-3.5 bg-slate-200 rounded w-28" />
                          <div className="h-3 bg-slate-100 rounded w-20" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-slate-200 rounded w-32" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                    <td className="px-3 py-3.5"><div className="h-3.5 bg-slate-100 rounded w-6 ml-auto" /></td>
                    <td className="px-3 py-3.5"><div className="h-3.5 bg-slate-100 rounded w-6 ml-auto" /></td>
                    <td className="px-3 py-3.5"><div className="h-3.5 bg-slate-200 rounded w-8 ml-auto" /></td>
                    <td className="px-3 py-3.5"><div className="h-3.5 bg-slate-100 rounded w-6 ml-auto" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-slate-100 rounded w-28" /></td>
                    <td className="px-4 py-3.5"><div className="h-7 bg-slate-100 rounded w-36 ml-auto" /></td>
                  </tr>
                ))
              ) : pagination.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center space-y-2.5">
                    <p className="text-sm font-bold text-slate-700">
                      ఎంచుకున్న ఫిల్టర్‌కు రిపోర్టర్లు ఎవరూ కనుగొనబడలేదు.
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setSelectedDistrict('ALL');
                          setStageFilter('ALL');
                        }}
                        className="px-4 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        ఫిల్టర్లు తొలగించు
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                pagination.items.map((user) => {
                  const cleanPhone = getClean10DigitPhone(user.phone);
                  const isExempt = user.exemptFromInactivity === true;
                  const isBusy = Boolean(updatingIds[user.id]);
                  const stageMeta = STAGE_META_TE[user.inactivityStage] || STAGE_META_TE.ACTIVE;
                  const mandalName = user.assignedMandal || user.mandal || '';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Reporter & Role */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => onSelectReporter(user)}
                            className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-full"
                            title="రిపోర్టర్ వివరాలు చూడండి"
                          >
                            <ReporterAvatar name={user.name} photoUrl={user.photoUrl} />
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onSelectReporter(user)}
                                className="text-sm font-bold text-slate-900 hover:text-teal-700 transition-colors text-left"
                              >
                                {user.name || 'Reporter'}
                              </button>
                              {user.isNewlyJoined && (
                                <span className="text-[11px] font-bold text-teal-700">· కొత్త</span>
                              )}
                            </div>
                            <div className="mt-1">
                              <select
                                value={user.role}
                                onChange={(e) => {
                                  const nextRole = e.target.value as UserRole;
                                  if (nextRole === UserRole.SUBSCRIBER) {
                                    onDowngradeRequest(user);
                                  } else if (nextRole !== user.role) {
                                    onRoleChangeRequest(user, nextRole);
                                  }
                                }}
                                disabled={isBusy}
                                className="text-xs border border-slate-300 px-2 py-0.5 rounded-md font-semibold bg-white text-slate-700 outline-none focus:ring-1 focus:ring-teal-600"
                              >
                                <option value={UserRole.REPORTER}>రిపోర్టర్</option>
                                <option value={UserRole.STAFF_REPORTER}>స్టాఫ్ రిపోర్టర్</option>
                                <option value={UserRole.REGIONAL_INCHARGE}>ఇంచార్జ్</option>
                                <option value={UserRole.SUBSCRIBER}>హోదా తొలగించు</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* District & Mandal */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-sm">
                            {user.district || '—'}
                            {mandalName ? ` · ${mandalName}` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => onEditLocation(user)}
                            className="p-1 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors"
                            title="జిల్లా / మండలం మార్చండి"
                            aria-label="జిల్లా / మండలం మార్చండి"
                          >
                            <MapPin size={13} />
                          </button>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{user.state || 'TS'}</div>
                      </td>

                      {/* Contact & Direct Desk Chat */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono tabular-nums font-semibold text-slate-800 text-xs">
                            {cleanPhone ? formatDisplayPhone(user.phone) : '—'}
                          </span>
                          {cleanPhone && (
                            <>
                              <a
                                href={`tel:+91${cleanPhone}`}
                                className="text-teal-700 hover:bg-teal-50 p-1 rounded transition-colors"
                                title="కాల్ చేయండి"
                              >
                                <Phone size={13} />
                              </a>
                              <a
                                href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
                                  `నమస్కారం ${user.name || ''} గారు, AlfaNews ఎడిటోరియల్ డెస్క్ నుండి...`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-700 hover:bg-emerald-50 p-1 rounded transition-colors"
                                title="వాట్సాప్"
                              >
                                <MessageSquare size={13} />
                              </a>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Numeric Metrics */}
                      <td className="px-3 py-3 whitespace-nowrap text-right font-mono tabular-nums font-bold text-emerald-700">
                        {user.todayNewsCount}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right font-mono tabular-nums font-bold text-teal-800">
                        {user.lastWeekNewsCount}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right font-mono tabular-nums font-bold text-slate-900">
                        {user.totalNewsCount}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <div className="font-mono tabular-nums font-bold text-slate-900">
                          {user.referralCount || 0}
                        </div>
                        <div className="font-mono tabular-nums text-[11px] text-slate-500">
                          {(user.referralCount || 0) * 50} pts
                        </div>
                      </td>

                      {/* Unboxed Semantic Status & Last Post Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        <div className={`font-bold ${stageMeta.toneClass}`}>
                          {stageMeta.label}
                          {user.inactivityStage !== 'EXEMPT' && user.inactivityStage !== 'NEW_NO_POSTS' && (
                            <span className="font-mono tabular-nums ml-1">({user.daysInactive}d)</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                          చివరి వార్త: {formatIstShortDate(user.lastPostTimestamp)}
                        </div>
                      </td>

                      {/* Row Actions */}
                      <td className="px-4 py-3 whitespace-nowrap text-right text-xs">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectReporter(user)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition-colors whitespace-nowrap"
                            title="రిపోర్టర్ ప్రొఫైల్ & చరిత్ర చూడండి"
                          >
                            <Eye size={13} />
                            <span>వివరాలు</span>
                          </button>

                          {onOpenDeskChat && (
                            <button
                              type="button"
                              onClick={() => onOpenDeskChat(user.id)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold transition-colors whitespace-nowrap"
                              title="రిపోర్టర్ డెస్క్ చాట్ ఓపెన్ చేయండి"
                            >
                              <MessageCircle size={13} />
                              <span>చాట్</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onToggleExemption(user)}
                            disabled={isBusy}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isExempt
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                                : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                            title={
                              isExempt
                                ? 'పుష్ రిమైండర్లు తిరిగి ఆన్ చేయండి'
                                : 'ఈ రిపోర్టర్‌కు పుష్ రిమైండర్లు నిలిపివేయండి'
                            }
                          >
                            {isExempt ? <Bell size={13} /> : <BellOff size={13} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenPoster(user)}
                            className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors"
                            title="స్టార్ విలేకరి పోస్టర్"
                          >
                            <Star size={13} className="fill-amber-500 text-amber-500" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDowngradeRequest(user)}
                            disabled={isBusy}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-amber-50 text-amber-800 transition-colors"
                            title="రిపోర్టర్ హోదా తొలగించి సబ్‌స్క్రైబర్‌గా మార్చు"
                          >
                            <UserMinus size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteRequest(user)}
                            disabled={isBusy}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-rose-700 transition-colors"
                            title="ఖాతాను శాశ్వతంగా తొలగించు"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && pagination.totalItems > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono tabular-nums font-semibold text-slate-800">
                {pagination.startIndex}–{pagination.endIndex} / {pagination.totalItems} రిపోర్టర్లు
              </span>
              <div className="flex items-center gap-1.5">
                <span>పేజీకి:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-800 font-mono tabular-nums font-bold outline-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.currentPage <= 1}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={14} />
                <span>మునుపటి</span>
              </button>
              <span className="px-2.5 font-mono tabular-nums font-bold text-slate-800">
                {pagination.currentPage} / {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.currentPage >= pagination.totalPages}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 transition-colors"
              >
                <span>తదుపరి</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveReportersTab;
