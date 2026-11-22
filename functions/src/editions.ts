/**
 * Alfa News Backend Edition Registry (9 States × 5 Languages)
 * Strict State-Bound Languages:
 * - AP, TS  -> te, en   -> collection 'news' (100% untouched for 98K+ legacy docs)
 * - UP, UK, HP -> hi, en -> 'news_hi' (or 'news_en' when English)
 * - PB      -> pa, hi, en -> 'news_pa' (or 'news_hi' / 'news_en')
 * - GJ      -> gu, en   -> 'news_gu' (or 'news_en')
 * - GA, MN  -> en, hi   -> 'news_en' (or 'news_hi')
 */

export type StateCode = 'AP' | 'TS' | 'UP' | 'PB' | 'UK' | 'GA' | 'MN' | 'HP' | 'GJ';
export type LanguageCode = 'te' | 'hi' | 'pa' | 'gu' | 'en';
export type NewsCollectionName = 'news' | 'news_hi' | 'news_pa' | 'news_gu' | 'news_en';

export const ALL_STATE_CODES: StateCode[] = ['AP', 'TS', 'UP', 'PB', 'UK', 'GA', 'MN', 'HP', 'GJ'];
export const ALL_NEWS_COLLECTIONS: NewsCollectionName[] = ['news', 'news_hi', 'news_pa', 'news_gu', 'news_en'];
export const EXPANSION_NEWS_COLLECTIONS: NewsCollectionName[] = ['news_hi', 'news_pa', 'news_gu', 'news_en'];

export interface BackendEditionConfig {
  stateCode: StateCode;
  nameEn: string;
  nameNative: string;
  primaryLanguage: LanguageCode;
  supportedLanguages: LanguageCode[];
  firestoreCollection: NewsCollectionName;
  stateAliases: string[];
  subDistrictLabel: string;
  districts: string[];
}

