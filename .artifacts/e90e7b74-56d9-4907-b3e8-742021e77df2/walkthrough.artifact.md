# Walkthrough - Percentage-based Logo Sizing

I have successfully updated the news video processing logic to handle logos proportionally across different video resolutions.

## Changes Made

### Backend (Cloud Functions)

#### [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- Replaced the fixed pixel scaling for the logo with a dynamic scaling filter.
- **Old Logic**: Fixed `90px` width and `25px` padding.
- **New Logic**:
    - Logo width is now **12%** of the video width (`main_w*0.12`).
    - Padding/Margin is now **2%** of the video width (`W*0.02`).
- Used the `scale2ref` FFmpeg filter to ensure the logo is scaled relative to the input video stream, regardless of its original resolution.

```diff
- filters.push('[2:v]scale=90:-1[l];[0:v][l]overlay=W-w-25:25[vl]');
+ filters.push('[2:v][0:v]scale2ref=w=main_w*0.12:h=-1[l][vref];[vref][l]overlay=W-w-W*0.02:W*0.02[vl]');
```

## Verification Results

### Automated Tests
- Ran `npm run build` in the `functions` directory to ensure no TypeScript compilation errors were introduced.
- **Result**: `exitCode: 0` (Build successful).

### Manual Verification Recommendation
- Deploy the updated functions: `cd functions; firebase deploy --only functions`.
- Upload a standard resolution (480p) video and a High Definition (1080p) video through the reporter app.
- Verify that the logo appears at the same relative size and position in both videos.
