import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  FileText,
  History,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  RefreshCw,
  Star,
  Trash2,
  UserMinus,
  X,
} from 'lucide-react';
import { getOptimizedImageUrl } from '../../utils/imageHelper';
import {
  buildDailyActivitySeries,
  formatDisplayPhone,
  getClean10DigitPhone,
  ROLE_LABELS_TE,
  STAGE_META_TE,
} from '../../utils/reporterManagementHelpers';
import { formatIstDateTime, formatIstShortDate } from '../../utils/reporterTracking';
import { ReporterDrawerDetails, ReporterWithCounts } from './types';

interface ReporterDetailDrawerProps {
  reporter: ReporterWithCounts | null;
  details: ReporterDrawerDetails | undefined;
  loadingDetails: boolean;
  isBusy: boolean;
  onClose: () => void;
  onRefreshDetails: (reporterId: string) => void;
  onEditLocation: (reporter: ReporterWithCounts) => void;
  onToggleExemption: (reporter: ReporterWithCounts) => void;
  onOpenPoster: (reporter: ReporterWithCounts) => void;
  onDowngradeRequest: (reporter: ReporterWithCounts) => void;
  onDeleteRequest: (reporter: ReporterWithCounts) => void;
  onOpenDeskChat?: (reporterId: string) => void;
}

const REMINDER_STAGE_LABELS: Record<string, { label: string; tone: string }> = {
  DAY_3: { label: '3వ రోజు పుష్ రిమైండర్', tone: 'text-amber-700' },
  DAY_7: { label: '7వ రోజు ఫాలో-అప్ పుష్', tone: 'text-orange-700' },
  DAY_10_ADMIN: { label: '10+ రోజులు · అడ్మిన్ అలర్ట్', tone: 'text-rose-700' },
};

const DELIVERY_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  SENT: { label: 'పంపబడింది', tone: 'text-emerald-700' },
  NO_TOKENS: { label: 'టోకెన్ లేదు', tone: 'text-slate-500' },
  FAILED: { label: 'విఫలమైంది', tone: 'text-rose-700' },
  DRY_RUN: { label: 'ప్రివ్యూ', tone: 'text-teal-700' },
};

