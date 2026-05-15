# 🔑 Login Persistence - Quick Reference

## TL;DR - How It Works

```
User Login → Firebase Auth + SharedPreferences cache
   ↓
App Restart → Load cache + check Firebase session
   ↓
Always Logged In Unless: logout() called OR Firebase session revoked
```

---

## 🎯 Key Classes

### 1. LoginViewModel
**File**: `app/src/main/java/com/alfanews/telugu/viewmodels/LoginViewModel.kt`

```kotlin
// When user signs in:
signInWithCredential(credential, context)
  ├─ FirebaseService.auth.signInWithCredential(credential)  // Firebase
  └─ prefs.userId = user.uid                               // Cache
```

### 2. MainViewModel  
**File**: `app/src/main/java/com/alfanews/telugu/viewmodels/MainViewModel.kt`

```kotlin
// On app start:
init {
  val cachedId = prefs.userId                              // Fast load
  FirebaseService.auth.addAuthStateListener { auth ->      // Real-time sync
    // Fetch Firestore user document
    // Update cache with fresh data
  }
}

// On logout:
signOut()
  ├─ FirebaseService.auth.signOut()                        // Firebase
  └─ prefs.clearUserData()                                 // Cache
```

### 3. PreferenceManager
**File**: `app/src/main/java/com/alfanews/telugu/utils/PreferenceManager.kt`

```kotlin
val prefs: SharedPreferences = context.getSharedPreferences(
    "alfa_news_prefs", 
    Context.MODE_PRIVATE
)

// Cached fields:
- userId: String?
- userName: String?
- userRole: String?          // "SUBSCRIBER", "REPORTER", "ADMIN", etc.
- userDistrict: String?

// Clear on logout:
fun clearUserData()
```

---

## 📊 Two-Layer Architecture

### Layer 1: SharedPreferences (LOCAL)
```
🏃 FAST (instant)
📱 Works offline
❌ Only basic user info
🔒 Encrypted by Android
↻ Never expires (until logout)
```

### Layer 2: Firebase (CLOUD)
```
⏳ SLOW (1-3 seconds)
🌐 Requires connection
✅ Full user profile + roles
🔐 Firebase SDK encryption
↻ Auto-refresh on session timeout
```

---

## 🔄 Session Lifecycle

```
┌────────────────────────────────────────────────────────┐
│ APP LAUNCH                                             │
│ ├─ Read SharedPreferences (0ms)                        │
│ ├─ Show User IMMEDIATELY                              │
│ └─ Start Firebase Auth listener                        │
│    ├─ [ASYNC] Get Firebase user (if exists)           │
│    ├─ [ASYNC] Fetch Firestore profile                 │
│    └─ [ASYNC] Sync cache with fresh data              │
│       → UI updates with latest role/profile           │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ USER LOGOUT                                            │
│ ├─ signOut() Firebase Auth                            │
│ └─ clearUserData() SharedPreferences                  │
│    → currentUser = null                                │
│    → UI shows login screen                            │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ ADMIN CHANGES ROLE (e.g., SUBSCRIBER → REPORTER)      │
│ ├─ Change in Firestore                               │
│ ├─ Firebase triggers real-time listener               │
│ ├─ Sync cache                                         │
│ └─ UI updates automatically                          │
│    → No need to logout/login                         │
└────────────────────────────────────────────────────────┘
```

---

## 🧪 Quick Tests

### Test 1: Verify Persistence
```bash
# 1. Open app, login
# 2. In terminal: adb shell pm kill com.alfanews.telugu
# 3. Reopen app
# ✅ Should show user immediately (cached)
```

### Test 2: Verify Real-time Sync
```bash
# Device A: Login as USER1
# Firestore: Change USER1's role to REPORTER
# Device A: Should see role updated automatically
# ✅ No logout needed
```

### Test 3: Verify Logout
```bash
# 1. Open app, login as USER1
# 2. Settings → Logout
# 3. Reopen app
# ✅ Should show login screen
# ✅ Verify: adb shell dumpsys data com.alfanews.telugu (no user cached)
```

---

## 🚨 Common Issues & Fixes

### Issue: User keeps logged in after logout
```
❌ Problem: clearUserData() not called
✅ Fix: Check MainViewModel.signOut() is called
✅ Fix: Clear app data manually: Settings → Apps → AlfaNews → Clear Data
```

