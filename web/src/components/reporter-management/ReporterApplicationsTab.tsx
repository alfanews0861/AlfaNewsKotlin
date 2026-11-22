import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  findMandalOccupant,
  formatDisplayPhone,
  getClean10DigitPhone,
  MandalOccupantEntry,
} from '../../utils/reporterManagementHelpers';
import { formatIstShortDate, parseEpochMs } from '../../utils/reporterTracking';
import { AppStatusFilter, ReporterApplication } from './types';

interface ReporterApplicationsTabProps {
  applications: ReporterApplication[];
  occupiedMandalsMap: Record<string, MandalOccupantEntry[]>;
  loading: boolean;
  updatingIds: Record<string, boolean>;
  onRefresh: () => void;
  onApproveClick: (app: ReporterApplication) => void;
  onRejectClick: (app: ReporterApplication) => void;
  onDeleteClick: (app: ReporterApplication) => void;
}

const STATUS_META: Record<string, { label: string; toneClass: string }> = {
  PENDING: { label: 'పెండింగ్', toneClass: 'text-amber-700' },
  JOINED: { label: 'ఆమోదించబడింది', toneClass: 'text-emerald-700' },
  APPROVED: { label: 'ఆమోదించబడింది', toneClass: 'text-emerald-700' },
  REJECTED: { label: 'తిరస్కరించబడింది', toneClass: 'text-rose-700' },
  SUSPENDED: { label: 'నిలిపివేయబడింది', toneClass: 'text-slate-600' },
};

const ReporterApplicationsTab: React.FC<ReporterApplicationsTabProps> = ({
  applications,
  occupiedMandalsMap,
  loading,
  updatingIds,
  onRefresh,
  onApproveClick,
  onRejectClick,
  onDeleteClick,
}) => {
  const [filter, setFilter] = useState<AppStatusFilter>('PENDING');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    let pending = 0;
    let joined = 0;
    let rejected = 0;
    for (const app of applications) {
      const s = (app.status || 'PENDING').toUpperCase();
      if (s === 'JOINED' || s === 'APPROVED') joined++;
      else if (s === 'REJECTED') rejected++;
      else pending++;
    }
    return { pending, joined, rejected, total: applications.length };
  }, [applications]);

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((app) => {
      const status = (app.status || 'PENDING').toUpperCase();
      if (filter === 'PENDING' && (status === 'JOINED' || status === 'APPROVED' || status === 'REJECTED')) {
        return false;
      }
      if (filter === 'JOINED' && status !== 'JOINED' && status !== 'APPROVED') return false;
      if (filter === 'REJECTED' && status !== 'REJECTED') return false;

      if (q) {
        return (
          (app.name || '').toLowerCase().includes(q) ||
          (app.phone || app.phoneNumber || '').toLowerCase().includes(q) ||
          (app.district || app.state_district || '').toLowerCase().includes(q) ||
          (app.mandal || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [applications, filter, search]);

  return (
    <div className="space-y-4">
      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {(
            [
              { id: 'PENDING', label: `పెండింగ్ (${counts.pending})` },
              { id: 'JOINED', label: `ఆమోదించినవి (${counts.joined})` },
              { id: 'REJECTED', label: `తిరస్కరించినవి (${counts.rejected})` },
              { id: 'ALL', label: `మొత్తం (${counts.total})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                filter === item.id
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="పేరు, ఫోన్, జిల్లా లేదా మండలం..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors whitespace-nowrap shrink-0"
            title="దరఖాస్తులు రిఫ్రెష్ చేయండి"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>రిఫ్రెష్</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                </div>
              </div>
              <div className="h-3 bg-slate-100 rounded w-3/4" />
              <div className="h-8 bg-slate-100 rounded w-full mt-2" />
            </div>
          ))}
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2.5">
          <p className="text-sm font-bold text-slate-700">ఈ విభాగంలో దరఖాస్తులు ఏవీ లేవు.</p>
          <p className="text-xs text-slate-500">
            కొత్త రిపోర్టర్ దరఖాస్తులు రాగానే ఇక్కడ కనిపిస్తాయి.
          </p>
          {(search || filter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilter('ALL');
              }}
              className="mt-1 px-4 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              అన్ని దరఖాస్తులు చూడు
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredApps.map((app) => {
            const status = (app.status || 'PENDING').toUpperCase();
            const isPending = status !== 'JOINED' && status !== 'APPROVED' && status !== 'REJECTED';
            const statusMeta = STATUS_META[status] || { label: status, toneClass: 'text-slate-600' };
            const dist = (app.district || app.state_district || '—').trim();
            const mandal = (app.mandal || '—').trim();
            const occupant = findMandalOccupant(
              occupiedMandalsMap,
              dist,
              mandal,
              app.userId || app.id
            );
            const rawPhone = app.phone || app.phoneNumber;
            const clean10 = getClean10DigitPhone(rawPhone);
            const submittedMs = parseEpochMs(app.timestamp);
            const isBusy = Boolean(updatingIds[app.id]);

            return (
              <div
                key={app.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-3">
                  {/* Top Row: Applicant identity + unboxed status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-bold flex items-center justify-center shrink-0 text-sm">
                        {app.name ? app.name.charAt(0).toUpperCase() : 'A'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                          {app.name || 'పేరు లేదు'}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                          <span className="font-mono tabular-nums font-semibold text-slate-700">
                            {formatDisplayPhone(rawPhone) || 'ఫోన్ లేదు'}
                          </span>
                          {submittedMs && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{formatIstShortDate(submittedMs)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className={`text-xs font-bold whitespace-nowrap shrink-0 ${statusMeta.toneClass}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Clean tabular metadata grid (no nested cards) */}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs pt-2.5 border-t border-slate-100">
                    <div>
                      <dt className="text-slate-500">జిల్లా · మండలం</dt>
                      <dd className="font-bold text-slate-900 mt-0.5">
                        {dist} · {mandal}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">విద్యార్హత / అనుభవం</dt>
                      <dd className="font-semibold text-slate-800 mt-0.5">
                        {[app.education, app.experience].filter(Boolean).join(' · ') || 'వివరాలు లేవు'}
                      </dd>
                    </div>
                  </dl>

                  {/* Mandal Occupancy Conflict Alert */}
                  {occupant && (
                    <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle size={14} className="text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        ఈ మండలంలో ఇప్పటికే రిపోర్టర్ ఉన్నారు: <strong className="font-bold">{occupant.label}</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    {clean10 && (
                      <>
                        <a
                          href={`tel:+91${clean10}`}
                          className="p-2 rounded-lg text-teal-700 hover:bg-teal-50 transition-colors"
                          title="కాల్ చేయండి"
                        >
                          <Phone size={15} />
                        </a>
                        <a
                          href={`https://wa.me/91${clean10}?text=${encodeURIComponent(
                            `నమస్కారం ${app.name || ''} గారు, మీ AlfaNews రిపోర్టర్ దరఖాస్తు గురించి...`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="వాట్సాప్ సందేశం"
                        >
                          <MessageSquare size={15} />
                        </a>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => onApproveClick(app)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          <Check size={14} />
                          <span>ఆమోదించు</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRejectClick(app)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          <X size={14} />
                          <span>తిరస్కరించు</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteClick(app)}
                      disabled={isBusy}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                      title="దరఖాస్తు తొలగించు"
                      aria-label="దరఖాస్తు తొలగించు"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReporterApplicationsTab;
