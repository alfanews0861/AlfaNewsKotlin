import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, User as UserIcon, Shield, CheckCircle2, AlertCircle, Send, Check } from 'lucide-react';
import { db, app } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _functions from 'firebase/functions';
import { User, Language } from '../types';
import {
    ALL_EDITIONS_LIST,
    EDITIONS,
    getBodyFontClass,
    getDistrictDisplayName,
    getHeadlineFontClass,
    getMandalsForDistrict,
    getStoredStateCode,
    resolveStateCode,
    validateLanguageForState,
    type LanguageCode,
    type StateCode,
} from '../data/editions';

const { collection, query, where, limit, getDocs, addDoc, doc, setDoc, serverTimestamp } = _firestore as any;
const { getFunctions, httpsCallable } = _functions as any;

interface JoinReporterPageProps {
    user: User | null;
    language?: Language | LanguageCode;
    onClose: () => void;
    onLoginRequest: () => void;
    onOpenChat?: () => void;
}

interface FormStrings {
    pageTitle: string;
    pageSubtitle: string;
    loginRequiredTitle: string;
    loginRequiredDesc: string;
    loginBtn: string;
    closeBtn: string;
    pendingTitle: string;
    pendingDesc: string;
    guidelinesTitle: string;
    guidelinesSubtitle: string;
    rule1Title: string;
    rule1Desc: (subLabel: string) => string;
    rule2Title: string;
    rule2Desc: string;
    rule3Title: string;
    rule3Desc: string;
    personalDetailsTitle: string;
    fullNameLabel: string;
    fullNamePlaceholder: string;
    fullNameError: string;
    fatherNameLabel: string;
    fatherNamePlaceholder: string;
    fatherNameError: string;
    phoneLabel: string;
    phonePlaceholder: string;
    phoneError: string;
    addressLabel: string;
    addressPlaceholder: string;
    addressError: string;
    regionDetailsTitle: string;
    stateLabel: string;
    districtLabel: string;
    districtSelectPlaceholder: string;
    districtError: string;
    subDistrictLabel: (subLabel: string, subEn: string) => string;
    subDistrictSelectPlaceholder: (subLabel: string) => string;
    subDistrictError: (subLabel: string) => string;
    professionalDetailsTitle: string;
    positionLabel: string;
    positionValue: (subLabel: string, subEn: string) => string;
    categoryLabel: string;
    categoryPlaceholder: string;
    categoryError: string;
    educationLabel: string;
    educationPlaceholder: string;
    educationError: string;
    orgLabel: string;
    orgPlaceholder: string;
    orgError: string;
    messageLabel: string;
    messagePlaceholder: string;
    defaultMessage: string;
    rulesAgreeText: string;
    rulesAgreeError: string;
    validationBanner: string;
    submittingText: string;
    submitBtnText: string;
    submitFailedError: string;
    approvedTitle: string;
    approvedMessage: (mandal: string, subLabel: string) => string;
    reapplyTitle: string;
    reapplyMessage: string;
    conflictTitle: string;
    conflictMessage: (mandal: string, subLabel: string, repInfo: string) => string;
    conflictChatText: (name: string, mandal: string, subLabel: string) => string;
    conflictNotifTitle: string;
    submittedTitle: string;
    submittedMessage: (subLabel: string) => string;
    openChatBtn: string;
    okBtn: string;
}

function getSubDistrictFormLabel(stateCode: StateCode, lang: LanguageCode): { local: string; en: string } {
    const ed = EDITIONS[stateCode] || EDITIONS.TS;
    if (lang === 'en') {
        return { local: ed.subDistrictLabel, en: ed.subDistrictLabel };
    }
    if (lang === 'te') {
        return { local: 'మండలం', en: ed.subDistrictLabel };
    }
    if (lang === 'pa') {
        return { local: 'ਤਹਿਸੀਲ', en: ed.subDistrictLabel };
    }
    if (lang === 'gu') {
        return { local: 'તાલુકા', en: ed.subDistrictLabel };
    }
    // Hindi
    if (stateCode === 'GA' || stateCode === 'GJ') {
        return { local: 'तालुका', en: ed.subDistrictLabel };
    }
    if (stateCode === 'MN') {
        return { local: 'उप-मंडल', en: ed.subDistrictLabel };
    }
    return { local: 'तहसील', en: ed.subDistrictLabel };
}

