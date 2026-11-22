import React, { useState, useEffect, useCallback } from 'react';
import { app, db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';
import {
  ReporterReminderLog,
  ReporterTrackingConfig,
  User,
  UserRole,
} from '../types';
import {
  DEFAULT_TRACKING_CONFIG,
  formatIstDateTime,
} from '../utils/reporterTracking';
import {
  Bell,
  BellOff,
  CheckCircle2,
  Eye,
  Play,
  RefreshCw,
  Save,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

const { collection, getDocs, query, orderBy, limit } = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;
const functions = getFunctions(app, 'asia-south1');

interface DryRunEntry {
  reporterId: string;
  reporterName: string;
  district?: string;
  mandal?: string;
  daysInactive: number;
  action: string;
  stage?: string;
  reason?: string;
}

interface ReporterAutomationPanelProps {
  currentUser: User;
  onConfigUpdated?: (config: ReporterTrackingConfig) => void;
  onScanCompleted?: () => void;
}

const STAGE_LABEL_MAP: Record<string, { label: string; tone: string }> = {
  DAY_3: { label: '3వ రోజు పుష్ రిమైండర్', tone: 'text-amber-700' },
  DAY_7: { label: '7వ రోజు ఫాలో-అప్ పుష్', tone: 'text-orange-700' },
  DAY_10_ADMIN: { label: '10+ రోజులు · అడ్మిన్ అలర్ట్', tone: 'text-rose-700' },
  SEND_DAY_3_PUSH: { label: '3వ రోజు పుష్ రిమైండర్', tone: 'text-amber-700' },
  SEND_DAY_7_PUSH: { label: '7వ రోజు ఫాలో-అప్ పుష్', tone: 'text-orange-700' },
  SEND_DAY_10_ADMIN_ALERT: { label: '10+ రోజులు · అడ్మిన్ అలర్ట్', tone: 'text-rose-700' },
};

const DELIVERY_LABEL_MAP: Record<string, { label: string; tone: string }> = {
  SENT: { label: 'పంపబడింది', tone: 'text-emerald-700' },
  NO_TOKENS: { label: 'యాప్ టోకెన్ లేదు', tone: 'text-slate-500' },
  FAILED: { label: 'విఫలమైంది', tone: 'text-rose-700' },
  DRY_RUN: { label: 'ప్రివ్యూ', tone: 'text-teal-700' },
};

const ReporterAutomationPanel: React.FC<ReporterAutomationPanelProps> = ({
  currentUser,
  onConfigUpdated,
  onScanCompleted,
}) => {
  const [config, setConfig] = useState<ReporterTrackingConfig>(DEFAULT_TRACKING_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const [logs, setLogs] = useState<ReporterReminderLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logFilter, setLogFilter] = useState<'ALL' | 'DAY_3' | 'DAY_7' | 'DAY_10_ADMIN'>('ALL');

  const [runningPreview, setRunningPreview] = useState(false);
  const [runningLive, setRunningLive] = useState(false);
  const [confirmLiveRun, setConfirmLiveRun] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    reportersScanned: number;
    day3Count: number;
    day7Count: number;
    adminAlertCount: number;
    skippedExempt: number;
    items: DryRunEntry[];
    message?: string;
  } | null>(null);

  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const isAdmin =
    currentUser.role === UserRole.ADMIN ||
    currentUser.role === UserRole.REGIONAL_INCHARGE;

  const showNotice = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setNotice({ type, text });
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const fn = httpsCallable(functions, 'getReporterTrackingSettings');
      const res: any = await fn();
      if (res?.data?.config) {
        setConfig({ ...DEFAULT_TRACKING_CONFIG, ...res.data.config });
        onConfigUpdated?.({ ...DEFAULT_TRACKING_CONFIG, ...res.data.config });
      }
    } catch (err: any) {
      console.warn('Failed to fetch reporter tracking settings:', err);
      showNotice('error', `సెట్టింగ్స్ లోడ్ చేయడం విఫలమైంది: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoadingConfig(false);
    }
  }, [onConfigUpdated, showNotice]);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const q = query(
        collection(db, 'reporter_reminder_logs'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const list: ReporterReminderLog[] = snap.docs.map((d: any) => ({
        id: d.id,
        ...d.data(),
      }));
      setLogs(list);
    } catch (err) {
      console.warn('Failed to fetch reporter_reminder_logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, [fetchSettings, fetchLogs]);

  const handleSaveConfig = async () => {
    if (!isAdmin) return;
    setSavingConfig(true);
    setNotice(null);
    try {
      const fn = httpsCallable(functions, 'updateReporterTrackingSettings');
      const res: any = await fn({
        enabled: config.enabled,
        firstReminderDays: Number(config.firstReminderDays),
        secondReminderDays: Number(config.secondReminderDays),
        adminAlertDays: Number(config.adminAlertDays),
        adminAlertRepeatDays: Number(config.adminAlertRepeatDays),
        day3Title: config.day3Title.trim(),
        day3Body: config.day3Body.trim(),
        day7Title: config.day7Title.trim(),
        day7Body: config.day7Body.trim(),
      });
      if (res?.data?.config) {
        const saved = { ...DEFAULT_TRACKING_CONFIG, ...res.data.config };
        setConfig(saved);
        onConfigUpdated?.(saved);
      }
      showNotice('success', 'రిమైండర్ సెట్టింగ్స్ విజయవంతంగా సేవ్ చేయబడ్డాయి.');
    } catch (err: any) {
      showNotice('error', `సేవ్ చేయడం విఫలమైంది: ${err?.message || 'Unknown error'}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDryRun = async () => {
    setRunningPreview(true);
    setNotice(null);
    try {
      const fn = httpsCallable(functions, 'triggerReporterActivityCheck');
      const res: any = await fn({ dryRun: true });
      const data = res?.data || {};
      const items: DryRunEntry[] = Array.isArray(data.previewActions) ? data.previewActions : [];
      setPreviewResult({
        reportersScanned: Number(data.reportersScanned || 0),
        day3Count: Number(data.day3RemindersSent || 0),
        day7Count: Number(data.day7RemindersSent || 0),
        adminAlertCount: Number(data.adminAlertsSent || 0),
        skippedExempt: Number(data.skippedExempt || 0),
        items,
        message: data.message,
      });
      showNotice(
        'info',
        `ప్రివ్యూ పూర్తయింది: ${data.reportersScanned || 0} మందిని పరిశీలించాము · 3వ రోజు: ${data.day3RemindersSent || 0} · 7వ రోజు: ${data.day7RemindersSent || 0} · 10+ అడ్మిన్ అలర్ట్: ${data.adminAlertsSent || 0}`
      );
    } catch (err: any) {
      showNotice('error', `ప్రివ్యూ విఫలమైంది: ${err?.message || 'Unknown error'}`);
    } finally {
      setRunningPreview(false);
    }
  };

  const handleRunLiveScan = async () => {
    setRunningLive(true);
    setConfirmLiveRun(false);
    setNotice(null);
    try {
      const fn = httpsCallable(functions, 'triggerReporterActivityCheck');
      const res: any = await fn({ dryRun: false });
      const data = res?.data || {};
      showNotice(
        'success',
        `పుష్ రిమైండర్ తనిఖీ పూర్తయింది — పరిశీలించినవారు: ${data.reportersScanned || 0} · 3వ రోజు పుష్: ${data.day3RemindersSent || 0} · 7వ రోజు పుష్: ${data.day7RemindersSent || 0} · అడ్మిన్ అలర్ట్‌లు: ${data.adminAlertsSent || 0}`
      );
      setPreviewResult(null);
      fetchLogs();
      onScanCompleted?.();
    } catch (err: any) {
      showNotice('error', `తనిఖీ నడపడం విఫలమైంది: ${err?.message || 'Unknown error'}`);
    } finally {
      setRunningLive(false);
    }
  };

  const filteredLogs = logs.filter((item) => logFilter === 'ALL' || item.stage === logFilter);

  const previewSample = (template: string, days: number) =>
    template
      .replace(/\{name\}/g, 'రమేష్')
      .replace(/\{days\}/g, String(days))
      .replace(/\{mandal\}/g, 'సిద్దిపేట');

  return (
    <div className="space-y-6">
      {/* Inline Feedback Banner */}
      {notice && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm font-semibold ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-teal-50 border-teal-200 text-teal-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0" />
            ) : (
              <AlertCircle size={16} className="shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 px-2 py-0.5"
          >
            మూసివేయి
          </button>
        </div>
      )}

      {/* Top Policy & Master Control Strip */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-teal-700" />
            <h3 className="text-lg font-ramabhadra text-slate-900">
              పుష్ నోటిఫికేషన్ రిమైండర్ విధానం (3 · 7 · 10 రోజులు)
            </h3>
          </div>
          <p className="text-sm text-slate-600">
            రిపోర్టర్లకు కేవలం ఫోన్ పుష్ నోటిఫికేషన్ మాత్రమే వెళ్తుంది (డెస్క్ చాట్ నిండదు) · ప్రతి రోజు ఉదయం 10:00 IST తనిఖీ · రాత్రి 11 PM – ఉదయం 6 AM నిశ్శబ్ద సమయం
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={!isAdmin || loadingConfig}
            onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
              config.enabled
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {config.enabled ? <Bell size={16} /> : <BellOff size={16} />}
            <span>{config.enabled ? 'రిమైండర్లు: ON (ఆన్)' : 'రిమైండర్లు: OFF (నిలిపివేత)'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={!isAdmin || savingConfig || loadingConfig}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-teal-700 hover:bg-teal-800 text-white transition-colors disabled:opacity-50"
          >
            <Save size={15} />
            <span>{savingConfig ? 'సేవ్ అవుతోంది...' : 'సెట్టింగ్స్ సేవ్ చేయి'}</span>
          </button>
        </div>
      </div>

      {/* Thresholds + Templates Grid */}
      {loadingConfig ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 text-sm font-semibold">
          రిమైండర్ సెట్టింగ్స్ లోడ్ అవుతున్నాయి...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Threshold Rules */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-base">రోజుల పరిమితులు (Thresholds)</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                వార్త వేయని రోజుల సంఖ్య IST క్యాలెండర్ ప్రకారం లెక్కించబడుతుంది
              </p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  1వ రిమైండర్ పుష్ (రోజులు)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={config.firstReminderDays}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, firstReminderDays: Math.max(1, Number(e.target.value) || 3) }))
                  }
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono tabular-nums font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  ఒకసారి మాత్రమే మృదువైన రిమైండర్ పుష్ వెళ్తుంది.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2వ ఫాలో-అప్ పుష్ (రోజులు)
                </label>
                <input
                  type="number"
                  min={2}
                  max={45}
                  value={config.secondReminderDays}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, secondReminderDays: Math.max(2, Number(e.target.value) || 7) }))
                  }
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono tabular-nums font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  7 రోజుల తర్వాత రెండవ ఫాలో-అప్ పుష్ ఒకసారి వెళ్తుంది.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  అడ్మిన్ అలర్ట్ పరిమితి (రోజులు)
                </label>
                <input
                  type="number"
                  min={3}
                  max={60}
                  value={config.adminAlertDays}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, adminAlertDays: Math.max(3, Number(e.target.value) || 10) }))
                  }
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono tabular-nums font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  రిపోర్టర్ హోదా రద్దు చేయబడదు; అడ్మిన్‌కు మాత్రమే పరిశీలన అలర్ట్ వస్తుంది.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  అడ్మిన్ అలర్ట్ పునరావృత విరామం (రోజులు)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={config.adminAlertRepeatDays}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      adminAlertRepeatDays: Math.max(1, Number(e.target.value) || 5),
                    }))
                  }
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono tabular-nums font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Right: Editable Telugu Push Templates */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-base">తెలుగు పుష్ నోటిఫికేషన్ సందేశాలు</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  వినియోగించగల కోడ్స్: <span className="font-mono text-slate-700">{'{name}'}</span> ·{' '}
                  <span className="font-mono text-slate-700">{'{days}'}</span> ·{' '}
                  <span className="font-mono text-slate-700">{'{mandal}'}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Day 3 Template */}
              <div className="space-y-2.5 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="text-xs font-bold text-amber-800">
                  {config.firstReminderDays}వ రోజు పుష్ రిమైండర్
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">శీర్షిక (Title)</label>
                  <input
                    type="text"
                    value={config.day3Title}
                    onChange={(e) => setConfig((prev) => ({ ...prev, day3Title: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">సందేశం (Body)</label>
                  <textarea
                    rows={3}
                    value={config.day3Body}
                    onChange={(e) => setConfig((prev) => ({ ...prev, day3Body: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </div>
                <div className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg p-2.5">
                  <div className="font-bold text-slate-800">{previewSample(config.day3Title, config.firstReminderDays)}</div>
                  <div className="mt-0.5 leading-relaxed">{previewSample(config.day3Body, config.firstReminderDays)}</div>
                </div>
              </div>

              {/* Day 7 Template */}
              <div className="space-y-2.5 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div className="text-xs font-bold text-orange-800">
                  {config.secondReminderDays}వ రోజు ఫాలో-అప్ పుష్
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">శీర్షిక (Title)</label>
                  <input
                    type="text"
                    value={config.day7Title}
                    onChange={(e) => setConfig((prev) => ({ ...prev, day7Title: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">సందేశం (Body)</label>
                  <textarea
                    rows={3}
                    value={config.day7Body}
                    onChange={(e) => setConfig((prev) => ({ ...prev, day7Body: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </div>
                <div className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg p-2.5">
                  <div className="font-bold text-slate-800">{previewSample(config.day7Title, config.secondReminderDays)}</div>
                  <div className="mt-0.5 leading-relaxed">{previewSample(config.day7Body, config.secondReminderDays)}</div>
                </div>
              </div>
            </div>

            {/* Manual Preview & Run Controls */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                ముందుగా ప్రివ్యూ చూసి, ఎవరికి రిమైండర్ వెళ్తుందో నిర్ధారించుకున్న తర్వాతే పంపండి.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDryRun}
                  disabled={runningPreview || runningLive}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 transition-colors disabled:opacity-50"
                >
                  <Eye size={15} />
                  <span>{runningPreview ? 'పరిశీలిస్తోంది...' : 'ప్రివ్యూ చూడు (Dry Run)'}</span>
                </button>

                {!confirmLiveRun ? (
                  <button
                    type="button"
                    onClick={() => setConfirmLiveRun(true)}
                    disabled={runningLive || runningPreview || !isAdmin}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-teal-700 hover:bg-teal-800 text-white transition-colors disabled:opacity-50"
                  >
                    <Play size={15} />
                    <span>{runningLive ? 'పంపుతోంది...' : 'ఇప్పుడే పుష్ చెక్ నడుపు'}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-1.5">
                    <span className="text-xs font-bold text-amber-900">నిజంగా పుష్ పంపాలా?</span>
                    <button
                      type="button"
                      onClick={handleRunLiveScan}
                      disabled={runningLive}
                      className="px-3 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold"
                    >
                      అవును, పంపు
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmLiveRun(false)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold"
                    >
                      వద్దు
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dry-Run Preview Table */}
      {previewResult && (
        <div className="bg-white border border-teal-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 bg-teal-50/70 border-b border-teal-100 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold text-teal-950">
              ప్రివ్యూ ఫలితాలు — మొత్తం పరిశీలించినవారు:{' '}
              <span className="font-mono tabular-nums">{previewResult.reportersScanned}</span> · 3వ రోజు:{' '}
              <span className="font-mono tabular-nums">{previewResult.day3Count}</span> · 7వ రోజు:{' '}
              <span className="font-mono tabular-nums">{previewResult.day7Count}</span> · 10+ అడ్మిన్:{' '}
              <span className="font-mono tabular-nums">{previewResult.adminAlertCount}</span> · మినహాయింపు:{' '}
              <span className="font-mono tabular-nums">{previewResult.skippedExempt}</span>
            </div>
            <button
              onClick={() => setPreviewResult(null)}
              className="text-xs font-bold text-teal-800 hover:underline"
            >
              ప్రివ్యూ మూసివేయి
            </button>
          </div>
          {previewResult.items.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-600 font-semibold">
              ప్రస్తుతం రిమైండర్ లేదా అడ్మిన్ అలర్ట్ పంపాల్సిన రిపోర్టర్లు ఎవరూ లేరు.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 text-left">రిపోర్టర్</th>
                    <th className="px-4 py-2.5 text-left">జిల్లా · మండలం</th>
                    <th className="px-4 py-2.5 text-right">వార్త లేని రోజులు</th>
                    <th className="px-4 py-2.5 text-left">పంపాల్సిన దశ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewResult.items.map((item) => {
                    const meta = STAGE_LABEL_MAP[item.action] || { label: item.action, tone: 'text-slate-700' };
                    return (
                      <tr key={item.reporterId} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-slate-900">{item.reporterName}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {item.district || '—'} · {item.mandal || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-slate-900">
                          {item.daysInactive}d
                        </td>
                        <td className={`px-4 py-2.5 font-bold ${meta.tone}`}>{meta.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reminder Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 text-base">పంపిన రిమైండర్లు & అడ్మిన్ అలర్ట్‌ల చరిత్ర (Audit Log)</h4>
            <p className="text-xs text-slate-500">చివరి 50 రికార్డులు · పుష్ డెలివరీ స్థితి</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-slate-100 p-1 rounded-xl gap-0.5 text-xs font-bold">
              {(
                [
                  { id: 'ALL', label: 'అన్నీ' },
                  { id: 'DAY_3', label: '3వ రోజు' },
                  { id: 'DAY_7', label: '7వ రోజు' },
                  { id: 'DAY_10_ADMIN', label: '10+ అడ్మిన్' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLogFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    logFilter === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={13} className={loadingLogs ? 'animate-spin' : ''} />
              <span>రిఫ్రెష్</span>
            </button>
          </div>
        </div>

        {loadingLogs ? (
          <div className="p-8 text-center text-sm text-slate-500 font-semibold">లాగ్స్ లోడ్ అవుతున్నాయి...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 font-semibold">
            ఇంకా రిమైండర్ లాగ్స్ నమోదు కాలేదు.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">సమయం (IST)</th>
                  <th className="px-4 py-3 text-left">రిపోర్టర్ · ప్రాంతం</th>
                  <th className="px-4 py-3 text-right">రోజులు</th>
                  <th className="px-4 py-3 text-left">దశ (Stage)</th>
                  <th className="px-4 py-3 text-left">మార్గం</th>
                  <th className="px-4 py-3 text-left">డెలివరీ స్థితి</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const stageMeta = STAGE_LABEL_MAP[log.stage] || { label: log.stage, tone: 'text-slate-700' };
                  const rawStatus = log.status || log.deliveryStatus || 'SENT';
                  const statusMeta = DELIVERY_LABEL_MAP[rawStatus] || {
                    label: rawStatus,
                    tone: 'text-slate-700',
                  };
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 whitespace-nowrap font-mono tabular-nums text-xs text-slate-600">
                        {formatIstDateTime(log.timestamp)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{log.reporterName || 'Reporter'}</div>
                        <div className="text-xs text-slate-500">
                          {log.district || '—'} · {log.mandal || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-mono tabular-nums font-bold text-slate-900">
                        {log.daysInactive}d
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-xs font-bold ${stageMeta.tone}`}>
                        {stageMeta.label}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                        {log.channel === 'ADMIN_ALERT' ? 'అడ్మిన్ అలర్ట్' : 'పుష్ నోటిఫికేషన్'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-bold">
                        <span className={statusMeta.tone}>{statusMeta.label}</span>
                        {typeof log.sentCount === 'number' && log.sentCount > 0 && (
                          <span className="text-slate-400 font-mono tabular-nums ml-1.5">
                            ({log.sentCount}/{log.tokensTargeted || log.sentCount})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReporterAutomationPanel;
