import type { ReporterInactivityStage, ReporterTrackingConfig } from '../types';

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_TRACKING_CONFIG: ReporterTrackingConfig = {
  enabled: true,
  firstReminderDays: 3,
  secondReminderDays: 7,
  adminAlertDays: 10,
  adminAlertRepeatDays: 5,
  day3Title: 'మీ ప్రాంత తాజా వార్తలు పంపండి',
  day3Body:
    'నమస్కారం {name} గారు, గత {days} రోజులుగా మీ మండలం ({mandal}) నుండి తాజా వార్తలు రాలేదు. స్థానిక విశేషాలు, ప్రజా సమస్యలను Alfa News లో పోస్ట్ చేయగలరని కోరుతున్నాము.',
  day7Title: 'మీ మండల వార్తల అప్‌డేట్ కోసం ఎదురుచూస్తున్నాము',
  day7Body:
    'నమస్కారం {name} గారు, గత {days} రోజులుగా మీ ప్రాంతం ({mandal}) నుండి వార్తలు అందలేదు. ఏవైనా సాంకేతిక సమస్యలు ఉంటే ఎడిటోరియల్ డెస్క్‌ను సంప్రదించి తాజా వార్తలు పంపగలరు.',
};

export type DisplayReporterStage = ReporterInactivityStage | 'NEW_NO_POSTS';

