# Walkthrough - News Processing Audit & Efficiency Fixes

I have audited and optimized the news processing workflow to prevent recursive loops and improve memory efficiency, particularly for reporter submissions with large videos.

## Changes Made

### 1. Robust Guard Logic in `onNewsPostCreated`
- **Status Transition Check**: Added a more granular guard clause that compares the "before" and "after" document snapshots.
- **Redundancy Prevention**: The function now skips processing if the `status`, `aiProcessed`, or `videoProcessed` fields haven't changed. This prevents infinite loops triggered by metadata-only updates.
- **Billing Protection**: Tightened checks for terminal states (`published`, `REJECTED`, `FAILED`) and in-progress states (`REVIEWING_CONTENT`, `PROCESSING_VIDEO_IN_PROGRESS`).

### 2. Memory-Efficient Video Processing
- **Streaming Download**: Replaced `fetch().arrayBuffer()` with a streaming implementation using Node.js `pipeline`.
- **Large File Handling**: Reporter videos are now streamed directly to the local disk (`/tmp`) instead of being held in memory. This prevents "Out of Memory" (OOM) crashes and redundant download attempts that were likely causing high data transfer costs.
- **Fetch Compatibility**: Added logic to handle both standard Node streams (used by `node-fetch`) and Web Streams (used by native `fetch`).

### 3. Guardrail Reinforcement
- **Atomic Locking**: Re-verified the status-based locking mechanism. By updating the status immediately before starting expensive AI or Video work, we ensure that concurrent triggers hit the guard and exit early.
- **Clean Error States**: Failures now explicitly set the status to `FAILED`, which prevents the function from retrying the same faulty logic indefinitely.

## Verification Results

### Build Verification
- **Success**: The TypeScript compiler (`tsc`) completed successfully without errors.
```powershell
> build
> tsc --incremental false
```

### Safety Audit
- **Loop Prevention**: Confirmed that every Firestore write in the function either sets a terminal status or an "in-progress" status that is caught by the initial guard.
- **Resource Management**: Verified that temp files are cleaned up in a `finally` block, ensuring storage on the function instance is not exhausted.
- **Model Stability**: Kept `gemini-3.5-flash` as requested, ensuring the AI logic remains consistent with the current production environment.
