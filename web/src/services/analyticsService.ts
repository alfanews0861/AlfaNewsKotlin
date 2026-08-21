
import { db } from './firebase';
import * as _firestore from 'firebase/firestore';
import { AnalyticsEventType } from '../types';

const { collection, addDoc, serverTimestamp } = _firestore as any;

const PREF_SCORES_KEY = 'alfa_user_scores';
const PREF_KEYWORDS_KEY = 'alfa_user_keywords';
const PREF_TONES_KEY = 'alfa_user_tones';
const PREF_REPORTERS_KEY = 'alfa_user_reporters';
const SEARCH_HISTORY_KEY = 'alfa_search_history';

/**
 * Generates or retrieves a persistent Guest ID from local storage.
 * This allows us to track non-logged-in users across sessions.
 */
export const getGuestId = (): string => {
  let guestId = localStorage.getItem('alfa_guest_id');
  if (!guestId) {
    guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('alfa_guest_id', guestId);
  }
  return guestId;
};

/**
 * Calculates the user's preferred category based on local interaction scores.
 * Returns the category with the highest score, provided it meets a minimum threshold.
 */
export const getUserPreferredCategory = (): string | null => {
    try {
        const currentScoresStr = localStorage.getItem(PREF_SCORES_KEY);
        if (!currentScoresStr) return null;
        
        const scores: Record<string, number> = JSON.parse(currentScoresStr);
        let maxScore = 0;
        let topCategory = null;
        
        for (const [cat, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                topCategory = cat;
            }
        }
        
        // Only return if score is significant (e.g. > 3 interactions) to avoid noise
        return maxScore > 3 ? topCategory : null;
    } catch (e) {
        console.error("Error getting preferred category:", e);
        return null;
    }
};

/**
 * Logs a user interaction event to Firestore and updates local preference scores.
 */
export const logAnalyticsEvent = async (
  eventType: AnalyticsEventType,
  postData: { id: string; categories: string[]; district?: string; keywords?: string[]; tone?: string; reporter?: { id: string; name: string } },
  userId: string | undefined,
  timeSpent?: number,
  metadata?: any
) => {
  try {
    const guestId = getGuestId();
    const finalUserId = userId || 'guest';

    // --- 1. Update Local Preference Scores (Zero Cost) ---
    try {
        const updateLocalScore = (key: string, item: string, points: number) => {
            if (!item) return;
            const current = localStorage.getItem(key);
            const scores = current ? JSON.parse(current) : {};
            scores[item] = (scores[item] || 0) + points;
            localStorage.setItem(key, JSON.stringify(scores));
        };

        let points = 0;
        if (eventType === AnalyticsEventType.VIEW && (timeSpent && timeSpent > 5)) points = 1; 
        if (eventType === AnalyticsEventType.ENGAGED_VIEW) points = 2;
        if (eventType === AnalyticsEventType.LIKE) points = 3;
        if (eventType === AnalyticsEventType.SHARE) points = 5;
        if (eventType === AnalyticsEventType.CLICK) points = 2;
        if (eventType === AnalyticsEventType.SCROLL_DEPTH) points = 1;
        if (eventType === AnalyticsEventType.SKIP) points = -3;
        
        if (points !== 0) {
            const cat = postData.categories?.[0] || 'General';
            updateLocalScore(PREF_SCORES_KEY, cat, points);
            postData.keywords?.forEach(kw => updateLocalScore(PREF_KEYWORDS_KEY, kw, points));
            if (postData.tone) updateLocalScore(PREF_TONES_KEY, postData.tone, points);
            if (postData.reporter?.id) updateLocalScore(PREF_REPORTERS_KEY, postData.reporter.id, points);
        }

        if (eventType === AnalyticsEventType.SEARCH && metadata?.query) {
            const history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
            const newHistory = [metadata.query, ...history.filter((q: string) => q !== metadata.query)].slice(0, 20);
            localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
        }
    } catch (e) {
        console.error("Local pref update failed", e);
    }

    // --- 2. Log to Firestore ---
    addDoc(collection(db, 'user_analytics'), {
      userId: finalUserId,
      guestId,
      postId: postData.id,
      categories: postData.categories || [],
      keywords: postData.keywords || [],
      tone: postData.tone || '',
      reporterId: postData.reporter?.id || '',
      district: postData.district || 'General',
      eventType,
      timeSpent: timeSpent || 0,
      metadata: metadata || {},
      timestamp: serverTimestamp(),
    }).catch(console.warn);

  } catch (error) {
    console.error("Error logging analytics:", error);
  }
};
