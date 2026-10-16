# 🔧 Notification System - Technical Architecture & Audit

## Executive Summary

AlfaNews uses a high-performance, cost-effective notification architecture built on **FCM Topics** and **Cloud Functions (Node.js 2nd Gen)**, synchronized with a Jetpack Compose Android client.

---

## 🎯 System Architecture

### Notification Pipeline

```
[News Creation / Approval]
        │
        ├──► 1. Scheduled Push Engine (4x Daily: 8 AM, 1 PM, 6 PM, 9 PM IST)
        │         ├─ Trending Score: (views * 1.5 + aiScore * 5) / (ageHours + 1.5)^1.15 * imageMultiplier
        │         ├─ 8 AM:  Morning General Headlines ('all_users') ONLY
        │         ├─ 1 PM:  Local District Stories ('district_*') ONLY
        │         ├─ 6 PM:  Category Updates ('cat_*') ONLY
        │         └─ 9 PM:  Night Summary Roundup ('all_users') ONLY
        │
        └──► 2. Real-time Breaking Alerts (Firestore onNewsPostApprovedNotify)
                  ├─ Triggers on: isBreaking=true OR tone=BREAKING/URGENT/IMPORTANT (< 6h old)
                  ├─ Statewide scope  -> 'all_users' (Atomic max 5/day limit)
                  ├─ Local district   -> 'district_{hex}' (Canonical district, atomic max 3/day)
                  └─ Quiet Hours      -> 11:00 PM – 6:00 AM IST (Silent delivery except disasters)
```

---

## 🛡️ Critical Architectural Protections

### 1. Zero Notification Collision (Dedicated Slot Purpose)
- **Problem**: When General News and Category/District news were sent in the same run, users subscribed to multiple topics received 2–3 notification chimes at the exact same second.
- **Solution**: Dedicated slots:
  - **8 AM**: General Morning News (`all_users`)
  - **1 PM**: District Local News (`district_*`)
  - **6 PM**: Category News (`cat_*`)
  - **9 PM**: Night News Roundup (`all_users`)
- **Result**: Exactly **1 notification per user per scheduled slot**, eliminating spam.

### 2. Canonical District Normalization
- **Problem**: Variations in district names (e.g., "విజయవాడ" vs "ఎన్టీఆర్", "రాజమహేంద్రవరం" vs "తూర్పు గోదావరి", "నెల్లూరు" vs "శ్రీ పొట్టి శ్రీరాములు నెల్లూరు") caused local breaking news to fail district array lookups, erroneously defaulting to `all_users` and pushing hyper-local incidents statewide.
- **Solution**: `getCanonicalDistrict()` normalizes all Telugu and English district aliases to standard canonical district names before topic generation or breaking scope checks.
- **Result**: Local news stays local to `district_{hex}` topics; statewide news goes to `all_users`.

### 3. Clean 1:1 District Topic Subscription & Awaited Cleanup
- **Problem**: Unawaited `unsubscribeFromTopic()` calls in Android fired 120+ unawaited tasks simultaneously, leaving zombie district subscriptions active on the client.
- **Solution**: `NotificationHelper.syncDistrictTopic()` now cleanly awaits unsubscription from stale district topics and subscribes strictly to the single canonical district topic.

### 4. Zero-Cost Rich Media Architecture
- **Problem**: Sending Firebase Storage media URLs to 10,000+ devices triggers massive Firebase Storage egress bandwidth charges.
- **Solution**: Direct Firebase Storage URLs are routed through `wsrv.nl` (Cloudflare edge proxy with WebP compression at 640px). External CDN URLs (Eenadu, Sakshi, TV9, YouTube) are delivered as-is with ₹0 Firebase cost.

### 5. Automated Stale Device Garbage Collection
- **Problem**: Unregistered guest tokens in `anonymous_devices` accumulate infinitely in Firestore over time.
- **Solution**: `cleanupOldNews` scheduled daily at 3:00 AM IST sweeps and deletes documents with `lastActive` older than 90 days (500 docs per run).

---

## 📊 Schedule & Scope Matrix

| Slot | Target Topic | Scope | Sound / Priority | Purpose |
|------|--------------|-------|------------------|---------|
| **8:00 AM IST** | `all_users` | Statewide / National | High (Default Sound) | Morning Top Headlines |
| **1:00 PM IST** | `district_*` (x62) | Hyper-local District | High (Default Sound) | Lunchtime Local Happenings |
| **6:00 PM IST** | `cat_*` (x13) | Category Interests | High (Default Sound) | Evening Leisure / Special |
| **9:00 PM IST** | `all_users` | Statewide / National | High (Default Sound) | Night News Roundup |
| **Breaking Alert** | `district_*` or `all_users` | Real-time | High / Silent (11 PM - 6 AM) | Urgent breaking incidents |
| **Weather Alert** | `weather_grid_*` | 10km GPS cell / District | High (Default Sound) | Severe weather warnings |

---

*Last Updated: October 2026*
