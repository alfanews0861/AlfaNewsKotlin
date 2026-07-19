# Fix SSML Tag Reading in News Voiceover

The voiceover in reporter video news is reading SSML tags literally instead of interpreting them. This happens because the text is truncated to 4900 characters *after* SSML tags are added, which often cuts tags in half and results in malformed XML.

## User Review Required

> [!IMPORTANT]
> I am moving the truncation logic to happen **before** SSML tags are injected. This ensures that all added tags are complete and valid. I am also reducing the truncation limit for the base text to 4000 characters to leave ample room for the added SSML tags (which can significantly increase the string length) without hitting the Google Cloud TTS 5000-character limit.

## Proposed Changes

### Backend (Cloud Functions)

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- Truncate `teluguVocal` to 4000 characters before any regex replacements.
- Ensure `processedText` is used entirely in the final SSML template without further truncation.
- Verify nested `<prosody>` tags are handled correctly or simplified.

## Verification Plan

### Automated Tests
- Create a scratch script `verify_ssml.ts` to simulate the processing of a 6000-character string and confirm the resulting SSML is valid XML.

### Manual Verification
- Deploy the updated `news_handler.ts`.
- Submit a long reporter post and verify the audio output via logs or by listening to the generated video.
