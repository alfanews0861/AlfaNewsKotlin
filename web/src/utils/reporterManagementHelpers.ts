import {
  DAY_MS,
  type DisplayReporterStage,
  formatIstShortDate,
  getIstDateKey,
  parseEpochMs,
} from './reporterTracking.ts';

export const ROLE_LABELS_TE: Record<string, string> = {
  REPORTER: 'రిపోర్టర్',
  STAFF_REPORTER: 'స్టాఫ్ రిపోర్టర్',
  REGIONAL_INCHARGE: 'రీజినల్ ఇంచార్జ్',
  ADMIN: 'అడ్మిన్',
  SUBSCRIBER: 'సబ్‌స్క్రైబర్',
  GUEST: 'గెస్ట్',
};

export const STAGE_META_TE: Record<
  DisplayReporterStage,
  { label: string; shortLabel: string; toneClass: string }
> = {
  ACTIVE: {
    label: 'చురుకుగా',
    shortLabel: 'చురుకుగా',
    toneClass: 'text-emerald-700',
  },
  NEW_NO_POSTS: {
    label: 'కొత్త రిపోర్టర్ · ఇంకా వార్త లేదు',
    shortLabel: 'కొత్త రిపోర్టర్',
    toneClass: 'text-teal-700',
  },
  REMINDED_3D: {
    label: '3వ రోజు రిమైండర్',
    shortLabel: '3–6 రోజులు',
    toneClass: 'text-amber-700',
  },
  REMINDED_7D: {
    label: '7వ రోజు ఫాలో-అప్',
    shortLabel: '7–9 రోజులు',
    toneClass: 'text-orange-700',
  },
  ADMIN_ALERTED_10D: {
    label: '10+ రోజులు · అడ్మిన్ పరిశీలన',
    shortLabel: '10+ రోజులు',
    toneClass: 'text-rose-700',
  },
  EXEMPT: {
    label: 'రిమైండర్ నిలిపివేత (మినహాయింపు)',
    shortLabel: 'మినహాయింపు',
    toneClass: 'text-slate-600',
  },
};

export function getClean10DigitPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  let digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.substring(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.substring(1);
  } else if (digits.length > 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]/.test(last10)) {
      digits = last10;
    }
  }
  return digits.length === 10 ? digits : '';
}

export function formatDisplayPhone(phone?: string | null): string {
  const clean10 = getClean10DigitPhone(phone);
  if (clean10.length === 10) {
    return `+91 ${clean10.slice(0, 5)} ${clean10.slice(5)}`;
  }
  return phone ? String(phone).trim() : '';
}

export interface MandalOccupantEntry {
  userId: string;
  name: string;
  phone?: string;
  label: string;
}

function normalizeAreaKey(district: string, mandal: string): string {
  return `${district.trim().toLowerCase().replace(/\s+/g, '')}|${mandal
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')}`;
}

export function buildOccupiedMandalsMap(
  reporters: Array<{
    id: string;
    name?: string;
    phone?: string;
    district?: string;
    state_district?: string;
    assignedMandal?: string;
    mandal?: string;
    mandalam?: string;
    selectedMandal?: string;
    suspended?: boolean;
    previouslyDowngraded?: boolean;
  }>
): Record<string, MandalOccupantEntry[]> {
  const map: Record<string, MandalOccupantEntry[]> = {};
  for (const u of reporters) {
    if (u.suspended === true || u.previouslyDowngraded === true) continue;
    const dist = (u.district || u.state_district || '').trim();
    const mandal = (u.assignedMandal || u.mandal || u.mandalam || u.selectedMandal || '').trim();
    if (!dist || !mandal) continue;

    const key = normalizeAreaKey(dist, mandal);
    const phoneStr = u.phone ? ` (${u.phone})` : '';
    const entry: MandalOccupantEntry = {
      userId: u.id,
      name: u.name || 'Active Reporter',
      phone: u.phone,
      label: `${u.name || 'Active Reporter'}${phoneStr}`,
    };
    if (!map[key]) {
      map[key] = [entry];
    } else if (!map[key].some((e) => e.userId === entry.userId)) {
      map[key].push(entry);
    }
  }
  return map;
}

export function findMandalOccupant(
  occupiedMap: Record<string, MandalOccupantEntry[]>,
  district?: string | null,
  mandal?: string | null,
  excludeUserId?: string | null
): MandalOccupantEntry | null {
  if (!district || !mandal) return null;
  const distTrim = district.trim();
  const mandalTrim = mandal.trim();
  if (!distTrim || !mandalTrim || distTrim === 'N/A' || mandalTrim === 'N/A') return null;

  const entries = occupiedMap[normalizeAreaKey(distTrim, mandalTrim)];
  if (!entries || entries.length === 0) return null;

  const match = entries.find((e) => !excludeUserId || e.userId !== excludeUserId);
  return match || null;
}

