# Implementation Plan - Final AI Stability & Cost Optimization

To resolve the persistent `503 Service Unavailable` errors and address the high ingress/egress concerns, I am implementing a "Success-First" architecture. This plan introduces exponential backoff to handle high-demand spikes and ensures we don't accidentally loop or re-download data.

## User Review Required

> [!IMPORTANT]
> **Exponential Backoff**: If Gemini is busy, the code will now wait (1s, 2s, 4s) before retrying the same model. This significantly increases success rates on the Free Tier.
> **Cost Guard**: I am adding a specific check to ensure we never download a video or perform AI processing if it was already attempted recently, preventing redundant network costs.

## Proposed Changes

### Backend (Cloud Functions)

#### [MODIFY] [utils.ts](file:///C:/AlfaKotlin/functions/src/utils.ts)
- **Exponential Backoff**: Integrate a retry loop *inside* `runWithAIFallback`.
- **Standardized SDK Usage**: Update to use `ai.getGenerativeModel().generateContent()` which is the stable production path for June 2026.
- **Model Re-ordering**: Prioritize `gemini-3.5-flash`, then `gemini-3.1-flash`, then `gemini-3.1-pro`.

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- **Deep Guard**: Enhanced check at the start of `onNewsPostCreated` to verify `aiProcessed` and `status` to prevent any possibility of document update loops.
- **Improved Logging**: Logs will now show exactly which retry attempt succeeded.

## Verification Plan

### Manual Verification
- Deploy: `cd functions && npm run build && firebase deploy --only functions`
- Monitor logs for `[RETRY]` messages.
- Verify that a news post moves from `PENDING` to `published` even if the first AI attempt fails.
