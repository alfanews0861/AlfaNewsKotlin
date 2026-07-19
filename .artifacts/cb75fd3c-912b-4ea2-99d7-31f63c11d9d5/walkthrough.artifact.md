# Walkthrough - Dynamic Branching Survey Support

I have implemented the requested dynamic branching logic for surveys. This allows you to create complex surveys where questions change based on the user's previous answers.

## Key Features Implemented

### 1. Dynamic Flow (Skip Logic)
You can now define which question should follow a specific answer.
- **Next Question**: Each option in the survey creation screen now has a "Next" dropdown.
- **End Survey**: You can mark an option to end the survey immediately when selected.
- **Jumps**: You can skip questions or jump back to a previous question (use with caution to avoid loops!).

### 2. Answer Placeholders (Dynamic Text)
You can use placeholders in your question text to display answers from previous questions.
- Syntax: `{q1_ans}` displays the answer chosen for the first question.
- Syntax: `{q2_ans}` for the second, and so on.
- You can also use the internal question ID if you know it: `{question_id_ans}`.

Example question text: *"మీరు {q1_ans} ను ఎందుకు ఎంచుకున్నారు?"*

### 3. Creation UI Updates
The `PostSurveyPageView` has been updated:
- Each option now shows a "తర్వాత: [Dropdown]" button.
- The dropdown lists all other questions in the survey for easy selection.

### 4. Display & Logic Updates
The `NewsCardView` now handles:
- **Non-linear navigation**: Instead of just going to the next index, it looks for the `nextQuestionId`.
- **Real-time resolution**: Placeholders in text are replaced as soon as the relevant question is answered.
- **Persistent Answers**: Even if you jump around, all your answers are collected for the final submission.

## Verification Results

- **Data Integrity**: Verified that `nextQuestionId` is correctly saved to and loaded from Firestore.
- **Logic**: Implemented robust looping logic in the rendering code to handle dynamic jumps safely.
- **Placeholders**: Verified that placeholders like `{q1_ans}` are correctly resolved to the text of the selected option.

> [!TIP]
> When creating multi-page surveys with placeholders, make sure the referenced question (e.g., Q1) always appears before the question that uses the placeholder.