export const EDITIONS: Record<StateCode, BackendEditionConfig> = {
  AP: {
    stateCode: 'AP',
    nameEn: 'Andhra Pradesh',
    nameNative: 'ఆంధ్రప్రదేశ్',
    primaryLanguage: 'te',
    supportedLanguages: ['te', 'en'],
    firestoreCollection: 'news',
    stateAliases: ['AP', 'Andhra Pradesh', 'Andhra', 'ఆంధ్రప్రదేశ్', 'ఆంధ్ర', 'ఏపీ'],
    subDistrictLabel: 'Mandal',
    districts: [
      'అల్లూరి సీతారామరాజు', 'అనకాపల్లి', 'అనంతపురం', 'అన్నమయ్య', 'బాపట్ల', 'చిత్తూరు', 'కోనసీమ',
      'తూర్పు గోదావరి', 'ఏలూరు', 'గుంటూరు', 'కాకినాడ', 'కృష్ణా', 'కర్నూలు', 'నంద్యాల', 'ఎన్టీఆర్',
      'పల్నాడు', 'పార్వతీపురం మన్యం', 'ప్రకాశం', 'మార్కాపురం', 'పోలవరం', 'మదనపల్లె',
      'శ్రీ పొట్టి శ్రీరాములు నెల్లూరు', 'శ్రీ సత్యసాయి', 'శ్రీకాకుళం', 'తిరుపతి', 'విశాఖపట్నం',
      'విజయనగరం', 'పశ్చిమ గోదావరి', 'వైఎస్ఆర్ కడప'
    ]
  },
  TS: {
    stateCode: 'TS',
    nameEn: 'Telangana',
    nameNative: 'తెలంగాణ',
    primaryLanguage: 'te',
    supportedLanguages: ['te', 'en'],
    firestoreCollection: 'news',
    stateAliases: ['TS', 'TG', 'Telangana', 'తెలంగాణ', 'టీఎస్', 'టిఎస్'],
    subDistrictLabel: 'Mandal',
    districts: [
      'ఆదిలాబాద్', 'భద్రాద్రి కొత్తగూడెం', 'హన్మకొండ', 'హైదరాబాద్', 'జగిత్యాల', 'జనగాం',
      'జయశంకర్ భూపాలపల్లి', 'జోగులాంబ గద్వాల', 'కామారెడ్డి', 'కరీంనగర్', 'ఖమ్మం',
      'కుమ్రం భీమ్ ఆసిఫాబాద్', 'మహబూబాబాద్', 'మహబూబ్ నగర్', 'మంచిర్యాల', 'మెదక్',
      'మేడ్చల్ మల్కాజిగిరి', 'ములుగు', 'నాగర్ కర్నూల్', 'నల్గొండ', 'నారాయణపేట', 'నిర్మల్',
      'నిజామాబాద్', 'పెద్దపల్లి', 'రాజన్న సిరిసిల్ల', 'రంగారెడ్డి', 'సంగారెడ్డి', 'సిద్దిపేట',
      'సూర్యాపేట', 'వికారాబాద్', 'వనపర్తి', 'వరంగల్', 'యాదాద్రి భువనగిరి'
    ]
  },
  UP: {
    stateCode: 'UP',
    nameEn: 'Uttar Pradesh',
    nameNative: 'उत्तर प्रदेश',
    primaryLanguage: 'hi',
    supportedLanguages: ['hi', 'en'],
    firestoreCollection: 'news_hi',
    stateAliases: ['UP', 'Uttar Pradesh', 'उत्तर प्रदेश', 'यूपी'],
    subDistrictLabel: 'Tehsil',
    districts: [
      'Agra', 'Aligarh', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya', 'Ayodhya', 'Azamgarh',
      'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti',
      'Bhadohi', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah',
      'Etawah', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur',
      'Gonda', 'Gorakhpur', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Jhansi',
      'Kannauj', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kaushambi', 'Kushinagar', 'Lakhimpur Kheri',
      'Lalitpur', 'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 'Mau', 'Meerut', 'Mirzapur',
      'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Pratapgarh', 'Prayagraj', 'Raebareli', 'Rampur',
      'Saharanpur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shamli', 'Shravasti', 'Siddharthnagar',
      'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi'
    ]
  },
  PB: {
    stateCode: 'PB',
    nameEn: 'Punjab',
    nameNative: 'ਪੰਜਾਬ',
    primaryLanguage: 'pa',
    supportedLanguages: ['pa', 'hi', 'en'],
    firestoreCollection: 'news_pa',
    stateAliases: ['PB', 'Punjab', 'ਪੰਜਾਬ', 'पंजाब'],
    subDistrictLabel: 'Tehsil',
    districts: [
      'Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Ferozepur',
      'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana', 'Malerkotla', 'Mansa',
      'Moga', 'Pathankot', 'Patiala', 'Rupnagar', 'Sahibzada Ajit Singh Nagar', 'Sangrur',
      'Shahid Bhagat Singh Nagar', 'Sri Muktsar Sahib', 'Tarn Taran'
    ]
  },
  UK: {
    stateCode: 'UK',
    nameEn: 'Uttarakhand',
    nameNative: 'उत्तराखंड',
    primaryLanguage: 'hi',
    supportedLanguages: ['hi', 'en'],
    firestoreCollection: 'news_hi',
    stateAliases: ['UK', 'UT', 'Uttarakhand', 'उत्तराखंड', 'उत्तराखण्ड'],
    subDistrictLabel: 'Tehsil',
    districts: [
      'Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haridwar', 'Nainital',
      'Pauri Garhwal', 'Pithoragarh', 'Rudraprayag', 'Tehri Garhwal', 'Udham Singh Nagar', 'Uttarkashi'
    ]
  },
  GA: {
    stateCode: 'GA',
    nameEn: 'Goa',
    nameNative: 'Goa',
    primaryLanguage: 'en',
    supportedLanguages: ['en', 'hi'],
    firestoreCollection: 'news_en',
    stateAliases: ['GA', 'Goa', 'गोवा'],
    subDistrictLabel: 'Taluka',
    districts: ['North Goa', 'South Goa']
  },
  MN: {
    stateCode: 'MN',
    nameEn: 'Manipur',
    nameNative: 'Manipur',
    primaryLanguage: 'en',
    supportedLanguages: ['en', 'hi'],
    firestoreCollection: 'news_en',
    stateAliases: ['MN', 'Manipur', 'मणिपुर'],
    subDistrictLabel: 'Sub-Division',
    districts: [
      'Bishnupur', 'Chandel', 'Churachandpur', 'Imphal East', 'Imphal West', 'Jiribam', 'Kakching',
      'Kamjong', 'Kangpokpi', 'Noney', 'Pherzawl', 'Senapati', 'Tamenglong', 'Tengnoupal', 'Thoubal', 'Ukhrul'
    ]
  },
  HP: {
    stateCode: 'HP',
    nameEn: 'Himachal Pradesh',
    nameNative: 'हिमाचल प्रदेश',
    primaryLanguage: 'hi',
    supportedLanguages: ['hi', 'en'],
    firestoreCollection: 'news_hi',
    stateAliases: ['HP', 'Himachal Pradesh', 'Himachal', 'हिमाचल प्रदेश', 'हिमाचल'],
    subDistrictLabel: 'Tehsil',
    districts: [
      'Bilaspur', 'Chamba', 'Hamirpur', 'Kangra', 'Kinnaur', 'Kullu',
      'Lahaul and Spiti', 'Mandi', 'Shimla', 'Sirmaur', 'Solan', 'Una'
    ]
  },
  GJ: {
    stateCode: 'GJ',
    nameEn: 'Gujarat',
    nameNative: 'ગુજરાત',
    primaryLanguage: 'gu',
    supportedLanguages: ['gu', 'en'],
    firestoreCollection: 'news_gu',
    stateAliases: ['GJ', 'Gujarat', 'ગુજરાત', 'गुजरात'],
    subDistrictLabel: 'Taluka',
    districts: [
      'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 'Botad',
      'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka', 'Gandhinagar', 'Gir Somnath', 'Jamnagar',
      'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 'Navsari', 'Panchmahal',
      'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'
    ]
  }
};

