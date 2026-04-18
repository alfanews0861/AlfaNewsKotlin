# AI Processing Flow - Reporter vs Citizen Posts

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALFA NEWS APPLICATION                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ├─ Reporter Post Submission
                              │
                    ┌─────────▼──────────┐
                    │ PostNewsPageView   │
                    │ (Reporter Only)    │
                    └─────────┬──────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    Headline            Content              Media Upload
    District            Location              Firebase Storage
    State               Category              (Photos/Videos)
    Category            Media URL
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                 ┌────────────────────────┐
                 │  POST DATA PREPARED    │
                 │                        │
                 │  isReporter: true      │
                 │  isCitizen: false      │
                 │  headline: telugu      │
                 │  content: telugu       │
                 │  mediaUrl: firebase    │
                 │  reporter: {id, name}  │
                 └────────────┬───────────┘
                              │
                              ▼
         ┌────────────────────────────────────┐
         │ FirebaseFunctionsService.          │
         │ processReporterSubmission()        │
         │                                    │
         │ Calls Cloud Function:             │
         │ "processReporterSubmission"       │
         └────────────┬─────────────────────┘
                      │
                      ▼
         ┌────────────────────────────────────┐
         │   CLOUD FUNCTION (TypeScript)     │
         │   processReporterSubmission()      │
         │                                    │
         │ System Instruction:               │
         │ "You are a Senior Editor          │
         │  processing a reporter's news     │
         │  submission. Enhance and refine   │
         │  the 70-word Telugu article."     │
         │                                    │
         │ Model: Gemini-3-Flash-Preview    │
         │ Temperature: 0.4                  │
         │ Output: JSON with structured      │
         │         schema                    │
         └────────────┬─────────────────────┘
                      │
         ┌────────────▼──────────────┐
         │   AI PROCESSING OUTPUT    │
         │                           │
         │ ✓ Enhanced Headline       │
         │ ✓ Enhanced Content        │
         │ ✓ English Translation     │
         │ ✓ Location Detection      │
         │ ✓ Category Refinement     │
         │ ✓ Story Fingerprint       │
         └────────────┬──────────────┘
                      │
         ┌────────────▼──────────────────┐
         │   FIRESTORE UPDATE            │
         │                               │
         │ ✓ headline (enhanced)         │
         │ ✓ content (enhanced)          │
         │ ✓ category (refined)          │
         │ ✓ isReporter: true            │
         │ ✓ isCitizen: false            │
         │ ✓ aiProcessed: true           │
         │ ✓ aiProcessedAt: timestamp    │
         │ ✓ processingType: REPORTER    │
         │ ✓ lastUpdated: timestamp      │
         └────────────┬──────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   POST PUBLISHED       │
         │   IN NEWS FEED         │
         │                        │
         │  ✓ Ready for users     │
         │  ✓ Optimized content   │
         │  ✓ AI enhanced         │
         └────────────────────────┘
