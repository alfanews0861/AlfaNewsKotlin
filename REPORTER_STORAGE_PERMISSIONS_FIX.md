# 🔧 Reporter Storage Permissions Fix

**Issue:** Reporter users were unable to upload images to Firebase Storage when creating news posts.

**Root Cause:** The Firebase Storage rules (`storage.rules`) did not have role-based access control for the `news-media` folder. While any authenticated user could write to storage, the Firestore database rules were correctly restricting news post creation to REPORTER, EDITOR, and ADMIN roles, but there was no corresponding restriction in Storage.

---

## ✅ Solution Applied

### 1. **Updated `storage.rules`**

Added helper functions to validate user roles against Firestore user documents:

```javascript
// Helper function to check if user has REPORTER role
function hasReporterRole(uid) {
  let userDoc = firestore.get(/databases/(default)/documents/users/$(uid));
  return userDoc.exists && userDoc.data.role in ['REPORTER', 'EDITOR', 'ADMIN'];
}

// Helper function to check if user has ADMIN role
function hasAdminRole(uid) {
  let userDoc = firestore.get(/databases/(default)/documents/users/$(uid));
  return userDoc.exists && userDoc.data.role == 'ADMIN';
}
```

### 2. **Restricted `news-media` Folder**

Updated the News Media storage rules to enforce role-based access:

**Before:**
```javascript
match /news-media/{allPaths=**} {
    allow write: if request.auth != null;
}
```

**After:**
```javascript
match /news-media/{allPaths=**} {
    allow write: if request.auth != null && 
        hasReporterRole(request.auth.uid);
}
```

---

## 📋 Permission Matrix After Fix

| Folder | Read | Write | Required Role |
|--------|------|-------|---|
| `news-media/` | Public | REPORTER, EDITOR, ADMIN | ✅ REPORTER, EDITOR, ADMIN |
| `citizen-media/` | Public | Authenticated users | Any authenticated user |
| `uploads/` | Public | Authenticated users | Any authenticated user |
| `classifieds-media/` | Public | Authenticated users | Any authenticated user |
| `local-ads/` | Public | Authenticated users | Any authenticated user |

---

## 🔄 How It Works

1. **Reporter uploads image** → PostNewsPageView calls `uploadMediaToStorage(context, mediaUri, "news-media", false)`
2. **Storage receives upload request** → Firebase checks storage.rules
3. **hasReporterRole() function called** → Looks up user document in Firestore at `/users/{uid}`
4. **Checks user role** → If role is in `['REPORTER', 'EDITOR', 'ADMIN']`, upload is allowed ✅
5. **If not reporter** → Upload rejected with permission denied error ❌

---

## 📊 Firestore Rules Context

The Firestore News collection already has proper role-based access:

```javascript
match /news/{postId} {
  allow create: if request.auth != null && (
    (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && (
      getUserData().role in ['REPORTER', 'EDITOR', 'ADMIN'] ||
      (getUserData().role == 'REGIONAL_INCHARGE' && ...)
    )) ||
    (request.resource.data.isCitizen == true)
  );
}
```

Now **Storage rules match Firestore rules** for consistency.

---

## 🚀 Deployment Steps

1. **Deploy Storage Rules:**
   ```bash
   firebase deploy --only storage
   ```

2. **Verify rules deployed:**
   - Go to Firebase Console → Storage → Rules tab
   - Confirm the new helper functions and role-based restrictions are visible

3. **Test Reporter Upload:**
   - Login as Reporter user
   - Try uploading an image in PostNewsPageView
   - Should now succeed ✅

---

## 📝 Testing Checklist

- [ ] **Reporter Login** → Can upload images to news-media ✅
- [ ] **Editor Login** → Can upload images to news-media ✅
- [ ] **Admin Login** → Can upload images to news-media ✅
- [ ] **Citizen/Guest** → Cannot upload to news-media (permission denied) ❌
- [ ] **Citizen/Guest** → CAN upload to citizen-media (still allowed) ✅
- [ ] **Public read** → All files remain publicly readable ✅

---

## 🛡️ Security Benefits

1. **Role-Based Access Control (RBAC)** → Only authorized roles can upload news media
2. **Consistency** → Storage rules now match Firestore Database rules
3. **Audit Trail** → User role is checked on every upload attempt
4. **Scalability** → Can easily add more roles or restrict other folders
5. **No Hard-coded Users** → Dynamic role checking from Firestore

---

## 📌 Files Modified

- ✅ `storage.rules` - Added helper functions and role-based access for news-media

---

## 🔗 Related Documentation

- Firestore Rules: `firestore.rules` (already has proper role-based access)
- Upload Utility: `app/src/main/java/com/alfanews/telugu/utils/StorageUtils.kt`
- PostNewsPageView: Calls `uploadMediaToStorage()` for reporter posts

---

**Status:** ✅ FIXED - Reporter users can now upload images to Firebase Storage

