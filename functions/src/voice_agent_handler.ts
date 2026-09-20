import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { 
  UserRole, 
  VoiceCallType, 
  VoiceCallStatus, 
  VoiceCallRecord, 
  VoiceCallTurn, 
  VoiceCampaign 
} from "./types";
import { 
  generateInitialGreeting, 
  processVoiceCallTurn, 
  VoiceAgentContext 
} from "./voice_agent_engine";
import { calculateDaysInactive, getActualLatestNewsDate, parseToDate } from "./reporter_monitor";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Checks if current time is within Indian calling window (10:00 AM - 7:00 PM IST)
 */
function isWithinCallingHoursIST(): boolean {
  const now = new Date();
  // IST is UTC + 5:30
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const istMinutesTotal = (utcHours * 60 + utcMinutes + 330) % 1440;
  const istHour = Math.floor(istMinutesTotal / 60);

  return istHour >= 10 && istHour < 19;
}

/**
 * Scheduled Outbound Reporter Inactivity Voice Call Trigger.
 * Runs daily at 11:30 AM IST (06:00 UTC).
 */
export const triggerReporterVoiceCheck = onSchedule({
  schedule: "30 6 * * *",
  timeZone: "Asia/Kolkata",
  memory: "512MiB",
  timeoutSeconds: 300
}, async () => {
  console.log("[VOICE_AGENT] Starting daily inactivity voice call evaluation...");

  if (!isWithinCallingHoursIST()) {
    console.log("[VOICE_AGENT] Outside permitted calling hours (10 AM - 7 PM IST). Skipping.");
    return;
  }

  const now = new Date();

  // Find active reporters
  const snapshot = await db.collection("users")
    .where("role", "in", [UserRole.REPORTER, "REPORTER", "reporter", 2, 2.0, "2"])
    .get();

  if (snapshot.empty) {
    console.log("[VOICE_AGENT] No reporters found.");
    return;
  }

  let callsQueued = 0;

  for (const doc of snapshot.docs) {
    const reporter = doc.data();
    const reporterId = doc.id;
    const phone = reporter.phone || reporter.phoneNumber;

    if (!phone) continue;

    // Check actual days inactive
    const actualNewsDate = await getActualLatestNewsDate(reporterId, reporter.name);
    const daysInactive = calculateDaysInactive(reporter, now, actualNewsDate);

    // Call only if inactive for 2 or more days
    if (daysInactive < 2) continue;

    // Throttle: Don't call if already called in last 48 hours
    const lastCallSnap = await db.collection("voice_calls")
      .where("reporterId", "==", reporterId)
      .where("callType", "==", VoiceCallType.INACTIVITY_FOLLOWUP)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get()
      .catch(() => null);

    if (lastCallSnap && !lastCallSnap.empty) {
      const lastCall = lastCallSnap.docs[0].data();
      const lastCallDate = parseToDate(lastCall.createdAt);
      if (lastCallDate && (now.getTime() - lastCallDate.getTime()) < 48 * 60 * 60 * 1000) {
        continue;
      }
    }

    const context: VoiceAgentContext = {
      reporterName: reporter.name || "విలేకరి",
      mandal: reporter.assignedMandal || reporter.mandal || "స్థానిక",
      district: reporter.district,
      daysInactive,
      phoneNumber: phone
    };

    const initialGreeting = generateInitialGreeting(VoiceCallType.INACTIVITY_FOLLOWUP, context);

    const callRecord: Omit<VoiceCallRecord, "id"> = {
      callType: VoiceCallType.INACTIVITY_FOLLOWUP,
      status: VoiceCallStatus.QUEUED,
      reporterId,
      reporterName: reporter.name || "విలేకరి",
      phoneNumber: phone,
      mandal: reporter.assignedMandal || reporter.mandal,
      district: reporter.district,
      turns: [
        {
          speaker: "ai",
          text: initialGreeting,
          timestamp: Date.now()
        }
      ],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const callRef = await db.collection("voice_calls").add(callRecord);
    console.log(`[VOICE_AGENT] Queued follow-up call ${callRef.id} for reporter ${reporter.name} (${phone})`);
    callsQueued++;
  }

  console.log(`[VOICE_AGENT] Inactivity check complete. Total calls queued: ${callsQueued}`);
});

/**
 * Callable function to launch a voice campaign for MLA Birthdays / Festivals / Ads.
 */
export const triggerVoiceCampaign = onCall({
  memory: "512MiB",
  timeoutSeconds: 300
}, async (request) => {
  const { campaignId, title, eventType, targetMandals, targetDistricts, detailsPrompt, adTariffDetails } = request.data;

  if (!title && !campaignId) {
    throw new HttpsError("invalid-argument", "Campaign title or campaignId is required.");
  }

  let campaign: VoiceCampaign;

  if (campaignId) {
    const campDoc = await db.collection("voice_campaigns").doc(campaignId).get();
    if (!campDoc.exists) {
      throw new HttpsError("not-found", "Campaign not found.");
    }
    campaign = { id: campDoc.id, ...campDoc.data() } as VoiceCampaign;
  } else {
    const newCampRef = db.collection("voice_campaigns").doc();
    campaign = {
      id: newCampRef.id,
      title,
      eventType: eventType || "LOCAL_EVENT",
      targetMandals: targetMandals || [],
      targetDistricts: targetDistricts || [],
      detailsPrompt: detailsPrompt || "",
      adTariffDetails: adTariffDetails || "",
      status: "ACTIVE",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await newCampRef.set(campaign);
  }

  // Fetch target reporters
  let query: admin.firestore.Query = db.collection("users")
    .where("role", "in", [UserRole.REPORTER, "REPORTER", "reporter", 2, 2.0, "2"]);

  const reportersSnap = await query.get();
  let targetCount = 0;

  for (const doc of reportersSnap.docs) {
    const reporter = doc.data();
    const phone = reporter.phone || reporter.phoneNumber;
    if (!phone) continue;

    // Filter by district or mandal if specified
    if (campaign.targetDistricts && campaign.targetDistricts.length > 0) {
      if (!campaign.targetDistricts.includes(reporter.district)) continue;
    }
    if (campaign.targetMandals && campaign.targetMandals.length > 0) {
      const mandal = reporter.assignedMandal || reporter.mandal;
      if (!campaign.targetMandals.includes(mandal)) continue;
    }

    const context: VoiceAgentContext = {
      reporterName: reporter.name || "విలేకరి",
      mandal: reporter.assignedMandal || reporter.mandal,
      district: reporter.district,
      campaignTitle: campaign.title,
      campaignPrompt: campaign.detailsPrompt,
      adTariffDetails: campaign.adTariffDetails,
      phoneNumber: phone
    };

    const initialGreeting = generateInitialGreeting(VoiceCallType.EVENT_CAMPAIGN, context);

    await db.collection("voice_calls").add({
      callType: VoiceCallType.EVENT_CAMPAIGN,
      status: VoiceCallStatus.QUEUED,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      reporterId: doc.id,
      reporterName: reporter.name || "విలేకరి",
      phoneNumber: phone,
      mandal: reporter.assignedMandal || reporter.mandal,
      district: reporter.district,
      turns: [
        {
          speaker: "ai",
          text: initialGreeting,
          timestamp: Date.now()
        }
      ],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    targetCount++;
  }

  await db.collection("voice_campaigns").doc(campaign.id).set({
    totalReportersTargeted: targetCount,
    status: "ACTIVE"
  }, { merge: true });

  return {
    success: true,
    campaignId: campaign.id,
    reportersQueued: targetCount
  };
});

/**
 * Interactive Simulator Endpoint: Test conversations in Telugu without telephony charges!
 */
export const simulateVoiceConversation = onCall({
  memory: "512MiB",
  timeoutSeconds: 60
}, async (request) => {
  const { 
    callType = VoiceCallType.INACTIVITY_FOLLOWUP, 
    context = {}, 
    history = [], 
    userSpokenText 
  } = request.data;

  if (!userSpokenText) {
    // Return opening greeting
    const greeting = generateInitialGreeting(callType, context);
    return {
      spokenResponseTelugu: greeting,
      isConversationEnding: false,
      extractedIntent: {
        followUpRequired: false,
        sentiment: "neutral"
      }
    };
  }

  const turnResult = await processVoiceCallTurn(callType, context, history, userSpokenText);
  return turnResult;
});

/**
 * HTTP Webhook for Telephony Integration (Exotel / Twilio / Bolna / Custom Gateway).
 * Receives speech transcriptions, handles next turns, and records call results.
 */
export const handleTelephonyWebhook = onRequest({
  memory: "512MiB",
  timeoutSeconds: 60
}, async (req, res) => {
  try {
    const { callId, userSpeech, event, recordingUrl, callDuration } = req.body;

    if (!callId) {
      res.status(400).json({ error: "callId is required" });
      return;
    }

    const callRef = db.collection("voice_calls").doc(callId);
    const callSnap = await callRef.get();

    if (!callSnap.exists) {
      res.status(404).json({ error: "Call record not found" });
      return;
    }

    const callData = callSnap.data() as VoiceCallRecord;

    // Call End Event
    if (event === "call_ended" || event === "completed") {
      await callRef.update({
        status: VoiceCallStatus.COMPLETED,
        endedAt: admin.firestore.FieldValue.serverTimestamp(),
        durationSeconds: callDuration || null,
        audioRecordingUrl: recordingUrl || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // If intent requires follow-up, log in desk chat (reporter_conversations)
      if (callData.extractedIntent?.followUpRequired && callData.reporterId) {
        await db.collection("reporter_conversations")
          .doc(callData.reporterId)
          .collection("messages")
          .add({
            senderId: "SYSTEM_DESK",
            senderName: "ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్ (Voice Follow-up)",
            senderRole: "ADMIN",
            text: `ఫోన్ సంభాషణ సారాంశం:\nకారణం: ${callData.extractedIntent.reasonForInactivity || 'తెలియజేయలేదు'}\nపంపే సమయం: ${callData.extractedIntent.promisedSubmissionTime || 'త్వరలో'}\nగమనిక: ${callData.extractedIntent.notes || ''}`,
            type: "VOICE_FOLLOWUP",
            read: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
      }

      res.status(200).json({ status: "ok" });
      return;
    }

    // Mid-call interactive speech turn
    if (userSpeech) {
      const history = callData.turns || [];
      const context: VoiceAgentContext = {
        reporterName: callData.reporterName,
        mandal: callData.mandal,
        district: callData.district,
        phoneNumber: callData.phoneNumber,
        campaignTitle: callData.campaignTitle
      };

      const result = await processVoiceCallTurn(callData.callType, context, history, userSpeech);

      const updatedTurns: VoiceCallTurn[] = [
        ...history,
        { speaker: "user", text: userSpeech, timestamp: Date.now() },
        { speaker: "ai", text: result.spokenResponseTelugu, timestamp: Date.now() }
      ];

      await callRef.update({
        status: result.isConversationEnding ? VoiceCallStatus.COMPLETED : VoiceCallStatus.IN_PROGRESS,
        turns: updatedTurns,
        extractedIntent: result.extractedIntent,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(200).json({
        spokenResponseTelugu: result.spokenResponseTelugu,
        isConversationEnding: result.isConversationEnding,
        extractedIntent: result.extractedIntent
      });
      return;
    }

    res.status(200).json({ status: "acknowledged" });
  } catch (err: any) {
    console.error("[TELEPHONY_WEBHOOK_ERR]", err);
    res.status(500).json({ error: err.message });
  }
});
