import React, { useMemo, useState } from 'react';
import {
  MessageCircle,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { ALL_STATE_CODES, EDITIONS } from '../../data/editions';
import {
  formatDisplayPhone,
  getClean10DigitPhone,
  ROLE_LABELS_TE,
} from '../../utils/reporterManagementHelpers';
import { formatIstShortDate, parseEpochMs } from '../../utils/reporterTracking';
import { FormerReporter } from './types';

interface FormerReportersTabProps {
  formerReporters: FormerReporter[];
  loading: boolean;
  updatingIds: Record<string, boolean>;
  onRefresh: () => void;
  onReinstateClick: (former: FormerReporter) => void;
  onDeleteRequest: (former: FormerReporter) => void;
  onOpenDeskChat?: (reporterId: string) => void;
}

const REASON_LABELS: Record<string, string> = {
  MANUAL_ADMIN_ACTION: 'అడ్మిన్ ద్వారా తొలగింపు',
  ADMIN_DOWNGRADED: 'అడ్మిన్ ద్వారా తొలగింపు',
  INACTIVITY: 'నిష్క్రియాత్మకత',
};

const FormerReportersTab: React.FC<FormerReportersTabProps> = ({
  formerReporters,
  loading,
  updatingIds,
  onRefresh,
  onReinstateClick,
  onDeleteRequest,
  onOpenDeskChat,
}) => {
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('ALL');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return formerReporters.filter((u) => {
      if (district !== 'ALL' && (u.district || '').trim() !== district.trim()) return false;
      if (q) {
        return (
          (u.name || '').toLowerCase().includes(q) ||
          (u.phone || '').toLowerCase().includes(q) ||
          (u.district || '').toLowerCase().includes(q) ||
          (u.assignedMandal || u.mandal || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [formerReporters, search, district]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            మాజీ & సస్పెండ్ అయిన రిపోర్టర్లు ({filtered.length})
          </h3>
          <p className="text-xs text-slate-500">
            గతంలో హోదా తొలగించబడిన లేదా నిలిపివేయబడిన రిపోర్టర్లను ఇక్కడి నుండి ఒకే క్లిక్‌తో తిరిగి నియమించవచ్చు.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="పేరు, ఫోన్ లేదా మండలం..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="border border-slate-300 rounded-lg py-2 px-3 text-sm bg-white text-slate-900 font-semibold outline-none focus:ring-2 focus:ring-teal-600"
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

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors whitespace-nowrap"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>రిఫ్రెష్</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left whitespace-nowrap">రిపోర్టర్ · మాజీ హోదా</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">గత ప్రాంతం</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">సంప్రదింపు</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">మొత్తం వార్తలు</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">తొలగింపు తేదీ · కారణం</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">చర్యలు</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="h-4 bg-slate-200 rounded w-36" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-slate-100 rounded w-28" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                    <td className="px-3 py-3.5"><div className="h-3.5 bg-slate-100 rounded w-8 ml-auto" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-slate-100 rounded w-32" /></td>
                    <td className="px-4 py-3.5"><div className="h-7 bg-slate-100 rounded w-28 ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center space-y-2">
                    <p className="text-sm font-bold text-slate-700">
                      మాజీ లేదా సస్పెండ్ అయిన రిపోర్టర్లు ఎవరూ కనుగొనబడలేదు.
                    </p>
                    {(search || district !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setDistrict('ALL');
                        }}
                        className="px-4 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        ఫిల్టర్లు తొలగించు
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((user) => {
                  const clean10 = getClean10DigitPhone(user.phone);
                  const downMs = parseEpochMs(user.downgradedAt) ?? parseEpochMs(user.suspendedAt);
                  const rawReason = user.downgradedReason || (user.suspended ? 'సస్పెండ్ చేయబడింది' : '');
                  const reasonText = REASON_LABELS[rawReason] || rawReason || '—';
                  const prevRoleLabel =
                    ROLE_LABELS_TE[String(user.previousRole || '')] || 'మాజీ రిపోర్టర్';
                  const isBusy = Boolean(updatingIds[user.id]);
                  const mandal = user.assignedMandal || user.mandal || '';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{user.name || 'Reporter'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {prevRoleLabel}
                          {user.suspended ? ' · సస్పెండ్' : ' · హోదా తొలగింపు'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-semibold">
                        {user.district || '—'}
                        {mandal ? ` · ${mandal}` : ''}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {clean10 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono tabular-nums text-xs font-semibold text-slate-800">
                              {formatDisplayPhone(user.phone)}
                            </span>
                            <a
                              href={`tel:+91${clean10}`}
                              className="p-1 rounded text-teal-700 hover:bg-teal-50"
                              title="కాల్ చేయండి"
                            >
                              <Phone size={13} />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right font-mono tabular-nums font-bold text-slate-800">
                        {user.reporterActivity?.totalApprovedPosts ?? user.totalNewsCount ?? 0}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        <div className="font-mono tabular-nums font-semibold text-slate-800">
                          {downMs ? formatIstShortDate(downMs) : 'తేదీ నమోదు కాలేదు'}
                        </div>
                        <div className="text-slate-500 mt-0.5 truncate max-w-[220px]" title={reasonText}>
                          {reasonText}
                          {user.downgradedBy ? ` · ${user.downgradedBy}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-xs">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onReinstateClick(user)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            <RotateCcw size={13} />
                            <span>తిరిగి నియమించు</span>
                          </button>
                          {onOpenDeskChat && (
                            <button
                              type="button"
                              onClick={() => onOpenDeskChat(user.id)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-teal-50 text-teal-800 transition-colors"
                              title="డెస్క్ చాట్ ఓపెన్ చేయండి"
                            >
                              <MessageCircle size={13} />
                            </button>
                          )}
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
      </div>
    </div>
  );
};

export default FormerReportersTab;
