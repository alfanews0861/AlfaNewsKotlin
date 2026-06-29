# Header Redesign Implementation Plan

The user wants to redesign the app header with a black background, specific branding colors (Blue/Red), and Poppins typography. The header should also overlap the content (images) with a light shadow.

## User Review Required

> [!IMPORTANT]
> The header will now overlay the news content. I will use a semi-transparent black (approx 85% opacity) to ensure the overlapping effect looks natural while maintaining the requested "black background" look.

> [!NOTE]
> I will use vibrant Blue (`0xFF2196F3`) and Red (`0xFFF44336`) for the logo text to ensure high contrast against the black header background.

## Proposed Changes

### UI Components

#### [MODIFY] [LogoHeader.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LogoHeader.kt)
- Wrap the content in a `Surface` with `Color.Black` and `shadowElevation`.
- Change font from `Ramabhadra` to `Poppins`.
- Set "alfa" to `Color.Blue` (vibrant) and `FontWeight.Bold`.
- Set "news" to `Color.Red` (vibrant) and `FontWeight.SemiBold`.
- Update district selector colors to be readable on black (e.g., White or Light Gray).

#### [MODIFY] [NewsFeedView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsFeedView.kt)
- Reorganize the layout to use a `Box` where `LogoHeader` is placed after the `VerticalPager` to achieve the overlap effect.

#### [MODIFY] [LocalNewsFeedView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/LocalNewsFeedView.kt)
- Similarly reorganize the layout to make `LogoHeader` overlap the pager.

## Verification Plan

### Manual Verification
- Deploy the app to a device/emulator.
- Check the "Home" feed and "Local" feed.
- Verify:
    1. Header background is black.
    2. Logo text "alfa" is Blue (Bold) and "news" is Red (SemiBold) in Poppins font.
    3. Header overlaps the news images.
    4. Light shadow is visible at the bottom of the header.
    5. District selector is still functional and readable.