function getFormStrings(lang: LanguageCode): FormStrings {
    switch (lang) {
        case 'hi':
            return {
                pageTitle: 'रिपोर्टर के रूप में जुड़ें',
                pageSubtitle: 'अल्फा न्यूज़ एडिटोरियल टीम के साथ काम करें',
                loginRequiredTitle: 'लॉगिन आवश्यक है',
                loginRequiredDesc: 'रिपोर्टर के रूप में आवेदन करने के लिए कृपया अपने मोबाइल नंबर से लॉगिन करें।',
                loginBtn: 'लॉगिन करें (Login)',
                closeBtn: 'बंद करें (Close)',
                pendingTitle: 'समीक्षा में है (PENDING)',
                pendingDesc: 'आपने पहले ही एक आवेदन जमा कर दिया है। हमारी एडिटोरियल टीम शीघ्र ही इसकी समीक्षा करेगी।',
                guidelinesTitle: 'रिपोर्टर दिशानिर्देश (Reporter Guidelines)',
                guidelinesSubtitle: 'अल्फा न्यूज़ रिपोर्टर बनने के लिए कृपया निम्नलिखित नियमों का पालन करें:',
                rule1Title: 'प्रतिदिन कम से कम एक खबर',
                rule1Desc: (sub) => `नियमित रूप से समाचार भेजें। आपकी ${sub} से प्रतिदिन कम से कम एक स्थानीय खबर अनिवार्य है।`,
                rule2Title: 'त्वरित और सटीक जानकारी',
                rule2Desc: 'ताज़ा और प्रमाणिक स्थानीय समाचार जल्द से जल्द पाठकों तक पहुंचाएं।',
                rule3Title: 'गुणवत्ता और संपादकीय अधिकार',
                rule3Desc: 'यदि नियमित और गुणवत्तापूर्ण समाचार नहीं भेजे जाते हैं, तो संपादकीय डेस्क को अन्य रिपोर्टर नियुक्त करने का अधिकार होगा।',
                personalDetailsTitle: 'व्यक्तिगत विवरण (Personal Details)',
                fullNameLabel: 'पूरा नाम (Full Name) *',
                fullNamePlaceholder: 'अपना पूरा नाम लिखें',
                fullNameError: 'कृपया कम से कम 3 अक्षरों का पूरा नाम दर्ज करें',
                fatherNameLabel: 'पिता का नाम (Father\'s Name) *',
                fatherNamePlaceholder: 'पिता का नाम लिखें',
                fatherNameError: 'कृपया कम से कम 3 अक्षरों का पिता का नाम दर्ज करें',
                phoneLabel: 'मोबाइल नंबर (Phone Number - 10 Digits) *',
                phonePlaceholder: '10 अंकों का मोबाइल नंबर',
                phoneError: 'कृपया वैध 10 अंकों का मोबाइल नंबर दर्ज करें (6-9 से शुरू)',
                addressLabel: 'पूरा पता (Address) *',
                addressPlaceholder: 'मकान नंबर, गली, गांव / शहर',
                addressError: 'कृपया कम से कम 6 अक्षरों का पता दर्ज करें',
                regionDetailsTitle: 'क्षेत्र विवरण (Region Details)',
                stateLabel: 'राज्य (State) *',
                districtLabel: 'जिला (District) *',
                districtSelectPlaceholder: '-- जिला चुनें --',
                districtError: 'कृपया जिला चुनें',
                subDistrictLabel: (sub, en) => `${sub} (${en}) *`,
                subDistrictSelectPlaceholder: (sub) => `-- ${sub} चुनें --`,
                subDistrictError: (sub) => `कृपया ${sub} चुनें`,
                professionalDetailsTitle: 'पेशेवर और अन्य विवरण (Professional Details)',
                positionLabel: 'पद (Position)',
                positionValue: (sub, en) => `${sub} रिपोर्टर (${en} Reporter)`,
                categoryLabel: 'रुचि की श्रेणी (Interested Category) *',
                categoryPlaceholder: 'जैसे: राजनीति, अपराध, कृषि, शिक्षा',
                categoryError: 'कृपया अपनी रुचि की श्रेणी दर्ज करें',
                educationLabel: 'शैक्षणिक योग्यता (Education Qualification) *',
                educationPlaceholder: 'जैसे: स्नातक, इंटर, पीजी',
                educationError: 'कृपया अपनी शैक्षणिक योग्यता दर्ज करें',
                orgLabel: 'वर्तमान संस्था / पेशा (Organization / Job) *',
                orgPlaceholder: 'वर्तमान पेशा / कार्यस्थल',
                orgError: 'कृपया वर्तमान संस्था या पेशा दर्ज करें',
                messageLabel: 'अतिरिक्त संदेश (Additional Message) - वैकल्पिक / Optional',
                messagePlaceholder: 'आपका अनुभव या कोई अन्य जानकारी (वैकल्पिक)...',
                defaultMessage: 'मैं अल्फा न्यूज़ रिपोर्टर के रूप में काम करने का इच्छुक हूँ',
                rulesAgreeText: 'मैंने ऊपर दिए गए सभी नियम पढ़ लिए हैं और उनसे पूरी तरह सहमत हूँ। *',
                rulesAgreeError: 'कृपया ऊपर दिए गए नियमों को पढ़कर सहमति दें',
                validationBanner: 'कृपया लाल रंग से चिह्नित सभी आवश्यक विवरण सही से भरें।',
                submittingText: 'जमा किया जा रहा है...',
                submitBtnText: 'आवेदन जमा करें',
                submitFailedError: 'आवेदन जमा करने में तकनीकी समस्या आई। कृपया थोड़ी देर बाद पुनः प्रयास करें।',
                approvedTitle: 'बधाई हो! 🎉',
                approvedMessage: (mandal, sub) => `${mandal} ${sub} के लिए आपका आवेदन स्वीकृत हो गया है। अब आप अल्फा न्यूज़ के अधिकृत रिपोर्टर हैं!`,
                reapplyTitle: 'समीक्षा में है ⏳',
                reapplyMessage: 'आपका पुनः आवेदन सफलतापूर्वक जमा हो गया है। हमारी संपादकीय टीम शीघ्र ही इसकी समीक्षा करेगी।',
                conflictTitle: 'समीक्षा में है ⏳',
                conflictMessage: (mandal, sub, repInfo) => `${mandal} ${sub} में पहले से ही एक सक्रिय रिपोर्टर${repInfo} कार्यरत हैं। इसलिए आपका आवेदन संपादकीय डेस्क की विशेष समीक्षा के लिए भेजा गया है।\n\nआपको एडिटोरियल डेस्क चैट में संदेश भेजा गया है, जहां आप सीधे संपर्क कर सकते हैं।`,
                conflictChatText: (name, mandal, sub) => `नमस्ते ${name || 'मित्र'}, आपके चुने हुए ${mandal} ${sub} में पहले से ही एक सक्रिय रिपोर्टर कार्यरत हैं।\n\nइसलिए आपका आवेदन एडमिन की विशेष समीक्षा के लिए भेजा गया है। हमारी संपादकीय टीम जांच कर शीघ्र ही आपसे संपर्क करेगी। आप यहीं सीधे संदेश भेज सकते हैं। धन्यवाद!`,
                conflictNotifTitle: 'आपका आवेदन समीक्षा में है ⏳',
                submittedTitle: 'आवेदन प्राप्त हुआ',
                submittedMessage: (sub) => `आपका आवेदन सफलतापूर्वक प्राप्त हो गया है। हमारी टीम आपके ${sub} विवरण की जांच कर शीघ्र संपर्क करेगी।`,
                openChatBtn: 'एडिटोरियल डेस्क चैट (Open Chat)',
                okBtn: 'ठीक है (OK)',
            };
        case 'pa':
            return {
                pageTitle: 'ਰਿਪੋਰਟਰ ਵਜੋਂ ਜੁੜੋ',
                pageSubtitle: 'ਅਲਫ਼ਾ ਨਿਊਜ਼ ਐਡੀਟੋਰੀਅਲ ਟੀਮ ਨਾਲ ਕੰਮ ਕਰੋ',
                loginRequiredTitle: 'ਲੌਗਇਨ ਜ਼ਰੂਰੀ ਹੈ',
                loginRequiredDesc: 'ਰਿਪੋਰਟਰ ਵਜੋਂ ਅਰਜ਼ੀ ਦੇਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਮੋਬਾਈਲ ਨੰਬਰ ਨਾਲ ਲੌਗਇਨ ਕਰੋ।',
                loginBtn: 'ਲੌਗਇਨ ਕਰੋ (Login)',
                closeBtn: 'ਬੰਦ ਕਰੋ (Close)',
                pendingTitle: 'ਸਮੀਖਿਆ ਅਧੀਨ ਹੈ (PENDING)',
                pendingDesc: 'ਤੁਸੀਂ ਪਹਿਲਾਂ ਹੀ ਅਰਜ਼ੀ ਜਮ੍ਹਾਂ ਕਰ ਚੁੱਕੇ ਹੋ। ਸਾਡੀ ਐਡੀਟੋਰੀਅਲ ਟੀਮ ਜਲਦੀ ਹੀ ਇਸਦੀ ਸਮੀਖਿਆ ਕਰੇਗੀ।',
                guidelinesTitle: 'ਰਿਪੋਰਟਰ ਨਿਯਮ (Reporter Guidelines)',
                guidelinesSubtitle: 'ਅਲਫ਼ਾ ਨਿਊਜ਼ ਰਿਪੋਰਟਰ ਬਣਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਹੇਠ ਲਿਖੇ ਨਿਯਮਾਂ ਦੀ ਪਾਲਣਾ ਕਰੋ:',
                rule1Title: 'ਹਰ ਰੋਜ਼ ਘੱਟੋ-ਘੱਟ ਇੱਕ ਖ਼ਬਰ',
                rule1Desc: (sub) => `ਨਿਯਮਤ ਤੌਰ 'ਤੇ ਖ਼ਬਰਾਂ ਭੇਜੋ। ਤੁਹਾਡੀ ${sub} ਤੋਂ ਹਰ ਰੋਜ਼ ਘੱਟੋ-ਘੱਟ ਇੱਕ ਸਥਾਨਕ ਖ਼ਬਰ ਜ਼ਰੂਰੀ ਹੈ।`,
                rule2Title: 'ਤੇਜ਼ ਅਤੇ ਸਹੀ ਜਾਣਕਾਰੀ',
                rule2Desc: 'ਤਾਜ਼ਾ ਅਤੇ ਭਰੋਸੇਯੋਗ ਸਥਾਨਕ ਖ਼ਬਰਾਂ ਜਲਦੀ ਤੋਂ ਜਲਦੀ ਪਾਠਕਾਂ ਤੱਕ ਪਹੁੰਚਾਓ।',
                rule3Title: 'ਗੁਣਵੱਤਾ ਅਤੇ ਸੰਪਾਦਕੀ ਅਧਿਕਾਰ',
                rule3Desc: 'ਜੇਕਰ ਨਿਯਮਤ ਅਤੇ ਗੁਣਵੱਤਾ ਭਰਪੂਰ ਖ਼ਬਰਾਂ ਨਹੀਂ ਭੇਜੀਆਂ ਜਾਂਦੀਆਂ, ਤਾਂ ਸੰਪਾਦਕੀ ਡੈਸਕ ਕੋਲ ਹੋਰ ਰਿਪੋਰਟਰ ਨਿਯੁਕਤ ਕਰਨ ਦਾ ਅਧਿਕਾਰ ਹੋਵੇਗਾ।',
                personalDetailsTitle: 'ਨਿੱਜੀ ਵੇਰਵੇ (Personal Details)',
                fullNameLabel: 'ਪੂਰਾ ਨਾਮ (Full Name) *',
                fullNamePlaceholder: 'ਆਪਣਾ ਪੂਰਾ ਨਾਮ ਲਿਖੋ',
                fullNameError: 'ਕਿਰਪਾ ਕਰਕੇ ਘੱਟੋ-ਘੱਟ 3 ਅੱਖਰਾਂ ਦਾ ਪੂਰਾ ਨਾਮ ਦਰਜ ਕਰੋ',
                fatherNameLabel: 'ਪਿਤਾ ਦਾ ਨਾਮ (Father\'s Name) *',
                fatherNamePlaceholder: 'ਪਿਤਾ ਦਾ ਨਾਮ ਲਿਖੋ',
                fatherNameError: 'ਕਿਰਪਾ ਕਰਕੇ ਘੱਟੋ-ਘੱਟ 3 ਅੱਖਰਾਂ ਦਾ ਪਿਤਾ ਦਾ ਨਾਮ ਦਰਜ ਕਰੋ',
                phoneLabel: 'ਫ਼ੋਨ ਨੰਬਰ (Phone Number - 10 Digits) *',
                phonePlaceholder: '10 ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ',
                phoneError: 'ਕਿਰਪਾ ਕਰਕੇ ਸਹੀ 10 ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ ਦਰਜ ਕਰੋ (6-9 ਤੋਂ ਸ਼ੁਰੂ)',
                addressLabel: 'ਪੂਰਾ ਪਤਾ (Address) *',
                addressPlaceholder: 'ਮਕਾਨ ਨੰ., ਗਲੀ, ਪਿੰਡ / ਸ਼ਹਿਰ',
                addressError: 'ਕਿਰਪਾ ਕਰਕੇ ਘੱਟੋ-ਘੱਟ 6 ਅੱਖਰਾਂ ਦਾ ਪਤਾ ਦਰਜ ਕਰੋ',
                regionDetailsTitle: 'ਖੇਤਰ ਵੇਰਵੇ (Region Details)',
                stateLabel: 'ਰਾਜ (State) *',
                districtLabel: 'ਜ਼ਿਲ੍ਹਾ (District) *',
                districtSelectPlaceholder: '-- ਜ਼ਿਲ੍ਹਾ ਚੁਣੋ --',
                districtError: 'ਕਿਰਪਾ ਕਰਕੇ ਜ਼ਿਲ੍ਹਾ ਚੁਣੋ',
                subDistrictLabel: (sub, en) => `${sub} (${en}) *`,
                subDistrictSelectPlaceholder: (sub) => `-- ${sub} ਚੁਣੋ --`,
                subDistrictError: (sub) => `ਕਿਰਪਾ ਕਰਕੇ ${sub} ਚੁਣੋ`,
                professionalDetailsTitle: 'ਪੇਸ਼ੇਵਰ ਵੇਰਵੇ (Professional Details)',
                positionLabel: 'ਅਹੁਦਾ (Position)',
                positionValue: (sub, en) => `${sub} ਰਿਪੋਰਟਰ (${en} Reporter)`,
                categoryLabel: 'ਦਿਲਚਸਪੀ ਵਾਲੀ ਸ਼੍ਰੇਣੀ (Interested Category) *',
                categoryPlaceholder: 'ਜਿਵੇਂ: ਰਾਜਨੀਤੀ, ਖੇਤੀਬਾੜੀ, ਖੇਡਾਂ, ਸਿੱਖਿਆ',
                categoryError: 'ਕਿਰਪਾ ਕਰਕੇ ਦਿਲਚਸਪੀ ਵਾਲੀ ਸ਼੍ਰੇਣੀ ਦਰਜ ਕਰੋ',
                educationLabel: 'ਵਿਦਿਅਕ ਯੋਗਤਾ (Education Qualification) *',
                educationPlaceholder: 'ਜਿਵੇਂ: ਗ੍ਰੈਜੂਏਟ, 12ਵੀਂ, ਪੋਸਟ ਗ੍ਰੈਜੂਏਟ',
                educationError: 'ਕਿਰਪਾ ਕਰਕੇ ਵਿਦਿਅਕ ਯੋਗਤਾ ਦਰਜ ਕਰੋ',
                orgLabel: 'ਮੌਜੂਦਾ ਸੰਸਥਾ / ਪੇਸ਼ਾ (Organization / Job) *',
                orgPlaceholder: 'ਮੌਜੂਦਾ ਪੇਸ਼ਾ / ਕੰਮ ਵਾਲੀ ਥਾਂ',
                orgError: 'ਕਿਰਪਾ ਕਰਕੇ ਮੌਜੂਦਾ ਸੰਸਥਾ ਜਾਂ ਪੇਸ਼ਾ ਦਰਜ ਕਰੋ',
                messageLabel: 'ਵਾਧੂ ਸੁਨੇਹਾ (Additional Message) - ਵਿਕਲਪਿਕ / Optional',
                messagePlaceholder: 'ਤੁਹਾਡਾ ਤਜਰਬਾ ਜਾਂ ਹੋਰ ਜਾਣਕਾਰੀ (ਵਿਕਲਪਿਕ)...',
                defaultMessage: 'ਮੈਂ ਅਲਫ਼ਾ ਨਿਊਜ਼ ਰਿਪੋਰਟਰ ਵਜੋਂ ਕੰਮ ਕਰਨ ਦਾ ਚਾਹਵਾਨ ਹਾਂ',
                rulesAgreeText: 'ਮੈਂ ਉੱਪਰ ਦਿੱਤੇ ਸਾਰੇ ਨਿਯਮ ਪੜ੍ਹ ਲਏ ਹਨ ਅਤੇ ਪੂਰੀ ਤਰ੍ਹਾਂ ਸਹਿਮਤ ਹਾਂ। *',
                rulesAgreeError: 'ਕਿਰਪਾ ਕਰਕੇ ਉੱਪਰ ਦਿੱਤੇ ਨਿਯਮਾਂ ਨਾਲ ਸਹਿਮਤੀ ਦਿਓ',
                validationBanner: 'ਕਿਰਪਾ ਕਰਕੇ ਲਾਲ ਰੰਗ ਵਿੱਚ ਦਿਖਾਏ ਗਏ ਸਾਰੇ ਵੇਰਵੇ ਸਹੀ ਢੰਗ ਨਾਲ ਭਰੋ।',
                submittingText: 'ਜਮ੍ਹਾਂ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ...',
                submitBtnText: 'ਅਰਜ਼ੀ ਜਮ੍ਹਾਂ ਕਰੋ',
                submitFailedError: 'ਅਰਜ਼ੀ ਜਮ੍ਹਾਂ ਕਰਨ ਵਿੱਚ ਤਕਨੀਕੀ ਸਮੱਸਿਆ ਆਈ। ਕਿਰਪਾ ਕਰਕੇ ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
                approvedTitle: 'ਵਧਾਈਆਂ! 🎉',
                approvedMessage: (mandal, sub) => `${mandal} ${sub} ਲਈ ਤੁਹਾਡੀ ਅਰਜ਼ੀ ਮਨਜ਼ੂਰ ਹੋ ਗਈ ਹੈ। ਤੁਸੀਂ ਹੁਣ ਅਲਫ਼ਾ ਨਿਊਜ਼ ਦੇ ਰਿਪੋਰਟਰ ਵਜੋਂ ਨਿਯੁਕਤ ਹੋ ਗਏ ਹੋ!`,
                reapplyTitle: 'ਸਮੀਖਿਆ ਅਧੀਨ ਹੈ ⏳',
                reapplyMessage: 'ਤੁਹਾਡੀ ਮੁੜ-ਅਰਜ਼ੀ ਸਫਲਤਾਪੂਰਵਕ ਜਮ੍ਹਾਂ ਹੋ ਗਈ ਹੈ। ਸਾਡੀ ਸੰਪਾਦਕੀ ਟੀਮ ਜਲਦੀ ਹੀ ਸਮੀਖਿਆ ਕਰੇਗੀ।',
                conflictTitle: 'ਸਮੀਖਿਆ ਅਧੀਨ ਹੈ ⏳',
                conflictMessage: (mandal, sub, repInfo) => `${mandal} ${sub} ਵਿੱਚ ਪਹਿਲਾਂ ਹੀ ਇੱਕ ਸਰਗਰਮ ਰਿਪੋਰਟਰ${repInfo} ਮੌਜੂਦ ਹਨ। ਇਸ ਲਈ ਤੁਹਾਡੀ ਅਰਜ਼ੀ ਸੰਪਾਦਕੀ ਡੈਸਕ ਦੀ ਵਿਸ਼ੇਸ਼ ਸਮੀਖਿਆ ਲਈ ਭੇਜੀ ਗਈ ਹੈ।\n\nਤੁਹਾਨੂੰ ਐਡੀਟੋਰੀਅਲ ਡੈਸਕ ਚੈਟ ਵਿੱਚ ਸੁਨੇਹਾ ਭੇਜਿਆ ਗਿਆ ਹੈ।`,
                conflictChatText: (name, mandal, sub) => `ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${name || 'ਮਿੱਤਰ'}, ਤੁਹਾਡੀ ਚੁਣੀ ${mandal} ${sub} ਵਿੱਚ ਪਹਿਲਾਂ ਹੀ ਇੱਕ ਸਰਗਰਮ ਰਿਪੋਰਟਰ ਮੌਜੂਦ ਹਨ।\n\nਇਸ ਲਈ ਤੁਹਾਡੀ ਅਰਜ਼ੀ ਵਿਸ਼ੇਸ਼ ਸਮੀਖਿਆ ਲਈ ਭੇਜੀ ਗਈ ਹੈ। ਸਾਡੀ ਸੰਪਾਦਕੀ ਟੀਮ ਜਲਦੀ ਹੀ ਤੁਹਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੇਗੀ। ਧੰਨਵਾਦ!`,
                conflictNotifTitle: 'ਤੁਹਾਡੀ ਅਰਜ਼ੀ ਸਮੀਖਿਆ ਅਧੀਨ ਹੈ ⏳',
                submittedTitle: 'ਅਰਜ਼ੀ ਪ੍ਰਾਪਤ ਹੋਈ',
                submittedMessage: (sub) => `ਤੁਹਾਡੀ ਅਰਜ਼ੀ ਸਫਲਤਾਪੂਰਵਕ ਪ੍ਰਾਪਤ ਹੋ ਗਈ ਹੈ। ਸਾਡੀ ਟੀਮ ਤੁਹਾਡੇ ${sub} ਵੇਰਵਿਆਂ ਦੀ ਜਾਂਚ ਕਰਕੇ ਜਲਦੀ ਸੰਪਰਕ ਕਰੇਗੀ।`,
                openChatBtn: 'ਐਡੀਟੋਰੀਅਲ ਡੈਸਕ ਚੈਟ (Open Chat)',
                okBtn: 'ਠੀਕ ਹੈ (OK)',
            };
        case 'gu':
            return {
                pageTitle: 'રિપોર્ટર તરીકે જોડાઓ',
                pageSubtitle: 'આલ્ફા ન્યૂઝ એડિટોરિયલ ટીમ સાથે કામ કરો',
                loginRequiredTitle: 'લોગિન જરૂરી છે',
                loginRequiredDesc: 'રિપોર્ટર તરીકે અરજી કરવા માટે કૃપા કરીને તમારા મોબાઇલ નંબરથી લોગિન કરો.',
                loginBtn: 'લોગિન કરો (Login)',
                closeBtn: 'બંધ કરો (Close)',
                pendingTitle: 'સમીક્ષા હેઠળ છે (PENDING)',
                pendingDesc: 'તમે પહેલેથી જ એક અરજી સબમિટ કરી છે. અમારી એડિટોરિયલ ટીમ ટૂંક સમયમાં તેની સમીક્ષા કરશે.',
                guidelinesTitle: 'રિપોર્ટર નિયમો (Reporter Guidelines)',
                guidelinesSubtitle: 'આલ્ફા ન્યૂઝ રિપોર્ટર બનવા માટે કૃપા કરીને નીચેના નિયમોનું પાલન કરો:',
                rule1Title: 'દરરોજ ઓછામાં ઓછા એક સમાચાર',
                rule1Desc: (sub) => `નિયમિતપણે સમાચાર મોકલો. તમારા ${sub} ના દરરોજ ઓછામાં ઓછા એક સ્થાનિક સમાચાર ફરજિયાત છે.`,
                rule2Title: 'ઝડપી અને સચોટ માહિતી',
                rule2Desc: 'તાજા અને વિશ્વસનીય સ્થાનિક સમાચાર વહેલી તકે વાચકો સુધી પહોંચાડો.',
                rule3Title: 'ગુણવત્તા અને સંપાદકીય અધિકાર',
                rule3Desc: 'જો નિયમિત અને ગુણવત્તાયુક્ત સમાચાર ન મોકલવામાં આવે તો સંપાદકીય ડેસ્કને અન્ય રિપોર્ટર નિયુક્ત કરવાનો અધિકાર રહેશે.',
                personalDetailsTitle: 'વ્યક્તિગત વિગતો (Personal Details)',
                fullNameLabel: 'પૂરું નામ (Full Name) *',
                fullNamePlaceholder: 'તમારું પૂરું નામ લખો',
                fullNameError: 'કૃપા કરીને ઓછામાં ઓછા 3 અક્ષરોનું પૂરું નામ દાખલ કરો',
                fatherNameLabel: 'પિતાનું નામ (Father\'s Name) *',
                fatherNamePlaceholder: 'પિતાનું નામ લખો',
                fatherNameError: 'કૃપા કરીને ઓછામાં ઓછા 3 અક્ષરોનું પિતાનું નામ દાખલ કરો',
                phoneLabel: 'ફોન નંબર (Phone Number - 10 Digits) *',
                phonePlaceholder: '10 અંકનો મોબાઇલ નંબર',
                phoneError: 'કૃપા કરીને માન્ય 10 અંકનો મોબાઇલ નંબર દાખલ કરો (6-9 થી શરૂ)',
                addressLabel: 'પૂરું સરનામું (Address) *',
                addressPlaceholder: 'ઘર નં., શેરી, ગામ / શહેર',
                addressError: 'કૃપા કરીને ઓછામાં ઓછા 6 અક્ષરોનું સરનામું દાખલ કરો',
                regionDetailsTitle: 'વિસ્તારની વિગતો (Region Details)',
                stateLabel: 'રાજ્ય (State) *',
                districtLabel: 'જિલ્લો (District) *',
                districtSelectPlaceholder: '-- જિલ્લો પસંદ કરો --',
                districtError: 'કૃપા કરીને જિલ્લો પસંદ કરો',
                subDistrictLabel: (sub, en) => `${sub} (${en}) *`,
                subDistrictSelectPlaceholder: (sub) => `-- ${sub} પસંદ કરો --`,
                subDistrictError: (sub) => `કૃપા કરીને ${sub} પસંદ કરો`,
                professionalDetailsTitle: 'વ્યવસાયિક વિગતો (Professional Details)',
                positionLabel: 'હોદ્દો (Position)',
                positionValue: (sub, en) => `${sub} રિપોર્ટર (${en} Reporter)`,
                categoryLabel: 'રસની શ્રેણી (Interested Category) *',
                categoryPlaceholder: 'દા.ત.: રાજકારણ, કૃષિ, રમતગમત, શિક્ષણ',
                categoryError: 'કૃપા કરીને રસની શ્રેણી દાખલ કરો',
                educationLabel: 'શૈક્ષણિક લાયકાત (Education Qualification) *',
                educationPlaceholder: 'દા.ત.: સ્નાતક, 12 પાસ, અનુસ્નાતક',
                educationError: 'કૃપા કરીને શૈક્ષણિક લાયકાત દાખલ કરો',
                orgLabel: 'વર્તમાન સંસ્થા / વ્યવસાય (Organization / Job) *',
                orgPlaceholder: 'વર્તમાન વ્યવસાય / કાર્યસ્થળ',
                orgError: 'કૃપા કરીને વર્તમાન સંસ્થા અથવા વ્યવસાય દાખલ કરો',
                messageLabel: 'વધારાનો સંદેશ (Additional Message) - વૈકલ્પિક / Optional',
                messagePlaceholder: 'તમારો અનુભવ અથવા અન્ય વિગતો (વૈકલ્પિક)...',
                defaultMessage: 'હું આલ્ફા ન્યૂઝ રિપોર્ટર તરીકે કામ કરવા ઉત્સુક છું',
                rulesAgreeText: 'મેં ઉપરના તમામ નિયમો વાંચ્યા છે અને સંપૂર્ણપણે સંમત છું. *',
                rulesAgreeError: 'કૃપા કરીને ઉપરના નિયમો વાંચીને સંમતિ આપો',
                validationBanner: 'કૃપા કરીને લાલ રંગમાં દર્શાવેલ તમામ જરૂરી વિગતો યોગ્ય રીતે ભરો.',
                submittingText: 'સબમિટ થઈ રહ્યું છે...',
                submitBtnText: 'અરજી સબમિટ કરો',
                submitFailedError: 'અરજી સબમિટ કરવામાં તકનીકી સમસ્યા આવી. કૃપા કરીને થોડીવાર પછી ફરી પ્રયાસ કરો.',
                approvedTitle: 'અભિનંદન! 🎉',
                approvedMessage: (mandal, sub) => `${mandal} ${sub} માટે તમારી અરજી મંજૂર થઈ ગઈ છે. હવે તમે આલ્ફા ન્યૂઝના અધિકૃત રિપોર્ટર છો!`,
                reapplyTitle: 'સમીક્ષા હેઠળ છે ⏳',
                reapplyMessage: 'તમારી પુનઃ અરજી સફળતાપૂર્વક સબમિટ થઈ ગઈ છે. અમારી સંપાદકીય ટીમ ટૂંક સમયમાં સમીક્ષા કરશે.',
                conflictTitle: 'સમીક્ષા હેઠળ છે ⏳',
                conflictMessage: (mandal, sub, repInfo) => `${mandal} ${sub} માં પહેલેથી જ સક્રિય રિપોર્ટર${repInfo} કાર્યરત છે. તેથી તમારી અરજી સંપાદકીય ડેસ્કની વિશેષ સમીક્ષા માટે મોકલવામાં આવી છે.\n\nતમને એડિટોરિયલ ડેસ્ક ચેટમાં સંદેશ મોકલવામાં આવ્યો છે.`,
                conflictChatText: (name, mandal, sub) => `નમસ્તે ${name || 'મિત્ર'}, તમારા પસંદ કરેલા ${mandal} ${sub} માં પહેલેથી જ એક સક્રિય રિપોર્ટર કાર્યરત છે.\n\nતેથી તમારી અરજી વિશેષ સમીક્ષા માટે મોકલવામાં આવી છે. અમારી સંપાદકીય ટીમ ટૂંક સમયમાં તમારો સંપર્ક કરશે. આભાર!`,
                conflictNotifTitle: 'તમારી અરજી સમીક્ષા હેઠળ છે ⏳',
                submittedTitle: 'અરજી પ્રાપ્ત થઈ',
                submittedMessage: (sub) => `તમારી અરજી સફળતાપૂર્વક મળી ગઈ છે. અમારી ટીમ તમારા ${sub} ની વિગતો તપાસીને ટૂંક સમયમાં સંપર્ક કરશે.`,
                openChatBtn: 'એડિટોરિયલ ડેસ્ક ચેટ (Open Chat)',
                okBtn: 'બરાબર (OK)',
            };
        case 'en':
            return {
                pageTitle: 'Join as a Reporter',
                pageSubtitle: 'Work with the Alfa News Editorial Team',
                loginRequiredTitle: 'Login Required',
                loginRequiredDesc: 'Please sign in with your mobile number to apply as a reporter.',
                loginBtn: 'Login',
                closeBtn: 'Close',
                pendingTitle: 'Under Review (PENDING)',
                pendingDesc: 'You already have an active reporter application under review. Our editorial team will review it shortly.',
                guidelinesTitle: 'Reporter Guidelines',
                guidelinesSubtitle: 'Please follow these editorial guidelines to join as an Alfa News Reporter:',
                rule1Title: 'At Least One Report Daily',
                rule1Desc: (sub) => `Submit local news regularly. At least one verified news story from your ${sub} every day is expected.`,
                rule2Title: 'Timely & Accurate Reporting',
                rule2Desc: 'Deliver accurate, verified local updates to readers as promptly as possible.',
                rule3Title: 'Quality & Editorial Standards',
                rule3Desc: 'If consistent, quality reporting is not maintained, the Editorial Desk reserves the right to assign another reporter.',
                personalDetailsTitle: 'Personal Details',
                fullNameLabel: 'Full Name *',
                fullNamePlaceholder: 'Enter your full name',
                fullNameError: 'Please enter your full name (at least 3 characters)',
                fatherNameLabel: "Father's Name *",
                fatherNamePlaceholder: "Enter father's name",
                fatherNameError: "Please enter father's name (at least 3 characters)",
                phoneLabel: 'Phone Number (10 Digits) *',
                phonePlaceholder: '10-digit mobile number',
                phoneError: 'Please enter a valid 10-digit mobile number (starting with 6-9)',
                addressLabel: 'Address *',
                addressPlaceholder: 'House No., Street, Village / City',
                addressError: 'Please enter your address (at least 6 characters)',
                regionDetailsTitle: 'Region Details',
                stateLabel: 'State *',
                districtLabel: 'District *',
                districtSelectPlaceholder: '-- Select District --',
                districtError: 'Please select a district',
                subDistrictLabel: (sub) => `${sub} *`,
                subDistrictSelectPlaceholder: (sub) => `-- Select ${sub} --`,
                subDistrictError: (sub) => `Please select your ${sub}`,
                professionalDetailsTitle: 'Professional Details',
                positionLabel: 'Position',
                positionValue: (_sub, en) => `${en} Reporter`,
                categoryLabel: 'Interested Category *',
                categoryPlaceholder: 'e.g., Politics, Crime, Agriculture, Sports',
                categoryError: 'Please enter your interested category',
                educationLabel: 'Education Qualification *',
                educationPlaceholder: 'e.g., Graduate, 12th, Post Graduate',
                educationError: 'Please enter your education qualification',
                orgLabel: 'Current Organization / Occupation *',
                orgPlaceholder: 'Current occupation / workplace',
                orgError: 'Please enter your current organization or occupation',
                messageLabel: 'Additional Message (Optional)',
                messagePlaceholder: 'Share your reporting experience or notes (optional)...',
                defaultMessage: 'Interested in working as an Alfa News Reporter',
                rulesAgreeText: 'I have read and agree to all the reporter guidelines above. *',
                rulesAgreeError: 'Please read and accept the guidelines above',
                validationBanner: 'Please fill in all required fields highlighted in red before submitting.',
                submittingText: 'Submitting...',
                submitBtnText: 'Submit Application',
                submitFailedError: 'Could not submit your application right now. Please try again in a moment.',
                approvedTitle: 'Congratulations! 🎉',
                approvedMessage: (mandal, sub) => `Your application for ${mandal} ${sub} has been approved. You are now an authorized Alfa News Reporter!`,
                reapplyTitle: 'Under Review ⏳',
                reapplyMessage: 'Your re-application has been submitted successfully. Our editorial team will review it shortly.',
                conflictTitle: 'Under Review ⏳',
                conflictMessage: (mandal, sub, repInfo) => `An active reporter${repInfo} is already assigned to ${mandal} ${sub}. Your application has been sent for special review by our Editorial Desk.\n\nA message has been sent to your Editorial Desk Chat where you can reply directly.`,
                conflictChatText: (name, mandal, sub) => `Hello ${name || 'Friend'}, an active reporter is already assigned to ${mandal} ${sub}.\n\nYour application has been forwarded for special review by our Editorial Desk. Our team will reach out shortly. You may reply directly here if you have any details to share. Thank you!`,
                conflictNotifTitle: 'Your application is under review ⏳',
                submittedTitle: 'Application Submitted',
                submittedMessage: (sub) => `Your application has been received. Our editorial team will review your ${sub} details and contact you soon.`,
                openChatBtn: 'Editorial Desk Chat',
                okBtn: 'OK',
            };
        case 'te':
        default:
            return {
                pageTitle: 'రిపోర్టర్‌గా చేరండి',
                pageSubtitle: 'ఆల్ఫా న్యూస్ టీమ్ తో కలిసి పనిచేయండి',
                loginRequiredTitle: 'లాగిన్ అవసరం',
                loginRequiredDesc: 'విలేకరిగా దరఖాస్తు చేసుకోవడానికి దయచేసి మీ మొబైల్ నంబర్‌తో లాగిన్ అవ్వండి.',
                loginBtn: 'లాగిన్ అవ్వండి (Login)',
                closeBtn: 'రద్దు చేయి (Close)',
                pendingTitle: 'పరిశీలనలో ఉంది (PENDING)',
                pendingDesc: 'మీరు ఇప్పటికే ఒక దరఖాస్తును సమర్పించారు. అది ప్రస్తుతం పరిశీలనలో ఉంది. మా ప్రతినిధులు త్వరలోనే మీ దరఖాస్తును పరిశీలిస్తారు.',
                guidelinesTitle: 'విలేకరి నిబంధనలు (Reporter Guidelines)',
                guidelinesSubtitle: 'ఆల్ఫా న్యూస్ విలేకరిగా చేరడానికి క్రింది నిబంధనలను పాటించాలి:',
                rule1Title: 'ప్రతిరోజూ కనీసం ఒక వార్త',
                rule1Desc: (sub) => `రెగ్యులర్‌గా వార్తలు పెట్టాలి. మీ ${sub}కు సంబంధించిన వార్త ప్రతిరోజూ కనీసం ఒక్కటైనా తప్పనిసరిగా ఉండాలి.`,
                rule2Title: 'త్వరితగతిన సమాచారం',
                rule2Desc: 'వార్తలను వీలైనంత త్వరగా తాజా సమాచారంతో అందించగలగాలి.',
                rule3Title: 'నాణ్యత & యాజమాన్య హక్కు',
                rule3Desc: 'మీరు నాణ్యమైన వార్తలు అందించడంలో విఫలమైతే వెంటనే మిమ్మల్ని మార్చి వేరే విలేకరిని నియమించుకునే హక్కు యాజమాన్యానికి ఉంటుంది.',
                personalDetailsTitle: 'వ్యక్తిగత వివరాలు (Personal Details)',
                fullNameLabel: 'పూర్తి పేరు (Full Name) *',
                fullNamePlaceholder: 'మీ పూర్తి పేరు',
                fullNameError: 'కనీసం 3 అక్షరాలతో పూర్తి పేరు నమోదు చేయండి',
                fatherNameLabel: "తండ్రి పేరు (Father's Name) *",
                fatherNamePlaceholder: 'తండ్రి పేరు',
                fatherNameError: 'కనీసం 3 అక్షరాలతో తండ్రి పేరు నమోదు చేయండి',
                phoneLabel: 'ఫోన్ నంబర్ (Phone Number - 10 Digits) *',
                phonePlaceholder: '10 అంకెల మొబైల్ నంబర్',
                phoneError: 'చెల్లుబాటు అయ్యే 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి (6-9 తో ప్రారంభం కావాలి)',
                addressLabel: 'చిరునామా (Address) *',
                addressPlaceholder: 'ఇంటి నెం, వీధి, గ్రామం',
                addressError: 'కనీసం 6 అక్షరాలతో చిరునామా నమోదు చేయండి',
                regionDetailsTitle: 'ప్రాంతం వివరాలు (Region Details)',
                stateLabel: 'రాష్ట్రం (State) *',
                districtLabel: 'జిల్లా (District) *',
                districtSelectPlaceholder: '-- జిల్లాను ఎంచుకోండి --',
                districtError: 'దయచేసి జిల్లాను ఎంచుకోండి',
                subDistrictLabel: (sub, en) => `${sub} (${en}) *`,
                subDistrictSelectPlaceholder: (sub) => `-- ${sub} ఎంచుకోండి --`,
                subDistrictError: (sub) => `దయచేసి ${sub}ను ఎంచుకోండి`,
                professionalDetailsTitle: 'వృత్తి & ఇతర వివరాలు (Professional Details)',
                positionLabel: 'హోదా (Position)',
                positionValue: (_sub, en) => `మండల రిపోర్టర్ (${en} Reporter)`,
                categoryLabel: 'ఆసక్తి ఉన్న కేటగిరీ (Interested Category) *',
                categoryPlaceholder: 'ఉదా: రాజకీయం, క్రైమ్, వ్యవసాయం',
                categoryError: 'ఆసక్తి ఉన్న కేటగిరీని నమోదు చేయండి',
                educationLabel: 'విద్యార్హత (Education Qualification) *',
                educationPlaceholder: 'ఉదా: డిగ్రీ, ఇంటర్, పిజి',
                educationError: 'విద్యార్హతను నమోదు చేయండి',
                orgLabel: 'ప్రస్తుత సంస్థ / వృత్తి (Organization / Job) *',
                orgPlaceholder: 'ప్రస్తుత వృత్తి / పనిచేస్తున్న సంస్థ',
                orgError: 'ప్రస్తుత సంస్థ లేదా వృత్తిని నమోదు చేయండి',
                messageLabel: 'సందేశం (Additional Message) - ఐచ్ఛికం / Optional',
                messagePlaceholder: 'మీ అనుభవం లేదా మాతో పంచుకోవాలనుకుంటున్న వివరాలు (ఐచ్ఛికం)...',
                defaultMessage: 'విలేకరిగా పనిచేయడానికి ఆసక్తిగా ఉన్నాను',
                rulesAgreeText: 'నేను పై నిబంధనలన్నింటినీ చదివాను, వీటికి పూర్తిగా అంగీకరిస్తున్నాను. *',
                rulesAgreeError: 'దయచేసి పై నిబంధనలను చదివి అంగీకరించండి',
                validationBanner: 'దయచేసి ఎరుపు రంగులో ఉన్న వివరాలన్నీ సరిగ్గా నింపిన తర్వాతే సబ్మిట్ చేయండి.',
                submittingText: 'సమర్పిస్తోంది...',
                submitBtnText: 'దరఖాస్తును సమర్పించండి',
                submitFailedError: 'దరఖాస్తు సమర్పించడంలో సాంకేతిక లోపం ఏర్పడింది. దయచేసి కాసేపటి తర్వాత ప్రయత్నించండి.',
                approvedTitle: 'అభినందనలు! 🎉',
                approvedMessage: (mandal, sub) => `${mandal} ${sub}కు మీ దరఖాస్తు ఆమోదించబడింది. మీరు ఇప్పుడు ఆల్ఫా న్యూస్ రిపోర్టర్‌గా నియమించబడ్డారు!`,
                reapplyTitle: 'పరిశీలనలో ఉంది ⏳',
                reapplyMessage: 'మీ రీ-అప్లికేషన్ విజయవంతంగా సమర్పించబడింది. మా అడ్మిన్ ప్రతినిధులు త్వరలోనే పరిశీలిస్తారు.',
                conflictTitle: 'పరిశీలనలో ఉంది ⏳',
                conflictMessage: (mandal, sub, repInfo) => `${mandal} ${sub}కు ఇప్పటికే క్రియాశీల విలేకరి${repInfo} ఉన్నారు. అందువల్ల మీ దరఖాస్తు అడ్మిన్ ప్రత్యేక పరిశీలనకు పంపబడింది.\n\nఅడ్మిన్ డెస్క్ నుండి మీకు సందేశం (Message) వచ్చింది. మీరు అడ్మిన్‌తో మాట్లాడవచ్చు / రిప్లై ఇవ్వవచ్చు.`,
                conflictChatText: (name, mandal, sub) => `నమస్కారం ${name || 'మిత్రమా'}, మీరు కోరిన ${mandal} ${sub}కు ఇప్పటికే క్రియాశీల విలేకరి ఉన్నారు.\n\nఅందువల్ల మీ దరఖాస్తు అడ్మిన్ ప్రత్యేక పరిశీలనకు పంపబడింది. మా అడ్మిన్ టీమ్ పరిశీలించి త్వరలోనే మిమ్మల్ని సంప్రదిస్తారు. మీకు ఏవైనా సందేహాలున్నా లేదా మీ వివరాలు తెలియజేయాలన్నా ఇక్కడే అడ్మిన్‌కు నేరుగా మెసేజ్ / రిప్లై ఇవ్వవచ్చు. ధన్యవాదాలు!`,
                conflictNotifTitle: 'మీ దరఖాస్తు పరిశీలనలో ఉంది ⏳',
                submittedTitle: 'దరఖాస్తు సమర్పించబడింది',
                submittedMessage: (sub) => `మీ దరఖాస్తు విజయవంతంగా మాకు అందింది. మీ ${sub}కు సంబంధించిన వివరాలను మా బృందం పరిశీలించి త్వరలో సంప్రదిస్తుంది.`,
                openChatBtn: 'అడ్మిన్ డెస్క్ చాట్ (Open Chat)',
                okBtn: 'సరే (OK)',
            };
    }
}

