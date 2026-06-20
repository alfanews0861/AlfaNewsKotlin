# Walkthrough: Image Generation Model Update

I have updated the image generation model from Imagen to `gemini-3.1-flash-image` across the backend functions.

## Changes Made

### Backend (Functions)

#### [utils.ts](file:///C:/AlfaKotlin/functions/src/utils.ts)
- Updated `IMAGEN_MODEL` and `IMAGEN_FAST_MODEL` constants to `"gemini-3.1-flash-image"`.
- Simplified the `modelsToTry` array in `generateImageWithRetry` to focus on the new model.

## Verification Results

### Build
- Successfully built the functions using `npm run build`.

### Deployment
- Triggered `firebase deploy --only functions`.
- **Status**: Partial success.
    - Many core functions (like `processNewsPost`, `generateDailyCartoon`, `processReporterSubmission`) were successfully deployed.
    - Two functions (`onNewsPostCreated` and `scheduleHistoryOfTheDay`) failed to deploy due to a GCP Quota limit: `Quota exceeded for total allowable CPU per project per region.`

> [!WARNING]
> Your GCP project `alfa-news-31bf7` has reached its CPU quota for the `asia-south1` region. You may need to increase your quota or wait for some resources to be released before these two specific functions can be fully updated. However, the model change is already committed to your source code.
