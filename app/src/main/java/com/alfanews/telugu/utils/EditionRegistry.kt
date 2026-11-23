package com.alfanews.telugu.utils

import com.alfanews.telugu.models.Language
import com.alfanews.telugu.models.NewsPost

/**
 * Alfa News Android Multi-State Edition Registry (9 States × 5 Languages)
 *
 * Strict State-Bound Languages (Zero Cross-State Translation):
 * - AP, TS      -> te, en       -> collection "news" (UNTOUCHED for 98,000+ legacy docs & older APKs)
 * - UP, UK, HP  -> hi, en       -> "news_hi" (or "news_en")
 * - PB          -> pa, hi, en   -> "news_pa" (or "news_hi" / "news_en")
 * - GJ          -> gu, en       -> "news_gu" (or "news_en")
 * - GA, MN      -> en, hi       -> "news_en" (or "news_hi")
 *
 * Full 3-tier location hierarchy across ALL 9 states:
 * Mandal / Tehsil / Taluka / Sub-Division -> Assembly Constituency -> District
 */
enum class StateCode(val code: String) {
    AP("AP"),
    TS("TS"),
    UP("UP"),
    PB("PB"),
    UK("UK"),
    GA("GA"),
    MN("MN"),
    HP("HP"),
    GJ("GJ");

    companion object {
        fun fromCode(raw: String?): StateCode? {
            if (raw.isNullOrBlank()) return null
            val clean = raw.trim().uppercase()
            if (clean == "TG") return TS
            if (clean == "UT") return UK
            return entries.firstOrNull { it.code == clean }
        }
    }
}

data class EditionConfig(
    val stateCode: StateCode,
    val nameEn: String,
    val nameNative: String,
    val primaryLanguage: Language,
    val supportedLanguages: List<Language>,
    val defaultCollection: String,
    val stateAliases: List<String>,
    val subDistrictLabel: String,
    val districts: List<String>
)

object EditionRegistry {

    val UP_DISTRICTS: List<String> = listOf(
        "Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh",
        "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti",
        "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah",
        "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur",
        "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi",
        "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kushinagar", "Lakhimpur Kheri",
        "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur",
        "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj", "Raebareli", "Rampur",
        "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar",
        "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"
    )

    val PB_DISTRICTS: List<String> = listOf(
        "Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Ferozepur",
        "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Malerkotla", "Mansa",
        "Moga", "Pathankot", "Patiala", "Rupnagar", "Sahibzada Ajit Singh Nagar", "Sangrur",
        "Shahid Bhagat Singh Nagar", "Sri Muktsar Sahib", "Tarn Taran"
    )

    val UK_DISTRICTS: List<String> = listOf(
        "Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun", "Haridwar", "Nainital",
        "Pauri Garhwal", "Pithoragarh", "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi"
    )

    val GA_DISTRICTS: List<String> = listOf("North Goa", "South Goa")

    val MN_DISTRICTS: List<String> = listOf(
        "Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West", "Jiribam", "Kakching",
        "Kamjong", "Kangpokpi", "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"
    )

    val HP_DISTRICTS: List<String> = listOf(
        "Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur", "Kullu",
        "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur", "Solan", "Una"
    )

    val GJ_DISTRICTS: List<String> = listOf(
        "Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad",
        "Chhota Udaipur", "Dahod", "Dang", "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar",
        "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal",
        "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad"
    )

    val ALL_EXPANSION_DISTRICTS: List<String> =
        UP_DISTRICTS + PB_DISTRICTS + UK_DISTRICTS + GA_DISTRICTS + MN_DISTRICTS + HP_DISTRICTS + GJ_DISTRICTS

