# Walkthrough - Gemini API Fallback (3-Key Strategy)

I have implemented a robust fallback mechanism for Gemini API calls in Cloud Functions. This ensures that the system stays operational even if individual API keys hit their rate limits or encounter billing issues, while prioritizing free tier usage to save costs.

## Key Changes

### Centralized Fallback Logic
- **[utils.ts](file:///C:/AlfaKotlin/functions/src/utils.ts)**:
    - Added `runWithAIFallback<T>`: A high-order function that wraps AI operations.
    - **Priority Order**:
        1. `FREE_GEMINI_API_KEY_1`
        2. `FREE_GEMINI_API_KEY_2`
        3. `PAID_GEMINI_API_KEY`
    - It automatically detects `429` (Rate Limit) errors and quota-related failures, then transparently retries with the next available key.

### Refactored AI Entry Points
- **[geminiService.ts](file:///C:/AlfaKotlin/functions/src/geminiService.ts)**: All text processing (Social, Citizen, Editor) now uses the fallback wrapper.
- **[auto_content_handler.ts](file:///C:/AlfaKotlin/functions/src/auto_content_handler.ts)**: Scheduled tasks (Festival Greetings, Quotes, History, Cartoons) are now protected by the fallback logic.
- **[news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)**: The primary news enhancement logic (`performAIProcessing`) now supports multi-key fallback.
- **[utils.ts](file:///C:/AlfaKotlin/functions/src/utils.ts)**: `generateImageWithRetry` now also benefits from the same fallback strategy.

## Verification Results

### Build & Compilation
- **Success**: `npm run build` completed without errors, confirming all TypeScript changes are valid.
- **Consistency**: All major AI flows in the backend are now using this unified strategy.

> [!IMPORTANT]
> **Next Steps for User**:
> 1. Create a `functions/.env` file.
> 2. Add your 3 keys as follows:
>    ```env
>    FREE_GEMINI_API_KEY_1="your_key_1"
>    FREE_GEMINI_API_KEY_2="your_key_2"
>    PAID_GEMINI_API_KEY="your_key_3"
>    ```
> 3. Deploy the changes: `firebase deploy --only functions`.

### Monitoring
You can monitor the fallback behavior in your Firebase logs. Look for the `[AI-FALLBACK]` warning prefix, which will tell you when a key switch occurs and why.
