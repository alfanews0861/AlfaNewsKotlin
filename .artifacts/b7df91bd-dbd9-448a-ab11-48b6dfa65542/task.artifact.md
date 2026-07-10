# Task: Fix Reporter ID Card QR Code and Implement Deep Link

- `[x]` Update QR code URL in `IdCardPageView.kt` (using `/verify/` path)
- `[x]` Add intent-filter for reporter deep links in `AndroidManifest.xml` (supports `/verify/` and `/reporter/`)
- `[x]` Add `reporterIdToShow` state to `MainViewModel.kt`
- `[x]` Handle reporter deep link in `MainActivity.kt`
- `[x]` Update `MainScreen.kt` to use `MainViewModel` for reporter profile display
- `[x]` Verify changes and check for consistency with web backend
