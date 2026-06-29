# Tasks: Cloud Storage & Gemini Cost Optimization

- [x] **Backend: Cleanup and Redundancy Fixes**
    - [x] Implement `deleteOriginalFile` helper in `news_handler.ts`
    - [x] Update `onNewsPostCreated` to delete files after YouTube upload
    - [x] Add atomic locking logic to prevent concurrent processing
    - [x] Refine state machine to skip processed/processing documents
- [x] **Android: Egress Optimization**
    - [x] Modify `VideoPlayerView.kt` to delay `prepare()` until `autoPlay` is true
    - [x] Update `NewsCardView.kt` to pass the correct visibility signal
- [x] **Backend: Fix 60-day Cleanup Function**
    - [x] Remove `mediaDeleted` index-breaking filter from query in `auto_content_handler.ts`
    - [x] Implement in-memory filtering for `mediaDeleted`
    - [x] Improve URL to file path parsing
- [ ] **Verification**
    - [ ] Verify logs for single-execution of AI/Video tasks
    - [ ] Verify file deletion in Storage after processing
    - [ ] Verify cleanup function handles backlog of old files
