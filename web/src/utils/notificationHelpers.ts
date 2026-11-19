import { AP_DISTRICTS, TS_DISTRICTS } from './newsFilter.ts';

export const ALL_CANONICAL_DISTRICTS: string[] = [...AP_DISTRICTS, ...TS_DISTRICTS];

export const CATEGORY_TOPIC_OPTIONS: Array<{ label: string; topic: string }> = [
  { label: 'రాజకీయం', topic: 'cat_politics' },
  { label: 'వినోదం', topic: 'cat_cinema' },
  { label: 'క్రైమ్', topic: 'cat_crime' },
  { label: 'క్రీడలు', topic: 'cat_sports' },
  { label: 'వ్యాపారం', topic: 'cat_business' },
  { label: 'టెక్నాలజీ', topic: 'cat_technology' },
  { label: 'ఆరోగ్యం', topic: 'cat_health' },
  { label: 'విద్య', topic: 'cat_education' },
  { label: 'భక్తి', topic: 'cat_spiritual' },
  { label: 'వ్యవసాయం', topic: 'cat_agriculture' },
  { label: 'జాతీయం', topic: 'cat_national' },
  { label: 'ప్రపంచం', topic: 'cat_international' },
  { label: 'జీవనశైలి', topic: 'cat_lifestyle' },
];

const DISTRICT_ALIAS_MAP: Record<string, string> = {
  'విజయవాడ': 'ఎన్టీఆర్',
  'NTR': 'ఎన్టీఆర్',
  'Vijayawada': 'ఎన్టీఆర్',
  'రాజమండ్రి': 'తూర్పు గోదావరి',
  'రాజమహేంద్రవరం': 'తూర్పు గోదావరి',
  'East Godavari': 'తూర్పు గోదావరి',
  'తూర్పుగోదావరి': 'తూర్పు గోదావరి',
  'పశ్చిమగోదావరి': 'పశ్చిమ గోదావరి',
  'West Godavari': 'పశ్చిమ గోదావరి',
  'భీమవరం': 'పశ్చిమ గోదావరి',
  'అమలాపురం': 'కోనసీమ',
  'డాక్టర్ బి.ఆర్. అంబేద్కర్ కోనసీమ': 'కోనసీమ',
  'Konaseema': 'కోనసీమ',
  'నెల్లూరు': 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు',
  'Nellore': 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు',
  'SPSR Nellore': 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు',
  'కడప': 'వైఎస్ఆర్ కడప',
  'వైఎస్సార్ కడప': 'వైఎస్ఆర్ కడప',
  'Kadapa': 'వైఎస్ఆర్ కడప',
  'YSR Kadapa': 'వైఎస్ఆర్ కడప',
  'రాయచోటి': 'అన్నమయ్య',
  'Annamayya': 'అన్నమయ్య',
  'పుట్టపర్తి': 'శ్రీ సత్యసాయి',
  'సత్యసాయి': 'శ్రీ సత్యసాయి',
  'Sri Sathya Sai': 'శ్రీ సత్యసాయి',
  'ఒంగోలు': 'ప్రకాశం',
  'Prakasam': 'ప్రకాశం',
  'నరసరావుపేట': 'పల్నాడు',
  'Palnadu': 'పల్నాడు',
  'మన్యం': 'పార్వతీపురం మన్యం',
  'పార్వతీపురం': 'పార్వతీపురం మన్యం',
  'పాడేరు': 'అల్లూరి సీతారామరాజు',
  'అల్లూరి': 'అల్లూరి సీతారామరాజు',
  'మచిలీపట్నం': 'కృష్ణా',
  'Krishna': 'కృష్ణా',
  'తిరుమల': 'తిరుపతి',
  'Tirupati': 'తిరుపతి',
  'విశాఖ': 'విశాఖపట్నం',
  'వైజాగ్': 'విశాఖపట్నం',
  'Visakhapatnam': 'విశాఖపట్నం',
  'సైబరాబాద్': 'హైదరాబాద్',
  'సికింద్రాబాద్': 'హైదరాబాద్',
  'Hyderabad': 'హైదరాబాద్',
  'కొత్తగూడెం': 'భద్రాద్రి కొత్తగూడెం',
  'Kothagudem': 'భద్రాద్రి కొత్తగూడెం',
  'భూపాలపల్లి': 'జయశంకర్ భూపాలపల్లి',
  'గద్వాల': 'జోగులాంబ గద్వాల',
  'Gadwal': 'జోగులాంబ గద్వాల',
  'ఆసిఫాబాద్': 'కుమ్రం భీమ్ ఆసిఫాబాద్',
  'Asifabad': 'కుమ్రం భీమ్ ఆసిఫాబాద్',
  'మహబూబ్‌నగర్': 'మహబూబ్ నగర్',
  'Mahabubnagar': 'మహబూబ్ నగర్',
  'సిరిసిల్ల': 'రాజన్న సిరిసిల్ల',
  'Sircilla': 'రాజన్న సిరిసిల్ల',
  'వరంగల్ అర్బన్': 'హన్మకొండ',
  'హనుమకొండ': 'హన్మకొండ',
  'Hanamkonda': 'హన్మకొండ',
  'వరంగల్ రూరల్': 'వరంగల్',
  'Warangal': 'వరంగల్',
  'భువనగిరి': 'యాదాద్రి భువనగిరి',
  'యాదాద్రి': 'యాదాద్రి భువనగిరి',
  'నల్లగొండ': 'నల్గొండ',
  'నాగర్‌కర్నూల్': 'నాగర్ కర్నూల్',
  'మేడ్చల్': 'మేడ్చల్ మల్కాజిగిరి',
  'మల్కాజిగిరి': 'మేడ్చల్ మల్కాజిగిరి',
};

