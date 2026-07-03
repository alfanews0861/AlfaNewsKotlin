# Tasks: Internal Reporter Monitoring & Messaging System

- [x] **Data Model Updates**
    - [x] Update `User` interface in `functions/src/types.ts`
    - [x] Update `User` data class in `app/src/main/java/com/alfanews/telugu/models/User.kt`
    - [x] Create `AppMessage.kt` in `app/src/main/java/com/alfanews/telugu/models/`
- [x] **Backend Implementation**
    - [x] Create `functions/src/reporter_monitor.ts` with activity monitoring logic
    - [x] Implement `sendInternalMessage` with Admin copy logic
    - [x] Export `monitorReporterActivity` in `functions/src/index.ts`
- [x] **Mobile UI Implementation**
    - [x] Create `MessagesPageView.kt`
    - [x] Integrate `MessagesPageView` into `MainScreen.kt` (Navigation)
- [/] **Verification**
    - [ ] Create/Run backend simulation test
    - [ ] Verify UI displays persistent messages
