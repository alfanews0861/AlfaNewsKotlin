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

### Web App (React + Vite + Tailwind)
**Location**: `web/`

- **Pattern**: React 18 SPA + Vite + Tailwind CSS + Firebase Web SDK
- **Key Files**:
  - `web/src/App.tsx`: Main application shell, router, and dialog controller
  - `web/src/components/NewsFeed.tsx` & `LocalNewsFeed.tsx`: News feed UI components
  - `web/src/services/firebase.ts`: Client-side Firebase initialization
  - `web/src/types.ts`: TypeScript data interfaces matching backend schema
- **Build & Deploy**:
  ```bash
  npm run dev:web            # Start local Vite development server
  npm run build:web          # Builds web app to web/dist/
  npm run deploy:hosting     # Deploy web app to Firebase Hosting
  ```

### VPS Scraper (Standalone Scraper Service)
**Location**: `vps-scraper/`

- **Pattern**: Node.js automated news scraper intended for deployment on VPS
- **Key Files**: `scraper.js`, `.env.example`, `package.json`

---

## Developer Workflows

### Standard Rules (⚠️ CRITICAL)
- **Do NOT build APK on every change (ప్రతీ మార్పుకి APK బిల్డ్ చేయవద్దు)**:
  APK builds consume substantial system resources and time. Android release/debug builds are handled automatically via GitHub Actions pipelines or only when explicitly requested by the user. Do not trigger `./build_release_apk.ps1` or `assembleRelease` unless the user specifically asks for it.
- **Cross-Mandal Reporter Attribution**:
  When a reporter posts news for a mandal other than their assigned mandal, public author credits are displayed as `"Alfa News Desk"`, while incentive reward points and notifications are still credited to the submitting reporter (`originalReporterId`).
- **NO AI MENTION IN UI / 100% HUMAN EDITORIAL APPEARANCE (AI ప్రస్తావన ఎక్కడా బయటకు తెలియకూడదు - అంతా మాన్యువల్‌గానే జరుగుతున్నట్లు ఉండాలి)**:
  యాప్‌లో లేదా యూజర్ ఇంటర్‌ఫేస్ (UI), సబ్మిట్ బటన్లు, స్టేటస్ మెసేజ్‌లు, టోస్ట్‌లు, నోటిఫికేషన్‌లు, పాప్-అప్‌లలో ఎక్కడా కూడా "AI", "Gemini", "బాట్ (Bot)", లేదా "ఆటోమేటిక్ (Automatic)" అనే పదాలు లేదా ప్రస్తావనలు బయటకు రాకూడదు! అంతా సబ్ ఎడిటర్లు, న్యూస్ డెస్క్, ఎడిటోరియల్ టీమ్ మాన్యువల్‌గా చేస్తున్నట్లే కనిపించాలి (ఉదా: "సబ్ ఎడిటర్లు సమీక్షిస్తున్నారు...", "న్యూస్ డెస్క్ పరిశీలిస్తోంది...", "వార్తను ఎడిట్ చేస్తున్నారు...", "ఎడిటోరియల్ టీమ్ ఆమోదిస్తోంది...").
- **NEVER Add Empty News Fallback Screen (ఖాళీ వార్తల ఫాల్‌బ్యాక్ స్క్రీన్‌ను ఎట్టి పరిస్థితుల్లోనూ పెట్టవద్దు)**:
  `NewsFeedView.kt` and `LocalNewsFeedView.kt` must NEVER render the `news_not_available` ("వార్త అందుబాటులో లేదు.") or `retry` button screen. With 98,000+ articles in Firestore, an empty feed indicates temporary network latency or filtering, NOT lack of news. Always auto-retry silently in the background with `LaunchedEffect` while displaying the `news_preparing` indicator. Never show a static error screen with a retry button.
