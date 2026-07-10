# Implementation Plan - Universal Logo Header and Contextual Navigation Row

The goal is to provide a consistent header structure across the entire app.
1. **Top Row**: A constant `LogoHeader` showing the Menu button and Logo on the left. For Home and Local feeds, the District name will appear on the right (as it was before).
2. **Second Row**: For sub-pages, a dedicated row below the logo header containing a Back Button and the page Title.
3. **Bottom**: A constant red strip separator.

## Proposed Changes

### [Common Components]

#### [MODIFY] [LogoHeader.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LogoHeader.kt)
- Ensure the layout has:
    - **Left**: Menu Button and Logo.
    - **Right**: District selector (Location icon + Name), visible only when `showDistrictSelector` is true.
- Remove the internal red strip (it will be moved to the main `topBar` container for better consistency).

#### [NEW] [ContextualHeaders.kt] (or within `MainScreen.kt`)
Create a helper for the sub-page navigation row:
- `SubPageHeader(title: String, onBack: () -> Unit)`: A simple row with an `ArrowBack` icon and a `Text` title.

### [Main Navigation]

#### [MODIFY] [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
- Refactor the `Scaffold`'s `topBar` to a unified container (`Column`):
    - **Row 1**: `LogoHeader`.
        - Provide `onMenuClick` always.
        - Provide `district` and `onDistrictClick` only if `activeTab` is "home" or "local".
    - **Row 2 (Conditional)**: If it's a sub-page (Reporters, Messages, Leaderboard, Post News, Edit Profile, Join Reporter, or any Policy page):
        - Show the `SubPageHeader` with the corresponding title and `onBack` logic.
    - **Row 3**: The constant red strip divider.
- Standardize the logic for all navigation states (`showPostNewsPage`, `reporterIdToShow`, etc.) to use this unified `topBar`.

### [Sub-Pages]

#### [MODIFY] All Sub-Page Views
(Leaderboard, Reporters, Messages, EditProfile, PostNews, JoinReporter, ReporterProfile, Policy pages)
- **REMOVE** all internal headers and back button logic. These screens will now simply start with their content, relying on the `topBar` provided by `MainScreen`.

### [News Card]

#### [MODIFY] [NewsCardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsCardView.kt)
- Ensure no header or back button logic exists inside the card.

## Verification Plan

### Manual Verification
1.  **Home Feed**:
    - Top: [Menu] [alfa news] ... [District Name]
    - Below: Red Strip.
    - Click District -> Change district.
2.  **Reporters Page**:
    - Top: [Menu] [alfa news]
    - Below Logo: [Back Button] [రిపోర్టర్లు]
    - Below that: Red Strip.
    - Click Back -> Return to Profile.
3.  **Post News**:
    - Same structure as Reporters page.
    - Click Back -> Return to previous screen.
4.  **News Cards**:
    - Scroll through Home feed -> Headers remain constant at the top. News cards should have NO internal headers.
