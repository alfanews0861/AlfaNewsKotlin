
import { db } from './firebase';
import * as _firestore from 'firebase/firestore';
import { AnalyticsEventType } from '../types';

const { collection, addDoc, serverTimestamp } = _firestore as any;

const PREF_SCORES_KEY = 'alfa_user_scores';

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
// FIX: Added missing getUserPreferredCategory export used by NewsFeed.tsx for personalized feed ordering.
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
  postData: { id: string; category: string; district?: string },
  userId: string | undefined,
  timeSpent?: number
) => {
  try {
    const guestId = getGuestId();
    const finalUserId = userId || 'guest';

    // --- 1. Update Local Preference Scores (Zero Cost) ---
    // FIX: Added scoring logic to track user interests locally for the recommendation engine.
    try {
        const currentScoresStr = localStorage.getItem(PREF_SCORES_KEY);
        const scores = currentScoresStr ? JSON.parse(currentScoresStr) : {};
        const cat = postData.category || 'General';
        
        // Scoring Logic based on engagement type
        let points = 0;
        if (eventType === AnalyticsEventType.VIEW && (timeSpent && timeSpent > 5)) points = 1; // Only count significant views
        if (eventType === AnalyticsEventType.ENGAGED_VIEW) points = 2;
        if (eventType === AnalyticsEventType.LIKE) points = 3;
        if (eventType === AnalyticsEventType.SHARE) points = 5;
        if (eventType === AnalyticsEventType.CLICK) points = 2;
        
        if (points > 0) {
            scores[cat] = (scores[cat] || 0) + points;
            localStorage.setItem(PREF_SCORES_KEY, JSON.stringify(scores));
        }
    } catch (e) {
        console.error("Local pref update failed", e);
    }

    // --- 2. Log to Firestore ---
    addDoc(collection(db, 'user_analytics'), {
      userId: finalUserId,
      guestId,
      postId: postData.id,
      category: postData.category,
      district: postData.district || 'General',
      eventType,
      timeSpent: timeSpent || 0,
      timestamp: serverTimestamp(),
    }).catch(console.warn);

  } catch (error) {
    console.error("Error logging analytics:", error);
  }
};
