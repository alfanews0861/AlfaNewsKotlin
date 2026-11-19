import type { NewsPost, User } from '../types.ts';
import {
  AP_DISTRICTS,
  DISTRICT_ALIASES,
  TS_DISTRICTS,
  getDistrictAliases,
  isDistrictMatch,
} from './newsFilter.ts';

// ⚡ Precomputed O(1) lookup sets (eliminates O(59*60) nested district alias scans per post!)
const SPECIFIC_DISTRICT_SET = new Set<string>();
const AP_DISTRICT_SET = new Set<string>();
const TS_DISTRICT_SET = new Set<string>();
for (const d of AP_DISTRICTS) {
  const low = d.trim().toLowerCase();
  SPECIFIC_DISTRICT_SET.add(low);
  AP_DISTRICT_SET.add(low);
}
for (const d of TS_DISTRICTS) {
  const low = d.trim().toLowerCase();
  SPECIFIC_DISTRICT_SET.add(low);
  TS_DISTRICT_SET.add(low);
}
for (const [k, aliases] of Object.entries(DISTRICT_ALIASES)) {
  const kLow = k.trim().toLowerCase();
  SPECIFIC_DISTRICT_SET.add(kLow);
  const isAp = AP_DISTRICT_SET.has(kLow);
  const isTs = TS_DISTRICT_SET.has(kLow);
  for (const a of aliases) {
    const aLow = a.trim().toLowerCase();
    SPECIFIC_DISTRICT_SET.add(aLow);
    if (isAp) AP_DISTRICT_SET.add(aLow);
    if (isTs) TS_DISTRICT_SET.add(aLow);
  }
}

/**
 * 🎯 Unified Home NewsFeed Blending Engine (Mobile Web)
 *
 * Mirrors Android's NewsFeedBlender:
 * - Fast Path 3 anchor posts at [0, 1, 2] with zero jump
 * - True disjoint 40% User Interest / 30% Local District / 30% Diverse Fresh & Discovery cadence
 * - Bilingual Telugu/English category normalization & Firestore query expansion
 * - Sliding-window anti-clustering & anti-ping-pong category diversity (< 1ms CPU)
 */

export interface InterestProfile {
  canonicalCategoryScores: Record<string, number>;
  preferredCanonicalKeys: string[];
  totalPositiveSignal: number;
  hasEstablishedInterests: boolean;
  explicitCanonicalKeys: Set<string>;
  keywordScores: Record<string, number>;
  reporterScores: Record<string, number>;
}

const CANONICAL_FIRESTORE_ALIASES: Record<string, string[]> = {
  politics: ['రాజకీయం', 'రాజకీయాలు', 'Politics'],
  cinema: ['సినిమా', 'వినోదం', 'Cinema'],
  sports: ['క్రీడలు', 'స్పోర్ట్స్', 'Sports'],
  crime: ['క్రైమ్', 'నేరాలు', 'Crime'],
  business: ['వ్యాపారం', 'Business'],
  technology: ['టెక్నాలజీ', 'Technology'],
  health: ['ఆరోగ్యం', 'Health'],
  education: ['విద్య/ఉద్యోగాలు', 'విద్య', 'Education'],
  devotional: ['భక్తి', 'Devotional'],
  agriculture: ['వ్యవసాయం', 'Agriculture'],
  national: ['జాతీయం', 'National'],
  international: ['అంతర్జాతీయం', 'International'],
  lifestyle: ['లైఫ్ స్టైల్', 'జీవనశైలి', 'Lifestyle'],
};

const NON_TOPICAL_CANONICAL = new Set([
  'general',
  'local_district',
  'special',
  'greeting',
  'history',
  'cartoon',
  'survey',
  'weather',
]);

type PoolType = 'INTEREST' | 'LOCAL' | 'DISCOVERY';

// Exact 10-slot 40/30/30 cadence: 4 Interest (40%), 3 Local (30%), 3 Fresh/Discovery (30%)
const CADENCE_40_30_30: PoolType[] = [
  'INTEREST',
  'LOCAL',
  'INTEREST',
  'DISCOVERY',
  'LOCAL',
  'INTEREST',
  'DISCOVERY',
  'INTEREST',
  'LOCAL',
  'DISCOVERY',
];

