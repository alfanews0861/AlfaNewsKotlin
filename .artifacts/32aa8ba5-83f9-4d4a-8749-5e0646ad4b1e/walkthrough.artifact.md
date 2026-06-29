# Walkthrough - Strict Entity Inclusion & 500+ Character Requirement

I have significantly strengthened the AI system instructions to ensure that **no entities (people, villages, mandals, organizations, or amounts)** are omitted from the generated news, and that the content strictly reaches at least **500 characters**.

### Changes Made

#### 1. "Strict Entity" and "500+ Length" Rules
- **[geminiService.ts](file:///C:/AlfaKotlin/functions/src/geminiService.ts)**: Added a **STRICT ENTITY RULE** to all processing paths. It explicitly forbids the AI from omitting any proper nouns (names, locations, etc.) found in the source text.
- **Enhanced Length Target**: Updated the target range to **500-750 characters** and added a specific "STRICT LENGTH REQUIREMENT" to force expansion if the input is brief.

#### 2. System Instruction Alignment
- **[categories.ts](file:///C:/AlfaKotlin/functions/src/categories.ts)**: Synchronized the central `getCategorySystemInstruction` with the new 500-character minimum and strict entity rules to ensure all news generation follows the same high-quality standard.

#### 3. Updated Validation Threshold
- **[news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)**: Increased the character length warning threshold to **500 characters**.

### Verification Summary
The AI is now commanded to:
- Include **every single proper noun** (e.g., "గోపవరం మండలం", "మడకలవారిపల్లె గ్రామం") from the input.
- Expand short stories by discussing the **significance** of the event or providing **descriptive background** about the locations and people involved to meet the 500-character requirement.

This change ensures that your news posts are rich in detail and meet your specific quality standards for hyper-local reporting.
