# Implementation Plan - Restoring YouTube Video Metadata (Hashtags, Location, Places)

Restore the missing metadata in YouTube video descriptions, including hashtags, location, and mentioned places, as requested by the user.

## Proposed Changes

### [functions]

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
Update the construction of the `description` variable used for YouTube uploads.

-   **Location**: Add a line for the primary location (`data.location`).
-   **Places**: Add a line for additional locations/places mentioned in the news (`data.entities.locations`).
-   **Hashtags**: Generate a list of hashtags from the AI-generated tags, category, and location.
-   **Formatting**: Ensure the description follows a clean structure with emojis for better readability.

## Verification Plan

### Automated Tests
- Verify that the code builds correctly in the `functions` directory.
- `cd functions && npm run build`

### Manual Verification
- Once deployed, new video uploads to YouTube should include the enhanced description.
- I will check the logic to ensure no duplicate hashtags are created and that whitespace is handled correctly.