export function normalizeCategoryKey(raw?: string | null): string {
  if (!raw || !raw.trim()) return 'general';
  const s = raw.trim().toLowerCase();
  if (s.includes('క్రీడలు') || s.includes('స్పోర్ట్స్') || s.includes('sports') || s.includes('cricket') || s.includes('క్రికెట్') || s.includes('ipl')) {
    return 'sports';
  }
  if (
    s.includes('సినిమా') ||
    s.includes('వినోదం') ||
    s.includes('cinema') ||
    s.includes('entertainment') ||
    s.includes('movies') ||
    s.includes('ఓటీటీ') ||
    s.includes('ott') ||
    s.includes('చిత్రసీమ') ||
    s.includes('టాలీవుడ్') ||
    s.includes('tollywood')
  ) {
    return 'cinema';
  }
  if (s.includes('రాజకీయం') || s.includes('రాజకీయాలు') || s.includes('రాజకీయ') || s.includes('politics') || s.includes('political')) {
    return 'politics';
  }
  if (s.includes('క్రైమ్') || s.includes('నేరాలు') || s.includes('crime') || s.includes('పోలీస్') || s.includes('police')) {
    return 'crime';
  }
  if (s.includes('వ్యాపారం') || s.includes('బిజినెస్') || s.includes('business') || s.includes('మార్కెట్') || s.includes('బంగారం')) {
    return 'business';
  }
  if (s.includes('టెక్నాలజీ') || s.includes('technology') || s.includes('tech')) {
    return 'technology';
  }
  if (s.includes('ఆరోగ్యం') || s.includes('health')) {
    return 'health';
  }
  if (s.includes('విద్య') || s.includes('education') || s.includes('ఉద్యోగాలు') || s.includes('jobs')) {
    return 'education';
  }
  if (s.includes('భక్తి') || s.includes('ఆధ్యాత్మికం') || s.includes('devotional')) {
    return 'devotional';
  }
  if (s.includes('వ్యవసాయం') || s.includes('agriculture')) {
    return 'agriculture';
  }
  if (s.includes('అంతర్జాతీయం') || s.includes('international') || s.includes('ప్రపంచం') || s.includes('world')) {
    return 'international';
  }
  if (s.includes('జాతీయం') || s.includes('national') || s.includes('భారతదేశం')) {
    return 'national';
  }
  if (s.includes('జీవనశైలి') || s.includes('లైఫ్‌స్టైల్') || s.includes('లైఫ్ స్టైల్') || s.includes('lifestyle')) {
    return 'lifestyle';
  }
  if (s.includes('జిల్లా') || s.includes('స్థానిక') || s.includes('local')) {
    return 'local_district';
  }
  if (
    s === 'general' ||
    s === 'general news' ||
    s === 'జనరల్' ||
    s === 'state' ||
    s === 'రాష్ట్రం' ||
    s === 'తాజా వార్తలు' ||
    s === 'బ్రేకింగ్' ||
    s === 'ముఖ్యాంశాలు' ||
    s === 'news' ||
    s === 'greetings'
  ) {
    return 'general';
  }
  return s;
}

export function isSpecificDistrict(district?: string | null): boolean {
  if (!district || !district.trim()) return false;
  return SPECIFIC_DISTRICT_SET.has(district.trim().toLowerCase());
}

export function mapDistrictToState(districtOrState?: string | null): 'Telangana' | 'Andhra Pradesh' | null {
  if (!districtOrState || !districtOrState.trim()) return null;
  const clean = districtOrState.trim().toLowerCase();
  if (
    clean === 'telangana' ||
    clean === 'ts' ||
    clean === 'tg' ||
    clean === 'తెలంగాణ' ||
    clean === 'telangana state' ||
    TS_DISTRICT_SET.has(clean)
  ) {
    return 'Telangana';
  }
  if (
    clean === 'andhra pradesh' ||
    clean === 'andhrapradesh' ||
    clean === 'ap' ||
    clean === 'ఆంధ్రప్రదేశ్' ||
    clean === 'andhra' ||
    clean === 'ఆంధ్ర' ||
    AP_DISTRICT_SET.has(clean)
  ) {
    return 'Andhra Pradesh';
  }
  return null;
}