const JoinReporterPage: React.FC<JoinReporterPageProps> = ({
    user,
    language,
    onClose,
    onLoginRequest,
    onOpenChat,
}) => {
    const isUserLoggedIn = Boolean(user && user.id && user.id !== 'guest' && user.id !== 'guest-user');

    const initialState: StateCode = useMemo(() => {
        return (
            resolveStateCode(user?.stateCode) ||
            resolveStateCode(user?.state) ||
            resolveStateCode(user?.district) ||
            getStoredStateCode()
        );
    }, [user?.stateCode, user?.state, user?.district]);

    const initialDistrict = useMemo(() => {
        const candidate = user?.district || '';
        const list = EDITIONS[initialState]?.districts || [];
        return list.includes(candidate) ? candidate : '';
    }, [initialState, user?.district]);

    const [hasPendingApplication, setHasPendingApplication] = useState(false);
    const [fullName, setFullName] = useState(user?.name || '');
    const [fatherName, setFatherName] = useState('');
    const [phone, setPhone] = useState((user?.phone || '').replace(/\D/g, '').slice(-10));
    const [address, setAddress] = useState(user?.address || '');

    const [selectedState, setSelectedState] = useState<StateCode>(initialState);
    const [selectedDistrict, setSelectedDistrict] = useState(initialDistrict);
    const [selectedMandal, setSelectedMandal] = useState('');

    const [interestedArea, setInterestedArea] = useState('');
    const [education, setEducation] = useState('');
    const [currentOrg, setCurrentOrg] = useState('');
    const [additionalMessage, setAdditionalMessage] = useState('');

    const [rulesCheckboxChecked, setRulesCheckboxChecked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [resultDialog, setResultDialog] = useState<{ title: string; message: string; isSuccess: boolean; isConflict?: boolean } | null>(null);
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

    const effectiveLang: LanguageCode = validateLanguageForState(
        selectedState,
        language || (user?.language as string | undefined)
    );
    const t = useMemo(() => getFormStrings(effectiveLang), [effectiveLang]);
    const subDistLabel = useMemo(
        () => getSubDistrictFormLabel(selectedState, effectiveLang),
        [selectedState, effectiveLang]
    );
    const headlineFont = getHeadlineFontClass(effectiveLang);
    const bodyFont = getBodyFontClass(effectiveLang);

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const isPhoneValid = cleanPhone.length === 10 && /^[6-9]\d{9}$/.test(cleanPhone);
    const isFullNameValid = fullName.trim().length >= 3;
    const isFatherNameValid = fatherName.trim().length >= 3;
    const isAddressValid = address.trim().length >= 6;
    const isDistrictValid = selectedDistrict.trim().length > 0;
    const isMandalValid = selectedMandal.trim().length > 0;
    const isCategoryValid = interestedArea.trim().length >= 2;
    const isEducationValid = education.trim().length >= 2;
    const isOrgValid = currentOrg.trim().length >= 2;
    const isRulesValid = rulesCheckboxChecked;

    const isFormValid = isFullNameValid && isFatherNameValid && isPhoneValid && isAddressValid &&
        isDistrictValid && isMandalValid && isCategoryValid && isEducationValid && isOrgValid && isRulesValid;

    // Check if user has an existing pending application (strictly bounded query)
    useEffect(() => {
        const checkPending = async () => {
            if (!isUserLoggedIn || !user?.id) return;
            try {
                const q = query(
                    collection(db, 'reporter_applications'),
                    where('userId', '==', user.id),
                    where('status', '==', 'PENDING'),
                    limit(5)
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

    const handleStateChange = (newState: StateCode) => {
        setSelectedState(newState);
        setSelectedDistrict('');
        setSelectedMandal('');
        setSubmitError(null);
    };

    const handleDistrictChange = (newDistrict: string) => {
        setSelectedDistrict(newDistrict);
        setSelectedMandal('');
        setSubmitError(null);
    };

    const districtsList = EDITIONS[selectedState]?.districts || [];
    const mandalsList = selectedDistrict ? getMandalsForDistrict(selectedDistrict) : [];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setHasAttemptedSubmit(true);
        setSubmitError(null);

        if (!isRulesValid) {
            setSubmitError(t.rulesAgreeError);
            return;
        }

        if (!isFormValid) {
            setSubmitError(t.validationBanner);
            return;
        }

        setIsSubmitting(true);

        try {
            const targetPosition = t.positionValue(subDistLabel.local, subDistLabel.en);
            const finalFullName = fullName.trim();
            const finalFatherName = fatherName.trim();
            const finalPhone = cleanPhone;
            const finalAddress = address.trim();
            const finalInterestedArea = interestedArea.trim();
            const finalEducation = education.trim();
            const finalCurrentOrg = currentOrg.trim();
            const finalMessage = additionalMessage.trim() || t.defaultMessage;

            let submittedSuccessfully = false;
            let wasAutoApproved = false;
            let isReapplication = false;
            let isConflict = false;
            let existingRepName = '';

            // 1. Try Cloud Function first (authoritative state-aware vacancy check + auto-approval)
            try {
                const functions = getFunctions(app, 'asia-south1');
                const submitFn = httpsCallable(functions, 'submitReporterApplication');
                const res: any = await submitFn({
                    fullName: finalFullName,
                    fatherName: finalFatherName,
                    phone: finalPhone,
                    address: finalAddress,
                    position: targetPosition,
                    interestedArea: finalInterestedArea,
                    education: finalEducation,
                    currentOrg: finalCurrentOrg,
                    state: selectedState,
                    language: effectiveLang,
                    district: selectedDistrict.trim(),
                    mandal: selectedMandal.trim(),
                    message: finalMessage,
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
                    const finalStatus = "PENDING"; // Safe fallback — backend onReporterApplicationCreated trigger also evaluates vacancy
                    const appData = {
                        fullName: finalFullName,
                        fatherName: finalFatherName,
                        phone: finalPhone,
                        address: finalAddress,
                        position: targetPosition,
                        interestedArea: finalInterestedArea,
                        education: finalEducation,
                        currentOrg: finalCurrentOrg,
                        state: selectedState,
                        stateCode: selectedState,
                        language: effectiveLang,
                        district: selectedDistrict.trim(),
                        mandal: selectedMandal.trim(),
                        message: finalMessage,
                        status: finalStatus,
                        autoApproved: false,
                        isConflict: true,
                        agreedToRules: true,
                        userId: user.id,
                        timestamp: serverTimestamp()
                    };

                    await addDoc(collection(db, 'reporter_applications'), appData);

                    const conflictText = t.conflictChatText(finalFullName, selectedMandal, subDistLabel.local);
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
                        reporterName: finalFullName || "Applicant",
                        reporterState: selectedState,
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
                        title: t.conflictNotifTitle,
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
                        title: t.approvedTitle,
                        message: t.approvedMessage(selectedMandal, subDistLabel.local),
                        isSuccess: true,
                        isConflict: false
                    });
                } else if (isReapplication) {
                    setResultDialog({
                        title: t.reapplyTitle,
                        message: t.reapplyMessage,
                        isSuccess: true,
                        isConflict: false
                    });
                } else if (isConflict) {
                    const repInfo = existingRepName ? ` (${existingRepName})` : '';
                    setResultDialog({
                        title: t.conflictTitle,
                        message: t.conflictMessage(selectedMandal, subDistLabel.local, repInfo),
                        isSuccess: true,
                        isConflict: true
                    });
                } else {
                    setResultDialog({
                        title: t.submittedTitle,
                        message: t.submittedMessage(subDistLabel.local),
                        isSuccess: true,
                        isConflict: false
                    });
                }
            } else {
                setSubmitError(t.submitFailedError);
            }
        } catch (error: any) {
            console.error("Error submitting application:", error);
            setSubmitError(t.submitFailedError);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`flex-1 bg-gray-50 flex flex-col h-full overflow-hidden text-black ${bodyFont} animate-fade-in relative z-50`}>
            {/* Top Navigation Bar */}
            <div className="bg-white shadow-sm flex items-center px-4 py-3 shrink-0 border-b border-gray-100">
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full mr-2 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1">
                    <h1 className={`text-xl font-bold ${headlineFont} text-gray-900 leading-tight`}>{t.pageTitle}</h1>
                    <p className="text-xs text-gray-500 font-medium">{t.pageSubtitle}</p>
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
                                <h2 className={`text-2xl font-bold ${headlineFont} text-gray-900`}>{t.loginRequiredTitle}</h2>
                                <p className="text-gray-600 text-base max-w-md mx-auto">
                                    {t.loginRequiredDesc}
                                </p>
                            </div>
                            <div className="pt-2 flex flex-col gap-3 max-w-sm mx-auto">
                                <button
                                    onClick={onLoginRequest}
                                    className={`w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-md transition-all ${headlineFont} text-lg flex items-center justify-center gap-2`}
                                >
                                    {t.loginBtn}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl transition-all"
                                >
                                    {t.closeBtn}
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
                                        <h3 className={`font-bold ${headlineFont} text-lg text-amber-900`}>{t.pendingTitle}</h3>
                                        <p className="text-sm text-amber-800 leading-relaxed">
                                            {t.pendingDesc}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Guidelines / Rules Card */}
                            <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 space-y-4">
                                <div className="flex items-center gap-2.5 text-red-600 border-b border-gray-100 pb-3">
                                    <Shield className="w-6 h-6" />
                                    <h2 className={`text-xl font-bold ${headlineFont} text-gray-900`}>{t.guidelinesTitle}</h2>
                                </div>

                                <p className="text-xs md:text-sm text-gray-500 font-medium">
                                    {t.guidelinesSubtitle}
                                </p>

                                <div className="space-y-3">
                                    {/* Rule 1 */}
                                    <div className="flex items-start gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                                        <div className={`w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs shrink-0 ${headlineFont}`}>
                                            1
                                        </div>
                                        <div className="text-sm">
                                            <h4 className={`font-bold text-gray-900 ${headlineFont}`}>{t.rule1Title}</h4>
                                            <p className="text-gray-600 text-xs mt-0.5">
                                                {t.rule1Desc(subDistLabel.local)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Rule 2 */}
                                    <div className="flex items-start gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                                        <div className={`w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs shrink-0 ${headlineFont}`}>
                                            2
                                        </div>
                                        <div className="text-sm">
                                            <h4 className={`font-bold text-gray-900 ${headlineFont}`}>{t.rule2Title}</h4>
                                            <p className="text-gray-600 text-xs mt-0.5">
                                                {t.rule2Desc}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Rule 3 */}
                                    <div className="flex items-start gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                                        <div className={`w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs shrink-0 ${headlineFont}`}>
                                            3
                                        </div>
                                        <div className="text-sm">
                                            <h4 className={`font-bold text-gray-900 ${headlineFont}`}>{t.rule3Title}</h4>
                                            <p className="text-gray-600 text-xs mt-0.5">
                                                {t.rule3Desc}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Form Card 1: Personal Details */}
                            <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 space-y-4">
                                <h3 className={`text-lg font-bold ${headlineFont} text-gray-900 border-b border-gray-100 pb-2`}>
                                    {t.personalDetailsTitle}
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.fullNameLabel}</label>
                                        <input
                                            type="text"
                                            required
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder={t.fullNamePlaceholder}
                                            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 bg-gray-50 font-bold transition-all ${hasAttemptedSubmit && !isFullNameValid ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20' : 'border-gray-300'}`}
                                        />
                                        {hasAttemptedSubmit && !isFullNameValid && (
                                            <p className="text-xs text-red-600 mt-1 font-bold">{t.fullNameError}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.fatherNameLabel}</label>
                                        <input
                                            type="text"
                                            required
                                            value={fatherName}
                                            onChange={(e) => setFatherName(e.target.value)}
                                            placeholder={t.fatherNamePlaceholder}
                                            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 bg-gray-50 font-bold transition-all ${hasAttemptedSubmit && !isFatherNameValid ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20' : 'border-gray-300'}`}
                                        />
                                        {hasAttemptedSubmit && !isFatherNameValid && (
                                            <p className="text-xs text-red-600 mt-1 font-bold">{t.fatherNameError}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.phoneLabel}</label>
                                        <input
                                            type="tel"
                                            required
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            placeholder={t.phonePlaceholder}
                                            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 bg-gray-50 font-bold transition-all ${hasAttemptedSubmit && !isPhoneValid ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20' : 'border-gray-300'}`}
                                        />
                                        {hasAttemptedSubmit && !isPhoneValid && (
                                            <p className="text-xs text-red-600 mt-1 font-bold">{t.phoneError}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.addressLabel}</label>
                                        <input
                                            type="text"
                                            required
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder={t.addressPlaceholder}
                                            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 bg-gray-50 font-bold transition-all ${hasAttemptedSubmit && !isAddressValid ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20' : 'border-gray-300'}`}
                                        />
                                        {hasAttemptedSubmit && !isAddressValid && (
                                            <p className="text-xs text-red-600 mt-1 font-bold">{t.addressError}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Form Card 2: Region Details (All 9 States -> District -> Mandal/Tehsil/Taluka/Sub-Division) */}
                            <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 space-y-4">
                                <h3 className={`text-lg font-bold ${headlineFont} text-gray-900 border-b border-gray-100 pb-2`}>
                                    {t.regionDetailsTitle}
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* State Dropdown */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.stateLabel}</label>
                                        <select
                                            value={selectedState}
                                            onChange={(e) => handleStateChange(e.target.value as StateCode)}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold"
                                        >
                                            {ALL_EDITIONS_LIST.map((ed) => (
                                                <option key={ed.code} value={ed.code}>
                                                    {ed.nativeName === ed.name ? ed.name : `${ed.nativeName} (${ed.name})`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* District Dropdown */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.districtLabel}</label>
                                        <select
                                            required
                                            value={selectedDistrict}
                                            onChange={(e) => handleDistrictChange(e.target.value)}
                                            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 bg-gray-50 font-bold transition-all ${hasAttemptedSubmit && !isDistrictValid ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20' : 'border-gray-300'}`}
                                        >
                                            <option value="">{t.districtSelectPlaceholder}</option>
                                            {districtsList.map((district) => {
                                                const display = getDistrictDisplayName(district, effectiveLang);
                                                return (
                                                    <option key={district} value={district}>
                                                        {display !== district ? `${display} (${district})` : district}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {hasAttemptedSubmit && !isDistrictValid && (
                                            <p className="text-xs text-red-600 mt-1 font-bold">{t.districtError}</p>
                                        )}
                                    </div>

                                    {/* Sub-District (Mandal / Tehsil / Taluka / Sub-Division) Dropdown */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">
                                            {t.subDistrictLabel(subDistLabel.local, subDistLabel.en)}
                                        </label>
                                        <select
                                            required
                                            value={selectedMandal}
                                            onChange={(e) => setSelectedMandal(e.target.value)}
                                            disabled={!selectedDistrict}
                                            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 bg-gray-50 font-bold disabled:opacity-50 transition-all ${hasAttemptedSubmit && !isMandalValid ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20' : 'border-gray-300'}`}
                                        >
                                            <option value="">{t.subDistrictSelectPlaceholder(subDistLabel.local)}</option>
                                            {mandalsList.map((mandal) => (
                                                <option key={mandal} value={mandal}>{mandal}</option>
                                            ))}
                                        </select>
                                        {hasAttemptedSubmit && !isMandalValid && (
                                            <p className="text-xs text-red-600 mt-1 font-bold">{t.subDistrictError(subDistLabel.local)}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Form Card 3: Professional Details */}
                            <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 space-y-4">
                                <h3 className={`text-lg font-bold ${headlineFont} text-gray-900 border-b border-gray-100 pb-2`}>
                                    {t.professionalDetailsTitle}
                                </h3>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">{t.positionLabel}</label>
                                            <input
                                                type="text"
                                                readOnly
                                                value={t.positionValue(subDistLabel.local, subDistLabel.en)}
                                                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-100 text-gray-600 font-bold cursor-not-allowed"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">{t.categoryLabel}</label>
                                            <input
                                                type="text"
                                                required
                                                value={interestedArea}
                                                onChange={(e) => setInterestedArea(e.target.value)}
                                                placeholder={t.categoryPlaceholder}
                                                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 bg-gray-50 font-bold transition-all ${hasAttemptedSubmit && !isCategoryValid ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20' : 'border-gray-300'}`}
                                            />
                                            {hasAttemptedSubmit && !isCategoryValid && (
                                                <p className="text-xs text-red-600 mt-1 font-bold">{t.categoryError}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">{t.educationLabel}</label>
                                            <input
                                                type="text"
                                                required
                                                value={education}
                                                onChange={(e) => setEducation(e.target.value)}
                                                placeholder={t.educationPlaceholder}
                                                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 bg-gray-50 font-bold transition-all ${hasAttemptedSubmit && !isEducationValid ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20' : 'border-gray-300'}`}
                                            />
                                            {hasAttemptedSubmit && !isEducationValid && (
                                                <p className="text-xs text-red-600 mt-1 font-bold">{t.educationError}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">{t.orgLabel}</label>
                                            <input
                                                type="text"
                                                required
                                                value={currentOrg}
                                                onChange={(e) => setCurrentOrg(e.target.value)}
                                                placeholder={t.orgPlaceholder}
                                                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 bg-gray-50 font-bold transition-all ${hasAttemptedSubmit && !isOrgValid ? 'border-red-500 ring-1 ring-red-500 bg-red-50/20' : 'border-gray-300'}`}
                                            />
                                            {hasAttemptedSubmit && !isOrgValid && (
                                                <p className="text-xs text-red-600 mt-1 font-bold">{t.orgError}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">{t.messageLabel}</label>
                                        <textarea
                                            rows={3}
                                            value={additionalMessage}
                                            onChange={(e) => setAdditionalMessage(e.target.value)}
                                            placeholder={t.messagePlaceholder}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 font-bold resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Agreement Checkbox */}
                            <div>
                                <div
                                    onClick={() => setRulesCheckboxChecked(!rulesCheckboxChecked)}
                                    className={`border rounded-2xl p-4 cursor-pointer select-none flex items-center gap-3 transition-colors ${hasAttemptedSubmit && !rulesCheckboxChecked ? 'bg-red-50 border-red-500' : 'bg-red-50/50 border-red-200 hover:bg-red-100/70'}`}
                                >
                                    <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${rulesCheckboxChecked ? 'bg-red-600 border-red-600 text-white' : 'border-gray-400 bg-white'}`}>
                                        {rulesCheckboxChecked && <Check size={16} strokeWidth={3} />}
                                    </div>
                                    <span className={`text-sm font-bold text-gray-800 ${bodyFont} flex-1`}>
                                        {t.rulesAgreeText}
                                    </span>
                                </div>
                                {hasAttemptedSubmit && !rulesCheckboxChecked && (
                                    <p className="text-xs text-red-600 mt-1.5 font-bold pl-1">{t.rulesAgreeError}</p>
                                )}
                            </div>

                            {/* Validation / Submission Error Banner */}
                            {(submitError || (hasAttemptedSubmit && !isFormValid)) && (
                                <div className="bg-red-50 border border-red-300 rounded-2xl p-4 flex items-center gap-3 text-red-700">
                                    <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                                    <p className={`text-sm font-bold ${bodyFont}`}>
                                        {submitError || t.validationBanner}
                                    </p>
                                </div>
                            )}

                            {/* Submit Button */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white py-4 rounded-2xl text-xl font-bold transition-all shadow-lg flex items-center justify-center gap-3 ${headlineFont}`}
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                            </svg>
                                            {t.submittingText}
                                        </span>
                                    ) : (
                                        <>
                                            <Send size={22} />
                                            {t.submitBtnText}
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
                            <h3 className={`text-2xl font-bold ${headlineFont} text-gray-900`}>{resultDialog.title}</h3>
                            <p className={`text-gray-600 text-base leading-relaxed whitespace-pre-line ${bodyFont}`}>{resultDialog.message}</p>
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
                                    className={`w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-md ${headlineFont} text-lg`}
                                >
                                    {t.openChatBtn}
                                </button>
                                <button
                                    onClick={() => {
                                        setResultDialog(null);
                                        onClose();
                                    }}
                                    className={`w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl transition ${headlineFont}`}
                                >
                                    {t.okBtn}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    setResultDialog(null);
                                    onClose();
                                }}
                                className={`w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl transition shadow-md ${headlineFont} text-lg`}
                            >
                                {t.okBtn}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default JoinReporterPage;
