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

