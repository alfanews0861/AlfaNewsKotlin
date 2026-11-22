export enum UserRole {
  GUEST = 'GUEST',
  SUBSCRIBER = 'SUBSCRIBER',
  REPORTER = 'REPORTER',
  REGIONAL_INCHARGE = 'REGIONAL_INCHARGE',
  EDITOR = 'EDITOR',
  ADMIN = 'ADMIN',
  NEWS_DESK = 'NEWS_DESK',
}

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  role: UserRole;
  address?: string;
  constituency?: string;
  promotedBy?: string;
  signatureUrl?: string;
  idCardUrl?: string;
  state?: string;
  stateCode?: string;
  language?: string;
  district?: string;
  assignedMandal?: string;
  points?: number;
  badges?: string[];
  warningLevel?: number;
  lastWarningDate?: any;
  inProbation?: boolean;
  lastPostTimestamp?: any;
  totalNewsCount?: number;
  exemptFromInactivity?: boolean;
  reporterActivity?: ReporterActivityStats;
  // Hyper-local weather alert fields (optional, set by Android when GPS is available)
  weatherLat?: number;      // User's precise GPS latitude
  weatherLon?: number;      // User's precise GPS longitude
  weatherGridKey?: string;  // FCM topic key e.g. "weather_grid_144_799" (0.1° ≈ 10km cell)
}

export type ReporterInactivityStage =
  | 'ACTIVE'
  | 'REMINDED_3D'
  | 'REMINDED_7D'
  | 'ADMIN_ALERTED_10D'
  | 'EXEMPT';

export type ReporterReminderStage = 'DAY_3' | 'DAY_7';

export interface ReporterActivityStats {
  totalApprovedPosts: number;
  lastApprovedPostAt: number | null;
  dailyCounts: Record<string, number>;
  inactivityStage: ReporterInactivityStage;
  lastReminderSentAt: number | null;
  lastReminderStage: ReporterReminderStage | null;
  lastAdminAlertAt: number | null;
  lastSyncedAt: number | null;
}

export interface ReporterTrackingConfig {
  enabled: boolean;
  firstReminderDays: number;
  secondReminderDays: number;
  adminAlertDays: number;
  adminAlertRepeatDays: number;
  day3Title: string;
  day3Body: string;
  day7Title: string;
  day7Body: string;
  updatedAt?: number;
  updatedBy?: string;
}

export interface ReporterReminderLog {
  id?: string;
  reporterId: string;
  reporterName: string;
  district: string;
  mandal: string;
  stage: 'DAY_3' | 'DAY_7' | 'DAY_10_ADMIN';
  daysInactive: number;
  channel: 'PUSH' | 'ADMIN_ALERT';
  tokensTargeted: number;
  sentCount: number;
  status: 'SENT' | 'NO_TOKENS' | 'FAILED';
  timestamp: number;
}

export enum PostFormat {
  VERTICAL = '9:16',
  HORIZONTAL = '16:9',
}

export interface LocalizedTextMap {
  telugu?: string;
  english?: string;
  local?: string;
  hi?: string;
  pa?: string;
  gu?: string;
}

export interface NewsPost {
  id: string;
  headline: {
    telugu: string;
    english: string;
    local?: string;
    hi?: string;
    pa?: string;
    gu?: string;
  };
  content: {
    telugu: string;
    english: string;
    local?: string;
    hi?: string;
    pa?: string;
    gu?: string;
  };
  fullStory?: {
    telugu: string;
    english: string;
    local?: string;
    hi?: string;
    pa?: string;
    gu?: string;
  };
  mediaUrl: string;
  mediaType: 'image' | 'video';
  mediaUrls?: string[];
  mediaTypes?: ('image' | 'video')[];
  postFormat: PostFormat;
  reporter: {
    id: string;
    name: string;
  };
  location: string;
  state?: string;
  stateCode?: string;
  district?: string;
  constituency?: string;
  mandal?: string;
  language?: string;
  timestamp: any; // Allow serverTimestamp
  category: string;
  likes: number;
  comments: number;
  shares: number;
  originalUrl?: string; // To check for duplicates
  affiliateUrl?: string; // New field for ecommerce products
  productPrice?: string; // Optional price information
  notificationTitle?: string; // High-engagement curiosity hook title for push notifications
  isCitizen?: boolean;
  isReporter?: boolean;
  isSpecialStory?: boolean;
  qualityScore?: number;
  webOnly?: boolean;
  surveyQuestions?: SurveyQuestion[];
  isMultiPage?: boolean;
  votes?: Record<string, number>;
  realVotesCount?: number;
  fakeVotesBase?: number;
  surveyCreatedAt?: number;
  expiryTimestamp?: number;
  rejectionReason?: string;
  isDuplicate?: boolean;
  error?: string;
}

