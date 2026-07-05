# Implementation Plan - Balanced News Feed Filters

The goal is to show a rich mix of news while respecting state-level political interests and local-level reporter news boundaries.

## Proposed Changes

### [NewsFeedViewModel.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt)

#### [MODIFY] [rankAndBlendPosts](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/viewmodels/NewsFeedViewModel.kt#L388-L430)
- **Refined Political Filter**:
    - Keep state-based filtering: Telangana users see TS politics, AP users see AP politics.
    - Hyderabad users see both.
    - National/Neutral politics are shown to everyone.
- **Strict District Reporter Filter**:
    - News categorized as "జిల్లా వార్త" (District News) AND submitted by a reporter (`isReporter == true`) will be filtered out UNLESS it matches the user's selected district.
- **Global News Access**:
    - Ensure categories like "వినోదం" (Cinema/Entertainment), "క్రీడలు" (Sports), "టెక్నాలజీ" (Tech) bypass district filters entirely so they are visible to all users.
- **Clean Logic**: Simplify the filter block to be more readable and prevent "chaotic" overlaps that block global content.

## Verification Plan

### Logic Verification
- Test with different user districts to ensure:
    - Cinema news appears regardless of district.
    - Politics follows the state boundary (TS vs AP).
    - Local reporter news from other districts is hidden.