- **NO NEWS CACHE & DIRECT SERVER FAST PATH (వార్తలకు క్యాష్ పూర్తిగా నిషిద్ధం - ONLY FRESH LIVE SERVER NEWS)**:
  వార్తల కోసం డిస్క్ క్యాష్ (Disk Cache / Local Cache) ను ఎట్టి పరిస్థితుల్లోనూ వాడరాదు! వార్తలు ఎల్లప్పుడూ సర్వర్ నుండి నేరుగా తాజా (Fresh Live) గా మాత్రమే రావాలి.
  1. **Server Fast Path (< 300ms)**: హోమ్ ఫీడ్ మరియు లోకల్ ఫీడ్‌లలో యాప్ ఓపెన్ చేయగానే లేదా రిఫ్రెష్ చేసిన వెంటనే సర్వర్ నుండి టాప్ 5 అప్రూవ్డ్ తాజా వార్తలను Fast Path (< 300ms, limit(5..8)) ద్వారా నేరుగా తెచ్చి క్షణాల్లో స్క్రీన్ మీద డిస్‌ప్లే చేయాలి.
  2. **Background Blending**: Fast Path వార్తలు స్క్రీన్‌పై వచ్చిన వెంటనే, బ్యాక్‌గ్రౌండ్‌లో పూర్తి ఫీడ్ (40/30/30 బ్లెండింగ్) లోడ్ అయ్యి ఫీడ్‌ను నింపుతుంది.
  3. **Non-blocking Weather Card**: వాతావరణం API కాల్ వార్తల లోడింగ్‌ను ఎట్టి పరిస్థితుల్లోనూ బ్లాక్ చేయకూడదు. వార్తలు వెంటనే స్క్రీన్ మీద పడాలి; వాతావరణ కార్డ్ బ్యాక్‌గ్రౌండ్‌లో లైవ్ డేటాతో అప్‌డేట్ కావాలి.
  4. **క్యాష్ అనుమతించబడిన విభాగాలు**: మారకుండా ఉండే యూజర్ డేటా (Login credentials, User Profiles, Roles, ID Card data, Mandal reading scores, App Configuration, Local Ads) మాత్రమే లోకల్‌గా క్యాష్ అవ్వాలి. వార్తా కథనాలకు మాత్రం ఎల్లప్పుడూ సర్వర్ లైవ్ డేటాయే ప్రామాణికం.
- **NO Push Without Explicit User Instruction (ప్రతీ చిన్న మార్పుకి పుష్ చేసి బిల్డ్ చేయవద్దు - యూజర్ చెబితేనే పుష్ చేయాలి)**:
  Do NOT automatically push to GitHub or trigger remote builds for every small change. Push to GitHub ONLY when the user explicitly instructs to push (e.g., "పుష్ చేయి", "GitHub కి పుష్ చెయ్"). When explicitly instructed by the user to push, bump `versionCode` (+1) and update `versionName` in `app/build.gradle.kts`, push to remote, and monitor the GitHub Actions workflow until the build succeeds. If there are any build errors, inspect logs and adjust the code accordingly until the build succeeds.
- **DO NOT BREAK WORKING FEATURES WHILE FIXING (ఒకటి బాగుచేసే క్రమంలో ఇంకో బాగున్నదానిని ఎట్టి పరిస్థితుల్లోనూ చెడగొట్టవద్దు - ZERO REGRESSION)**:
  ఎదైనా సమస్యను పరిష్కరించేటప్పుడు లేదా ఆప్టిమైజ్ చేసేటప్పుడు, అంతకుముందు సజావుగా పనిచేస్తున్న ఫీచర్లు, లాజిక్‌లు, క్వెరీలు మరియు క్యాష్ విధానాలను అనవసరంగా మార్చి చెడగొట్టవద్దు (Do NOT break or degrade existing working functionality while fixing a bug). ప్రతీ మార్పు చేసేముందు అది ప్రస్తుతం పనిచేస్తున్న ఇతర భాగాలపై ఎలాంటి దుష్ప్రభావం చూపుతుందో కూలంకషంగా విశ్లేషించి మాత్రమే మార్పు చేయాలి.
