# Implementation Plan - Fix Gemini API Integration & Add 3.1 Flash Lite Fallback

The goal is to fix the Gemini API errors and implement a smart model fallback strategy. Since we are in June 2026 and you've confirmed `gemini-3.1-flash` is a working model, we will stick with it but add a fallback to `gemini-3.1-flash-lite` if the primary fails.

## User Review Required

> [!IMPORTANT]
> - We will use **`v1beta`** because the `v1` endpoint is currently rejecting `responseSchema` and `systemInstruction` fields (Error 400).
> - If `gemini-3.1-flash` still returns a 404 in `v1beta`, the system will automatically try **`gemini-3.1-flash-lite`**.
> - I will also include **`gemini-1.5-flash`** as a final safety fallback to ensure your news never stops processing.

## Proposed Changes

### Cloud Functions

#### [MODIFY] [utils.ts](file:///C:/AlfaKotlin/functions/src/utils.ts)
- Change `apiVersion` back to `"v1beta"`.
- Implement a model-level fallback inside `runWithAIFallback`.
- The logic will try: `gemini-3.1-flash` -> `gemini-3.1-flash-lite` -> `gemini-1.5-flash`.
- This will be nested inside the API Key fallback logic, creating a very resilient system.

#### [MODIFY] [geminiService.ts](file:///C:/AlfaKotlin/functions/src/geminiService.ts)
- Ensure the `PRIMARY_MODEL` constant is used, but allow the fallback logic in `utils.ts` to override it if needed.

## Verification Plan

### Automated Tests
- Run `npm run build` to verify the code structure.

### Manual Verification
- Deploy to Firebase.
- Monitor logs. If a model fails, you will see a log like: `[MODEL-FALLBACK] gemini-3.1-flash failed. Trying gemini-3.1-flash-lite...`
