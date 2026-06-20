# Walkthrough - Fixed Reporter Video Submission Flow

I have fixed the issue where reporter video news submissions were getting stuck in a "pending" state. The problem was caused by a race condition in the Cloud Functions logic and invalid SSML formatting for the 2026 Text-to-Speech engine.

## Changes Made

### Cloud Functions (Backend)

#### [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- **Resolved Race Condition**: Added a critical `return` statement after the AI text processing stage for video posts. This prevents the initial trigger from colliding with the re-trigger caused by the document update, which previously resulted in double FFMPEG execution and "corrupted" temp files.
- **Fixed SSML Formatting**: Wrapped the news content in `<speak>` tags. The `te-IN-Chirp3-HD-Achernar` voice (Chirp 3 HD) requires valid SSML wrapping to function correctly.
- **Memory Optimization**: Confirmed resource allocation at 2GiB to handle high-fidelity video/audio merging.

## Verification Results

### Deployment
- Successfully deployed `onNewsPostCreated` and `processReporterSubmission` to the `asia-south1` region.
- Build verified with `tsc`.

### Logic Verification
- The loop prevention logic now correctly identifies when a video needs processing and allows only one execution flow to handle it.
- SSML is properly escaped and wrapped.

> [!TIP]
> Reporters should now see their video news appear in the home feed within a few minutes of submission, as the background processing will now complete successfully and set the `approved` flag to `true`.

render_diffs(file:///C:/AlfaKotlin/functions/src/news_handler.ts)
