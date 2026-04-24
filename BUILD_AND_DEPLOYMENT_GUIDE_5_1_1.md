# 🚀 Build & Deployment Guide - Version 5.1.1

## Version Details
- **Version:** Sree_5.1.1
- **Build Code:** 573
- **Status:** Ready for Build
- **Changes:** User Role Fix (Critical Bug Fix)

---

## Quick Build Commands

### 1. Build Debug APK (Testing)
```powershell
cd C:\AlfaKotlin
./gradlew clean build
```

**Expected Output:**
```
BUILD SUCCESSFUL in XXs
📦 APK generated: app/build/outputs/apk/debug/app-debug.apk
```

---

### 2. Build Release AAB (Play Store)
```powershell
cd C:\AlfaKotlin
./gradlew clean bundleRelease
```

**Expected Output:**
```
BUILD SUCCESSFUL in XXs
📦 AAB generated: app/build/outputs/bundle/release/app-release.aab
```

---

### 3. Build Release APK (Direct Sideload)
```powershell
cd C:\AlfaKotlin
./gradlew clean assembleRelease
```

**Expected Output:**
```
BUILD SUCCESSFUL in XXs
📦 APK generated: app/build/outputs/apk/release/app-release.apk
```

---

## Pre-Build Checklist

Before building, verify:

- [ ] Java 21 is installed: `java -version`
- [ ] Android SDK updated to API 35
- [ ] NDK 27.1.12297006 available
- [ ] Disk space > 5GB available
- [ ] No gradle lock file issues: `./gradlew clean`
- [ ] All dependencies resolved

---

## Build Verification

### After Debug Build
```powershell
# Check APK exists
Get-Item "app/build/outputs/apk/debug/app-debug.apk"

# Check file size (should be > 50MB)
(Get-Item "app/build/outputs/apk/debug/app-debug.apk").Length / 1MB
```

### After Release Build
```powershell
# Check AAB exists
Get-Item "app/build/outputs/bundle/release/app-release.aab"

# Check file size (should be > 40MB)
(Get-Item "app/build/outputs/bundle/release/app-release.aab").Length / 1MB
```

---

## Deployment Steps

### Step 1: Test on Device (Debug APK)
```powershell
# Install debug APK on test device
adb install -r "app/build/outputs/apk/debug/app-debug.apk"

# Launch app
adb shell am start -n com.alfanews.telugu/.MainActivity

# Verify version (Settings → About)
# Should show: Version Sree_5.1.1 (573)
```

### Step 2: Manual QA Testing

**Test Case 1: Admin Login**
1. Log in with admin account
2. Check profile page
3. ✅ VERIFY: Shows "Admin" role (not Guest)
4. ✅ VERIFY: Admin panel accessible

**Test Case 2: User Management**
1. Navigate to Admin → Manage Users
2. Check user list displays
3. ✅ VERIFY: Users show correct roles
4. ✅ VERIFY: No users showing as "Guest"

**Test Case 3: App Restart**
1. Close app completely
2. Reopen app
3. ✅ VERIFY: Role persists correctly
4. ✅ VERIFY: No role reversion to Guest

### Step 3: Upload to Play Console
1. Go to Play Console: https://play.google.com/console
2. Select AlfaNews app
3. Navigate to "Release" → "Production"
4. Click "Create release"
5. Upload `app-release.aab` file
6. Set version name: `5.1.1`
7. Add release notes:
   ```
   🐛 Bug Fixes:
   - Fixed user role display issue (admins showing as guests)
   - Improved Firestore deserialization reliability
   - Enhanced user management accuracy
   ```
8. Review pricing & distribution
9. Start rollout

### Step 4: Rollout Strategy

**Phase 1: 10% Internal Test**
- Wait 24 hours
- Monitor crash logs
- Verify admin functions work
- Check no new errors in Analytics

**Phase 2: 50% Beta**
- Expand to selected markets
- Gather user feedback
- Verify performance metrics
- Monitor ANRs and crashes