export interface SurveyOption {
  id: string;
  text: string;
  votes?: number;
  nextQuestionId?: string | null;
}

export interface SurveyQuestion {
  id: string;
  questionText: string;
  options: SurveyOption[];
}

export enum Language {
    TELUGU = 'te',
    HINDI = 'hi',
    PUNJABI = 'pa',
    GUJARATI = 'gu',
    ENGLISH = 'en'
}

export interface SocialFeed {
    id: string;
    url: string;
    platform: 'Twitter' | 'Facebook' | 'Instagram';
    sourceName: string;
    category: string;
}

export interface Comment {
  id: string;
  user: {
    id: string;
    name: string;
    photoUrl?: string;
  };
  text: string;
  timestamp: number;
}

export interface DistrictSocialConfig {
  id: string;
  district: string;
  state: 'TS' | 'AP' | 'UP' | 'PB' | 'UK' | 'GA' | 'MN' | 'HP' | 'GJ';
  enabled: boolean;
  facebook?: {
    enabled: boolean;
    pageId: string;
    pageName?: string;
    pageAccessToken?: string;
  };
  instagram?: {
    enabled: boolean;
    igUserId: string;
    accountName?: string;
    accessToken?: string;
  };
  customHashtags?: string[];
  includeAppDownloadLink?: boolean;
  updatedAt?: any;
  stats?: {
    totalFbPosts?: number;
    totalIgPosts?: number;
    lastPostTime?: any;
    lastFbStatus?: 'SUCCESS' | 'FAILED' | 'IDLE';
    lastIgStatus?: 'SUCCESS' | 'FAILED' | 'IDLE';
    lastError?: string | null;
  };
}

export interface SocialAutoPostSettings {
  globalEnabled: boolean;
  appId?: string;
  appSecret?: string;
  defaultAccessToken?: string;
  defaultAppDownloadLink?: string;
  defaultHashtags?: string[];
  updatedAt?: any;
}


export interface SocialAutoPostLog {
  id: string;
  postId: string;
  headline: string;
  district: string;
  state?: string;
  mediaUrl?: string;
  facebookStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  facebookPostId?: string;
  facebookError?: string;
  instagramStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  instagramMediaId?: string;
  instagramError?: string;
  timestamp: any;
}

export enum VoiceCallType {
  INACTIVITY_FOLLOWUP = 'INACTIVITY_FOLLOWUP',
  EVENT_CAMPAIGN = 'EVENT_CAMPAIGN',
  INBOUND_SUPPORT = 'INBOUND_SUPPORT'
}

export enum VoiceCallStatus {
  QUEUED = 'QUEUED',
  RINGING = 'RINGING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  BUSY = 'BUSY',
  NO_ANSWER = 'NO_ANSWER',
  FAILED = 'FAILED'
}

export interface VoiceCallTurn {
  speaker: 'ai' | 'user';
  text: string;
  timestamp: number;
}

export interface VoiceCallIntent {
  reasonForInactivity?: string;
  promisedSubmissionTime?: string;
  followUpRequired?: boolean;
  followUpTimestamp?: any;
  wantsAdKit?: boolean;
  adLeadContact?: string;
  notes?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface VoiceCallRecord {
  id: string;
  callType: VoiceCallType;
  status: VoiceCallStatus;
  reporterId?: string;
  reporterName?: string;
  phoneNumber: string;
  mandal?: string;
  district?: string;
  campaignId?: string;
  campaignTitle?: string;
  startedAt?: any;
  endedAt?: any;
  durationSeconds?: number;
  turns: VoiceCallTurn[];
  extractedIntent?: VoiceCallIntent;
  audioRecordingUrl?: string;
  createdAt: any;
  updatedAt: any;
}

export interface VoiceCampaign {
  id: string;
  title: string;
  eventType: 'MLA_BIRTHDAY' | 'FESTIVAL' | 'LOCAL_EVENT' | 'CUSTOM';
  targetDistricts?: string[];
  targetMandals?: string[];
  targetConstituencies?: string[];
  eventDate?: string;
  detailsPrompt: string;
  adTariffDetails?: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'PAUSED';
  totalReportersTargeted?: number;
  callsCompleted?: number;
  createdAt: any;
}