export function resolveSmartDefaultTab(pendingApplicationsCount: number): 'applications' | 'reporters' {
  return pendingApplicationsCount > 0 ? 'applications' : 'reporters';
}

export interface PaginationResult<T> {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): PaginationResult<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize || 25));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(page || 1)), totalPages);
  const startOffset = (currentPage - 1) * safePageSize;
  const sliced = items.slice(startOffset, startOffset + safePageSize);

  return {
    items: sliced,
    currentPage,
    totalPages,
    totalItems,
    startIndex: totalItems === 0 ? 0 : startOffset + 1,
    endIndex: totalItems === 0 ? 0 : startOffset + sliced.length,
  };
}

export interface DailyActivityPoint {
  dateKey: string;
  shortLabel: string;
  count: number;
}

export function buildDailyActivitySeries(
  dailyCounts: Record<string, number> | undefined | null,
  days: number = 14,
  nowMs: number = Date.now()
): DailyActivityPoint[] {
  const safeDays = Math.max(1, Math.min(35, Math.floor(days)));
  const counts = dailyCounts && typeof dailyCounts === 'object' ? dailyCounts : {};
  const series: DailyActivityPoint[] = [];

  for (let i = safeDays - 1; i >= 0; i--) {
    const dayMs = nowMs - i * DAY_MS;
    const dateKey = getIstDateKey(dayMs);
    const shortLabel = dateKey.slice(5); // MM-DD
    const rawVal = Number(counts[dateKey] || 0);
    series.push({
      dateKey,
      shortLabel,
      count: Number.isFinite(rawVal) && rawVal > 0 ? Math.floor(rawVal) : 0,
    });
  }

  return series;
}

export function deduplicateFormerReporters<
  T extends { id: string; downgradedAt?: any; suspendedAt?: any; updatedAt?: any }
>(records: T[]): T[] {
  const byId = new Map<string, T>();
  for (const rec of records) {
    if (!rec || !rec.id) continue;
    const existing = byId.get(rec.id);
    if (!existing) {
      byId.set(rec.id, rec);
    } else {
      byId.set(rec.id, { ...existing, ...rec });
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aTs = parseEpochMs(a.downgradedAt) ?? parseEpochMs(a.suspendedAt) ?? parseEpochMs(a.updatedAt) ?? 0;
    const bTs = parseEpochMs(b.downgradedAt) ?? parseEpochMs(b.suspendedAt) ?? parseEpochMs(b.updatedAt) ?? 0;
    return bTs - aTs;
  });
}

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Mitigate spreadsheet formula injection when exporting user-supplied text
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvReporterRow {
  name?: string;
  role?: string;
  phone?: string;
  state?: string;
  district?: string;
  assignedMandal?: string;
  mandal?: string;
  todayNewsCount?: number;
  lastWeekNewsCount?: number;
  last30DaysNewsCount?: number;
  totalNewsCount?: number;
  referralCount?: number;
  daysInactive?: number;
  inactivityStage?: DisplayReporterStage;
  lastPostTimestamp?: number | null;
}

export function buildReportersCsv(reporters: CsvReporterRow[]): string {
  const headers = [
    'పేరు (Name)',
    'హోదా (Role)',
    'ఫోన్ (Phone)',
    'రాష్ట్రం (State)',
    'జిల్లా (District)',
    'మండలం (Mandal)',
    'ఈ రోజు (Today)',
    '7 రోజులు (7 Days)',
    '30 రోజులు (30 Days)',
    'మొత్తం వార్తలు (Total)',
    'యాప్ ఇన్‌స్టాల్స్ (Referrals)',
    'స్థితి (Status)',
    'వార్త లేని రోజులు (Days Inactive)',
    'చివరి వార్త (Last Post)',
  ];

  const lines: string[] = [headers.map(escapeCsvCell).join(',')];

  for (const r of reporters) {
    const roleLabel = ROLE_LABELS_TE[r.role || ''] || r.role || '';
    const stageLabel = r.inactivityStage ? STAGE_META_TE[r.inactivityStage]?.label || r.inactivityStage : '';
    const row = [
      r.name || '',
      roleLabel,
      formatDisplayPhone(r.phone) || '',
      r.state || 'TS',
      r.district || '',
      r.assignedMandal || r.mandal || '',
      r.todayNewsCount ?? 0,
      r.lastWeekNewsCount ?? 0,
      r.last30DaysNewsCount ?? 0,
      r.totalNewsCount ?? 0,
      r.referralCount ?? 0,
      stageLabel,
      r.daysInactive ?? 0,
      formatIstShortDate(r.lastPostTimestamp),
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  }

  // UTF-8 BOM guarantees clean Telugu rendering in Excel & Google Sheets
  return `\uFEFF${lines.join('\r\n')}`;
}