export function parseEpochMs(val: any): number | null {
  if (val === null || val === undefined) return null;
  try {
    if (typeof val === 'number') {
      if (!Number.isFinite(val) || val <= 0) return null;
      return val > 1e11 ? Math.floor(val) : Math.floor(val * 1000);
    }
    if (val instanceof Date) {
      const ms = val.getTime();
      return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
    if (typeof val.toMillis === 'function') {
      const ms = val.toMillis();
      return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
    if (typeof val.toDate === 'function') {
      const ms = val.toDate().getTime();
      return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
    if (typeof val.seconds === 'number') {
      return Math.floor(val.seconds * 1000);
    }
    if (typeof val._seconds === 'number') {
      return Math.floor(val._seconds * 1000);
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return null;
      if (/^\d+$/.test(trimmed)) {
        const num = Number(trimmed);
        if (!Number.isFinite(num) || num <= 0) return null;
        return num > 1e11 ? Math.floor(num) : Math.floor(num * 1000);
      }
      const parsed = Date.parse(trimmed);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function getIstDateKey(epochMs: number): string {
  const istDate = new Date(epochMs + IST_OFFSET_MS);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(istDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getIstDayNumber(epochMs: number): number {
  return Math.floor((epochMs + IST_OFFSET_MS) / DAY_MS);
}

export function computeWindowCounts(
  dailyCounts: Record<string, number> | undefined | null,
  nowMs: number = Date.now()
): { todayCount: number; last7DaysCount: number; last30DaysCount: number } {
  if (!dailyCounts || typeof dailyCounts !== 'object') {
    return { todayCount: 0, last7DaysCount: 0, last30DaysCount: 0 };
  }
  const todayKey = getIstDateKey(nowMs);
  const sevenDaysCutoff = getIstDateKey(nowMs - 6 * DAY_MS);
  const thirtyDaysCutoff = getIstDateKey(nowMs - 29 * DAY_MS);

  let todayCount = 0;
  let last7DaysCount = 0;
  let last30DaysCount = 0;

  for (const [dateKey, rawVal] of Object.entries(dailyCounts)) {
    const val = Number(rawVal || 0);
    if (!Number.isFinite(val) || val <= 0) continue;
    if (dateKey === todayKey) todayCount += val;
    if (dateKey >= sevenDaysCutoff && dateKey <= todayKey) last7DaysCount += val;
    if (dateKey >= thirtyDaysCutoff && dateKey <= todayKey) last30DaysCount += val;
  }

  return { todayCount, last7DaysCount, last30DaysCount };
}

export function calculateDaysInactiveIst(reporter: any, nowMs: number = Date.now()): number {
  if (!reporter || typeof reporter !== 'object') return 0;

  const activityLast = parseEpochMs(reporter.reporterActivity?.lastApprovedPostAt);
  const docLast = parseEpochMs(reporter.lastPostTimestamp);
  const postCandidates = [activityLast, docLast].filter((v): v is number => v !== null);
  const latestPostMs = postCandidates.length > 0 ? Math.max(...postCandidates) : null;

  const promoCandidates = [
    parseEpochMs(reporter.promotedAt),
    parseEpochMs(reporter.rejoinedAt),
    parseEpochMs(reporter.roleUpdatedAt),
  ].filter((v): v is number => v !== null);
  const latestPromoMs = promoCandidates.length > 0 ? Math.max(...promoCandidates) : null;

  let referenceMs: number | null = null;
  if (latestPostMs !== null && latestPromoMs !== null) {
    referenceMs = Math.max(latestPostMs, latestPromoMs);
  } else if (latestPostMs !== null) {
    referenceMs = latestPostMs;
  } else if (latestPromoMs !== null) {
    referenceMs = latestPromoMs;
  } else {
    referenceMs =
      parseEpochMs(reporter.joinedAt) ??
      parseEpochMs(reporter.createdAt) ??
      parseEpochMs(reporter.timestamp);
  }

  if (referenceMs === null) return 0;
  return Math.max(0, getIstDayNumber(nowMs) - getIstDayNumber(referenceMs));
}

export function deriveDisplayStage(
  reporter: any,
  daysInactive: number,
  totalApprovedPosts: number,
  config: Pick<ReporterTrackingConfig, 'firstReminderDays' | 'secondReminderDays' | 'adminAlertDays'> = DEFAULT_TRACKING_CONFIG
): DisplayReporterStage {
  if (reporter?.exemptFromInactivity === true || reporter?.reporterActivity?.inactivityStage === 'EXEMPT') {
    return 'EXEMPT';
  }
  const firstDays = Math.max(1, Number(config.firstReminderDays || 3));
  const secondDays = Math.max(firstDays + 1, Number(config.secondReminderDays || 7));
  const adminDays = Math.max(secondDays + 1, Number(config.adminAlertDays || 10));

  if (totalApprovedPosts === 0 && daysInactive < firstDays) {
    return 'NEW_NO_POSTS';
  }
  if (daysInactive >= adminDays) return 'ADMIN_ALERTED_10D';
  if (daysInactive >= secondDays) return 'REMINDED_7D';
  if (daysInactive >= firstDays) return 'REMINDED_3D';
  return 'ACTIVE';
}

export function extractCanonicalReporterMetrics(
  rawData: any,
  nowMs: number = Date.now(),
  config: Pick<ReporterTrackingConfig, 'firstReminderDays' | 'secondReminderDays' | 'adminAlertDays'> = DEFAULT_TRACKING_CONFIG
): {
  totalNewsCount: number;
  todayNewsCount: number;
  lastWeekNewsCount: number;
  last30DaysNewsCount: number;
  lastPostTimestamp: number | null;
  joinedAt: number;
  daysSinceJoined: number;
  daysInactive: number;
  inactivityStage: DisplayReporterStage;
  isNewlyJoined: boolean;
} {
  const activity = rawData?.reporterActivity || {};
  const windows = computeWindowCounts(activity.dailyCounts, nowMs);

  const activityTotal =
    typeof activity.totalApprovedPosts === 'number' && Number.isFinite(activity.totalApprovedPosts)
      ? Math.max(0, Math.floor(activity.totalApprovedPosts))
      : null;
  const docTotal =
    typeof rawData?.totalNewsCount === 'number' && Number.isFinite(rawData.totalNewsCount)
      ? Math.max(0, Math.floor(rawData.totalNewsCount))
      : null;
  const legacyStatsTotal =
    typeof rawData?.stats?.totalApprovedNews === 'number' && Number.isFinite(rawData.stats.totalApprovedNews)
      ? Math.max(0, Math.floor(rawData.stats.totalApprovedNews))
      : null;

  // Never divide points / 10 (inaccurate due to 20pt video posts and 50pt bonuses)
  const totalNewsCount = Math.max(
    activityTotal ?? 0,
    docTotal ?? 0,
    legacyStatsTotal ?? 0,
    windows.last30DaysCount
  );

  const activityLast = parseEpochMs(activity.lastApprovedPostAt);
  const docLast = parseEpochMs(rawData?.lastPostTimestamp);
  const lastPostTimestamp =
    activityLast !== null && docLast !== null
      ? Math.max(activityLast, docLast)
      : (activityLast ?? docLast ?? null);

  const candidateJoins = [
    parseEpochMs(rawData?.createdAt),
    parseEpochMs(rawData?.promotedAt),
    parseEpochMs(rawData?.joinedAt),
    parseEpochMs(rawData?.timestamp),
    lastPostTimestamp,
  ].filter((t): t is number => t !== null && t > 0 && t <= nowMs);

  const joinedAt = candidateJoins.length > 0 ? Math.min(...candidateJoins) : nowMs;
  const daysSinceJoined = Math.max(0, getIstDayNumber(nowMs) - getIstDayNumber(joinedAt));
  const daysInactive = calculateDaysInactiveIst(rawData, nowMs);
  const isNewlyJoined = totalNewsCount <= 3 && daysSinceJoined <= 14;
  const inactivityStage = deriveDisplayStage(rawData, daysInactive, totalNewsCount, config);

  return {
    totalNewsCount,
    todayNewsCount: windows.todayCount,
    lastWeekNewsCount: windows.last7DaysCount,
    last30DaysNewsCount: windows.last30DaysCount,
    lastPostTimestamp,
    joinedAt,
    daysSinceJoined,
    daysInactive,
    inactivityStage,
    isNewlyJoined,
  };
}

export function formatIstDateTime(timestampMs: number | null | undefined): string {
  if (!timestampMs) return 'వార్త లేదు';
  try {
    return new Date(timestampMs).toLocaleString('te-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return 'వార్త లేదు';
  }
}

export function formatIstShortDate(timestampMs: number | null | undefined): string {
  if (!timestampMs) return 'వార్త లేదు';
  try {
    return new Date(timestampMs).toLocaleDateString('te-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return 'వార్త లేదు';
  }
}
