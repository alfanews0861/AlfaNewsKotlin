# Code Changes Quick Reference

## 📌 All Changes at a Glance

### File 1: functions/src/index.ts

#### Change 1: Enhanced processNewsPost() function (Lines 411-506)
**What**: Added flags for proper categorization
**Lines**: 488-489, 491

```typescript
// ADD these fields to finalData:
isCitizen: actualPostData?.isCitizen || false,
isReporter: actualPostData?.isReporter || false,
aiProcessed: true,
aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
```

#### Change 2: New processReporterSubmission() function (Lines 508-604)
**What**: Dedicated function for reporter submissions
**Action**: Add entire new function after processNewsPost()

```typescript
export const processReporterSubmission = onCall(async (request) => {
    // ... [See IMPLEMENTATION_SUMMARY.md for full code]
    // Key differences from processNewsPost():
    // - System instruction: "You are a Senior Editor..."
    // - Always sets isReporter: true
    // - Always sets isCitizen: false
    // - Adds processingType: "REPORTER_SUBMISSION"
    // - Preserves reporter information
});
```

---

### File 2: app/src/main/java/com/alfanews/telugu/views/PostNewsPageView.kt

#### Change 1: Add flags to postData (Lines 135-136)
**What**: Mark reporter submissions explicitly
**Action**: Add two lines to hashMapOf

```kotlin
val postData = hashMapOf(
    // ... existing fields ...
    "isReporter" to true,        // ← ADD THIS
    "isCitizen" to false,        // ← ADD THIS
    "meta" to mapOf("location" to location),
    // ... rest of fields ...
)
```

#### Change 2: Change function call (Line 141)
**What**: Use new reporter-specific function
**Before**:
```kotlin
val result = FirebaseFunctionsService.processNewsPost(
    postId = postToEdit?.id,
    postData = postData
).getOrThrow()
```

**After**:
```kotlin
val result = FirebaseFunctionsService.processReporterSubmission(
    postId = postToEdit?.id,
    postData = postData
).getOrThrow()
```

---

### File 3: app/src/main/java/com/alfanews/telugu/views/CitizenPostPageView.kt

#### Change: Add explicit isReporter flag (Line 219)
**What**: Explicitly mark citizen submissions
**Action**: Add one line to newsData hashMapOf

```kotlin
val newsData = hashMapOf(
    "headline" to mapOf("telugu" to ..., "english" to ""),
    "content" to mapOf("telugu" to content, "english" to ""),
    // ... existing fields ...
    "isCitizen" to true,
    "isReporter" to false,       // ← ADD THIS
    "userConfirmed" to true
)
```

---

### File 4: app/src/main/java/com/alfanews/telugu/services/FirebaseFunctionsService.kt

#### Change: Add new function (After Line 58)
**What**: Add function to call new cloud function
**Action**: Add entire new suspend function

```kotlin
suspend fun processReporterSubmission(
    postId: String? = null,
    headline: String? = null,
    content: String? = null,
    postData: Map<String, Any>? = null
): Result<Map<String, Any>> {
    val data = mutableMapOf<String, Any>()
    postId?.let { data["postId"] = it }
    headline?.let { data["headline"] = it }
    content?.let { data["content"] = it }
    postData?.let { data["postData"] = it }
    
    return callFunction("processReporterSubmission", data)
}
```

---

## 📋 Summary of Changes

| File | Type | Lines | Change |
|------|------|-------|--------|
| index.ts | Enhanced | 488-491 | Added flags to processNewsPost() |
| index.ts | New | 508-604 | Added processReporterSubmission() |
| PostNewsPageView.kt | Modified | 135-136 | Added isReporter/isCitizen flags |
| PostNewsPageView.kt | Modified | 141 | Changed function call |
| CitizenPostPageView.kt | Modified | 219 | Added isReporter flag |
| FirebaseFunctionsService.kt | New | ~60 | Added processReporterSubmission() |

**Total Changes**: 6 locations across 4 files  
**Total Lines Added**: ~150 lines  
**Total Lines Modified**: ~10 lines  
**Breaking Changes**: NONE

---

## 🔄 Flow Changes

### Reporter Post Submission
```
OLD:
PostNewsPageView → processNewsPost() → Cloud Function processNewsPost()

NEW:
PostNewsPageView → processReporterSubmission() → Cloud Function processReporterSubmission()
```

### Citizen Post Submission
```
UNCHANGED:
CitizenPostPageView → processNewsPost() → Cloud Function processNewsPost()
```

---

## 🗂️ Data Changes