/**
 * Strict Home Feed eligibility filter (matches Android's isPostAllowedForHomeFeed):
 * - Allows universal/general categories & user's own state/district.
 * - Rejects OTHER districts' local news & strict OTHER state news.
 */
export function isPostAllowedForHomeFeed(post: NewsPost, userDistrict?: string | null): boolean {
  const userState = mapDistrictToState(userDistrict);

  // 1. State check
  if (userState) {
    const postState = mapDistrictToState(post.state) || mapDistrictToState(post.district);
    if (postState && postState !== userState && !post.isGlobal) {
      const otherStateAliases =
        userState === 'Telangana'
          ? ['andhra pradesh', 'andhrapradesh', 'ap', 'ఆంధ్రప్రదేశ్']
          : ['telangana', 'ts', 'tg', 'తెలంగాణ'];
      const dLow = (post.district || '').trim().toLowerCase();
      const sLow = (post.state || '').trim().toLowerCase();
      if (otherStateAliases.includes(dLow) || otherStateAliases.includes(sLow)) {
        return false;
      }
    }
  }

  // 2. Special posts
  if (post.type === 'greeting' || post.type === 'history' || post.type === 'cartoon') {
    return true;
  }

  // 3. District check
  const postDist = post.district?.trim();
  const hasLocalCategory =
    post.category?.trim() === 'జిల్లా వార్త' ||
    post.category?.trim() === 'స్థానిక' ||
    (post.categories || []).some((c) => {
      const t = c.trim();
      return t === 'జిల్లా వార్త' || t.toLowerCase() === 'local' || t === 'స్థానిక';
    });

  const postHasSpecificDist = Boolean(postDist && isSpecificDistrict(postDist));

  if (hasLocalCategory || postHasSpecificDist) {
    if (!userDistrict) {
      return false;
    }
    const aliases = getDistrictAliases(userDistrict);
    const matchesDist =
      (postDist ? isDistrictMatch(postDist, userDistrict) : false) ||
      (post.categories || []).some((cat) =>
        isDistrictMatch(cat, userDistrict) || aliases.some((a) => a.toLowerCase() === cat.trim().toLowerCase())
      );
    return matchesDist;
  }

  return true;
}

export function isLocalDistrictPost(post: NewsPost, userDistrict?: string | null): boolean {
  const postDist = post.district?.trim();
  const hasLocalCategory =
    post.category?.trim() === 'జిల్లా వార్త' ||
    post.category?.trim() === 'స్థానిక' ||
    (post.categories || []).some((c) => {
      const t = c.trim();
      return t === 'జిల్లా వార్త' || t.toLowerCase() === 'local' || t === 'స్థానిక';
    });
  if (hasLocalCategory) return true;

  if (postDist && isSpecificDistrict(postDist)) {
    if (!userDistrict) return true;
    if (isDistrictMatch(postDist, userDistrict)) return true;
  }

  if (userDistrict) {
    if ((post.categories || []).some((cat) => isDistrictMatch(cat, userDistrict))) {
      return true;
    }
  }
  return false;
}

export function extractCanonicalTopics(post: NewsPost): string[] {
  const topics = new Set<string>();
  for (const cat of post.categories || []) {
    const key = normalizeCategoryKey(cat);
    if (!NON_TOPICAL_CANONICAL.has(key)) topics.add(key);
  }
  if (post.category) {
    const key = normalizeCategoryKey(post.category);
    if (!NON_TOPICAL_CANONICAL.has(key)) topics.add(key);
  }
  for (const tag of post.tags || []) {
    const key = normalizeCategoryKey(tag);
    if (!NON_TOPICAL_CANONICAL.has(key) && CANONICAL_FIRESTORE_ALIASES[key]) {
      topics.add(key);
    }
  }
  return Array.from(topics);
}

export function getPostCategoryTag(post: NewsPost, userDistrict?: string | null): string {
  if (
    post.type === 'greeting' ||
    post.type === 'history' ||
    post.type === 'cartoon' ||
    post.type === 'survey' ||
    post.type === 'weather'
  ) {
    return post.type;
  }
  if (isLocalDistrictPost(post, userDistrict)) {
    return 'local_district';
  }
  const topics = extractCanonicalTopics(post);
  if (topics.length > 0) return topics[0];
  const fallback = (post.categories || []).find((c) => c && c.trim()) || post.category;
  return normalizeCategoryKey(fallback);
}

