# AGENTS.md - AI Coding Agent Guide for AlfaNews

## Project Overview

**AlfaNews** is a hyper-local news app for Telugu-speaking communities with:
- **Mobile**: Android app with Jetpack Compose, Firebase Auth, Firestore
- **Backend**: TypeScript Cloud Functions (Node.js 2nd Gen) with AI integration (Gemini API)
- **Features**: News feed (40/30/30 mixing), classifieds, personalized notifications, reporter submissions
- **Platform**: Firebase-hosted infrastructure with Cloud Scheduler for notifications (4x daily: 8 AM, 1 PM, 6 PM, 9 PM IST)

---

## Architecture Essentials

### Mobile App (MVVM + Compose)
**Pattern**: `AndroidViewModel` + `StateFlow` + `Jetpack Compose`

- **Key ViewModels**: `LocalNewsFeedViewModel`, `NewsFeedViewModel`, `LoginViewModel` (located in `app/src/main/java/com/alfanews/telugu/viewmodels/`)
- **State Management**: Use `MutableStateFlow<T>` for state, expose as `StateFlow<T>` via `asStateFlow()`
- **UI Layer**: Compose views in `app/src/main/java/com/alfanews/telugu/views/` call `collectAsStateWithLifecycle()` to observe flows
- **Side Effects**: Use `LaunchedEffect` + `viewModelScope.launch` for async work; never block UI thread
- **Data Access**: Abstract via `FirebaseService` singleton (Firestore queries use pagination with `DocumentSnapshot` cursors)

**Critical Pattern - News Feed 40/30/30 Mixing**:
```kotlin
// NewsFeedViewModel mixes: 40% general, 30% local (district), 30% state
// Uses document cursors for pagination - DO NOT change query order or fields
private var prefCursor: DocumentSnapshot? = null  // Tracks pagination state
```

### Backend (TypeScript Cloud Functions)
**Location**: `functions/src/`

- **Key Files**:
  - `notification_engine.ts`: Scheduled notifications (4x daily), handles preferences, pagination, duplicate prevention
  - `geminiService.ts`: AI enhancement of news posts (Gemini API calls)
  - `index.ts`: Cloud Function exports (e.g., `processNewsPost`, `processReporterSubmission`, `sendPersonalizedNotification`)
  - `types.ts`: Firebase document schemas
  
- **Build & Deploy**:
  ```bash
  cd functions && npm run build      # Compiles TypeScript to lib/
  firebase deploy --only functions  # Deploy to asia-south1 (New Delhi)
  firebase functions:log --follow    # Monitor logs in real-time
  ```

- **Notification Architecture**:
  - Triggered by Cloud Scheduler (cron: `0 8,13,18,21 * * *` IST)
  - Respects user preferences (`categoryScores`, `notificationsEnabled`)
  - Anti-duplicate logic: 12-hour window prevention + throttling
  - 4-level headline fallback (category → location → general → AI generation)

---

## Developer Workflows

### Building Android Release APK
```powershell
# Location: build_release_apk.ps1
# Auto-retries 10x (daemon crashes are common)
# Kills Java processes between attempts
./build_release_apk.ps1
# Output: app/build/outputs/apk/release/app-release.apk
```

**Manual Build**:
```bash
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set GRADLE_OPTS=-Xmx4096m -XX:MaxMetaspaceSize=1024m
./gradlew.bat assembleRelease --no-daemon --max-workers=1
```

### Testing Notifications Locally
```bash
cd functions
firebase emulators:start                # Start emulator
# Manually trigger function or wait for schedule
firebase functions:log --follow          # Monitor execution
```

### Viewing Firestore Schema
**Critical Collections**:
- `news`: documents have `approved`, `category`, `score` fields (reporter posts + citizen journalism + AI enhancement)
- `users`: have `categoryScores`, `shadowMode` (admin override), `lastNotificationTime`, `notificationsEnabled`
- `userDistricts`: location-based preferences
- Check existing indexes in `firestore.indexes.json` before adding queries

---

## Data Schema Rules (⚠️ CRITICAL)

**DO NOT modify field names or types** — web app + Android app depend on same Firestore schema

**Key Fields** (auto-documented via TypeScript `types.ts`):
```typescript
// News document
{ approved: boolean, category: string, score: number, headline: string, 
  imageUrl: string, isReporter: boolean, aiProcessed: boolean }

// User document  
{ categoryScores: {[key: string]: number}, shadowMode: boolean, 
  notificationsEnabled: boolean, lastNotificationTime: number }
```

**Consistency Rule**: If you add a field, add it to:
1. TypeScript `types.ts`
2. Both Android + web apps simultaneously
3. Document in `TECHNICAL_DESIGN_*` file

---

## Project-Specific Conventions

### Code Patterns
1. **State Management**: Always expose internal `MutableStateFlow` as public `StateFlow` (immutable)
2. **Error Handling**: Log to Firebase Console (backend) / Android Logcat (mobile) with context
3. **Permissions**: Location requires runtime requests (`rememberLauncherForActivityResult`)
4. **Firebase Queries**: Use cursors for pagination (see `prefCursor` in ViewModels)