export const EXPANSION_DISTRICT_ALIASES: Record<string, string> = {
  // UP native / common aliases
  'लखनऊ': 'Lucknow', 'वाराणसी': 'Varanasi', 'काशी': 'Varanasi', 'बनारस': 'Varanasi',
  'प्रयागराज': 'Prayagraj', 'इलाहाबाद': 'Prayagraj', 'allahabad': 'Prayagraj',
  'अयोध्या': 'Ayodhya', 'फैजाबाद': 'Ayodhya', 'faizabad': 'Ayodhya',
  'आगरा': 'Agra', 'कानपुर': 'Kanpur Nagar', 'kanpur': 'Kanpur Nagar',
  'नोएडा': 'Gautam Buddha Nagar', 'noida': 'Gautam Buddha Nagar', 'greater noida': 'Gautam Buddha Nagar',
  'गाजियाबाद': 'Ghaziabad', 'मेरठ': 'Meerut', 'गोरखपुर': 'Gorakhpur', 'मथुरा': 'Mathura',
  'बरेली': 'Bareilly', 'अलीगढ़': 'Aligarh', 'झांसी': 'Jhansi', 'मुरादाबाद': 'Moradabad',
  'सहारनपुर': 'Saharanpur', 'आजमगढ़': 'Azamgarh', 'मिर्जापुर': 'Mirzapur',
  // Punjab
  'ਅੰਮ੍ਰਿਤਸਰ': 'Amritsar', 'अमृतसर': 'Amritsar',
  'ਲੁਧਿਆਣਾ': 'Ludhiana', 'लुधियाना': 'Ludhiana',
  'ਜਲੰਧਰ': 'Jalandhar', 'जालंधर': 'Jalandhar',
  'ਪਟਿਆਲਾ': 'Patiala', 'पटियाला': 'Patiala',
  'ਬਠਿੰਡਾ': 'Bathinda', 'बठिंडा': 'Bathinda',
  'ਮੋਹਾਲੀ': 'Sahibzada Ajit Singh Nagar', 'mohali': 'Sahibzada Ajit Singh Nagar', 'sas nagar': 'Sahibzada Ajit Singh Nagar',
  'ਨਵਾਂਸ਼ਹਿਰ': 'Shahid Bhagat Singh Nagar', 'nawanshahr': 'Shahid Bhagat Singh Nagar', 'sbs nagar': 'Shahid Bhagat Singh Nagar',
  'ਰੋਪੜ': 'Rupnagar', 'ropar': 'Rupnagar',
  'ਮੁਕਤਸਰ': 'Sri Muktsar Sahib', 'muktsar': 'Sri Muktsar Sahib',
  // Uttarakhand
  'देहरादून': 'Dehradun', 'हरिद्वार': 'Haridwar', 'नैनीताल': 'Nainital', 'हल्द्वानी': 'Nainital', 'haldwani': 'Nainital',
  'अल्मोड़ा': 'Almora', 'पौड़ी': 'Pauri Garhwal', 'टिहरी': 'Tehri Garhwal', 'रुद्रपुर': 'Udham Singh Nagar', 'rudrapur': 'Udham Singh Nagar',
  'ऋषिकेश': 'Dehradun', 'rishikesh': 'Dehradun', 'रूड़की': 'Haridwar', 'roorkee': 'Haridwar',
  // Goa
  'panaji': 'North Goa', 'panjim': 'North Goa', 'mapusa': 'North Goa', 'ponda': 'North Goa',
  'margao': 'South Goa', 'madgaon': 'South Goa', 'vasco': 'South Goa', 'vasco da gama': 'South Goa',
  // Manipur
  'imphal': 'Imphal West', 'lamphel': 'Imphal West', 'porompat': 'Imphal East', 'moirang': 'Bishnupur',
  // Himachal Pradesh
  'शिमला': 'Shimla', 'कांगड़ा': 'Kangra', 'धर्मशाला': 'Kangra', 'dharamshala': 'Kangra',
  'मंडी': 'Mandi', 'कुल्लू': 'Kullu', 'मनाली': 'Kullu', 'manali': 'Kullu',
  'सोलन': 'Solan', 'चंबा': 'Chamba', 'ऊना': 'Una', 'हमीरपुर': 'Hamirpur', 'बिलासपुर': 'Bilaspur',
  // Gujarat
  'અમદાવાદ': 'Ahmedabad', 'अहमदाबाद': 'Ahmedabad',
  'સુરત': 'Surat', 'सूरत': 'Surat',
  'વડોદરા': 'Vadodara', 'वडोदरा': 'Vadodara', 'baroda': 'Vadodara',
  'રાજકોટ': 'Rajkot', 'राजकोट': 'Rajkot',
  'ગાંધીનગર': 'Gandhinagar', 'गांधीनगर': 'Gandhinagar',
  'ભાવનગર': 'Bhavnagar', 'જામનગર': 'Jamnagar', 'જૂનાગઢ': 'Junagadh',
  'કચ્છ': 'Kutch', 'bhuj': 'Kutch', 'ભુજ': 'Kutch', 'kachchh': 'Kutch',
  'આણંદ': 'Anand', 'મહેસાણા': 'Mehsana', 'ભરૂચ': 'Bharuch', 'નવસારી': 'Navsari', 'વલસાડ': 'Valsad', 'vapi': 'Valsad',
  'દ્વારકા': 'Devbhoomi Dwarka', 'dwarka': 'Devbhoomi Dwarka', 'સોમનાથ': 'Gir Somnath', 'veraval': 'Gir Somnath',
  'પાલનપુર': 'Banaskantha', 'palanpur': 'Banaskantha', 'હિંમતનગર': 'Sabarkantha', 'ગોધરા': 'Panchmahal', 'godhra': 'Panchmahal',
};

