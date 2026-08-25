
export enum UserRole {
  GUEST = 'GUEST',
  SUBSCRIBER = 'SUBSCRIBER',
  REPORTER = 'REPORTER',
  STAFF_REPORTER = 'STAFF_REPORTER',
  REGIONAL_INCHARGE = 'REGIONAL_INCHARGE',
  ADMIN = 'ADMIN',
}

export interface UserInterest {
  [key: string]: number; // key is category/keyword, value is weight
}

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  photoUrl?: string;
  role: UserRole;
  address?: string;
  constituency?: string;
  promotedBy?: string;
  signatureUrl?: string;
  idCardUrl?: string;
  state?: string;
  district?: string;
  pushEnabled?: boolean;
  fcmTokens?: string[];
  lastTokenUpdate?: number;
  preferredCategories?: string[];
  interests?: UserInterest;
  createdAt?: number;
  lastLogin?: number;
  totalNewsCount?: number;
  todayNewsCount?: number;
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
  mediaUrl: string;
  mediaType: 'image' | 'video';
  postFormat: PostFormat;
  reporter: {
    id: string;
    name: string;
  };
  location: string;
  state?: string;
  district?: string;
  timestamp: number;
  categories: string[];
  likes: number;
  comments: number;
  shares: number;
  originalUrl?: string;
  tags?: string[];
  keywords?: string[];
  entities?: {
    people: string[];
    organizations: string[];
    locations: string[];
  };
  category?: string;
  youtubeUrl?: string;
  tone?: string;
  type?: string;
  approved?: boolean;
  status?: string;
  isGlobal?: boolean;
  surveyQuestions?: SurveyQuestion[];
  votes?: Record<string, number>;
  realVotesCount?: number;
  fakeVotesBase?: number;
  surveyCreatedAt?: number;
}

export interface SurveyOption {
  id: string;
  text: string;
  votes?: number;
}

export interface SurveyQuestion {
  id: string;
  questionText: string;
  options: SurveyOption[];
}

export enum Language {
    TELUGU = 'te',
    ENGLISH = 'en'
}

export interface Comment {
  id: string;
  user: {
    id?: string;
    name: string;
    photoUrl?: string;
  };
  text: string;
  timestamp: number;
}

export interface ClassifiedAd {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  price: number;
  category: string;
  location: string;
  imageUrl: string;
  contactPhone: string;
  whatsappNumber?: string;
  timestamp: number;
}

export const ClassifiedCategories = [
  'స్థిరాస్తి (Real Estate)',
  'వాహనాలు (Vehicles)',
  'ఎలక్ట్రానిక్స్ (Electronics)',
  'ఉద్యోగాలు (Jobs)',
  'సేవలు (Services)',
  'ఫర్నిచర్ (Furniture)',
  'ఇతర (Others)'
];

export const TS_DISTRICTS = [
    'ఆదిలాబాద్', 'భద్రాద్రి కొత్తగూడెం', 'హన్మకొండ', 'హైదరాబాద్', 'జగిత్యాల', 'జనగాం', 'జయశంకర్ భూపాలపల్లి', 
    'జోగులాంబ గద్వాల', 'కామారెడ్డి', 'కరీంనగర్', 'ఖమ్మం', 'కుమ్రం భీమ్ ఆసిఫాబాద్', 'మహబూబాబాద్', 'మహబూబ్ నగర్', 
    'మంచిర్యాల', 'మెదక్', 'మేడ్చల్ మల్కాజిగిరి', 'ములుగు', 'నాగర్ కర్నూల్', 'నల్గొండ', 'నారాయణపేట', 'నిర్మల్', 
    'నిజామాబాద్', 'పెద్దపల్లి', 'రాజన్న సిరిసిల్ల', 'రంగారెడ్డి', 'సంగారెడ్డి', 'సిద్దిపేట', 'సూర్యాపేట', 
    'వికారాబాద్', 'వనపర్తి', 'వరంగల్', 'యాదాద్రి భువనగిరి'
];

export const AP_DISTRICTS = [
    'అల్లూరి సీతారామరాజు', 'అనకాపల్లి', 'అనంతపురం', 'అన్నమయ్య', 'బాపట్ల', 'చిత్తూరు', 'కోనసీమ', 
    'తూర్పు గోదావరి', 'ఏలూరు', 'గుంటూరు', 'కాకినాడ', 'కృష్ణా', 'కర్నూలు', 'నందయాల', 'ఎన్టీఆర్', 
    'పల్నాడు', 'పార్వతీపురం మన్యం', 'ప్రకాశం', 'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు', 'శ్రీ సత్యసాయి', 
    'శ్రీకాకుళం', 'తిరుపతి', 'విశాఖపట్నం', 'విజయనగరం', 'పశ్చిమ గోదావరి', 'వైఎస్ఆర్ కడప'
];

