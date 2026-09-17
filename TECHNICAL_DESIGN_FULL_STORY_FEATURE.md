# TECHNICAL DESIGN: AI SENIOR EDITOR FULL STORY (పూర్తి వార్త) FEATURE

## 1. Overview
The AlfaNews mobile app and web feed currently condense news into ~70 words for quick card-based consumption. While this delivers rapid browsing, certain in-depth news stories lose their underlying context, emotional intensity, or nuance. 

To bridge this without compromising the core short-news format, we introduce the **"పూర్తి వార్త" (Full Story)** feature:
- The 70-word card remains the primary hook on the swipeable feed.
- A discrete pill button ("పూర్తి వార్త చదవండి" / "Read Full Story") appears below the content.
- Tapping this button opens a 90% height in-app Bottom Sheet modal containing a comprehensive ~200–250 word rewrite.
- Swiping down dismisses the sheet immediately, returning the user to the exact position in their feed without reload or stutter.

---

## 2. Schema Specification
To maintain schema immutability across all platforms (Android, Web, Functions), the following field is added to `NewsPost`:

### Field Definition:
```typescript
fullStory?: {
    telugu: string;
    english: string;
}
```

### Platform Mappings:
1. **Cloud Functions (`functions/src/types.ts`)**:
   ```typescript
   export interface NewsPost {
       // ... existing fields
       fullStory?: {
           telugu: string;
           english: string;
       };
   }
   ```
2. **Web (`web/src/types.ts`, `web/types.ts`)**:
   ```typescript
   export interface NewsPost {
       // ... existing fields
       fullStory?: {
           telugu: string;
           english: string;
       };
   }
   ```
3. **Android (`app/src/main/java/com/alfanews/telugu/models/NewsPost.kt`)**:
   ```kotlin
   data class FullStory(
       val telugu: String = "",
       val english: String = ""
   )

   data class NewsPost(
       // ... existing fields
       val fullStory: FullStory? = null
   )
   ```

### Backward Compatibility:
If `fullStory` is null or empty (for older legacy posts in Firestore), the client UI automatically falls back to `content` (`content.telugu` / `content.english`).

---

## 3. AI Senior Editor Persona & Prompt Engineering
The full story is pre-generated at ingest time during Gemini processing in Cloud Functions (`functions/src/categories.ts`, `news_handler.ts`, `geminiService.ts`).

### Guidelines:
1. **Persona**: Alfa News Senior Editor (సీనియర్ ఎడిటర్).
2. **Length**: Strictly 200 to 250 Telugu words (`fullStoryTe`) and 150 to 200 English words (`fullStoryEn`).
3. **Tone & Intensity**: Retain 100% of the original emotion (ఆవేశం, ఆవేదన, ఆగ్రహం, ప్రజా సమస్యల తీవ్రత). Do not tone down or censor genuine public sentiment.
4. **No Hallucinations**: If the source text only has ~150–200 words, do not fabricate imaginary details, quotes, or statistics. Structure and polish the existing facts with journalistic clarity.
5. **Entity Retention**: Preserve all personal names, designations, organizations, mandals, villages, and dates accurately.
6. **No Redundancy**: Avoid repetitive vocabulary or looped statements.

---

## 4. UI / UX Design

### Android (Jetpack Compose):
- **Trigger**: Discrete pill button with `BorderStroke` and `Mallanna`/`Poppins` font, below `contentParagraphs`.
- **Modal**: 90% screen height `ModalBottomSheet` / bottom sheet dialog.
  - Drag handle on top for swipe-down to dismiss.
  - Close icon button in top bar.
  - Category badge, location, and date/time header.
  - Prominent headline.
  - Formatted paragraphs with readable line-height and typography.
  - Reporter / Alfa News Desk footer.

### Web (React + Tailwind CSS):
- Complementary button and slide-over/bottom-sheet modal on `NewsCard.tsx` to maintain cross-platform feature parity.