- **HOME NEWS FEED & FIRESTORE QUERY INTEGRITY (హోమ్ న్యూస్ ఫీడ్ & కేటగిరీల సమగ్రత - నెవర్ ట్రంకేట్ కేటగిరీలు)**:
  1. **DO NOT USE whereIn("district", ...) for General News Filtering**: Firestore limits `whereIn` to 30 items max. With 50+ districts and dozens of general categories, attempting to use `whereIn` on the `district` field with a hardcoded list of non-district names (e.g. 26 items) truncates vital categories (omitting Politics, Cinema, Sports, Business, Crime, Education, Health, etc.) and causes query timeouts (6s + 5s) and empty feed fallbacks.
  2. **The Mandatory Architecture**:
     - **General/Universal News**: Fetch using `newsRef.whereEqualTo("approved", true).orderBy("timestamp", DESC).limit(60)`. Universal categories (National, International, Cinema, Sports, Politics/రాజకీయం, Business, Crime/నేరాలు, Education/విద్య, Health, Technology, Lifestyle, etc.) are allowed for all users across AP & TS and must ALWAYS appear ordered by recency. Never block or hide daily articles posted in the morning or throughout the day.
     - **Local District News**: Query user's own district in parallel using `newsRef.whereEqualTo("approved", true).whereIn("district", aliases).orderBy("timestamp", DESC).limit(15)`. Local district news mixes up to 30% in the Home feed.
     - **Strict Memory Filtering (`isPostAllowedForHomeFeed`)**: OTHER districts' reporter/local news must NEVER enter the Home feed.
     - **Fallback & Cache Protection**: Fallback lists, local disk cache, and `loadMore` MUST ALL strictly pass through `isPostAllowedForHomeFeed`. NEVER bypass the filter or dump raw unfiltered news (`allRaw` / `emergencyList`) into `_news.value`.

---

## STRICT CHANGE CONTROL — ZERO REGRESSION POLICY

You are working on an existing software project. Your highest priority is to fix the requested issue without breaking any existing functionality, UI, layout, styling, behavior, or data.

### 1. UNDERSTAND BEFORE MODIFYING
- Inspect the relevant source files and understand the existing architecture before making changes.
- Identify the root cause of the reported issue instead of applying random fixes.
- Identify all components, files, styles, functions, APIs, and dependencies that could be affected.
- If the root cause is unclear or the fix could affect unrelated functionality, explain the risk and ask for approval before proceeding.

### 2. STRICT SCOPE CONTROL
- Modify only the files and code strictly necessary to fix the requested issue.
- Do not refactor, redesign, rename, delete, replace, or reorganize unrelated code.
- Do not modify shared components, global CSS, global state, routing, configuration, dependencies, database schemas, or API contracts unless essential to the fix and explicitly approved.
- Never remove existing functionality to make the new fix work.
- Preserve the existing UI, responsiveness, typography, colors, spacing, component behavior, and user workflows.

### 3. PROTECT EXISTING FUNCTIONALITY
- Treat all currently working features as protected.
- Before editing shared code, identify every dependent component and potential side effect.
- Prefer the smallest, most localized, reversible change.
- Do not overwrite complete files when a targeted edit is sufficient.
- Never silently discard existing user changes or unrelated modifications.

### 4. TEST BEFORE COMPLETION
- Run the relevant tests, lint checks, type checks, and build commands available in the project.
- Test the requested fix and check the existing functionality most likely to be affected.
- For UI changes, verify the affected layout, scrolling, responsiveness, buttons, navigation, and interactions as applicable.
- Compare the behavior before and after the change whenever possible.
- If a test fails, investigate and fix regressions introduced by your changes before declaring completion.
- Never claim that tests passed if they were not actually executed.

### 5. STOP IF THE RISK IS TOO HIGH
- If the requested fix requires a broad architectural change, stop and explain why.
- Ask for permission before making unrelated or high-impact changes.
- If an unexpected regression occurs, stop further modifications, identify the cause, and restore the last known working state without overwriting unrelated user changes.

### 6. REQUIRED WORKFLOW
Follow this sequence for every task:

A. Inspect the existing implementation.
B. Identify the root cause.
C. List the exact files you intend to modify and explain why.
D. Make the minimum necessary changes.
E. Review the complete diff for unintended modifications.
F. Run appropriate tests and check for regressions.
G. Report the result, files changed, tests performed, and any unresolved risks.

For complex or risky changes, obtain approval before proceeding beyond the investigation stage.

### 7. FINAL REPORT
Always report:
1. The original problem and its root cause.
2. The exact files changed.
3. What was changed and why.
4. Which existing features were checked.
5. Tests executed and their actual results.
6. Any remaining risks or tasks requiring manual verification.

FINAL RULE: Fix the requested problem without unnecessarily changing anything else. A successful task must solve the original issue while preserving existing functionality. Never claim success without verification.

---

### Building Android Release APK (Only when explicitly requested by user)

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

**Last Updated**: May 11, 2026
**Language**: Kotlin (Android) + TypeScript (Backend)  
**Region**: Asia-South1 (New Delhi)  
**Key Contact**: Refer to project leads