**Phase 3: 100% Production**
- Rollout to all users
- Continue monitoring
- Be ready to rollback if needed

---

## Post-Build Artifacts

### Debug Build
```
📁 app/build/outputs/apk/debug/
├── app-debug.apk (for testing)
└── app-debug.apk.map (debuggable)
```

### Release Build
```
📁 app/build/outputs/bundle/release/
├── app-release.aab (for Play Store)
└── app-release-mapping.txt (proguard mappings)

📁 app/build/outputs/apk/release/
├── app-release.apk (direct sideload alternative)
└── app-release-signed.apk
```

---

## Troubleshooting

### Build Fails - Gradle Sync Issue
```powershell
# Clean gradle cache
Remove-Item -Recurse ".gradle"
Remove-Item -Recurse ".kotlin"

# Retry build
./gradlew clean build
```

### Build Fails - Out of Memory
```powershell
# Set JVM heap size
$env:GRADLE_OPTS = "-Xmx2g"
./gradlew clean build
```

### Build Fails - Dependency Issue
```powershell
# Update dependencies
./gradlew --refresh-dependencies clean build
```

### APK Installation Fails
```powershell
# Clear existing app
adb uninstall com.alfanews.telugu

# Reinstall
adb install -r "app/build/outputs/apk/debug/app-debug.apk"
```

---

## Git Commit & Tag

After successful builds:

```powershell
# Stage changes
git add -A

# Commit with version info
git commit -m "chore: upgrade version to 5.1.1 - fix user role display bug"

# Create version tag
git tag -a v5.1.1 -m "Release version 5.1.1 - User Role Fix"

# Push to remote
git push origin main
git push origin v5.1.1
```

---

## Release Notes Template

Use this for Play Store and user communications:

```
🔧 Version 5.1.1 - Bug Fix Release

🐛 What's Fixed:
✅ Fixed issue where administrators were displayed as "Guest"
✅ Fixed role display for editors and reporters
✅ Improved user management accuracy
✅ Enhanced Firestore data deserialization

⚡ What's New:
- Better role handling during app startup
- More reliable user role detection
- Improved performance

📦 No Database Changes Required
💾 All user data preserved
🔄 Fully backward compatible

Update now to see your correct role! 🎉
```

---

## Monitoring After Deployment

### Key Metrics to Watch

1. **Crash Rate**
   - Should be < 0.1%
   - Watch for role-related exceptions

2. **ANR Rate**
   - Should remain < 0.05%
   - Monitor first 48 hours

3. **User Feedback**
   - Rating should improve
   - Look for role-related complaints

4. **Performance**
   - App start time: < 5 seconds
   - Memory usage: < 300MB

### Firebase Analytics

```
Monitor:
1. User role distribution
2. Admin panel usage
3. User management clicks
4. Error logs for role issues
5. Session duration
```

---

## Rollback Procedure

If critical issues emerge:

```powershell
# Immediately pause rollout in Play Console
# Set to previous version: Sree_5.1

git revert v5.1.1 --no-edit
git push origin main

# Build and deploy v5.1 again
./gradlew clean bundleRelease
```

---

## Sign-Off Checklist

Before marking as complete:

- [ ] Debug APK built successfully
- [ ] Release AAB built successfully
- [ ] Manual testing passed all cases
- [ ] Version number verified (5.1.1)
- [ ] Build code verified (573)
- [ ] Git commit and tag created
- [ ] AAB uploaded to Play Console
- [ ] Release notes prepared
- [ ] Rollout plan approved
- [ ] Monitoring dashboards ready
- [ ] Rollback plan confirmed
- [ ] Team notified of deployment

---

## Support Contacts

For build/deployment issues:
- Build Engineer: [Contact]
- QA Lead: [Contact]
- DevOps: [Contact]

---

**Build Status: ✅ READY**  
**Deployment Status: ✅ READY**  
**Date: April 24, 2026**  


