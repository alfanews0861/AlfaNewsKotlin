import {
    buildFeedCacheKey,
    clampLimit,
    extractTimestampMs,
    getDistrictQueryAliases,
    resolveSafeCollection,
    serializeSlimNewsPost,
} from "./feed_cache_api";

describe("feed_cache_api helpers", () => {
    test("resolveSafeCollection allowlists only valid edition collections", () => {
        expect(resolveSafeCollection("news")).toBe("news");
        expect(resolveSafeCollection("news_hi")).toBe("news_hi");
        expect(resolveSafeCollection("news_pa")).toBe("news_pa");
        expect(resolveSafeCollection("news_gu")).toBe("news_gu");
        expect(resolveSafeCollection("news_en")).toBe("news_en");
        expect(resolveSafeCollection("users")).toBe("news");
        expect(resolveSafeCollection("../secret")).toBe("news");
        expect(resolveSafeCollection(null)).toBe("news");
    });

    test("clampLimit enforces strict bounded Firestore read limits", () => {
        expect(clampLimit(undefined, 25)).toBe(25);
        expect(clampLimit("20", 25)).toBe(20);
        expect(clampLimit("500", 25, 5, 35)).toBe(35);
        expect(clampLimit("1", 25, 5, 35)).toBe(5);
        expect(clampLimit("-10", 25, 5, 35)).toBe(25);
        expect(clampLimit("not-a-num", 25, 5, 35)).toBe(25);
    });

    test("getDistrictQueryAliases expands Telugu and expansion district aliases up to 10", () => {
        const nelloreAliases = getDistrictQueryAliases("Nellore");
        expect(nelloreAliases).toContain("Nellore");
        expect(nelloreAliases).toContain("శ్రీ పొట్టి శ్రీరాములు నెల్లూరు");
        expect(nelloreAliases.length).toBeLessThanOrEqual(10);

        const lucknowAliases = getDistrictQueryAliases("लखनऊ");
        expect(lucknowAliases).toContain("लखनऊ");
        expect(lucknowAliases).toContain("Lucknow");
        expect(lucknowAliases.length).toBeLessThanOrEqual(10);

        expect(getDistrictQueryAliases("")).toEqual([]);
    });

    test("serializeSlimNewsPost retains required display fields and strips heavy internal fields", () => {
        const slim = serializeSlimNewsPost("post_123", {
            headline: { telugu: "హెడ్‌లైన్", english: "Headline" },
            content: { telugu: "సారాంశం", english: "Summary" },
            fullStory: { telugu: "పూర్తి వార్త" },
            mediaUrl: "https://example.com/pic.jpg",
            timestamp: { toMillis: () => 1730000000000 },
            approved: true,
            district: "గుంటూరు",
            categories: ["Politics"],
            likes: 12,
            // Heavy internal fields that MUST be stripped:
            rawText: "HUGE_RAW_SCRAPED_TEXT".repeat(100),
            scrapedHtml: "<html>HUGE</html>",
            aiDebugLog: { prompt: "...", rawResponse: "..." },
            internalEmbedding: [0.1, 0.2, 0.3],
        });

        expect(slim.id).toBe("post_123");
        expect(slim.timestamp).toBe(1730000000000);
        expect(slim.approved).toBe(true);
        expect(slim.fullStory).toEqual({ telugu: "పూర్తి వార్త" });
        expect(slim.rawText).toBeUndefined();
        expect(slim.scrapedHtml).toBeUndefined();
        expect(slim.aiDebugLog).toBeUndefined();
        expect(slim.internalEmbedding).toBeUndefined();
    });

    test("extractTimestampMs handles numbers, Firestore-like timestamps, and Dates", () => {
        expect(extractTimestampMs(1700000000000)).toBe(1700000000000);
        expect(extractTimestampMs({ toMillis: () => 1710000000000 })).toBe(1710000000000);
        expect(extractTimestampMs({ seconds: 1720000000 })).toBe(1720000000000);
        expect(extractTimestampMs(new Date(1725000000000))).toBe(1725000000000);
    });

    test("buildFeedCacheKey produces deterministic normalized cache keys", () => {
        const key1 = buildFeedCacheKey("home", "news", "AP", "గుంటూరు", 25);
        const key2 = buildFeedCacheKey("home", "news", "AP", "గుంటూరు", 25);
        const key3 = buildFeedCacheKey("local", "news_hi", "UP", "Lucknow", 20);
        expect(key1).toBe(key2);
        expect(key1).not.toBe(key3);
    });
});
