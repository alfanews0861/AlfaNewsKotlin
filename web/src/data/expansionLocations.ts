/**
 * Full 3-Tier Location Hierarchy for the 7 Expansion States:
 * Uttar Pradesh (UP), Punjab (PB), Uttarakhand (UK), Goa (GA),
 * Manipur (MN), Himachal Pradesh (HP), Gujarat (GJ).
 *
 * Structure: StateCode -> District (English Canonical) -> {
 *   nativeName: string,
 *   aliases: string[],
 *   constituencies: Record<AssemblyConstituency, TehsilOrTalukaOrSubDivision[]>
 * }
 *
 * Keeps 100% parity with AP & TS Mandal -> Constituency -> District architecture.
 */

export interface ExpansionDistrictEntry {
  name: string;
  nativeName: string;
  aliases: string[];
  constituencies: Record<string, string[]>;
}

export type ExpansionStateCode = 'UP' | 'UK' | 'HP' | 'PB' | 'GJ' | 'GA' | 'MN';

// Helper to build standard 3-tier district entry cleanly
function dist(
  name: string,
  nativeName: string,
  aliases: string[],
  constituencies: Record<string, string[]>
): ExpansionDistrictEntry {
  return { name, nativeName, aliases, constituencies };
}

export const EXPANSION_LOCATIONS: Record<ExpansionStateCode, ExpansionDistrictEntry[]> = {
  // =========================================================================
  // UTTAR PRADESH (75 Districts · Assembly Constituencies · Tehsils)
  // =========================================================================
  UP: [
    dist('Lucknow', 'लखनऊ', ['लखनऊ', 'lucknow', 'lko'], {
      'Lucknow Central': ['Lucknow Sadar', 'Hazratganj'],
      'Lucknow North': ['Bakshi Ka Talab', 'Aliganj'],
      'Lucknow East': ['Gomti Nagar', 'Chinhat'],
      'Mohanlalganj': ['Mohanlalganj', 'Gosainganj'],
      'Malihabad': ['Malihabad', 'Kakori'],
      'Sarojini Nagar': ['Sarojini Nagar', 'Banthra'],
    }),
    dist('Kanpur Nagar', 'कानपुर नगर', ['कानपुर', 'कानपुर नगर', 'kanpur', 'kanpur nagar'], {
      'Kanpur Cantonment': ['Kanpur Sadar', 'Chakeri'],
      'Govind Nagar': ['Kanpur Sadar', 'Panki'],
      'Bilhaur': ['Bilhaur', 'Shivrajpur'],
      'Ghatampur': ['Ghatampur', 'Patara'],
      'Bithoor': ['Narwal', 'Kalyanpur'],
    }),
    dist('Varanasi', 'वाराणसी', ['वाराणसी', 'बनारस', 'काशी', 'varanasi', 'banaras', 'kashi'], {
      'Varanasi North': ['Varanasi Sadar', 'Shivpur'],
      'Varanasi South': ['Varanasi Sadar', 'Dashashwamedh'],
      'Pindra': ['Pindra', 'Phulpur'],
      'Rohaniya': ['Rajatalab', 'Kashi Vidyapeeth'],
      'Sevapuri': ['Rajatalab', 'Sevapuri'],
    }),
    dist('Prayagraj', 'प्रयागराज', ['प्रयागराज', 'इलाहाबाद', 'prayagraj', 'allahabad'], {
      'Allahabad North': ['Sadar Prayagraj', 'Civil Lines'],
      'Phulpur': ['Phulpur', 'Bahadurpur'],
      'Soraon': ['Soraon', 'Holagarh'],
      'Handia': ['Handia', 'Saidabad'],
      'Karchhana': ['Karchhana', 'Chaka'],
      'Meja': ['Meja', 'Uruwan'],
      'Bara': ['Bara', 'Shankargarh'],
      'Koraon': ['Koraon'],
    }),
    dist('Agra', 'आगरा', ['आगरा', 'agra'], {
      'Agra North': ['Agra Sadar', 'Dayalbagh'],
      'Etmadpur': ['Etmadpur', 'Khandauli'],
      'Fatehabad': ['Fatehabad', 'Shamshabad'],
      'Kheragarh': ['Kheragarh', 'Jagner'],
      'Fatehpur Sikri': ['Kiraoli', 'Achnera'],
      'Bah': ['Bah', 'Pinahat'],
    }),
    dist('Gautam Buddha Nagar', 'गौतम बुद्ध नगर', ['नोएडा', 'ग्रेटर नोएडा', 'गौतम बुद्ध नगर', 'noida', 'greater noida', 'gautam buddha nagar', 'gb nagar'], {
      'Noida': ['Dadri', 'Noida Sector'],
      'Dadri': ['Dadri', 'Bisrakh'],
      'Jewar': ['Jewar', 'Dankaur'],
    }),
    dist('Ghaziabad', 'गाजियाबाद', ['गाजियाबाद', 'गाज़ियाबाद', 'ghaziabad'], {
      'Ghaziabad': ['Ghaziabad Sadar', 'Indirapuram'],
      'Loni': ['Loni'],
      'Muradnagar': ['Modinagar', 'Muradnagar'],
      'Modinagar': ['Modinagar', 'Bhojpur'],
      'Sahibabad': ['Ghaziabad Sadar', 'Vasundhara'],
    }),
    dist('Meerut', 'मेरठ', ['मेरठ', 'meerut'], {
      'Meerut': ['Meerut Sadar'],
      'Sardhana': ['Sardhana', 'Daurala'],
      'Hastinapur': ['Mawana', 'Hastinapur'],
      'Kithore': ['Mawana', 'Parikshitgarh'],
      'Siwalkhas': ['Meerut Sadar', 'Jani'],
    }),
    dist('Gorakhpur', 'गोरखपुर', ['गोरखपुर', 'gorakhpur'], {
      'Gorakhpur Urban': ['Gorakhpur Sadar'],
      'Campierganj': ['Campierganj', 'Jangal Kaudia'],
      'Sahajanwa': ['Sahajanwa', 'Pali'],
      'Khajani': ['Khajani', 'Belghat'],
      'Chauri-Chaura': ['Chauri-Chaura', 'Sardarnagar'],
      'Bansgaon': ['Bansgaon', 'Kauriram'],
      'Chillupar': ['Gola', 'Barhalganj'],
    }),
    dist('Ayodhya', 'अयोध्या', ['अयोध्या', 'फैजाबाद', 'ayodhya', 'faizabad'], {
      'Ayodhya': ['Ayodhya Sadar', 'Faizabad'],
      'Bikapur': ['Bikapur', 'Tarun'],
      'Milkipur': ['Milkipur', 'Amaniganj'],
      'Rudauli': ['Rudauli', 'Mawai'],
      'Goshainganj': ['Sohawal', 'Maya Bazar'],
    }),
    dist('Mathura', 'मथुरा', ['मथुरा', 'वृंदावन', 'mathura', 'vrindavan'], {
      'Mathura': ['Mathura Sadar', 'Vrindavan'],
      'Chhata': ['Chhata', 'Kosi Kalan'],
      'Mant': ['Mant', 'Naujhil'],
      'Goverdhan': ['Goverdhan', 'Sonkh'],
      'Baldev': ['Mahavan', 'Raya'],
    }),
    dist('Bareilly', 'बरेली', ['बरेली', 'bareilly'], {
      'Bareilly': ['Bareilly Sadar'],
      'Baheri': ['Baheri', 'Shergarh'],
      'Meerganj': ['Meerganj', 'Fatehganj West'],
      'Nawabganj': ['Nawabganj', 'Bhadpura'],
      'Faridpur': ['Faridpur', 'Bhuta'],
      'Aonla': ['Aonla', 'Ramnagar'],
    }),
    dist('Aligarh', 'अलीगढ़', ['अलीगढ़', 'aligarh'], {
      'Aligarh': ['Koil'],
      'Khair': ['Khair', 'Tappal'],
      'Atrauli': ['Atrauli', 'Gangiri'],
      'Iglas': ['Iglas', 'Gonda'],
      'Chharra': ['Atrauli', 'Dhanipur'],
      'Barauli': ['Gabhana', 'Jawan'],
    }),
    dist('Moradabad', 'मुरादाबाद', ['मुरादाबाद', 'moradabad'], {
      'Moradabad Nagar': ['Moradabad Sadar'],
      'Kanth': ['Kanth', 'Chhajlet'],
      'Thakurdwara': ['Thakurdwara', 'Dilari'],
      'Bilari': ['Bilari', 'Kundarki'],
    }),
    dist('Saharanpur', 'सहारनपुर', ['सहारनपुर', 'saharanpur'], {
      'Saharanpur Nagar': ['Saharanpur Sadar'],
      'Behat': ['Behat', 'Muzaffarabad'],
      'Nakur': ['Nakur', 'Sarsawa'],
      'Deoband': ['Deoband', 'Nagal'],
      'Rampur Maniharan': ['Rampur Maniharan', 'Nanauta'],
    }),
    dist('Jhansi', 'झांसी', ['झांसी', 'झाँसी', 'jhansi'], {
      'Jhansi Nagar': ['Jhansi Sadar'],
      'Babina': ['Jhansi Sadar', 'Baragaon'],
      'Mauranipur': ['Mauranipur', 'Bangra'],
      'Garautha': ['Garautha', 'Moth', 'Tahrauli'],
    }),
    dist('Muzaffarnagar', 'मुजफ्फरनगर', ['मुजफ्फरनगर', 'muzaffarnagar'], {
      'Muzaffarnagar': ['Muzaffarnagar Sadar'],
      'Budhana': ['Budhana', 'Shahpur'],
      'Khatauli': ['Khatauli', 'Jansath'],
      'Charthawal': ['Muzaffarnagar Sadar', 'Baghra'],
    }),
    dist('Firozabad', 'फिरोजाबाद', ['फिरोजाबाद', 'firozabad'], {
      'Firozabad': ['Firozabad Sadar'],
      'Tundla': ['Tundla'],
      'Jasrana': ['Jasrana'],
      'Shikohabad': ['Shikohabad'],
      'Sirsaganj': ['Sirsaganj'],
    }),
    dist('Azamgarh', 'आजमगढ़', ['आजमगढ़', 'azamgarh'], {
      'Azamgarh': ['Azamgarh Sadar'],
      'Sagri': ['Sagri'],
      'Phoolpur Pawai': ['Phoolpur', 'Martinganj'],
      'Nizamabad': ['Nizamabad'],
      'Lalganj': ['Lalganj', 'Mehnagar'],
      'Atraulia': ['Budhanpur'],
    }),
    dist('Jaunpur', 'जौनपुर', ['जौनपुर', 'jaunpur'], {
      'Jaunpur': ['Jaunpur Sadar'],
      'Shahganj': ['Shahganj'],
      'Badlapur': ['Badlapur'],
      'Machhlishahr': ['Machhlishahr'],
      'Mariahu': ['Mariahu'],
      'Kerakat': ['Kerakat'],
    }),
    dist('Sultanpur', 'सुल्तानपुर', ['सुल्तानपुर', 'sultanpur'], {
      'Sultanpur': ['Sultanpur Sadar'],
      'Kadipur': ['Kadipur'],
      'Lambhua': ['Lambhua'],
      'Isauli': ['Baldirai'],
      'Jaisinghpur': ['Jaisinghpur'],
    }),
    dist('Amethi', 'अमेठी', ['अमेठी', 'amethi'], {
      'Amethi': ['Amethi'],
      'Gauriganj': ['Gauriganj'],
      'Jagdishpur': ['Musafirkhana'],
      'Tiloi': ['Tiloi'],
    }),
    dist('Raebareli', 'रायबरेली', ['रायबरेली', 'raebareli'], {
      'Rae Bareli': ['Raebareli Sadar'],
      'Bachhrawan': ['Maharajganj'],
      'Lalganj': ['Lalganj'],
      'Unchahar': ['Unchahar'],
      'Salon': ['Salon', 'Dalmau'],
    }),
    dist('Barabanki', 'बाराबंकी', ['बाराबंकी', 'barabanki'], {
      'Barabanki': ['Nawabganj'],
      'Kursi': ['Fatehpur'],
      'Ram Nagar': ['Ramnagar'],
      'Dariyabad': ['Ramsanehighat'],
      'Haidergarh': ['Haidergarh', 'Sirauli Gauspur'],
    }),
    dist('Sitapur', 'सीतापुर', ['सीतापुर', 'sitapur'], {
      'Sitapur': ['Sitapur Sadar'],
      'Misrikh': ['Misrikh'],
      'Laharpur': ['Laharpur'],
      'Biswan': ['Biswan'],
      'Mahmoodabad': ['Mahmoodabad'],
      'Sidhauli': ['Sidhauli', 'Maholi'],
    }),
    dist('Hardoi', 'हरदोई', ['हरदोई', 'hardoi'], {
      'Hardoi': ['Hardoi Sadar'],
      'Shahabad': ['Shahabad'],
      'Sawayajpur': ['Sawayajpur'],
      'Bilgram-Mallanwan': ['Bilgram'],
      'Sandila': ['Sandila'],
    }),
    dist('Unnao', 'उन्नाव', ['उन्नाव', 'unnao'], {
      'Unnao': ['Unnao Sadar'],
      'Bangarmau': ['Bangarmau'],
      'Safipur': ['Safipur'],
      'Mohan': ['Hasanganj'],
      'Purwa': ['Purwa', 'Bighapur'],
    }),
    dist('Lakhimpur Kheri', 'लखीमपुर खीरी', ['लखीमपुर', 'लखीमपुर खीरी', 'lakhimpur', 'kheri'], {
      'Lakhimpur': ['Lakhimpur Sadar'],
      'Palia': ['Palia'],
      'Nighasan': ['Nighasan'],
      'Gola Gokrannath': ['Gola'],
      'Mohammdi': ['Mohammdi', 'Dhaurahra', 'Mitauli'],
    }),
    dist('Shahjahanpur', 'शाहजहांपुर', ['शाहजहांपुर', 'shahjahanpur'], {
      'Shahjahanpur': ['Shahjahanpur Sadar'],
      'Tilhar': ['Tilhar'],
      'Powayan': ['Powayan'],
      'Jalalabad': ['Jalalabad', 'Kalan'],
    }),
    dist('Pilibhit', 'पीलीभीत', ['पीलीभीत', 'pilibhit'], {
      'Pilibhit': ['Pilibhit Sadar'],
      'Puranpur': ['Puranpur', 'Kalimnagar'],
      'Bisalpur': ['Bisalpur', 'Amaria'],
    }),
    dist('Budaun', 'बदायूं', ['बदायूं', 'budaun', 'badaun'], {
      'Budaun': ['Budaun Sadar'],
      'Bisauli': ['Bisauli'],
      'Sahaswan': ['Sahaswan'],
      'Bilsi': ['Bilsi'],
      'Dataganj': ['Dataganj'],
    }),
    dist('Rampur', 'रामपुर', ['रामपुर', 'rampur'], {
      'Rampur': ['Rampur Sadar'],
      'Suar': ['Suar', 'Tanda'],
      'Bilaspur': ['Bilaspur'],
      'Milak': ['Milak', 'Shahabad'],
    }),
    dist('Bijnor', 'बिजनौर', ['बिजनौर', 'bijnor'], {
      'Bijnor': ['Bijnor Sadar'],
      'Najibabad': ['Najibabad'],
      'Nagina': ['Nagina'],
      'Dhampur': ['Dhampur'],
      'Chandpur': ['Chandpur'],
    }),
    dist('Amroha', 'अमरोहा', ['अमरोहा', 'amroha'], {
      'Amroha': ['Amroha Sadar'],
      'Dhanaura': ['Dhanaura'],
      'Hasanpur': ['Hasanpur'],
      'Naugawan Sadat': ['Naugawan Sadat'],
    }),
    dist('Sambhal', 'संभल', ['संभल', 'sambhal'], {
      'Sambhal': ['Sambhal'],
      'Chandausi': ['Chandausi'],
      'Gunnaur': ['Gunnaur'],
    }),
    dist('Bulandshahr', 'बुलंदशहर', ['बुलंदशहर', 'bulandshahr'], {
      'Bulandshahr': ['Bulandshahr Sadar'],
      'Sikandrabad': ['Sikandrabad'],
      'Syana': ['Syana'],
      'Anupshahr': ['Anupshahr'],
      'Debai': ['Debai'],
      'Shikarpur': ['Shikarpur'],
      'Khurja': ['Khurja'],
    }),
    dist('Hapur', 'हापुड़', ['हापुड़', 'hapur'], {
      'Hapur': ['Hapur'],
      'Dhaulana': ['Dhaulana'],
      'Garhmukteshwar': ['Garhmukteshwar'],
    }),
    dist('Baghpat', 'बागपत', ['बागपत', 'baghpat'], {
      'Baghpat': ['Baghpat'],
      'Baraut': ['Baraut'],
      'Chhaprauli': ['Khekra'],
    }),
    dist('Shamli', 'शामली', ['शामली', 'shamli'], {
      'Shamli': ['Shamli'],
      'Kairana': ['Kairana'],
      'Thana Bhawan': ['Un'],
    }),
    dist('Hathras', 'हाथरस', ['हाथरस', 'hathras'], {
      'Hathras': ['Hathras', 'Sasni'],
      'Sadabad': ['Sadabad'],
      'Sikandra Rao': ['Sikandra Rao'],
    }),
    dist('Etah', 'एटा', ['एटा', 'etah'], {
      'Etah': ['Etah Sadar'],
      'Aliganj': ['Aliganj'],
      'Jalesar': ['Jalesar'],
    }),
    dist('Kasganj', 'कासगंज', ['कासगंज', 'kasganj'], {
      'Kasganj': ['Kasganj'],
      'Patiyali': ['Patiyali'],
      'Amanpur': ['Sahawar'],
    }),
    dist('Mainpuri', 'मैनपुरी', ['मैनपुरी', 'mainpuri'], {
      'Mainpuri': ['Mainpuri Sadar'],
      'Bhongaon': ['Bhongaon'],
      'Kishni': ['Kishni'],
      'Karhal': ['Karhal', 'Ghiror', 'Kurawali'],
    }),
    dist('Etawah', 'इटावा', ['इटावा', 'etawah'], {
      'Etawah': ['Etawah Sadar'],
      'Jaswantnagar': ['Jaswantnagar', 'Saifai'],
      'Bharthana': ['Bharthana', 'Chakarnagar', 'Takha'],
    }),
    dist('Auraiya', 'औरैया', ['औरैया', 'auraiya'], {
      'Auraiya': ['Auraiya'],
      'Bidhuna': ['Bidhuna'],
      'Dibiyapur': ['Ajitmal'],
    }),
    dist('Farrukhabad', 'फर्रुखाबाद', ['फर्रुखाबाद', 'farrukhabad'], {
      'Farrukhabad': ['Farrukhabad Sadar'],
      'Kaimganj': ['Kaimganj'],
      'Amritpur': ['Amritpur'],
    }),
    dist('Kannauj', 'कन्नौज', ['कन्नौज', 'kannauj'], {
      'Kannauj': ['Kannauj Sadar'],
      'Chhibramau': ['Chhibramau'],
      'Tirwa': ['Tirwa'],
    }),
    dist('Kanpur Dehat', 'कानपुर देहात', ['कानपुर देहात', 'kanpur dehat'], {
      'Akbarpur-Raniya': ['Akbarpur'],
      'Rasulabad': ['Rasulabad'],
      'Sikandra': ['Sikandra', 'Derapur'],
      'Bhognipur': ['Bhognipur', 'Maitha'],
    }),
    dist('Jalaun', 'जालौन', ['जालौन', 'उरई', 'jalaun', 'orai'], {
      'Orai': ['Orai'],
      'Kalpi': ['Kalpi'],
      'Madhogarh': ['Madhogarh', 'Jalaun', 'Konch'],
    }),
    dist('Lalitpur', 'ललितपुर', ['ललितपुर', 'lalitpur'], {
      'Lalitpur': ['Lalitpur', 'Talbehat', 'Pali'],
      'Mehroni': ['Mehroni', 'Madawara'],
    }),
    dist('Hamirpur', 'हमीरपुर', ['हमीरपुर', 'hamirpur up'], {
      'Hamirpur': ['Hamirpur', 'Maudaha'],
      'Rath': ['Rath', 'Sarila'],
    }),
    dist('Mahoba', 'महोबा', ['महोबा', 'mahoba'], {
      'Mahoba': ['Mahoba'],
      'Charkhari': ['Charkhari', 'Kulpahar'],
    }),
    dist('Banda', 'बांदा', ['बांदा', 'banda'], {
      'Banda': ['Banda Sadar'],
      'Baberu': ['Baberu'],
      'Naraini': ['Naraini', 'Atarra'],
      'Tindwari': ['Pailani'],
    }),
    dist('Chitrakoot', 'चित्रकूट', ['चित्रकूट', 'chitrakoot'], {
      'Chitrakoot': ['Karwi', 'Rajapur'],
      'Manikpur': ['Manikpur', 'Mau'],
    }),
    dist('Fatehpur', 'फतेहपुर', ['फतेहपुर', 'fatehpur'], {
      'Fatehpur': ['Fatehpur Sadar'],
      'Bindki': ['Bindki'],
      'Khaga': ['Khaga'],
    }),
    dist('Kaushambi', 'कौशांबी', ['कौशांबी', 'kaushambi'], {
      'Manjhanpur': ['Manjhanpur'],
      'Sirathu': ['Sirathu'],
      'Chail': ['Chail'],
    }),
    dist('Pratapgarh', 'प्रतापगढ़', ['प्रतापगढ़', 'pratapgarh'], {
      'Pratapgarh': ['Pratapgarh Sadar'],
      'Kunda': ['Kunda'],
      'Patti': ['Patti'],
      'Raniganj': ['Raniganj'],
      'Rampur Khas': ['Lalganj'],
    }),
    dist('Mirzapur', 'मिर्जापुर', ['मिर्जापुर', 'mirzapur'], {
      'Mirzapur': ['Mirzapur Sadar'],
      'Chunar': ['Chunar'],
      'Marihan': ['Marihan'],
      'Chhanbey': ['Lalganj'],
    }),
    dist('Bhadohi', 'भदोही', ['भदोही', 'bhadohi'], {
      'Bhadohi': ['Bhadohi'],
      'Gyanpur': ['Gyanpur'],
      'Aurai': ['Aurai'],
    }),
    dist('Sonbhadra', 'सोनभद्र', ['सोनभद्र', 'sonbhadra'], {
      'Robertsganj': ['Robertsganj'],
      'Ghorawal': ['Ghorawal'],
      'Obra': ['Obra'],
      'Duddhi': ['Duddhi'],
    }),
    dist('Chandauli', 'चंदौली', ['चंदौली', 'chandauli'], {
      'Chakia': ['Chakia', 'Naugarh'],
      'Mughalsarai': ['Pt. Deen Dayal Upadhyaya Nagar'],
      'Sakaldiha': ['Sakaldiha'],
      'Saiyadraja': ['Chandauli'],
    }),
    dist('Ghazipur', 'गाजीपुर', ['गाजीपुर', 'ghazipur'], {
      'Ghazipur': ['Ghazipur Sadar'],
      'Saidpur': ['Saidpur'],
      'Zamania': ['Zamania', 'Sevrai'],
      'Mohammadabad': ['Mohammadabad', 'Kasimabad'],
      'Jakhania': ['Jakhania'],
    }),
    dist('Ballia', 'बलिया', ['बलिया', 'ballia'], {
      'Ballia Nagar': ['Ballia Sadar'],
      'Rasara': ['Rasara'],
      'Bansdih': ['Bansdih'],
      'Sikanderpur': ['Sikanderpur'],
      'Belthara Road': ['Belthara Road'],
      'Bairia': ['Bairia'],
    }),
    dist('Mau', 'मऊ', ['मऊ', 'mau'], {
      'Mau': ['Mau Sadar'],
      'Ghosi': ['Ghosi'],
      'Madhuban': ['Madhuban'],
      'Muhammadabad-Gohna': ['Muhammadabad Gohna'],
    }),
    dist('Deoria', 'देवरिया', ['देवरिया', 'deoria'], {
      'Deoria': ['Deoria Sadar'],
      'Rudrapur': ['Rudrapur'],
      'Barhaj': ['Barhaj'],
      'Salempur': ['Salempur'],
      'Bhatpar Rani': ['Bhatpar Rani'],
    }),
    dist('Kushinagar', 'कुशीनगर', ['कुशीनगर', 'kushinagar'], {
      'Kushinagar': ['Kasia'],
      'Padrauna': ['Padrauna'],
      'Hata': ['Hata'],
      'Tamkuhi Raj': ['Tamkuhi Raj'],
      'Khadda': ['Khadda'],
      'Captanganj': ['Captanganj'],
    }),
    dist('Maharajganj', 'महराजगंज', ['महराजगंज', 'maharajganj'], {
      'Maharajganj': ['Maharajganj Sadar'],
      'Nautanwa': ['Nautanwa'],
      'Pharenda': ['Pharenda'],
      'Nichlaul': ['Nichlaul'],
    }),
    dist('Siddharthnagar', 'सिद्धार्थनगर', ['सिद्धार्थनगर', 'siddharthnagar'], {
      'Kapilvastu': ['Naugarh'],
      'Shohratgarh': ['Shohratgarh'],
      'Bansi': ['Bansi'],
      'Itwa': ['Itwa'],
      'Domariyaganj': ['Domariyaganj'],
    }),
    dist('Sant Kabir Nagar', 'संत कबीर नगर', ['संत कबीर नगर', 'खलीलाबाद', 'sant kabir nagar', 'khalilabad'], {
      'Khalilabad': ['Khalilabad'],
      'Menhdawal': ['Menhdawal'],
      'Dhanghata': ['Dhanghata'],
    }),
    dist('Basti', 'बस्ती', ['बस्ती', 'basti'], {
      'Basti Sadar': ['Basti Sadar'],
      'Harraiya': ['Harraiya'],
      'Bhanpur': ['Bhanpur'],
      'Rudhauli': ['Rudhauli'],
    }),
    dist('Ambedkar Nagar', 'अंबेडकर नगर', ['अंबेडकर नगर', 'ambedkar nagar'], {
      'Akbarpur': ['Akbarpur'],
      'Tanda': ['Tanda'],
      'Jalalpur': ['Jalalpur'],
      'Alapur': ['Alapur'],
      'Katehari': ['Bhiti'],
    }),
    dist('Gonda', 'गोंडा', ['गोंडा', 'gonda'], {
      'Gonda': ['Gonda Sadar'],
      'Colonelganj': ['Colonelganj'],
      'Tarabganj': ['Tarabganj'],
      'Mankapur': ['Mankapur'],
    }),
    dist('Balrampur', 'बलरामपुर', ['बलरामपुर', 'balrampur'], {
      'Balrampur': ['Balrampur Sadar'],
      'Tulsipur': ['Tulsipur'],
      'Utraula': ['Utraula'],
    }),
    dist('Shravasti', 'श्रावस्ती', ['श्रावस्ती', 'shravasti'], {
      'Bhinga': ['Bhinga'],
      'Shrawasti': ['Ikauna', 'Jamunaha'],
    }),
    dist('Bahraich', 'बहराइच', ['बहराइच', 'bahraich'], {
      'Bahraich': ['Bahraich Sadar'],
      'Nanpara': ['Nanpara', 'Mihinpurwa'],
      'Kaiserganj': ['Kaiserganj'],
      'Mahasi': ['Mahasi'],
      'Payagpur': ['Payagpur'],
    }),
  ],

  // =========================================================================
  // PUNJAB (23 Districts · Assembly Constituencies · Tehsils)
  // =========================================================================
  PB: [
    dist('Amritsar', 'ਅੰਮ੍ਰਿਤਸਰ', ['ਅੰਮ੍ਰਿਤਸਰ', 'अमृतसर', 'amritsar'], {
      'Amritsar Central': ['Amritsar-I', 'Amritsar-II'],
      'Ajnala': ['Ajnala', 'Ramdass'],
      'Majitha': ['Majitha'],
      'Baba Bakala': ['Baba Bakala', 'Rayya'],
      'Attari': ['Lopoke', 'Attari'],
    }),
    dist('Ludhiana', 'ਲੁਧਿਆਣਾ', ['ਲੁਧਿਆਣਾ', 'लुधियाना', 'ludhiana'], {
      'Ludhiana Central': ['Ludhiana East', 'Ludhiana West'],
      'Jagraon': ['Jagraon', 'Sidhwan Bet'],
      'Khanna': ['Khanna'],
      'Samrala': ['Samrala', 'Machhiwara'],
      'Payal': ['Payal', 'Doraha'],
      'Raikot': ['Raikot'],
    }),
    dist('Jalandhar', 'ਜਲੰਧਰ', ['ਜਲੰਧਰ', 'जालंधर', 'jalandhar'], {
      'Jalandhar Central': ['Jalandhar-I', 'Jalandhar-II'],
      'Nakodar': ['Nakodar', 'Mehatpur'],
      'Phillaur': ['Phillaur', 'Goraya'],
      'Shahkot': ['Shahkot', 'Lohian Khas'],
      'Adampur': ['Adampur', 'Bhogpur'],
    }),
    dist('Patiala', 'ਪਟਿਆਲਾ', ['ਪਟਿਆਲਾ', 'पटियाला', 'patiala'], {
      'Patiala': ['Patiala', 'Dudhan Sadhan'],
      'Rajpura': ['Rajpura', 'Ghanaur'],
      'Nabha': ['Nabha', 'Bhadson'],
      'Samana': ['Samana'],
      'Shutrana': ['Patran'],
    }),
    dist('SAS Nagar (Mohali)', 'ਐਸ.ਏ.ਐਸ. ਨਗਰ (ਮੋਹਾਲੀ)', ['ਮੋਹਾਲੀ', 'मोहाली', 'mohali', 'sas nagar'], {
      'S.A.S. Nagar': ['Mohali', 'Banur'],
      'Kharar': ['Kharar', 'Kurali'],
      'Dera Bassi': ['Dera Bassi', 'Zirakpur', 'Lalru'],
    }),
    dist('Bathinda', 'ਬਠਿੰਡਾ', ['ਬਠਿੰਡਾ', 'बठिंडा', 'bathinda'], {
      'Bathinda Urban': ['Bathinda', 'Goniana'],
      'Rampura Phul': ['Rampura Phul'],
      'Talwandi Sabo': ['Talwandi Sabo'],
      'Maur': ['Maur', 'Nathana'],
    }),
    dist('Gurdaspur', 'ਗੁਰਦਾਸਪੁਰ', ['ਗੁਰਦਾਸਪੁਰ', 'गुरदासपुर', 'gurdaspur'], {
      'Gurdaspur': ['Gurdaspur', 'Dinanagar'],
      'Batala': ['Batala', 'Fatehgarh Churian'],
      'Dera Baba Nanak': ['Dera Baba Nanak', 'Kalanaur'],
    }),
    dist('Pathankot', 'ਪਠਾਨਕੋਟ', ['ਪਠਾਨਕੋਟ', 'पठानकोट', 'pathankot'], {
      'Pathankot': ['Pathankot'],
      'Sujanpur': ['Dhar Kalan', 'Sujanpur'],
      'Bhoa': ['Narot Jaimal Singh', 'Bamial'],
    }),
    dist('Hoshiarpur', 'ਹੁਸ਼ਿਆਰਪੁਰ', ['ਹੁਸ਼ਿਆਰਪੁਰ', 'होशियारपुर', 'hoshiarpur'], {
      'Hoshiarpur': ['Hoshiarpur'],
      'Dasuya': ['Dasuya', 'Tanda'],
      'Mukerian': ['Mukerian'],
      'Garhshankar': ['Garhshankar', 'Mahilpur'],
    }),
    dist('Kapurthala', 'ਕਪੂਰਥਲਾ', ['ਕਪੂਰਥਲਾ', 'कपूरथला', 'kapurthala'], {
      'Kapurthala': ['Kapurthala'],
      'Phagwara': ['Phagwara'],
      'Sultanpur Lodhi': ['Sultanpur Lodhi'],
      'Bholath': ['Bholath'],
    }),
    dist('Tarn Taran', 'ਤਰਨ ਤਾਰਨ', ['ਤਰਨ ਤਾਰਨ', 'तरनतारन', 'tarn taran'], {
      'Tarn Taran': ['Tarn Taran'],
      'Patti': ['Patti', 'Bhikhiwind'],
      'Khadur Sahib': ['Khadur Sahib'],
    }),
    dist('Ferozepur', 'ਫਿਰੋਜ਼ਪੁਰ', ['ਫਿਰੋਜ਼ਪੁਰ', 'फिरोजपुर', 'ferozepur', 'firozpur'], {
      'Firozpur City': ['Ferozepur'],
      'Zira': ['Zira', 'Makhu'],
      'Guru Har Sahai': ['Guru Har Sahai'],
    }),
    dist('Fazilka', 'ਫਾਜ਼ਿਲਕਾ', ['ਫਾਜ਼ਿਲਕਾ', 'फाजिल्का', 'fazilka'], {
      'Fazilka': ['Fazilka'],
      'Abohar': ['Abohar'],
      'Jalalabad': ['Jalalabad'],
    }),
    dist('Faridkot', 'ਫਰੀਦਕੋਟ', ['ਫਰੀਦਕੋਟ', 'फरीदकोट', 'faridkot'], {
      'Faridkot': ['Faridkot'],
      'Kotkapura': ['Kotkapura'],
      'Jaitu': ['Jaitu'],
    }),
    dist('Sri Muktsar Sahib', 'ਸ੍ਰੀ ਮੁਕਤਸਰ ਸਾਹਿਬ', ['ਮੁਕਤਸਰ', 'मुक्तसर', 'muktsar', 'sri muktsar sahib'], {
      'Muktsar': ['Sri Muktsar Sahib'],
      'Malout': ['Malout'],
      'Gidderbaha': ['Gidderbaha', 'Lambi'],
    }),
    dist('Moga', 'ਮੋਗਾ', ['ਮੋਗਾ', 'मोगा', 'moga'], {
      'Moga': ['Moga'],
      'Bagha Purana': ['Bagha Purana'],
      'Nihal Singh Wala': ['Nihal Singh Wala'],
      'Dharamkot': ['Dharamkot'],
    }),
    dist('Sangrur', 'ਸੰਗਰੂਰ', ['ਸੰਗਰੂਰ', 'संगरूर', 'sangrur'], {
      'Sangrur': ['Sangrur', 'Bhawanigarh'],
      'Dhuri': ['Dhuri'],
      'Sunam': ['Sunam'],
      'Dirba': ['Dirba'],
      'Lehra': ['Lehragaga', 'Moonak'],
    }),
    dist('Malerkotla', 'ਮਲੇਰਕੋਟਲਾ', ['ਮਲੇਰਕੋਟਲਾ', 'मलेरकोटला', 'malerkotla'], {
      'Malerkotla': ['Malerkotla'],
      'Amargarh': ['Amargarh', 'Ahmedgarh'],
    }),
    dist('Barnala', 'ਬਰਨਾਲਾ', ['ਬਰਨਾਲਾ', 'बरनाला', 'barnala'], {
      'Barnala': ['Barnala'],
      'Mehal Kalan': ['Mehal Kalan'],
      'Bhadaur': ['Tapa'],
    }),
    dist('Mansa', 'ਮਾਨਸਾ', ['ਮਾਨਸਾ', 'मानसा', 'mansa'], {
      'Mansa': ['Mansa'],
      'Budhlada': ['Budhlada'],
      'Sardulgarh': ['Sardulgarh'],
    }),
    dist('Fatehgarh Sahib', 'ਫਤਿਹਗੜ੍ਹ ਸਾਹਿਬ', ['ਫਤਿਹਗੜ੍ਹ ਸਾਹਿਬ', 'फतेहगढ़ साहिब', 'fatehgarh sahib'], {
      'Fatehgarh Sahib': ['Fatehgarh Sahib', 'Bassi Pathana'],
      'Amloh': ['Amloh', 'Mandi Gobindgarh'],
      'Khamanon': ['Khamanon'],
    }),
    dist('Rupnagar', 'ਰੂਪਨਗਰ', ['ਰੂਪਨਗਰ', 'ਰੋਪੜ', 'rupnagar', 'ropar'], {
      'Rupnagar': ['Rupnagar'],
      'Sri Anandpur Sahib': ['Anandpur Sahib', 'Nangal'],
      'Chamkaur Sahib': ['Chamkaur Sahib', 'Morinda'],
    }),
    dist('SBS Nagar (Nawanshahr)', 'ਸ਼ਹੀਦ ਭਗਤ ਸਿੰਘ ਨਗਰ', ['ਨਵਾਂਸ਼ਹਿਰ', 'नवांशहर', 'nawanshahr', 'sbs nagar'], {
      'Nawanshahr': ['Nawanshahr'],
      'Banga': ['Banga'],
      'Balachaur': ['Balachaur'],
    }),
  ],

  // =========================================================================
  // UTTARAKHAND (13 Districts · Assembly Constituencies · Tehsils)
  // =========================================================================
  UK: [
    dist('Dehradun', 'देहरादून', ['देहरादून', 'dehradun', 'doon'], {
      'Dehradun Cantt': ['Dehradun Sadar'],
      'Mussoorie': ['Mussoorie', 'Rajpur'],
      'Rishikesh': ['Rishikesh'],
      'Doiwala': ['Doiwala'],
      'Vikasnagar': ['Vikasnagar', 'Kalsi'],
      'Chakrata': ['Chakrata', 'Tyuni'],
    }),
    dist('Haridwar', 'हरिद्वार', ['हरिद्वार', 'रुड़की', 'haridwar', 'roorkee'], {
      'Haridwar': ['Haridwar Sadar'],
      'Roorkee': ['Roorkee'],
      'Laksar': ['Laksar'],
      'Bhagwanpur': ['Bhagwanpur'],
      'Manglaur': ['Roorkee', 'Manglaur'],
    }),
    dist('Nainital', 'नैनीताल', ['नैनीताल', 'हल्द्वानी', 'nainital', 'haldwani'], {
      'Nainital': ['Nainital', 'Kosyakutauli'],
      'Haldwani': ['Haldwani', 'Lalkuan'],
      'Ramnagar': ['Ramnagar'],
      'Kaladhungi': ['Kaladhungi'],
      'Bhimtal': ['Dhari', 'Okhalkanda'],
    }),
    dist('Udham Singh Nagar', 'ऊधम सिंह नगर', ['ऊधम सिंह नगर', 'रुद्रपुर', 'काशीपुर', 'udham singh nagar', 'rudrapur', 'kashipur'], {
      'Rudrapur': ['Rudrapur'],
      'Kashipur': ['Kashipur'],
      'Kichha': ['Kichha'],
      'Bazpur': ['Bazpur'],
      'Jaspur': ['Jaspur'],
      'Sitarganj': ['Sitarganj'],
      'Khatima': ['Khatima', 'Nanakmatta'],
    }),
    dist('Almora', 'अल्मोड़ा', ['अल्मोड़ा', 'almora'], {
      'Almora': ['Almora', 'Someshwar'],
      'Ranikhet': ['Ranikhet', 'Dwarahat'],
      'Salt': ['Bhikiyasain', 'Syalde'],
      'Jageshwar': ['Bhanoli', 'Jainti'],
    }),
    dist('Pauri Garhwal', 'पौड़ी गढ़वाल', ['पौड़ी', 'पौड़ी गढ़वाल', 'कोटद्वार', 'pauri', 'kotdwar'], {
      'Pauri': ['Pauri'],
      'Srinagar': ['Srinagar'],
      'Kotdwar': ['Kotdwar'],
      'Lansdowne': ['Lansdowne', 'Satpuli'],
      'Chaubattakhal': ['Thalisain', 'Dhumakot'],
    }),
    dist('Tehri Garhwal', 'टिहरी गढ़वाल', ['टिहरी', 'टिहरी गढ़वाल', 'tehri'], {
      'Tehri': ['Tehri', 'Narendranagar'],
      'Devprayag': ['Devprayag', 'Kirtinagar'],
      'Ghansali': ['Ghansali'],
      'Pratapnagar': ['Pratapnagar', 'Dhanaulti'],
    }),
    dist('Chamoli', 'चमोली', ['चमोली', 'गोपेश्वर', 'जोशीमठ', 'chamoli', 'joshimath'], {
      'Badrinath': ['Joshimath', 'Chamoli'],
      'Karnaprayag': ['Karnaprayag', 'Gairsain'],
      'Tharali': ['Tharali', 'Pokhari'],
    }),
    dist('Uttarkashi', 'उत्तरकाशी', ['उत्तरकाशी', 'uttarkashi'], {
      'Gangotri': ['Bhatwari', 'Dunda'],
      'Yamunotri': ['Chinyalisaur', 'Barkot'],
      'Purola': ['Purola', 'Mori'],
    }),
    dist('Rudraprayag', 'रुद्रप्रयाग', ['रुद्रप्रयाग', 'केदारनाथ', 'rudraprayag', 'kedarnath'], {
      'Rudraprayag': ['Rudraprayag', 'Jakholi'],
      'Kedarnath': ['Ukhimath', 'Basukedar'],
    }),
    dist('Pithoragarh', 'पिथौरागढ़', ['पिथौरागढ़', 'pithoragarh'], {
      'Pithoragarh': ['Pithoragarh'],
      'Didihat': ['Didihat', 'Berinag'],
      'Dharchula': ['Dharchula', 'Munsyari'],
      'Gangolihat': ['Gangolihat'],
    }),
    dist('Bageshwar', 'बागेश्वर', ['बागेश्वर', 'bageshwar'], {
      'Bageshwar': ['Bageshwar', 'Garur'],
      'Kapkot': ['Kapkot', 'Kanda'],
    }),
    dist('Champawat', 'चंपावत', ['चंपावत', 'टनकपुर', 'champawat', 'tanakpur'], {
      'Champawat': ['Champawat', 'Purnagiri (Tanakpur)'],
      'Lohaghat': ['Lohaghat', 'Pati', 'Barakot'],
    }),
  ],

  // =========================================================================
  // HIMACHAL PRADESH (12 Districts · Assembly Constituencies · Tehsils)
  // =========================================================================
  HP: [
    dist('Shimla', 'शिमला', ['शिमला', 'shimla'], {
      'Shimla': ['Shimla Urban', 'Shimla Rural'],
      'Theog': ['Theog', 'Kotkhai'],
      'Rampur': ['Rampur Bushahr', 'Kumarsain'],
      'Rohru': ['Rohru', 'Chirgaon'],
      'Chopal': ['Chopal', 'Nerwa'],
      'Jubbal-Kotkhai': ['Jubbal'],
    }),
    dist('Kangra', 'कांगड़ा', ['कांगड़ा', 'धर्मशाला', 'kangra', 'dharamshala'], {
      'Dharamshala': ['Dharamshala'],
      'Kangra': ['Kangra', 'Nagrota Bagwan'],
      'Palampur': ['Palampur', 'Baijnath'],
      'Nurpur': ['Nurpur', 'Indora', 'Jawali'],
      'Dehra': ['Dehra Gopipur', 'Jwalamukhi'],
      'Shahpur': ['Shahpur'],
    }),
    dist('Mandi', 'मंडी', ['मंडी', 'mandi'], {
      'Mandi': ['Mandi Sadar'],
      'Sundernagar': ['Sundernagar'],
      'Jogindernagar': ['Jogindernagar', 'Padhar'],
      'Sarkaghat': ['Sarkaghat', 'Dharampur'],
      'Karsog': ['Karsog'],
      'Seraj': ['Thunag', 'Bali Chowki'],
    }),
    dist('Kullu', 'कुल्लू', ['कुल्लू', 'मनाली', 'kullu', 'manali'], {
      'Kullu': ['Kullu', 'Bhuntar'],
      'Manali': ['Manali'],
      'Banjar': ['Banjar', 'Sainj'],
      'Anni': ['Anni', 'Nirmand'],
    }),
    dist('Solan', 'सोलन', ['सोलन', 'बद्दी', 'solan', 'baddi'], {
      'Solan': ['Solan', 'Kandaghat'],
      'Kasauli': ['Kasauli'],
      'Arki': ['Arki'],
      'Nalagarh': ['Nalagarh', 'Baddi'],
    }),
    dist('Sirmaur', 'सिरमौर', ['सिरमौर', 'नाहन', 'sirmaur', 'nahan'], {
      'Nahan': ['Nahan'],
      'Paonta Sahib': ['Paonta Sahib'],
      'Pachhad': ['Pachhad', 'Rajgarh'],
      'Renukaji': ['Sangrah'],
      'Shillai': ['Shillai'],
    }),
    dist('Una', 'ऊना', ['ऊना', 'una'], {
      'Una': ['Una'],
      'Gagret': ['Gagret', 'Amb'],
      'Haroli': ['Haroli'],
      'Kutlehar': ['Bangana'],
    }),
    dist('Hamirpur (HP)', 'हमीरपुर (हि.प्र.)', ['हमीरपुर हिमाचल', 'hamirpur hp', 'nadaun'], {
      'Hamirpur': ['Hamirpur', 'Tauni Devi'],
      'Nadaun': ['Nadaun'],
      'Bhoranj': ['Bhoranj'],
      'Sujanpur': ['Sujanpur Tira'],
      'Barsar': ['Barsar'],
    }),
    dist('Bilaspur', 'बिलासपुर', ['बिलासपुर', 'bilaspur hp'], {
      'Bilaspur': ['Bilaspur Sadar'],
      'Ghumarwin': ['Ghumarwin'],
      'Jhanduta': ['Jhanduta'],
      'Sri Naina Deviji': ['Sri Naina Devi Ji'],
    }),
    dist('Chamba', 'चंबा', ['चंबा', 'डलहौजी', 'chamba', 'dalhousie'], {
      'Chamba': ['Chamba'],
      'Dalhousie': ['Dalhousie', 'Salooni'],
      'Bhattiyat': ['Bhattiyat'],
      'Churah': ['Churah'],
      'Bharmour': ['Bharmour', 'Pangi'],
    }),
    dist('Kinnaur', 'किन्नौर', ['किन्नौर', 'kinnaur'], {
      'Kinnaur': ['Kalpa', 'Nichar', 'Pooh', 'Sangla', 'Morang'],
    }),
    dist('Lahaul and Spiti', 'लाहौल और स्पीति', ['लाहौल', 'स्पीति', 'lahaul', 'spiti'], {
      'Lahaul & Spiti': ['Keylong', 'Udaipur', 'Kaza (Spiti)'],
    }),
  ],

  // =========================================================================
  // GUJARAT (33 Districts · Assembly Constituencies · Talukas)
  // =========================================================================
  GJ: [
    dist('Ahmedabad', 'અમદાવાદ', ['અમદાવાદ', 'अहमदाबाद', 'ahmedabad'], {
      'Ellisbridge': ['Ahmedabad City'],
      'Ghatlodia': ['Ahmedabad City', 'Daskroi'],
      'Sanand': ['Sanand', 'Bavla'],
      'Viramgam': ['Viramgam', 'Detroj-Rampura', 'Mandal'],
      'Dholka': ['Dholka'],
      'Dhandhuka': ['Dhandhuka', 'Dholera'],
    }),
    dist('Surat', 'સુરત', ['સુરત', 'सूरत', 'surat'], {
      'Surat City': ['Surat City', 'Majura', 'Choryasi'],
      'Olpad': ['Olpad'],
      'Kamrej': ['Kamrej'],
      'Bardoli': ['Bardoli', 'Palsana'],
      'Mandvi': ['Mandvi', 'Mangrol', 'Mahuva', 'Umarpada'],
    }),
    dist('Vadodara', 'વડોદરા', ['વડોદરા', 'बड़ौदा', 'vadodara', 'baroda'], {
      'Vadodara City': ['Vadodara City', 'Vadodara Rural'],
      'Savli': ['Savli', 'Desar'],
      'Waghodia': ['Waghodia'],
      'Dabhoi': ['Dabhoi'],
      'Padra': ['Padra'],
      'Karjan': ['Karjan', 'Sinor'],
    }),
    dist('Rajkot', 'રાજકોટ', ['રાજકોટ', 'राजकोट', 'rajkot'], {
      'Rajkot West': ['Rajkot City', 'Lodhika'],
      'Gondal': ['Gondal', 'Kotda Sangani'],
      'Jetpur': ['Jetpur', 'Jamkandorna'],
      'Dhoraji': ['Dhoraji', 'Upleta'],
      'Jasdan': ['Jasdan', 'Vinchhiya', 'Paddhari'],
    }),
    dist('Gandhinagar', 'ગાંધીનગર', ['ગાંધીનગર', 'गांधीनगर', 'gandhinagar'], {
      'Gandhinagar South': ['Gandhinagar'],
      'Kalol': ['Kalol'],
      'Mansa': ['Mansa'],
      'Dehgam': ['Dehgam'],
    }),
    dist('Bhavnagar', 'ભાવનગર', ['ભાવનગર', 'भावनगर', 'bhavnagar'], {
      'Bhavnagar West': ['Bhavnagar', 'Ghogha'],
      'Mahuva': ['Mahuva'],
      'Talaja': ['Talaja'],
      'Palitana': ['Palitana', 'Jesar'],
      'Gariadhar': ['Gariadhar', 'Sihor', 'Umrala', 'Vallabhipur'],
    }),
    dist('Jamnagar', 'જામનગર', ['જામનગર', 'जामनगर', 'jamnagar'], {
      'Jamnagar North': ['Jamnagar'],
      'Kalavad': ['Kalavad'],
      'Jamjodhpur': ['Jamjodhpur', 'Lalpur'],
      'Jodiya': ['Jodiya', 'Dhrol'],
    }),
    dist('Junagadh', 'જૂનાગઢ', ['જૂનાગઢ', 'जूनागढ़', 'junagadh'], {
      'Junagadh': ['Junagadh City', 'Junagadh Rural'],
      'Keshod': ['Keshod', 'Vanthali'],
      'Mangrol': ['Mangrol', 'Malia'],
      'Manavadar': ['Manavadar', 'Mendarda'],
      'Visavadar': ['Visavadar', 'Bhesan'],
    }),
    dist('Kutch', 'કચ્છ', ['કચ્છ', 'ભુજ', 'कच्छ', 'kutch', 'bhuj'], {
      'Bhuj': ['Bhuj'],
      'Gandhidham': ['Gandhidham'],
      'Anjar': ['Anjar'],
      'Mandvi': ['Mandvi', 'Mundra'],
      'Abdasa': ['Abdasa', 'Nakhatrana', 'Lakhpat'],
      'Rapar': ['Rapar', 'Bhachau'],
    }),
    dist('Mehsana', 'મહેસાણા', ['મહેસાણા', 'मेहसाणा', 'mehsana'], {
      'Mahesana': ['Mehsana'],
      'Unjha': ['Unjha'],
      'Visnagar': ['Visnagar', 'Vadnagar'],
      'Vijapur': ['Vijapur'],
      'Kadi': ['Kadi'],
      'Becharaji': ['Becharaji', 'Satlasana', 'Kheralu'],
    }),
    dist('Anand', 'આણંદ', ['આણંદ', 'आणंद', 'anand'], {
      'Anand': ['Anand'],
      'Borsad': ['Borsad', 'Anklav'],
      'Petlad': ['Petlad', 'Sojitra'],
      'Khambhat': ['Khambhat', 'Tarapur'],
      'Umreth': ['Umreth'],
    }),
    dist('Kheda', 'ખેડા', ['ખેડા', 'નડિયાદ', 'kheda', 'nadiad'], {
      'Nadiad': ['Nadiad'],
      'Kapadvanj': ['Kapadvanj', 'Kathlal'],
      'Matar': ['Matar', 'Kheda'],
      'Mehmedabad': ['Mehmedabad'],
      'Thasra': ['Thasra', 'Galteshwar', 'Mahudha', 'Vaso'],
    }),
    dist('Bharuch', 'ભરૂચ', ['ભરૂચ', 'भरूच', 'bharuch'], {
      'Bharuch': ['Bharuch'],
      'Ankleshwar': ['Ankleshwar', 'Hansot'],
      'Jambusar': ['Jambusar', 'Amod'],
      'Vagra': ['Vagra'],
      'Jhagadia': ['Jhagadia', 'Valia', 'Netrang'],
    }),
    dist('Navsari', 'નવસારી', ['નવસારી', 'नवसारी', 'navsari'], {
      'Navsari': ['Navsari', 'Jalalpore'],
      'Gandevi': ['Gandevi'],
      'Chikhli': ['Chikhli', 'Khergam'],
      'Vansda': ['Vansda'],
    }),
    dist('Valsad', 'વલસાડ', ['વલસાડ', 'वापी', 'valsad', 'vapi'], {
      'Valsad': ['Valsad'],
      'Pardi': ['Pardi', 'Vapi'],
      'Umbergaon': ['Umbergaon'],
      'Dharampur': ['Dharampur', 'Kaprada'],
    }),
    dist('Banaskantha', 'બનાસકાંઠા', ['બનાસકાંઠા', 'પાલનપુર', 'banaskantha', 'palanpur'], {
      'Palanpur': ['Palanpur'],
      'Deesa': ['Deesa'],
      'Tharad': ['Tharad', 'Vav', 'Suigam'],
      'Dhanera': ['Dhanera', 'Dantiwada'],
      'Danta': ['Danta', 'Amirgadh'],
      'Kankrej': ['Kankrej', 'Bhabhar', 'Deodar', 'Lakhani', 'Vadgam'],
    }),
    dist('Sabarkantha', 'સાબરકાંઠા', ['સાબરકાંઠા', 'હિંમતનગર', 'sabarkantha', 'himatnagar'], {
      'Himatnagar': ['Himatnagar'],
      'Idar': ['Idar', 'Vadali'],
      'Prantij': ['Prantij', 'Talod'],
      'Khedbrahma': ['Khedbrahma', 'Poshina', 'Vijaynagar'],
    }),
    dist('Patan', 'પાટણ', ['પાટણ', 'पाटण', 'patan'], {
      'Patan': ['Patan', 'Saraswati'],
      'Sidhpur': ['Sidhpur'],
      'Chanasma': ['Chanasma', 'Harij'],
      'Radhanpur': ['Radhanpur', 'Santalpur', 'Sami', 'Shankheshwar'],
    }),
    dist('Surendranagar', 'સુરેન્દ્રનગર', ['સુરેન્દ્રનગર', 'surendranagar'], {
      'Wadhwan': ['Wadhwan', 'Muli'],
      'Dhrangadhra': ['Dhrangadhra'],
      'Limbdi': ['Limbdi', 'Chuda', 'Sayla'],
      'Chotila': ['Chotila', 'Thangadh'],
      'Dasada': ['Dasada', 'Lakhtar'],
    }),
    dist('Morbi', 'મોરબી', ['મોરબી', 'morbi'], {
      'Morbi': ['Morbi', 'Maliya Miyana'],
      'Wankaner': ['Wankaner'],
      'Tankara': ['Tankara'],
      'Halvad': ['Halvad'],
    }),
    dist('Amreli', 'અમરેલી', ['અમરેલી', 'amreli'], {
      'Amreli': ['Amreli', 'Kunkavav Vadia'],
      'Savarkundla': ['Savarkundla', 'Lilia'],
      'Rajula': ['Rajula', 'Jafrabad'],
      'Dhari': ['Dhari', 'Bagasara', 'Khambha'],
      'Lathi': ['Lathi', 'Babra'],
    }),
    dist('Gir Somnath', 'ગીર સોમનાથ', ['ગીર સોમનાથ', 'વેરાવળ', 'gir somnath', 'veraval', 'somnath'], {
      'Somnath': ['Veraval'],
      'Talala': ['Talala', 'Sutrapada'],
      'Kodinar': ['Kodinar'],
      'Una': ['Una', 'Gir Gadhada'],
    }),
    dist('Porbandar', 'પોરબંદર', ['પોરબંદર', 'porbandar'], {
      'Porbandar': ['Porbandar'],
      'Kutiyana': ['Kutiyana', 'Ranavav'],
    }),
    dist('Devbhumi Dwarka', 'દેવભૂમિ દ્વારકા', ['દ્વારકા', 'દેવભૂમિ દ્વારકા', 'dwarka', 'devbhumi dwarka'], {
      'Dwarka': ['Okhamandal (Dwarka)', 'Kalyanpur'],
      'Khambhalia': ['Khambhalia', 'Bhanvad'],
    }),
    dist('Botad', 'બોટાદ', ['બોટાદ', 'botad'], {
      'Botad': ['Botad', 'Ranpur'],
      'Gadhada': ['Gadhada', 'Barwala'],
    }),
    dist('Panchmahal', 'પંચમહાલ', ['પંચમહાલ', 'ગોધરા', 'panchmahal', 'godhra'], {
      'Godhra': ['Godhra'],
      'Halol': ['Halol', 'Jambughoda'],
      'Kalol': ['Kalol', 'Ghoghamba'],
      'Shehra': ['Shehra', 'Morva Hadaf'],
    }),
    dist('Dahod', 'દાહોદ', ['દાહોદ', 'dahod'], {
      'Dahod': ['Dahod'],
      'Jhalod': ['Jhalod', 'Sanjeli'],
      'Limkheda': ['Limkheda', 'Singvad'],
      'Devgadhbaria': ['Devgadh Baria', 'Dhanpur'],
      'Garbada': ['Garbada'],
      'Fatepura': ['Fatepura'],
    }),
    dist('Mahisagar', 'મહીસાગર', ['મહીસાગર', 'લુણાવાડા', 'mahisagar', 'lunawada'], {
      'Lunawada': ['Lunawada', 'Khanpur'],
      'Santrampur': ['Santrampur', 'Kadana'],
      'Balasinor': ['Balasinor', 'Virpur'],
    }),
    dist('Aravalli', 'અરવલ્લી', ['અરવલ્લી', 'મોડાસા', 'aravalli', 'modasa'], {
      'Modasa': ['Modasa', 'Dhansura'],
      'Bhiloda': ['Bhiloda', 'Meghraj'],
      'Bayad': ['Bayad', 'Malpur'],
    }),
    dist('Chhota Udaipur', 'છોટા ઉદેપુર', ['છોટા ઉદેપુર', 'chhota udaipur'], {
      'Chhota Udaipur': ['Chhota Udaipur', 'Kawant'],
      'Jetpur Pavi': ['Jetpur Pavi', 'Bodeli'],
      'Sankheda': ['Sankheda', 'Nasvadi'],
    }),
    dist('Narmada', 'નર્મદા', ['નર્મદા', 'રાજપીપળા', 'narmada', 'rajpipla'], {
      'Nandod': ['Nandod', 'Garudeshwar', 'Tilakwada'],
      'Dediapada': ['Dediapada', 'Sagbara'],
    }),
    dist('Tapi', 'તાપી', ['તાપી', 'વ્યારા', 'tapi', 'vyara'], {
      'Vyara': ['Vyara', 'Dolvan', 'Valod'],
      'Nizar': ['Nizar', 'Uchchhal', 'Songadh', 'Kukarmunda'],
    }),
    dist('Dang', 'ડાંગ', ['ડાંગ', 'આહવા', 'dang', 'ahwa'], {
      'Dangs': ['Ahwa', 'Subir', 'Waghai'],
    }),
  ],

  // =========================================================================
  // GOA (2 Districts · Assembly Constituencies · Talukas)
  // =========================================================================
  GA: [
    dist('North Goa', 'North Goa (उत्तर गोवा)', ['north goa', 'panaji', 'panjim', 'mapusa', 'उत्तर गोवा', 'पणजी'], {
      'Panaji': ['Tiswadi (Panaji)', 'Taleigao', 'St. Cruz'],
      'Mapusa': ['Bardez (Mapusa)', 'Calangute', 'Siolim', 'Saligao'],
      'Pernem': ['Pernem', 'Mandrem'],
      'Bicholim': ['Bicholim', 'Mayem'],
      'Valpoi': ['Sattari (Valpoi)', 'Poriem'],
      'Ponda': ['Ponda', 'Priol', 'Marcaim', 'Shiroda'],
    }),
    dist('South Goa', 'South Goa (दक्षिण गोवा)', ['south goa', 'margao', 'vasco', 'मडगांव', 'दक्षिण गोवा'], {
      'Margao': ['Salcete (Margao)', 'Fatorda', 'Benaulim', 'Navelim'],
      'Vasco-da-Gama': ['Mormugao (Vasco)', 'Dabolim', 'Cortalim'],
      'Quepem': ['Quepem', 'Curchorem'],
      'Sanguem': ['Sanguem', 'Sanvordem'],
      'Canacona': ['Canacona'],
      'Dharbandora': ['Dharbandora'],
    }),
  ],

  // =========================================================================
  // MANIPUR (16 Districts · Assembly Constituencies · Sub-Divisions)
  // =========================================================================
  MN: [
    dist('Imphal West', 'Imphal West (इंफाल पश्चिम)', ['imphal west', 'imphal', 'इंफाल'], {
      'Thangmeiband': ['Lamphelpat', 'Patsoi'],
      'Sekmai': ['Lamsang'],
      'Wangoi': ['Wangoi'],
    }),
    dist('Imphal East', 'Imphal East (इंफाल पूर्व)', ['imphal east', 'porompat'], {
      'Wangkhei': ['Porompat'],
      'Heingang': ['Keirao Bitra'],
      'Lamlai': ['Sawombung'],
    }),
    dist('Thoubal', 'Thoubal (थौबल)', ['thoubal', 'थौबल'], {
      'Thoubal': ['Thoubal'],
      'Lilong': ['Lilong'],
    }),
    dist('Bishnupur', 'Bishnupur (बिष्णुपुर)', ['bishnupur', 'moirang'], {
      'Bishnupur': ['Bishnupur', 'Nambol'],
      'Moirang': ['Moirang'],
    }),
    dist('Churachandpur', 'Churachandpur (चुराचांदपुर)', ['churachandpur', 'lamka'], {
      'Churachandpur': ['Churachandpur', 'Tuibong'],
      'Singhat': ['Singngat', 'Sangaikot'],
      'Henglep': ['Henglep', 'Samulamlan'],
    }),
    dist('Ukhrul', 'Ukhrul (उखरुल)', ['ukhrul'], {
      'Ukhrul': ['Ukhrul', 'Lungchong Maiphai'],
      'Chingai': ['Chingai', 'Jessami'],
    }),
    dist('Senapati', 'Senapati (सेनापति)', ['senapati'], {
      'Mao': ['Mao-Maram', 'Paomata'],
      'Tadubi': ['Purul', 'Willong', 'Song-Song'],
    }),
    dist('Kangpokpi', 'Kangpokpi (कांगपोकपी)', ['kangpokpi'], {
      'Kangpokpi': ['Kangpokpi', 'Champhai'],
      'Saitu': ['Saitu-Gamphazol', 'Kangchup Geljang'],
      'Saikul': ['Saikul', 'Bungte Chiru'],
    }),
    dist('Chandel', 'Chandel (चंदेल)', ['chandel'], {
      'Chandel': ['Chandel', 'Chakpikarong', 'Khengjoy'],
    }),
    dist('Tengnoupal', 'Tengnoupal (तेंगनौपाल)', ['tengnoupal', 'moreh'], {
      'Tengnoupal': ['Tengnoupal', 'Moreh', 'Machi'],
    }),
    dist('Tamenglong', 'Tamenglong (तामेंगलोंग)', ['tamenglong'], {
      'Tamenglong': ['Tamenglong', 'Tamei'],
      'Tousem': ['Tousem'],
    }),
    dist('Noney', 'Noney (नोनी)', ['noney'], {
      'Nungba': ['Nungba', 'Longmai (Noney)', 'Haochong', 'Khoupum'],
    }),
    dist('Jiribam', 'Jiribam (जिरीबाम)', ['jiribam'], {
      'Jiribam': ['Jiribam', 'Borobekra'],
    }),
    dist('Kakching', 'Kakching (काकचिंग)', ['kakching'], {
      'Kakching': ['Kakching'],
      'Sugnu': ['Waikhong'],
    }),
    dist('Kamjong', 'Kamjong (कामजोंग)', ['kamjong'], {
      'Phungyar': ['Kamjong', 'Kasom Khullen', 'Phungyar', 'Sahamphung'],
    }),
    dist('Pherzawl', 'Pherzawl (फेरजॉल)', ['pherzawl'], {
      'Tipaimukh': ['Pherzawl', 'Tipaimukh', 'Thanlon', 'Vangai Range'],
    }),
  ],
};