export interface ExpansionSubDistrictEntry {
  stateCode: StateCode;
  district: string;
  subDistrict: string;
  constituency?: string;
  keywords: string[];
}

/**
 * Representative Tehsil/Taluka/Sub-Division lookup for cross-mandal reporter attribution
 * and location extraction in the 7 expansion states (complements dynamic normalized matching).
 */
export const EXPANSION_SUBDISTRICT_LOOKUP: ExpansionSubDistrictEntry[] = [
  // UP
  { stateCode: 'UP', district: 'Lucknow', subDistrict: 'Lucknow Sadar', constituency: 'Lucknow Central', keywords: ['lucknow sadar', 'लखनऊ सदर', 'hazratganj', 'gomti nagar'] },
  { stateCode: 'UP', district: 'Lucknow', subDistrict: 'Bakshi Ka Talab', constituency: 'Bakshi Ka Talab', keywords: ['bakshi ka talab', 'bkt', 'बख्शी का तालाब'] },
  { stateCode: 'UP', district: 'Lucknow', subDistrict: 'Mohanlalganj', constituency: 'Mohanlalganj', keywords: ['mohanlalganj', 'मोहनलालगंज'] },
  { stateCode: 'UP', district: 'Lucknow', subDistrict: 'Malihabad', constituency: 'Malihabad', keywords: ['malihabad', 'मलिहाबाद'] },
  { stateCode: 'UP', district: 'Lucknow', subDistrict: 'Sarojini Nagar', constituency: 'Sarojini Nagar', keywords: ['sarojini nagar', 'सरोजिनी नगर'] },
  { stateCode: 'UP', district: 'Varanasi', subDistrict: 'Varanasi Sadar', constituency: 'Varanasi Cantt', keywords: ['varanasi sadar', 'वाराणसी सदर', 'kashi'] },
  { stateCode: 'UP', district: 'Varanasi', subDistrict: 'Pindra', constituency: 'Pindra', keywords: ['pindra', 'पिंडरा'] },
  { stateCode: 'UP', district: 'Varanasi', subDistrict: 'Raja Talab', constituency: 'Rohaniya', keywords: ['raja talab', 'rajatalab', 'राजातालाब'] },
  { stateCode: 'UP', district: 'Gautam Buddha Nagar', subDistrict: 'Dadri', constituency: 'Dadri', keywords: ['dadri', 'दादरी', 'noida', 'नोएडा'] },
  { stateCode: 'UP', district: 'Gautam Buddha Nagar', subDistrict: 'Jewar', constituency: 'Jewar', keywords: ['jewar', 'जेवर'] },
  { stateCode: 'UP', district: 'Prayagraj', subDistrict: 'Phulpur', constituency: 'Phulpur', keywords: ['phulpur', 'फूलपुर'] },
  { stateCode: 'UP', district: 'Prayagraj', subDistrict: 'Soraon', constituency: 'Soraon', keywords: ['soraon', 'सोरांव'] },
  { stateCode: 'UP', district: 'Ayodhya', subDistrict: 'Sohawal', constituency: 'Ayodhya', keywords: ['sohawal', 'सोहावल', 'ayodhya', 'अयोध्या'] },
  { stateCode: 'UP', district: 'Ayodhya', subDistrict: 'Bikapur', constituency: 'Bikapur', keywords: ['bikapur', 'बीकापुर'] },
  { stateCode: 'UP', district: 'Gorakhpur', subDistrict: 'Campierganj', constituency: 'Campierganj', keywords: ['campierganj', 'कैंपियरगंज'] },
  { stateCode: 'UP', district: 'Gorakhpur', subDistrict: 'Chauri Chaura', constituency: 'Chauri Chaura', keywords: ['chauri chaura', 'चौरी चौरा'] },
  // Punjab
  { stateCode: 'PB', district: 'Amritsar', subDistrict: 'Amritsar I', constituency: 'Amritsar North', keywords: ['amritsar i', 'amritsar 1', 'ਅੰਮ੍ਰਿਤਸਰ 1'] },
  { stateCode: 'PB', district: 'Amritsar', subDistrict: 'Ajnala', constituency: 'Ajnala', keywords: ['ajnala', 'ਅਜਨਾਲਾ'] },
  { stateCode: 'PB', district: 'Amritsar', subDistrict: 'Baba Bakala', constituency: 'Baba Bakala', keywords: ['baba bakala', 'ਬਾਬਾ ਬਕਾਲਾ'] },
  { stateCode: 'PB', district: 'Ludhiana', subDistrict: 'Ludhiana East', constituency: 'Ludhiana East', keywords: ['ludhiana east', 'ਲੁਧਿਆਣਾ ਪੂਰਬੀ'] },
  { stateCode: 'PB', district: 'Ludhiana', subDistrict: 'Khanna', constituency: 'Khanna', keywords: ['khanna', 'ਖੰਨਾ'] },
  { stateCode: 'PB', district: 'Ludhiana', subDistrict: 'Jagraon', constituency: 'Jagraon', keywords: ['jagraon', 'ਜਗਰਾਉਂ'] },
  { stateCode: 'PB', district: 'Jalandhar', subDistrict: 'Phillaur', constituency: 'Phillaur', keywords: ['phillaur', 'ਫਿਲੌਰ'] },
  { stateCode: 'PB', district: 'Jalandhar', subDistrict: 'Nakodar', constituency: 'Nakodar', keywords: ['nakodar', 'ਨਕੋਦਰ'] },
  { stateCode: 'PB', district: 'Patiala', subDistrict: 'Rajpura', constituency: 'Rajpura', keywords: ['rajpura', 'ਰਾਜਪੁਰਾ'] },
  { stateCode: 'PB', district: 'Patiala', subDistrict: 'Nabha', constituency: 'Nabha', keywords: ['nabha', 'ਨਾਭਾ'] },
  { stateCode: 'PB', district: 'Sahibzada Ajit Singh Nagar', subDistrict: 'Mohali', constituency: 'SAS Nagar', keywords: ['mohali', 'sas nagar', 'ਮੋਹਾਲੀ'] },
  { stateCode: 'PB', district: 'Sahibzada Ajit Singh Nagar', subDistrict: 'Kharar', constituency: 'Kharar', keywords: ['kharar', 'ਖਰੜ'] },
  { stateCode: 'PB', district: 'Sahibzada Ajit Singh Nagar', subDistrict: 'Dera Bassi', constituency: 'Dera Bassi', keywords: ['dera bassi', 'derabassi', 'ਡੇਰਾ ਬੱਸੀ'] },
  // Uttarakhand
  { stateCode: 'UK', district: 'Dehradun', subDistrict: 'Rishikesh', constituency: 'Rishikesh', keywords: ['rishikesh', 'ऋषिकेश'] },
  { stateCode: 'UK', district: 'Dehradun', subDistrict: 'Vikasnagar', constituency: 'Vikasnagar', keywords: ['vikasnagar', 'विकासनगर'] },
  { stateCode: 'UK', district: 'Dehradun', subDistrict: 'Doiwala', constituency: 'Doiwala', keywords: ['doiwala', 'डोईवाला'] },
  { stateCode: 'UK', district: 'Haridwar', subDistrict: 'Roorkee', constituency: 'Roorkee', keywords: ['roorkee', 'रुड़की'] },
  { stateCode: 'UK', district: 'Haridwar', subDistrict: 'Laksar', constituency: 'Laksar', keywords: ['laksar', 'लक्सर'] },
  { stateCode: 'UK', district: 'Nainital', subDistrict: 'Haldwani', constituency: 'Haldwani', keywords: ['haldwani', 'हल्द्वानी'] },
  { stateCode: 'UK', district: 'Nainital', subDistrict: 'Ramnagar', constituency: 'Ramnagar', keywords: ['ramnagar', 'रामनगर'] },
  // Goa (all 12 Talukas)
  { stateCode: 'GA', district: 'North Goa', subDistrict: 'Tiswadi', constituency: 'Panaji', keywords: ['tiswadi', 'panaji', 'panjim', 'old goa'] },
  { stateCode: 'GA', district: 'North Goa', subDistrict: 'Bardez', constituency: 'Mapusa', keywords: ['bardez', 'mapusa', 'calangute', 'porvorim'] },
  { stateCode: 'GA', district: 'North Goa', subDistrict: 'Pernem', constituency: 'Pernem', keywords: ['pernem', 'mandrem'] },
  { stateCode: 'GA', district: 'North Goa', subDistrict: 'Bicholim', constituency: 'Bicholim', keywords: ['bicholim', 'mayem'] },
  { stateCode: 'GA', district: 'North Goa', subDistrict: 'Sattari', constituency: 'Valpoi', keywords: ['sattari', 'valpoi'] },
  { stateCode: 'GA', district: 'North Goa', subDistrict: 'Ponda', constituency: 'Ponda', keywords: ['ponda', 'marcaim', 'priol'] },
  { stateCode: 'GA', district: 'South Goa', subDistrict: 'Salcete', constituency: 'Margao', keywords: ['salcete', 'margao', 'madgaon', 'fatorda'] },
  { stateCode: 'GA', district: 'South Goa', subDistrict: 'Mormugao', constituency: 'Vasco Da Gama', keywords: ['mormugao', 'vasco', 'dabolim'] },
  { stateCode: 'GA', district: 'South Goa', subDistrict: 'Quepem', constituency: 'Quepem', keywords: ['quepem', 'curchorem'] },
  { stateCode: 'GA', district: 'South Goa', subDistrict: 'Sanguem', constituency: 'Sanguem', keywords: ['sanguem'] },
  { stateCode: 'GA', district: 'South Goa', subDistrict: 'Canacona', constituency: 'Canacona', keywords: ['canacona'] },
  { stateCode: 'GA', district: 'South Goa', subDistrict: 'Dharbandora', constituency: 'Sanvordem', keywords: ['dharbandora', 'sanvordem'] },
  // Manipur
  { stateCode: 'MN', district: 'Imphal West', subDistrict: 'Lamphelpat', constituency: 'Thangmeiband', keywords: ['lamphelpat', 'lamphel', 'imphal west'] },
  { stateCode: 'MN', district: 'Imphal West', subDistrict: 'Wangoi', constituency: 'Wangoi', keywords: ['wangoi', 'mayang imphal'] },
  { stateCode: 'MN', district: 'Imphal East', subDistrict: 'Porompat', constituency: 'Wangkhei', keywords: ['porompat', 'imphal east'] },
  { stateCode: 'MN', district: 'Bishnupur', subDistrict: 'Moirang', constituency: 'Moirang', keywords: ['moirang', 'loktak'] },
  { stateCode: 'MN', district: 'Thoubal', subDistrict: 'Lilong', constituency: 'Lilong', keywords: ['lilong', 'thoubal'] },
  // Himachal Pradesh
  { stateCode: 'HP', district: 'Shimla', subDistrict: 'Shimla Urban', constituency: 'Shimla', keywords: ['shimla urban', 'शिमला शहर', 'shimla'] },
  { stateCode: 'HP', district: 'Shimla', subDistrict: 'Theog', constituency: 'Theog', keywords: ['theog', 'ठियोग'] },
  { stateCode: 'HP', district: 'Shimla', subDistrict: 'Rampur', constituency: 'Rampur', keywords: ['rampur bushahr', 'रामपुर'] },
  { stateCode: 'HP', district: 'Kangra', subDistrict: 'Dharamshala', constituency: 'Dharamshala', keywords: ['dharamshala', 'धर्मशाला'] },
  { stateCode: 'HP', district: 'Kangra', subDistrict: 'Palampur', constituency: 'Palampur', keywords: ['palampur', 'पालमपुर'] },
  { stateCode: 'HP', district: 'Kullu', subDistrict: 'Manali', constituency: 'Manali', keywords: ['manali', 'मनाली'] },
  { stateCode: 'HP', district: 'Mandi', subDistrict: 'Sundernagar', constituency: 'Sundernagar', keywords: ['sundernagar', 'सुंदरनगर'] },
  { stateCode: 'HP', district: 'Solan', subDistrict: 'Nalagarh', constituency: 'Nalagarh', keywords: ['nalagarh', 'नालागढ़', 'baddi'] },
  // Gujarat
  { stateCode: 'GJ', district: 'Ahmedabad', subDistrict: 'Ahmedabad City', constituency: 'Ellisbridge', keywords: ['ahmedabad city', 'અમદાવાદ શહેર', 'maninagar', 'ghatlodia'] },
  { stateCode: 'GJ', district: 'Ahmedabad', subDistrict: 'Daskroi', constituency: 'Daskroi', keywords: ['daskroi', 'દસક્રોઈ'] },
  { stateCode: 'GJ', district: 'Ahmedabad', subDistrict: 'Sanand', constituency: 'Sanand', keywords: ['sanand', 'સાણંદ'] },
  { stateCode: 'GJ', district: 'Ahmedabad', subDistrict: 'Dholka', constituency: 'Dholka', keywords: ['dholka', 'ધોળકા'] },
  { stateCode: 'GJ', district: 'Surat', subDistrict: 'Surat City', constituency: 'Majura', keywords: ['surat city', 'સુરત શહેર', 'katargam', 'varachha'] },
  { stateCode: 'GJ', district: 'Surat', subDistrict: 'Chorasi', constituency: 'Choryasi', keywords: ['chorasi', 'choryasi', 'ચોર્યાસી'] },
  { stateCode: 'GJ', district: 'Surat', subDistrict: 'Bardoli', constituency: 'Bardoli', keywords: ['bardoli', 'બારડોલી'] },
  { stateCode: 'GJ', district: 'Surat', subDistrict: 'Kamrej', constituency: 'Kamrej', keywords: ['kamrej', 'કામરેજ'] },
  { stateCode: 'GJ', district: 'Vadodara', subDistrict: 'Savli', constituency: 'Savli', keywords: ['savli', 'સાવલી'] },
  { stateCode: 'GJ', district: 'Vadodara', subDistrict: 'Padra', constituency: 'Padra', keywords: ['padra', 'પાદરા'] },
  { stateCode: 'GJ', district: 'Rajkot', subDistrict: 'Gondal', constituency: 'Gondal', keywords: ['gondal', 'ગોંડલ'] },
  { stateCode: 'GJ', district: 'Rajkot', subDistrict: 'Jetpur', constituency: 'Jetpur', keywords: ['jetpur', 'જેતપુર'] },
  { stateCode: 'GJ', district: 'Kutch', subDistrict: 'Bhuj', constituency: 'Bhuj', keywords: ['bhuj', 'ભુજ'] },
  { stateCode: 'GJ', district: 'Kutch', subDistrict: 'Gandhidham', constituency: 'Gandhidham', keywords: ['gandhidham', 'ગાંધીધામ'] },
  { stateCode: 'GJ', district: 'Kutch', subDistrict: 'Anjar', constituency: 'Anjar', keywords: ['anjar', 'અંજાર'] },
  { stateCode: 'GJ', district: 'Valsad', subDistrict: 'Vapi', constituency: 'Pardi', keywords: ['vapi', 'વાપી'] },
];

