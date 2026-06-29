# Implementation Plan - Force Entity Inclusion and Increase Content Depth

The user noted that the AI is missing specific names (villages, mandals) and generating content much shorter than the requested 450 characters (the example was ~200 chars). The new requirement is a minimum of **500 characters** and strict inclusion of **all** entities (people, locations, organizations).

## Proposed Changes

### [Component] Backend - AI Prompt Engineering

#### [MODIFY] [geminiService.ts](file:///C:/AlfaKotlin/functions/src/geminiService.ts)
- Update system instructions in `processSocialPostWithAI`, `processCitizenContentWithAI`, and `processContentWithAI`.
- **New Target**: STRICTLY between **500 to 750 characters**.
- **Entity Rule**: Explicitly state: "NEVER omit any names of people, specific villages, mandals, districts, or organizations found in the input. You must mention every specific entity at least once in the narrative."
- **Expansion Logic**: "If the input is short, expand the story with descriptive detail about the event, the significance of the people involved, or the context of the location to reach the 500-character minimum."

#### [MODIFY] [categories.ts](file:///C:/AlfaKotlin/functions/src/categories.ts)
- Update `getCategorySystemInstruction`.
- **New Target**: 500-750 characters.
- Add the same strict entity inclusion rule: "CRITICAL: Do not summarize away specific details like village names or mandal names. Every proper noun from the input MUST appear in the generated Telugu content."

#### [MODIFY] [news_handler.ts](file:///C:/AlfaKotlin/functions/src/news_handler.ts)
- Increase the warning threshold from 450 to **500 characters**.

## Verification Plan

### Manual Verification
- I will simulate the prompt with the user's provided "Original content" to see if the resulting length and entity inclusion are corrected.
- Check if "గోపవరం మండలం" and "మడకలవారిపల్లె గ్రామం" are included in the output.
