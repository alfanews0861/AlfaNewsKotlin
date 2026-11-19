import React, { useState, useEffect, useMemo } from 'react';
import { app, db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Send,
  Volume2,
  VolumeX,
  Radio,
  MapPin,
  Tag,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { NewsPost } from '../types';
import {
  ALL_CANONICAL_DISTRICTS,
  CATEGORY_TOPIC_OPTIONS,
  buildBroadcastPayload,
  evaluateNotificationHealth,
  getEdgeProxiedImageUrl,
  getTodayIstDateString,
} from '../utils/notificationHelpers';

const { collection, query, orderBy, limit, getDocs, doc, onSnapshot, setDoc } = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;

const AdminNotificationsPage: React.FC = () => {
  const [latestPosts, setLatestPosts] = useState<NewsPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [broadcastMode, setBroadcastMode] = useState<'post' | 'custom'>('post');
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'district' | 'category'>('all');
  const [selectedDistrict, setSelectedDistrict] = useState(ALL_CANONICAL_DISTRICTS[0] || 'హైదరాబాద్');
  const [selectedCategoryTopic, setSelectedCategoryTopic] = useState(CATEGORY_TOPIC_OPTIONS[0].topic);
  const [channelId, setChannelId] = useState<'general_news_v2' | 'breaking_news' | 'local_news_v2'>('general_news_v2');
  const [isSilent, setIsSilent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Live Notification Health State
  const [settingsDoc, setSettingsDoc] = useState<Record<string, any> | null>(null);
  const [dailyQuotaDoc, setDailyQuotaDoc] = useState<Record<string, any> | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [updatingHealth, setUpdatingHealth] = useState(false);

  // Inline Status Banner (No window.alert / window.confirm)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'notifications');
    const quotaRef = doc(db, 'settings', 'notif_daily_breaking');

    const unsubSettings = onSnapshot(
      settingsRef,
      (snap: any) => {
        setSettingsDoc(snap.exists() ? snap.data() : {});
        setLoadingHealth(false);
      },
      (err: any) => {
        console.warn('Failed to listen to settings/notifications:', err);
        setLoadingHealth(false);
      }
    );

    const unsubQuota = onSnapshot(
      quotaRef,
      (snap: any) => {
        setDailyQuotaDoc(snap.exists() ? snap.data() : {});
      },
      (err: any) => {
        console.warn('Failed to listen to settings/notif_daily_breaking:', err);
      }
    );

    return () => {
      unsubSettings();
      unsubQuota();
    };
  }, []);

  useEffect(() => {
    const fetchLatestPosts = async () => {
      try {
        const q = query(collection(db, 'news'), orderBy('timestamp', 'desc'), limit(100));
        const snap = await getDocs(q);
        const fetched = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as NewsPost));
        setLatestPosts(fetched);
      } catch (e) {
        console.error('Failed to fetch posts', e);
      } finally {
        setLoadingPosts(false);
      }
    };
    fetchLatestPosts();
  }, []);

  const health = useMemo(
    () => evaluateNotificationHealth(settingsDoc, dailyQuotaDoc),
    [settingsDoc, dailyQuotaDoc]
  );

  const selectedPost = useMemo(
    () => latestPosts.find((p) => p.id === selectedPostId) || null,
    [latestPosts, selectedPostId]
  );

  const previewImage = useMemo(() => {
    if (broadcastMode !== 'post' || !selectedPost) return '';
    return getEdgeProxiedImageUrl(selectedPost.mediaUrl);
  }, [broadcastMode, selectedPost]);

  const handleToggleEngine = async (field: 'scheduledNotificationsEnabled' | 'breakingNotificationsEnabled', nextValue: boolean) => {
    setUpdatingHealth(true);
    setStatusMessage(null);
    try {
      const payload: Record<string, any> = { [field]: nextValue };
      if (nextValue) {
        if (field === 'scheduledNotificationsEnabled') payload.pauseScheduledUntil = 0;
        if (field === 'breakingNotificationsEnabled') payload.pauseBreakingUntil = 0;
      }
      await setDoc(doc(db, 'settings', 'notifications'), payload, { merge: true });
      setStatusMessage({
        type: 'success',
        text: nextValue ? 'నోటిఫికేషన్ సేవ ఆన్ (ON) చేయబడింది.' : 'నోటిఫికేషన్ సేవ ఆఫ్ (OFF) చేయబడింది.',
      });
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: `సెట్టింగ్ మార్చడంలో లోపం: ${e?.message || 'Permission denied'}`,
      });
    } finally {
      setUpdatingHealth(false);
    }
  };

  const handleResumeAll = async () => {
    setUpdatingHealth(true);
    setStatusMessage(null);
    try {
      const todayIst = getTodayIstDateString();
      await setDoc(
        doc(db, 'settings', 'notifications'),
        {
          scheduledNotificationsEnabled: true,
          breakingNotificationsEnabled: true,
          pauseScheduledUntil: 0,
          pauseBreakingUntil: 0,
        },
        { merge: true }
      );
      if (health.dailyBreakingCount >= health.dailyBreakingMax) {
        await setDoc(
          doc(db, 'settings', 'notif_daily_breaking'),
          { date: todayIst, count: 0 },
          { merge: true }
        );
      }
      setStatusMessage({
        type: 'success',
        text: 'అన్ని షెడ్యూల్డ్ & బ్రేకింగ్ నోటిఫికేషన్లు తిరిగి ప్రారంభించబడ్డాయి!',
      });
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: `తిరిగి ప్రారంభించడంలో లోపం: ${e?.message || 'Unknown error'}`,
      });
    } finally {
      setUpdatingHealth(false);
    }
  };

  const canSubmit =
    broadcastMode === 'post'
      ? Boolean(selectedPostId)
      : Boolean(customTitle.trim() && customBody.trim());

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    if (!canSubmit) {
      setStatusMessage({
        type: 'error',
        text: broadcastMode === 'post' ? 'దయచేసి ఒక వార్తను ఎంచుకోండి.' : 'శీర్షిక మరియు వివరణ తప్పనిసరి.',
      });
      return;
    }
    setConfirmPending(true);
  };

  const executeBroadcast = async () => {
    setConfirmPending(false);
    setIsSending(true);
    setStatusMessage(null);

    try {
      const payload = buildBroadcastPayload({
        mode: broadcastMode,
        audience,
        district: selectedDistrict,
        categoryTopic: selectedCategoryTopic,
        channelId,
        silent: isSilent,
        post: selectedPost
          ? {
              id: selectedPost.id,
              headlineTelugu: selectedPost.headline?.telugu || selectedPost.headline?.english || '',
              mediaUrl: selectedPost.mediaUrl,
              district: selectedPost.district,
            }
          : null,
        customTitle,
        customBody,
      });

      const functions = getFunctions(app, 'asia-south1');
      const sendPush = httpsCallable(functions, 'triggerPushBroadcast');
      const result: any = await sendPush(payload);

      if (result.data?.success) {
        setStatusMessage({
          type: 'success',
          text: `నోటిఫికేషన్ విజయవంతంగా పంపబడింది! (టార్గెట్: ${payload.topic})`,
        });
        if (broadcastMode === 'post') {
          setSelectedPostId('');
        } else {
          setCustomTitle('');
          setCustomBody('');
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: 'నోటిఫికేషన్ పంపడం విఫలమైంది.',
        });
      }
    } catch (e: any) {
      console.error('Full Broadcast Error Object:', e);
      const detailedError = e?.details || e?.message || 'Unknown error';
      setStatusMessage({
        type: 'error',
        text: `లోపం: ${detailedError}`,
      });
    } finally {
      setIsSending(false);
    }
  };

  const quotaRatio = Math.min(100, Math.round((health.dailyBreakingCount / health.dailyBreakingMax) * 100));

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-mallanna text-slate-900">
      {/* Inline Status Feedback Banner */}
      {statusMessage && (
        <div
          role="status"
          className={`flex items-center gap-3 p-4 rounded-xl border text-base font-semibold ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 1. LIVE NOTIFICATION ENGINE HEALTH & CONTROLS CARD */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div
          className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${
            health.needsAttention
              ? 'bg-amber-50 border-amber-200'
              : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Radio
              className={`w-5 h-5 ${
                health.needsAttention ? 'text-amber-600' : 'text-emerald-600'
              }`}
            />
            <div>
              <h2 className="text-xl font-ramabhadra text-slate-900">
                నోటిఫికేషన్ సిస్టమ్ లైవ్ కంట్రోల్ & హెల్త్
              </h2>
              <p className="text-sm text-slate-600">
                {loadingHealth ? 'స్థితి తనిఖీ చేస్తోంది...' : health.overallStatusLabel}
              </p>
            </div>
          </div>

          {health.needsAttention && (
            <button
              type="button"
              onClick={handleResumeAll}
              disabled={updatingHealth}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-60"
            >
              {updatingHealth ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4" />
              )}
              <span>అన్నీ ప్రారంభించు (Resume All)</span>
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Live ON/OFF Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Scheduled Push Toggle */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-base text-slate-900">షెడ్యూల్డ్ వార్తలు</div>
                <div className="text-xs text-slate-500">8 AM • 1 PM • 6 PM • 9 PM IST</div>
                {health.scheduledPaused && (
                  <div className="text-xs text-amber-700 font-semibold mt-1">
                    పాజ్‌లో ఉంది ({health.scheduledPauseRemainingHours} గం. మిగిలింది)
                  </div>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={health.scheduledEnabled && !health.scheduledPaused}
                aria-label="షెడ్యూల్డ్ వార్తల నోటిఫికేషన్లు"
                disabled={updatingHealth}
                onClick={() =>
                  handleToggleEngine(
                    'scheduledNotificationsEnabled',
                    !(health.scheduledEnabled && !health.scheduledPaused)
                  )
                }
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  health.scheduledEnabled && !health.scheduledPaused
                    ? 'bg-emerald-600'
                    : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                    health.scheduledEnabled && !health.scheduledPaused
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Breaking Push Toggle */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-base text-slate-900">బ్రేకింగ్ న్యూస్ అలర్ట్స్</div>
                <div className="text-xs text-slate-500">గరిష్టంగా 6 స్టేట్ + 3 జిల్లా / రోజు</div>
                {health.breakingPaused && (
                  <div className="text-xs text-amber-700 font-semibold mt-1">
                    పాజ్‌లో ఉంది ({health.breakingPauseRemainingHours} గం. మిగిలింది)
                  </div>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={health.breakingEnabled && !health.breakingPaused}
                aria-label="బ్రేకింగ్ న్యూస్ అలర్ట్స్"
                disabled={updatingHealth}
                onClick={() =>
                  handleToggleEngine(
                    'breakingNotificationsEnabled',
                    !(health.breakingEnabled && !health.breakingPaused)
                  )
                }
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  health.breakingEnabled && !health.breakingPaused
                    ? 'bg-emerald-600'
                    : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                    health.breakingEnabled && !health.breakingPaused
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Daily Statewide Breaking Quota Meter */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-slate-700">ఈ రోజు స్టేట్‌వైడ్ బ్రేకింగ్ వినియోగం</span>
              <span
                className={`font-bold tabular-nums ${
                  health.dailyBreakingCount >= health.dailyBreakingMax
                    ? 'text-red-600'
                    : 'text-slate-900'
                }`}
              >
                {health.dailyBreakingCount} / {health.dailyBreakingMax}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  health.dailyBreakingCount >= health.dailyBreakingMax
                    ? 'bg-red-600'
                    : 'bg-emerald-600'
                }`}
                style={{ width: `${quotaRatio}%` }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs text-slate-600">
              <div>
                <span className="font-bold text-slate-800">చివరి షెడ్యూల్డ్: </span>
                {health.lastScheduledHeadline
                  ? `${health.lastScheduledSlotHour ? `(${health.lastScheduledSlotHour}:00) ` : ''}${health.lastScheduledHeadline}`
                  : 'ఇంకా నమోదు కాలేదు'}
              </div>
              <div>
                <span className="font-bold text-slate-800">చివరి బ్రేకింగ్: </span>
                {health.lastBreakingHeadline || 'ఇంకా నమోదు కాలేదు'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. MANUAL HYBRID PUSH BROADCAST FORM */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-200">
          <h2 className="text-2xl font-ramabhadra text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-red-600" />
            <span>మాన్యువల్ పుష్ బ్రాడ్‌కాస్ట్ (Android & Web)</span>
          </h2>

          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setBroadcastMode('post')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                broadcastMode === 'post' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              వార్త ఎంపిక
            </button>
            <button
              type="button"
              onClick={() => setBroadcastMode('custom')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                broadcastMode === 'custom' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              కస్టమ్ మెసేజ్
            </button>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-5">
          {/* Audience Selection */}
          <div className="space-y-2">
            <label className="block text-slate-700 font-bold text-base">
              టార్గెట్ ఆడియెన్స్ (ఎవరికి వెళ్ళాలి?)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAudience('all')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-sm font-bold transition-all ${
                  audience === 'all'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>అందరికీ</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAudience('district');
                  setChannelId('local_news_v2');
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-sm font-bold transition-all ${
                  audience === 'district'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>జిల్లా</span>
              </button>
              <button
                type="button"
                onClick={() => setAudience('category')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-sm font-bold transition-all ${
                  audience === 'category'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Tag className="w-4 h-4" />
                <span>కేటగిరీ</span>
              </button>
            </div>

            {audience === 'district' && (
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                aria-label="జిల్లాను ఎంచుకోండి"
                className="w-full mt-2 border border-slate-300 px-3.5 py-2.5 rounded-xl text-base bg-white focus:border-red-500 outline-none"
              >
                {ALL_CANONICAL_DISTRICTS.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            )}

            {audience === 'category' && (
              <select
                value={selectedCategoryTopic}
                onChange={(e) => setSelectedCategoryTopic(e.target.value)}
                aria-label="కేటగిరీని ఎంచుకోండి"
                className="w-full mt-2 border border-slate-300 px-3.5 py-2.5 rounded-xl text-base bg-white focus:border-red-500 outline-none"
              >
                {CATEGORY_TOPIC_OPTIONS.map((opt) => (
                  <option key={opt.topic} value={opt.topic}>
                    {opt.label} ({opt.topic})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Channel & Sound Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="broadcast-channel" className="block text-slate-700 font-bold text-sm">
                నోటిఫికేషన్ ఛానెల్
              </label>
              <select
                id="broadcast-channel"
                value={channelId}
                onChange={(e) => {
                  const next = e.target.value as 'general_news_v2' | 'breaking_news' | 'local_news_v2';
                  setChannelId(next);
                  if (next === 'breaking_news') setIsSilent(false);
                }}
                className="w-full border border-slate-300 px-3.5 py-2.5 rounded-xl text-base bg-white focus:border-red-500 outline-none"
              >
                <option value="general_news_v2">సాధారణ వార్తలు (general_news_v2)</option>
                <option value="breaking_news">బ్రేకింగ్ న్యూస్ (breaking_news)</option>
                <option value="local_news_v2">జిల్లా వార్తలు (local_news_v2)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="block text-slate-700 font-bold text-sm">అలర్ట్ మోడ్ (Sound)</span>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSilent(false)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                    !isSilent ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Alert</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSilent(true)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                    isSilent ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  <VolumeX className="w-4 h-4" />
                  <span>Silent</span>
                </button>
              </div>
            </div>
          </div>

          {/* Post Selector OR Custom Fields */}
          {broadcastMode === 'post' ? (
            <div className="space-y-2">
              <label htmlFor="broadcast-post" className="block text-slate-700 font-bold text-sm">
                వార్తను ఎంచుకోండి (Select News)
              </label>
              {loadingPosts ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
                  వార్తలు లోడ్ అవుతున్నాయి...
                </div>
              ) : (
                <select
                  id="broadcast-post"
                  value={selectedPostId}
                  onChange={(e) => {
                    setSelectedPostId(e.target.value);
                    setConfirmPending(false);
                  }}
                  className="w-full border border-slate-300 p-3.5 rounded-xl text-base focus:border-red-500 outline-none bg-white"
                  required
                >
                  <option value="">-- వార్తను ఎంచుకోండి --</option>
                  {latestPosts.map((post) => (
                    <option key={post.id} value={post.id}>
                      {post.headline?.telugu || post.headline?.english || post.id}
                    </option>
                  ))}
                </select>
              )}

              {selectedPost && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                  {previewImage && (
                    <img
                      src={previewImage}
                      alt=""
                      className="w-20 h-14 object-cover rounded-lg border border-slate-200 shrink-0"
                    />
                  )}
                  <div className="min-w-0 text-xs text-slate-600 space-y-0.5">
                    <div className="font-bold text-sm text-slate-900 truncate">
                      {selectedPost.headline?.telugu}
                    </div>
                    <div className="truncate">App Link: alfanews://news/{selectedPost.id}</div>
                    <div className="truncate">Web Link: https://alfanews.app/news/{selectedPost.id}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="custom-notif-title" className="block text-slate-700 font-bold text-sm mb-1">
                  నోటిఫికేషన్ శీర్షిక (Title)
                </label>
                <input
                  id="custom-notif-title"
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="ఉదా: ఆంధ్రప్రదేశ్ ముఖ్యమైన అప్‌డేట్"
                  className="w-full border border-slate-300 px-3.5 py-2.5 rounded-xl text-base focus:border-red-500 outline-none"
                  required
                />
              </div>
              <div>
                <label htmlFor="custom-notif-body" className="block text-slate-700 font-bold text-sm mb-1">
                  వివరణ (Body)
                </label>
                <textarea
                  id="custom-notif-body"
                  rows={3}
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  placeholder="నోటిఫికేషన్ సందేశాన్ని ఇక్కడ రాయండి..."
                  className="w-full border border-slate-300 px-3.5 py-2.5 rounded-xl text-base focus:border-red-500 outline-none"
                  required
                />
              </div>
            </div>
          )}

          {/* Inline Confirmation Bar (avoids window.confirm) */}
          {confirmPending ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-bold text-red-900">
                ఈ నోటిఫికేషన్‌ను ఎంచుకున్న యూజర్లందరికీ పంపాలా?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmPending(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50"
                >
                  రద్దు చేయి
                </button>
                <button
                  type="button"
                  onClick={executeBroadcast}
                  disabled={isSending}
                  className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm"
                >
                  అవును, ఇప్పుడే పంపు
                </button>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              disabled={isSending || !canSubmit}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-sm transition-all flex items-center justify-center gap-2.5 text-white ${
                isSending || !canSubmit
                  ? 'bg-slate-400 cursor-not-allowed'
                  : channelId === 'breaking_news'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {isSending ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              <span>{isSending ? 'పంపుతోంది...' : 'పుష్ నోటిఫికేషన్ పంపు'}</span>
            </button>
          )}
        </form>
      </section>
    </div>
  );
};

export default AdminNotificationsPage;
