# Storage Permission Fix and Synchronization Plan

The app is experiencing `StorageException: User does not have permission` errors. Research indicates mismatches between storage paths used in the code and those defined in `storage.rules`, as well as missing roles in permission checks.

## User Review Required

> [!IMPORTANT]
> - **Role Synchronization**: I am adding `REGIONAL_INCHARGE` to the allowed roles for `news-media` uploads to match Firestore rules.
> - **Path Standardization**: `MainViewModel` uses `profile_images/` but rules use `user-profiles/`. I will update both to ensure consistency.

## Proposed Changes

### 1. Fix Firebase Storage Rules
Update rules to include missing folders and roles.

#### [MODIFY] [storage.rules](file:///C:/AlfaKotlin/storage.rules)
- Update `hasReporterRole` to include `'REGIONAL_INCHARGE'`.
- Add `profile_images/` folder to allowed write paths for authenticated users.
- Add `user-documents/` or similar if needed for future proofing.
- Ensure all media folders (`news-media`, `citizen-media`, `classifieds-media`, `local-ads`) are correctly protected.

### 2. Synchronize Storage Paths in MainViewModel
Ensure the code uses the paths defined in the rules.

#### [MODIFY] [MainViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/MainViewModel.kt)
- Update `updateUserProfile` to use `user-profiles/` instead of `profile_images/` to match the existing rules (or I'll add `profile_images/` to rules and keep code). *Decision: I will add `profile_images/` to rules as it's a more descriptive name already in use.*

### 3. Improve Storage Error Handling
Provide more context when uploads fail to help debugging.

#### [MODIFY] [StorageUtils.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/utils/StorageUtils.kt)
- Add more descriptive error logging including the path being uploaded to.
- Wrap `await()` calls in specific try-catch blocks to distinguish between auth, permission, and network errors.

## Verification Plan

### Automated Tests
- Build the project: `./gradlew assembleDebug`
- (Manual) Deploy storage rules: `firebase deploy --only storage` (User needs to do this).

### Manual Verification
1. **Profile Update**: Log in as a regular user and try to update profile photo. Verify it succeeds.
2. **Reporter Upload**: Log in as a Reporter or Regional Incharge and post a news item with media. Verify it succeeds.
3. **Citizen Post**: Post a citizen journalism item with media. Verify it succeeds.
4. **Classified Ad**: Post a classified ad with an image. Verify it succeeds.
