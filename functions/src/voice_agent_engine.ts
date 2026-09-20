import { Type } from "@google/genai";
import { runWithAIFallback, parseAIJson } from "./utils";
import { 
  VoiceCallType, 
  VoiceCallTurn, 
  VoiceCallIntent 
} from "./types";

export interface VoiceAgentContext {
  reporterName?: string;
  mandal?: string;
  district?: string;
  daysInactive?: number;
  lastPostTitle?: string;
  campaignTitle?: string;
  campaignPrompt?: string;
  adTariffDetails?: string;
  phoneNumber?: string;
}

export interface VoiceTurnResult {
  spokenResponseTelugu: string;
  isConversationEnding: boolean;
  extractedIntent: VoiceCallIntent;
}

/**
 * Generates the first opening greeting sentence when the phone call connects.
 */
export function generateInitialGreeting(
  callType: VoiceCallType, 
  context: VoiceAgentContext
): string {
  const name = context.reporterName ? `${context.reporterName} గారూ` : "నమస్కారం అండి";
  const mandal = context.mandal ? `${context.mandal} మండలం` : "మీ ప్రాంతం";
  const days = context.daysInactive || 2;

  switch (callType) {
    case VoiceCallType.INACTIVITY_FOLLOWUP:
      return `నమస్కారం ${name}, నేను ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్ నుంచి మాట్లాడుతున్నాను. గత ${days} రోజులుగా ${mandal} నుండి వార్తలేవీ రాలేదు, అంతా క్షేమమేనా అండీ?`;

    case VoiceCallType.EVENT_CAMPAIGN:
      return `నమస్కారం ${name}, నేను ఆల్ఫా న్యూస్ డెస్క్ నుంచి కాల్ చేస్తున్నాను. ${context.campaignTitle || 'రాబోయే ముఖ్యమైన ఈవెంట్'} సందర్భంగా మన మండలంలో శుభాకాంక్షల ప్రకటనలు, ప్రత్యేక కథనాల గురించి మాట్లాడటానికి కాల్ చేసాను. ఒక్క నిమిషం మాట్లాడవచ్చా అండీ?`;

    case VoiceCallType.INBOUND_SUPPORT:
    default:
      return `నమస్కారం, ఆల్ఫా న్యూస్ హెల్ప్‌లైన్‌కు స్వాగతం. నేను ఆల్ఫా న్యూస్ వర్చువల్ అసిస్టెంట్‌ని. మీకు ఏ విధంగా సహాయపడగలను అండీ?`;
  }
}

/**
 * Handles a single conversation turn between user and AI during an interactive phone call.
 */