    val EDITIONS: Map<StateCode, EditionConfig> = mapOf(
        StateCode.AP to EditionConfig(
            stateCode = StateCode.AP,
            nameEn = "Andhra Pradesh",
            nameNative = "ఆంధ్రప్రదేశ్",
            primaryLanguage = Language.TELUGU,
            supportedLanguages = listOf(Language.TELUGU, Language.ENGLISH),
            defaultCollection = "news",
            stateAliases = listOf("AP", "Andhra Pradesh", "AndhraPradesh", "Andhra", "ఆంధ్రప్రదేశ్", "ఆంధ్ర ప్రదేశ్", "ఆంధ్ర"),
            subDistrictLabel = "మండలం",
            districts = Constants.AP_DISTRICTS
        ),
        StateCode.TS to EditionConfig(
            stateCode = StateCode.TS,
            nameEn = "Telangana",
            nameNative = "తెలంగాణ",
            primaryLanguage = Language.TELUGU,
            supportedLanguages = listOf(Language.TELUGU, Language.ENGLISH),
            defaultCollection = "news",
            stateAliases = listOf("TS", "TG", "Telangana", "Telangana State", "తెలంగాణ", "తెలంగాణా"),
            subDistrictLabel = "మండలం",
            districts = Constants.TS_DISTRICTS
        ),
        StateCode.UP to EditionConfig(
            stateCode = StateCode.UP,
            nameEn = "Uttar Pradesh",
            nameNative = "उत्तर प्रदेश",
            primaryLanguage = Language.HINDI,
            supportedLanguages = listOf(Language.HINDI, Language.ENGLISH),
            defaultCollection = "news_hi",
            stateAliases = listOf("UP", "Uttar Pradesh", "उत्तर प्रदेश", "यूपी"),
            subDistrictLabel = "तहसील",
            districts = UP_DISTRICTS
        ),
        StateCode.PB to EditionConfig(
            stateCode = StateCode.PB,
            nameEn = "Punjab",
            nameNative = "ਪੰਜਾਬ",
            primaryLanguage = Language.PUNJABI,
            supportedLanguages = listOf(Language.PUNJABI, Language.HINDI, Language.ENGLISH),
            defaultCollection = "news_pa",
            stateAliases = listOf("PB", "Punjab", "ਪੰਜਾਬ", "पंजाब"),
            subDistrictLabel = "ਤਹਿਸੀਲ",
            districts = PB_DISTRICTS
        ),
        StateCode.UK to EditionConfig(
            stateCode = StateCode.UK,
            nameEn = "Uttarakhand",
            nameNative = "उत्तराखंड",
            primaryLanguage = Language.HINDI,
            supportedLanguages = listOf(Language.HINDI, Language.ENGLISH),
            defaultCollection = "news_hi",
            stateAliases = listOf("UK", "UT", "Uttarakhand", "उत्तराखंड", "उत्तराखण्ड"),
            subDistrictLabel = "तहसील",
            districts = UK_DISTRICTS
        ),
        StateCode.GA to EditionConfig(
            stateCode = StateCode.GA,
            nameEn = "Goa",
            nameNative = "Goa",
            primaryLanguage = Language.ENGLISH,
            supportedLanguages = listOf(Language.ENGLISH, Language.HINDI),
            defaultCollection = "news_en",
            stateAliases = listOf("GA", "Goa", "गोवा"),
            subDistrictLabel = "Taluka",
            districts = GA_DISTRICTS
        ),
        StateCode.MN to EditionConfig(
            stateCode = StateCode.MN,
            nameEn = "Manipur",
            nameNative = "Manipur",
            primaryLanguage = Language.ENGLISH,
            supportedLanguages = listOf(Language.ENGLISH, Language.HINDI),
            defaultCollection = "news_en",
            stateAliases = listOf("MN", "Manipur", "मणिपुर"),
            subDistrictLabel = "Sub-Division",
            districts = MN_DISTRICTS
        ),
        StateCode.HP to EditionConfig(
            stateCode = StateCode.HP,
            nameEn = "Himachal Pradesh",
            nameNative = "हिमाचल प्रदेश",
            primaryLanguage = Language.HINDI,
            supportedLanguages = listOf(Language.HINDI, Language.ENGLISH),
            defaultCollection = "news_hi",
            stateAliases = listOf("HP", "Himachal Pradesh", "Himachal", "हिमाचल प्रदेश", "हिमाचल"),
            subDistrictLabel = "तहसील",
            districts = HP_DISTRICTS
        ),
        StateCode.GJ to EditionConfig(
            stateCode = StateCode.GJ,
            nameEn = "Gujarat",
            nameNative = "ગુજરાત",
            primaryLanguage = Language.GUJARATI,
            supportedLanguages = listOf(Language.GUJARATI, Language.ENGLISH),
            defaultCollection = "news_gu",
            stateAliases = listOf("GJ", "Gujarat", "ગુજરાત", "गुजरात"),
            subDistrictLabel = "તાલુકા",
            districts = GJ_DISTRICTS
        )
    )

