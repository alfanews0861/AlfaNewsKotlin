# Walkthrough - Local Reporter Assignment & Point Logic Refinement

I have refined the reporter assignment system to ensure fair distribution of points while maintaining the requested display credit for Mandalam reporters.

## Changes Made

### 1. Fairness in Points Distribution
Updated the main news trigger [onNewsPostCreated](file:///C:/AlfaKotlin/functions/src/news_handler.ts):
- **Capture Original Submitter**: The system now stores the ID of the person who actually uploaded the news (`originalReporterId`) at the very beginning of the process.
- **Incentive Redirect**: Even though the news is displayed under the Mandalam reporter's name, the **points** are awarded to the `originalReporterId`.
- This ensures that if a reporter (or citizen) finds news first in another Mandalam, they are still rewarded for their speed and effort.

### 2. Display Credit Persistence
The display logic remains intact:
- All news from an assigned Mandalam will still show the **Assigned Reporter's Name** in the app.
- This maintains a professional, consistent local feed managed by the local representative.

### 3. System Safeguards
Updated [reporter_handler.ts](file:///C:/AlfaKotlin/functions/src/reporter_handler.ts):
- Added an explicit check in the point awarding logic to skip all `BOT_` or `SYSTEM_` accounts.
- This prevents scrapers or automated tools from accumulating points.

### 4. Logic Verification
I updated the scratch script [verify_assignment_logic.js](file:///C:/AlfaKotlin/functions/scratch/verify_assignment_logic.js) to simulate this specific scenario:
- **Scenario**: Reporter A submits news for a Mandalam assigned to Reporter B.
- **Result**: The script verifies that Reporter B gets the **name credit**, but Reporter A gets the **points**.

---
**Summary of Logic**:
- **Name shown in App**: Mandalam Assigned Reporter.
- **Points awarded to**: Original User who posted the news.
- **System News**: Show Mandalam Reporter name, but award **0 points**.
