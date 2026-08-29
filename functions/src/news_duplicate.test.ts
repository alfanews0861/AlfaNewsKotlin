/**
 * Unit Tests for 6-Hour Mandal Duplicate Detection in Alfa News
 */

import * as admin from "firebase-admin";

if (!admin.apps.length) {
    admin.initializeApp();
}

import { calculateTextSimilarity } from "./news_handler";

describe("Duplicate Detection - Text Similarity", () => {
    test("should return 1.0 for identical Telugu text", () => {
        const text1 = "ఖమ్మం జిల్లాలో ఘోర రోడ్డు ప్రమాదం జరిగింది";
        const text2 = "ఖమ్మం జిల్లాలో ఘోర రోడ్డు ప్రమాదం జరిగింది";
        const sim = calculateTextSimilarity(text1, text2);
        expect(sim).toBeGreaterThanOrEqual(0.99);
    });

    test("should detect high similarity for slightly modified Telugu sentences", () => {
        const text1 = "కొణిజర్ల మండల కేంద్రంలో ఘోర రోడ్డు ప్రమాదం, ఇద్దరు మృతి";
        const text2 = "కొణిజర్ల మండలంలో జరిగిన రోడ్డు ప్రమాదం, ఇద్దరు దుర్మరణం";
        const sim = calculateTextSimilarity(text1, text2);
        // Shared words: కొణిజర్ల, రోడ్డు, ప్రమాదం, etc.
        expect(sim).toBeGreaterThan(0.3);
    });

    test("should return 0 or very low similarity for completely unrelated news", () => {
        const text1 = "కొణిజర్ల మండలంలో ఘోర రోడ్డు ప్రమాదం, ఇద్దరు మృతి";
        const text2 = "హైదరాబాద్ నగరంలో భారీ వర్షాలు, నిలిచిన ట్రాఫిక్";
        const sim = calculateTextSimilarity(text1, text2);
        expect(sim).toBeLessThan(0.2);
    });

    test("should safely handle empty or null strings", () => {
        expect(calculateTextSimilarity("", "")).toBe(0);
        expect(calculateTextSimilarity("ఖమ్మం", "")).toBe(0);
        expect(calculateTextSimilarity("", "ఖమ్మం")).toBe(0);
    });
});
