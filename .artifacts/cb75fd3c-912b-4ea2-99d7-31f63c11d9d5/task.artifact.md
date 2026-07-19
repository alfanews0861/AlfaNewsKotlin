# Task: Implement Dynamic Branching Survey Support

- [x] Update Data Models (`NewsPost.kt`)
    - [x] Add `nextQuestionId` to `SurveyOption`
    - [x] Update `mapMapToNewsPost` parsing logic
- [x] Update Survey Creation UI (`PostSurveyPageView.kt`)
    - [x] Update `MutableOptionState` and `MutableQuestionState`
    - [x] Add "Next Question" selection UI for each option
    - [x] Update Firestore saving logic to include `nextQuestionId`
- [x] Update Survey Rendering Logic (`NewsCardView.kt`)
    - [x] Implement `currentQuestionId` based navigation
    - [x] Add answer placeholder resolution (`{qX_ans}`)
    - [x] Update "Next" button navigation logic
- [x] Verification
    - [x] Manual test patterns implemented
    - [x] Tests updated in `SurveyFeatureTest.kt`
