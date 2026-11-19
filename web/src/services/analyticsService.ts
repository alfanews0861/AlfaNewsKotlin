
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

const NON_TOPICAL_CATEGORIES = new Set([
    'జిల్లా వార్త', 'general news', 'general', 'state', 'national', 'జనరల్',
    'తాజా వార్తలు', 'బ్రేకింగ్', 'ముఖ్యాంశాలు', 'వార్తలు', 'news', 'greetings',
    'breaking news', 'latest', 'top news', 'రాష్ట్రం', 'జాతీయం', 'స్థానిక', 'local'
]);

const MAX_SCORE_THRESHOLD = 60;

const isNonTopical = (cat?: string | null): boolean => {
    if (!cat || !cat.trim()) return true;
    return NON_TOPICAL_CATEGORIES.has(cat.trim().toLowerCase());
};

const readJsonRecord = (key: string): Record<string, number> => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

export const getUserCategoryScores = (): Record<string, number> => readJsonRecord(PREF_SCORES_KEY);
export const getUserKeywordScores = (): Record<string, number> => readJsonRecord(PREF_KEYWORDS_KEY);
export const getUserReporterScores = (): Record<string, number> => readJsonRecord(PREF_REPORTERS_KEY);

export const getUserPreferredCategories = (maxCount = 10): string[] => {
    const scores = getUserCategoryScores();
    return Object.entries(scores)
        .filter(([cat, score]) => Number(score) > 0 && !isNonTopical(cat))
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, maxCount)
        .map(([cat]) => cat);
};

/**
 * Calculates the user's preferred category based on local interaction scores.
 * Returns the category with the highest score, provided it meets a minimum threshold.
 */
export const getUserPreferredCategory = (): string | null => {
    try {
        const scores = getUserCategoryScores();
        let maxScore = 0;
        let topCategory: string | null = null;
        
        for (const [cat, score] of Object.entries(scores)) {
            if (!isNonTopical(cat) && score > maxScore) {
                maxScore = score;
                topCategory = cat;
            }
        }
        
        // Only return if score is significant (e.g. > 2 interactions) to avoid noise
        return maxScore > 2 ? topCategory : null;
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
  postData: { id: string; categories: string[]; category?: string; district?: string; keywords?: string[]; tone?: string; reporter?: { id: string; name: string } },
  userId: string | undefined,
  timeSpent?: number,
  metadata?: any
) => {
  try {
    const guestId = getGuestId();
    const finalUserId = userId || 'guest';

    // --- 1. Update Local Preference Scores (Zero Cost) ---
    try {
        const updateLocalScore = (key: string, items: string[], points: number) => {
            if (!items || items.length === 0) return;
            const scores = readJsonRecord(key);
            let maxVal = 0;
            for (const item of items) {
                if (!item || !item.trim()) continue;
                const next = Math.max(-20, (scores[item] || 0) + points);
                scores[item] = next;
                if (next > maxVal) maxVal = next;
            }
            // Normalize scores (halve when max >= 60, matching Android) so fresh interests stay agile
            if (maxVal >= MAX_SCORE_THRESHOLD) {
                for (const k of Object.keys(scores)) {
                    const scaled = Math.trunc(scores[k] / 2);
                    if (scaled === 0) delete scores[k];
                    else scores[k] = scaled;
                }
            }
            localStorage.setItem(key, JSON.stringify(scores));
        };

        let points = 0;
        if (eventType === AnalyticsEventType.VIEW && (timeSpent && timeSpent > 4)) points = 1; 
        if (eventType === AnalyticsEventType.ENGAGED_VIEW) points = 2;
        if (eventType === AnalyticsEventType.LIKE) points = 3;
        if (eventType === AnalyticsEventType.SHARE) points = 5;
        if (eventType === AnalyticsEventType.CLICK) points = 2;
        if (eventType === AnalyticsEventType.SCROLL_DEPTH) points = 1;
        if (eventType === AnalyticsEventType.SKIP) points = -2;
        
        if (points !== 0) {
            const rawCats = [
                ...(postData.categories || []),
                ...(postData.category ? [postData.category] : []),
            ];
            const cleanCats = Array.from(new Set(rawCats.map(c => c?.trim()).filter(c => c && !isNonTopical(c)) as string[]));
            if (cleanCats.length > 0) {
                updateLocalScore(PREF_SCORES_KEY, cleanCats, points);
            }
            if (postData.keywords && postData.keywords.length > 0) {
                updateLocalScore(PREF_KEYWORDS_KEY, postData.keywords, points);
            }
            if (postData.tone) updateLocalScore(PREF_TONES_KEY, [postData.tone], points);
            if (postData.reporter?.id) updateLocalScore(PREF_REPORTERS_KEY, [postData.reporter.id], points);
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