export async function processVoiceCallTurn(
  callType: VoiceCallType,
  context: VoiceAgentContext,
  history: VoiceCallTurn[],
  userSpokenText: string
): Promise<VoiceTurnResult> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      spokenResponseTelugu: { 
        type: Type.STRING, 
        description: "Exact Telugu sentence spoken back to user on phone. Keep under 20-30 words, polite, natural conversational spoken Telugu." 
      },
      isConversationEnding: { 
        type: Type.BOOLEAN, 
        description: "True if conversation naturally ended or user said goodbye / bye / call cut." 
      },
      extractedIntent: {
        type: Type.OBJECT,
        properties: {
          reasonForInactivity: { type: Type.STRING, description: "Identified reason: e.g. Power cut, Sickness, Traveling, Busy, App bug, No news, or none" },
          promisedSubmissionTime: { type: Type.STRING, description: "Promised submission time if stated, e.g. Today 5 PM, Tomorrow morning" },
          followUpRequired: { type: Type.BOOLEAN, description: "Whether desk needs to follow up later" },
          wantsAdKit: { type: Type.BOOLEAN, description: "True if user expressed interest in receiving ad tariff / ad collection details" },
          adLeadContact: { type: Type.STRING, description: "Any advertiser name or contact phone mentioned by reporter" },
          sentiment: { type: Type.STRING, enum: ["positive", "neutral", "negative"] },
          notes: { type: Type.STRING, description: "Brief 1-line note for the editorial team" }
        },
        required: ["followUpRequired", "sentiment"]
      }
    },
    required: ["spokenResponseTelugu", "isConversationEnding", "extractedIntent"]
  };

  const formattedHistory = history
    .map(turn => `${turn.speaker === 'ai' ? 'AI డెస్క్' : 'విలేకరి'}: ${turn.text}`)
    .join('\n');

  const systemInstruction = `మీరు "ఆల్ఫా న్యూస్ (Alfa News)" ఎడిటోరియల్ డెస్క్ కో-ఆర్డినేటర్. 
మీరు ఫోన్ కాల్‌లో ఎదుటి వ్యక్తితో సహజమైన, మర్యాదపూర్వకమైన వ్యవహారిక తెలుగులో మాట్లాడుతున్నారు.

నియమాలు:
1. ఫోన్ సంభాషణ కాబట్టి సమాధానం చాలా క్లుప్తంగా (గరిష్టంగా 1-2 వాక్యాలు, 20-30 పదాలలోపే) ఉండాలి. ఎక్కడా పెద్ద లెక్చర్లు లేదా బుల్లెట్ పాయింట్లు చెప్పవద్దు.
2. ఎదుటి వ్యక్తిని గౌరవంగా "గారు", "అండి" అని సంబోధించండి.
3. కాల్ టైప్: ${callType}
4. సందర్భం:
   - విలేకరి పేరు: ${context.reporterName || 'విలేకరి'}
   - మండలం: ${context.mandal || 'సొంత మండలం'}
   - ఎన్ని రోజులుగా వార్తలు రాలేదు: ${context.daysInactive || 2} రోజులు
   - ఈవెంట్/ప్రకటనల వివరాలు: ${context.campaignTitle || 'సాధారణ అప్‌డేట్'} ${context.campaignPrompt || ''}
   - ప్రకటనల రేట్లు: ${context.adTariffDetails || 'ఫుల్ పేజ్ ₹10,000, హాఫ్ పేజ్ ₹5,000, బ్యానర్ ₹2,000, 20% ఇన్సెంటివ్ కమిషన్ విలేకరికి ఇవ్వబడుతుంది.'}
5. విలేకరి చెప్పే కారణాన్ని జాగ్రత్తగా వినండి:
   - అనారోగ్యం లేదా వ్యక్తిగత పని అయితే: సానుభూతి వ్యక్తం చేసి, విశ్రాంతి తీసుకోమని చెప్పండి.
   - పవర్ కట్ లేదా సమయం లేకపోతే: ఎప్పుడు పంపగలరో కనుక్కోండి.
   - ఆ సమయాన్ని (promisedSubmissionTime) ఎక్స్‌ట్రాక్ట్ చేయండి.
6. సంభాషణ ముగిస్తే (ఉదా: సరే అండి పంపుతాను, ధన్యవాదాలు, బాయ్): "సరేనండి, మీ వార్త కోసం ఎదురుచూస్తుంటాము. ధన్యవాదాలు, ఉంటానండి." అని చెప్పి isConversationEnding: true చేయండి.
7. మీ సమాధానం స్పష్టమైన తెలుగు లిపిలోనే ఉండాలి.`;

  const userPrompt = `ఇప్పటివరకు జరిగిన సంభాషణ:
${formattedHistory}

విలేకరి ఇప్పుడే మాట్లాడిన మాటలు:
"${userSpokenText}"

దయచేసి పై నియమాల ప్రకారం సరైన సమాధానం మరియు ఉద్దేశాన్ని (JSON ఫార్మాట్ లో) ఇవ్వండి.`;

  try {
    const result = await runWithAIFallback(async (ai, modelName) => {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction,
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: schema,
          maxOutputTokens: 1024
        }
      } as any);

      const parsed = parseAIJson(response);
      return parsed;
    });

    if (result && result.spokenResponseTelugu) {
      return {
        spokenResponseTelugu: result.spokenResponseTelugu,
        isConversationEnding: !!result.isConversationEnding,
        extractedIntent: {
          reasonForInactivity: result.extractedIntent?.reasonForInactivity || undefined,
          promisedSubmissionTime: result.extractedIntent?.promisedSubmissionTime || undefined,
          followUpRequired: result.extractedIntent?.followUpRequired ?? false,
          wantsAdKit: result.extractedIntent?.wantsAdKit ?? false,
          adLeadContact: result.extractedIntent?.adLeadContact || undefined,
          sentiment: result.extractedIntent?.sentiment || 'neutral',
          notes: result.extractedIntent?.notes || undefined
        }
      };
    }
  } catch (err: any) {
    console.error("[VOICE_AGENT_ENGINE_ERR]", err);
  }

  // Fallback if AI call failed
  return {
    spokenResponseTelugu: "సరేనండి, మీ సమాధానం నోట్ చేసుకున్నాము. దయచేసి వీలైనంత త్వరగా యాప్‌లో వార్తను పోస్ట్ చేయండి. ధన్యవాదాలు.",
    isConversationEnding: true,
    extractedIntent: {
      followUpRequired: true,
      sentiment: "neutral",
      notes: "Fallback response triggered due to AI engine timeout"
    }
  };
}