    val ALL_EDITIONS_LIST: List<EditionConfig> = StateCode.entries.mapNotNull { EDITIONS[it] }

    val ALL_COLLECTIONS: List<String> = listOf("news", "news_hi", "news_pa", "news_gu", "news_en")

    fun getAllDistricts(): List<String> = Constants.ALL_DISTRICTS + ALL_EXPANSION_DISTRICTS

    fun getEditionTopic(stateCode: StateCode, language: Language? = null): String {
        val validLang = validateLanguageForState(stateCode, language)
        return "edition_${validLang.code}_${stateCode.code.lowercase()}"
    }

    /**
     * District aliases for the 7 expansion states (native script + city nicknames).
     */
    val EXPANSION_DISTRICT_ALIASES: Map<String, List<String>> = mapOf(
        "Lucknow" to listOf("Lucknow", "लखनऊ"),
        "Varanasi" to listOf("Varanasi", "वाराणसी", "काशी", "बनारस", "Banaras", "Kashi"),
        "Prayagraj" to listOf("Prayagraj", "प्रयागराज", "Allahabad", "इलाहाबाद"),
        "Ayodhya" to listOf("Ayodhya", "अयोध्या", "Faizabad", "फैजाबाद"),
        "Gautam Buddha Nagar" to listOf("Gautam Buddha Nagar", "Noida", "नोएडा", "Greater Noida"),
        "Kanpur Nagar" to listOf("Kanpur Nagar", "Kanpur", "कानपुर"),
        "Agra" to listOf("Agra", "आगरा"),
        "Ghaziabad" to listOf("Ghaziabad", "गाजियाबाद"),
        "Gorakhpur" to listOf("Gorakhpur", "गोरखपुर"),
        "Meerut" to listOf("Meerut", "मेरठ"),
        "Mathura" to listOf("Mathura", "मथुरा"),
        "Amritsar" to listOf("Amritsar", "ਅੰਮ੍ਰਿਤਸਰ", "अमृतसर"),
        "Ludhiana" to listOf("Ludhiana", "ਲੁਧਿਆਣਾ", "लुधियाना"),
        "Jalandhar" to listOf("Jalandhar", "ਜਲੰਧਰ", "जालंधर"),
        "Patiala" to listOf("Patiala", "ਪਟਿਆਲਾ", "पटियाला"),
        "Bathinda" to listOf("Bathinda", "ਬਠਿੰਡਾ", "बठिंडा"),
        "Sahibzada Ajit Singh Nagar" to listOf("Sahibzada Ajit Singh Nagar", "Mohali", "SAS Nagar", "ਮੋਹਾਲੀ", "मोहाली"),
        "Shahid Bhagat Singh Nagar" to listOf("Shahid Bhagat Singh Nagar", "Nawanshahr", "SBS Nagar", "ਨਵਾਂਸ਼ਹਿਰ"),
        "Rupnagar" to listOf("Rupnagar", "Ropar", "ਰੋਪੜ"),
        "Sri Muktsar Sahib" to listOf("Sri Muktsar Sahib", "Muktsar", "ਮੁਕਤਸਰ"),
        "Dehradun" to listOf("Dehradun", "देहरादून", "Rishikesh", "ऋषिकेश"),
        "Haridwar" to listOf("Haridwar", "हरिद्वार", "Roorkee", "रुड़की"),
        "Nainital" to listOf("Nainital", "नैनीताल", "Haldwani", "हल्द्वानी"),
        "Udham Singh Nagar" to listOf("Udham Singh Nagar", "Rudrapur", "रुद्रपुर"),
        "North Goa" to listOf("North Goa", "Panaji", "Panjim", "Mapusa", "Ponda"),
        "South Goa" to listOf("South Goa", "Margao", "Madgaon", "Vasco", "Vasco Da Gama"),
        "Imphal West" to listOf("Imphal West", "Imphal", "Lamphelpat"),
        "Imphal East" to listOf("Imphal East", "Porompat"),
        "Shimla" to listOf("Shimla", "शिमला"),
        "Kangra" to listOf("Kangra", "कांगड़ा", "Dharamshala", "धर्मशाला"),
        "Kullu" to listOf("Kullu", "कुल्लू", "Manali", "मनाली"),
        "Mandi" to listOf("Mandi", "मंडी"),
        "Solan" to listOf("Solan", "सोलन", "Baddi"),
        "Ahmedabad" to listOf("Ahmedabad", "અમદાવાદ", "अहमदाबाद"),
        "Surat" to listOf("Surat", "સુરત", "सूरत"),
        "Vadodara" to listOf("Vadodara", "વડોદરા", "Baroda", "वडोदरा"),
        "Rajkot" to listOf("Rajkot", "રાજકોટ", "राजकोट"),
        "Gandhinagar" to listOf("Gandhinagar", "ગાંધીનગર", "गांधीनगर"),
        "Bhavnagar" to listOf("Bhavnagar", "ભાવનગર"),
        "Jamnagar" to listOf("Jamnagar", "જામનગર"),
        "Junagadh" to listOf("Junagadh", "જૂનાગઢ"),
        "Kutch" to listOf("Kutch", "Kachchh", "Bhuj", "કચ્છ", "ભુજ"),
        "Valsad" to listOf("Valsad", "વલસાડ", "Vapi", "વાપી"),
        "Devbhoomi Dwarka" to listOf("Devbhoomi Dwarka", "Dwarka", "દ્વારકા"),
        "Gir Somnath" to listOf("Gir Somnath", "Veraval", "Somnath", "સોમનાથ")
    )

