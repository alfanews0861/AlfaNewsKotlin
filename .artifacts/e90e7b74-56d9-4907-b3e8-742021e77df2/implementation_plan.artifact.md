# Implementation Plan - Percentage-based Logo Sizing for Videos

Currently, the logo added to news videos has a fixed size (90px) and fixed padding (25px). This results in inconsistent logo sizes across different video resolutions (SD, HD, Full HD). This plan proposes switching to percentage-based sizing and positioning using the `scale2ref` FFmpeg filter.

## User Review Required

> [!IMPORTANT]
> The logo will now occupy **12% of the video width** and have a **2% margin** from the top-right corner. This will make it look consistent whether the video is 480p, 720p, or 1080p.

## Proposed Changes

### Backend (Cloud Functions)

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- Update the FFmpeg filter logic to use `scale2ref` for the logo.
- Change fixed `90px` width to `main_w*0.12` (12% of video width).
- Change fixed `25px` padding to `W*0.02` (2% of video width).

```typescript
// Current
filters.push('[2:v]scale=90:-1[l];[0:v][l]overlay=W-w-25:25[vl]');

// Proposed
filters.push('[2:v][0:v]scale2ref=w=main_w*0.12:h=-1[l][vref];[vref][l]overlay=W-w-W*0.02:W*0.02[vl]');
```

## Verification Plan

### Automated Tests
- I will check the TypeScript code for syntax errors.
- Since I cannot run FFmpeg directly in this environment to process a real video, I will rely on the correctness of the FFmpeg filter syntax which is standard for relative scaling.

### Manual Verification
- The user can deploy the functions and process a few videos of different resolutions (e.g., one SD and one HD) to verify the logo appears proportionally identical.