/**
 * Exact hex-encoding parity with backend functions/src/utils.ts & Android NotificationHelper.kt.
 */
export function slugifyTopic(text?: string | null): string {
  if (!text || !text.trim()) return 'default';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      result += text[i];
    } else {
      result += code.toString(16).padStart(4, '0');
    }
  }
  return result.length > 80 ? result.substring(0, 80) : result;
}

export function getCanonicalDistrict(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const clean = raw.trim();
  if (!clean) return '';

  if (ALL_CANONICAL_DISTRICTS.includes(clean)) return clean;
  if (DISTRICT_ALIAS_MAP[clean]) return DISTRICT_ALIAS_MAP[clean];

  for (const [alias, canonical] of Object.entries(DISTRICT_ALIAS_MAP)) {
    if (clean.includes(alias)) return canonical;
  }
  for (const dist of ALL_CANONICAL_DISTRICTS) {
    if (clean.includes(dist) || dist.includes(clean)) return dist;
  }
  return clean;
}

export function getDistrictTopicName(district: string): string {
  const canonical = getCanonicalDistrict(district);
  if (!canonical) return 'all_users';
  return `district_${slugifyTopic(canonical)}`;
}

/**
 * Enforces Zero Firebase Storage Egress Policy by routing Firebase Storage images
 * through Cloudflare's wsrv.nl edge cache proxy.
 */
export function getEdgeProxiedImageUrl(imageUrl?: string | null): string {
  if (!imageUrl || typeof imageUrl !== 'string') return '';
  const trimmed = imageUrl.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return '';
  if (trimmed.includes('wsrv.nl')) return trimmed;

  const isFirebaseStorage =
    trimmed.includes('firebasestorage.googleapis.com') ||
    trimmed.includes('firebasestorage.app') ||
    trimmed.includes('storage.googleapis.com');

  if (isFirebaseStorage) {
    return `https://wsrv.nl/?url=${encodeURIComponent(trimmed)}&w=640&output=webp&q=75`;
  }
  return trimmed;
}

export interface BroadcastPayloadInput {
  mode: 'post' | 'custom';
  audience: 'all' | 'district' | 'category';
  district?: string;
  categoryTopic?: string;
  channelId: 'general_news_v2' | 'breaking_news' | 'local_news_v2';
  silent: boolean;
  post?: {
    id: string;
    headlineTelugu: string;
    mediaUrl?: string;
    district?: string;
  } | null;
  customTitle?: string;
  customBody?: string;
}

