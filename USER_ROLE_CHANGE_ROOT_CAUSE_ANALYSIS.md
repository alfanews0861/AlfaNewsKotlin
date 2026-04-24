# 🚨 User Role Change Issue - Root Cause Analysis

## Problem Statement
Administrator users are being displayed as "Guest" instead of their actual role (ADMIN, EDITOR, REPORTER, etc.). This causes confusion as existing reporters and editors remain at their correct roles, but some users (especially admins) incorrectly appear as guests.

---

## Root Cause

### Issue #1: Firestore Deserialization Failure
**Location:** `app/src/main/java/com/alfanews/telugu/viewmodels/MainViewModel.kt` (Line 70)

**Problem:**
1. Firestore stores the `role` field as a STRING (e.g., `"ADMIN"`, `"EDITOR"`, `"REPORTER"`)
2. The User data class defines `role` as an ENUM type:
   ```kotlin
   data class User(
       val role: UserRole = UserRole.GUEST,  // ❌ Default is GUEST
       ...
   )
   ```
3. When Firestore's `snapshot.toObject(User::class.java)` attempts to deserialize:
   - It cannot automatically convert the string `"ADMIN"` to the enum `UserRole.ADMIN`
   - The deserialization fails silently
   - The `role` field gets the default value: `UserRole.GUEST` ❌

### Issue #2: Failed Deserialization Causes Chain Failure
**Location:** `MainViewModel.kt` (Line 68-86)

**Current Logic:**
```kotlin
val userObj = try {
    snapshot.toObject(User::class.java)?.copy(  // Line 70: FAILS if role deserialization fails
        id = snapshot.id,
        role = try { UserRole.valueOf(roleStr.uppercase()) } catch(e: Exception) { UserRole.SUBSCRIBER }
    )
} catch (e: Exception) {
    // Fallback manual mapping...
}
```

**The Problem:**
- When `toObject()` fails to deserialize the role field, it returns an object with `role = UserRole.GUEST` (the default)
- The `.copy()` then overrides it with the roleStr value, BUT...
- If `toObject()` returns null (complete deserialization failure), the entire expression fails
- Even if it succeeds, the default GUEST value might be used in intermediate states

### Issue #3: Default Value Chain
**Location:** `app/src/main/java/com/alfanews/telugu/models/User.kt` (Line 19)

```kotlin
val role: UserRole = UserRole.GUEST,  // ❌ Default is GUEST, not SUBSCRIBER
```

When role is missing or can't be deserialized, it defaults to GUEST. This is misleading because:
- New users should be SUBSCRIBER (as set in LoginViewModel Line 50)
- Existing users should preserve their role from Firestore

---

## Why This Affects Admins More

1. **Admins are rare** - So the issue isn't caught immediately
2. **App startup race condition** - If Firestore loads slowly during app launch:
   - The user appears as null (logged out)
   - Then defaults to GUEST in MainScreen Line 378
   - Even after Firestore snapshot loads, the UI might not update properly
3. **State persistence** - Once the user sees themselves as GUEST, the state might not refresh

---

## Manifestations

### Scenario 1: Fresh App Start
- User logs in with ADMIN role
- Firestore snapshot listener starts
- Role deserialization fails → GUEST appears
- User is confused about their role

### Scenario 2: App in Background
- User with ADMIN role closes/suspends app
- App resumes
- Firestore snapshot is cleared and re-established
- Same deserialization failure → GUEST appears

### Scenario 3: Network Delay
- User logs in
- Firestore is slow to respond
- UI shows currentUser as null → defaults to GUEST
- When Firestore finally responds, role is still GUEST due to deserialization failure

---

## Solution

### Fix 1: Proper Firestore Deserialization
Add a custom deserializer or fix the deserialization logic to explicitly convert the string role to an enum before building the User object.

### Fix 2: Ensure Default Role is Correct
- Use SUBSCRIBER as the default (for new users)
- But ensure existing users' roles are never defaulted

### Fix 3: Add Defensive Checks
- Always fetch the role explicitly from Firestore
- Never rely on Firestore's automatic enum deserialization
- Add logging to track role changes

---

## Impact Assessment

| Role | Issues | Frequency |
|------|--------|-----------|
| ADMIN | Shows as GUEST, can't access admin features | HIGH - Most visible |
| EDITOR | May show as GUEST intermittently | HIGH |
| REPORTER | May show as GUEST during app start | MEDIUM |
| SUBSCRIBER | Correct (default) | LOW |
| GUEST | Correct (not logged in) | N/A |

---

## Implementation Plan

1. **Fix Main ViewModel Deserialization** - Ensure role is properly converted from string to enum
2. **Add Explicit Role Handling** - Query role as string, then convert to enum  
3. **Add Fallback Logic** - If role conversion fails, preserve existing role or fetch again
4. **Add Logging** - Track role changes for debugging


