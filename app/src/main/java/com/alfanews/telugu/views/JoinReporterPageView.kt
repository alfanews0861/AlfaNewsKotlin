package com.alfanews.telugu.views

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alfanews.telugu.models.Language
import com.alfanews.telugu.services.FirebaseFunctionsService
import com.alfanews.telugu.services.FirebaseService
import com.alfanews.telugu.ui.theme.getBodyFontFamily
import com.alfanews.telugu.ui.theme.getHeadlineFontFamily
import com.alfanews.telugu.utils.Constants
import com.alfanews.telugu.utils.EditionRegistry
import com.alfanews.telugu.utils.PreferenceManager
import com.alfanews.telugu.utils.StateCode
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

data class SubmissionResult(
    val title: String,
    val message: String,
    val isConflict: Boolean = false
)

private data class ReporterFormStrings(
    val loginRequiredTitle: String,
    val loginRequiredDesc: String,
    val loginButton: String,
    val closeButton: String,
    val pendingTitle: String,
    val pendingDesc: String,
    val rulesTitle: String,
    val rulesSubtitle: String,
    val rule1Title: String,
    val rule1Desc: String,
    val rule2Title: String,
    val rule2Desc: String,
    val rule3Title: String,
    val rule3Desc: String,
    val appFormTitle: String,
    val fullNameLabel: String,
    val fullNameError: String,
    val fullNameField: String,
    val fatherNameLabel: String,
    val fatherNameError: String,
    val fatherNameField: String,
    val phoneLabel: String,
    val phoneError: String,
    val phoneField: String,
    val addressLabel: String,
    val addressError: String,
    val addressField: String,
    val regionDetailsTitle: String,
    val selectStateLabel: String,
    val selectDistrictLabel: String,
    val districtError: String,
    val districtField: String,
    val selectSubDistrictLabel: String,
    val subDistrictError: String,
    val subDistrictField: String,
    val noSubDistrictsAvailable: String,
    val positionLabel: String,
    val defaultPosition: String,
    val categoryLabel: String,
    val categoryError: String,
    val categoryField: String,
    val educationLabel: String,
    val educationError: String,
    val educationField: String,
    val orgLabel: String,
    val orgError: String,
    val orgField: String,
    val additionalMessageLabel: String,
    val messagePlaceholder: String,
    val defaultMessage: String,
    val rulesAgreeCheckbox: String,
    val rulesAgreeError: String,
    val rulesField: String,
    val validationBanner: String,
    val toastFieldPrompt: (String) -> String,
    val submitButton: String,
    val submitFailedToast: String,
    val approvedTitle: String,
    val approvedMessage: (String) -> String,
    val reapplyTitle: String,
    val reapplyMessage: String,
    val conflictTitle: String,
    val conflictMessage: (String, String) -> String,
    val conflictChatText: (String, String) -> String,
    val conflictNotifTitle: String,
    val submittedTitle: String,
    val submittedMessage: String,
    val openChatButton: String,
    val okButton: String
)

private fun getSubDistrictLabels(stateCode: StateCode, lang: Language): Pair<String, String> {
    val enLabel = when (stateCode) {
        StateCode.AP, StateCode.TS -> "Mandal"
        StateCode.GA, StateCode.GJ -> "Taluka"
        StateCode.MN -> "Sub-Division"
        else -> "Tehsil"
    }
    val localLabel = when (lang) {
        Language.ENGLISH -> enLabel
        Language.TELUGU -> "మండలం"
        Language.PUNJABI -> "ਤਹਿਸੀਲ"
        Language.GUJARATI -> "તાલુકા"
        Language.HINDI -> when (stateCode) {
            StateCode.GA, StateCode.GJ -> "तालुका"
            StateCode.MN -> "उप-मंडल"
            else -> "तहसील"
        }
    }
    return localLabel to enLabel
}