### Naming Conventions
- ViewModels: `{Feature}ViewModel` (e.g., `ClassifiedsViewModel`, `LocalNewsFeedViewModel`)
- Views/Composables: `{Feature}View` (e.g., `LocalNewsFeedView`)
- Services: `{Domain}Service` (e.g., `AdMobService`, `FirebaseService`)
- Utils: `{Purpose}Manager` (e.g., `PreferenceManager`)

### Build Configuration
- Min SDK: 24, Target SDK: 35, Compose: enabled
- Version scheme: `Sree_X.X.X` (e.g., `Sree_5.1.1`)
- Language: Kotlin + TypeScript (mixed project)
- Signing: Release builds require env vars: `RELEASE_STORE_FILE`, `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`

---

## External Dependencies & Integration Points

| System | Purpose | Config |
|--------|---------|--------|
| **Firestore** | Real-time news database | `firebase.json` + `firestore.rules` + `firestore.indexes.json` |
| **Firebase Auth** | Phone-based login | SMS verification via Firebase console |
| **Google Gemini API** | AI text enhancement | `GEMINI_API_KEY` in `local.properties` + `build.gradle.kts` |
| **AdMob** | In-app ads | `google-services.json` + `AdMobService.kt` |
| **Cloud Scheduler** | Notification triggers | Cron job: `0 8,13,18,21 * * *` IST |
| **FCM** | Push notifications | Certificate in Firebase console |
| **Google Cloud Functions** | Backend compute | Region: `asia-south1` (New Delhi) |

---

## Common Tasks & Solutions

### "How do I add a new Firestore query?"
1. Add TypeScript type in `functions/src/types.ts`
2. Update Firestore indexes in `firestore.indexes.json` (write query first, copy suggested index)
3. Write query in `NewsFeedViewModel.kt`
4. Test with emulator: `firebase emulators:start`

### "Why didn't my notification deploy?"
```bash
npm run build                # Check TypeScript errors first
firebase deploy --only functions --project <PROJECT_ID>
firebase functions:log --follow  # Monitor live logs
```

### "How do I debug news not showing in feed?"
1. Check `NewsFeedViewModel.kt` — verify query filters match data
2. Check Firestore `news` collection — verify `approved: true`
3. Check user's `categoryScores` — ensure non-zero for relevant categories
4. Enable verbose logging: add `logger.info()` calls in viewmodel

### "Report Station news is broken"
1. Check `functions/src/check_sources.ts` — RSS parser may need update
2. Verify source URL still valid in Firestore `newsSources` collection
3. Check `functions/src/geminiService.ts` — AI enhancement might timeout
4. Deploy fix: `firebase deploy --only functions`

---

## Existing Conventions (.cursorrules - TeluguLocal)

⚠️ **Before making ANY changes, read `.cursorrules`** (Telugu doc):

**Key Rules**:
1. **No feature deletion** without explicit permission
2. **Data schema immutable** across all platforms (web + Android)
3. **Build once only** — one build failure = stop & report to user
4. **Automation preferred** — no approval gates in pipelines
5. **Token optimization** — cut unnecessary praise/apologies

---

## Essential Documentation Files

| File | Purpose |
|------|---------|
| `FINAL_DEPLOYMENT_SUMMARY.md` | Overall project status |
| `NOTIFICATION_TECHNICAL_ANALYSIS.md` | Deep dive on notification system |
| `NOTIFICATION_SYSTEM_AUDIT_REPORT.md` | What was fixed in notifications |
| `NEWS_FEED_MASTER_INDEX.md` | News feed 40/30/30 mixing logic |
| `DEPLOYMENT_CHECKLIST.md` | Step-by-step deploy guide |
| `README_REPORTER_AI_PROCESSING.md` | Reporter submission flow |

---

## When to Seek Context vs. Implement

### Auto-proceed (use semantic_search + read files):
- Adding fields to existing models
- Refactoring ViewModels (same pattern)
- Updating Firestore queries (with new indexes)
- Fixing notification logic

### Escalate (ask user first):
- Changing existing field names/types
- Removing any user-facing features
- Modifying notification frequency (currently 4x daily)
- Cross-platform data schema changes

---

## Quick Reference Commands

```bash
# Build Android APK
./build_release_apk.ps1

# Deploy Cloud Functions
cd functions && npm run deploy

# View Functions Logs
firebase functions:log --follow

# Test Locally
firebase emulators:start

# Check Build Errors
./gradlew clean build

# Deploy to Play Store distribution
firebase appdistribution:distribute app/build/outputs/apk/release/app-release.apk
```

---

**Last Updated**: April 27, 2026  
**Language**: Kotlin (Android) + TypeScript (Backend)  
**Region**: Asia-South1 (New Delhi)  
**Key Contact**: Refer to project leads

