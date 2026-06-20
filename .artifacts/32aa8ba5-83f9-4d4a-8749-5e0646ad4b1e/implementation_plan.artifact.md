# AI Reliability Improvement Plan

The goal is to ensure that news posts are **always** successfully processed by AI without failures (specifically JSON syntax errors), ensuring high-quality, enhanced content is always delivered.

## User Review Required

> [!IMPORTANT]
> - I will continue using the `gemini-3.1-flash` model family as confirmed.
> - I will implement stricter prompting and response handling to eliminate "Raw Text" responses from the AI.

## Proposed Changes

### Backend (Cloud Functions)

#### [MODIFY] [categories.ts](file:///C:/AlfaKotlin/functions/src/categories.ts)
- **Prompt Optimization**: Refactor `getCategorySystemInstruction` to be more concise and emphasize the JSON structure. Remove redundant wording that might cause the model to deviate into conversational output.
- **Strict Constraints**: Add explicit rules to prevent the inclusion of introductory text (e.g., "Here is the news in JSON:") which often breaks parsing.

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- **Prompt Reinforcement**: Add a "STRICT JSON ONLY" wrapper to the user prompt in `performAIProcessing`.
- **Validation**: Ensure that if the AI returns invalid data despite retries, we log the exact nature of the failure for debugging while keeping the post un-published.

#### [MODIFY] [utils.ts](file:///C:/AlfaKotlin/functions/src/utils.ts)
- **Model Hierarchy**: Ensure `gemini-3.1-flash` is the primary model across all keys.

---

## Verification Plan

### Automated Tests
- Build the project to ensure no regressions in TypeScript logic.
  ```bash
  cd functions
  npm run build
  ```

### Manual Verification
1. Submit test posts with complex or potentially confusing content.
2. Monitor logs to confirm that `gemini-3.1-flash` is responding with valid JSON on the first attempt.
3. Verify that the "JSON parse error" seen previously is eliminated.
