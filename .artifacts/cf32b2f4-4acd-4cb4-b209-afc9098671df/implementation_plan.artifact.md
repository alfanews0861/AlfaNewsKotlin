# Implementation Plan - Update Gemini Models to 3.1 Flash

The user has switched Gemini models from version 3.5 Flash to 3.1 Flash. While these version numbers (3.5, 3.1) appear to be project-specific or future-dated placeholders (as official Gemini versions are currently 1.5), they are consistently used across the codebase and documentation. I will update all remaining occurrences of `gemini-3.5-flash` to `gemini-3.1-flash` to ensure consistency.

## User Review Required

> [!IMPORTANT]
> - The Android app's `FestivalGreetingWorker` is currently using `imagen-4.0-generate-001` for image generation. I will update its text model to `gemini-3.1-flash` but I need to know if the image model should also be "downgraded" to `gemini-3.1-flash-image` to match the backend's `utils.ts`.
> - I will update the documentation files to reflect the new model version.

## Proposed Changes

### Android App

#### [MODIFY] [FestivalGreetingWorker.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/workers/FestivalGreetingWorker.kt)
- Update `modelName` from `gemini-3.5-flash` to `gemini-3.1-flash`.

### Cloud Functions

#### [MODIFY] [test_latest_models.js](file:///C:/AlfaKotlin/functions/test_latest_models.js)
- Update model list to include `gemini-3.1-flash`.

#### [MODIFY] [test_models.js](file:///C:/AlfaKotlin/functions/test_models.js)
- Update model list.

#### [MODIFY] [test_trending_news.js](file:///C:/AlfaKotlin/functions/test_trending_news.js)
- Update model used in trending news tests.

### Documentation

#### [MODIFY] [CHANGES_SUMMARY.md](file:///C:/AlfaKotlin/CHANGES_SUMMARY.md)
#### [MODIFY] [IMPLEMENTATION_SUMMARY.md](file:///C:/AlfaKotlin/IMPLEMENTATION_SUMMARY.md)
#### [MODIFY] [PROCESSING_FLOW_DIAGRAM.md](file:///C:/AlfaKotlin/PROCESSING_FLOW_DIAGRAM.md)
#### [MODIFY] [QUICK_START_GUIDE.md](file:///C:/AlfaKotlin/QUICK_START_GUIDE.md)
#### [MODIFY] [README_REPORTER_AI_PROCESSING.md](file:///C:/AlfaKotlin/README_REPORTER_AI_PROCESSING.md)

## Verification Plan

### Automated Tests
- Run `npm run build` in `functions/` to ensure `lib/utils.js` is updated from `src/utils.ts`.
- Run `gradlew :app:assembleDebug` to verify the Android app still builds.

### Manual Verification
- Verify that no occurrences of `gemini-3.5-flash` remain in the project (except for artifacts/logs).