    /**
     * 3-Tier Constituency -> Sub-District (Tehsil/Taluka/Sub-Division) hierarchy for expansion states.
     * Ensures Mandal/Tehsil -> Assembly Constituency -> District local feed ordering works identically across all 9 states.
     */
    val EXPANSION_CONSTITUENCY_MAP: Map<String, Map<String, List<String>>> = mapOf(
        // UP
        "Lucknow" to mapOf(
            "Lucknow Central" to listOf("Lucknow Sadar", "Hazratganj"),
            "Bakshi Ka Talab" to listOf("Bakshi Ka Talab"),
            "Mohanlalganj" to listOf("Mohanlalganj"),
            "Malihabad" to listOf("Malihabad"),
            "Sarojini Nagar" to listOf("Sarojini Nagar")
        ),
        "Varanasi" to mapOf(
            "Varanasi Cantt" to listOf("Varanasi Sadar"),
            "Pindra" to listOf("Pindra"),
            "Rohaniya" to listOf("Raja Talab")
        ),
        "Gautam Buddha Nagar" to mapOf(
            "Noida" to listOf("Dadri", "Noida"),
            "Jewar" to listOf("Jewar")
        ),
        "Prayagraj" to mapOf(
            "Phulpur" to listOf("Phulpur", "Soraon"),
            "Prayagraj North" to listOf("Sadar", "Karchhana"),
            "Meja" to listOf("Meja", "Koraon", "Handia", "Bara")
        ),
        "Ayodhya" to mapOf(
            "Ayodhya" to listOf("Sohawal", "Ayodhya Sadar"),
            "Bikapur" to listOf("Bikapur", "Milkipur", "Rudauli")
        ),
        // Punjab
        "Amritsar" to mapOf(
            "Amritsar North" to listOf("Amritsar I", "Amritsar II"),
            "Ajnala" to listOf("Ajnala", "Lopoke"),
            "Baba Bakala" to listOf("Baba Bakala", "Majitha")
        ),
        "Ludhiana" to mapOf(
            "Ludhiana East" to listOf("Ludhiana East", "Ludhiana West"),
            "Khanna" to listOf("Khanna", "Samrala", "Payal"),
            "Jagraon" to listOf("Jagraon", "Raikot")
        ),
        "Jalandhar" to mapOf(
            "Jalandhar Central" to listOf("Jalandhar I", "Jalandhar II"),
            "Phillaur" to listOf("Phillaur", "Nakodar", "Shahkot")
        ),
        "Patiala" to mapOf(
            "Patiala Urban" to listOf("Patiala"),
            "Rajpura" to listOf("Rajpura", "Ghanaur"),
            "Nabha" to listOf("Nabha", "Samana", "Patran")
        ),
        "Sahibzada Ajit Singh Nagar" to mapOf(
            "SAS Nagar" to listOf("Mohali"),
            "Kharar" to listOf("Kharar"),
            "Dera Bassi" to listOf("Dera Bassi")
        ),
        // Uttarakhand
        "Dehradun" to mapOf(
            "Dehradun Cantt" to listOf("Dehradun", "Doiwala"),
            "Rishikesh" to listOf("Rishikesh"),
            "Vikasnagar" to listOf("Vikasnagar", "Chakrata", "Kalsi", "Tyuni")
        ),
        "Haridwar" to mapOf(
            "Haridwar" to listOf("Haridwar"),
            "Roorkee" to listOf("Roorkee", "Bhagwanpur"),
            "Laksar" to listOf("Laksar")
        ),
        "Nainital" to mapOf(
            "Nainital" to listOf("Nainital", "Bhimtal", "Dhari"),
            "Haldwani" to listOf("Haldwani", "Lalkuan", "Kaladhungi", "Ramnagar")
        ),
        // Goa (all 12 Talukas)
        "North Goa" to mapOf(
            "Panaji" to listOf("Tiswadi"),
            "Mapusa" to listOf("Bardez"),
            "Pernem" to listOf("Pernem"),
            "Bicholim" to listOf("Bicholim"),
            "Valpoi" to listOf("Sattari"),
            "Ponda" to listOf("Ponda")
        ),
        "South Goa" to mapOf(
            "Margao" to listOf("Salcete"),
            "Vasco Da Gama" to listOf("Mormugao"),
            "Quepem" to listOf("Quepem"),
            "Sanguem" to listOf("Sanguem"),
            "Canacona" to listOf("Canacona"),
            "Sanvordem" to listOf("Dharbandora")
        ),
        // Manipur
        "Imphal West" to mapOf(
            "Thangmeiband" to listOf("Lamphelpat", "Patsoi"),
            "Wangoi" to listOf("Wangoi", "Lamsang")
        ),
        "Imphal East" to mapOf(
            "Wangkhei" to listOf("Porompat", "Keirao Bitra", "Sawombung")
        ),
        "Bishnupur" to mapOf(
            "Moirang" to listOf("Moirang", "Bishnupur", "Nambol")
        ),
        "Thoubal" to mapOf(
            "Thoubal" to listOf("Thoubal", "Lilong")
        ),
        // Himachal Pradesh
        "Shimla" to mapOf(
            "Shimla" to listOf("Shimla Urban", "Shimla Rural"),
            "Theog" to listOf("Theog", "Chopal", "Rohru", "Rampur")
        ),
        "Kangra" to mapOf(
            "Dharamshala" to listOf("Dharamshala", "Kangra", "Shahpur"),
            "Palampur" to listOf("Palampur", "Baijnath", "Nurpur", "Dehra")
        ),
        "Kullu" to mapOf(
            "Manali" to listOf("Manali", "Kullu", "Banjar", "Anni")
        ),
        "Solan" to mapOf(
            "Solan" to listOf("Solan", "Kasauli", "Arki"),
            "Nalagarh" to listOf("Nalagarh", "Baddi")
        ),
        // Gujarat
        "Ahmedabad" to mapOf(
            "Ellisbridge" to listOf("Ahmedabad City", "Daskroi"),
            "Sanand" to listOf("Sanand", "Bavla", "Dholka", "Viramgam", "Dhandhuka")
        ),
        "Surat" to mapOf(
            "Majura" to listOf("Surat City", "Chorasi"),
            "Bardoli" to listOf("Bardoli", "Kamrej", "Olpad", "Mandvi", "Mangrol", "Mahuva", "Palsana")
        ),
        "Vadodara" to mapOf(
            "Vadodara City" to listOf("Vadodara", "Padra"),
            "Savli" to listOf("Savli", "Waghodia", "Dabhoi", "Karjan", "Sinor")
        ),
        "Rajkot" to mapOf(
            "Rajkot West" to listOf("Rajkot", "Lodhika", "Kotda Sangani"),
            "Gondal" to listOf("Gondal", "Jetpur", "Dhoraji", "Upleta", "Jasdan")
        ),
        "Kutch" to mapOf(
            "Bhuj" to listOf("Bhuj", "Nakhatrana", "Mandvi", "Mundra"),
            "Gandhidham" to listOf("Gandhidham", "Anjar", "Bhachau", "Rapar")
        ),
        "Valsad" to mapOf(
            "Valsad" to listOf("Valsad", "Dharampur", "Kaprada"),
            "Pardi" to listOf("Vapi", "Pardi", "Umbergaon")
        )
    )

