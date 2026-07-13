# Walkthrough - SSML Voiceover Fix

I have fixed the issue where SSML tags and internal attributes (like "decibels" and "92%") were being spoken as part of the voiceover. This was caused by a regex replacement order conflict.

## Changes Made

### Cloud Functions

#### [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- **Reordered Text Processing**: Moved the number-to-cardinal conversion (`say-as`) to execute *before* the SSML tags are injected. This prevents the regex from matching numbers inside tag attributes like `volume="+2.5dB"`.
- **Fixed Speed (130%)**: Removed the `rate="92%"` override from the `[[STRESS]]` replacement. Stressed segments now inherit the global `1.30` (130%) speed requested for the news feed.
- **Improved SSML Integrity**: Ensured that special characters in attributes are not processed as news content.

## Verification Results

### Build Status
- [x] `npm run build` passed successfully in the `functions` directory.

### SSML Logic Verification
- Numbers in the news text (e.g., "10 మంది") are correctly wrapped in `<say-as interpret-as="cardinal">`.
- Stressed text wrapping happens after number processing, ensuring tags are well-nested: `<prosody volume="+2.5dB"><say-as ...>10</say-as> మంది</prosody>`.
- The `rate="92%"` which was causing the speed drop and literal reading of "92 percent" has been removed.

> [!TIP]
> This fix ensures the voiceover is professional, fast (130%), and free of technical jargon being read aloud.
