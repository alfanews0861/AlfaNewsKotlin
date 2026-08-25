import React, { useState, useEffect } from 'react';
import { ArrowLeft, User as UserIcon, Shield, CheckCircle2, AlertCircle, Send, Check } from 'lucide-react';
import { db, app } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';
import { User, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { MANDAL_DATA } from '../data/mandalData';

const { collection, query, where, getDocs, addDoc, doc, setDoc, serverTimestamp } = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;

interface JoinReporterPageProps {
    user: User | null;
    onClose: () => void;
    onLoginRequest: () => void;
    onOpenChat?: () => void;
}

const JoinReporterPage: React.FC<JoinReporterPageProps> = ({ user, onClose, onLoginRequest, onOpenChat }) => {
    const isUserLoggedIn = Boolean(user && user.id && user.id !== 'guest');

    const [hasPendingApplication, setHasPendingApplication] = useState(false);
    const [fullName, setFullName] = useState(user?.name || '');
    const [fatherName, setFatherName] = useState('');
    const [phone, setPhone] = useState(user?.phone || '');
    const [address, setAddress] = useState(user?.address || '');

    const [selectedState, setSelectedState] = useState('TS');
    const [selectedDistrict, setSelectedDistrict] = useState(user?.district || '');
    const [selectedMandal, setSelectedMandal] = useState('');

    const [interestedArea, setInterestedArea] = useState('');
    const [education, setEducation] = useState('');
    const [currentOrg, setCurrentOrg] = useState('');
    const [additionalMessage, setAdditionalMessage] = useState('');

    const [rulesCheckboxChecked, setRulesCheckboxChecked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resultDialog, setResultDialog] = useState<{ title: string; message: string; isSuccess: boolean; isConflict?: boolean } | null>(null);

    // Check if user has an existing pending application
    useEffect(() => {
        const checkPending = async () => {
            if (!isUserLoggedIn || !user?.id) return;
            try {
                const q = query(
                    collection(db, 'reporter_applications'),
                    where('userId', '==', user.id),
                    where('status', '==', 'PENDING')
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setHasPendingApplication(true);
                }
            } catch (e) {
                console.error("Error checking pending reporter applications:", e);
            }
        };

        checkPending();
    }, [isUserLoggedIn, user?.id]);

    // Reset mandal when district changes
    useEffect(() => {
        setSelectedMandal('');
    }, [selectedDistrict]);

    // Reset district & mandal when state changes
    useEffect(() => {
        setSelectedDistrict('');
        setSelectedMandal('');
    }, [selectedState]);

    const districtsList = selectedState === 'TS' ? TS_DISTRICTS : AP_DISTRICTS;
    const mandalsList = selectedDistrict ? (MANDAL_DATA[selectedDistrict] || []) : [];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!rulesCheckboxChecked) {
            alert("దయచేసి నిబంధనలను అంగీకరించండి.");
            return;
        }

        if (!fullName.trim() || !fatherName.trim() || !phone.trim() || !address.trim() || !selectedDistrict.trim() || !selectedMandal.trim() || !interestedArea.trim() || !education.trim() || !currentOrg.trim() || !additionalMessage.trim()) {
            alert("దయచేసి అన్ని వివరాలను పూరించండి.");
            return;
        }

        setIsSubmitting(true);

        try {
            const targetPosition = "మండల రిపోర్టర్ (Mandal Reporter)";
            let submittedSuccessfully = false;
            let wasAutoApproved = false;
            let isReapplication = false;
            let isConflict = false;
            let existingRepName = '';

            // 1. Try Cloud Function first
            try {
                const functions = getFunctions(app, 'asia-south1');
                const submitFn = httpsCallable(functions, 'submitReporterApplication');
                const res: any = await submitFn({
                    fullName: fullName.trim(),
                    fatherName: fatherName.trim(),
                    phone: phone.trim(),
                    address: address.trim(),
                    position: targetPosition,
                    interestedArea: interestedArea.trim(),
                    education: education.trim(),
                    currentOrg: currentOrg.trim(),
                    state: selectedState,
                    district: selectedDistrict.trim(),
                    mandal: selectedMandal.trim(),
                    message: additionalMessage.trim(),
                    userId: user?.id || null
                });

                if (res.data) {
                    submittedSuccessfully = true;
                    wasAutoApproved = res.data.autoApproved === true;
                    isReapplication = res.data.isPreviouslyDowngraded === true;
                    isConflict = res.data.isConflict === true;
                    existingRepName = res.data.existingReporterName || '';
                }
            } catch (fnErr) {
                console.warn("Cloud function submission fallback to direct firestore:", fnErr);
            }

            // 2. Direct Firestore fallback if Cloud Function didn't confirm
            if (!submittedSuccessfully && user?.id) {
                try {
                    const finalStatus = "PENDING"; // Safe fallback
                    const appData = {
                        fullName: fullName.trim(),
                        fatherName: fatherName.trim(),
                        phone: phone.trim(),
                        address: address.trim(),
                        position: targetPosition,
                        interestedArea: interestedArea.trim(),
                        education: education.trim(),
                        currentOrg: currentOrg.trim(),
                        state: selectedState,
                        district: selectedDistrict.trim(),
                        mandal: selectedMandal.trim(),
                        message: additionalMessage.trim(),
                        status: finalStatus,
                        autoApproved: false,
                        isConflict: true,
                        agreedToRules: true,
                        userId: user.id,
                        timestamp: serverTimestamp()
                    };

                    await addDoc(collection(db, 'reporter_applications'), appData);

                    // Add conflict notification for user
                    const conflictText = `నమస్కారం ${fullName.trim() || 'మిత్రమా'}, మీరు కోరిన ${selectedMandal} మండలానికి ఇప్పటికే క్రియాశీల విలేకరి ఉన్నారు.\n\nఅందువల్ల మీ దరఖాస్తు అడ్మిన్ ప్రత్యేక పరిశీలనకు పంపబడింది. మా అడ్మిన్ టీమ్ పరిశీలించి త్వరలోనే మిమ్మల్ని సంప్రదిస్తారు. మీకు ఏవైనా సందేహాలున్నా లేదా మీ వివరాలు తెలియజేయాలన్నా ఇక్కడే అడ్మిన్‌కు నేరుగా మెసేజ్ / రిప్లై ఇవ్వవచ్చు. ధన్యవాదాలు!`;
                    
                    const msgTimestamp = serverTimestamp();
                    await addDoc(collection(db, 'reporter_conversations', user.id, 'messages'), {
                        senderId: "SYSTEM_ADMIN",
                        senderName: "AlfaNews Editorial Desk",
                        senderRole: "ADMIN",
                        text: conflictText,
                        type: "NOTICE",
                        read: false,
                        timestamp: msgTimestamp
                    });

                    await setDoc(doc(db, 'reporter_conversations', user.id), {
                        reporterId: user.id,
                        reporterName: fullName.trim() || "Applicant",
                        reporterDistrict: selectedDistrict.trim(),
                        reporterMandal: selectedMandal.trim(),
                        lastMessage: conflictText,
                        lastMessageTime: msgTimestamp,
                        lastSenderRole: "ADMIN",
                        lastSenderId: "SYSTEM_ADMIN",
                        unreadCountForReporter: 1,
                        updatedAt: msgTimestamp
                    }, { merge: true });

                    await addDoc(collection(db, 'users', user.id, 'messages'), {
                        title: "మీ దరఖాస్తు పరిశీలనలో ఉంది ⏳",
                        body: conflictText,
                        senderName: "AlfaNews Editorial Desk",
                        senderRole: "ADMIN",
                        read: false,
                        importance: "HIGH",
                        type: "REPORTER_APP_PENDING",
                        timestamp: msgTimestamp
                    });

                    submittedSuccessfully = true;
                    wasAutoApproved = false;
                    isConflict = true;
                } catch (dbErr) {
                    console.error("Direct firestore application failed:", dbErr);
                }
            }

            if (submittedSuccessfully) {
                if (wasAutoApproved) {
                    setResultDialog({
                        title: "అభినందనలు! 🎉",
                        message: `${selectedMandal} మండలానికి మీ దరఖాస్తు ఆమోదించబడింది. మీరు ఇప్పుడు ఆల్ఫా న్యూస్ రిపోర్టర్‌గా నియమించబడ్డారు!`,
                        isSuccess: true,
                        isConflict: false
                    });
                } else if (isReapplication) {
                    setResultDialog({
                        title: "పరిశీలనలో ఉంది ⏳",
                        message: "మీ రీ-అప్లికేషన్ విజయవంతంగా సమర్పించబడింది. మా అడ్మిన్ ప్రతినిధులు త్వరలోనే పరిశీలిస్తారు.",
                        isSuccess: true,
                        isConflict: false
                    });
                } else if (isConflict) {
                    const repInfo = existingRepName ? ` (${existingRepName})` : '';
                    setResultDialog({
                        title: "పరిశీలనలో ఉంది ⏳",
                        message: `${selectedMandal} మండలానికి ఇప్పటికే క్రియాశీల విలేకరి${repInfo} ఉన్నారు. అందువల్ల మీ దరఖాస్తు అడ్మిన్ ప్రత్యేక పరిశీలనకు పంపబడింది.\n\nఅడ్మిన్ డెస్క్ నుండి మీకు సందేశం (Message) వచ్చింది. మీరు అడ్మిన్‌తో మాట్లాడవచ్చు / రిప్లై ఇవ్వవచ్చు.`,
                        isSuccess: true,
                        isConflict: true
                    });
                } else {
                    setResultDialog({
                        title: "దరఖాస్తు సమర్పించబడింది",
                        message: "మీ దరఖాస్తు విజయవంతంగా మాకు అందింది. మీ మండలానికి సంబంధించిన వివరాలను మా బృందం పరిశీలించి త్వరలో సంప్రదిస్తుంది.",
                        isSuccess: true,
                        isConflict: false
                    });
                }
            } else {
                alert("దరఖాస్తు సమర్పించడంలో సాంకేతిక లోపం ఏర్పడింది. దయచేసి కాసేపటి తర్వాత ప్రయత్నించండి.");
            }
        } catch (error: any) {
            console.error("Error submitting application:", error);
            alert("దరఖాస్తు సమర్పించడంలో లోపం ఏర్పడింది: " + (error.message || "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 bg-gray-50 flex flex-col h-full overflow-hidden text-black font-mallanna animate-fade-in relative z-50">
            {/* Top Navigation Bar */}
            <div className="bg-white shadow-sm flex items-center px-4 py-3 shrink-0 border-b border-gray-100">
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full mr-2 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold font-ramabhadra text-gray-900 leading-tight">రిపోర్టర్‌గా చేరండి</h1>
                    <p className="text-xs text-gray-500 font-medium">ఆల్ఫా న్యూస్ టీమ్ తో కలిసి పనిచేయండి</p>
                </div>
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-28">
                <div className="max-w-2xl mx-auto space-y-6">

                    {/* GATE 1: User Not Logged In */}
                    {!isUserLoggedIn ? (
                        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center space-y-5">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                <UserIcon size={36} />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold font-ramabhadra text-gray-900">లాగిన్ అవసరం</h2>
                                <p className="text-gray-600 text-base max-w-md mx-auto">
                                    విలేకరిగా దరఖాస్తు చేసుకోవడానికి దయచేసి మీ మొబైల్ నంబర్‌తో లాగిన్ అవ్వండి.
                                </p>
                            </div>
                            <div className="pt-2 flex flex-col gap-3 max-w-sm mx-auto">
                                <button
                                    onClick={onLoginRequest}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-md transition-all font-ramabhadra text-lg flex items-center justify-center gap-2"
                                >
                                    లాగిన్ అవ్వండి (Login)
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl transition-all"
                                >
                                    రద్దు చేయి (Close)
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Pending Application Notification Banner */}
                            {hasPendingApplication && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900 shadow-sm flex items-start gap-3.5">
                                    <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <h3 className="font-bold font-ramabhadra text-lg text-amber-900">పరిశీలనలో ఉంది (PENDING)</h3>
                                        <p className="text-sm text-amber-800 leading-relaxed">
                                            మీరు ఇప్పటికే ఒక దరఖాస్తును సమర్పించారు. అది ప్రస్తుతం పరిశీలనలో ఉంది. మా ప్రతినిధులు త్వరలోనే మీ దరఖాస్తును పరిశీలిస్తారు.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Guidelines / Rules Card */}
                            <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 space-y-4">
                                <div className="flex items-center gap-2.5 text-red-600 border-b border-gray-100 pb-3">
                                    <Shield className="w-6 h-6" />
                                    <h2 className="text-xl font-bold font-ramabhadra text-gray-900">విలేకరి నిబంధనలు (Reporter Guidelines)</h2>
                                </div>

                                <p className="text-xs md:text-sm text-gray-500 font-medium">
                                    ఆల్ఫా న్యూస్ విలేకరిగా చేరడానికి క్రింది నిబంధనలను పాటించాలి:
                                </p>

                                <div className="space-y-3">
                                    {/* Rule 1 */}
                                    <div className="flex items-start gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                                        <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs shrink-0 font-ramabhadra">
                                            1
                                        </div>
                                        <div className="text-sm">
                                            <h4 className="font-bold text-gray-900 font-ramabhadra">ప్రతిరోజూ కనీసం ఒక వార్త</h4>
                                            <p className="text-gray-600 text-xs mt-0.5">
                                                రెగ్యులర్‌గా వార్తలు పెట్టాలి. మీ మండలానికి సంబంధించిన వార్త ప్రతిరోజూ కనీసం ఒక్కటైనా తప్పనిసరిగా ఉండాలి.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Rule 2 */}
                                    <div className="flex items-start gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                                        <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs shrink-0 font-ramabhadra">
                                            2
                                        </div>
                                        <div className="text-sm">
                                            <h4 className="font-bold text-gray-900 font-ramabhadra">త్వరితగతిన సమాచారం</h4>
                                            <p className="text-gray-600 text-xs mt-0.5">
                                                వార్తలను వీలైనంత త్వరగా తాజా సమాచారంతో అందించగలగాలి.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Rule 3 */}
                                    <div className="flex items-start gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                                        <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs shrink-0 font-ramabhadra">
                                            3
                                        </div>
                                        <div className="text-sm">
                                            <h4 className="font-bold text-gray-900 font-ramabhadra">నాణ్యత & యాజమాన్య హక్కు</h4>
                                            <p className="text-gray-600 text-xs mt-0.5">
                                                మీరు నాణ్యమైన వార్తలు అందించడంలో విఫలమైతే వెంటనే మిమ్మల్ని మార్చి వేరే విలేకరిని నియమించుకునే హక్కు యాజమాన్యానికి ఉంటుంది.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Form Card 1: Personal Details */}
                            <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 space-y-4">
                                <h3 className="text-lg font-bold font-ramabhadra text-gray-900 border-b border-gray-100 pb-2">
                                    వ్యక్తిగత వివరాలు (Personal Details)
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">పూర్తి పేరు (Full Name) *</label>
                                        <input
                                            type="text"
                                            required
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="మీ పూర్తి పేరు"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">తండ్రి పేరు (Father's Name) *</label>
                                        <input
                                            type="text"
                                            required
                                            value={fatherName}
                                            onChange={(e) => setFatherName(e.target.value)}
                                            placeholder="తండ్రి పేరు"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">ఫోన్ నంబర్ (Phone Number) *</label>
                                        <input
                                            type="tel"
                                            required
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="ఫోన్ నంబర్"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">చిరునామా (Address) *</label>
                                        <input
                                            type="text"
                                            required
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder="ఇంటి నెం, వీధి, గ్రామం"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Form Card 2: Region Details */}
                            <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 space-y-4">
                                <h3 className="text-lg font-bold font-ramabhadra text-gray-900 border-b border-gray-100 pb-2">
                                    ప్రాంతం వివరాలు (Region Details)
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* State Dropdown */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">రాష్ట్రం (State) *</label>
                                        <select
                                            value={selectedState}
                                            onChange={(e) => setSelectedState(e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                                        >
                                            <option value="TS">తెలంగాణ (Telangana)</option>
                                            <option value="AP">ఆంధ్రప్రదేశ్ (Andhra Pradesh)</option>
                                        </select>
                                    </div>

                                    {/* District Dropdown */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">జిల్లా (District) *</label>
                                        <select
                                            required
                                            value={selectedDistrict}
                                            onChange={(e) => setSelectedDistrict(e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                                        >
                                            <option value="">-- జిల్లాను ఎంచుకోండి --</option>
                                            {districtsList.map((district) => (
                                                <option key={district} value={district}>{district}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Mandal Dropdown */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">మండలం (Mandal) *</label>
                                        <select
                                            required
                                            value={selectedMandal}
                                            onChange={(e) => setSelectedMandal(e.target.value)}
                                            disabled={!selectedDistrict}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold disabled:opacity-50"
                                        >
                                            <option value="">-- మండలం ఎంచుకోండి --</option>
                                            {mandalsList.map((mandal) => (
                                                <option key={mandal} value={mandal}>{mandal}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Form Card 3: Professional Details */}
                            <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 space-y-4">
                                <h3 className="text-lg font-bold font-ramabhadra text-gray-900 border-b border-gray-100 pb-2">
                                    వృత్తి & ఇతర వివరాలు (Professional Details)
                                </h3>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">హోదా (Position)</label>
                                            <input
                                                type="text"
                                                readOnly
                                                value="మండల రిపోర్టర్ (Mandal Reporter)"
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-100 text-gray-600 font-bold cursor-not-allowed"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">ఆసక్తి ఉన్న కేటగిరీ (Interested Category) *</label>
                                            <input
                                                type="text"
                                                required
                                                value={interestedArea}
                                                onChange={(e) => setInterestedArea(e.target.value)}
                                                placeholder="ఉదా: రాజకీయం, క్రైమ్, వ్యవసాయం"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">విద్యార్హత (Education Qualification) *</label>
                                            <input
                                                type="text"
                                                required
                                                value={education}
                                                onChange={(e) => setEducation(e.target.value)}
                                                placeholder="ఉదా: డిగ్రీ, ఇంటర్, పిజి"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">ప్రస్తుత సంస్థ / వృత్తి (Organization / Job) *</label>
                                            <input
                                                type="text"
                                                required
                                                value={currentOrg}
                                                onChange={(e) => setCurrentOrg(e.target.value)}
                                                placeholder="ప్రస్తుత వృత్తి / పనిచేస్తున్న సంస్థ"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">సందేశం (Additional Message) *</label>
                                        <textarea
                                            required
                                            rows={3}
                                            value={additionalMessage}
                                            onChange={(e) => setAdditionalMessage(e.target.value)}
                                            placeholder="మీ అనుభవం లేదా మాతో పంచుకోవాలనుకుంటున్న వివరాలు..."
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Agreement Checkbox */}
                            <div 
                                onClick={() => setRulesCheckboxChecked(!rulesCheckboxChecked)}
                                className="bg-red-50 border border-red-200 rounded-2xl p-4 cursor-pointer select-none flex items-center gap-3 transition-colors hover:bg-red-100/70"
                            >
                                <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${rulesCheckboxChecked ? 'bg-red-600 border-red-600 text-white' : 'border-gray-400 bg-white'}`}>
                                    {rulesCheckboxChecked && <Check size={16} strokeWidth={3} />}
                                </div>
                                <span className="text-sm font-bold text-gray-800 font-mallanna flex-1">
                                    నేను పై నిబంధనలన్నింటినీ చదివాను, వీటికి పూర్తిగా అంగీకరిస్తున్నాను.
                                </span>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !rulesCheckboxChecked}
                                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white py-4 rounded-2xl text-xl font-bold transition-all shadow-lg flex items-center justify-center gap-3 font-ramabhadra"
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                            </svg>
                                            సమర్పిస్తోంది...
                                        </span>
                                    ) : (
                                        <>
                                            <Send size={22} />
                                            దరఖాస్తును సమర్పించండి
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                </div>
            </div>

            {/* Success / Status Dialog */}
            {resultDialog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-5 animate-scale-in">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <CheckCircle2 size={44} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold font-ramabhadra text-gray-900">{resultDialog.title}</h3>
                            <p className="text-gray-600 text-base leading-relaxed font-mallanna">{resultDialog.message}</p>
                        </div>
                        {resultDialog.isConflict ? (
                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    onClick={() => {
                                        setResultDialog(null);
                                        if (onOpenChat) {
                                            onOpenChat();
                                        } else {
                                            onClose();
                                        }
                                    }}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-md font-ramabhadra text-lg"
                                >
                                    అడ్మిన్ డెస్క్ చాట్ (Open Chat)
                                </button>
                                <button
                                    onClick={() => {
                                        setResultDialog(null);
                                        onClose();
                                    }}
                                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl transition font-ramabhadra"
                                >
                                    సరే (OK)
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    setResultDialog(null);
                                    onClose();
                                }}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-md font-ramabhadra text-lg"
                            >
                                సరే (OK)
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default JoinReporterPage;
