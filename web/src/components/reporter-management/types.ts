import { ReporterReminderLog, User, UserRole } from '../../types';
import { DisplayReporterStage } from '../../utils/reporterTracking';

export type ReporterTab = 'applications' | 'reporters' | 'former' | 'automation' | 'installs';

export type AppStatusFilter = 'PENDING' | 'JOINED' | 'REJECTED' | 'ALL';

export type StageFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'REMINDED_3D'
  | 'REMINDED_7D'
  | 'ADMIN_ALERTED_10D'
  | 'EXEMPT';

export type SortField =
  | 'state'
  | 'district'
  | 'name'
  | 'totalNewsCount'
  | 'lastWeekNewsCount'
  | 'todayNewsCount'
  | 'joinedAt'
  | 'lastPostTimestamp'
  | 'daysInactive'
  | 'referralCount';

export interface ReporterWithCounts extends User {
  totalNewsCount: number;
  lastWeekNewsCount: number;
  last30DaysNewsCount: number;
  todayNewsCount: number;
  assignedMandal?: string;
  joinedAt: number;
  isNewlyJoined: boolean;
  daysSinceJoined: number;
  lastPostTimestamp: number | null;
  daysInactive: number;
  inactivityStage: DisplayReporterStage;
  suspended?: boolean;
  previouslyDowngraded?: boolean;
}

export interface ReporterApplication {
  id: string;
  userId?: string;
  name?: string;
  phone?: string;
  phoneNumber?: string;
  district?: string;
  state_district?: string;
  mandal?: string;
  education?: string;
  experience?: string;
  status?: string;
  timestamp?: any;
  approvedAt?: any;
  approvedBy?: string;
  rejectedAt?: any;
  rejectedBy?: string;
  [key: string]: any;
}

export interface FormerReporter extends User {
  suspended?: boolean;
  previouslyDowngraded?: boolean;
  downgradedAt?: any;
  downgradedBy?: string;
  downgradedReason?: string;
  suspendedAt?: any;
  previousRole?: UserRole | string;
  totalNewsCount?: number;
}

export interface ReporterRecentArticle {
  id: string;
  headline: string;
  district?: string;
  mandal?: string;
  timestamp: number;
  approved?: boolean;
  isCrossMandal?: boolean;
  mediaType?: string;
}

export interface ReporterDrawerDetails {
  articles: ReporterRecentArticle[];
  reminderLogs: ReporterReminderLog[];
  loadedAt: number;
}

export interface ToastNotice {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

export interface ConfirmModalConfig {
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'danger' | 'warning' | 'primary';
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  defaultReason?: string;
  onConfirm: (reason?: string) => Promise<void> | void;
}