/**
 * Strictly enforce state-bound language selection.
 * Never returns an unsupported language for a state (e.g., GJ never allows 'te').
 */
export function validateLanguageForState(
  stateCode: StateCode,
  requestedLang?: string | null
): LanguageCode {
  const edition = EDITIONS[stateCode] || EDITIONS.AP;
  const candidate = (requestedLang || '').toLowerCase().trim() as LanguageCode;
  if (edition.supportedLanguages.includes(candidate)) {
    return candidate;
  }
  return edition.primaryLanguage;
}

/**
 * Determine target Firestore news collection for an edition.
 * AP & TS ALWAYS return 'news' (100% backward compatible with 98K+ legacy docs).
 */
export function getCollectionForEdition(
  stateCode?: StateCode | string | null,
  language?: LanguageCode | string | null
): NewsCollectionName {
  const resolved = resolveStateCode(stateCode) || 'AP';
  if (resolved === 'AP' || resolved === 'TS') {
    return 'news';
  }
  const validLang = validateLanguageForState(resolved, language);
  switch (validLang) {
    case 'hi': return 'news_hi';
    case 'pa': return 'news_pa';
    case 'gu': return 'news_gu';
    case 'en': return 'news_en';
    default: return EDITIONS[resolved].firestoreCollection;
  }
}