export function expandCategoriesForFirestoreQuery(rawPreferred: string[], maxLimit = 10): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawPreferred) {
    if (result.length >= maxLimit) break;
    const canonical = normalizeCategoryKey(raw);
    if (NON_TOPICAL_CANONICAL.has(canonical)) continue;
    const aliases = CANONICAL_FIRESTORE_ALIASES[canonical];
    if (aliases) {
      for (const alias of aliases) {
        if (result.length >= maxLimit) break;
        if (!seen.has(alias)) {
          seen.add(alias);
          result.push(alias);
        }
      }
    } else if (raw.trim() && !seen.has(raw.trim())) {
      seen.add(raw.trim());
      result.push(raw.trim());
    }
  }
  return result.slice(0, maxLimit);
}

/**
 * Merges ALL user interest sources (explicit prefs, logged-in Firestore categoryScores/interests,
 * and local guest interaction scores) into a single canonical InterestProfile.
 */
export function buildInterestProfile(params: {
  explicitCategories?: string[] | null;
  localCategoryScores?: Record<string, number> | null;
  userCategoryScores?: Record<string, number> | null;
  userInterests?: Record<string, number> | null;
  keywordScores?: Record<string, number> | null;
  reporterScores?: Record<string, number> | null;
}): InterestProfile {
  const canonical: Record<string, number> = {};
  const explicitCanonical = new Set<string>();
  const keywordScores: Record<string, number> = {};
  const reporterScores: Record<string, number> = {};

  const addCatScore = (rawKey: string, value: number) => {
    if (!Number.isFinite(value) || value === 0) return;
    const key = normalizeCategoryKey(rawKey);
    if (NON_TOPICAL_CANONICAL.has(key)) return;
    canonical[key] = (canonical[key] || 0) + value;
  };

  // 1. Explicit user-selected preferences (strongest signal!)
  for (const cat of params.explicitCategories || []) {
    const key = normalizeCategoryKey(cat);
    if (!NON_TOPICAL_CANONICAL.has(key)) {
      explicitCanonical.add(key);
      canonical[key] = (canonical[key] || 0) + 12;
    }
  }

  // 2. Local interaction scores (works for BOTH guests & logged-in users!)
  if (params.localCategoryScores) {
    for (const [k, v] of Object.entries(params.localCategoryScores)) {
      addCatScore(k, Number(v) || 0);
    }
  }

  // 3. Firestore categoryScores (Android/Web synced)
  if (params.userCategoryScores) {
    for (const [k, v] of Object.entries(params.userCategoryScores)) {
      const key = normalizeCategoryKey(k);
      if (!NON_TOPICAL_CANONICAL.has(key)) {
        const val = Number(v) || 0;
        canonical[key] = Math.max(canonical[key] || 0, val) + (explicitCanonical.has(key) ? 12 : 0);
      }
    }
  }

  // 4. Firestore user.interests (scaled up from 0.1 increments to meaningful weight)
  if (params.userInterests) {
    for (const [k, v] of Object.entries(params.userInterests)) {
      const num = Number(v) || 0;
      if (num === 0) continue;
      const key = normalizeCategoryKey(k);
      if (CANONICAL_FIRESTORE_ALIASES[key]) {
        canonical[key] = (canonical[key] || 0) + num * 10;
      } else {
        keywordScores[k.toLowerCase()] = (keywordScores[k.toLowerCase()] || 0) + num * 10;
      }
    }
  }

  if (params.keywordScores) {
    for (const [k, v] of Object.entries(params.keywordScores)) {
      keywordScores[k.toLowerCase()] = (keywordScores[k.toLowerCase()] || 0) + (Number(v) || 0);
    }
  }

  if (params.reporterScores) {
    for (const [k, v] of Object.entries(params.reporterScores)) {
      reporterScores[k] = (reporterScores[k] || 0) + (Number(v) || 0);
    }
  }

  const preferredCanonicalKeys = Object.entries(canonical)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  const totalPositiveSignal = Object.values(canonical)
    .filter((v) => v > 0)
    .reduce((sum, v) => sum + v, 0);

  return {
    canonicalCategoryScores: canonical,
    preferredCanonicalKeys,
    totalPositiveSignal,
    hasEstablishedInterests: totalPositiveSignal >= 4 && preferredCanonicalKeys.length > 0,
    explicitCanonicalKeys: explicitCanonical,
    keywordScores,
    reporterScores,
  };
}

