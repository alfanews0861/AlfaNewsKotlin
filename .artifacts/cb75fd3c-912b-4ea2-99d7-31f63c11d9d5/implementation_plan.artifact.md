# Implementation Plan: Dynamic Branching Survey Support

This plan details the implementation of a dynamic branching logic for surveys in AlfaNews. It allows questions to be displayed based on previous answers and supports placeholders in question text to show previous selections.

## Proposed Changes

### 1. Data Model Updates

#### [MODIFY] [NewsPost.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/models/NewsPost.kt)
- Add `nextQuestionId: String? = null` to `SurveyOption`.
- Update `mapMapToNewsPost` to parse `nextQuestionId` from Firestore.

### 2. Survey Creation UI Updates

#### [MODIFY] [PostSurveyPageView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/PostSurveyPageView.kt)
- Update `MutableOptionState` to include `nextQuestionId`.
- In the question creation card, add a dropdown for each option to select the "Next Question".
    - Options will include "Next (Default)", "End Survey", and the IDs/Titles of all other defined questions.
- Update the data mapping to save `nextQuestionId` to Firestore.
- Add a tip/instruction about using `{q1_ans}` (or similar syntax) for dynamic placeholders.

### 3. Survey Display & Interaction Updates

#### [MODIFY] [NewsCardView.kt](file:///C:/AlfaKotlin/app/src/main/java/com/alfanews/telugu/views/NewsCardView.kt)
- Update the `SurveyCardContent` composable:
    - Replace `currentPageIndex` logic with `currentQuestionId` logic for multi-page surveys.
    - Maintain a map of `selectedOptionTexts: Map<String, String>` to store the actual text of chosen options.
    - Implement a helper function `resolveQuestionText(text, answers)` to replace placeholders like `{qID_ans}` with the stored text.
    - Update the "Next" button logic:
        1. Check the selected option's `nextQuestionId`.
        2. If it is `"END"`, proceed to submission.
        3. If it is a valid question ID, jump to that question.
        4. If it is null/default, proceed to the next question in the `surveyQuestions` list (maintaining backward compatibility).
    - Adjust the progress bar or hide it if the path is non-linear.

## Verification Plan

### Manual Verification
1.  **Creation**:
    - Create a survey with 3 questions.
    - Set Q1 Option 1 to go to Q2.
    - Set Q1 Option 2 to go to Q3 directly.
    - Set Q2 options to "End Survey".
    - Use a placeholder in Q2 text: "మీరు {q1_ans} ను ఎందుకు ఎంచుకున్నారు?".
2.  **Display**:
    - Verify that picking Q1 Option 1 shows Q2 with the correct replaced text.
    - Verify that picking Q1 Option 2 skips Q2 and shows Q3.
    - Verify that the final submission includes all answers from the followed path.

### Automated Tests
- Update `SurveyFeatureTest.kt` to include tests for `nextQuestionId` parsing and logical jumps.
