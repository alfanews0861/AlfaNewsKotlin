/**
 * Alfa News Server-Side Edge-Cached Feed API (/api/feed)
 *
 * Architecture & Zero-Egress Design:
 * - Runs in asia-south1 alongside Firestore (asia-south1): Internal Google VPC = ₹0 Firestore Internet Egress.
 * - Returns slimmed JSON (only card/story display fields; strips heavy internal/scraper/AI debug metadata).
 * - Sets CDN Cache-Control (public, max-age=120, s-maxage=300, stale-while-revalidate=120) so Firebase Hosting /
 *   Cloudflare Edge serves thousands of concurrent mobile/web opens from a single Firestore fetch every 3-5 mins.
 * - Includes an in-memory instance LRU/TTL cache (60s) to shield Firestore during multi-POP edge refreshes.
 * - Zero disk cache required on user devices; returns epoch-ms cursors so infinite scroll pagination continues cleanly.
 */

import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { REGION } from "./utils";
import {
    ALL_NEWS_COLLECTIONS,
    EDITIONS,
    EXPANSION_DISTRICT_ALIASES,
    NewsCollectionName,
    StateCode,
    resolveStateCode,
} from "./editions";
import { TELUGU_DISTRICT_ALIASES } from "./location_data";
import { getCanonicalDistrict } from "./notification_engine";

interface CacheEntry {
    expiresAt: number;
    payload: Record<string, any>;
}

const INSTANCE_CACHE_TTL_MS = 60 * 1000; // 60 seconds warm instance RAM shield
const INSTANCE_CACHE_MAX_KEYS = 150;
const instanceCache = new Map<string, CacheEntry>();

export function clearFeedInstanceCache(): void {
    instanceCache.clear();
}

export function resolveSafeCollection(raw?: string | null): NewsCollectionName {
    const clean = (raw || "").trim();
    if ((ALL_NEWS_COLLECTIONS as string[]).includes(clean)) {
        return clean as NewsCollectionName;
    }
    return "news";
}

export function clampLimit(raw: unknown, defaultVal: number, minVal = 5, maxVal = 35): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return defaultVal;
    return Math.max(minVal, Math.min(maxVal, Math.floor(parsed)));
}

export function extractTimestampMs(raw: any): number {
    if (!raw) return Date.now();
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw?.toMillis === "function") return raw.toMillis();
    if (typeof raw?.seconds === "number") return raw.seconds * 1000;
    if (raw instanceof Date) return raw.getTime();
    return Date.now();
}

/**
 * Builds up to 10 deduplicated Firestore query aliases for a district
 * (canonical name + requested spelling + known English/Telugu/native aliases).
 */
export function getDistrictQueryAliases(rawDistrict?: string | null): string[] {
    if (!rawDistrict || typeof rawDistrict !== "string") return [];
    const trimmed = rawDistrict.trim();
    if (!trimmed) return [];

    const set = new Set<string>();
    set.add(trimmed);

    const canonical = getCanonicalDistrict(trimmed);
    if (canonical) set.add(canonical);

    const lower = trimmed.toLowerCase();
    const mappedTelugu = TELUGU_DISTRICT_ALIASES[trimmed] || TELUGU_DISTRICT_ALIASES[lower];
    if (mappedTelugu) set.add(mappedTelugu);

    const mappedExpansion = EXPANSION_DISTRICT_ALIASES[trimmed] || EXPANSION_DISTRICT_ALIASES[lower];
    if (mappedExpansion) set.add(mappedExpansion);

    const targetCanonical = canonical || mappedTelugu || mappedExpansion || trimmed;
    const targetLower = targetCanonical.toLowerCase();

    for (const [alias, target] of Object.entries(TELUGU_DISTRICT_ALIASES)) {
        if (target === targetCanonical || target.toLowerCase() === targetLower) {
            set.add(alias);
            if (set.size >= 10) break;
        }
    }

    if (set.size < 10) {
        for (const [alias, target] of Object.entries(EXPANSION_DISTRICT_ALIASES)) {
            if (target === targetCanonical || target.toLowerCase() === targetLower) {
                set.add(alias);
                if (set.size >= 10) break;
            }
        }
    }

    return Array.from(set).filter((v) => v.length > 0).slice(0, 10);
}

/**
 * Slim serializer returning ONLY fields needed by Android & Web NewsCard / ArticleView / FeedBlender.
 * Strips heavy internal/scraper/AI debug fields to cut response payload size by ~60-75% before Gzip.
 */