export function calculateUserInterestScore(post: NewsPost, profile: InterestProfile): number {
  let score = 0;
  const topics = extractCanonicalTopics(post);

  for (const topic of topics) {
    const rawCatScore = profile.canonicalCategoryScores[topic] || 0;
    if (rawCatScore > 0) {
      // Diminishing returns curve so strong interests win cleanly without infinite domination
      score += Math.min(45, Math.log1p(rawCatScore) * 14);
    } else if (rawCatScore < 0) {
      score += Math.max(-25, rawCatScore * 3.5);
    }
    if (profile.explicitCanonicalKeys.has(topic)) {
      score += 18;
    }
  }

  const featureTerms = [...(post.tags || []), ...(post.keywords || [])];
  for (const term of featureTerms) {
    const s = profile.keywordScores[String(term).toLowerCase()] || 0;
    if (s !== 0) score += Math.max(-10, Math.min(15, s * 1.5));
  }

  if (post.reporter?.id) {
    const repScore = profile.reporterScores[post.reporter.id] || 0;
    if (repScore !== 0) score += Math.max(-8, Math.min(12, repScore * 1.5));
  }

  return score;
}

export function calculateRelevanceScore(
  post: NewsPost,
  profile: InterestProfile,
  nowMs: number = Date.now()
): number {
  let score = calculateUserInterestScore(post, profile);
  const topics = extractCanonicalTopics(post);

  // Editorial priority: gentle fallback for cold-start users, reduced tie-breaker for active users
  // so real user interests ALWAYS win over fixed Politics/Cinema bonuses!
  if (topics.includes('politics')) {
    score += profile.hasEstablishedInterests ? 6 : 18;
  } else if (topics.includes('cinema')) {
    score += profile.hasEstablishedInterests ? 4 : 12;
  }

  // Engagement & editorial quality
  const engagement =
    Math.log1p(Math.max(0, (post.likes || 0) * 2 + (post.shares || 0) * 3 + (post.comments || 0) * 1.5)) * 4 +
    (post.isSpecialStory ? 18 : 0);
  score += engagement;

  const qVal = Math.max(0, Math.min(10, typeof post.qualityScore === 'number' ? post.qualityScore : 5));
  score += (qVal - 5) * 3.5;

  const hoursOld = Math.max(0, (nowMs - (post.timestamp || nowMs)) / (1000 * 60 * 60));
  const recencyMultiplier = Math.exp(-hoursOld / 28);

  if (score >= 0) {
    return score * (0.4 + 0.6 * recencyMultiplier) + 8 * recencyMultiplier;
  }
  return score * (1.8 - 0.8 * recencyMultiplier);
}

/**
 * Picks up to [count] (default 3) ultra-fresh Fast Path posts without allowing all 3 slots
 * to be flooded by a single scraped category when multiple categories exist.
 */
export function pickFastPathTop3(
  candidates: NewsPost[],
  profile: InterestProfile,
  userDistrict?: string | null,
  count = 3,
  nowMs: number = Date.now()
): NewsPost[] {
  if (candidates.length <= 1) return candidates.slice(0, count);

  const ranked = [...candidates].sort((a, b) => {
    const scoreA =
      calculateRelevanceScore(a, profile, nowMs) +
      15 * Math.exp(-Math.max(0, (nowMs - a.timestamp) / (1000 * 60 * 60)) / 12);
    const scoreB =
      calculateRelevanceScore(b, profile, nowMs) +
      15 * Math.exp(-Math.max(0, (nowMs - b.timestamp) / (1000 * 60 * 60)) / 12);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.timestamp - a.timestamp;
  });

  const picked: NewsPost[] = [];
  const usedCats = new Set<string>();
  const remaining = [...ranked];

  // Pass 1: Distinct categories first
  for (let i = 0; i < remaining.length && picked.length < count; ) {
    const cat = getPostCategoryTag(remaining[i], userDistrict);
    if (!usedCats.has(cat)) {
      picked.push(remaining[i]);
      usedCats.add(cat);
      remaining.splice(i, 1);
    } else {
      i++;
    }
  }

  // Pass 2: Fill remaining slots without immediate back-to-back repeats
  while (picked.length < count && remaining.length > 0) {
    const lastCat = picked.length > 0 ? getPostCategoryTag(picked[picked.length - 1], userDistrict) : '';
    const idx = remaining.findIndex((p) => getPostCategoryTag(p, userDistrict) !== lastCat);
    const takeIdx = idx >= 0 ? idx : 0;
    picked.push(remaining.splice(takeIdx, 1)[0]);
  }

  return picked;
}