### Reporter Post
```
BEFORE:
{
  headline: { telugu: "...", english: "..." },
  content: { telugu: "...", english: "..." },
  reporter: { id, name }
}

AFTER:
{
  headline: { telugu: "...", english: "..." },
  content: { telugu: "...", english: "..." },
  reporter: { id, name },
  isReporter: true,           ← NEW
  isCitizen: false,           ← NEW
  aiProcessed: true,          ← ENHANCED
  aiProcessedAt: timestamp,   ← NEW
  processingType: "REPORTER_SUBMISSION" ← NEW
}
```

### Citizen Post
```
BEFORE:
{
  headline: { telugu: "...", english: "..." },
  content: { telugu: "...", english: "..." },
  reporter: { id, name },
  isCitizen: true
}

AFTER:
{
  headline: { telugu: "...", english: "..." },
  content: { telugu: "...", english: "..." },
  reporter: { id, name },
  isCitizen: true,
  isReporter: false,          ← NEW
  aiProcessed: true,          ← ENHANCED
  aiProcessedAt: timestamp    ← NEW
}
```

---

## 🧪 Testing Changes

### New Test Case 1: Reporter Submission
```
Given: Reporter submits news via PostNewsPageView
When: Data is sent to processReporterSubmission()
Then: Firestore document has isReporter: true
And: Firestore document has aiProcessed: true
And: processingType is "REPORTER_SUBMISSION"
```

### New Test Case 2: Citizen Submission
```
Given: Citizen submits news via CitizenPostPageView
When: Data is sent to processNewsPost()
Then: Firestore document has isCitizen: true
And: Firestore document has isReporter: false
And: Firestore document has aiProcessed: true
```

---

## 🚀 Deployment Changes

### Firebase Functions to Deploy
```bash
firebase deploy --only functions:processNewsPost,functions:processReporterSubmission
```

### Mobile App to Redeploy
```bash
./gradlew bundleRelease
# Upload to Play Store or Firebase App Distribution
```

---

## 🔍 Query Changes

### New Queries Available

**Get Reporter Posts Only**
```javascript
db.collection('news').where('isReporter', '==', true)
```

**Get Citizen Posts Only**
```javascript
db.collection('news').where('isCitizen', '==', true)
```

**Get Posts by Processing Type**
```javascript
db.collection('news').where('processingType', '==', 'REPORTER_SUBMISSION')
```

**Get Recently Processed Posts**
```javascript
db.collection('news')
  .where('aiProcessed', '==', true)
  .orderBy('aiProcessedAt', 'desc')
```

---

## ⚡ Performance Impact

- **No new API calls**: Uses same Gemini model
- **No additional latency**: Same processing time
- **No new dependencies**: Uses existing libraries
- **No database schema migration**: Fields are optional
- **No cost increase**: Same model, same usage

---

## 🛡️ Backward Compatibility

- ✅ Old posts continue to work
- ✅ New fields are optional
- ✅ Firestore rules unchanged
- ✅ Existing queries still work
- ✅ No breaking changes to API
- ✅ Can revert changes easily

---

## 📝 Firestore Security Rules

**No changes required**, but if you want to filter by type:

```javascript
// Allow reading all posts
match /news/{document=**} {
  allow read: if request.auth != null;
}

// Can also filter:
match /news/{document=**} {
  allow read: if request.auth != null;
  // Posts with isReporter=true
  allow write: if request.resource.data.isReporter == true 
               || request.resource.data.isCitizen == true;
}
```

---

## 🔐 Environment Variables

**No new environment variables added**

Ensure these still exist:
- `GEMINI_API_KEY`
- `API_KEY`
- `EMAIL_USER`
- `EMAIL_PASS`

---

## 📦 Deployment Artifacts

### Cloud Functions
- `functions/lib/index.js` (compiled)
- Will include processNewsPost() [enhanced]
- Will include processReporterSubmission() [new]

### Mobile App
- `app/build/outputs/apk/debug/app-debug.apk`
- `app/build/outputs/bundle/release/app-release.aab`

---

## ✨ Final Checklist

Before deployment:
- [ ] All code changes applied
- [ ] Firebase project selected
- [ ] Environment variables set
- [ ] Cloud functions built
- [ ] Mobile app built
- [ ] Tests passed
- [ ] Documentation reviewed

After deployment:
- [ ] Cloud functions deployed
- [ ] Mobile app updated
- [ ] Sample tests run
- [ ] Logs monitored
- [ ] Alerts set up
- [ ] Rollback plan ready

---

**Version**: 1.0  
**Date**: April 18, 2026  
**Status**: ✅ Ready to Deploy


