# Implementation Plan: Fix Reporter News Processing (onNewsPostCreated)

The user reports that reporter news submissions are failing. Logs confirm that the `onNewsPostCreated` function is hitting an "Unknown name: systemInstruction" error. This is because the function is still running on a previous "broken" deployment (using API version v1) and failed to update when I reverted to v1beta due to a CPU quota issue.

## User Review Required

> [!IMPORTANT]
> I am reducing the memory of the `onNewsPostCreated` function from **4GiB to 1GiB**. This is necessary to satisfy the Google Cloud CPU quota and allow the function to finally deploy with the fixed code (v1beta).

## Proposed Changes

### Backend (Functions)

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- Update `onNewsPostCreated` configuration:
    - Change `memory: "4GiB"` to `memory: "1GiB"`.

## Verification Plan

### Automated Tests
- Build check: `cd functions && npm run build`.

### Manual Verification
- Deploy the function: `npx firebase deploy --only functions:onNewsPostCreated`.
- Trigger a test reporter submission and check logs for successful AI processing.