export function roundRobinByCategory(
  posts: NewsPost[],
  categoryOrder: string[] = [],
  userDistrict?: string | null
): NewsPost[] {
  if (posts.length <= 2) return posts;

  const buckets = new Map<string, NewsPost[]>();
  for (const cat of categoryOrder) {
    buckets.set(cat, []);
  }
  for (const post of posts) {
    const cat = getPostCategoryTag(post, userDistrict);
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat)!.push(post);
  }

  const queues = Array.from(buckets.values()).filter((q) => q.length > 0);
  const result: NewsPost[] = [];
  while (queues.length > 0) {
    for (let i = 0; i < queues.length; ) {
      const q = queues[i];
      const next = q.shift();
      if (next) result.push(next);
      if (q.length === 0) {
        queues.splice(i, 1);
      } else {
        i++;
      }
    }
  }
  return result;
}

/**
 * 🛡️ SLIDING-WINDOW ANTI-CLUSTERING & ANTI-PING-PONG DIVERSITY (< 1ms):
 * Defeats both back-to-back repeats (Sports, Sports) AND 2-category scraper ping-pong
 * (Sports, National, Sports, National, Sports, National).
 */
export function applySlidingWindowDiversity(
  posts: NewsPost[],
  seedPrefix: NewsPost[] = [],
  preferredTopKeys: Set<string> = new Set(),
  userDistrict?: string | null
): NewsPost[] {
  if (posts.length <= 1) return posts;

  // ⚡ Precompute category tag ONCE per post so inner loop is pure O(1) Map lookup
  const tagById = new Map<string, string>();
  for (const p of posts) {
    tagById.set(p.id, getPostCategoryTag(p, userDistrict));
  }

  const remaining = [...posts];
  const result: NewsPost[] = [];
  const recentCats: string[] = seedPrefix
    .slice(-6)
    .map((p) => tagById.get(p.id) ?? getPostCategoryTag(p, userDistrict));

  while (remaining.length > 0) {
    const last1 = recentCats.length >= 1 ? recentCats[recentCats.length - 1] : null;
    const last2 = recentCats.length >= 2 ? recentCats[recentCats.length - 2] : null;

    let chosenIdx = -1;

    // Pass 1: Strict anti-ping-pong + sliding window frequency cap
    for (let i = 0; i < remaining.length; i++) {
      const cat = tagById.get(remaining[i].id)!;
      if (cat === last1 || cat === last2) continue;
      let countInWindow = 0;
      for (const rc of recentCats) {
        if (rc === cat) countInWindow++;
      }
      const maxInWindow = preferredTopKeys.has(cat) || cat === 'local_district' ? 2 : 1;
      if (countInWindow < maxInWindow) {
        chosenIdx = i;
        break;
      }
    }

    // Pass 2: Avoid 2-category ping-pong (not in last 2)
    if (chosenIdx === -1) {
      for (let i = 0; i < remaining.length; i++) {
        const cat = tagById.get(remaining[i].id)!;
        if (cat !== last1 && cat !== last2) {
          chosenIdx = i;
          break;
        }
      }
    }

    // Pass 3: Avoid immediate back-to-back
    if (chosenIdx === -1) {
      for (let i = 0; i < remaining.length; i++) {
        const cat = tagById.get(remaining[i].id)!;
        if (cat !== last1) {
          chosenIdx = i;
          break;
        }
      }
    }

    // Pass 4: Fallback
    if (chosenIdx === -1) chosenIdx = 0;

    const [chosen] = remaining.splice(chosenIdx, 1);
    const chosenCat = tagById.get(chosen.id)!;
    result.push(chosen);
    recentCats.push(chosenCat);
    if (recentCats.length > 6) recentCats.shift();
  }

  return result;
}

