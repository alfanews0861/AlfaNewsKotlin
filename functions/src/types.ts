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
  district?: string;
  assignedMandal?: string;
  points?: number;
  badges?: string[];
  warningLevel?: number;
  lastWarningDate?: any;
  inProbation?: boolean;
  lastPostTimestamp?: any;
  // Hyper-local weather alert fields (optional, set by Android when GPS is available)
  weatherLat?: number;      // User's precise GPS latitude
  weatherLon?: number;      // User's precise GPS longitude
  weatherGridKey?: string;  // FCM topic key e.g. "weather_grid_144_799" (0.1° ≈ 10km cell)
}

export enum PostFormat {
  VERTICAL = '9:16',
  HORIZONTAL = '16:9',
}

export interface NewsPost {
  id: string;
  headline: {
    telugu: string;
    english: string;
  };
  content: {
    telugu: string;
    english: string;
  };
  fullStory?: {
    telugu: string;
    english: string;
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
  webOnly?: boolean;
}

export enum Language {
    TELUGU = 'te',
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
  state: 'TS' | 'AP';
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