const ReporterDetailDrawer: React.FC<ReporterDetailDrawerProps> = ({
  reporter,
  details,
  loadingDetails,
  isBusy,
  onClose,
  onRefreshDetails,
  onEditLocation,
  onToggleExemption,
  onOpenPoster,
  onDowngradeRequest,
  onDeleteRequest,
  onOpenDeskChat,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'articles' | 'reminders'>('articles');
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    setActiveSubTab('articles');
  }, [reporter?.id]);

  useEffect(() => {
    if (!reporter) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [reporter, onClose]);

  const dailySeries = useMemo(
    () => buildDailyActivitySeries(reporter?.reporterActivity?.dailyCounts, 14),
    [reporter?.reporterActivity?.dailyCounts]
  );

  const maxDailyCount = useMemo(
    () => Math.max(1, ...dailySeries.map((d) => d.count)),
    [dailySeries]
  );

  if (!reporter) return null;

  const clean10 = getClean10DigitPhone(reporter.phone);
  const stageMeta = STAGE_META_TE[reporter.inactivityStage] || STAGE_META_TE.ACTIVE;
  const roleLabel = ROLE_LABELS_TE[reporter.role] || reporter.role;
  const mandalName = reporter.assignedMandal || reporter.mandal || '';
  const isExempt = reporter.exemptFromInactivity === true;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end transition-opacity duration-200"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${reporter.name || 'Reporter'} వివరాలు`}
        className="w-full max-w-[500px] bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3.5 min-w-0">
            {reporter.photoUrl && !imgFailed ? (
              <img
                src={getOptimizedImageUrl(reporter.photoUrl, 128)}
                alt={reporter.name || 'Reporter'}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-bold text-lg flex items-center justify-center shrink-0">
                {(reporter.name || 'R').trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-lg font-ramabhadra text-slate-900 truncate leading-snug">
                {reporter.name || 'Reporter'}
              </h3>
              <div className="text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-800">{roleLabel}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {reporter.district || '—'}
                  {mandalName ? ` · ${mandalName}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => onEditLocation(reporter)}
                  className="text-teal-700 hover:underline font-bold inline-flex items-center gap-0.5 ml-1"
                >
                  <MapPin size={11} />
                  <span>మార్చు</span>
                </button>
              </div>
              <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                <span className={`font-bold ${stageMeta.toneClass}`}>
                  {stageMeta.label}
                  {reporter.inactivityStage !== 'EXEMPT' &&
                    reporter.inactivityStage !== 'NEW_NO_POSTS' && (
                      <span className="font-mono tabular-nums ml-1">({reporter.daysInactive}d)</span>
                    )}
                </span>
                <span className="text-slate-400" aria-hidden="true">·</span>
                <span className="text-slate-500 font-mono tabular-nums">
                  చేరిన తేదీ: {formatIstShortDate(reporter.joinedAt)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors shrink-0"
            aria-label="మూసివేయి"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Quick Contact & Primary Desk Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenDeskChat && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDeskChat(reporter.id);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition-colors whitespace-nowrap"
              >
                <MessageCircle size={14} />
                <span>డెస్క్ చాట్ ఓపెన్ చేయి</span>
              </button>
            )}

            {clean10 && (
              <>
                <a
                  href={`tel:+91${clean10}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors whitespace-nowrap font-mono tabular-nums"
                >
                  <Phone size={13} className="text-teal-700" />
                  <span>{formatDisplayPhone(reporter.phone)}</span>
                </a>
                <a
                  href={`https://wa.me/91${clean10}?text=${encodeURIComponent(
                    `నమస్కారం ${reporter.name || ''} గారు, AlfaNews ఎడిటోరియల్ డెస్క్ నుండి...`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold transition-colors whitespace-nowrap"
                >
                  <MessageSquare size={13} />
                  <span>వాట్సాప్</span>
                </a>
              </>
            )}

            <button
              type="button"
              onClick={() => onToggleExemption(reporter)}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors whitespace-nowrap"
            >
              {isExempt ? <Bell size={13} /> : <BellOff size={13} />}
              <span>{isExempt ? 'పుష్ రిమైండర్ ఆన్ చేయి' : 'రిమైండర్ నిలిపివేయి'}</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenPoster(reporter)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-colors whitespace-nowrap"
            >
              <Star size={13} className="fill-amber-500 text-amber-500" />
              <span>స్టార్ పోస్టర్</span>
            </button>
          </div>

          {/* 4-Stat Canonical Summary */}
          <div className="grid grid-cols-4 gap-2 border border-slate-200 rounded-xl p-3 bg-slate-50/60">
            <div>
              <div className="text-[11px] text-slate-500 font-semibold">ఈ రోజు</div>
              <div className="text-lg font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                {reporter.todayNewsCount}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold">7 రోజులు</div>
              <div className="text-lg font-mono tabular-nums font-bold text-teal-800 mt-0.5">
                {reporter.lastWeekNewsCount}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold">30 రోజులు</div>
              <div className="text-lg font-mono tabular-nums font-bold text-slate-800 mt-0.5">
                {reporter.last30DaysNewsCount}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold">మొత్తం</div>
              <div className="text-lg font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                {reporter.totalNewsCount}
              </div>
            </div>
          </div>

          {/* Compact 14-Day Daily Activity Sparkline */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">గత 14 రోజుల వార్తల క్రమం (IST)</span>
              <span className="font-mono tabular-nums text-slate-500">
                చివరి వార్త: {formatIstShortDate(reporter.lastPostTimestamp)}
              </span>
            </div>
            <div className="flex items-end gap-1.5 h-16 pt-2">
              {dailySeries.map((pt) => {
                const heightPct = pt.count > 0 ? Math.max(18, Math.round((pt.count / maxDailyCount) * 100)) : 8;
                return (
                  <div
                    key={pt.dateKey}
                    className="flex-1 flex flex-col items-center justify-end h-full group"
                    title={`${pt.dateKey}: ${pt.count} వార్తలు`}
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t transition-colors ${
                        pt.count > 0 ? 'bg-teal-600 group-hover:bg-teal-700' : 'bg-slate-200'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-400">
              <span>{dailySeries[0]?.shortLabel}</span>
              <span>{dailySeries[Math.floor(dailySeries.length / 2)]?.shortLabel}</span>
              <span>ఈ రోజు ({dailySeries[dailySeries.length - 1]?.shortLabel})</span>
            </div>
          </div>

          {/* Bounded History Sub-Tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('articles')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                    activeSubTab === 'articles'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText size={13} />
                  <span>ఇటీవలి వార్తలు ({details?.articles.length ?? 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('reminders')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                    activeSubTab === 'reminders'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <History size={13} />
                  <span>రిమైండర్ చరిత్ర ({details?.reminderLogs.length ?? 0})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => onRefreshDetails(reporter.id)}
                disabled={loadingDetails}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                title="వివరాలు రిఫ్రెష్ చేయండి"
              >
                <RefreshCw size={13} className={loadingDetails ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingDetails && !details ? (
              <div className="space-y-2.5 animate-pulse">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="py-2.5 border-b border-slate-100 space-y-1.5">
                    <div className="h-3.5 bg-slate-200 rounded w-5/6" />
                    <div className="h-3 bg-slate-100 rounded w-2/5" />
                  </div>
                ))}
              </div>
            ) : activeSubTab === 'articles' ? (
              !details || details.articles.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center font-semibold">
                  ఈ రిపోర్టర్ నుండి ఇటీవలి వార్తలు ఏవీ నమోదు కాలేదు.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {details.articles.map((art) => (
                    <li key={art.id} className="py-2.5 space-y-1">
                      <div className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                        {art.headline}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono tabular-nums">{formatIstDateTime(art.timestamp)}</span>
                        {(art.district || art.mandal) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{[art.district, art.mandal].filter(Boolean).join(' / ')}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className={art.approved ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {art.approved ? 'ఆమోదించబడింది' : 'పెండింగ్'}
                        </span>
                        {art.isCrossMandal && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-teal-700 font-bold">క్రాస్-మండల్</span>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : !details || details.reminderLogs.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center font-semibold">
                ఈ రిపోర్టర్‌కు ఇప్పటివరకు రిమైండర్లు ఏవీ పంపబడలేదు.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {details.reminderLogs.map((log) => {
                  const sMeta = REMINDER_STAGE_LABELS[log.stage] || {
                    label: log.stage,
                    tone: 'text-slate-700',
                  };
                  const rawStatus = log.status || log.deliveryStatus || 'SENT';
                  const dMeta = DELIVERY_STATUS_LABELS[rawStatus] || {
                    label: rawStatus,
                    tone: 'text-slate-600',
                  };
                  return (
                    <li key={log.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className={`font-bold ${sMeta.tone}`}>{sMeta.label}</div>
                        <div className="text-slate-500 font-mono tabular-nums">
                          {formatIstDateTime(log.timestamp)} · {log.daysInactive}d నిష్క్రియత
                        </div>
                      </div>
                      <span className={`font-bold whitespace-nowrap ${dMeta.tone}`}>{dMeta.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Footer: Account Governance Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
            రెఫరల్స్: <strong className="text-slate-800">{reporter.referralCount || 0}</strong> · పాయింట్లు:{' '}
            <strong className="text-slate-800">{reporter.points ?? 0}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDowngradeRequest(reporter)}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-50 text-amber-800 text-xs font-bold transition-colors whitespace-nowrap"
            >
              <UserMinus size={13} />
              <span>హోదా తొలగించు</span>
            </button>
            <button
              type="button"
              onClick={() => onDeleteRequest(reporter)}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold transition-colors whitespace-nowrap"
            >
              <Trash2 size={13} />
              <span>తొలగించు</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default ReporterDetailDrawer;
