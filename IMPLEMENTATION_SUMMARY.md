# AI Processing for Reporter News Submissions - Implementation Summary

## Problem Statement
Reporter news submissions were not being processed through AI in the same way as citizen posts. The system needed to ensure that when reporters submit news, it goes through the same AI enhancement pipeline as citizen submissions.

## Solution Overview
Implemented a dedicated AI processing pipeline for reporter submissions with proper flagging and differentiation between citizen and reporter posts.

## Changes Made

### 1. Firebase Cloud Functions (`functions/src/index.ts`)

#### A. Enhanced `processNewsPost` Function (Lines 411-506)
- **Purpose**: Main function for processing both citizen and reporter submissions
- **Improvements**:
  - Added `isCitizen` and `isReporter` flags to properly categorize submissions
  - Added `aiProcessedAt` timestamp to track when AI processing occurred
  - Ensures proper reporter preservation for reporter posts
  - Added documentation explaining both citizen and reporter processing

**Key Fields Added to Output**:
```typescript
isCitizen: actualPostData?.isCitizen || false,
isReporter: actualPostData?.isReporter || false,
aiProcessed: true,
aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
```

#### B. New `processReporterSubmission` Function (Lines 508-604)
- **Purpose**: Dedicated function explicitly for processing reporter news submissions
- **Features**:
  - Uses the same PRO_MODEL (gemini-3-flash-preview) for high-quality output
  - Distinct system instruction optimized for editor workflow: "You are a Senior Editor processing a reporter's news submission. Enhance and refine the 70-word Telugu article."
  - Always sets `isReporter: true` and `isCitizen: false`
  - Preserves reporter information during processing
  - Adds `processingType: "REPORTER_SUBMISSION"` for tracking
  - Maintains consistency with citizen post processing while being explicitly tailored for reporters

**System Instruction Differences**:
- `processNewsPost`: "You are a Senior Journalist. Write 70 words in Telugu."
- `processReporterSubmission`: "You are a Senior Editor processing a reporter's news submission. Enhance and refine the 70-word Telugu article."

### 2. Android App Updates

#### A. PostNewsPageView.kt (Reporter Submission UI)
**Location**: `app/src/main/java/com/alfanews/telugu/views/PostNewsPageView.kt`

**Changes**:
- Added `isReporter` flag set to `true`
- Added `isCitizen` flag set to `false`
- Changed function call from `processNewsPost()` to `processReporterSubmission()`
- Added flags to postData:
  ```kotlin
  "isReporter" to true,
  "isCitizen" to false,
  ```

**Function Call Update**:
```kotlin
// OLD: FirebaseFunctionsService.processNewsPost(...)
// NEW: FirebaseFunctionsService.processReporterSubmission(...)
```

#### B. CitizenPostPageView.kt (Citizen Submission UI)
**Location**: `app/src/main/java/com/alfanews/telugu/views/CitizenPostPageView.kt`

**Changes**:
- Added explicit `isReporter` flag set to `false`
- Ensured `isCitizen` flag remains `true`
- Maintains existing `processNewsPost()` call for citizen submissions
- Added flag to newsData:
  ```kotlin
  "isReporter" to false,
  ```

### 3. Firebase Functions Service Update
**Location**: `app/src/main/java/com/alfanews/telugu/services/FirebaseFunctionsService.kt`

**Changes**:
- Added new `processReporterSubmission()` suspend function
- Mirrors `processNewsPost()` signature for consistency
- Properly routes to the cloud function `processReporterSubmission`

**New Function**:
```kotlin
suspend fun processReporterSubmission(
    postId: String? = null,
    headline: String? = null,
    content: String? = null,
    postData: Map<String, Any>? = null
): Result<Map<String, Any>>
```

## Processing Flow

### Reporter Submission Flow
1. Reporter fills out PostNewsPageView with headline, content, media
2. Clicks "Publish News" button
3. Media is uploaded to Firebase Storage
4. Post data is prepared with `isReporter: true` and `isCitizen: false`
5. **processReporterSubmission()** is called (Cloud Function)
6. AI processes the submission with editor-focused instruction
7. Enhanced headline and content are saved to Firestore
8. Post is marked with `aiProcessed: true` and timestamp

### Citizen Submission Flow
1. Citizen fills out CitizenPostPageView with content, media
2. Clicks "Submit" button
3. Media is uploaded to Firebase Storage
4. Post data is prepared with `isCitizen: true` and `isReporter: false`
5. **processNewsPost()** is called (Cloud Function)
6. AI processes the submission with journalist instruction
7. Enhanced headline and content are saved to Firestore
8. Post is marked with `aiProcessed: true` and timestamp

## Data Structure

### Reporter Post Object (Firestore)
```json
{
  "headline": {"telugu": "...", "english": "..."},
  "content": {"telugu": "...", "english": "..."},
  "mediaUrl": "...",
  "reporter": {"id": "...", "name": "..."},
  "isReporter": true,
  "isCitizen": false,
  "aiProcessed": true,
  "aiProcessedAt": "timestamp",
  "processingType": "REPORTER_SUBMISSION",
  "category": "...",
  "district": "...",
  "state": "...",
  "storyFingerprint": "...",
  "timestamp": "...",
  "lastUpdated": "..."
}
```

### Citizen Post Object (Firestore)
```json
{
  "headline": {"telugu": "...", "english": "..."},
  "content": {"telugu": "...", "english": "..."},
  "mediaUrl": "...",
  "reporter": {"id": "...", "name": "..."},
  "isCitizen": true,
  "isReporter": false,
  "aiProcessed": true,
  "aiProcessedAt": "timestamp",
  "category": "జనరల్",
  "district": "...",
  "state": "...",
  "timestamp": "...",
  "lastUpdated": "..."
}
```

## Benefits

1. **Proper Differentiation**: Posts are now clearly marked as either citizen or reporter submissions
2. **Optimized Processing**: Reporter submissions get editor-focused AI instructions
3. **Audit Trail**: `processingType` and `aiProcessedAt` fields provide tracking
4. **Consistency**: Both flows use the same high-quality PRO_MODEL (Gemini-3-Flash)
5. **Quality Improvement**: All reporter submissions now go through AI enhancement
6. **Scalability**: Dedicated functions allow for future optimization specific to each submission type

## Testing Checklist

- [ ] Reporter can submit news via PostNewsPageView
- [ ] AI processing is triggered automatically
- [ ] Post appears in feed with enhanced content
- [ ] `isReporter: true` flag is set in Firestore
- [ ] Citizen can still submit via CitizenPostPageView
- [ ] `isCitizen: true` flag is set in Firestore
- [ ] Both posts show appropriate processing metadata
- [ ] Cloud functions compile without errors
- [ ] Mobile app compiles without errors
- [ ] No breaking changes to existing functionality

## Notes

- All timestamps use IST (Asia/Kolkata) timezone
- Both functions use `PRO_MODEL` (gemini-3-flash-preview) for quality
- Image optimization happens automatically for media URLs
- Story fingerprint is generated for duplicate detection
- Categories are automatically refined based on content

