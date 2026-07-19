# Implementation Plan - Fix Reporter Post Stats

Fix the "Today" and "Last Week" post counts in the Reporters management section by optimizing the data fetching logic and handling mixed timestamp types correctly.

## User Review Required

> [!IMPORTANT]
> - I will update the logic to count **only approved posts** (`approved: true`) by default, as this is standard for management metrics.
> - I will implement parallel fetching to significantly speed up the stats loading process.
> - The UI will now update incrementally as stats for each reporter are loaded, rather than waiting for the entire list to finish.

## Proposed Changes

### 1. Android App - `ReportersViewModel.kt`

#### [MODIFY] [ReportersViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/ReportersViewModel.kt)
- **Parallel Fetching**: Use Kotlin Coroutines (`async`/`awaitAll`) to fetch stats for all reporters in parallel.
- **Robust Timestamp Handling**:
    - Query using both `Timestamp` and `Long` formats to ensure all posts are counted regardless of how the timestamp was stored.
    - Merge results from both queries.
- **Incremental Updates**: Update the `_reporterStats` StateFlow inside the loop (or in small batches) so the UI shows progress.
- **Filtering**: Add `.whereEqualTo("approved", true)` to the query to ensure only verified news is counted.
- **Performance**: Limit the number of concurrent queries to avoid hitting Firestore limits or overwhelming the device.

### 2. Firestore Indexes

#### [MODIFY] [firestore.indexes.json](file:///C:/AlfaKotlin/firestore.indexes.json)
- Check if a composite index for `news` on `reporter.id` + `approved` + `timestamp` is needed. (The current index is `reporter.id` + `timestamp`).
- Since I'm adding `approved == true`, I will add the following index:
    - Collection: `news`
    - Fields: `reporter.id` (ASC), `approved` (ASC), `timestamp` (DESC)

## Verification Plan

### Manual Verification
1. **Open Reporter Management**: Go to the "Reporters" tab in the Admin panel.
2. **Observe Loading**: Verify that the post counts (Today/Week) start appearing one by one or in chunks, rather than staying at 0 for a long time.
3. **Verify Accuracy**:
    - Find a reporter who has posted today/this week.
    - Ensure their counts match the number of approved posts in the database.
4. **Mixed Data Test**: Ensure posts with both `Long` and `Timestamp` formats are correctly counted.
