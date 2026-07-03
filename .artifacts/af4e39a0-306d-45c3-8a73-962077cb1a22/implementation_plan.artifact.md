# Implementation Plan - Automated AI Affiliate News Feed

This plan outlines the automation of fetching product deals from Amazon and Flipkart, converting them into news stories using Gemini AI, and posting them to the AlfaNews feed daily at 3:00 AM IST.

## User Review Required

> [!IMPORTANT]
> **API Credentials**: The user will need to provide Amazon PA API 5.0 credentials (Access Key, Secret Key, Associate Tag) and Flipkart Affiliate API credentials (Tracking ID, API Token) via the new Admin page.
>
> **Amazon Signing**: Amazon PA API 5.0 requires AWS Signature V4. I will implement a simplified version using native Node.js crypto/fetch or request the user to allow adding the `amazon-paapi` dependency if it becomes too complex.
>
> **Schedule**: The function will run at `0 21 * * *` UTC, which corresponds to 3:00 AM IST.

## Proposed Changes

### [Backend] Cloud Functions (TypeScript)

#### [NEW] [affiliate_handler.ts](file:///C:/AlfaKotlin/functions/src/affiliate_handler.ts)
- Implement `scheduleDailyAffiliateDeals` using `onSchedule`.
- Fetch API configurations from Firestore `configs/affiliateApi`.
- Implement `fetchAmazonDeals()` and `fetchFlipkartDeals()`.
- Use `processProductWithAI` (Gemini) to convert product titles/descriptions into Telugu news.
- Save to Firestore `news` collection with `type: "affiliate"`, `approved: true`, and `location: "India"`.
- Instead of a specific "Shop Now" button, the link will be handled in the content logic.

#### [MODIFY] [index.ts](file:///C:/AlfaKotlin/functions/src/index.ts)
- Export the new `scheduleDailyAffiliateDeals` function.

### [Mobile] Android App (Kotlin)

#### [NEW] [AffiliateSettingsView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AffiliateSettingsView.kt)
- A form for Admins to enter and save:
    - Amazon: Access Key, Secret Key, Associate Tag.
    - Flipkart: Tracking ID, API Token.
- Saves to `configs/affiliateApi`.

#### [MODIFY] [AdminPanelView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdminPanelView.kt)
- Add "Affiliate News" to the navigation drawer for Admins.
- Route to `AffiliateSettingsView`.

#### [MODIFY] [NewsCardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsCardView.kt)
- Check if `post.type == "affiliate"`.
- If so, remove the "Shop Now" button.
- Append or include "మరిన్ని వివరాలకు..." at the end of the news content (or as a clickable link in the column).
- Clicking this text will open the affiliate URL.

---

## Verification Plan

### Automated Tests
- Build Cloud Functions: `npm run build`.
- Build Android App: `./gradlew app:assembleDebug`.

### Manual Verification
1. **Admin Page**: Navigate to Admin -> Affiliate News. Save dummy keys. Verify they are saved in Firestore.
2. **Cloud Function Trigger**: Manually trigger the function in the Firebase console (or locally via emulator).
3. **News Feed**: Verify a new "affiliate" type post appears.
4. **UI Check**: Verify it looks like a regular post but contains the "మరిన్ని వివరాలకు..." link instead of a button.