    /**
     * Strictly enforces State-Bound Languages:
     * Gujarat (GJ) ONLY allows Gujarati or English (never Telugu).
     * AP / TS ONLY allow Telugu or English.
     */
    fun validateLanguageForState(stateCode: StateCode, requested: Language?): Language {
        val edition = EDITIONS[stateCode] ?: EDITIONS[StateCode.AP]!!
        if (requested != null && edition.supportedLanguages.contains(requested)) {
            return requested
        }
        return edition.primaryLanguage
    }

    /**
     * Resolves the target Firestore collection for an edition.
     * AP & TS ALWAYS return "news" (100% backward compatible with 98,000+ legacy articles).
     */
    fun getCollectionForEdition(stateCode: StateCode?, language: Language?): String {
        val resolved = stateCode ?: StateCode.AP
        if (resolved == StateCode.AP || resolved == StateCode.TS) {
            return "news"
        }
        val validLang = validateLanguageForState(resolved, language)
        return when (validLang) {
            Language.HINDI -> "news_hi"
            Language.PUNJABI -> "news_pa"
            Language.GUJARATI -> "news_gu"
            Language.ENGLISH -> "news_en"
            Language.TELUGU -> "news"
        }
    }

    /**
     * Resolves the Firestore collection that owns an already-loaded NewsPost (for likes/shares/polls).
     */
    fun getCollectionForPost(post: NewsPost): String {
        val st = resolveStateCode(post.stateCode ?: post.state, post.district)
        val lang = post.language?.let { Language.fromCode(it) }
        return getCollectionForEdition(st, lang)
    }

