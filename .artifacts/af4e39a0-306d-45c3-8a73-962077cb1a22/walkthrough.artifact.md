# Walkthrough - Automated AI Affiliate News Feed

We have implemented a fully automated system to fetch product deals from Amazon India and Flipkart, convert them into Telugu news using Gemini AI, and post them daily to the AlfaNews feed.

## Key Features

### 1. Daily Automation (3:00 AM IST)
- A new Cloud Function `scheduleDailyAffiliateDeals` runs every day at 3:00 AM IST.
- It fetches the latest deals using programmatic APIs (Amazon PA API 5.0 and Flipkart Affiliate API).

### 2. AI News Generation
- Raw product titles and prices are sent to Gemini AI.
- AI transforms them into engaging, professional news stories in Telugu (and English).
- Posts are automatically approved and published to the feed with `type: "affiliate"`.

### 3. Admin API Management
- A new **Affiliate News API** page is added to the Admin Panel.
- Admins can securely save Amazon (Access Key, Secret Key, Tag) and Flipkart (Affiliate ID, Token) credentials.
- These settings are stored in Firestore under `configs/affiliateApi`.

### 4. Native Feed Experience
- Affiliate posts look just like regular news posts.
- Instead of a "Shop Now" button, they include a subtle **"మరిన్ని వివరాలకు ఇక్కడ క్లిక్ చేయండి..."** (Click here for more details...) link.
- This ensures the user experience remains consistent with a news app.

## Implementation Details

### Backend
- **[affiliate_handler.ts](file:///C:/AlfaKotlin/functions/src/affiliate_handler.ts)**: Contains the fetch logic and a manual implementation of **AWS Signature V4** for Amazon PA API 5.0 security.

### Frontend
- **[AffiliateSettingsView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AffiliateSettingsView.kt)**: The new settings UI for Admins.
- **[AdminPanelView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/AdminPanelView.kt)**: Navigation update to include the settings page.
- **[NewsCardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsCardView.kt)**: UI logic to display affiliate links in a news format.

## Verification Results
- **Build Status**: ✅ Android app build successful (`app:assembleDebug`).
- **Function Build**: ✅ Cloud Functions compiled without errors.

---
> [!TIP]
> To test immediately, you can manually trigger the `scheduleDailyAffiliateDeals` function from the Firebase Console once you have saved your API keys in the app.