export function serializeSlimNewsPost(id: string, data: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {
        id,
        headline: data.headline ?? "",
        content: data.content ?? "",
        mediaUrl: data.mediaUrl ?? "",
        mediaType: data.mediaType ?? "IMAGE",
        postFormat: data.postFormat ?? "VERTICAL",
        reporter: data.reporter ?? { id: "", name: "" },
        location: data.location ?? "",
        timestamp: extractTimestampMs(data.timestamp ?? data.createdAt ?? data.publishedAt),
        categories: Array.isArray(data.categories) ? data.categories : [],
        likes: typeof data.likes === "number" ? data.likes : 0,
        comments: typeof data.comments === "number" ? data.comments : 0,
        shares: typeof data.shares === "number" ? data.shares : 0,
        approved: data.approved === true,
        district: data.district ?? "State",
        category: data.category ?? "General News",
    };

    if (data.fullStory) out.fullStory = data.fullStory;
    if (Array.isArray(data.mediaUrls) && data.mediaUrls.length > 0) out.mediaUrls = data.mediaUrls;
    if (Array.isArray(data.mediaTypes) && data.mediaTypes.length > 0) out.mediaTypes = data.mediaTypes;
    if (data.youtubeUrl) out.youtubeUrl = data.youtubeUrl;
    if (data.thumbnailUrl) out.thumbnailUrl = data.thumbnailUrl;
    if (Array.isArray(data.tags) && data.tags.length > 0) out.tags = data.tags;
    if (data.localAdUrl) out.localAdUrl = data.localAdUrl;
    if (data.localAdContact) out.localAdContact = data.localAdContact;
    if (data.originalUrl) out.originalUrl = data.originalUrl;
    if (data.affiliateUrl) out.affiliateUrl = data.affiliateUrl;
    if (data.verificationStatus) out.verificationStatus = data.verificationStatus;
    if (data.type) out.type = data.type;
    if (data.aiProcessed === true) out.aiProcessed = true;
    if (data.isReporter === true) out.isReporter = true;
    if (data.isCitizen === true) out.isCitizen = true;
    if (data.isGlobal === true) out.isGlobal = true;
    if (data.constituency) out.constituency = data.constituency;
    if (data.mandal) out.mandal = data.mandal;
    if (data.state) out.state = data.state;
    if (data.stateCode) out.stateCode = data.stateCode;
    if (data.language) out.language = data.language;
    if (data.status) out.status = data.status;
    if (data.webOnly === true) out.webOnly = true;
    if (data.isSpecialStory === true) out.isSpecialStory = true;
    if (typeof data.qualityScore === "number") out.qualityScore = data.qualityScore;
    if (data.originalReporterId) out.originalReporterId = data.originalReporterId;
    if (data.processingType) out.processingType = data.processingType;

    return out;
}

export function buildFeedCacheKey(
    type: string,
    col: NewsCollectionName,
    stateCode: StateCode | null,
    canonicalDistrict: string,
    limitVal: number
): string {
    return `${type}|${col}|${stateCode || "ALL"}|${canonicalDistrict || "NONE"}|${limitVal}`;
}

function getFromInstanceCache(key: string): Record<string, any> | null {
    const entry = instanceCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        instanceCache.delete(key);
        return null;
    }
    return entry.payload;
}

function setInInstanceCache(key: string, payload: Record<string, any>): void {
    if (instanceCache.size >= INSTANCE_CACHE_MAX_KEYS) {
        const oldestKey = instanceCache.keys().next().value;
        if (oldestKey) instanceCache.delete(oldestKey);
    }
    instanceCache.set(key, {
        expiresAt: Date.now() + INSTANCE_CACHE_TTL_MS,
        payload,
    });
}

async function safeQueryDocs(
    q: admin.firestore.Query
): Promise<admin.firestore.QueryDocumentSnapshot[]> {
    try {
        const snap = await q.get();
        return snap.docs;
    } catch (err: any) {
        console.warn("[getCachedFeed] Query warning:", err?.message || err);
        return [];
    }
}