    /**
     * Resolves any state string/alias or district name into a canonical StateCode.
     */
    fun resolveStateCode(rawState: String?, rawDistrict: String? = null): StateCode? {
        if (!rawState.isNullOrBlank()) {
            StateCode.fromCode(rawState)?.let { return it }
            val clean = rawState.trim()
            for (ed in ALL_EDITIONS_LIST) {
                if (ed.nameEn.equals(clean, ignoreCase = true) ||
                    ed.nameNative.equals(clean, ignoreCase = true) ||
                    ed.stateAliases.any { it.equals(clean, ignoreCase = true) }
                ) {
                    return ed.stateCode
                }
            }
        }

        if (!rawDistrict.isNullOrBlank()) {
            val cleanDist = rawDistrict.trim()
            for (ed in ALL_EDITIONS_LIST) {
                if (ed.districts.any { it.equals(cleanDist, ignoreCase = true) }) {
                    return ed.stateCode
                }
            }
            // Check AP/TS identifiers
            if (Constants.TS_IDENTIFIERS.any { it.equals(cleanDist, ignoreCase = true) }) return StateCode.TS
            if (Constants.AP_IDENTIFIERS.any { it.equals(cleanDist, ignoreCase = true) }) return StateCode.AP

            // Check expansion district aliases
            for ((canonicalDist, aliases) in EXPANSION_DISTRICT_ALIASES) {
                if (aliases.any { it.equals(cleanDist, ignoreCase = true) }) {
                    return resolveStateCode(null, canonicalDist)
                }
            }
        }
        return null
    }