/**
 * 🚀 CORE 40 / 30 / 30 USER-INTEREST HOME FEED BLENDER (Mobile Web)
 */
export function blendHomeFeed(params: {
  posts: NewsPost[];
  fastPathAnchors?: NewsPost[];
  tailPrefix?: NewsPost[];
  userDistrict?: string | null;
  profile: InterestProfile;
  nowMs?: number;
}): NewsPost[] {
  const {
    posts,
    fastPathAnchors = [],
    tailPrefix = [],
    userDistrict = null,
    profile,
    nowMs = Date.now(),
  } = params;

  const anchorIds = new Set(fastPathAnchors.map((p) => p.id));
  const seenIds = new Set<string>();
  const uniqueRemaining: NewsPost[] = [];
  for (const post of posts) {
    if (!post?.id || anchorIds.has(post.id) || seenIds.has(post.id)) continue;
    if (!isPostAllowedForHomeFeed(post, userDistrict)) continue;
    seenIds.add(post.id);
    uniqueRemaining.push(post);
  }

  if (uniqueRemaining.length === 0) return [...fastPathAnchors];

  // Separate special posts (greetings) from normal news
  const greetings = uniqueRemaining.filter((p) => p.type === 'greeting');
  const normalNews = uniqueRemaining.filter((p) => p.type !== 'greeting');

  // 1. Disjoint Pool B: Local District News (30%)
  const localPosts: NewsPost[] = [];
  const nonLocalPosts: NewsPost[] = [];
  for (const post of normalNews) {
    if (isLocalDistrictPost(post, userDistrict)) {
      localPosts.push(post);
    } else {
      nonLocalPosts.push(post);
    }
  }

  const localPool = [...localPosts].sort((a, b) => {
    const scoreLocal = (p: NewsPost) => {
      const hoursOld = Math.max(0, (nowMs - p.timestamp) / (1000 * 60 * 60));
      const quality = Math.max(0, Math.min(10, p.qualityScore ?? 5)) * 3;
      const freshness = 20 * Math.exp(-hoursOld / 24);
      return quality + freshness + calculateUserInterestScore(p, profile) * 0.25;
    };
    const diff = scoreLocal(b) - scoreLocal(a);
    return diff !== 0 ? diff : b.timestamp - a.timestamp;
  });

  // 2. Disjoint Pool A (User Interest 40%) vs Pool C (Fresh General & Discovery 30%)
  const preferredSet = new Set(profile.preferredCanonicalKeys.slice(0, 6));
  const interestCandidates: NewsPost[] = [];
  const discoveryCandidates: NewsPost[] = [];

  if (profile.hasEstablishedInterests) {
    for (const post of nonLocalPosts) {
      const topics = extractCanonicalTopics(post);
      const matchesPreferred = topics.some((t) => preferredSet.has(t));
      const personalScore = calculateUserInterestScore(post, profile);
      if ((matchesPreferred && personalScore >= 0) || personalScore >= 6) {
        interestCandidates.push(post);
      } else {
        discoveryCandidates.push(post);
      }
    }
  } else {
    // Cold-start user: curated diverse editorial picks for Pool A so new users never get scraper dumps
    const rankedCold = [...nonLocalPosts].sort((a, b) => {
      const diff = calculateRelevanceScore(b, profile, nowMs) - calculateRelevanceScore(a, profile, nowMs);
      return diff !== 0 ? diff : b.timestamp - a.timestamp;
    });
    const diversifiedCold = roundRobinByCategory(
      rankedCold,
      ['politics', 'cinema', 'crime', 'business', 'technology'],
      userDistrict
    );
    const interestTarget = Math.max(1, Math.floor(diversifiedCold.length * 0.55));
    interestCandidates.push(...diversifiedCold.slice(0, interestTarget));
    discoveryCandidates.push(...diversifiedCold.slice(interestTarget));
  }

  const interestSorted = [...interestCandidates].sort((a, b) => {
    const scoreA =
      calculateUserInterestScore(a, profile) * 2 + calculateRelevanceScore(a, profile, nowMs);
    const scoreB =
      calculateUserInterestScore(b, profile) * 2 + calculateRelevanceScore(b, profile, nowMs);
    return scoreB !== scoreA ? scoreB - scoreA : b.timestamp - a.timestamp;
  });

  const interestPool = roundRobinByCategory(
    interestSorted,
    profile.preferredCanonicalKeys,
    userDistrict
  );

  const discoverySorted = [...discoveryCandidates].sort((a, b) => {
    const scoreDisc = (p: NewsPost) => {
      const hoursOld = Math.max(0, (nowMs - p.timestamp) / (1000 * 60 * 60));
      const quality = (Math.max(0, Math.min(10, p.qualityScore ?? 5)) - 5) * 3;
      const freshness = 25 * Math.exp(-hoursOld / 18);
      const negPenalty = Math.min(0, calculateUserInterestScore(p, profile) * 2);
      const engagement = Math.log1p(Math.max(0, (p.likes || 0) + (p.shares || 0) * 2 + (p.comments || 0))) * 3;
      return freshness + quality + engagement + negPenalty;
    };
    const diff = scoreDisc(b) - scoreDisc(a);
    return diff !== 0 ? diff : b.timestamp - a.timestamp;
  });
  const discoveryPool = roundRobinByCategory(discoverySorted, [], userDistrict);

  // 3. Exact 40 / 30 / 30 Interleaving
  const interleaved: NewsPost[] = [];
  const totalRemaining = interestPool.length + localPool.length + discoveryPool.length;
  let slotIdx = 0;

  const takeFrom = (primary: PoolType): NewsPost | undefined => {
    const order =
      primary === 'INTEREST'
        ? [interestPool, discoveryPool, localPool]
        : primary === 'LOCAL'
        ? [localPool, interestPool, discoveryPool]
        : [discoveryPool, interestPool, localPool];
    for (const pool of order) {
      if (pool.length > 0) return pool.shift();
    }
    return undefined;
  };

  while (interleaved.length < totalRemaining) {
    const desired = CADENCE_40_30_30[slotIdx % CADENCE_40_30_30.length];
    const next = takeFrom(desired);
    if (!next) break;
    interleaved.push(next);
    slotIdx++;
  }

  // 4. Sliding-Window Anti-Clustering & Anti-Ping-Pong
  const seedPrefix = fastPathAnchors.length > 0 ? fastPathAnchors : tailPrefix;
  const topPreferredSet = new Set(profile.preferredCanonicalKeys.slice(0, 2));
  const diversifiedTail = applySlidingWindowDiversity(
    interleaved,
    seedPrefix,
    topPreferredSet,
    userDistrict
  );

  // Place greeting nicely at index 7 (matching Android's quote greeting slot) if present
  const finalTail = [...diversifiedTail];
  if (greetings.length > 0) {
    const insertIdx = Math.min(4, finalTail.length); // index 7 overall after 3 fast path anchors
    finalTail.splice(insertIdx, 0, greetings[0]);
  }

  const combined = [...fastPathAnchors, ...finalTail];
  const deduped: NewsPost[] = [];
  const finalSeen = new Set<string>();
  for (const p of combined) {
    if (!finalSeen.has(p.id)) {
      finalSeen.add(p.id);
      deduped.push(p);
    }
  }
  return deduped;
}

export function buildUserInterestProfileFromStorage(
  currentUser: User | null | undefined,
  localScores: Record<string, number>,
  localKeywords: Record<string, number>,
  localReporters: Record<string, number>,
  explicitLocalPrefs: string[] | null
): InterestProfile {
  const explicitCategories =
    currentUser?.preferredCategories && currentUser.preferredCategories.length > 0
      ? currentUser.preferredCategories
      : explicitLocalPrefs;

  return buildInterestProfile({
    explicitCategories,
    localCategoryScores: localScores,
    userCategoryScores: currentUser?.categoryScores,
    userInterests: currentUser?.interests,
    keywordScores: localKeywords,
    reporterScores: localReporters,
  });
}
