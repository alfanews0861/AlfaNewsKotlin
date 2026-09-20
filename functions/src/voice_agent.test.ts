/**
 * Unit Tests for AlfaNews Telugu AI Voice Agent
 */

import { VoiceCallType } from "./types";
import { generateInitialGreeting } from "./voice_agent_engine";

describe("Telugu Voice Agent - Greeting Engine", () => {
  test("generates polite Telugu greeting for inactive reporter follow-up", () => {
    const greeting = generateInitialGreeting(VoiceCallType.INACTIVITY_FOLLOWUP, {
      reporterName: "రమేష్",
      mandal: "కొణిజర్ల",
      district: "ఖమ్మం",
      daysInactive: 3
    });

    expect(greeting).toContain("రమేష్ గారూ");
    expect(greeting).toContain("ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్");
    expect(greeting).toContain("కొణిజర్ల మండలం");
    expect(greeting).toContain("3 రోజులుగా");
  });

  test("generates engaging Telugu greeting for event and ad campaign", () => {
    const greeting = generateInitialGreeting(VoiceCallType.EVENT_CAMPAIGN, {
      reporterName: "సురేష్",
      mandal: "మధిర",
      campaignTitle: "ఎమ్మెల్యే గారి పుట్టినరోజు"
    });

    expect(greeting).toContain("సురేష్ గారూ");
    expect(greeting).toContain("ఎమ్మెల్యే గారి పుట్టినరోజు");
    expect(greeting).toContain("శుభాకాంక్షల ప్రకటనలు");
  });

  test("generates helpful greeting for inbound customer helpline", () => {
    const greeting = generateInitialGreeting(VoiceCallType.INBOUND_SUPPORT, {});

    expect(greeting).toContain("ఆల్ఫా న్యూస్ హెల్ప్‌లైన్‌కు స్వాగతం");
    expect(greeting).toContain("వర్చువల్ అసిస్టెంట్");
  });
});
