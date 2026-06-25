# Walkthrough - Percentage-based Logo Sizing

I have successfully updated the news video processing logic to handle logos proportionally across different video resolutions.

## Changes Made

### Backend (Cloud Functions)

#### [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- **Proportional Logo Scaling**: Replaced fixed pixel scaling for the logo with a dynamic scaling filter.
    - Logo width: **12%** of video width.
    - Padding: **2%** of video width.
- **Scrolling Watermark**: Added a scrolling "alfanews" text watermark.
    - **Movement**: Right to left across the video.
    - **Position**: Vertically centered (`y=(H-th)/2`).
    - **Size**: `40px`.
    - **Appearance**: Semi-transparent white (`white@0.3`) for a subtle look.

```diff
- filters.push('[2:v][0:v]scale2ref=w=main_w*0.12:h=-1[l][vref];[vref][l]overlay=W-w-W*0.02:W*0.02[vl]');
+ if (hasLogo) {
+     filters.push('[2:v][0:v]scale2ref=w=main_w*0.12:h=-1[l][vref];[vref][l]overlay=W-w-W*0.02:W*0.02[vlogo]');
+     vMap = '[vlogo]';
+ }
+ // Add scrolling watermark "alfanews"
+ filters.push(`${vMap}drawtext=text='alfanews':fontcolor=white@0.3:fontsize=40:x=W-mod(t*100,W+tw):y=(H-th)/2[vtext]`);
+ vMap = '[vtext]';
```

## Verification Results

### Automated Tests
- Ran `npm run build` in the `functions` directory to ensure no TypeScript compilation errors were introduced.
- **Result**: `exitCode: 0` (Build successful).

### Manual Verification Recommendation
- Deploy the updated functions: `cd functions; firebase deploy --only functions`.
- Upload a standard resolution (480p) video and a High Definition (1080p) video through the reporter app.
- Verify that the logo appears at the same relative size and position in both videos.