export enum AnalyticsEventType {
  VIEW = 'view',
  ENGAGED_VIEW = 'engaged_view',
  LIKE = 'like',
  SHARE = 'share',
  COMMENT = 'comment',
  CLICK = 'click',
  SCROLL_DEPTH = 'scroll_depth',
  SEARCH = 'search',
  SKIP = 'skip',
  REPORTER_FOLLOW = 'reporter_follow'
}

export interface ScrapingSource {
    id: string;
    url: string;
    siteName: string;
    category: string;
    state?: string;
    district?: string;
    group?: number;
    lastStatus?: 'active' | 'error';
    lastFetchTime?: any;
    lastError?: string;
    lastProcessedCount?: number;
    lastFailedCount?: number;
    processed24h?: number;
    failed24h?: number;
    todayProcessedCount?: number;
    totalProcessedCount?: number;
    totalFailedCount?: number;
    isPaused?: boolean;
}

export interface ReporterConversation {
    id: string;
    reporterId: string;
    reporterName: string;
    reporterDistrict?: string;
    reporterPhone?: string;
    reporterPhotoUrl?: string;
    lastMessage: string;
    lastMessageTime: number;
    lastSenderRole: string;
    unreadCountForAdmin: number;
    unreadCountForReporter: number;
    updatedAt: number;
}

export interface ReporterMessage {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    text: string;
    imageUrl?: string;
    timestamp: number;
    read: boolean;
}

export interface AffiliateConfig {
    amazonAccessKey: string;
    amazonSecretKey: string;
    amazonAssociateTag: string;
    flipkartId: string;
    flipkartToken: string;
    updatedAt?: any;
}

export interface AppConfigData {
    min_version_code?: number;
    authorized_signature?: string;
    maintenance_mode?: boolean;
    announcement_text?: string;
}

export enum AdStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED'
}

export interface LocalAd {
  id: string;
  userId: string;
  userName: string;
  bannerUrl: string;
  targetState: string;
  targetDistrict: string;
  viewsOrdered: number;
  viewsCurrent: number;
  costPerView: number;
  totalAmount: number;
  status: AdStatus;
  createdAt: number;
  approvedAt?: number;
}

export enum NotificationType {
    SYSTEM = 'SYSTEM',
    NEWS = 'NEWS',
    ENGAGEMENT = 'ENGAGEMENT',
    PROMOTION = 'PROMOTION'
}

export interface AppNotification {
    id: string;
    title: string;
    body: string;
    type: NotificationType;
    timestamp: number;
    read: boolean;
    actionUrl?: string;
    imageUrl?: string;
}

export interface RssFeed {
    id: string;
    url: string;
    category: string;
    state?: string;
    district?: string;
    lastStatus?: 'active' | 'error';
    lastFetchTime?: any;
    lastError?: string;
    lastProcessedCount?: number;
    lastFailedCount?: number;
    totalProcessedCount?: number;
    totalFailedCount?: number;
    todayProcessedCount?: number;
    isPaused?: boolean;
}

export interface SocialFeed {
    id: string;
    url: string;
    platform: 'Twitter' | 'Facebook' | 'Instagram';
    sourceName: string;
    category: string;
    state?: string;
    district?: string;
    lastStatus?: 'active' | 'error';
    lastFetchTime?: any;
    lastError?: string;
    lastProcessedCount?: number;
    lastFailedCount?: number;
    totalProcessedCount?: number;
    totalFailedCount?: number;
    todayProcessedCount?: number;
    isPaused?: boolean;
}

export interface FacebookFeed {
    id: string;
    url: string;
    sourceName: string;
    category: string;
    state?: string;
    district?: string;
    mandal?: string;
    lastStatus?: 'active' | 'error';
    lastFetchTime?: any;
    lastError?: string;
    lastProcessedCount?: number;
    lastFailedCount?: number;
    todayProcessedCount?: number;
    totalProcessedCount?: number;
    totalFailedCount?: number;
    isPaused?: boolean;
}

export interface UserAnalyticsEvent {
    userId: string;
    guestId: string;
    postId: string;
    category: string;
    district: string;
    eventType: AnalyticsEventType;
    timeSpent: number;
    timestamp: any;
}