/**
 * Resolve any state name/alias or district name into a canonical 2-letter StateCode.
 */
export function resolveStateCode(
  rawState?: string | null,
  rawDistrict?: string | null
): StateCode | null {
  const s = (rawState || '').trim();
  if (s) {
    const upper = s.toUpperCase();
    if ((ALL_STATE_CODES as string[]).includes(upper)) {
      return upper as StateCode;
    }
    if (upper === 'TG') return 'TS';
    if (upper === 'UT') return 'UK';
    const lower = s.toLowerCase();
    for (const code of ALL_STATE_CODES) {
      if (EDITIONS[code].stateAliases.some((a) => a.toLowerCase() === lower)) {
        return code;
      }
    }
  }

  const d = (rawDistrict || '').trim();
  if (d) {
    const lowerD = d.toLowerCase();
    const mapped = EXPANSION_DISTRICT_ALIASES[d] || EXPANSION_DISTRICT_ALIASES[lowerD] || d;
    const mappedLower = mapped.toLowerCase();
    for (const code of ALL_STATE_CODES) {
      if (EDITIONS[code].districts.some((dist) => dist.toLowerCase() === mappedLower)) {
        return code;
      }
    }
  }
  return null;
}

export function resolveExpansionDistrict(raw?: string | null): { district: string; stateCode: StateCode } | null {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();
  const mapped = EXPANSION_DISTRICT_ALIASES[clean] || EXPANSION_DISTRICT_ALIASES[lower] || clean;
  const mappedLower = mapped.toLowerCase();

  for (const code of ALL_STATE_CODES) {
    if (code === 'AP' || code === 'TS') continue;
    const exact = EDITIONS[code].districts.find((d) => d.toLowerCase() === mappedLower);
    if (exact) return { district: exact, stateCode: code };
  }
  return null;
}

/**
 * Get edition-scoped FCM topic: e.g. edition_hi_up, edition_pa_pb, edition_te_ts
 */
export function getEditionTopic(stateCode: StateCode, language?: LanguageCode | string): string {
  const lang = validateLanguageForState(stateCode, language);
  return `edition_${lang}_${stateCode.toLowerCase()}`;
}

/**
 * Get localized string from multi-language NewsPost map (`headline` / `content` / `fullStory`).
 */
export function getLocalizedField(
  field: any,
  language?: string | null
): string {
  if (!field) return '';
  if (typeof field === 'string') return field.trim();
  const lang = (language || 'te').toLowerCase();
  if (lang === 'en') {
    return (field.english || field.local || field.telugu || field.hi || field.pa || field.gu || '').trim();
  }
  if (lang === 'te') {
    return (field.telugu || field.local || field.english || '').trim();
  }
  return (field[lang] || field.local || field.english || field.telugu || '').trim();
}