```

## Citizen Post Flow (Comparison)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALFA NEWS APPLICATION                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ├─ Citizen Post Submission
                              │
                    ┌─────────▼──────────────┐
                    │ CitizenPostPageView    │
                    │ (Public Citizen)       │
                    └─────────┬──────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
      Content              Location             Media Upload
      District             Anonymous Option     Firebase Storage
      State                Media URL
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                 ┌────────────────────────┐
                 │  POST DATA PREPARED    │
                 │                        │
                 │  isCitizen: true       │
                 │  isReporter: false     │
                 │  headline: auto-gen    │
                 │  content: telugu       │
                 │  mediaUrl: firebase    │
                 │  reporter: citizen/anon│
                 └────────────┬───────────┘
                              │
                              ▼
         ┌────────────────────────────────────┐
         │ FirebaseFunctionsService.          │
         │ processNewsPost()                  │
         │                                    │
         │ Calls Cloud Function:             │
         │ "processNewsPost"                 │
         └────────────┬─────────────────────┘
                      │
                      ▼
         ┌────────────────────────────────────┐
         │   CLOUD FUNCTION (TypeScript)     │
         │   processNewsPost()                │
         │                                    │
         │ System Instruction:               │
         │ "You are a Senior Journalist.     │
         │  Write 70 words in Telugu."       │
         │                                    │
         │ Model: Gemini-3-Flash-Preview    │
         │ Temperature: 0.4                  │
         │ Output: JSON with structured      │
         │         schema                    │
         └────────────┬─────────────────────┘
                      │
         ┌────────────▼──────────────┐
         │   AI PROCESSING OUTPUT    │
         │                           │
         │ ✓ Generated Headline      │
         │ ✓ Enhanced Content        │
         │ ✓ English Translation     │
         │ ✓ Location Detection      │
         │ ✓ Category Assignment     │
         │ ✓ Story Fingerprint       │
         └────────────┬──────────────┘
                      │
         ┌────────────▼──────────────────┐
         │   FIRESTORE UPDATE            │
         │                               │
         │ ✓ headline (generated)        │
         │ ✓ content (enhanced)          │
         │ ✓ category (assigned)         │
         │ ✓ isCitizen: true             │
         │ ✓ isReporter: false           │
         │ ✓ aiProcessed: true           │
         │ ✓ aiProcessedAt: timestamp    │
         │ ✓ lastUpdated: timestamp      │
         └────────────┬──────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   POST PUBLISHED       │
         │   IN NEWS FEED         │
         │                        │
         │  ✓ Ready for users     │
         │  ✓ AI generated        │
         │  ✓ Enhanced content    │
         └────────────────────────┘
```

## Key Differences

| Feature | Reporter | Citizen |
|---------|----------|---------|
| **Function Called** | `processReporterSubmission()` | `processNewsPost()` |
| **Cloud Function** | `processReporterSubmission` | `processNewsPost` |
| **System Instruction** | "Senior Editor" role | "Senior Journalist" role |
| **Headline** | Refined from reporter input | Auto-generated from content |
| **Content** | Enhanced & refined | Enhanced & structured |
| **isCitizen** | false | true |
| **isReporter** | true | false |
| **processingType** | "REPORTER_SUBMISSION" | (not set) |
| **Reporter Info** | Preserved from input | Citizen/Anonymous or bot |
| **Intent** | Professional news creation | Public journalism |
| **Quality Focus** | Editorial refinement | News extraction & generation |

## AI Processing Details

### Both Functions Use
- **Model**: `gemini-3-flash-preview` (PRO_MODEL)
- **Temperature**: 0.4 (controlled, consistent output)
- **Response Format**: JSON with schema validation
- **Languages**: Telugu (primary) + English (translation)
- **Output Fields**:
  - `headline`: Main title (6-10 words, punchy)
  - `content`: Body text (60-70 words)
  - `headlineEn`: English title
  - `contentEn`: English body
  - `location`: Detected location
  - `storyFingerprint`: Unique identifier for duplicate detection
  - `refinedCategory`: Auto-classified category

### Processing Steps
1. **Input Validation**: Check headline and content exist
2. **Schema Definition**: Define expected JSON output structure
3. **AI Generation**: Send to Gemini with system instruction
4. **Response Parsing**: Parse JSON response safely
5. **Media Optimization**: Convert external images to WebP
6. **Category Refinement**: Auto-categorize if not provided
7. **Metadata Generation**: Create fingerprint for tracking
8. **Database Save**: Update Firestore with processed data

## Query Examples for Firestore

### Get all Reporter Posts
```
db.collection('news').where('isReporter', '==', true)
```

### Get all Citizen Posts
```
db.collection('news').where('isCitizen', '==', true)
```

### Get Reporter Posts from Specific Reporter
```
db.collection('news')
  .where('isReporter', '==', true)
  .where('reporter.id', '==', 'reporter_id')
```

### Get AI-Processed Posts
```
db.collection('news').where('aiProcessed', '==', true)
```

### Get Posts by Processing Type
```
db.collection('news').where('processingType', '==', 'REPORTER_SUBMISSION')
```