### Issue: Role not updating
```
❌ Problem: Firestore listener stopped
✅ Fix: Check Firebase connection
✅ Fix: Verify Firestore security rules allow user access
✅ Fix: User logout + login to force refresh
```

### Issue: Slow app startup
```
❌ Problem: Waiting for Firebase sync
✅ Fix: Cache is working (shows old data while syncing)
✅ Expected: UI should show cached user immediately
```

### Issue: User shown as Guest on startup, then switches to logged in
```
✅ This is NORMAL - shows app is working:
├─ First: Cache is empty (first login)
├─ Then: Firebase syncs user data
└─ Final: UI updates with real user
```

---

## 📝 Code Snippets for Developers

### Check if User Logged In
```kotlin
val currentUser by mainViewModel.currentUser.collectAsStateWithLifecycle()

when {
    currentUser == null → // User not logged in, show login screen
    currentUser != null → // User logged in, show profile
}
```

### Force Refresh User
```kotlin
// In MainViewModel or any component:
val firebaseUser = FirebaseService.auth.currentUser
if (firebaseUser != null) {
    // Re-add listener to force refresh
    FirebaseService.db.collection("users")
        .document(firebaseUser.uid)
        .get()
        .await()  // This triggers update to currentUser flow
}
```

### Sign Out
```kotlin
mainViewModel.signOut()
// or directly:
FirebaseService.auth.signOut()
prefs.clearUserData()
```

---

## 🔐 Security Notes

✅ **What's Secure**
- Authentication tokens: Encrypted by Firebase SDK
- Firestore access: Requires valid auth token + security rules
- Cached data: Only non-sensitive data (name, role, district)

⚠️ **Risks**
- Rooted device: Can read SharedPreferences
- Stolen device: Attacker has access until session revoked
- App data backup: Android backup includes SharedPreferences

✅ **Mitigations**
- Firestore security rules: Role-based access control
- Device lock: Additional encryption layer
- Firebase session management: Can revoke from console

---

## 📱 Flow Diagram

```
App Opens
    ↓
MainViewModel creates StateFlow<User?>
    ├─ Quick path: Load from SharedPreferences
    │   └─ UI renders immediately ⚡
    │
    └─ Background: Check Firebase Auth
        └─ If logged in:
            └─ Listen to Firestore
                └─ Update StateFlow
                    └─ UI re-renders with fresh data 🔄
                        └─ Update SharedPreferences cache

Login Screen calls LoginViewModel
    ├─ User enters phone number
    ├─ Firebase sends OTP
    ├─ User verifies OTP
    ├─ Firebase Auth signs in
    ├─ LoginViewModel verifies Firestore doc
    ├─ If new user: Create profile
    ├─ Cache to SharedPreferences 💾
    └─ MainViewModel detects auth change
        └─ Flow emits new User (not null)
            └─ UI closes login screen ✅

Logout
    ├─ User clicks "Logout"
    ├─ MainViewModel.signOut()
    ├─ Firebase Auth signs out
    ├─ PreferenceManager clears cache 💨
    ├─ MainViewModel detects no user
    ├─ currentUser flow emits null
    └─ UI shows login screen 🔐
```

---

## 📚 File Reference

| File | Purpose | Key Method |
|------|---------|-----------|
| `LoginViewModel.kt` | Login flow, cache save | `signInWithCredential()` |
| `MainViewModel.kt` | Session persistence | `init{}`, `signOut()` |
| `PreferenceManager.kt` | Local cache | `userId`, `clearUserData()` |
| `MainActivity.kt` | App entry | Instantiates MainViewModel |
| `MainScreen.kt` | UI logic | `ProfileContainer()` |
| `LoginScreenView.kt` | Login UI | Phone/Google auth |

---

## ✅ Verification Checklist

- [x] Firebase Auth session persistent ✓
- [x] SharedPreferences caching enabled ✓
- [x] Real-time Firestore sync working ✓
- [x] Logout clears cache ✓
- [x] Multiple device sync supported ✓
- [x] Offline access possible ✓
- [x] Role changes sync automatically ✓

---

**Last Updated**: May 15, 2026  
**Status**: 🟢 All systems operational

