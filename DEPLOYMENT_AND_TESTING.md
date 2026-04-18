# Deployment and Testing Guide

## Pre-Deployment Checklist

### Code Review
- [x] TypeScript compilation passes without errors
- [x] Kotlin compilation passes without errors
- [x] All imports are correct
- [x] Function signatures match between mobile app and cloud functions
- [x] No breaking changes to existing APIs
- [x] Documentation is updated

### Firebase Configuration
- [ ] Ensure Gemini API key is set in environment variables
- [ ] Verify Firestore rules allow write access to 'news' collection
- [ ] Check Cloud Functions deployment settings (memory: 2GB, timeout: 300s)
- [ ] Confirm region is set to 'asia-south1'

### Environment Variables Required
```
GEMINI_API_KEY=your_api_key_here
API_KEY=your_api_key_here
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

## Deployment Steps

### 1. Deploy Cloud Functions

```bash
# Navigate to functions directory
cd C:\AlfaKotlin\functions

# Install dependencies (if needed)
npm install

# Build TypeScript
npm run build

# Deploy to Firebase
firebase deploy --only functions:processNewsPost,functions:processReporterSubmission
```

**Expected Output**:
```
✔  Deploy complete!

Function URL (processNewsPost): https://asia-south1-your-project.cloudfunctions.net/processNewsPost
Function URL (processReporterSubmission): https://asia-south1-your-project.cloudfunctions.net/processReporterSubmission
```

### 2. Build and Deploy Mobile App

```bash
# Navigate to project root
cd C:\AlfaKotlin

# Build Android APK (debug for testing)
./gradlew assembleDebug

# Or build Release AAB
./gradlew bundleRelease

# Deploy to Firebase App Distribution or Play Store
firebase appdistribution:distribute app/build/outputs/apk/debug/app-debug.apk
```

## Testing Strategy

### Unit Testing - Cloud Functions

#### Test 1: Reporter Submission Processing
```typescript
// Mock request data
const mockRequest = {
  data: {
    postData: {
      headline: { telugu: "నయా ఆఎం నిర్ణయం" },
      content: { telugu: "ఆంధ్రప్రదేశ్ ప్రభుత్వం కొత్త విధానం ప్రకటించింది..." },
      mediaUrl: "https://firebase....",
      reporter: { id: "reporter_123", name: "చంద్రకుమార్" },
      isReporter: true,
      isCitizen: false
    }
  }
};

// Expected output should have:
// - aiProcessed: true
// - isReporter: true
// - isCitizen: false
// - Enhanced headline and content
// - processingType: "REPORTER_SUBMISSION"
```

#### Test 2: Citizen Submission Processing
```typescript
// Mock request data
const mockRequest = {
  data: {
    postData: {
      headline: { telugu: "కంటెంట్" },
      content: { telugu: "నా ఊరలో చాలా సమస్యలు ఉన్నాయి..." },
      mediaUrl: "",
      reporter: { id: "citizen_456", name: "అజ్ఞాత పౌరుడు" },
      isCitizen: true,
      isReporter: false
    }
  }
};

// Expected output should have:
// - aiProcessed: true
// - isCitizen: true
// - isReporter: false
// - Generated headline and enhanced content
```

#### Test 3: Error Handling
```typescript
// Test missing headline
const mockRequest = {
  data: {
    postData: {
      headline: { telugu: "" },
      content: { telugu: "content..." },
      reporter: { id: "user_123", name: "test" }
    }
  }
};

// Expected: HttpsError('invalid-argument', 'Headline and content are required')
```

### Integration Testing - Mobile App

#### Test 1: Reporter Submits News
1. Open app as reporter
2. Navigate to "Create" → "News"
3. Fill in:
   - Headline: "విజయనగర్ వార్తలు"
   - Content: "స్థానిక పట్టణంలో కొత్త బస్ సేవ ప్రారంభమైంది..."
   - Category: "రాజకీయం"
   - District: "చిత్తూర్"
   - Media: Select or capture photo
4. Click "Publish News"
5. Verify:
   - Toast shows "News published successfully"
   - Post appears in feed
   - Navigate to Firestore and check:
     - `isReporter: true`
     - `isCitizen: false`
     - `aiProcessed: true`
     - `aiProcessedAt` has timestamp
     - `processingType: "REPORTER_SUBMISSION"`
     - Headline and content are enhanced

#### Test 2: Citizen Submits News
1. Open app as citizen (or logged-in user)
2. Navigate to "Create" → "Citizen Journalism"
3. Fill in:
   - Content: "నా ఊరలో రోడ్ల మరమ్మత్ కంటూ..."
   - District: "హైదరాబాద్"
   - Media: Capture photo
4. Agree to terms
5. Click "Submit"
6. Verify:
   - Toast shows "thanks you, news published"
   - Post appears in feed
   - Navigate to Firestore and check:
     - `isCitizen: true`
     - `isReporter: false`
     - `aiProcessed: true`
     - `aiProcessedAt` has timestamp
     - Headline is auto-generated
     - Content is enhanced

#### Test 3: Edit Reporter Post
1. Find existing reporter post
2. Click edit
3. Modify headline or content
4. Click "Update News"
5. Verify:
   - Toast shows "News updated successfully"
   - `lastUpdated` timestamp is recent
   - AI re-processing occurs
   - Enhanced content is updated

### Performance Testing

#### Test 4: Processing Time
- Measure time from submission to completion
- Expected: < 5 seconds for typical post
- Monitor cloud function logs for execution time

#### Test 5: Concurrent Submissions
- 10 reporters submit simultaneously
- Verify all posts are processed correctly
- Check cloud function resource usage
- Monitor cost implications

#### Test 6: Large Media Files
- Test with 5MB+ images/videos
- Verify media optimization works (WebP conversion)
- Check storage costs and bandwidth

### Quality Testing

#### Test 7: AI Output Quality
Check 10 reporter posts for:
- [ ] Headline is grammatically correct Telugu
- [ ] Content is coherent and factual
- [ ] Category is correctly assigned
- [ ] Location is accurately detected
- [ ] English translation is accurate
- [ ] No hallucinated information

#### Test 8: Edge Cases
- Empty headline → Should error
- Empty content → Should error
- Very long content (>1000 chars) → Should handle gracefully
- Special characters in content → Should process correctly
- Duplicate posts → Should generate different fingerprints
- No media provided → Should still process

### Database Testing

#### Test 9: Firestore Queries
```kotlin
// Reporter posts only
val reporterPosts = db.collection("news")
    .whereEqualTo("isReporter", true)
    .get()
    .await()

