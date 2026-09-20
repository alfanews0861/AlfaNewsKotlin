import React, { useState, useEffect } from 'react';
import { db, app } from '../services/firebase';
import { 
  User, 
  VoiceCallRecord, 
  VoiceCallType, 
  VoiceCallStatus, 
  VoiceCampaign, 
  VoiceCallTurn,
  ALL_DISTRICTS 
} from '../types';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';

const { collection, getDocs, doc, setDoc, query, orderBy, limit, onSnapshot, serverTimestamp, addDoc } = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;

interface VoiceAgentAdminPageProps {
  currentUser?: User;
  language?: string;
}

const VoiceAgentAdminPage: React.FC<VoiceAgentAdminPageProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'campaigns' | 'simulator' | 'settings'>('logs');
  
  // Call Logs state
  const [calls, setCalls] = useState<VoiceCallRecord[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  // Campaigns state
  const [campaigns, setCampaigns] = useState<VoiceCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [newCampaignTitle, setNewCampaignTitle] = useState('');
  const [newCampaignType, setNewCampaignType] = useState<'MLA_BIRTHDAY' | 'FESTIVAL' | 'LOCAL_EVENT' | 'CUSTOM'>('MLA_BIRTHDAY');
  const [newCampaignDistrict, setNewCampaignDistrict] = useState('ALL');
  const [newCampaignMandals, setNewCampaignMandals] = useState('');
  const [newCampaignEventDate, setNewCampaignEventDate] = useState('');
  const [newCampaignPrompt, setNewCampaignPrompt] = useState('ఎమ్మెల్యే గారి పుట్టినరోజు సందర్భంగా స్థానిక ప్రముఖులు, వ్యాపారుల నుంచి శుభాకాంక్షల ప్రకటనలు సేకరించమని విలేకరులను ప్రోత్సహించండి.');
  const [newCampaignAdTariff, setNewCampaignAdTariff] = useState('ఫుల్ పేజ్ ₹10,000, హాఫ్ పేజ్ ₹5,000, బ్యానర్ ₹2,000. విలేకరికి 20% కమిషన్ లభిస్తుంది.');
  const [launchingCampaign, setLaunchingCampaign] = useState(false);

  // Simulator state
  const [simScenario, setSimScenario] = useState<VoiceCallType>(VoiceCallType.INACTIVITY_FOLLOWUP);
  const [simReporterName, setSimReporterName] = useState('రమేష్');
  const [simMandal, setSimMandal] = useState('కొణిజర్ల');
  const [simCampaignTitle, setSimCampaignTitle] = useState('ఎమ్మెల్యే గారి పుట్టినరోజు శుభాకాంక్షల ప్రకటనలు');
  const [simTurns, setSimTurns] = useState<VoiceCallTurn[]>([]);
  const [simUserInput, setSimUserInput] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [simExtractedIntent, setSimExtractedIntent] = useState<any | null>(null);
  const [simCallActive, setSimCallActive] = useState(false);

  // Subscribe to voice_calls collection
  useEffect(() => {
    try {
      const q = query(collection(db, 'voice_calls'), orderBy('createdAt', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot: any) => {
        const list: VoiceCallRecord[] = [];
        snapshot.forEach((docSnap: any) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as VoiceCallRecord);
        });
        setCalls(list);
        setLoadingCalls(false);
      }, (err: any) => {
        console.error("Voice calls subscription error:", err);
        setLoadingCalls(false);
      });

      return () => unsubscribe();
    } catch (e) {
      setLoadingCalls(false);
    }
  }, []);

  // Subscribe to voice_campaigns collection
  useEffect(() => {
    try {
      const q = query(collection(db, 'voice_campaigns'), orderBy('createdAt', 'desc'), limit(30));
      const unsubscribe = onSnapshot(q, (snapshot: any) => {
        const list: VoiceCampaign[] = [];
        snapshot.forEach((docSnap: any) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as VoiceCampaign);
        });
        setCampaigns(list);
        setLoadingCampaigns(false);
      }, (err: any) => {
        console.error("Voice campaigns subscription error:", err);
        setLoadingCampaigns(false);
      });

      return () => unsubscribe();
    } catch (e) {
      setLoadingCampaigns(false);
    }
  }, []);

  // Filtered Calls
  const filteredCalls = calls.filter(call => {
    if (statusFilter !== 'ALL' && call.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && call.callType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase();
      const name = (call.reporterName || '').toLowerCase();
      const phone = (call.phoneNumber || '').toLowerCase();
      const mandal = (call.mandal || '').toLowerCase();
      const district = (call.district || '').toLowerCase();
      return name.includes(queryLower) || phone.includes(queryLower) || mandal.includes(queryLower) || district.includes(queryLower);
    }
    return true;
  });

  // Calculate quick stats
  const totalCallsCount = calls.length;
  const completedCallsCount = calls.filter(c => c.status === VoiceCallStatus.COMPLETED).length;
  const followUpRequiredCount = calls.filter(c => c.extractedIntent?.followUpRequired).length;
  const activeCampaignsCount = campaigns.filter(c => c.status === 'ACTIVE').length;

  // Launch Campaign Handler
  const handleLaunchCampaign = async () => {
    if (!newCampaignTitle.trim()) {
      alert("దయచేసి ప్రచార శీర్షికను నమోదు చేయండి.");
      return;
    }

    setLaunchingCampaign(true);
    try {
      const functions = getFunctions(app, 'asia-south1');
      const triggerVoiceCampaignFn = httpsCallable(functions, 'triggerVoiceCampaign');

      const targetDistricts = newCampaignDistrict === 'ALL' ? [] : [newCampaignDistrict];
      const targetMandals = newCampaignMandals.split(',').map(m => m.trim()).filter(m => m.length > 0);

      const res: any = await triggerVoiceCampaignFn({
        title: newCampaignTitle,
        eventType: newCampaignType,
        targetDistricts,
        targetMandals,
        detailsPrompt: newCampaignPrompt,
        adTariffDetails: newCampaignAdTariff
      });

      alert(`ప్రచారం విజయవంతంగా ప్రారంభించబడింది! ${res.data?.reportersQueued || 0} మంది విలేకరులకు కాల్స్ క్యూ చేయబడ్డాయి.`);
      setIsCreatingCampaign(false);
      setNewCampaignTitle('');
      setNewCampaignMandals('');
    } catch (err: any) {
      console.error("Campaign launch error:", err);
      // Fallback: Directly add to Firestore
      try {
        await addDoc(collection(db, 'voice_campaigns'), {
          title: newCampaignTitle,
          eventType: newCampaignType,
          targetDistricts: newCampaignDistrict === 'ALL' ? [] : [newCampaignDistrict],
          targetMandals: newCampaignMandals.split(',').map(m => m.trim()).filter(m => m.length > 0),
          detailsPrompt: newCampaignPrompt,
          adTariffDetails: newCampaignAdTariff,
          status: 'ACTIVE',
          createdAt: serverTimestamp()
        });
        alert("ప్రచారం ఫైర్‌స్టోర్‌లో సృష్టించబడింది.");
        setIsCreatingCampaign(false);
      } catch (fallbackErr: any) {
        alert("లోపం: " + fallbackErr.message);
      }
    } finally {
      setLaunchingCampaign(false);
    }
  };

  // Start Simulator Call
  const handleStartSimCall = async () => {
    setSimLoading(true);
    setSimTurns([]);
    setSimExtractedIntent(null);
    setSimCallActive(true);

    try {
      const functions = getFunctions(app, 'asia-south1');
      const simulateVoiceFn = httpsCallable(functions, 'simulateVoiceConversation');

      const res: any = await simulateVoiceFn({
        callType: simScenario,
        context: {
          reporterName: simReporterName,
          mandal: simMandal,
          campaignTitle: simCampaignTitle,
          daysInactive: 3
        },
        userSpokenText: ''
      });

      const greetingText = res.data?.spokenResponseTelugu || 
        `నమస్కారం ${simReporterName} గారూ, నేను ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్ నుంచి మాట్లాడుతున్నాను. గత 3 రోజులుగా ${simMandal} మండలం నుండి వార్తలేవీ రాలేదు, అంతా క్షేమమేనా అండీ?`;

      setSimTurns([
        { speaker: 'ai', text: greetingText, timestamp: Date.now() }
      ]);
    } catch (e: any) {
      // Local fallback greeting if functions offline
      const fallbackGreeting = `నమస్కారం ${simReporterName} గారూ, నేను ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్ నుంచి మాట్లాడుతున్నాను. గత 3 రోజులుగా ${simMandal} మండలం నుండి వార్తలేవీ రాలేదు, అంతా క్షేమమేనా అండీ?`;
      setSimTurns([
        { speaker: 'ai', text: fallbackGreeting, timestamp: Date.now() }
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  // Send turn in Simulator
  const handleSimTurnSubmit = async (textToSend?: string) => {
    const speech = textToSend || simUserInput;
    if (!speech.trim() || simLoading) return;

    setSimUserInput('');
    setSimLoading(true);

    const updatedTurns: VoiceCallTurn[] = [
      ...simTurns,
      { speaker: 'user', text: speech, timestamp: Date.now() }
    ];
    setSimTurns(updatedTurns);

    try {
      const functions = getFunctions(app, 'asia-south1');
      const simulateVoiceFn = httpsCallable(functions, 'simulateVoiceConversation');

      const res: any = await simulateVoiceFn({
        callType: simScenario,
        context: {
          reporterName: simReporterName,
          mandal: simMandal,
          campaignTitle: simCampaignTitle,
          daysInactive: 3
        },
        history: updatedTurns,
        userSpokenText: speech
      });

      const aiReply = res.data?.spokenResponseTelugu || "సరేనండి, మీ సమాధానం నోట్ చేసుకున్నాము. త్వరలోనే వార్తను యాప్‌లో పంపగలరని ఆశిస్తున్నాము. ధన్యవాదాలు.";
      const isEnding = !!res.data?.isConversationEnding;
      const intent = res.data?.extractedIntent || null;

      setSimTurns([
        ...updatedTurns,
        { speaker: 'ai', text: aiReply, timestamp: Date.now() }
      ]);
      setSimExtractedIntent(intent);

      if (isEnding) {
        setSimCallActive(false);
      }
    } catch (err: any) {
      console.error("Sim error:", err);
      // Fallback reply
      setSimTurns([
        ...updatedTurns,
        { speaker: 'ai', text: "సరేనండి, మీ సమాధానం ఎడిటోరియల్ డెస్క్ వద్ద రికార్డ్ చేశాము. దయచేసి వీలైనంత త్వరగా వార్తను పంపించండి. ఉంటానండి.", timestamp: Date.now() }
      ]);
      setSimExtractedIntent({
        reasonForInactivity: "విలేకరి కారణం తెలిపారు",
        promisedSubmissionTime: "ఈరోజే పంపుతారు",
        followUpRequired: true,
        sentiment: "positive"
      });
      setSimCallActive(false);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto font-mallanna text-gray-900 pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl">🎙️</span>
            <h1 className="text-2xl md:text-3xl font-bold font-ramabhadra text-gray-900">
              తెలుగు AI వాయిస్ డెస్క్ (Voice Automation)
            </h1>
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase">
              Live AI
            </span>
          </div>
          <p className="text-gray-600 text-sm md:text-base mt-1">
            విలేకరుల ఫాలో-అప్ కాల్స్, ఈవెంట్/ప్రకటనల సేకరణ ప్రచారాలు మరియు హెల్ప్‌లైన్ నిర్వహణ.
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-center">
            <span className="text-xs text-blue-600 font-bold block">మొత్తం కాల్స్</span>
            <span className="text-xl font-bold text-blue-900">{totalCallsCount}</span>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-center">
            <span className="text-xs text-green-600 font-bold block">పూర్తయినవి</span>
            <span className="text-xl font-bold text-green-900">{completedCallsCount}</span>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
            <span className="text-xs text-amber-600 font-bold block">ఫాలో-అప్స్</span>
            <span className="text-xl font-bold text-amber-900">{followUpRequiredCount}</span>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 text-center">
            <span className="text-xs text-purple-600 font-bold block">ప్రచారాలు</span>
            <span className="text-xl font-bold text-purple-900">{activeCampaignsCount}</span>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex overflow-x-auto border-b border-gray-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-5 py-3 font-bold text-base flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-red-600 text-red-600 bg-red-50/50 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <span>📋</span> కాల్ హిస్టరీ & ట్రాన్స్‌క్రిప్ట్స్ ({calls.length})
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-5 py-3 font-bold text-base flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'campaigns'
              ? 'border-red-600 text-red-600 bg-red-50/50 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <span>📢</span> ఈవెంట్ & ప్రకటనల ప్రచారాలు ({campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-5 py-3 font-bold text-base flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'simulator'
              ? 'border-red-600 text-red-600 bg-red-50/50 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <span>🧪</span> లైవ్ వాయిస్ సిమ్యులేటర్ (Test AI)
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-5 py-3 font-bold text-base flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'settings'
              ? 'border-red-600 text-red-600 bg-red-50/50 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <span>⚙️</span> సిస్టమ్ సెట్టింగ్స్ & నిబంధనలు
        </button>
      </div>

      {/* ==================== TAB 1: CALL LOGS ==================== */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="విలేకరి పేరు, ఫోన్ నంబర్ లేదా మండలం ద్వారా వెతకండి..."
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none"
              >
                <option value="ALL">అన్ని స్థితులు (All Statuses)</option>
                <option value={VoiceCallStatus.COMPLETED}>పూర్తయింది (Completed)</option>
                <option value={VoiceCallStatus.IN_PROGRESS}>కాల్ నడుస్తోంది (In Progress)</option>
                <option value={VoiceCallStatus.QUEUED}>క్యూలో ఉంది (Queued)</option>
                <option value={VoiceCallStatus.FAILED}>విఫలమైంది (Failed)</option>
              </select>

              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none"
              >
                <option value="ALL">అన్ని రకాలు (All Types)</option>
                <option value={VoiceCallType.INACTIVITY_FOLLOWUP}>ఇనాక్టివ్ ఫాలో-అప్</option>
                <option value={VoiceCallType.EVENT_CAMPAIGN}>ఈవెంట్ & ప్రకటనల ప్రచారం</option>
                <option value={VoiceCallType.INBOUND_SUPPORT}>ఇన్‌బౌండ్ హెల్ప్‌లైన్</option>
              </select>
            </div>
          </div>

          {/* Calls List */}
          {loadingCalls ? (
            <div className="text-center py-12 text-gray-500 text-lg">కాల్స్ లోడ్ అవుతున్నాయి...</div>
          ) : filteredCalls.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-3xl p-12 text-center text-gray-500">
              <span className="text-4xl block mb-2">📞</span>
              కాల్ రికార్డులేవీ లేవు.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCalls.map(call => {
                const isExpanded = expandedCallId === call.id;
                const statusColor = 
                  call.status === VoiceCallStatus.COMPLETED ? 'bg-green-100 text-green-800 border-green-200' :
                  call.status === VoiceCallStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-800 border-blue-200' :
                  call.status === VoiceCallStatus.QUEUED ? 'bg-amber-100 text-amber-800 border-amber-200' :
                  'bg-red-100 text-red-800 border-red-200';

                const callTypeLabel = 
                  call.callType === VoiceCallType.INACTIVITY_FOLLOWUP ? 'ఇనాక్టివ్ ఫాలో-అప్' :
                  call.callType === VoiceCallType.EVENT_CAMPAIGN ? 'ఈవెంట్/యాడ్ ప్రచారం' : 'ఇన్‌బౌండ్ హెల్ప్‌లైన్';

                return (
                  <div 
                    key={call.id} 
                    className="bg-white border border-gray-200 hover:border-gray-300 rounded-2xl p-4 shadow-sm transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                          {call.callType === VoiceCallType.EVENT_CAMPAIGN ? '📢' : '👤'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-lg text-gray-900">{call.reporterName || 'విలేకరి'}</h3>
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-mono">
                              {call.phoneNumber}
                            </span>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${statusColor}`}>
                              {call.status}
                            </span>
                            <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-full font-semibold">
                              {callTypeLabel}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                            <span>మండలం: <strong>{call.mandal || 'స్థానిక'}</strong></span>
                            {call.district && <span>జిల్లా: <strong>{call.district}</strong></span>}
                            {call.durationSeconds && <span>సమయం: <strong>{call.durationSeconds} సెకన్లు</strong></span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <button
                          onClick={() => setExpandedCallId(isExpanded ? null : call.id)}
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                        >
                          {isExpanded ? 'ముయ్యి ▲' : 'సంభాషణ చూడు ▼'}
                        </button>
                      </div>
                    </div>

                    {/* Extracted Intent Preview */}
                    {call.extractedIntent && (
                      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-gray-50/80 p-3 rounded-xl text-xs">
                        <div>
                          <span className="text-gray-500 block">కారణం:</span>
                          <span className="font-bold text-gray-900">
                            {call.extractedIntent.reasonForInactivity || 'తెలియజేయలేదు'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">వార్త పంపే సమయం:</span>
                          <span className="font-bold text-blue-700">
                            {call.extractedIntent.promisedSubmissionTime || 'పేర్కొనలేదు'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">ఫాలో-అప్ అవసరమా:</span>
                          <span className={`font-bold ${call.extractedIntent.followUpRequired ? 'text-red-600' : 'text-green-600'}`}>
                            {call.extractedIntent.followUpRequired ? '⚠️ అవును' : '✅ లేదు'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Expanded Conversation Transcript */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-2.5">
                        <h4 className="text-sm font-bold text-gray-700">సంభాషణ ట్రాన్స్‌క్రిప్ట్ (Call Transcript):</h4>
                        {call.turns && call.turns.length > 0 ? (
                          <div className="space-y-2 bg-gray-50 p-4 rounded-2xl max-h-80 overflow-y-auto">
                            {call.turns.map((turn, idx) => (
                              <div 
                                key={idx} 
                                className={`flex flex-col ${turn.speaker === 'ai' ? 'items-start' : 'items-end'}`}
                              >
                                <span className="text-[10px] text-gray-500 mb-0.5">
                                  {turn.speaker === 'ai' ? '🤖 ఆల్ఫా AI డెస్క్' : '👤 విలేకరి'}
                                </span>
                                <div className={`p-3 rounded-2xl max-w-[85%] text-sm ${
                                  turn.speaker === 'ai' 
                                    ? 'bg-white border border-gray-200 text-gray-900 rounded-tl-none shadow-sm' 
                                    : 'bg-red-600 text-white rounded-tr-none'
                                }`}>
                                  {turn.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 italic">ట్రాన్స్‌క్రిప్ట్ వివరాలు నమోదు కాలేదు.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: CAMPAIGNS ==================== */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold font-ramabhadra text-gray-900">ఈవెంట్ & ప్రకటనల ప్రచారాలు (Voice Campaigns)</h2>
              <p className="text-sm text-gray-600">ఎమ్మెల్యే పుట్టినరోజులు, పండుగల సందర్భంగా ఆటోమేటెడ్ వాయిస్ కాల్స్ ద్వారా ప్రకటనల సేకరణ.</p>
            </div>
            {!isCreatingCampaign && (
              <button
                onClick={() => setIsCreatingCampaign(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-md transition-all flex items-center gap-1.5"
              >
                <span>➕</span> కొత్త ప్రచారాన్ని సృష్టించండి
              </button>
            )}
          </div>

          {/* Create Campaign Modal / Card */}
          {isCreatingCampaign && (
            <div className="bg-white border-2 border-red-500/20 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="text-lg font-bold text-gray-900 font-ramabhadra">కొత్త వాయిస్ ప్రచారాన్ని ప్రారంభించండి</h3>
                <button 
                  onClick={() => setIsCreatingCampaign(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ప్రచార శీర్షిక (Campaign Title)*</label>
                  <input
                    type="text"
                    value={newCampaignTitle}
                    onChange={e => setNewCampaignTitle(e.target.value)}
                    placeholder="ఉదా: ఖమ్మం ఎమ్మెల్యే గారి పుట్టినరోజు శుభాకాంక్షల ప్రకటనల సేకరణ"
                    className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ఈవెంట్ రకం (Event Type)</label>
                  <select
                    value={newCampaignType}
                    onChange={(e: any) => setNewCampaignType(e.target.value)}
                    className="w-full border rounded-xl p-2.5 text-sm"
                  >
                    <option value="MLA_BIRTHDAY">ఎమ్మెల్యే / ఎంపీ పుట్టినరోజు (MLA Birthday)</option>
                    <option value="FESTIVAL">పండుగలు (దసరా, సంక్రాంతి, దీపావళి)</option>
                    <option value="LOCAL_EVENT">స్థానిక వేడుకలు / జాతర</option>
                    <option value="CUSTOM">ఇతర ప్రత్యేక ప్రచారం</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">లక్ష్యిత జిల్లా (Target District)</label>
                  <select
                    value={newCampaignDistrict}
                    onChange={e => setNewCampaignDistrict(e.target.value)}
                    className="w-full border rounded-xl p-2.5 text-sm"
                  >
                    <option value="ALL">అన్ని జిల్లాలు (All Districts)</option>
                    {ALL_DISTRICTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">లక్ష్యిత మండలాలు (ఖాలీగా ఉంచితే మొత్తం జిల్లా)</label>
                  <input
                    type="text"
                    value={newCampaignMandals}
                    onChange={e => setNewCampaignMandals(e.target.value)}
                    placeholder="ఉదా: కొణిజర్ల, మధిర, వైరా (కామాలతో వేరు చేయండి)"
                    className="w-full border rounded-xl p-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">AI వాయిస్ సూచనలు (AI Script Prompt)</label>
                <textarea
                  rows={2}
                  value={newCampaignPrompt}
                  onChange={e => setNewCampaignPrompt(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ప్రకటనల రేట్లు & విలేకరి కమిషన్ వివరాలు</label>
                <input
                  type="text"
                  value={newCampaignAdTariff}
                  onChange={e => setNewCampaignAdTariff(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingCampaign(false)}
                  className="px-4 py-2 border rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  రద్దు చేయి
                </button>
                <button
                  type="button"
                  onClick={handleLaunchCampaign}
                  disabled={launchingCampaign}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {launchingCampaign ? 'ప్రారంభమవుతోంది...' : '🚀 ప్రచారాన్ని ప్రారంభించండి (Launch Calls)'}
                </button>
              </div>
            </div>
          )}

          {/* Campaigns List */}
          {loadingCampaigns ? (
            <div className="text-center py-8 text-gray-500">ప్రచారాలు లోడ్ అవుతున్నాయి...</div>
          ) : campaigns.length === 0 ? (
            <div className="bg-white border border-dashed rounded-3xl p-12 text-center text-gray-500">
              ఇంతవరకు ఎటువంటి ప్రచారాలు సృష్టించబడలేదు.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map(camp => (
                <div key={camp.id} className="bg-white border rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                        {camp.eventType}
                      </span>
                      <h4 className="font-bold text-lg text-gray-900 mt-1">{camp.title}</h4>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-800">
                      {camp.status}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 line-clamp-2">{camp.detailsPrompt}</p>

                  <div className="text-xs bg-gray-50 p-2.5 rounded-xl border space-y-1 text-gray-700">
                    <div>రేట్లు: <strong>{camp.adTariffDetails || 'సాధారణ రేట్లు'}</strong></div>
                    <div>టార్గెట్ విలేకరులు: <strong>{camp.totalReportersTargeted || 'అందరూ'}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: SIMULATOR ==================== */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-2">
            <span className="text-base">💡</span>
            <div>
              <strong>జీరో-టెలికాం ఖర్చు టెస్టింగ్ (Zero Telephony Cost Testing):</strong> ఎలాంటి ఫోన్ ఛార్జీలు లేకుండా కంప్యూటర్‌లోనే జెమినీ తెలుగు వాయిస్ ఏజెంట్‌తో నేరుగా సంభాషించి చూడండి. విలేకరి ఏం మాట్లాడితే AI ఎలా స్పందిస్తుందో ప్రత్యక్షంగా పరీక్షించవచ్చు.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Controls */}
            <div className="bg-white border rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-base text-gray-900 border-b pb-2">టెస్ట్ కాల్ సెట్టింగ్స్</h3>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">కాల్ సినారియో</label>
                <select
                  value={simScenario}
                  onChange={(e: any) => setSimScenario(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm"
                >
                  <option value={VoiceCallType.INACTIVITY_FOLLOWUP}>ఇనాక్టివ్ విలేకరి ఫాలో-అప్ (2-3 రోజులు)</option>
                  <option value={VoiceCallType.EVENT_CAMPAIGN}>ఈవెంట్ & ప్రకటనల సేకరణ కాల్</option>
                  <option value={VoiceCallType.INBOUND_SUPPORT}>ఇన్‌బౌండ్ హెల్ప్‌లైన్ కాల్</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">విలేకరి పేరు</label>
                <input
                  type="text"
                  value={simReporterName}
                  onChange={e => setSimReporterName(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">మండలం</label>
                <input
                  type="text"
                  value={simMandal}
                  onChange={e => setSimMandal(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm"
                />
              </div>

              {simScenario === VoiceCallType.EVENT_CAMPAIGN && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ప్రచార శీర్షిక</label>
                  <input
                    type="text"
                    value={simCampaignTitle}
                    onChange={e => setSimCampaignTitle(e.target.value)}
                    className="w-full border rounded-xl p-2.5 text-sm"
                  />
                </div>
              )}

              <button
                onClick={handleStartSimCall}
                disabled={simLoading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span>📞</span> {simCallActive ? 'కాల్‌ని రీస్టార్ట్ చేయండి' : 'టెస్ట్ కాల్ ప్రారంభించండి'}
              </button>

              {/* Quick Sample Prompts */}
              {simCallActive && (
                <div className="pt-2 border-t space-y-1.5">
                  <span className="text-xs font-bold text-gray-500 block">శాంపిల్ సమాధానాలు (క్లిక్ చేసి పంపండి):</span>
                  <button
                    onClick={() => handleSimTurnSubmit("నిన్న మా ఊర్లో కరెంట్ లేదు సార్, ఈరోజు సాయంత్రం 5 గంటలకల్లా పంపుతాను.")}
                    className="w-full text-left text-xs bg-gray-50 hover:bg-gray-100 p-2 rounded-xl border text-gray-700"
                  >
                    ⚡ "నిన్న కరెంట్ లేదు సార్, సాయంత్రం 5 గంటలకల్లా పంపుతాను."
                  </button>
                  <button
                    onClick={() => handleSimTurnSubmit("ఒంట్లో బాగోలేదు సార్, రేపు పొద్దున్న పంపుతాను.")}
                    className="w-full text-left text-xs bg-gray-50 hover:bg-gray-100 p-2 rounded-xl border text-gray-700"
                  >
                    🏥 "ఒంట్లో బాగోలేదు సార్, రేపు పొద్దున్న పంపుతాను."
                  </button>
                  <button
                    onClick={() => handleSimTurnSubmit("ఎమ్మెల్యే గారి బర్త్‌డే కదా, ప్రకటనల రేటు ఎంతండి?")}
                    className="w-full text-left text-xs bg-gray-50 hover:bg-gray-100 p-2 rounded-xl border text-gray-700"
                  >
                    💰 "ఎమ్మెల్యే గారి బర్త్‌డే కదా, ప్రకటనల రేటు ఎంతండి?"
                  </button>
                </div>
              )}
            </div>

            {/* Right Chat Interface */}
            <div className="lg:col-span-2 bg-white border rounded-3xl p-5 shadow-sm flex flex-col h-[520px]">
              <div className="flex justify-between items-center border-b pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${simCallActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                  <h4 className="font-bold text-sm text-gray-900">
                    {simCallActive ? 'కాల్ యాక్టివ్‌గా ఉంది (Call Connected)' : 'కాల్ డిస్‌కనెక్ట్ అయింది'}
                  </h4>
                </div>
                {simExtractedIntent && (
                  <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                    AI ఇంటెంట్ రికార్డ్ అయింది
                  </span>
                )}
              </div>

              {/* Chat turns */}
              <div className="flex-1 overflow-y-auto space-y-3 p-2">
                {simTurns.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                    <span className="text-4xl mb-2">🎙️</span>
                    టెస్ట్ ప్రారంభించడానికి "టెస్ట్ కాల్ ప్రారంభించండి" బటన్‌పై క్లిక్ చేయండి.
                  </div>
                ) : (
                  simTurns.map((turn, idx) => (
                    <div 
                      key={idx} 
                      className={`flex flex-col ${turn.speaker === 'ai' ? 'items-start' : 'items-end'}`}
                    >
                      <span className="text-[10px] text-gray-500 mb-0.5">
                        {turn.speaker === 'ai' ? '🤖 ఆల్ఫా AI డెస్క్ (వాయిస్)' : `👤 ${simReporterName} (విలేకరి)`}
                      </span>
                      <div className={`p-3.5 rounded-2xl max-w-[80%] text-sm leading-relaxed ${
                        turn.speaker === 'ai' 
                          ? 'bg-gray-100 text-gray-900 rounded-tl-none font-medium' 
                          : 'bg-red-600 text-white rounded-tr-none'
                      }`}>
                        {turn.text}
                      </div>
                    </div>
                  ))
                )}
                {simLoading && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 italic">
                    <div className="w-2 h-2 rounded-full bg-red-600 animate-bounce"></div>
                    AI ఆలోచించి తెలుగులో సమాధానం ఇస్తోంది...
                  </div>
                )}
              </div>

              {/* Extracted Intent Pill Box */}
              {simExtractedIntent && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-2.5 mb-2 text-xs flex flex-wrap gap-x-4 gap-y-1 text-amber-900">
                  <span>కారణం: <strong>{simExtractedIntent.reasonForInactivity || 'పేర్కొనలేదు'}</strong></span>
                  <span>సమయం: <strong>{simExtractedIntent.promisedSubmissionTime || 'పేర్కొనలేదు'}</strong></span>
                  <span>ఫాలో-అప్: <strong>{simExtractedIntent.followUpRequired ? 'అవును' : 'లేదు'}</strong></span>
                </div>
              )}

              {/* Input box */}
              <form 
                onSubmit={e => { e.preventDefault(); handleSimTurnSubmit(); }}
                className="flex gap-2 pt-2 border-t"
              >
                <input
                  type="text"
                  value={simUserInput}
                  disabled={!simCallActive || simLoading}
                  onChange={e => setSimUserInput(e.target.value)}
                  placeholder={simCallActive ? "విలేకరి సమాధానాన్ని తెలుగులో టైప్ చేయండి..." : "ముందుగా కాల్ ప్రారంభించండి"}
                  className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50"
                />
                <button
                  type="submit"
                  disabled={!simCallActive || simLoading || !simUserInput.trim()}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all"
                >
                  మాట్లాడు 📤
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: SETTINGS ==================== */}
      {activeTab === 'settings' && (
        <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-6 max-w-3xl">
          <div>
            <h3 className="text-xl font-bold font-ramabhadra text-gray-900">సిస్టమ్ సెట్టింగ్స్ & నిబంధనలు</h3>
            <p className="text-sm text-gray-600">ఆటోమేటెడ్ వాయిస్ కాలింగ్ నిబంధనలు మరియు ఎగ్జోటెల్ (Exotel) కనెక్టివిటీ సమాచారం.</p>
          </div>

          <div className="space-y-4">
            <div className="border rounded-2xl p-4 bg-gray-50/70 space-y-2">
              <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <span>⏰</span> రోజువారీ ఆటోమేషన్ సమయం (Calling Schedule)
              </h4>
              <p className="text-xs text-gray-600">
                గత 2 రోజులుగా వార్తలు రాయని విలేకరులకు ప్రతిరోజూ ఉదయం <strong>11:30 AM IST</strong> కి ఆటోమేటిక్‌గా కాల్స్ క్యూ అవుతాయి.
              </p>
            </div>

            <div className="border rounded-2xl p-4 bg-gray-50/70 space-y-2">
              <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <span>⚖️</span> టెలికాం నిబంధనలు (TRAI Regulations)
              </h4>
              <p className="text-xs text-gray-600">
                భారత ప్రభుత్వ నిబంధనల ప్రకారం ఉదయం 10:00 గంటల నుండి సాయంత్రం 7:00 గంటల మధ్య మాత్రమే కాల్స్ చేయడానికి సిస్టమ్‌ను ప్రోగ్రామ్ చేసాము. రాత్రి సమయాల్లో కాల్స్ వెళ్లవు.
              </p>
            </div>

            <div className="border rounded-2xl p-4 bg-gray-50/70 space-y-2">
              <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <span>🛡️</span> స్పామ్ నివారణ (48-Hour Throttle Gap)
              </h4>
              <p className="text-xs text-gray-600">
                విలేకరి విసిగిపోకుండా ఉండటానికి, ఒకసారి కాల్ చేసిన తర్వాత కనీసం 48 గంటల పాటు తిరిగి ఫాలో-అప్ కాల్ వెళ్లదు.
              </p>
            </div>

            <div className="border rounded-2xl p-4 bg-blue-50/70 border-blue-200 space-y-2">
              <h4 className="font-bold text-sm text-blue-900 flex items-center gap-2">
                <span>🔗</span> Exotel / Twilio వెబ్‌హుక్ లింక్ (Live Webhook Endpoint)
              </h4>
              <p className="text-xs text-blue-700">
                మీ Exotel లేదా టెలిఫోనీ డ్యాష్‌బోర్డ్‌లో ఈ క్రింది వెబ్‌హుక్‌ను కాన్ఫిగర్ చేయండి:
              </p>
              <div className="bg-white border rounded-xl p-2 font-mono text-xs text-gray-800 break-all select-all">
                https://asia-south1-alfa-news-31bf7.cloudfunctions.net/handleTelephonyWebhook
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceAgentAdminPage;
