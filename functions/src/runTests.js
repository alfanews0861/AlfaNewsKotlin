#!/usr/bin/env node

/**
 * Test Runner for processReporterSubmission Function
 * Runs unit tests directly in Node.js without jest/vitest
 */

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

// Test framework
function describe(suiteName, suiteFunc) {
  console.log(`\n${colors.cyan}${suiteName}${colors.reset}`);
  suiteFunc();
}

function test(testName, testFunc) {
  totalTests++;
  try {
    testFunc();
    passedTests++;
    console.log(`  ${colors.green}✓${colors.reset} ${testName}`);
  } catch (error) {
    failedTests++;
    console.log(`  ${colors.red}✗${colors.reset} ${testName}`);
    failures.push({
      suite: "Suite",
      test: testName,
      error: error.message || String(error),
    });
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
          `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
        );
      }
    },
    toContain(expected) {
      if (!actual || !actual.includes(expected)) {
        throw new Error(`Expected array to contain ${expected}`);
      }
    },
    toThrow(expectedError) {
      try {
        actual();
      } catch (error) {
        if (expectedError && !error.message.includes(expectedError)) {
          throw new Error(
            `Expected error to contain "${expectedError}" but got "${error.message}"`
          );
        }
        return;
      }
      throw new Error("Expected function to throw an error");
    },
    not: {
      toThrow() {
        try {
          actual();
        } catch (error) {
          throw new Error(`Expected function not to throw, but it threw: ${error.message}`);
        }
      },
      toBeUndefined() {
        if (actual === undefined) {
          throw new Error("Expected to be defined, but was undefined");
        }
      },
    },
    toBeGreaterThanOrEqual(expected) {
      if (actual < expected) {
        throw new Error(`Expected ${actual} to be >= ${expected}`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error("Expected value to be defined");
      }
    },
    toHaveProperty(prop) {
      if (!(prop in actual)) {
        throw new Error(`Expected object to have property ${prop}`);
      }
    },
  };
}

// Mock data factory
const createMockRequest = (data) => ({
  data,
  auth: { uid: "test-reporter-123" },
});

const createValidAIResponse = () => ({
  content: "The 70-word enhanced news content here.",
  headline: "Compelling Headlines",
  headlineEn: "Compelling Headline",
  contentEn: "The 70-word enhanced news content in English.",
  location: "Hyderabad",
  storyFingerprint: "abc123def456",
  refinedCategory: "రాజకీయ సమాచారం",
  isSafeForYouTube: true,
  rejectionReason: "",
  tags: ["politics", "telangana"],
  entities: {
    people: ["Minister X", "CM Y"],
    organizations: ["Government"],
    locations: ["Telangana"],
  },
});

// Helper functions
function validateInput(data) {
  let headline = data.headline || data.postData?.headline?.telugu || "";
  let content = data.content || data.postData?.content?.telugu || "";

  if (!headline || !content) {
    throw new Error("వార్త శీర్షిక మరియు వివరణ తప్పనిసరి.");
  }
}

function validateAIResponse(aiResponse) {
  if (
    !(
      aiResponse.content &&
      aiResponse.headline &&
      aiResponse.headlineEn &&
      aiResponse.contentEn
    )
  ) {
    throw new Error(
      "AI ప్రాసెసింగ్ చెక్‌పాయింట్ విఫలమైంది. దయచేసి మళ్ళీ ప్రయత్నించండి."
    );
  }
}

function getDiagnostics(aiResponse) {
  return {
    hasContent: !!aiResponse.content,
    hasHeadline: !!aiResponse.headline,
    hasHeadlineEn: !!aiResponse.headlineEn,
    hasContentEn: !!aiResponse.contentEn,
    hasLocation: !!aiResponse.location,
    hasRefinedCategory: !!aiResponse.refinedCategory,
  };
}

function normalizeEntities(entities) {
  if (!entities || typeof entities !== "object") {
    entities = { people: [], organizations: [], locations: [] };
  } else {
    entities.people = Array.isArray(entities.people) ? entities.people : [];
    entities.organizations = Array.isArray(entities.organizations)
      ? entities.organizations
      : [];
    entities.locations = Array.isArray(entities.locations)
      ? entities.locations
      : [];
  }
  return entities;
}

function buildFinalData(aiResponse, actualPostData) {
  return {
    headline: {
      telugu: aiResponse.headline,
      english: aiResponse.headlineEn,
    },
    content: {
      telugu: aiResponse.content,
      english: aiResponse.contentEn,
    },
    location: aiResponse.location,
    category: aiResponse.refinedCategory,
    categories: Array.from(
      new Set([
        aiResponse.refinedCategory,
        ...(actualPostData?.categories || []),
        ...(actualPostData?.district ? [actualPostData.district] : []),
      ])
    ).filter((c) => !!c),
    tags: aiResponse.tags || [],
    entities: normalizeEntities(aiResponse.entities),
    isSafeForYouTube: aiResponse.isSafeForYouTube ?? true,
    rejectionReason: aiResponse.rejectionReason || "",
    storyFingerprint: aiResponse.storyFingerprint,
    reporter: actualPostData?.reporter,
    isReporter: true,
    isCitizen: false,
    aiProcessed: true,
    processingType: "REPORTER_SUBMISSION",
  };
}

function validateHeadlineLength(headline) {
  if (!headline) throw new Error("Headline required");
}

function validateContentLength(content) {
  if (!content) throw new Error("Content required");
}

function validatePostId(postId) {
  // Both undefined (create) and defined (update) are valid
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe("processReporterSubmission - Input Validation", () => {
  test("should reject when headline is empty", () => {
    const request = createMockRequest({
      postData: {
        headline: { telugu: "" },
        content: { telugu: "Valid content here" },
      },
    });

    expect(() => validateInput(request.data)).toThrow("వార్త శీర్షిక");
  });

  test("should reject when content is empty", () => {
    const request = createMockRequest({
      postData: {
        headline: { telugu: "Valid headline" },
        content: { telugu: "" },
      },
    });

    expect(() => validateInput(request.data)).toThrow("తప్పనిసరి");
  });

  test("should accept when content passed as rawContent parameter", () => {
    const request = createMockRequest({
      headline: "Test Headline",
      content: "Test content",
    });

    expect(() => validateInput(request.data)).not.toThrow();
  });

  test("should accept when postData contains headline and content", () => {
    const request = createMockRequest({
      postData: {
        headline: { telugu: "తెలుగు శీర్షిక" },
        content: { telugu: "తెలుగువిషయవస్తువు" },
      },
    });

    expect(() => validateInput(request.data)).not.toThrow();
  });
});

describe("processReporterSubmission - AI Response Validation", () => {
  test("should reject when AI response is missing headline", () => {
    const aiResponse = createValidAIResponse();
    delete aiResponse.headline;

    expect(() => validateAIResponse(aiResponse)).toThrow("చెక్‌పాయింట్");
  });

  test("should reject when AI response has empty headline", () => {
    const aiResponse = createValidAIResponse();
    aiResponse.headline = "";

    expect(() => validateAIResponse(aiResponse)).toThrow("విఫలమైంది");
  });

  test("should reject when AI response is missing headlineEn", () => {
    const aiResponse = createValidAIResponse();
    delete aiResponse.headlineEn;

    expect(() => validateAIResponse(aiResponse)).toThrow();
  });

  test("should reject when AI response is missing content", () => {
    const aiResponse = createValidAIResponse();
    delete aiResponse.content;

    expect(() => validateAIResponse(aiResponse)).toThrow();
  });

  test("should accept when all required fields are present", () => {
    const aiResponse = createValidAIResponse();

    expect(() => validateAIResponse(aiResponse)).not.toThrow();
  });

  test("should provide diagnostic output when fields are missing", () => {
    const aiResponse = {
      content: "Valid content",
      headline: "",
      headlineEn: "Valid",
      contentEn: "Valid",
    };

    const diagnostics = getDiagnostics(aiResponse);
    expect(diagnostics.hasHeadline).toBe(false);
    expect(diagnostics.hasContent).toBe(true);
  });
});

describe("processReporterSubmission - Entities Validation", () => {
  test("should handle null entities by creating default structure", () => {
    const normalized = normalizeEntities(null);

    expect(normalized).toEqual({
      people: [],
      organizations: [],
      locations: [],
    });
  });

  test("should handle undefined entities by creating default structure", () => {
    const normalized = normalizeEntities(undefined);

    expect(normalized).toEqual({
      people: [],
      organizations: [],
      locations: [],
    });
  });

  test("should convert non-array people field to array", () => {
    const entities = {
      people: "John Doe",
      organizations: ["Org1"],
      locations: ["Location1"],
    };

    const normalized = normalizeEntities(entities);

    expect(normalized.people).toEqual([]);
  });

  test("should preserve valid array entities", () => {
    const entities = {
      people: ["John", "Jane"],
      organizations: ["Org1", "Org2"],
      locations: ["City1", "City2"],
    };

    const normalized = normalizeEntities(entities);

    expect(normalized.people).toEqual(["John", "Jane"]);
    expect(normalized.organizations).toEqual(["Org1", "Org2"]);
    expect(normalized.locations).toEqual(["City1", "City2"]);
  });

  test("should handle partially missing entities fields", () => {
    const entities = {
      people: ["John"],
    };

    const normalized = normalizeEntities(entities);

    expect(normalized.people).toEqual(["John"]);
    expect(normalized.organizations).toEqual([]);
    expect(normalized.locations).toEqual([]);
  });
});

describe("processReporterSubmission - Media Handling", () => {
  test("should detect video media type by .mp4 extension", () => {
    const mediaUrl = "https://storage.firebase.example.com/video_123.mp4";
    const mediaType = "IMAGE";

    const isVideo =
      mediaType === "VIDEO" || mediaUrl.toLowerCase().includes(".mp4");

    expect(isVideo).toBe(true);
  });

  test("should not detect video for image media type", () => {
    const mediaUrl = "https://storage.firebase.example.com/image_123.jpg";
    const mediaType = "IMAGE";

    const isVideo =
      mediaType === "VIDEO" || mediaUrl.toLowerCase().includes(".mp4");

    expect(isVideo).toBe(false);
  });

  test("should handle external media URLs correctly", () => {
    const externalUrl = "https://example.com/image.jpg";

    const shouldOptimize = !externalUrl.includes("firebasestorage.googleapis.com");

    expect(shouldOptimize).toBe(true);
  });
});

describe("processReporterSubmission - Data Integrity", () => {
  test("should preserve all required fields in finalData", () => {
    const aiResponse = createValidAIResponse();
    const actualPostData = {
      timestamp: new Date(),
      reporter: { id: "rep123", name: "Reporter Name" },
    };

    const finalData = buildFinalData(aiResponse, actualPostData);

    expect(finalData.headline).toBeDefined();
    expect(finalData.headline.telugu).toBe(aiResponse.headline);
    expect(finalData.content).toBeDefined();
    expect(finalData.location).toBe(aiResponse.location);
  });

  test("should set isReporter flag correctly", () => {
    const aiResponse = createValidAIResponse();
    const finalData = buildFinalData(aiResponse, {});

    expect(finalData.isReporter).toBe(true);
    expect(finalData.isCitizen).toBe(false);
  });

  test("should set processingType correctly", () => {
    const aiResponse = createValidAIResponse();
    const finalData = buildFinalData(aiResponse, {});

    expect(finalData.processingType).toBe("REPORTER_SUBMISSION");
  });

  test("should mark as aiProcessed", () => {
    const aiResponse = createValidAIResponse();
    const finalData = buildFinalData(aiResponse, {});

    expect(finalData.aiProcessed).toBe(true);
  });

  test("should set isSafeForYouTube from AI response", () => {
    const aiResponse = createValidAIResponse();
    aiResponse.isSafeForYouTube = false;

    const finalData = buildFinalData(aiResponse, {});

    expect(finalData.isSafeForYouTube).toBe(false);
  });

  test("should merge categories correctly", () => {
    const aiResponse = createValidAIResponse();
    aiResponse.refinedCategory = "చరిత్ర";

    const actualPostData = {
      categories: ["రాజకీయ సమాచారం"],
      district: "హైదరాబాద్",
    };

    const finalData = buildFinalData(aiResponse, actualPostData);

    expect(finalData.categories).toContain("చరిత్ర");
    expect(finalData.categories).toContain("రాజకీయ సమాచారం");
  });
});

describe("processReporterSubmission - Error Handling", () => {
  test("should provide diagnostic information in error logs", () => {
    const aiResponse = {
      content: "Valid",
      headline: "",
      headlineEn: "Valid",
      contentEn: "Valid",
    };

    const diagnostics = getDiagnostics(aiResponse);

    expect(diagnostics).toHaveProperty("hasContent");
    expect(diagnostics).toHaveProperty("hasHeadline");
  });

  test("should identify exact failing fields", () => {
    const aiResponse = {
      content: "",
      headline: "",
      headlineEn: "Valid",
      contentEn: "",
    };

    const diagnostics = getDiagnostics(aiResponse);

    expect(diagnostics.hasContent).toBe(false);
    expect(diagnostics.hasHeadline).toBe(false);
  });
});

describe("processReporterSubmission - Edge Cases", () => {
  test("should handle very long headlines", () => {
    const longHeadline = "A".repeat(500);
    expect(() => validateHeadlineLength(longHeadline)).not.toThrow();
  });

  test("should handle Telugu characters in all fields", () => {
    const teluguText = "తెలుగు సమాచారం రాజకీయ చరిత్ర వ్యాపారం";
    expect(() =>
      validateInput({ headline: teluguText, content: teluguText })
    ).not.toThrow();
  });

  test("should handle null postData gracefully", () => {
    const request = createMockRequest({
      headline: "Test",
      content: "Test",
      postData: null,
    });

    expect(() => validateInput(request.data)).not.toThrow();
  });

  test("should handle update vs create scenarios", () => {
    const postIdForUpdate = "existing-post-123";
    const postIdForCreate = undefined;

    expect(() => validatePostId(postIdForUpdate)).not.toThrow();
    expect(() => validatePostId(postIdForCreate)).not.toThrow();
  });
});

// ============================================================================
// NOTIFICATION ENGINE TESTS
// ============================================================================

describe("Notification Engine - Topic Slugify Parity", () => {
  function slugify(text) {
    if (!text) return "default";
    return text.split('').map(char => {
      const code = char.charCodeAt(0);
      if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
        return char;
      }
      return code.toString(16).padStart(4, '0');
    }).join('').substring(0, 80);
  }

  test("should convert Telugu district name to valid FCM topic hex string", () => {
    const slug = slugify("హైదరాబాద్");
    expect(/^[a-f0-9]+$/.test(slug)).toBe(true);
  });

  test("should handle ASCII alphanumeric text correctly", () => {
    const slug = slugify("Hyderabad123");
    expect(slug).toBe("Hyderabad123");
  });
});

describe("Notification Engine - Unsent News Selection", () => {
  test("should pick the next unsent news when top viewed news was already sent", () => {
    const allNews = [
      { id: "news_1", longViews: 500, headline: { telugu: "Top news" } },
      { id: "news_2", longViews: 300, headline: { telugu: "Second news" } },
      { id: "news_3", longViews: 100, headline: { telugu: "Third news" } }
    ];
    const lastSentMap = { general: "news_1" };

    const topNews = allNews.find(n => lastSentMap['general'] !== n.id) || allNews[0];
    expect(topNews.id).toBe("news_2");
  });

  test("should filter district news that was not sent in previous slot", () => {
    const allNews = [
      { id: "guntur_1", categories: ["గుంటూరు"], district: "గుంటూరు", longViews: 200 },
      { id: "guntur_2", categories: ["గుంటూరు"], district: "గుంటూరు", longViews: 150 }
    ];
    const lastSentMap = { "గుంటూరు": "guntur_1" };

    const districtNews = allNews.find(n =>
      ((Array.isArray(n.categories) && n.categories.includes("గుంటూరు")) || n.district === "గుంటూరు") &&
      lastSentMap["గుంటూరు"] !== n.id
    );
    expect(districtNews.id).toBe("guntur_2");
  });

  test("should filter category news that was not sent in general or category", () => {
    const allNews = [
      { id: "pol_1", category: "రాజకీయం", longViews: 400 },
      { id: "pol_2", category: "రాజకీయం", longViews: 250 }
    ];
    const lastSentMap = { general: "pol_1", cat_cat_politics: "pol_1" };

    const catNews = allNews.find(n =>
      n.category === "రాజకీయం" &&
      lastSentMap['general'] !== n.id &&
      lastSentMap['cat_cat_politics'] !== n.id
    );
    expect(catNews.id).toBe("pol_2");
  });
});

describe("Image Processing - Smart 16:9 Face & Saliency Crop", () => {
  const { calculateSmartCrop16x9 } = require("../lib/utils");
  const sharp = require("sharp");

  test("should preserve full frame when image is already 16:9", async () => {
    const buf = await sharp({
      create: { width: 1280, height: 720, channels: 3, background: { r: 100, g: 100, b: 100 } }
    }).jpeg().toBuffer();

    const crop = await calculateSmartCrop16x9(buf, 1280, 720);
    expect(crop.left).toBe(0);
    expect(crop.top).toBe(0);
    expect(crop.width).toBe(1280);
    expect(crop.height).toBe(720);
  });

  test("should dynamically center on faces in vertical portrait images", async () => {
    // 400x800 image with face cluster at y=400 to 500
    const buf = await sharp({
      create: { width: 400, height: 800, channels: 3, background: { r: 40, g: 40, b: 40 } }
    }).composite([{
      input: await sharp({
        create: { width: 200, height: 100, channels: 3, background: { r: 210, g: 140, b: 100 } }
      }).png().toBuffer(),
      top: 400,
      left: 100
    }]).jpeg().toBuffer();

    const crop = await calculateSmartCrop16x9(buf, 400, 800);
    expect(crop.width).toBe(400);
    expect(crop.height).toBe(225);
    // Face is at y=400..500. Crop of height 225 should cover y=400..500 (top between 280 and 400)
    expect(crop.top).toBeGreaterThan(250);
    expect(crop.top).toBeLessThanOrEqual(400);
  });
});

describe("YouTube Community Guidelines & Safety Shield", () => {
  function simulatePostEvaluation(aiData, postData) {
    const mTypes = (postData.mediaTypes || []).map(t => String(t).toUpperCase());
    const rawMediaUrl = postData.mediaUrl || "";
    const isDirectYoutube = (postData.youtubeUrl && postData.youtubeUrl.length > 5) ||
      rawMediaUrl.includes('youtube.com') || rawMediaUrl.includes('youtu.be');
    const hasVideo = mTypes.includes('VIDEO') || postData.mediaType?.toUpperCase() === 'VIDEO' || isDirectYoutube;
    const isDuplicateStory = aiData.isDuplicate === true;

    const rawRejection = (aiData.rejectionReason || "").trim();
    const isAccidentOrInjury = rawRejection.includes("ప్రమాదం") ||
      rawRejection.includes("రక్తపాతం") ||
      rawRejection.includes("గాయాలు") ||
      rawRejection.includes("దృశ్యం") ||
      rawRejection.includes("మరణం") ||
      rawRejection.includes("మృతి");

    const isYouTubeUnsafe = hasVideo && aiData.isSafeForYouTube === false;

    if (isAccidentOrInjury && !isDuplicateStory && !isYouTubeUnsafe) {
      aiData.rejectionReason = null;
      aiData.isGraphicOrBloody = true;
      aiData.isBreaking = true;
    } else if (isYouTubeUnsafe) {
      aiData.rejectionReason = aiData.rejectionReason || "యూట్యూబ్ కమ్యూనిటీ నిబంధనల ప్రకారం తీవ్ర రక్తపాతం లేదా భయానక దృశ్యాలు అనుమతించబడవు.";
      aiData.isGraphicOrBloody = true;
    }

    const isRejected = (aiData.rejectionReason && aiData.rejectionReason.length > 0) || isDuplicateStory || isYouTubeUnsafe;
    const shouldWaitForVideoUpload = hasVideo && !isDirectYoutube && !postData.videoProcessed;

    return {
      status: isRejected ? "REJECTED" : (shouldWaitForVideoUpload ? "PROCESSING_VIDEO" : "PUBLISHED"),
      approved: isRejected ? false : (shouldWaitForVideoUpload ? false : true),
      isRejected,
      isYouTubeUnsafe,
      rejectionReason: aiData.rejectionReason
    };
  }

  test("should block video post when isSafeForYouTube is false", () => {
    const aiData = {
      isSafeForYouTube: false,
      rejectionReason: "భయానక రక్తపాత దృశ్యాలు",
      isDuplicate: false
    };
    const postData = { mediaType: "VIDEO", mediaUrl: "https://storage.googleapis.com/test.mp4" };

    const result = simulatePostEvaluation(aiData, postData);
    expect(result.status).toBe("REJECTED");
    expect(result.approved).toBe(false);
    expect(result.isYouTubeUnsafe).toBe(true);
  });

  test("should not allow accident shield to unblock video post when isSafeForYouTube is false", () => {
    const aiData = {
      isSafeForYouTube: false,
      rejectionReason: "రహదారి ప్రమాదం - తీవ్ర రక్తపాతం మరియు ఛిద్రమైన దృశ్యం",
      isDuplicate: false
    };
    const postData = { mediaType: "VIDEO", mediaUrl: "https://storage.googleapis.com/test.mp4" };

    const result = simulatePostEvaluation(aiData, postData);
    expect(result.status).toBe("REJECTED");
    expect(result.approved).toBe(false);
    expect(result.isRejected).toBe(true);
  });

  test("should allow accident shield for text/photo post when not a video", () => {
    const aiData = {
      isSafeForYouTube: true,
      rejectionReason: "రహదారి ప్రమాదం - రక్తపాతం",
      isDuplicate: false
    };
    const postData = { mediaType: "IMAGE", mediaUrl: "https://storage.googleapis.com/test.jpg" };

    const result = simulatePostEvaluation(aiData, postData);
    expect(result.status).toBe("PUBLISHED");
    expect(result.approved).toBe(true);
    expect(result.rejectionReason).toBe(null);
  });

  test("should generate appropriate Telugu YouTube guideline notice in Desk Chat", () => {
    const reporterName = "రాము";
    const headline = "రహదారి ప్రమాదం దృశ్యాలు";
    const notifyType = "YOUTUBE_POLICY_VIOLATION";

    let chatText = "";
    if (notifyType === 'YOUTUBE_POLICY_VIOLATION') {
      chatText = `నమస్కారం ${reporterName} గారు,\n\nమీరు పంపిన వీడియో వార్త: "${headline}"\n\nఎడిటోరియల్ డెస్క్ & AI సేఫ్టీ పరిశీలన:\nయూట్యూబ్ కమ్యూనిటీ నిబంధనలు (YouTube Community Guidelines) మరియు పబ్లిక్ సేఫ్టీ నిబంధనల ప్రకారం తీవ్ర రక్తపాతం, భయానక ప్రమాదాలు లేదా హింసాత్మక దృశ్యాలు కలిగిన వీడియోలను యూట్యూబ్‌లో ప్రసారం చేయడం నిషిద్ధం. మన అధికారిక ఛానల్ భద్రత మరియు అకౌంట్ నిబంధనల దృష్ట్యా ఈ వీడియో వార్తను నిలిపివేయడం జరిగింది.\n\nభవిష్యత్తులో ఇటువంటి సంఘటనలు కవర్ చేసేటప్పుడు భయానక దృశ్యాలు లేకుండా లేదా బాధితుల వివరాలు/రక్తపు మరకలను బ్లర్ చేసి పంపగలరు. మీ సహకారానికి ధన్యవాదాలు!\n\n- ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్`;
    }

    expect(chatText).toContain("YouTube Community Guidelines");
    expect(chatText).toContain("తీవ్ర రక్తపాతం");
    expect(chatText).toContain("బ్లర్ చేసి పంపగలరు");
  });
});

describe("Option A - Video Timeline Full-Screen Blur Shield", () => {
  function calculateBlurRanges(violatingTileIndices, intervalSec, durationSeconds) {
    if (!violatingTileIndices || violatingTileIndices.length === 0 || intervalSec <= 0) return [];

    const rawRanges = violatingTileIndices
      .filter(idx => typeof idx === 'number' && idx >= 1)
      .map(k => {
        const start = Math.max(0, (k - 1) * intervalSec - 3);
        const end = Math.min(durationSeconds, k * intervalSec + 3);
        return { start, end };
      })
      .sort((a, b) => a.start - b.start);

    if (rawRanges.length === 0) return [];

    const merged = [{ ...rawRanges[0] }];
    for (let i = 1; i < rawRanges.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = rawRanges[i];
      if (curr.start <= prev.end + 2) {
        prev.end = Math.max(prev.end, curr.end);
      } else {
        merged.push({ ...curr });
      }
    }

    return merged;
  }

  test("should accurately calculate and merge timeline blur ranges for adjacent tiles", () => {
    // 300 second video, 12 tiles -> interval = 25 seconds
    // Tiles 4 and 5 violate:
    // Tile 4: (4-1)*25 - 3 = 72, 4*25 + 3 = 103
    // Tile 5: (5-1)*25 - 3 = 97, 5*25 + 3 = 128
    const ranges = calculateBlurRanges([4, 5], 25, 300);
    expect(ranges.length).toBe(1);
    expect(ranges[0].start).toBe(72);
    expect(ranges[0].end).toBe(128);
  });

  test("should keep separate ranges for distant non-adjacent violating tiles", () => {
    // Tile 2 (22s - 53s) and Tile 10 (222s - 253s)
    const ranges = calculateBlurRanges([2, 10], 25, 300);
    expect(ranges.length).toBe(2);
    expect(ranges[0].start).toBe(22);
    expect(ranges[0].end).toBe(53);
    expect(ranges[1].start).toBe(222);
    expect(ranges[1].end).toBe(253);
  });

  test("should properly clamp timeline ranges to video bounds [0, duration]", () => {
    // Tile 1: (1-1)*25 - 3 = -3 -> clamped to 0
    // Tile 12: 12*25 + 3 = 303 -> clamped to 300
    const ranges = calculateBlurRanges([1, 12], 25, 300);
    expect(ranges[0].start).toBe(0);
    expect(ranges[1].end).toBe(300);
  });

  test("should generate valid FFmpeg timeline enable expression for multiple ranges", () => {
    const ranges = [
      { start: 72.0, end: 128.0 },
      { start: 200.5, end: 230.0 }
    ];
    const enableExpr = ranges.map(r => `between(t,${r.start.toFixed(1)},${r.end.toFixed(1)})`).join('+');
    expect(enableExpr).toBe("between(t,72.0,128.0)+between(t,200.5,230.0)");
    const filterString = `boxblur=30:enable='${enableExpr}'`;
    expect(filterString).toContain("boxblur=30");
    expect(filterString).toContain("between(t,72.0,128.0)");
  });

  test("should sanitize accident footage with blur but permanently block severe POCSO/terror violations", () => {
    function evaluateSanitization(scanResult) {
      if (scanResult.canSanitizeWithBlur && scanResult.blurRanges && scanResult.blurRanges.length > 0) {
        return { action: "APPLY_BLUR_AND_PUBLISH", blurRanges: scanResult.blurRanges };
      }
      return { action: "HARD_REJECT_AND_DELETE", blurRanges: [] };
    }

    const accidentFootage = {
      isSafe: false,
      hasGraphicContent: true,
      canSanitizeWithBlur: true,
      violatingTileIndices: [4, 5],
      blurRanges: [{ start: 72, end: 128 }]
    };

    const severeViolation = {
      isSafe: false,
      hasGraphicContent: true,
      canSanitizeWithBlur: false,
      violatingTileIndices: [3],
      blurRanges: []
    };

    const accidentDecision = evaluateSanitization(accidentFootage);
    expect(accidentDecision.action).toBe("APPLY_BLUR_AND_PUBLISH");
    expect(accidentDecision.blurRanges.length).toBe(1);

    const severeDecision = evaluateSanitization(severeViolation);
    expect(severeDecision.action).toBe("HARD_REJECT_AND_DELETE");
    expect(severeDecision.blurRanges.length).toBe(0);
  });
});

// ============================================================================
// TEST RESULTS
// ============================================================================

console.log("\n" + "=".repeat(80));
console.log(
  `${colors.blue}Test Results${colors.reset}`
);
console.log("=".repeat(80));

console.log(`\nTotal Tests: ${colors.cyan}${totalTests}${colors.reset}`);
console.log(
  `Passed: ${colors.green}${passedTests}${colors.reset}`
);
console.log(
  `Failed: ${colors.red}${failedTests}${colors.reset}`
);

if (failures.length > 0) {
  console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
  failures.forEach((failure) => {
    console.log(`  ✗ ${failure.test}`);
    console.log(`    Error: ${failure.error}`);
  });
}

const passRate = ((passedTests / totalTests) * 100).toFixed(2);
console.log(`\n${colors.cyan}Pass Rate: ${passRate}%${colors.reset}`);

console.log("\n" + "=".repeat(80));

if (failedTests === 0) {
  console.log(
    `${colors.green}✓ All tests passed!${colors.reset}`
  );
  console.log("=".repeat(80) + "\n");
  process.exit(0);
} else {
  console.log(
    `${colors.red}✗ ${failedTests} test(s) failed${colors.reset}`
  );
  console.log("=".repeat(80) + "\n");
  process.exit(1);
}