    fun getStateFirestoreAliases(stateCode: StateCode): List<String> {
        return EDITIONS[stateCode]?.stateAliases?.take(10) ?: listOf(stateCode.code)
    }

    fun isExpansionDistrict(district: String?): Boolean {
        if (district.isNullOrBlank()) return false
        val clean = district.trim()
        if (ALL_EXPANSION_DISTRICTS.any { it.equals(clean, ignoreCase = true) }) return true
        return EXPANSION_DISTRICT_ALIASES.values.any { aliases ->
            aliases.any { it.equals(clean, ignoreCase = true) }
        }
    }

    fun getExpansionDistrictAliases(district: String?): List<String> {
        if (district.isNullOrBlank()) return emptyList()
        val clean = district.trim()
        for ((canonical, aliases) in EXPANSION_DISTRICT_ALIASES) {
            if (canonical.equals(clean, ignoreCase = true) || aliases.any { it.equals(clean, ignoreCase = true) }) {
                return aliases
            }
        }
        return listOf(clean)
    }

    fun getSubDistrictsForDistrict(district: String?, stateCode: StateCode? = null): List<String> {
        if (district.isNullOrBlank()) return emptyList()
        val fromFullCatalog = ExpansionSubDistrictData.getSubDistricts(district, stateCode)
        if (fromFullCatalog.isNotEmpty()) return fromFullCatalog
        val map = EXPANSION_CONSTITUENCY_MAP[district]
            ?: EXPANSION_CONSTITUENCY_MAP.entries.firstOrNull { it.key.equals(district, ignoreCase = true) }?.value
            ?: return listOf("$district Sadar", "$district Rural")
        return map.values.flatten().distinct()
    }

    /**
     * Initial GPS coordinate suggestion ONLY (user can freely pick any state manually regardless of physical GPS).
     */
    fun suggestStateFromCoords(lat: Double, lon: Double): StateCode? {
        return when {
            lat in 12.6..19.2 && lon in 76.7..84.8 -> if (lat >= 15.8 && lon <= 81.3) StateCode.TS else StateCode.AP
            lat in 23.8..30.4 && lon in 77.0..84.7 -> StateCode.UP
            lat in 29.5..32.6 && lon in 73.8..76.9 -> StateCode.PB
            lat in 28.7..31.5 && lon in 77.5..81.1 -> StateCode.UK
            lat in 14.8..15.8 && lon in 73.6..74.4 -> StateCode.GA
            lat in 23.8..25.7 && lon in 93.0..94.8 -> StateCode.MN
            lat in 30.3..33.3 && lon in 75.5..79.1 -> StateCode.HP
            lat in 20.1..24.7 && lon in 68.1..74.5 -> StateCode.GJ
            else -> null
        }
    }
}