// Citizen posts only
val citizenPosts = db.collection("news")
    .whereEqualTo("isCitizen", true)
    .get()
    .await()

// AI processed posts
val aiProcessed = db.collection("news")
    .whereEqualTo("aiProcessed", true)
    .get()
    .await()

// Reporter posts from specific user
val userReports = db.collection("news")
    .whereEqualTo("reporter.id", userId)
    .whereEqualTo("isReporter", true)
    .get()
    .await()
```

### User Acceptance Testing (UAT)

#### Test 10: Reporter Workflow
1. Reporter applies via "Join as Reporter"
2. Gets approved
3. Submits first news
4. Sees it in feed with AI-enhanced content
5. Can edit post
6. Can delete post
7. Views own published posts

#### Test 11: Citizen Workflow
1. Citizen opens app (logged in or guest)
2. Goes to "Citizen Journalism"
3. Submits local issue
4. Gets confirmation
5. Sees post in feed
6. Can't edit (read-only after submission)

## Rollback Plan

If issues occur after deployment:

### Option 1: Quick Rollback
```bash
# Redeploy previous version from Git
git checkout previous_commit
firebase deploy --only functions:processNewsPost,functions:processReporterSubmission

# Clear app cache and update
adb shell pm clear com.alfanews.telugu
```

### Option 2: Feature Flags
Add Firebase Remote Config to toggle new functions:
```kotlin
// Check if new processing should be used
val useNewReporterProcessing = remoteConfig.getBoolean("use_reporter_processing_v2")

if (useNewReporterProcessing) {
    FirebaseFunctionsService.processReporterSubmission(...)
} else {
    FirebaseFunctionsService.processNewsPost(...)
}
```

### Option 3: Graceful Degradation
If cloud function fails, fall back to original:
```kotlin
try {
    result = FirebaseFunctionsService.processReporterSubmission(postId, postData)
} catch (e: Exception) {
    // Fallback to original process
    result = FirebaseFunctionsService.processNewsPost(postId, postData)
}
```

## Monitoring and Logging

### Cloud Function Logs
```bash
# View live logs
firebase functions:log

# Or via Google Cloud Console
gcloud functions describe processReporterSubmission --gen2

# Check for errors
gcloud functions logs read processReporterSubmission --limit 50
```

### Key Metrics to Monitor
- **Execution Time**: Should be < 10 seconds
- **Error Rate**: Should be < 0.1%
- **Memory Usage**: Should be < 1.5GB
- **Cost**: Monitor API calls to Gemini

### Alerts to Set Up
```
Alert Name: Reporter Processing Failures
Metric: Cloud Function Errors
Condition: Error rate > 1%
Action: Notify admin

Alert Name: High Execution Time
Metric: Function Execution Duration
Condition: Duration > 15 seconds
Action: Notify DevOps

Alert Name: API Quota Exceeded
Metric: Gemini API Rate Limit
Condition: Rate limit hit
Action: Notify admin
```

## Post-Deployment Verification

### Day 1 (Launch)
- [ ] No error spikes in logs
- [ ] Sample posts are processed correctly
- [ ] Users can submit both reporter and citizen posts
- [ ] Posts appear in feed with AI enhancements
- [ ] Firestore data structure is correct

### Week 1
- [ ] Process 100+ posts successfully
- [ ] Check cost implications
- [ ] Monitor user feedback
- [ ] Verify AI quality is consistent
- [ ] Check for any data integrity issues

### Month 1
- [ ] Full analytics on usage patterns
- [ ] Verify performance under load
- [ ] Check for edge cases or bugs
- [ ] Gather user feedback
- [ ] Plan optimizations if needed

## Support and Debugging

### Common Issues and Solutions

**Issue**: "processReporterSubmission is not a function"
- **Cause**: Cloud function not deployed
- **Solution**: Run `firebase deploy --only functions:processReporterSubmission`

**Issue**: Headline comes back empty
- **Cause**: AI failed to extract/generate headline
- **Solution**: Check Gemini API quota, review system instruction

**Issue**: Posting works but doesn't appear in feed
- **Cause**: Firestore rules blocking read access
- **Solution**: Update `firestore.rules` to allow reading news collection

**Issue**: "Permission denied" when saving to Firestore
- **Cause**: Security rules too restrictive
- **Solution**: Review and adjust Firestore security rules

**Issue**: Media upload fails
- **Cause**: Storage bucket rules or file size limit
- **Solution**: Check Firebase Storage rules and increase max file size

## Documentation Links
- [Firebase Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Google Generative AI API](https://ai.google.dev/)
- [Firebase Firestore Security Rules](https://firebase.google.com/docs/firestore/security/start)
- [Kotlin Coroutines Guide](https://kotlinlang.org/docs/coroutines-overview.html)

