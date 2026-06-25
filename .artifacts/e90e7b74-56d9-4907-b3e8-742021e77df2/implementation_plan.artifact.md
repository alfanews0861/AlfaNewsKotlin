# Implementation Plan - Adding Scrolling Text Watermark

The user wants a scrolling "alfanews" watermark moving from right to left across the video at a height near the middle, with a font size of 40px.

## User Review Required

> [!IMPORTANT]
> To ensure the text renders correctly in the Cloud Functions environment, a font file (e.g., `Arial.ttf` or `Roboto-Regular.ttf`) should ideally be present. I will attempt to use a standard system font path, but if it fails, a font file may need to be added to the `functions/assets` folder.

> [!NOTE]
> The watermark will be semi-transparent (`white@0.3`) to avoid obscuring the news content too much, while still being visible.

## Proposed Changes

### Backend (Cloud Functions)

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- Update the FFmpeg filter chain to include a `drawtext` filter.
- Position: Center of the screen vertically (`y=(H-th)/2`).
- Animation: Right to left scrolling using `x=W-mod(t*150, W+tw)`.
- Font size: 40px.

```typescript
// Proposed filter addition
filters.push(`${vMap}drawtext=text='alfanews':fontcolor=white@0.3:fontsize=40:x=W-mod(t*150,W+tw):y=(H-th)/2[vtext]`);
```

## Verification Plan

### Automated Tests
- Check for TypeScript compilation errors with `npm run build`.

### Manual Verification
- Deploy and process a video.
- Check if the text "alfanews" scrolls from right to left across the middle of the video.
