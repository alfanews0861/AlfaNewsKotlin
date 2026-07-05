# Walkthrough - Reporters Page Fix

I have fixed the issue where the Reporters directory was appearing empty and improved the user experience.

## Changes

### 1. Automatic District Loading
Updated [ReportersView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ReportersView.kt) to automatically detect the current user's district from their profile. Now, when a reporter or subscriber opens the page, it immediately shows reporters from their own district instead of starting with a blank screen.

### 2. Improved Empty State UI
Added a descriptive prompt and icon for when no district is selected. This guides users to use the dropdown menus to find reporters in other areas.
- Added a "Please select a district" message in Telugu/English.
- Updated the loading logic to show a clearer state.

### 3. Mandal Search Index
Discovered and fixed a missing Firestore index. Searching for reporters by a specific Mandal was previously failing because the database lacked a composite index for `role + district + assignedMandal`. I have updated [firestore.indexes.json](file:///C:/AlfaKotlin/firestore.indexes.json) to include this.

### 4. Integration
Updated [MainScreen.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt) to properly pass the logged-in user's data to the Reporters directory.

## Verification Results

- **UI Prompt**: Verified that the "Select District" prompt appears if no district is associated with the user.
- **Auto-load**: Verified that the code correctly maps Telugu district names to their respective states (TS/AP) for auto-selection.
- **Data Query**: Verified the `ReportersViewModel` query logic matches the Firestore schema.

> [!TIP]
> Users should ensure their profile has a "District" set in the "Edit Profile" section for the best experience on the Reporters page.

render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/ReportersView.kt)
render_diffs(file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/MainScreen.kt)
render_diffs(file:///C:/AlfaKotlin/firestore.indexes.json)
