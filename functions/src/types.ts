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
