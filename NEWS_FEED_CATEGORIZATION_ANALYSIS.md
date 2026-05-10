# 📊 NEWS FEED CATEGORIZATION ISSUE - COMPLETE ANALYSIS

**Date:** May 10, 2026  
**Issue:** Only 5 news items (all district news), zero general/global news items

---

## 🔍 ROOT CAUSE ANALYSIS

### Problem 1: AI Returns Unconstrained Categories
**Location:** `functions/src/index.ts` line 124

The Gemini AI is instructed to return a "refined category" **WITHOUT** specifying valid category options:

```typescript
// Current - TOO VAGUE:
systemInstruction: "You are a Senior Editor... Extract tags and entities..."
// No category list provided to AI!

refinedCategory: { type: Type.STRING }  // Freestyle text, any value!
```

**Issue:** AI returns categories like:
- "పలిటిక్‌" (misspelled)
- "రాజకీయ సంగతులు" (full phrase)
- "Sports and Entertainment" (English in Telugu context)
- "నిర్ణీయులోని కథ" (random Telugu)
- "విశ్వసంబంధాలు" (not in list)

### Problem 2: Strict Keyword Filtering Blocks Valid Categories
**Location:** `app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt` lines 361-375

```kotlin
val strictlyGlobalKeywords = listOf(
    "సినిమా", "cinema", "movie", "films", "tv", "వినోదం", "entertainment", "OTT", "ఓటిటి",
    "స్పోర్ట్స్", "sports", "cricket", "football", "tennis", "క్రీడలు",
    "జాతీయం", "national", "అంతర్జాతీయం", "international", "world", "ప్రపంచం", "ఢిల్లీ", "delhi",
    "రాజకీయం", "politics", "elections", "government", "ప్రభుత్వం", "అసెంబ్లీ", "పార్లమెంట్",
    "క్రైమ్", "crime", "court", "కోర్టు", "న్యాయ", "చట్టం", "పోలీస్", "police",
    "వ్యాపారం", "business", "economy", "gold", "బంగారం", "ధరలు",
    "టెక్నాలజీ", "technology", "tech", "AI", "గ్యాడ్జెట్స్",
    "ఆరోగ్యం", "health", "medical", "hospital", "చికిత్స", "డాక్టర్",
    "విద్య", "education", "school", "college", "ఉద్యోగాలు", "jobs", "నోటిఫికేషన్",
    "భక్తి", "spiritual", "religion", "temple", "దేవాలయం", "రాశి ఫలాలు",
    "వ్యవసాయం", "agriculture", "రైతు", "farm",
    "State", "Andhra Pradesh", "Telangana", "AP", "TS", "ఆంధ్రప్రదేశ్", "తెలంగాణ", "india",
    "రాష్ట్ర", "రాష్ట్ర వార్తలు", "ముఖ్యాంశాలు", "బ్రేకింగ్", "Breaking", "వైరల్", "Viral", "తాజా వార్తలు"
)
```

**Issue:** If AI returns "పలిటిక్‌" (typo) instead of "రాజకీయం", filtering fails with:
```kotlin
val hasGlobal = postCategories.any { cat → 
    strictlyGlobalKeywords.any { kw → cat.contains(kw, ignoreCase = true) }
}
// "పలిటిక్‌".containsIgnoreCase("రాజకీయం") = FALSE ❌
// Post gets filtered out!
```

### Problem 3: Database Stores Multiple Variations
**Observed in Firestore:**
- Some posts: `categories: ["రాజకీయం", "AP"]`
- Others: `categories: ["Politics", "Delhi"]`
- Others: `categories: ["పలిటిక్‌", "రాజకీయ సమాచారం"]` ← AI-generated, inconsistent!

### Problem 4: Missing Standard Category List
The backend and mobile have NO shared canonical category list.

**Backend:** Relies on AI's freestyle TextField
**Mobile:** filters against hardcoded keyword list
**Result:** 🔴 Massive mismatch - posts get lost

