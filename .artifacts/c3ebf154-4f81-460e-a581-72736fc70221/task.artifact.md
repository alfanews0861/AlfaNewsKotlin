# Task List - Cost Optimization

- [ ] **Phase 1: Android App - Batch News View Tracking**
    - [ ] Locate and read `AnalyticsService.kt`
    - [ ] Implement in-memory buffering for `longViews`
    - [ ] Add periodic sync logic (WorkManager or simple Coroutine delay)
- [ ] **Phase 2: Cloud Functions - Optimized Weather Alerts**
    - [ ] Modify `auto_content_handler.ts` to use FCM Topics
    - [ ] Update topic naming logic to match `utils.ts`
- [ ] **Phase 3: Cloud Functions - Trigger Guard for View Milestones**
    - [ ] Optimize `onNewsViewCountUpdated` in `reporter_handler.ts` to minimize execution time
- [ ] **Phase 4: Security Rules Optimization**
    - [ ] Review and update `storage.rules` to reduce Firestore lookups
- [ ] **Verification**
    - [ ] Verify build and dry-run functions