export const getCachedFeed = onRequest(
    {
        region: REGION,
        cors: true,
        memory: "256MiB",
        maxInstances: 10,
        concurrency: 40,
        timeoutSeconds: 15,
    },
    async (req, res) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
            res.status(405).json({ ok: false, error: "Method not allowed" });
            return;
        }

        try {
            const rawType = String(req.query.type || "home").toLowerCase().trim();
            const feedType: "home" | "local" | "portal" =
                rawType === "local" ? "local" : rawType === "portal" ? "portal" : "home";

            const col = resolveSafeCollection(req.query.col ? String(req.query.col) : "news");
            const rawState = req.query.state ? String(req.query.state).trim() : "";
            const rawDistrict = req.query.district ? String(req.query.district).trim() : "";

            const resolvedState: StateCode | null =
                resolveStateCode(rawState, rawDistrict) || null;
            const districtAliases = getDistrictQueryAliases(rawDistrict);
            const canonicalDistrict =
                getCanonicalDistrict(rawDistrict) ||
                EXPANSION_DISTRICT_ALIASES[rawDistrict] ||
                EXPANSION_DISTRICT_ALIASES[rawDistrict.toLowerCase()] ||
                rawDistrict;

            const defaultLimit = feedType === "portal" ? 30 : feedType === "local" ? 20 : 25;
            const reqLimit = clampLimit(req.query.limit, defaultLimit, 5, 35);

            const cacheKey = buildFeedCacheKey(
                feedType,
                col,
                resolvedState,
                canonicalDistrict,
                reqLimit
            );

            const cached = getFromInstanceCache(cacheKey);
            if (cached) {
                res.set("Content-Type", "application/json; charset=utf-8");
                res.set("Cache-Control", "public, max-age=120, s-maxage=300, stale-while-revalidate=120");
                res.set("Vary", "Accept-Encoding");
                res.set("X-Alfa-Cache", "HIT");
                res.status(200).json(cached);
                return;
            }

            const db = admin.firestore();
            const newsRef = db.collection(col);
            const stateAliases = resolvedState
                ? (EDITIONS[resolvedState]?.stateAliases || [resolvedState]).slice(0, 10)
                : [];

            let payload: Record<string, any>;

            if (feedType === "home") {
                const mainQuery = newsRef
                    .where("approved", "==", true)
                    .orderBy("timestamp", "desc")
                    .limit(reqLimit);

                const stateQuery = stateAliases.length > 0
                    ? newsRef
                        .where("approved", "==", true)
                        .where("state", "in", stateAliases)
                        .orderBy("timestamp", "desc")
                        .limit(12)
                    : null;

                const localQuery = districtAliases.length > 1
                    ? newsRef
                        .where("approved", "==", true)
                        .where("district", "in", districtAliases)
                        .orderBy("timestamp", "desc")
                        .limit(12)
                    : districtAliases.length === 1
                        ? newsRef
                            .where("approved", "==", true)
                            .where("district", "==", districtAliases[0])
                            .orderBy("timestamp", "desc")
                            .limit(12)
                        : null;

                const greetingQuery = newsRef
                    .where("approved", "==", true)
                    .where("type", "==", "greeting")
                    .orderBy("timestamp", "desc")
                    .limit(1);

                const [mainDocs, stateDocs, localDocs, greetingDocs] = await Promise.all([
                    safeQueryDocs(mainQuery),
                    stateQuery ? safeQueryDocs(stateQuery) : Promise.resolve([]),
                    localQuery ? safeQueryDocs(localQuery) : Promise.resolve([]),
                    safeQueryDocs(greetingQuery),
                ]);

                const main = mainDocs.map((d) => serializeSlimNewsPost(d.id, d.data()));
                const statePosts = stateDocs.map((d) => serializeSlimNewsPost(d.id, d.data()));
                const local = localDocs.map((d) => serializeSlimNewsPost(d.id, d.data()));
                const greeting = greetingDocs.length > 0
                    ? serializeSlimNewsPost(greetingDocs[0].id, greetingDocs[0].data())
                    : null;

                payload = {
                    ok: true,
                    type: "home",
                    col,
                    state: resolvedState,
                    district: canonicalDistrict || null,
                    cachedAt: Date.now(),
                    main,
                    statePosts,
                    local,
                    greeting,
                    cursors: {
                        mainLastTs: main.length > 0 ? main[main.length - 1].timestamp : null,
                        stateLastTs: statePosts.length > 0 ? statePosts[statePosts.length - 1].timestamp : null,
                        localLastTs: local.length > 0 ? local[local.length - 1].timestamp : null,
                    },
                };
            } else if (feedType === "local") {
                let docs: admin.firestore.QueryDocumentSnapshot[] = [];

                if (districtAliases.length > 0) {
                    const primaryQuery = districtAliases.length > 1
                        ? newsRef
                            .where("approved", "==", true)
                            .where("district", "in", districtAliases)
                            .orderBy("timestamp", "desc")
                            .limit(reqLimit)
                        : newsRef
                            .where("approved", "==", true)
                            .where("district", "==", districtAliases[0])
                            .orderBy("timestamp", "desc")
                            .limit(reqLimit);

                    docs = await safeQueryDocs(primaryQuery);

                    if (docs.length === 0) {
                        const catFallback = newsRef
                            .where("approved", "==", true)
                            .where("categories", "array-contains-any", districtAliases)
                            .orderBy("timestamp", "desc")
                            .limit(reqLimit);
                        docs = await safeQueryDocs(catFallback);
                    }
                }

                if (docs.length === 0 && stateAliases.length > 0) {
                    const stateFallback = newsRef
                        .where("approved", "==", true)
                        .where("state", "in", stateAliases)
                        .orderBy("timestamp", "desc")
                        .limit(Math.min(reqLimit, 15));
                    docs = await safeQueryDocs(stateFallback);
                }

                if (docs.length === 0) {
                    const generalFallback = newsRef
                        .where("approved", "==", true)
                        .orderBy("timestamp", "desc")
                        .limit(Math.min(reqLimit, 15));
                    docs = await safeQueryDocs(generalFallback);
                }

                const posts = docs.map((d) => serializeSlimNewsPost(d.id, d.data()));
                payload = {
                    ok: true,
                    type: "local",
                    col,
                    state: resolvedState,
                    district: canonicalDistrict || null,
                    cachedAt: Date.now(),
                    posts,
                    cursors: {
                        lastTs: posts.length > 0 ? posts[posts.length - 1].timestamp : null,
                    },
                };
            } else {
                // type === "portal": combined homepage snapshot for Web Portal
                const isExpansion = resolvedState !== null && resolvedState !== "AP" && resolvedState !== "TS";
                const primaryQuery = isExpansion
                    ? newsRef
                        .where("approved", "==", true)
                        .where("stateCode", "==", resolvedState)
                        .orderBy("timestamp", "desc")
                        .limit(reqLimit)
                    : newsRef
                        .where("approved", "==", true)
                        .orderBy("timestamp", "desc")
                        .limit(reqLimit);

                const extraQueries: Promise<admin.firestore.QueryDocumentSnapshot[]>[] = isExpansion
                    ? [
                        safeQueryDocs(
                            newsRef.where("approved", "==", true).where("categories", "array-contains", "Politics").orderBy("timestamp", "desc").limit(10)
                        ),
                        safeQueryDocs(
                            newsRef.where("approved", "==", true).where("categories", "array-contains", "Sports").orderBy("timestamp", "desc").limit(10)
                        ),
                        stateAliases.length > 0
                            ? safeQueryDocs(
                                newsRef.where("approved", "==", true).where("state", "in", stateAliases).orderBy("timestamp", "desc").limit(12)
                            )
                            : Promise.resolve([]),
                    ]
                    : [
                        safeQueryDocs(
                            newsRef.where("approved", "==", true).where("categories", "array-contains", "Politics").orderBy("timestamp", "desc").limit(10)
                        ),
                        safeQueryDocs(
                            newsRef.where("approved", "==", true).where("categories", "array-contains", "Cinema").orderBy("timestamp", "desc").limit(10)
                        ),
                        safeQueryDocs(
                            newsRef.where("approved", "==", true).where("categories", "array-contains", "Sports").orderBy("timestamp", "desc").limit(10)
                        ),
                    ];

                let primaryDocs = await safeQueryDocs(primaryQuery);
                if (primaryDocs.length === 0 && isExpansion) {
                    primaryDocs = await safeQueryDocs(
                        newsRef.where("approved", "==", true).orderBy("timestamp", "desc").limit(reqLimit)
                    );
                }

                const extraResults = await Promise.all(extraQueries);
                const seen = new Set<string>();
                const merged: Record<string, any>[] = [];

                for (const docList of [primaryDocs, ...extraResults]) {
                    for (const d of docList) {
                        if (!seen.has(d.id)) {
                            seen.add(d.id);
                            merged.push(serializeSlimNewsPost(d.id, d.data()));
                        }
                    }
                }
                merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

                payload = {
                    ok: true,
                    type: "portal",
                    col,
                    state: resolvedState || "AP",
                    cachedAt: Date.now(),
                    posts: merged,
                    cursors: {
                        lastTs: merged.length > 0 ? merged[merged.length - 1].timestamp : null,
                    },
                };
            }

            setInInstanceCache(cacheKey, payload);

            res.set("Content-Type", "application/json; charset=utf-8");
            res.set("Cache-Control", "public, max-age=120, s-maxage=300, stale-while-revalidate=120");
            res.set("Vary", "Accept-Encoding");
            res.set("X-Alfa-Cache", "MISS");
            res.status(200).json(payload);
        } catch (err: any) {
            console.error("[getCachedFeed] Unexpected error:", err?.message || err);
            res.status(500).json({ ok: false, error: "Feed temporarily unavailable" });
        }
    }
);