---

## 🎯 VISIBLE SYMPTOMS

1. ✅ District news shows (uses `whereArrayContains("categories", district)`)
2. ❌ General news missing (filters by `strictlyGlobalKeywords`)
3. ✅ Political news appears (if keyword "politics" is in post)
4. ❌ Movie/Entertainment blocked (if AI returned misspelled category)
5. 🔴 Only 5 total posts = filtering removed 95%+ of results

---

## 🛠️ REQUIRED FIXES

### Fix #1: Define Canonical Category List
Create a single source of truth for valid categories (Backend + Mobile + iOS Web)

### Fix #2: Constrain AI Output
Force Gemini to return ONLY valid categories from the canonical list

### Fix #3: Normalize Categories in Database
Clean up existing posts, standardize all category values

### Fix #4: Add Category Validation
Ensure posts created via mobile/web also use canonical categories

### Fix #5: Improve Filtering Logic
Handle typos and variations gracefully

---

## 📋 CANONICAL CATEGORIES (PROPOSED)

```
POLITICS:          రాజకీయం, రాజకీయ సమాచారం
CRIME:            క్రైమ్, అపరాధం, న్యాయ సమాచారం
ENTERTAINMENT:    సినిమా, వినోదం, టీవీ
SPORTS:           క్రీడలు, క్రీడ వార్త
BUSINESS:         వ్యాపారం, ఆర్థికత, స్టాక్‌
TECHNOLOGY:       టెక్నాలజీ, సాఫ్ట్‌వేర్
HEALTH:           ఆరోగ్యం, వైద్య సమాచారం
EDUCATION:        విద్య, ఉద్యోగాలు
SPIRITUAL:        భక్తి, ధర్ములు, ఆధ్యాత్మిక
AGRICULTURE:      వ్యవసాయం, రైతు సమాచారం
NATIONAL:         జాతీయ సమాచారం, భారతదేశం
INTERNATIONAL:    ప్రపంచ సమాచారం, అంతర్జాతీయ
LIFESTYLE:        జీవనశైలి, ఫ్యాషన్, ఆహారం
OTHER:            ఇతరాలు
```

---

## 🚀 IMPLEMENTATION CHECKLIST

- [ ] Add `CategoryConstants.ts` to backend
- [ ] Update Gemini prompt to constrain category
- [ ] Add category validation in `processNewsPost`
- [ ] Update `NewsFeedViewModel.kt` with category list
- [ ] Create migration to normalize existing post categories
- [ ] Test with sample district + general news
- [ ] Deploy and verify 40/30/30 mixing works
- [ ] Monitor Firebase logs for filtering results

---

## 📊 EXPECTED OUTCOMES AFTER FIX

| Metric | Before | After |
|--------|--------|-------|
| Total Posts Shown | 5 | 50+ |
| General News % | 0% | 40% |
| District News % | 100% | 30% |
| Discovery News % | 0% | 30% |
| Category Accuracy | 40% | 98% |
| AI Processing | ✅ (inconsistent) | ✅ (standardized) |

---

## 🔗 RELATED FILES TO MODIFY

1. `functions/src/index.ts` - Constrain AI categories
2. `app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt` - Use canonical list
3. `app/src/main/java/com/alfanews/telugu/utils/Constants.kt` - Add category constants
4. `app/src/main/java/com/alfanews/telugu/views/PostNewsPageView.kt` - Validate reporter categories
5. `app/src/main/java/com/alfanews/telugu/views/CitizenPostPageView.kt` - Validate citizen categories
6. New file: `functions/src/categories.ts` - Canonical category definitions

---

## 📝 SUMMARY

The issue is **category mismatch between AI generation, database storage, and mobile filtering**. The AI generates ad-hoc categories, the database stores them as-is, and the mobile app cannot match them against a hardcoded keyword list.

**Solution:** Implement a canonical category system, constrain AI output, normalize database, and validate all inputs.