private fun getReporterFormStrings(stateCode: StateCode, lang: Language): ReporterFormStrings {
    val (subLocal, subEn) = getSubDistrictLabels(stateCode, lang)
    return when (lang) {
        Language.HINDI -> ReporterFormStrings(
            loginRequiredTitle = "लॉगिन आवश्यक है",
            loginRequiredDesc = "रिपोर्टर के रूप में आवेदन करने के लिए कृपया अपने मोबाइल नंबर से लॉगिन करें।",
            loginButton = "लॉगिन करें",
            closeButton = "बंद करें (Close)",
            pendingTitle = "समीक्षा में है (PENDING)",
            pendingDesc = "आपने पहले ही एक आवेदन जमा कर दिया है। हमारी संपादकीय टीम शीघ्र ही इसकी समीक्षा करेगी।",
            rulesTitle = "रिपोर्टर दिशानिर्देश",
            rulesSubtitle = "अल्फा न्यूज़ रिपोर्टर बनने के लिए कृपया निम्नलिखित नियमों का पालन करें:",
            rule1Title = "प्रतिदिन कम से कम एक खबर",
            rule1Desc = "नियमित रूप से समाचार भेजें। आपकी $subLocal से प्रतिदिन कम से कम एक स्थानीय खबर अनिवार्य है।",
            rule2Title = "त्वरित और सटीक जानकारी",
            rule2Desc = "ताज़ा और प्रमाणिक स्थानीय समाचार जल्द से जल्द पाठकों तक पहुंचाएं।",
            rule3Title = "गुणवत्ता और संपादकीय अधिकार",
            rule3Desc = "यदि नियमित और गुणवत्तापूर्ण समाचार नहीं भेजे जाते हैं, तो संपादकीय डेस्क को अन्य रिपोर्टर नियुक्त करने का अधिकार होगा।",
            appFormTitle = "रिपोर्टर आवेदन फॉर्म",
            fullNameLabel = "पूरा नाम (Full Name) *",
            fullNameError = "कृपया कम से कम 3 अक्षरों का पूरा नाम दर्ज करें",
            fullNameField = "पूरा नाम",
            fatherNameLabel = "पिता का नाम (Father's Name) *",
            fatherNameError = "कृपया कम से कम 3 अक्षरों का पिता का नाम दर्ज करें",
            fatherNameField = "पिता का नाम",
            phoneLabel = "मोबाइल नंबर (10 अंक) *",
            phoneError = "कृपया वैध 10 अंकों का मोबाइल नंबर दर्ज करें (6-9 से शुरू)",
            phoneField = "10 अंकों का मोबाइल नंबर",
            addressLabel = "पूरा पता (Address) *",
            addressError = "कृपया कम से कम 6 अक्षरों का पूरा पता दर्ज करें",
            addressField = "पूरा पता",
            regionDetailsTitle = "क्षेत्र विवरण (Region Details)",
            selectStateLabel = "राज्य चुनें (State) *",
            selectDistrictLabel = "जिला चुनें (District) *",
            districtError = "कृपया जिला चुनें",
            districtField = "जिला",
            selectSubDistrictLabel = "$subLocal चुनें ($subEn) *",
            subDistrictError = "कृपया $subLocal चुनें",
            subDistrictField = subLocal,
            noSubDistrictsAvailable = "कोई $subLocal उपलब्ध नहीं है",
            positionLabel = "पद (Position)",
            defaultPosition = "$subLocal रिपोर्टर ($subEn Reporter)",
            categoryLabel = "रुचि की श्रेणी (Category) *",
            categoryError = "कृपया रुचि की श्रेणी दर्ज करें",
            categoryField = "रुचि की श्रेणी",
            educationLabel = "शैक्षणिक योग्यता (Education) *",
            educationError = "कृपया शैक्षणिक योग्यता दर्ज करें",
            educationField = "शैक्षणिक योग्यता",
            orgLabel = "वर्तमान संस्था / पेशा *",
            orgError = "कृपया वर्तमान संस्था या पेशा दर्ज करें",
            orgField = "वर्तमान संस्था / पेशा",
            additionalMessageLabel = "अतिरिक्त संदेश (वैकल्पिक / Optional)",
            messagePlaceholder = "आपका अनुभव या कोई अन्य जानकारी लिखें...",
            defaultMessage = "मैं अल्फा न्यूज़ रिपोर्टर के रूप में काम करने का इच्छुक हूँ",
            rulesAgreeCheckbox = "मैंने ऊपर दिए गए सभी नियम पढ़ लिए हैं और उनसे पूरी तरह सहमत हूँ।",
            rulesAgreeError = "कृपया ऊपर दिए गए नियमों को पढ़कर सहमति दें *",
            rulesField = "नियमों की सहमति",
            validationBanner = "कृपया लाल रंग से चिह्नित सभी आवश्यक विवरण सही से भरें।",
            toastFieldPrompt = { field -> "कृपया $field सही से दर्ज करें" },
            submitButton = "आवेदन जमा करें",
            submitFailedToast = "आवेदन जमा करने में समस्या आई। कृपया पुनः प्रयास करें।",
            approvedTitle = "बधाई हो! 🎉",
            approvedMessage = { mandal -> "$mandal $subLocal के लिए आपका आवेदन स्वीकृत हो गया है। अब आप अल्फा न्यूज़ के अधिकृत रिपोर्टर हैं!" },
            reapplyTitle = "समीक्षा में है ⏳",
            reapplyMessage = "आपका पुनः आवेदन सफलतापूर्वक जमा हो गया है। हमारी संपादकीय टीम शीघ्र ही इसकी समीक्षा करेगी।",
            conflictTitle = "समीक्षा में है ⏳",
            conflictMessage = { mandal, repInfo -> "$mandal $subLocal में पहले से ही एक सक्रिय रिपोर्टर$repInfo कार्यरत हैं। इसलिए आपका आवेदन संपादकीय डेस्क की विशेष समीक्षा के लिए भेजा गया है।\n\nआपको एडिटोरियल डेस्क से संदेश भेजा गया है। आप चैट खोलकर सीधे संपर्क कर सकते हैं।" },
            conflictChatText = { name, mandal -> "नमस्ते ${name.ifEmpty { "मित्र" }}, आपके चुने हुए $mandal $subLocal में पहले से ही एक सक्रिय रिपोर्टर कार्यरत हैं।\n\nइसलिए आपका आवेदन संपादकीय डेस्क की विशेष समीक्षा के लिए भेजा गया है। हमारी टीम जांच कर शीघ्र ही आपसे संपर्क करेगी। आप यहीं सीधे संदेश भेज सकते हैं। धन्यवाद!" },
            conflictNotifTitle = "आपका आवेदन समीक्षा में है ⏳",
            submittedTitle = "आवेदन प्राप्त हुआ",
            submittedMessage = "आपका आवेदन सफलतापूर्वक प्राप्त हो गया है। हमारी टीम आपके $subLocal विवरण की जांच कर शीघ्र संपर्क करेगी।",
            openChatButton = "एडिटोरियल डेस्क चैट",
            okButton = "ठीक है (OK)"
        )
        Language.PUNJABI -> ReporterFormStrings(
            loginRequiredTitle = "ਲੌਗਇਨ ਜ਼ਰੂਰੀ ਹੈ",
            loginRequiredDesc = "ਰਿਪੋਰਟਰ ਵਜੋਂ ਅਰਜ਼ੀ ਦੇਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਮੋਬਾਈਲ ਨੰਬਰ ਨਾਲ ਲੌਗਇਨ ਕਰੋ।",
            loginButton = "ਲੌਗਇਨ ਕਰੋ",
            closeButton = "ਬੰਦ ਕਰੋ (Close)",
            pendingTitle = "ਸਮੀਖਿਆ ਅਧੀਨ ਹੈ (PENDING)",
            pendingDesc = "ਤੁਸੀਂ ਪਹਿਲਾਂ ਹੀ ਅਰਜ਼ੀ ਜਮ੍ਹਾਂ ਕਰ ਚੁੱਕੇ ਹੋ। ਸਾਡੀ ਸੰਪਾਦਕੀ ਟੀਮ ਜਲਦੀ ਹੀ ਇਸਦੀ ਸਮੀਖਿਆ ਕਰੇਗੀ।",
            rulesTitle = "ਰਿਪੋਰਟਰ ਨਿਯਮ",
            rulesSubtitle = "ਅਲਫ਼ਾ ਨਿਊਜ਼ ਰਿਪੋਰਟਰ ਬਣਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਹੇਠ ਲਿਖੇ ਨਿਯਮਾਂ ਦੀ ਪਾਲਣਾ ਕਰੋ:",
            rule1Title = "ਹਰ ਰੋਜ਼ ਘੱਟੋ-ਘੱਟ ਇੱਕ ਖ਼ਬਰ",
            rule1Desc = "ਨਿਯਮਤ ਤੌਰ 'ਤੇ ਖ਼ਬਰਾਂ ਭੇਜੋ। ਤੁਹਾਡੀ $subLocal ਤੋਂ ਹਰ ਰੋਜ਼ ਘੱਟੋ-ਘੱਟ ਇੱਕ ਸਥਾਨਕ ਖ਼ਬਰ ਜ਼ਰੂਰੀ ਹੈ।",
            rule2Title = "ਤੇਜ਼ ਅਤੇ ਸਹੀ ਜਾਣਕਾਰੀ",
            rule2Desc = "ਤਾਜ਼ਾ ਅਤੇ ਭਰੋਸੇਯੋਗ ਸਥਾਨਕ ਖ਼ਬਰਾਂ ਜਲਦੀ ਤੋਂ ਜਲਦੀ ਪਾਠਕਾਂ ਤੱਕ ਪਹੁੰਚਾਓ।",
            rule3Title = "ਗੁਣਵੱਤਾ ਅਤੇ ਸੰਪਾਦਕੀ ਅਧਿਕਾਰ",
            rule3Desc = "ਜੇਕਰ ਨਿਯਮਤ ਅਤੇ ਗੁਣਵੱਤਾ ਭਰਪੂਰ ਖ਼ਬਰਾਂ ਨਹੀਂ ਭੇਜੀਆਂ ਜਾਂਦੀਆਂ, ਤਾਂ ਸੰਪਾਦਕੀ ਡੈਸਕ ਕੋਲ ਹੋਰ ਰਿਪੋਰਟਰ ਨਿਯੁਕਤ ਕਰਨ ਦਾ ਅਧਿਕਾਰ ਹੋਵੇਗਾ।",
            appFormTitle = "ਰਿਪੋਰਟਰ ਅਰਜ਼ੀ ਫਾਰਮ",
            fullNameLabel = "ਪੂਰਾ ਨਾਮ (Full Name) *",
            fullNameError = "ਕਿਰਪਾ ਕਰਕੇ ਘੱਟੋ-ਘੱਟ 3 ਅੱਖਰਾਂ ਦਾ ਪੂਰਾ ਨਾਮ ਦਰਜ ਕਰੋ",
            fullNameField = "ਪੂਰਾ ਨਾਮ",
            fatherNameLabel = "ਪਿਤਾ ਦਾ ਨਾਮ (Father's Name) *",
            fatherNameError = "ਕਿਰਪਾ ਕਰਕੇ ਘੱਟੋ-ਘੱਟ 3 ਅੱਖਰਾਂ ਦਾ ਪਿਤਾ ਦਾ ਨਾਮ ਦਰਜ ਕਰੋ",
            fatherNameField = "ਪਿਤਾ ਦਾ ਨਾਮ",
            phoneLabel = "ਫ਼ੋਨ ਨੰਬਰ (10 ਅੰਕ) *",
            phoneError = "ਕਿਰਪਾ ਕਰਕੇ ਸਹੀ 10 ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ ਦਰਜ ਕਰੋ (6-9 ਤੋਂ ਸ਼ੁਰੂ)",
            phoneField = "10 ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ",
            addressLabel = "ਪੂਰਾ ਪਤਾ (Address) *",
            addressError = "ਕਿਰਪਾ ਕਰਕੇ ਘੱਟੋ-ਘੱਟ 6 ਅੱਖਰਾਂ ਦਾ ਪੂਰਾ ਪਤਾ ਦਰਜ ਕਰੋ",
            addressField = "ਪੂਰਾ ਪਤਾ",
            regionDetailsTitle = "ਖੇਤਰ ਵੇਰਵੇ (Region Details)",
            selectStateLabel = "ਰਾਜ ਚੁਣੋ (State) *",
            selectDistrictLabel = "ਜ਼ਿਲ੍ਹਾ ਚੁਣੋ (District) *",
            districtError = "ਕਿਰਪਾ ਕਰਕੇ ਜ਼ਿਲ੍ਹਾ ਚੁਣੋ",
            districtField = "ਜ਼ਿਲ੍ਹਾ",
            selectSubDistrictLabel = "$subLocal ਚੁਣੋ ($subEn) *",
            subDistrictError = "ਕਿਰਪਾ ਕਰਕੇ $subLocal ਚੁਣੋ",
            subDistrictField = subLocal,
            noSubDistrictsAvailable = "ਕੋਈ $subLocal ਉਪਲਬਧ ਨਹੀਂ ਹੈ",
            positionLabel = "ਅਹੁਦਾ (Position)",
            defaultPosition = "$subLocal ਰਿਪੋਰਟਰ ($subEn Reporter)",
            categoryLabel = "ਦਿਲਚਸਪੀ ਵਾਲੀ ਸ਼੍ਰੇਣੀ *",
            categoryError = "ਕਿਰਪਾ ਕਰਕੇ ਦਿਲਚਸਪੀ ਵਾਲੀ ਸ਼੍ਰੇਣੀ ਦਰਜ ਕਰੋ",
            categoryField = "ਦਿਲਚਸਪੀ ਵਾਲੀ ਸ਼੍ਰੇਣੀ",
            educationLabel = "ਵਿਦਿਅਕ ਯੋਗਤਾ *",
            educationError = "ਕਿਰਪਾ ਕਰਕੇ ਵਿਦਿਅਕ ਯੋਗਤਾ ਦਰਜ ਕਰੋ",
            educationField = "ਵਿਦਿਅਕ ਯੋਗਤਾ",
            orgLabel = "ਮੌਜੂਦਾ ਸੰਸਥਾ / ਪੇਸ਼ਾ *",
            orgError = "ਕਿਰਪਾ ਕਰਕੇ ਮੌਜੂਦਾ ਸੰਸਥਾ ਜਾਂ ਪੇਸ਼ਾ ਦਰਜ ਕਰੋ",
            orgField = "ਮੌਜੂਦਾ ਸੰਸਥਾ / ਪੇਸ਼ਾ",
            additionalMessageLabel = "ਵਾਧੂ ਸੁਨੇਹਾ (ਵਿਕਲਪਿਕ / Optional)",
            messagePlaceholder = "ਤੁਹਾਡਾ ਤਜਰਬਾ ਜਾਂ ਹੋਰ ਜਾਣਕਾਰੀ ਲਿਖੋ...",
            defaultMessage = "ਮੈਂ ਅਲਫ਼ਾ ਨਿਊਜ਼ ਰਿਪੋਰਟਰ ਵਜੋਂ ਕੰਮ ਕਰਨ ਦਾ ਚਾਹਵਾਨ ਹਾਂ",
            rulesAgreeCheckbox = "ਮੈਂ ਉੱਪਰ ਦਿੱਤੇ ਸਾਰੇ ਨਿਯਮ ਪੜ੍ਹ ਲਏ ਹਨ ਅਤੇ ਪੂਰੀ ਤਰ੍ਹਾਂ ਸਹਿਮਤ ਹਾਂ।",
            rulesAgreeError = "ਕਿਰਪਾ ਕਰਕੇ ਉੱਪਰ ਦਿੱਤੇ ਨਿਯਮਾਂ ਨਾਲ ਸਹਿਮਤੀ ਦਿਓ *",
            rulesField = "ਨਿਯਮਾਂ ਦੀ ਸਹਿਮਤੀ",
            validationBanner = "ਕਿਰਪਾ ਕਰਕੇ ਲਾਲ ਰੰਗ ਵਿੱਚ ਦਿਖਾਏ ਗਏ ਸਾਰੇ ਵੇਰਵੇ ਸਹੀ ਢੰਗ ਨਾਲ ਭਰੋ।",
            toastFieldPrompt = { field -> "ਕਿਰਪਾ ਕਰਕੇ $field ਸਹੀ ਢੰਗ ਨਾਲ ਦਰਜ ਕਰੋ" },
            submitButton = "ਅਰਜ਼ੀ ਜਮ੍ਹਾਂ ਕਰੋ",
            submitFailedToast = "ਅਰਜ਼ੀ ਜਮ੍ਹਾਂ ਕਰਨ ਵਿੱਚ ਸਮੱਸਿਆ ਆਈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
            approvedTitle = "ਵਧਾਈਆਂ! 🎉",
            approvedMessage = { mandal -> "$mandal $subLocal ਲਈ ਤੁਹਾਡੀ ਅਰਜ਼ੀ ਮਨਜ਼ੂਰ ਹੋ ਗਈ ਹੈ। ਤੁਸੀਂ ਹੁਣ ਅਲਫ਼ਾ ਨਿਊਜ਼ ਦੇ ਰਿਪੋਰਟਰ ਵਜੋਂ ਨਿਯੁਕਤ ਹੋ ਗਏ ਹੋ!" },
            reapplyTitle = "ਸਮੀਖਿਆ ਅਧੀਨ ਹੈ ⏳",
            reapplyMessage = "ਤੁਹਾਡੀ ਮੁੜ-ਅਰਜ਼ੀ ਸਫਲਤਾਪੂਰਵਕ ਜਮ੍ਹਾਂ ਹੋ ਗਈ ਹੈ। ਸਾਡੀ ਸੰਪਾਦਕੀ ਟੀਮ ਜਲਦੀ ਹੀ ਸਮੀਖਿਆ ਕਰੇਗੀ।",
            conflictTitle = "ਸਮੀਖਿਆ ਅਧੀਨ ਹੈ ⏳",
            conflictMessage = { mandal, repInfo -> "$mandal $subLocal ਵਿੱਚ ਪਹਿਲਾਂ ਹੀ ਇੱਕ ਸਰਗਰਮ ਰਿਪੋਰਟਰ$repInfo ਮੌਜੂਦ ਹਨ। ਇਸ ਲਈ ਤੁਹਾਡੀ ਅਰਜ਼ੀ ਸੰਪਾਦਕੀ ਡੈਸਕ ਦੀ ਵਿਸ਼ੇਸ਼ ਸਮੀਖਿਆ ਲਈ ਭੇਜੀ ਗਈ ਹੈ।\n\nਤੁਹਾਨੂੰ ਐਡੀਟੋਰੀਅਲ ਡੈਸਕ ਤੋਂ ਸੁਨੇਹਾ ਭੇਜਿਆ ਗਿਆ ਹੈ। ਤੁਸੀਂ ਚੈਟ ਖੋਲ੍ਹ ਕੇ ਜਵਾਬ ਦੇ ਸਕਦੇ ਹੋ।" },
            conflictChatText = { name, mandal -> "ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${name.ifEmpty { "ਮਿੱਤਰ" }}, ਤੁਹਾਡੀ ਚੁਣੀ $mandal $subLocal ਵਿੱਚ ਪਹਿਲਾਂ ਹੀ ਇੱਕ ਸਰਗਰਮ ਰਿਪੋਰਟਰ ਮੌਜੂਦ ਹਨ।\n\nਇਸ ਲਈ ਤੁਹਾਡੀ ਅਰਜ਼ੀ ਵਿਸ਼ੇਸ਼ ਸਮੀਖਿਆ ਲਈ ਭੇਜੀ ਗਈ ਹੈ। ਸਾਡੀ ਸੰਪਾਦਕੀ ਟੀਮ ਜਲਦੀ ਹੀ ਤੁਹਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੇਗੀ। ਧੰਨਵਾਦ!" },
            conflictNotifTitle = "ਤੁਹਾਡੀ ਅਰਜ਼ੀ ਸਮੀਖਿਆ ਅਧੀਨ ਹੈ ⏳",
            submittedTitle = "ਅਰਜ਼ੀ ਪ੍ਰਾਪਤ ਹੋਈ",
            submittedMessage = "ਤੁਹਾਡੀ ਅਰਜ਼ੀ ਸਫਲਤਾਪੂਰਵਕ ਪ੍ਰਾਪਤ ਹੋ ਗਈ ਹੈ। ਸਾਡੀ ਟੀਮ ਤੁਹਾਡੇ $subLocal ਵੇਰਵਿਆਂ ਦੀ ਜਾਂਚ ਕਰਕੇ ਜਲਦੀ ਸੰਪਰਕ ਕਰੇਗੀ।",
            openChatButton = "ਐਡੀਟੋਰੀਅਲ ਡੈਸਕ ਚੈਟ",
            okButton = "ਠੀਕ ਹੈ (OK)"
        )
        Language.GUJARATI -> ReporterFormStrings(
            loginRequiredTitle = "લોગિન જરૂરી છે",
            loginRequiredDesc = "રિપોર્ટર તરીકે અરજી કરવા માટે કૃપા કરીને તમારા મોબાઇલ નંબરથી લોગિન કરો.",
            loginButton = "લોગિન કરો",
            closeButton = "બંધ કરો (Close)",
            pendingTitle = "સમીક્ષા હેઠળ છે (PENDING)",
            pendingDesc = "તમે પહેલેથી જ એક અરજી સબમિટ કરી છે. અમારી સંપાદકીય ટીમ ટૂંક સમયમાં તેની સમીક્ષા કરશે.",
            rulesTitle = "રિપોર્ટર નિયમો",
            rulesSubtitle = "આલ્ફા ન્યૂઝ રિપોર્ટર બનવા માટે કૃપા કરીને નીચેના નિયમોનું પાલન કરો:",
            rule1Title = "દરરોજ ઓછામાં ઓછા એક સમાચાર",
            rule1Desc = "નિયમિતપણે સમાચાર મોકલો. તમારા $subLocal ના દરરોજ ઓછામાં ઓછા એક સ્થાનિક સમાચાર ફરજિયાત છે.",
            rule2Title = "ઝડપી અને સચોટ માહિતી",
            rule2Desc = "તાજા અને વિશ્વસનીય સ્થાનિક સમાચાર વહેલી તકે વાચકો સુધી પહોંચાડો.",
            rule3Title = "ગુણવત્તા અને સંપાદકીય અધિકાર",
            rule3Desc = "જો નિયમિત અને ગુણવત્તાયુક્ત સમાચાર ન મોકલવામાં આવે તો સંપાદકીય ડેસ્કને અન્ય રિપોર્ટર નિયુક્ત કરવાનો અધિકાર રહેશે.",
            appFormTitle = "રિપોર્ટર અરજી ફોર્મ",
            fullNameLabel = "પૂરું નામ (Full Name) *",
            fullNameError = "કૃપા કરીને ઓછામાં ઓછા 3 અક્ષરોનું પૂરું નામ દાખલ કરો",
            fullNameField = "પૂરું નામ",
            fatherNameLabel = "પિતાનું નામ (Father's Name) *",
            fatherNameError = "કૃપા કરીને ઓછામાં ઓછા 3 અક્ષરોનું પિતાનું નામ દાખલ કરો",
            fatherNameField = "પિતાનું નામ",
            phoneLabel = "ફોન નંબર (10 અંક) *",
            phoneError = "કૃપા કરીને માન્ય 10 અંકનો મોબાઇલ નંબર દાખલ કરો (6-9 થી શરૂ)",
            phoneField = "10 અંકનો મોબાઇલ નંબર",
            addressLabel = "પૂરું સરનામું (Address) *",
            addressError = "કૃપા કરીને ઓછામાં ઓછા 6 અક્ષરોનું સરનામું દાખલ કરો",
            addressField = "પૂરું સરનામું",
            regionDetailsTitle = "વિસ્તારની વિગતો (Region Details)",
            selectStateLabel = "રાજ્ય પસંદ કરો (State) *",
            selectDistrictLabel = "જિલ્લો પસંદ કરો (District) *",
            districtError = "કૃપા કરીને જિલ્લો પસંદ કરો",
            districtField = "જિલ્લો",
            selectSubDistrictLabel = "$subLocal પસંદ કરો ($subEn) *",
            subDistrictError = "કૃપા કરીને $subLocal પસંદ કરો",
            subDistrictField = subLocal,
            noSubDistrictsAvailable = "કોઈ $subLocal ઉપલબ્ધ નથી",
            positionLabel = "હોદ્દો (Position)",
            defaultPosition = "$subLocal રિપોર્ટર ($subEn Reporter)",
            categoryLabel = "રસની શ્રેણી *",
            categoryError = "કૃપા કરીને રસની શ્રેણી દાખલ કરો",
            categoryField = "રસની શ્રેણી",
            educationLabel = "શૈક્ષણિક લાયકાત *",
            educationError = "કૃપા કરીને શૈક્ષણિક લાયકાત દાખલ કરો",
            educationField = "શૈક્ષણિક લાયકાત",
            orgLabel = "વર્તમાન સંસ્થા / વ્યવસાય *",
            orgError = "કૃપા કરીને વર્તમાન સંસ્થા અથવા વ્યવસાય દાખલ કરો",
            orgField = "વર્તમાન સંસ્થા / વ્યવસાય",
            additionalMessageLabel = "વધારાનો સંદેશ (વૈકલ્પિક / Optional)",
            messagePlaceholder = "તમારો અનુભવ અથવા અન્ય વિગતો લખો...",
            defaultMessage = "હું આલ્ફા ન્યૂઝ રિપોર્ટર તરીકે કામ કરવા ઉત્સુક છું",
            rulesAgreeCheckbox = "મેં ઉપરના તમામ નિયમો વાંચ્યા છે અને સંપૂર્ણપણે સંમત છું.",
            rulesAgreeError = "કૃપા કરીને ઉપરના નિયમો વાંચીને સંમતિ આપો *",
            rulesField = "નિયમોની સંમતિ",
            validationBanner = "કૃપા કરીને લાલ રંગમાં દર્શાવેલ તમામ જરૂરી વિગતો યોગ્ય રીતે ભરો.",
            toastFieldPrompt = { field -> "કૃપા કરીને $field યોગ્ય રીતે દાખલ કરો" },
            submitButton = "અરજી સબમિટ કરો",
            submitFailedToast = "અરજી સબમિટ કરવામાં સમસ્યા આવી. કૃપા કરીને ફરી પ્રયાસ કરો.",
            approvedTitle = "અભિનંદન! 🎉",
            approvedMessage = { mandal -> "$mandal $subLocal માટે તમારી અરજી મંજૂર થઈ ગઈ છે. હવે તમે આલ્ફા ન્યૂઝના અધિકૃત રિપોર્ટર છો!" },
            reapplyTitle = "સમીક્ષા હેઠળ છે ⏳",
            reapplyMessage = "તમારી પુનઃ અરજી સફળતાપૂર્વક સબમિટ થઈ ગઈ છે. અમારી સંપાદકીય ટીમ ટૂંક સમયમાં સમીક્ષા કરશે.",
            conflictTitle = "સમીક્ષા હેઠળ છે ⏳",
            conflictMessage = { mandal, repInfo -> "$mandal $subLocal માં પહેલેથી જ સક્રિય રિપોર્ટર$repInfo કાર્યરત છે. તેથી તમારી અરજી સંપાદકીય ડેસ્કની વિશેષ સમીક્ષા માટે મોકલવામાં આવી છે.\n\nતમને એડિટોરિયલ ડેસ્ક તરફથી સંદેશ મોકલવામાં આવ્યો છે. તમે ચેટ ખોલીને જવાબ આપી શકો છો." },
            conflictChatText = { name, mandal -> "નમસ્તે ${name.ifEmpty { "મિત્ર" }}, તમારા પસંદ કરેલા $mandal $subLocal માં પહેલેથી જ એક સક્રિય રિપોર્ટર કાર્યરત છે.\n\nતેથી તમારી અરજી વિશેષ સમીક્ષા માટે મોકલવામાં આવી છે. અમારી સંપાદકીય ટીમ ટૂંક સમયમાં તમારો સંપર્ક કરશે. આભાર!" },
            conflictNotifTitle = "તમારી અરજી સમીક્ષા હેઠળ છે ⏳",
            submittedTitle = "અરજી પ્રાપ્ત થઈ",
            submittedMessage = "તમારી અરજી સફળતાપૂર્વક મળી ગઈ છે. અમારી ટીમ તમારા $subLocal ની વિગતો તપાસીને ટૂંક સમયમાં સંપર્ક કરશે.",
            openChatButton = "એડિટોરિયલ ડેસ્ક ચેટ",
            okButton = "બરાબર (OK)"
        )
        Language.ENGLISH -> ReporterFormStrings(
            loginRequiredTitle = "Login Required",
            loginRequiredDesc = "Please sign in with your mobile number to apply as an Alfa News Reporter.",
            loginButton = "Login",
            closeButton = "Close",
            pendingTitle = "Under Review (PENDING)",
            pendingDesc = "You already have an active reporter application under review. Our editorial team will review it shortly.",
            rulesTitle = "Reporter Guidelines",
            rulesSubtitle = "Please follow these editorial guidelines to join as an Alfa News Reporter:",
            rule1Title = "At Least One Report Daily",
            rule1Desc = "Submit local news regularly. At least one verified news story from your $subEn every day is expected.",
            rule2Title = "Timely & Accurate Reporting",
            rule2Desc = "Deliver verified local updates to readers as promptly as possible.",
            rule3Title = "Quality & Editorial Standards",
            rule3Desc = "If consistent, quality reporting is not maintained, the Editorial Desk reserves the right to assign another reporter.",
            appFormTitle = "Reporter Application Form",
            fullNameLabel = "Full Name *",
            fullNameError = "Please enter your full name (at least 3 characters)",
            fullNameField = "Full Name",
            fatherNameLabel = "Father's Name *",
            fatherNameError = "Please enter father's name (at least 3 characters)",
            fatherNameField = "Father's Name",
            phoneLabel = "Phone Number (10 Digits) *",
            phoneError = "Please enter a valid 10-digit mobile number (starting with 6-9)",
            phoneField = "10-digit Phone Number",
            addressLabel = "Address *",
            addressError = "Please enter your full address (at least 6 characters)",
            addressField = "Address",
            regionDetailsTitle = "Region Details",
            selectStateLabel = "Select State *",
            selectDistrictLabel = "Select District *",
            districtError = "Please select a district",
            districtField = "District",
            selectSubDistrictLabel = "Select $subEn *",
            subDistrictError = "Please select your $subEn",
            subDistrictField = subEn,
            noSubDistrictsAvailable = "No $subEn available",
            positionLabel = "Position",
            defaultPosition = "$subEn Reporter",
            categoryLabel = "Interested Category *",
            categoryError = "Please enter your interested category",
            categoryField = "Interested Category",
            educationLabel = "Education Qualification *",
            educationError = "Please enter your education qualification",
            educationField = "Education Qualification",
            orgLabel = "Current Organization / Occupation *",
            orgError = "Please enter your current organization or occupation",
            orgField = "Current Organization",
            additionalMessageLabel = "Additional Message (Optional)",
            messagePlaceholder = "Share your reporting experience or notes...",
            defaultMessage = "Interested in working as an Alfa News Reporter",
            rulesAgreeCheckbox = "I have read and agree to all the reporter guidelines above.",
            rulesAgreeError = "Please read and accept the guidelines above *",
            rulesField = "Accept Guidelines",
            validationBanner = "Please fill in all required fields highlighted in red before submitting.",
            toastFieldPrompt = { field -> "Please enter $field properly" },
            submitButton = "Submit Application",
            submitFailedToast = "Submission failed. Please try again.",
            approvedTitle = "Congratulations! 🎉",
            approvedMessage = { mandal -> "Your application for $mandal $subEn has been approved. You are now an authorized Alfa News Reporter!" },
            reapplyTitle = "Under Review ⏳",
            reapplyMessage = "Your re-application has been submitted successfully. Our editorial team will review it shortly.",
            conflictTitle = "Under Review ⏳",
            conflictMessage = { mandal, repInfo -> "An active reporter$repInfo is already assigned to $mandal $subEn. Your application has been sent for special review by our Editorial Desk.\n\nA message has been sent to your Editorial Desk Chat where you can reply directly." },
            conflictChatText = { name, mandal -> "Hello ${name.ifEmpty { "Friend" }}, an active reporter is already assigned to $mandal $subEn.\n\nYour application has been forwarded for special review by our Editorial Desk. Our team will reach out shortly. You may reply directly here if you have any details to share. Thank you!" },
            conflictNotifTitle = "Your application is under review ⏳",
            submittedTitle = "Application Submitted",
            submittedMessage = "Your application has been received. Our editorial team will review your $subEn details and contact you soon.",
            openChatButton = "Editorial Desk Chat",
            okButton = "OK"
        )
        Language.TELUGU -> ReporterFormStrings(
            loginRequiredTitle = "లాగిన్ అవసరం",
            loginRequiredDesc = "విలేకరిగా దరఖాస్తు చేసుకోవడానికి దయచేసి మీ మొబైల్ నంబర్‌తో లాగిన్ అవ్వండి.",
            loginButton = "లాగిన్ అవ్వండి",
            closeButton = "రద్దు చేయి (Close)",
            pendingTitle = "పరిశీలనలో ఉంది (PENDING)",
            pendingDesc = "మీరు ఇప్పటికే ఒక దరఖాస్తును సమర్పించారు. అది ప్రస్తుతం పరిశీలనలో ఉంది. మా ప్రతినిధులు త్వరలోనే మీ దరఖాస్తును పరిశీలిస్తారు.",
            rulesTitle = "విలేకరి నిబంధనలు",
            rulesSubtitle = "ఆల్ఫా న్యూస్ విలేకరిగా చేరడానికి క్రింది నిబంధనలను పాటించాలి:",
            rule1Title = "ప్రతిరోజూ కనీసం ఒక వార్త",
            rule1Desc = "రెగ్యులర్‌గా వార్తలు పెట్టాలి. మీ $subLocal కు సంబంధించిన వార్త ప్రతిరోజూ కనీసం ఒక్కటైనా తప్పనిసరిగా ఉండాలి.",
            rule2Title = "త్వరితగతిన సమాచారం",
            rule2Desc = "వార్తలను వీలైనంత త్వరగా తాజా సమాచారంతో అందించగలగాలి.",
            rule3Title = "నాణ్యత & యాజమాన్య హక్కు",
            rule3Desc = "మీరు నాణ్యమైన వార్తలు అందించడంలో విఫలమైతే వెంటనే మిమ్మల్ని మార్చి వేరే విలేకరిని నియమించుకునే హక్కు యాజమాన్యానికి ఉంటుంది.",
            appFormTitle = "విలేకరి దరఖాస్తు ఫారం",
            fullNameLabel = "పూర్తి పేరు (Full Name) *",
            fullNameError = "కనీసం 3 అక్షరాలతో పూర్తి పేరు నమోదు చేయండి",
            fullNameField = "పూర్తి పేరు",
            fatherNameLabel = "తండ్రి పేరు (Father's Name) *",
            fatherNameError = "కనీసం 3 అక్షరాలతో తండ్రి పేరు నమోదు చేయండి",
            fatherNameField = "తండ్రి పేరు",
            phoneLabel = "ఫోన్ నంబర్ (10 అంకెలు) *",
            phoneError = "చెల్లుబాటు అయ్యే 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి (6-9 తో ప్రారంభం కావాలి)",
            phoneField = "10 అంకెల ఫోన్ నంబర్",
            addressLabel = "చిరునామా (Address) *",
            addressError = "కనీసం 6 అక్షరాలతో పూర్తి చిరునామా నమోదు చేయండి",
            addressField = "చిరునామా",
            regionDetailsTitle = "ప్రాంతం వివరాలు",
            selectStateLabel = "రాష్ట్రం ఎంచుకోండి *",
            selectDistrictLabel = "జిల్లా ఎంచుకోండి *",
            districtError = "దయచేసి జిల్లాను ఎంచుకోండి",
            districtField = "జిల్లా",
            selectSubDistrictLabel = "$subLocal ఎంచుకోండి *",
            subDistrictError = "దయచేసి $subLocal ను ఎంచుకోండి",
            subDistrictField = subLocal,
            noSubDistrictsAvailable = "మండలాలు అందుబాటులో లేవు",
            positionLabel = "హోదా (Position)",
            defaultPosition = "మండల రిపోర్టర్ ($subEn Reporter)",
            categoryLabel = "ఆసక్తి ఉన్న కేటగిరీ *",
            categoryError = "ఆసక్తి ఉన్న కేటగిరీని నమోదు చేయండి",
            categoryField = "ఆసక్తి ఉన్న కేటగిరీ",
            educationLabel = "విద్యార్హత *",
            educationError = "విద్యార్హతను నమోదు చేయండి",
            educationField = "విద్యార్హత",
            orgLabel = "ప్రస్తుత సంస్థ / వృత్తి *",
            orgError = "ప్రస్తుత సంస్థ లేదా వృత్తిని నమోదు చేయండి",
            orgField = "ప్రస్తుత సంస్థ",
            additionalMessageLabel = "సందేశం (ఐచ్ఛికం / Optional)",
            messagePlaceholder = "మీ అనుభవం లేదా అదనపు వివరాలు వ్రాయండి...",
            defaultMessage = "విలేకరిగా పనిచేయడానికి ఆసక్తిగా ఉన్నాను",
            rulesAgreeCheckbox = "నేను పై నిబంధనలన్నింటినీ చదివాను, వీటికి పూర్తిగా అంగీకరిస్తున్నాను.",
            rulesAgreeError = "దయచేసి పై నిబంధనలను చదివి అంగీకరించండి *",
            rulesField = "నిబంధనలు అంగీకరించండి",
            validationBanner = "దయచేసి ఎరుపు రంగులో ఉన్న వివరాలన్నీ సరిగ్గా నింపిన తర్వాతే సబ్మిట్ చేయండి.",
            toastFieldPrompt = { field -> "$field సరిగ్గా నమోదు చేయండి" },
            submitButton = "దరఖాస్తును సమర్పించండి",
            submitFailedToast = "సమర్పించడం విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.",
            approvedTitle = "అభినందనలు! 🎉",
            approvedMessage = { mandal -> "$mandal $subLocal కు మీ దరఖాస్తు ఆమోదించబడింది. మీరు ఇప్పుడు ఆల్ఫా న్యూస్ రిపోర్టర్‌గా నియమించబడ్డారు!" },
            reapplyTitle = "పరిశీలనలో ఉంది ⏳",
            reapplyMessage = "మీ రీ-అప్లికేషన్ విజయవంతంగా సమర్పించబడింది. మా అడ్మిన్ ప్రతినిధులు త్వరలోనే పరిశీలిస్తారు.",
            conflictTitle = "పరిశీలనలో ఉంది ⏳",
            conflictMessage = { mandal, repInfo -> "$mandal $subLocal కు ఇప్పటికే క్రియాశీల విలేకరి$repInfo ఉన్నారు. అందువల్ల మీ దరఖాస్తు అడ్మిన్ ప్రత్యేక పరిశీలనకు పంపబడింది.\n\nఅడ్మిన్ డెస్క్ నుండి మీకు సందేశం (Message) వచ్చింది. మీరు చాట్ ఓపెన్ చేసి అడ్మిన్‌కు రిప్లై ఇవ్వవచ్చు." },
            conflictChatText = { name, mandal -> "నమస్కారం ${name.ifEmpty { "మిత్రమా" }}, మీరు కోరిన $mandal $subLocal కు ఇప్పటికే క్రియాశీల విలేకరి ఉన్నారు.\n\nఅందువల్ల మీ దరఖాస్తు అడ్మిన్ ప్రత్యేక పరిశీలనకు పంపబడింది. మా అడ్మిన్ టీమ్ పరిశీలించి త్వరలోనే మిమ్మల్ని సంప్రదిస్తారు. మీకు ఏవైనా సందేహాలున్నా లేదా మీ వివరాలు తెలియజేయాలన్నా ఇక్కడే అడ్మిన్‌కు నేరుగా మెసేజ్ / రిప్లై ఇవ్వవచ్చు. ధన్యవాదాలు!" },
            conflictNotifTitle = "మీ దరఖాస్తు పరిశీలనలో ఉంది ⏳",
            submittedTitle = "దరఖాస్తు సమర్పించబడింది",
            submittedMessage = "మీ దరఖాస్తు విజయవంతంగా మాకు అందింది. మీ $subLocal కు సంబంధించిన వివరాలను మా బృందం పరిశీలించి త్వరలో సంప్రదిస్తుంది.",
            openChatButton = "అడ్మిన్ డెస్క్ చాట్ (Open Chat)",
            okButton = "సరే (OK)"
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JoinReporterPageView(
    onClose: () -> Unit,
    onNavigateToLogin: () -> Unit,
    onOpenChat: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val prefs = remember { PreferenceManager.getInstance(context) }
    val currentUser = FirebaseService.auth.currentUser
    val isUserLoggedIn = currentUser != null

    var rulesCheckboxChecked by remember { mutableStateOf(false) }

    var fullName by remember { mutableStateOf("") }
    var fatherName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var position by remember { mutableStateOf("") }
    var interestedArea by remember { mutableStateOf("") }
    var education by remember { mutableStateOf("") }
    var currentOrg by remember { mutableStateOf("") }

    var selectedState by remember { mutableStateOf(prefs.getEffectiveStateCode().code) }
    var selectedDistrict by remember { mutableStateOf(prefs.getEffectiveDistrict() ?: "") }
    var selectedMandal by remember { mutableStateOf("") }
    var additionalMessage by remember { mutableStateOf("") }

    var occupiedMandals by remember { mutableStateOf<Set<String>>(emptySet()) }
    var isLoadingOccupied by remember { mutableStateOf(false) }

    val scrollState = rememberScrollState()

    // Dropdown expanded states
    var stateExpanded by remember { mutableStateOf(false) }
    var districtExpanded by remember { mutableStateOf(false) }
    var mandalExpanded by remember { mutableStateOf(false) }

    var isSubmitting by remember { mutableStateOf(false) }
    var hasPendingApplication by remember { mutableStateOf(false) }
    var submissionResult by remember { mutableStateOf<SubmissionResult?>(null) }

    val scope = rememberCoroutineScope()

    val selectedStateCode = remember(selectedState) {
        StateCode.fromCode(selectedState) ?: StateCode.TS
    }
    val formLanguage = remember(selectedStateCode) {
        EditionRegistry.validateLanguageForState(selectedStateCode, prefs.language)
    }
    val strings = remember(selectedStateCode, formLanguage) {
        getReporterFormStrings(selectedStateCode, formLanguage)
    }
    val headlineFont: FontFamily = remember(formLanguage) { getHeadlineFontFamily(formLanguage) }
    val bodyFont: FontFamily = remember(formLanguage) { getBodyFontFamily(formLanguage) }

    val stateOptions = remember {
        EditionRegistry.ALL_EDITIONS_LIST.map { ed ->
            val label = if (ed.nameNative == ed.nameEn) ed.nameEn else "${ed.nameNative} (${ed.nameEn})"
            ed.stateCode.code to label
        }
    }
    val selectedStateName = stateOptions.find { it.first == selectedStateCode.code }?.second ?: ""

    val districtsList = remember(selectedStateCode) {
        EditionRegistry.EDITIONS[selectedStateCode]?.districts ?: emptyList()
    }

    // Ensure prefilled district belongs to selected state
    LaunchedEffect(selectedStateCode, districtsList) {
        if (selectedDistrict.isNotEmpty() && !districtsList.contains(selectedDistrict)) {
            selectedDistrict = ""
            selectedMandal = ""
        }
    }

    val mandalsList = remember(selectedStateCode, selectedDistrict) {
        if (selectedDistrict.isBlank()) {
            emptyList()
        } else {
            Constants.MANDAL_DATA[selectedDistrict]
                ?: EditionRegistry.getSubDistrictsForDistrict(selectedDistrict, selectedStateCode)
        }
    }

    // Validation focus markers (Positions relative to scrollable content)
    var fullNameY by remember { mutableFloatStateOf(0f) }
    var fatherNameY by remember { mutableFloatStateOf(0f) }
    var phoneY by remember { mutableFloatStateOf(0f) }
    var addressY by remember { mutableFloatStateOf(0f) }
    var districtY by remember { mutableFloatStateOf(0f) }
    var mandalY by remember { mutableFloatStateOf(0f) }
    var positionY by remember { mutableFloatStateOf(0f) }
    var areaY by remember { mutableFloatStateOf(0f) }
    var educationY by remember { mutableFloatStateOf(0f) }
    var orgY by remember { mutableFloatStateOf(0f) }
    var messageY by remember { mutableFloatStateOf(0f) }

    var hasAttemptedSubmit by remember { mutableStateOf(false) }

    val cleanPhone = remember(phone) {
        val digits = phone.filter { it.isDigit() }
        if (digits.length > 10) digits.takeLast(10) else digits
    }
    val isPhoneValid = remember(cleanPhone) {
        cleanPhone.length == 10 && cleanPhone.matches(Regex("^[6-9]\\d{9}$"))
    }
    val isFullNameValid = remember(fullName) { fullName.trim().length >= 3 }
    val isFatherNameValid = remember(fatherName) { fatherName.trim().length >= 3 }
    val isAddressValid = remember(address) { address.trim().length >= 6 }
    val isDistrictValid = remember(selectedDistrict) { selectedDistrict.isNotBlank() }
    val isMandalValid = remember(selectedMandal) { selectedMandal.isNotBlank() }
    val isCategoryValid = remember(interestedArea) { interestedArea.trim().length >= 2 }
    val isEducationValid = remember(education) { education.trim().length >= 2 }
    val isOrgValid = remember(currentOrg) { currentOrg.trim().length >= 2 }
    val isRulesValid = rulesCheckboxChecked

    val isFormValid = isFullNameValid && isFatherNameValid && isPhoneValid && isAddressValid &&
            isDistrictValid && isMandalValid && isCategoryValid && isEducationValid &&
            isOrgValid && isRulesValid

    // Coordinates of the scrollable content for relative calculation
    var contentCoordinates by remember { mutableStateOf<androidx.compose.ui.layout.LayoutCoordinates?>(null) }

    LaunchedEffect(Unit) {
        val currentUid = currentUser?.uid

        // 1. Check pending application status (strictly bounded query)
        if (!currentUid.isNullOrEmpty()) {
            launch {
                try {
                    val pendingSnap = withTimeoutOrNull(5000L) {
                        FirebaseService.db.collection("reporter_applications")
                            .whereEqualTo("userId", currentUid)
                            .whereEqualTo("status", "PENDING")
                            .limit(5)
                            .get()
                            .await()
                    }
                    if (pendingSnap != null) {
                        hasPendingApplication = !pendingSnap.isEmpty
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            // 2. Pre-fill user profile info if available
            launch {
                try {
                    val userDoc = withTimeoutOrNull(5000L) {
                        FirebaseService.db.collection("users").document(currentUid).get().await()
                    }
                    if (userDoc?.exists() == true) {
                        if (fullName.isEmpty()) fullName = userDoc.getString("name") ?: ""
                        if (phone.isEmpty()) {
                            val p = userDoc.getString("phone") ?: currentUser.phoneNumber ?: ""
                            val cleanDigits = p.replace("+91", "").filter { it.isDigit() }
                            phone = if (cleanDigits.length > 10) cleanDigits.takeLast(10) else cleanDigits
                        }
                        if (address.isEmpty()) address = userDoc.getString("address") ?: ""

                        val docDist = userDoc.getString("district")?.trim() ?: ""
                        val docStateRaw = userDoc.getString("stateCode") ?: userDoc.getString("state")
                        val resolvedDocState = EditionRegistry.resolveStateCode(docStateRaw, docDist)
                        if (resolvedDocState != null && selectedDistrict.isEmpty()) {
                            selectedState = resolvedDocState.code
                        }
                        if (selectedDistrict.isEmpty() && docDist.isNotEmpty()) {
                            val stateToCheck = resolvedDocState ?: selectedStateCode
                            val allowedDistricts = EditionRegistry.EDITIONS[stateToCheck]?.districts ?: emptyList()
                            if (allowedDistricts.contains(docDist)) {
                                selectedDistrict = docDist
                            }
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    // 3. Strictly bounded, state-aware occupied sub-district lookup for the selected district
    LaunchedEffect(selectedStateCode, selectedDistrict) {
        if (selectedDistrict.isBlank()) {
            occupiedMandals = emptySet()
            isLoadingOccupied = false
            return@LaunchedEffect
        }
        isLoadingOccupied = true
        try {
            val usersSnapshot = withTimeoutOrNull(5000L) {
                FirebaseService.db.collection("users")
                    .whereIn("role", listOf("REPORTER", 2, 2.0, "2"))
                    .whereEqualTo("district", selectedDistrict.trim())
                    .limit(100)
                    .get()
                    .await()
            }
            if (usersSnapshot != null) {
                val userMandals = usersSnapshot.documents.mapNotNull { doc ->
                    if (doc.getBoolean("suspended") == true || doc.getBoolean("previouslyDowngraded") == true) {
                        return@mapNotNull null
                    }
                    val repStateRaw = (doc.get("stateCode") as? String) ?: (doc.get("state") as? String)
                    val repState = EditionRegistry.resolveStateCode(repStateRaw, null)
                    if (repState != null && repState != selectedStateCode) {
                        return@mapNotNull null
                    }
                    val dist = (doc.get("district") as? String)?.trim() ?: ""
                    val mandal = (doc.get("assignedMandal") as? String)?.trim()?.takeIf { it.isNotEmpty() }
                        ?: (doc.get("mandal") as? String)?.trim() ?: ""
                    if (dist.isNotEmpty() && mandal.isNotEmpty()) {
                        "${selectedStateCode.code}|${dist.lowercase()}|${mandal.lowercase()}"
                    } else null
                }
                occupiedMandals = userMandals.toSet()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoadingOccupied = false
        }
    }

    LaunchedEffect(selectedState) {
        stateExpanded = false
        districtExpanded = false
        mandalExpanded = false
    }

    LaunchedEffect(selectedDistrict) {
        mandalExpanded = false
    }

    Box(
        modifier = Modifier.fillMaxSize()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp)
                .onGloballyPositioned { contentCoordinates = it }
                .verticalScroll(scrollState),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Spacer(modifier = Modifier.height(4.dp))

            // 1. GATE 1: User Not Logged In
            if (!isUserLoggedIn) {
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.elevatedCardColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    ),
                    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 3.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .background(
                                    color = MaterialTheme.colorScheme.primaryContainer,
                                    shape = CircleShape
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.AccountCircle,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(44.dp)
                            )
                        }

                        Text(
                            text = strings.loginRequiredTitle,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = headlineFont,
                            color = MaterialTheme.colorScheme.primary,
                            textAlign = TextAlign.Center
                        )

                        Text(
                            text = strings.loginRequiredDesc,
                            fontSize = 15.sp,
                            fontFamily = bodyFont,
                            lineHeight = 22.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Button(
                            onClick = onNavigateToLogin,
                            modifier = Modifier.fillMaxWidth().height(50.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary
                            )
                        ) {
                            Icon(Icons.Default.Login, contentDescription = null, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = strings.loginButton,
                                fontSize = 16.sp,
                                fontFamily = headlineFont
                            )
                        }

                        OutlinedButton(
                            onClick = onClose,
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(
                                text = strings.closeButton,
                                fontFamily = bodyFont,
                                fontSize = 15.sp
                            )
                        }
                    }
                }
            } else {
                // Pending Application Banner
                if (hasPendingApplication) {
                    ElevatedCard(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Default.Info, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                Text(
                                    text = strings.pendingTitle,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = headlineFont,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            }
                            Text(
                                text = strings.pendingDesc,
                                fontSize = 14.sp,
                                fontFamily = bodyFont,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                }

                // Compact Guidelines / Rules Card
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Gavel,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(22.dp)
                            )
                            Text(
                                text = strings.rulesTitle,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = headlineFont,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }

                        Text(
                            text = strings.rulesSubtitle,
                            fontSize = 13.sp,
                            fontFamily = bodyFont,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f))

                        RuleItem(
                            number = "1",
                            title = strings.rule1Title,
                            description = strings.rule1Desc,
                            headlineFont = headlineFont,
                            bodyFont = bodyFont
                        )
                        RuleItem(
                            number = "2",
                            title = strings.rule2Title,
                            description = strings.rule2Desc,
                            headlineFont = headlineFont,
                            bodyFont = bodyFont
                        )
                        RuleItem(
                            number = "3",
                            title = strings.rule3Title,
                            description = strings.rule3Desc,
                            headlineFont = headlineFont,
                            bodyFont = bodyFont
                        )
                    }
                }

                // Form Card 1: Personal Details
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(
                            text = strings.appFormTitle,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = headlineFont,
                            color = MaterialTheme.colorScheme.primary
                        )

                        OutlinedTextField(
                            value = fullName,
                            onValueChange = { fullName = it },
                            label = { Text(strings.fullNameLabel, fontFamily = bodyFont) },
                            isError = hasAttemptedSubmit && !isFullNameValid,
                            supportingText = if (hasAttemptedSubmit && !isFullNameValid) {
                                { Text(strings.fullNameError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, fontFamily = bodyFont) }
                            } else null,
                            modifier = Modifier.fillMaxWidth().onGloballyPositioned {
                                contentCoordinates?.let { parent -> fullNameY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                            },
                            singleLine = true,
                            shape = MaterialTheme.shapes.medium,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                                errorBorderColor = MaterialTheme.colorScheme.error
                            )
                        )

                        OutlinedTextField(
                            value = fatherName,
                            onValueChange = { fatherName = it },
                            label = { Text(strings.fatherNameLabel, fontFamily = bodyFont) },
                            isError = hasAttemptedSubmit && !isFatherNameValid,
                            supportingText = if (hasAttemptedSubmit && !isFatherNameValid) {
                                { Text(strings.fatherNameError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, fontFamily = bodyFont) }
                            } else null,
                            modifier = Modifier.fillMaxWidth().onGloballyPositioned {
                                contentCoordinates?.let { parent -> fatherNameY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                            },
                            singleLine = true,
                            shape = MaterialTheme.shapes.medium,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                                errorBorderColor = MaterialTheme.colorScheme.error
                            )
                        )

                        OutlinedTextField(
                            value = phone,
                            onValueChange = { input ->
                                val digits = input.filter { it.isDigit() }
                                if (digits.length <= 10) {
                                    phone = digits
                                }
                            },
                            label = { Text(strings.phoneLabel, fontFamily = bodyFont) },
                            isError = hasAttemptedSubmit && !isPhoneValid,
                            supportingText = if (hasAttemptedSubmit && !isPhoneValid) {
                                { Text(strings.phoneError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, fontFamily = bodyFont) }
                            } else null,
                            modifier = Modifier.fillMaxWidth().onGloballyPositioned {
                                contentCoordinates?.let { parent -> phoneY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                            },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Phone
                            ),
                            shape = MaterialTheme.shapes.medium,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                                errorBorderColor = MaterialTheme.colorScheme.error
                            )
                        )

                        OutlinedTextField(
                            value = address,
                            onValueChange = { address = it },
                            label = { Text(strings.addressLabel, fontFamily = bodyFont) },
                            isError = hasAttemptedSubmit && !isAddressValid,
                            supportingText = if (hasAttemptedSubmit && !isAddressValid) {
                                { Text(strings.addressError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, fontFamily = bodyFont) }
                            } else null,
                            modifier = Modifier.fillMaxWidth().onGloballyPositioned {
                                contentCoordinates?.let { parent -> addressY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                            },
                            singleLine = true,
                            shape = MaterialTheme.shapes.medium,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                                errorBorderColor = MaterialTheme.colorScheme.error
                            )
                        )
                    }
                }

                // Form Card 2: Region Details (All 9 States -> District -> Mandal/Tehsil/Taluka/Sub-Division)
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(strings.regionDetailsTitle, fontWeight = FontWeight.Bold, fontFamily = headlineFont)

                        // State Dropdown (All 9 States)
                        ExposedDropdownMenuBox(
                            expanded = stateExpanded,
                            onExpandedChange = { stateExpanded = !stateExpanded }
                        ) {
                            OutlinedTextField(
                                value = selectedStateName,
                                onValueChange = {},
                                readOnly = true,
                                label = { Text(strings.selectStateLabel, fontFamily = bodyFont) },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = stateExpanded) },
                                modifier = Modifier.fillMaxWidth().menuAnchor(),
                                shape = MaterialTheme.shapes.medium,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                                )
                            )
                            ExposedDropdownMenu(
                                expanded = stateExpanded,
                                onDismissRequest = { stateExpanded = false }
                            ) {
                                stateOptions.forEach { (stateCode, stateLabel) ->
                                    DropdownMenuItem(
                                        text = { Text(stateLabel) },
                                        onClick = {
                                            selectedState = stateCode
                                            selectedDistrict = ""
                                            selectedMandal = ""
                                            stateExpanded = false
                                        }
                                    )
                                }
                            }
                        }

                        // District Dropdown
                        ExposedDropdownMenuBox(
                            expanded = districtExpanded,
                            onExpandedChange = { districtExpanded = !districtExpanded },
                            modifier = Modifier.onGloballyPositioned {
                                contentCoordinates?.let { parent -> districtY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                            }
                        ) {
                            OutlinedTextField(
                                value = selectedDistrict,
                                onValueChange = {},
                                readOnly = true,
                                label = { Text(strings.selectDistrictLabel, fontFamily = bodyFont) },
                                isError = hasAttemptedSubmit && !isDistrictValid,
                                supportingText = if (hasAttemptedSubmit && !isDistrictValid) {
                                    { Text(strings.districtError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, fontFamily = bodyFont) }
                                } else null,
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = districtExpanded) },
                                modifier = Modifier.fillMaxWidth().menuAnchor(),
                                shape = MaterialTheme.shapes.medium,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                                    errorBorderColor = MaterialTheme.colorScheme.error
                                )
                            )
                            ExposedDropdownMenu(
                                expanded = districtExpanded,
                                onDismissRequest = { districtExpanded = false }
                            ) {
                                districtsList.forEach { districtName: String ->
                                    DropdownMenuItem(
                                        text = { Text(districtName) },
                                        onClick = {
                                            selectedDistrict = districtName
                                            selectedMandal = ""
                                            districtExpanded = false
                                        }
                                    )
                                }
                            }
                        }

                        // Sub-District (Mandal / Tehsil / Taluka / Sub-Division) Dropdown
                        if (selectedDistrict.isNotEmpty()) {
                            ExposedDropdownMenuBox(
                                expanded = mandalExpanded,
                                onExpandedChange = { mandalExpanded = !mandalExpanded },
                                modifier = Modifier.onGloballyPositioned {
                                    contentCoordinates?.let { parent -> mandalY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                                }
                            ) {
                                OutlinedTextField(
                                    value = selectedMandal,
                                    onValueChange = {},
                                    readOnly = true,
                                    label = { Text(strings.selectSubDistrictLabel, fontFamily = bodyFont) },
                                    isError = hasAttemptedSubmit && !isMandalValid,
                                    supportingText = if (hasAttemptedSubmit && !isMandalValid) {
                                        { Text(strings.subDistrictError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, fontFamily = bodyFont) }
                                    } else null,
                                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = mandalExpanded) },
                                    modifier = Modifier.fillMaxWidth().menuAnchor(),
                                    shape = MaterialTheme.shapes.medium,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                                        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                                        errorBorderColor = MaterialTheme.colorScheme.error
                                    )
                                )
                                ExposedDropdownMenu(
                                    expanded = mandalExpanded,
                                    onDismissRequest = { mandalExpanded = false }
                                ) {
                                    if (mandalsList.isEmpty()) {
                                        DropdownMenuItem(text = { Text(strings.noSubDistrictsAvailable) }, onClick = {})
                                    } else {
                                        mandalsList.forEach { mandalName: String ->
                                            DropdownMenuItem(
                                                text = { Text(mandalName) },
                                                onClick = {
                                                    selectedMandal = mandalName
                                                    mandalExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Form Card 3: Role & Background
                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.elevatedCardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        OutlinedTextField(
                            value = strings.defaultPosition,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text(strings.positionLabel, fontFamily = bodyFont) },
                            modifier = Modifier.fillMaxWidth().onGloballyPositioned {
                                contentCoordinates?.let { parent -> positionY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                            },
                            shape = MaterialTheme.shapes.medium,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                            )
                        )

                        OutlinedTextField(
                            value = interestedArea,
                            onValueChange = { interestedArea = it },
                            label = { Text(strings.categoryLabel, fontFamily = bodyFont) },
                            isError = hasAttemptedSubmit && !isCategoryValid,
                            supportingText = if (hasAttemptedSubmit && !isCategoryValid) {
                                { Text(strings.categoryError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, fontFamily = bodyFont) }
                            } else null,
                            modifier = Modifier.fillMaxWidth().onGloballyPositioned {
                                contentCoordinates?.let { parent -> areaY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                            },
                            singleLine = true,
                            shape = MaterialTheme.shapes.medium,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                                errorBorderColor = MaterialTheme.colorScheme.error
                            )
                        )

                        OutlinedTextField(
                            value = education,
                            onValueChange = { education = it },
                            label = { Text(strings.educationLabel, fontFamily = bodyFont) },
                            isError = hasAttemptedSubmit && !isEducationValid,
                            supportingText = if (hasAttemptedSubmit && !isEducationValid) {
                                { Text(strings.educationError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, fontFamily = bodyFont) }
                            } else null,
                            modifier = Modifier.fillMaxWidth().onGloballyPositioned {
                                contentCoordinates?.let { parent -> educationY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                            },
                            singleLine = true,
                            shape = MaterialTheme.shapes.medium,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                                errorBorderColor = MaterialTheme.colorScheme.error
                            )
                        )

                        OutlinedTextField(
                            value = currentOrg,
                            onValueChange = { currentOrg = it },
                            label = { Text(strings.orgLabel, fontFamily = bodyFont) },
                            isError = hasAttemptedSubmit && !isOrgValid,
                            supportingText = if (hasAttemptedSubmit && !isOrgValid) {
                                { Text(strings.orgError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, fontFamily = bodyFont) }
                            } else null,
                            modifier = Modifier.fillMaxWidth().onGloballyPositioned {
                                contentCoordinates?.let { parent -> orgY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                            },
                            singleLine = true,
                            shape = MaterialTheme.shapes.medium,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                                errorBorderColor = MaterialTheme.colorScheme.error
                            )
                        )

                        OutlinedTextField(
                            value = additionalMessage,
                            onValueChange = { additionalMessage = it },
                            label = { Text(strings.additionalMessageLabel, fontFamily = bodyFont) },
                            modifier = Modifier.fillMaxWidth().onGloballyPositioned {
                                contentCoordinates?.let { parent -> messageY = parent.localPositionOf(it, androidx.compose.ui.geometry.Offset.Zero).y }
                            },
                            minLines = 3,
                            placeholder = { Text(strings.messagePlaceholder, fontFamily = bodyFont) },
                            shape = MaterialTheme.shapes.medium,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
                            )
                        )
                    }
                }

                // Agreement Checkbox
                Column(modifier = Modifier.fillMaxWidth()) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (hasAttemptedSubmit && !rulesCheckboxChecked) MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.25f) else MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f),
                        border = BorderStroke(
                            if (hasAttemptedSubmit && !rulesCheckboxChecked) 2.dp else 1.dp,
                            if (hasAttemptedSubmit && !rulesCheckboxChecked) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { rulesCheckboxChecked = !rulesCheckboxChecked }
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Checkbox(
                                checked = rulesCheckboxChecked,
                                onCheckedChange = { rulesCheckboxChecked = it }
                            )
                            Text(
                                text = strings.rulesAgreeCheckbox,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                                fontFamily = bodyFont,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                    if (hasAttemptedSubmit && !rulesCheckboxChecked) {
                        Text(
                            text = strings.rulesAgreeError,
                            color = MaterialTheme.colorScheme.error,
                            fontSize = 12.sp,
                            fontFamily = bodyFont,
                            modifier = Modifier.padding(start = 8.dp, top = 4.dp)
                        )
                    }
                }

                // Validation Warning Banner before Submit Button
                if (hasAttemptedSubmit && !isFormValid) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.7f),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(20.dp))
                            Text(
                                text = strings.validationBanner,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                fontFamily = bodyFont,
                                fontWeight = FontWeight.Medium,
                                fontSize = 14.sp
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                Button(
                    onClick = {
                        hasAttemptedSubmit = true

                        if (!isFormValid) {
                            val firstEmptyField = when {
                                !isFullNameValid -> strings.fullNameField to fullNameY
                                !isFatherNameValid -> strings.fatherNameField to fatherNameY
                                !isPhoneValid -> strings.phoneField to phoneY
                                !isAddressValid -> strings.addressField to addressY
                                !isDistrictValid -> strings.districtField to districtY
                                !isMandalValid -> strings.subDistrictField to mandalY
                                !isCategoryValid -> strings.categoryField to areaY
                                !isEducationValid -> strings.educationField to educationY
                                !isOrgValid -> strings.orgField to orgY
                                !rulesCheckboxChecked -> strings.rulesField to Float.MAX_VALUE
                                else -> null
                            }

                            if (firstEmptyField != null) {
                                Toast.makeText(context, strings.toastFieldPrompt(firstEmptyField.first), Toast.LENGTH_SHORT).show()
                                if (firstEmptyField.second != Float.MAX_VALUE) {
                                    scope.launch {
                                        scrollState.animateScrollTo(maxOf(0, firstEmptyField.second.toInt() - 50))
                                    }
                                }
                            }
                            return@Button
                        }

                        val targetPosition = if (position.isNotBlank()) position.trim() else strings.defaultPosition
                        val finalFullName = fullName.trim()
                        val finalFatherName = fatherName.trim()
                        val finalPhone = cleanPhone
                        val finalAddress = address.trim()
                        val finalInterestedArea = interestedArea.trim()
                        val finalEducation = education.trim()
                        val finalCurrentOrg = currentOrg.trim()
                        val finalMessage = if (additionalMessage.isNotBlank()) additionalMessage.trim() else strings.defaultMessage

                        scope.launch {
                            isSubmitting = true
                            var submittedSuccessfully = false
                            var wasAutoApproved = false
                            var isReapplication = false
                            var isConflict = false
                            var existingRepName = ""

                            // 1. Try Cloud Function first (authoritative state-aware vacancy check + auto-approval)
                            try {
                                val result = FirebaseFunctionsService.submitReporterApplication(
                                    fullName = finalFullName,
                                    fatherName = finalFatherName,
                                    phone = finalPhone,
                                    address = finalAddress,
                                    position = targetPosition,
                                    interestedArea = finalInterestedArea,
                                    education = finalEducation,
                                    currentOrg = finalCurrentOrg,
                                    state = selectedStateCode.code,
                                    district = selectedDistrict.trim(),
                                    mandal = selectedMandal.trim(),
                                    message = finalMessage,
                                    userId = FirebaseService.auth.currentUser?.uid,
                                    language = formLanguage.code
                                )
                                if (result.isSuccess) {
                                    submittedSuccessfully = true
                                    val data = result.getOrNull()
                                    wasAutoApproved = data?.get("autoApproved") == true
                                    isReapplication = data?.get("isPreviouslyDowngraded") == true
                                    isConflict = data?.get("isConflict") == true
                                    existingRepName = data?.get("existingReporterName") as? String ?: ""
                                }
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }

                            // 2. Fallback: Save directly to Firestore if Cloud Function didn't confirm success
                            if (!submittedSuccessfully) {
                                try {
                                    val currentUid = FirebaseService.auth.currentUser?.uid ?: ""
                                    var isPrevDown = false
                                    if (currentUid.isNotEmpty()) {
                                        val uDoc = FirebaseService.db.collection("users").document(currentUid).get().await()
                                        isPrevDown = uDoc.getBoolean("previouslyDowngraded") == true || uDoc.getBoolean("suspended") == true
                                    }
                                    isReapplication = isPrevDown
                                    val occupancyKey = "${selectedStateCode.code}|${selectedDistrict.trim().lowercase()}|${selectedMandal.trim().lowercase()}"
                                    val isVacant = !occupiedMandals.contains(occupancyKey)
                                    isConflict = !isVacant
                                    val finalStatus = if (currentUid.isNotEmpty() && !isPrevDown && isVacant) "JOINED" else "PENDING"
                                    val autoApp = (finalStatus == "JOINED")

                                    val appData = mapOf(
                                        "fullName" to finalFullName,
                                        "fatherName" to finalFatherName,
                                        "phone" to finalPhone,
                                        "address" to finalAddress,
                                        "position" to targetPosition,
                                        "interestedArea" to finalInterestedArea,
                                        "education" to finalEducation,
                                        "currentOrg" to finalCurrentOrg,
                                        "state" to selectedStateCode.code,
                                        "stateCode" to selectedStateCode.code,
                                        "language" to formLanguage.code,
                                        "district" to selectedDistrict.trim(),
                                        "mandal" to selectedMandal.trim(),
                                        "message" to finalMessage,
                                        "status" to finalStatus,
                                        "autoApproved" to autoApp,
                                        "isConflict" to isConflict,
                                        "isReapplication" to isPrevDown,
                                        "previouslyDowngraded" to isPrevDown,
                                        "agreedToRules" to true,
                                        "userId" to currentUid,
                                        "timestamp" to com.google.firebase.Timestamp.now()
                                    )
                                    FirebaseService.db.collection("reporter_applications").add(appData).await()

                                    if (autoApp && currentUid.isNotEmpty()) {
                                        val userRef = FirebaseService.db.collection("users").document(currentUid)
                                        val safeProfileUpdates = mapOf(
                                            "state" to selectedStateCode.code,
                                            "stateCode" to selectedStateCode.code,
                                            "language" to formLanguage.code,
                                            "district" to selectedDistrict.trim(),
                                            "mandal" to selectedMandal.trim(),
                                            "agreedToRules" to true,
                                            "name" to finalFullName,
                                            "phone" to finalPhone
                                        )
                                        try {
                                            userRef.set(safeProfileUpdates, com.google.firebase.firestore.SetOptions.merge()).await()
                                        } catch (e: Exception) {
                                            android.util.Log.w("JoinReporter", "Non-critical: user profile update in fallback: ${e.message}")
                                        }
                                    } else if (isConflict && currentUid.isNotEmpty()) {
                                        val conflictText = strings.conflictChatText(finalFullName, selectedMandal)
                                        val msgTimestamp = com.google.firebase.Timestamp.now()

                                        val convData = mapOf(
                                            "reporterId" to currentUid,
                                            "reporterName" to finalFullName,
                                            "reporterState" to selectedStateCode.code,
                                            "reporterDistrict" to selectedDistrict.trim(),
                                            "reporterMandal" to selectedMandal.trim(),
                                            "lastMessage" to conflictText,
                                            "lastMessageTime" to msgTimestamp,
                                            "lastSenderRole" to "ADMIN",
                                            "lastSenderId" to "SYSTEM_ADMIN",
                                            "unreadCountForReporter" to 1,
                                            "updatedAt" to msgTimestamp
                                        )
                                        FirebaseService.db.collection("reporter_conversations").document(currentUid).set(convData, com.google.firebase.firestore.SetOptions.merge()).await()

                                        val msgData = mapOf(
                                            "senderId" to "SYSTEM_ADMIN",
                                            "senderName" to "AlfaNews Editorial Desk",
                                            "senderRole" to "ADMIN",
                                            "text" to conflictText,
                                            "type" to "NOTICE",
                                            "read" to false,
                                            "timestamp" to msgTimestamp
                                        )
                                        FirebaseService.db.collection("reporter_conversations").document(currentUid).collection("messages").add(msgData).await()

                                        val userMsgData = mapOf(
                                            "title" to strings.conflictNotifTitle,
                                            "body" to conflictText,
                                            "senderName" to "AlfaNews Editorial Desk",
                                            "senderRole" to "ADMIN",
                                            "read" to false,
                                            "importance" to "HIGH",
                                            "type" to "REPORTER_APP_PENDING",
                                            "timestamp" to msgTimestamp
                                        )
                                        FirebaseService.db.collection("users").document(currentUid).collection("messages").add(userMsgData).await()
                                    }

                                    submittedSuccessfully = true
                                    wasAutoApproved = autoApp
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }
                            }

                            isSubmitting = false
                            if (submittedSuccessfully) {
                                if (wasAutoApproved) {
                                    submissionResult = SubmissionResult(
                                        title = strings.approvedTitle,
                                        message = strings.approvedMessage(selectedMandal),
                                        isConflict = false
                                    )
                                } else if (isReapplication) {
                                    submissionResult = SubmissionResult(
                                        title = strings.reapplyTitle,
                                        message = strings.reapplyMessage,
                                        isConflict = false
                                    )
                                } else if (isConflict) {
                                    val repInfo = if (existingRepName.isNotBlank()) " ($existingRepName)" else ""
                                    submissionResult = SubmissionResult(
                                        title = strings.conflictTitle,
                                        message = strings.conflictMessage(selectedMandal, repInfo),
                                        isConflict = true
                                    )
                                } else {
                                    submissionResult = SubmissionResult(
                                        title = strings.submittedTitle,
                                        message = strings.submittedMessage,
                                        isConflict = false
                                    )
                                }
                            } else {
                                Toast.makeText(context, strings.submitFailedToast, Toast.LENGTH_LONG).show()
                            }
                        }
                    },
                    enabled = !isSubmitting,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = MaterialTheme.shapes.large,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isFormValid) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.primary.copy(alpha = 0.75f)
                    ),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 8.dp)
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(24.dp))
                    } else {
                        Text(strings.submitButton, fontSize = 18.sp, fontFamily = headlineFont)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }

    submissionResult?.let { res ->
        AlertDialog(
            onDismissRequest = { /* Prevent dismissal by clicking outside */ },
            title = { Text(res.title, fontFamily = headlineFont, fontWeight = FontWeight.Bold) },
            text = { Text(res.message, fontFamily = bodyFont, fontSize = 15.sp, lineHeight = 22.sp) },
            confirmButton = {
                if (res.isConflict) {
                    Button(
                        onClick = {
                            submissionResult = null
                            if (onOpenChat != null) {
                                onOpenChat()
                            } else {
                                onClose()
                            }
                        }
                    ) {
                        Text(strings.openChatButton, fontFamily = headlineFont)
                    }
                } else {
                    Button(
                        onClick = {
                            submissionResult = null
                            onClose()
                        }
                    ) {
                        Text(strings.okButton, fontFamily = headlineFont)
                    }
                }
            },
            dismissButton = if (res.isConflict) {
                {
                    TextButton(
                        onClick = {
                            submissionResult = null
                            onClose()
                        }
                    ) {
                        Text(strings.okButton, fontFamily = headlineFont)
                    }
                }
            } else null
        )
    }
}

@Composable
private fun RuleItem(
    number: String,
    title: String,
    description: String,
    headlineFont: FontFamily,
    bodyFont: FontFamily
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                shape = RoundedCornerShape(10.dp)
            )
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .size(24.dp)
                .background(
                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = number,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                fontFamily = headlineFont,
                color = MaterialTheme.colorScheme.primary
            )
        }

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = title,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                fontFamily = headlineFont,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = description,
                fontSize = 12.sp,
                fontFamily = bodyFont,
                lineHeight = 16.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
