# Task List - Cost Optimization

- [x] **Phase 1: Android App - Batch News View Tracking**
    - [x] Locate and read `AnalyticsService.kt`
    - [x] Implement in-memory buffering for `longViews`
    - [x] Add periodic sync logic (WorkManager or simple Coroutine delay)
- [x] **Phase 2: Cloud Functions - Optimized Weather Alerts**
    - [x] Modify `auto_content_handler.ts` to use FCM Topics
    - [x] Update topic naming logic to match `utils.ts`
- [x] **Phase 3: Cloud Functions - Trigger Guard for View Milestones**
    - [x] Optimize `onNewsViewCountUpdated` in `reporter_handler.ts` to minimize execution time
- [x] **Phase 4: Security Rules Optimization**
    - [x] Review and update `storage.rules` to reduce Firestore lookups (Verified reads are already public/free)
- [x] **Verification**
    - [x] Verify build and dry-run functions
