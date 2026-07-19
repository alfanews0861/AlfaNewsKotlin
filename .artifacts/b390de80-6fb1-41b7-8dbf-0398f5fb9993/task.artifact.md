# Task: Fix Reporter Post Stats (Optimized)

- [x] Update Firestore Indexes (add `isReporter`+`approved`+`timestamp` index)
- [x] Refactor `ReportersViewModel.kt`:
    - [x] Update `fetchReportersForStats` to fetch all recent news in one batch.
    - [x] Implement in-memory grouping and counting.
    - [x] Ensure robust handling of mixed timestamp types (Long vs Timestamp).
- [x] Verification
