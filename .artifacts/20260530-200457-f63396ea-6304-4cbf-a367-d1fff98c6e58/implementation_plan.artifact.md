# Implementation Plan - Removing Obstacles for Reporter Submissions

The goal is to ensure that news stories submitted by reporters are always published and visible in the feed, as requested by the user. Currently, several "obstacles" prevent this: AI rejection for "personal" content, latency while waiting for AI processing, forced categorization to "District News", and app-side filtering that hides district news from users in other districts.

## User Review Required

- **Immediate Visibility**: Reporter news will be visible immediately upon submission with the raw text provided by the reporter. It will be updated with AI-enhanced text a few seconds later.
- **Bypassing AI Rejection**: Reporter submissions will bypass AI-based "rejection" (e.g., for being personal or greetings). This assumes reporters are trusted to post appropriate content. As per user feedback, **AI Rejection will now only apply to Citizen Journalism.**
- **Global Visibility**: Reporter news will be exempt from the "District News" filter in the app, making it visible to all users regardless of their selected district.

## Proposed Changes

### Backend (Cloud Functions)

#### [index.ts](file:///C:/AlfaKotlin/functions/src/index.ts)

- **`processReporterSubmission`**: Set `approved: true` and `status: "published"` immediately upon creation/update.
- **`onNewsPostWritten`**:
    - If `isReporter` is true, ensure `approved` is ALWAYS set to `true` (or remains `true`).
    - If AI rejections (`rejectionReason`) occur, still set `approved: true` for reporter posts.
    - If AI processing fails, set `approved: true` for reporter posts using raw data.
- **`performAIProcessing`**:
    - Remove the hardcoded override that forces reporter news into the "జిల్లా వార్త" (District News) category.
    - Allow the AI (or reporter) to determine the best category naturally.

---

### Android App

#### [NewsPost.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/models/NewsPost.kt)

- Add `isReporter: Boolean = false` to the `NewsPost` data class to facilitate filtering.

#### [NewsFeedViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt)

- **`mapDocumentToNewsPost`**: Map the `isReporter` field from the Firestore document to the `NewsPost` object.
- **`rankAndBlendPosts`**: Exempt reporter posts (where `isReporter == true`) from the filter that hides "District News" from users in other districts.

---

## Verification Plan

### Automated Tests
- Update `functions/src/processReporterSubmission.test.ts` to reflect the new logic (immediate approval, non-forced categories).
- Run existing tests:
  ```bash
  cd functions
  npm test
  ```

### Manual Verification
- **Submission Flow**:
    1. Submit a reporter news post via the app.
    2. Verify it appears in the feed immediately (even before AI processing finishes).
    3. Verify it stays visible even if it contains "personal" content that AI might otherwise reject.
- **Feed Visibility**:
    1. Post a district news item as a reporter.
    2. Verify it is visible to users who have a *different* district selected or no district selected.
- **Log Inspection**:
    1. Check Cloud Function logs to ensure `onNewsPostWritten` correctly handles reporter posts without setting `approved: false`.
