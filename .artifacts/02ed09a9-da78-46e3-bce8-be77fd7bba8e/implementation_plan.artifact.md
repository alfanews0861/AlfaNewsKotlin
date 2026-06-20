# Implementation Plan: Update Image Generation Models to Gemini 3.1 Flash Image

The user wants to update all image generation models in the backend functions to use `gemini-3.1-flash-image`. This involves updating the constants and the retry logic in `utils.ts`.

## User Review Required

> [!IMPORTANT]
> The model name `gemini-3.1-flash-image` will be applied to all image generation tasks. Ensure this model is available and supports the `generateImages` method in the current environment.

## Proposed Changes

### Backend (Functions)

#### [MODIFY] [utils.ts](file:///C:/AlfaKotlin/functions/src/utils.ts)

- Update `IMAGEN_MODEL` and `IMAGEN_FAST_MODEL` constants to `"gemini-3.1-flash-image"`.
- Update the `modelsToTry` array in `generateImageWithRetry` to use `gemini-3.1-flash-image` as the primary and fallback models.

## Verification Plan

### Automated Tests
- Since this is a model string change, automated unit tests might pass if they mock the AI response.
- A build check will be performed to ensure no syntax errors:
  ```bash
  cd functions && npm run build
  ```

### Manual Verification
- Deploy the updated function and trigger an image generation task (e.g., via a news post submission or automated news processing).
- Monitor logs for "[AI_IMAGE] Success with gemini-3.1-flash-image".
