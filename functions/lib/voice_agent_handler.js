"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTelephonyWebhook = exports.simulateVoiceConversation = exports.triggerVoiceCampaign = exports.triggerReporterVoiceCheck = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const types_1 = require("./types");
const voice_agent_engine_1 = require("./voice_agent_engine");
const reporter_monitor_1 = require("./reporter_monitor");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Checks if current time is within Indian calling window (10:00 AM - 7:00 PM IST)
 */
function isWithinCallingHoursIST() {
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
exports.triggerReporterVoiceCheck = (0, scheduler_1.onSchedule)({
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
        .where("role", "in", [types_1.UserRole.REPORTER, "REPORTER", "reporter", 2, 2.0, "2"])
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
        if (!phone)
            continue;
        // Check actual days inactive
        const actualNewsDate = await (0, reporter_monitor_1.getActualLatestNewsDate)(reporterId, reporter.name);
        const daysInactive = (0, reporter_monitor_1.calculateDaysInactive)(reporter, now, actualNewsDate);
        // Call only if inactive for 2 or more days
        if (daysInactive < 2)
            continue;
        // Throttle: Don't call if already called in last 48 hours
        const lastCallSnap = await db.collection("voice_calls")
            .where("reporterId", "==", reporterId)
            .where("callType", "==", types_1.VoiceCallType.INACTIVITY_FOLLOWUP)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get()
            .catch(() => null);
        if (lastCallSnap && !lastCallSnap.empty) {
            const lastCall = lastCallSnap.docs[0].data();
            const lastCallDate = (0, reporter_monitor_1.parseToDate)(lastCall.createdAt);
            if (lastCallDate && (now.getTime() - lastCallDate.getTime()) < 48 * 60 * 60 * 1000) {
                continue;
            }
        }
        const context = {
            reporterName: reporter.name || "విలేకరి",
            mandal: reporter.assignedMandal || reporter.mandal || "స్థానిక",
            district: reporter.district,
            daysInactive,
            phoneNumber: phone
        };
        const initialGreeting = (0, voice_agent_engine_1.generateInitialGreeting)(types_1.VoiceCallType.INACTIVITY_FOLLOWUP, context);
        const callRecord = {
            callType: types_1.VoiceCallType.INACTIVITY_FOLLOWUP,
            status: types_1.VoiceCallStatus.QUEUED,
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
exports.triggerVoiceCampaign = (0, https_1.onCall)({
    memory: "512MiB",
    timeoutSeconds: 300
}, async (request) => {
    const { campaignId, title, eventType, targetMandals, targetDistricts, detailsPrompt, adTariffDetails } = request.data;
    if (!title && !campaignId) {
        throw new https_1.HttpsError("invalid-argument", "Campaign title or campaignId is required.");
    }
    let campaign;
    if (campaignId) {
        const campDoc = await db.collection("voice_campaigns").doc(campaignId).get();
        if (!campDoc.exists) {
            throw new https_1.HttpsError("not-found", "Campaign not found.");
        }
        campaign = { id: campDoc.id, ...campDoc.data() };
    }
    else {
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
    let query = db.collection("users")
        .where("role", "in", [types_1.UserRole.REPORTER, "REPORTER", "reporter", 2, 2.0, "2"]);
    const reportersSnap = await query.get();
    let targetCount = 0;
    for (const doc of reportersSnap.docs) {
        const reporter = doc.data();
        const phone = reporter.phone || reporter.phoneNumber;
        if (!phone)
            continue;
        // Filter by district or mandal if specified
        if (campaign.targetDistricts && campaign.targetDistricts.length > 0) {
            if (!campaign.targetDistricts.includes(reporter.district))
                continue;
        }
        if (campaign.targetMandals && campaign.targetMandals.length > 0) {
            const mandal = reporter.assignedMandal || reporter.mandal;
            if (!campaign.targetMandals.includes(mandal))
                continue;
        }
        const context = {
            reporterName: reporter.name || "విలేకరి",
            mandal: reporter.assignedMandal || reporter.mandal,
            district: reporter.district,
            campaignTitle: campaign.title,
            campaignPrompt: campaign.detailsPrompt,
            adTariffDetails: campaign.adTariffDetails,
            phoneNumber: phone
        };
        const initialGreeting = (0, voice_agent_engine_1.generateInitialGreeting)(types_1.VoiceCallType.EVENT_CAMPAIGN, context);
        await db.collection("voice_calls").add({
            callType: types_1.VoiceCallType.EVENT_CAMPAIGN,
            status: types_1.VoiceCallStatus.QUEUED,
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
exports.simulateVoiceConversation = (0, https_1.onCall)({
    memory: "512MiB",
    timeoutSeconds: 60
}, async (request) => {
    const { callType = types_1.VoiceCallType.INACTIVITY_FOLLOWUP, context = {}, history = [], userSpokenText } = request.data;
    if (!userSpokenText) {
        // Return opening greeting
        const greeting = (0, voice_agent_engine_1.generateInitialGreeting)(callType, context);
        return {
            spokenResponseTelugu: greeting,
            isConversationEnding: false,
            extractedIntent: {
                followUpRequired: false,
                sentiment: "neutral"
            }
        };
    }
    const turnResult = await (0, voice_agent_engine_1.processVoiceCallTurn)(callType, context, history, userSpokenText);
    return turnResult;
});
/**
 * HTTP Webhook for Telephony Integration (Exotel / Twilio / Bolna / Custom Gateway).
 * Receives speech transcriptions, handles next turns, and records call results.
 */
exports.handleTelephonyWebhook = (0, https_1.onRequest)({
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
        const callData = callSnap.data();
        // Call End Event
        if (event === "call_ended" || event === "completed") {
            await callRef.update({
                status: types_1.VoiceCallStatus.COMPLETED,
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
            const context = {
                reporterName: callData.reporterName,
                mandal: callData.mandal,
                district: callData.district,
                phoneNumber: callData.phoneNumber,
                campaignTitle: callData.campaignTitle
            };
            const result = await (0, voice_agent_engine_1.processVoiceCallTurn)(callData.callType, context, history, userSpeech);
            const updatedTurns = [
                ...history,
                { speaker: "user", text: userSpeech, timestamp: Date.now() },
                { speaker: "ai", text: result.spokenResponseTelugu, timestamp: Date.now() }
            ];
            await callRef.update({
                status: result.isConversationEnding ? types_1.VoiceCallStatus.COMPLETED : types_1.VoiceCallStatus.IN_PROGRESS,
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
    }
    catch (err) {
        console.error("[TELEPHONY_WEBHOOK_ERR]", err);
        res.status(500).json({ error: err.message });
    }
});
