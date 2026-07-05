# Walkthrough - Smart Political News Filtering

I have implemented a location-based political news filtering system for the home feed. This system ensures that users see political news relevant to their specific state, even when the news content is scraped or shortened and doesn't explicitly mention the state name.

## Changes Made

### 1. Enhanced State Mapping
Updated `mapDistrictToState` in [NewsFeedViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt) to recognize state names in both Telugu and English.

```kotlin
private fun mapDistrictToState(district: String?): String? {
    if (district == null) return null
    val telanganaStrings = listOf("Telangana", "Telangana State", "TS", "తెలంగాణ", "Telangana News")
    val apStrings = listOf("Andhra Pradesh", "AndhraPradesh", "AP", "ఆంధ్రప్రదేశ్", "Andhra", "ఆంధ్ర", "AP News")
    // ... logic to return "Telangana" or "Andhra Pradesh"
}
```

### 2. Smart Entity-Based Inference
Implemented `inferStateFromPost` in [NewsFeedViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt). This function uses political figures and party names to determine the state of a post when metadata is insufficient.

- **Telangana Keywords**: రేవంత్, కేసీఆర్, కేటీఆర్, కోమటిరెడ్డి, బీఆర్ఎస్, etc.
- **Andhra Pradesh Keywords**: చంద్రబాబు, పవన్ కళ్యాణ్, జగన్, వైసీపీ, టీడీపీ, etc.

### 3. Integrated Filtering Logic
Modified the `rankAndBlendPosts` filtering loop in [NewsFeedViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt) to apply the new rules:

- **Telangana Users**: See Telangana politics + National/General politics.
- **Andhra Pradesh Users**: See AP politics + National/General politics.
- **Hyderabad Users**: See politics from **both states**, as requested.

## Verification Results

### Automated Tests
- Successfully ran `:app:compileDebugKotlin` to ensure all changes are syntactically correct and type-safe.

### Manual Verification Path
1. **Scenario 1 (Telangana)**: Set district to "Warangal". Verify that news mentioning "Komatireddy" or "Revanth" appears, but news mentioning "Jagan" or "TDP" (without general context) is hidden.
2. **Scenario 2 (AP)**: Set district to "Vijayawada". Verify that news mentioning "Chandrababu" or "Jagan" appears, while "BRS" or "KCR" specific news is hidden.
3. **Scenario 3 (Hyderabad)**: Set district to "హైదరాబాద్". Verify that political news from both states is visible in the feed.

> [!TIP]
> This entity-based approach ensures that even short, scraped headlines like "మంత్రి కోమటిరెడ్డి వ్యాఖ్యానించారు" are correctly routed to the right audience.