export function buildBroadcastPayload(input: BroadcastPayloadInput) {
  let topic = 'all_users';
  let canonicalDistrict = '';

  if (input.audience === 'district' && input.district) {
    canonicalDistrict = getCanonicalDistrict(input.district);
    topic = getDistrictTopicName(canonicalDistrict);
  } else if (input.audience === 'category' && input.categoryTopic) {
    topic = input.categoryTopic;
  }

  if (input.mode === 'custom') {
    return {
      title: (input.customTitle || '').trim(),
      body: (input.customBody || '').trim(),
      actionUrl: '',
      newsId: '',
      topic,
      channelId: input.channelId,
      silent: input.silent,
      imageUrl: '',
      district: canonicalDistrict,
    };
  }

  const post = input.post;
  const headline = (post?.headlineTelugu || '').trim();
  const titlePrefix =
    input.channelId === 'breaking_news'
      ? '🔴 బ్రేకింగ్: '
      : input.audience === 'district' && canonicalDistrict
        ? `📍 ${canonicalDistrict}: `
        : '';

  const title = `${titlePrefix}${headline}`.trim();
  const newsId = post?.id || '';

  return {
    title,
    body: headline,
    actionUrl: newsId ? `alfanews://news/${newsId}` : '',
    newsId,
    topic,
    channelId: input.channelId,
    silent: input.silent,
    imageUrl: getEdgeProxiedImageUrl(post?.mediaUrl),
    district: canonicalDistrict || getCanonicalDistrict(post?.district),
  };
}

export interface NotificationHealthSummary {
  scheduledEnabled: boolean;
  breakingEnabled: boolean;
  scheduledPaused: boolean;
  breakingPaused: boolean;
  scheduledPauseRemainingHours: number;
  breakingPauseRemainingHours: number;
  dailyBreakingCount: number;
  dailyBreakingMax: number;
  needsAttention: boolean;
  overallStatusLabel: string;
  lastScheduledHeadline: string;
  lastScheduledSlotHour: number | null;
  lastBreakingHeadline: string;
}

export function getTodayIstDateString(nowMs: number = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(nowMs));
}

export function evaluateNotificationHealth(
  settingsData: Record<string, any> | null | undefined,
  dailyQuotaData: Record<string, any> | null | undefined,
  nowMs: number = Date.now()
): NotificationHealthSummary {
  const s = settingsData || {};
  const q = dailyQuotaData || {};

  const scheduledEnabled = s.scheduledNotificationsEnabled !== false;
  const breakingEnabled = s.breakingNotificationsEnabled !== false;

  const pauseSchedMs = Number(s.pauseScheduledUntil || 0);
  const pauseBreakMs = Number(s.pauseBreakingUntil || 0);

  const scheduledPaused = Number.isFinite(pauseSchedMs) && pauseSchedMs > nowMs;
  const breakingPaused = Number.isFinite(pauseBreakMs) && pauseBreakMs > nowMs;

  const scheduledPauseRemainingHours = scheduledPaused
    ? Math.max(0.1, Math.round(((pauseSchedMs - nowMs) / (1000 * 60 * 60)) * 10) / 10)
    : 0;
  const breakingPauseRemainingHours = breakingPaused
    ? Math.max(0.1, Math.round(((pauseBreakMs - nowMs) / (1000 * 60 * 60)) * 10) / 10)
    : 0;

  const todayIst = getTodayIstDateString(nowMs);
  const dailyBreakingCount = q.date === todayIst ? Math.max(0, Number(q.count || 0)) : 0;
  const dailyBreakingMax = 6;

  const needsAttention =
    !scheduledEnabled ||
    !breakingEnabled ||
    scheduledPaused ||
    breakingPaused ||
    dailyBreakingCount >= dailyBreakingMax;

  let overallStatusLabel = 'యాక్టివ్ (సక్రమంగా పనిచేస్తోంది)';
  if (!scheduledEnabled && !breakingEnabled) {
    overallStatusLabel = 'పూర్తిగా నిలిపివేయబడింది (OFF)';
  } else if (!scheduledEnabled || !breakingEnabled) {
    overallStatusLabel = 'పాక్షికంగా ఆఫ్‌లో ఉంది';
  } else if (scheduledPaused || breakingPaused) {
    overallStatusLabel = 'తాత్కాలిక పాజ్‌లో ఉంది';
  } else if (dailyBreakingCount >= dailyBreakingMax) {
    overallStatusLabel = 'నేటి బ్రేకింగ్ పరిమితి పూర్తయింది';
  }

  return {
    scheduledEnabled,
    breakingEnabled,
    scheduledPaused,
    breakingPaused,
    scheduledPauseRemainingHours,
    breakingPauseRemainingHours,
    dailyBreakingCount,
    dailyBreakingMax,
    needsAttention,
    overallStatusLabel,
    lastScheduledHeadline: String(s.lastScheduledSummary?.headline || ''),
    lastScheduledSlotHour:
      typeof s.lastScheduledSummary?.slotHour === 'number' ? s.lastScheduledSummary.slotHour : null,
    lastBreakingHeadline: String(s.lastBreakingSummary?.headline || ''),
  };
}
