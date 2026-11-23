package com.alfanews.telugu.utils

/**
 * Complete Sub-District (Tehsil / Taluka / Sub-Division) catalog for all 174 districts
 * across the 7 expansion states: UP (75), PB (23), UK (13), HP (12), GJ (33), GA (2), MN (16).
 *
 * Keyed by StateCode first so shared district names (e.g., Hamirpur in UP vs Hamirpur in HP)
 * never collide and always return authentic sub-districts for the selected state.
 */
object ExpansionSubDistrictData {

    val STATE_SUB_DISTRICTS: Map<StateCode, Map<String, List<String>>> = mapOf(
        // =========================================================================
        // UTTAR PRADESH (75 Districts -> Tehsils)
        // =========================================================================
        StateCode.UP to mapOf(
            "Agra" to listOf("Agra Sadar", "Dayalbagh", "Etmadpur", "Khandauli", "Fatehabad", "Shamshabad", "Kheragarh", "Jagner", "Kiraoli", "Achnera", "Bah", "Pinahat"),
            "Aligarh" to listOf("Koil", "Khair", "Tappal", "Atrauli", "Gangiri", "Iglas", "Gonda", "Dhanipur", "Gabhana", "Jawan"),
            "Ambedkar Nagar" to listOf("Akbarpur", "Tanda", "Jalalpur", "Alapur", "Bhiti"),
            "Amethi" to listOf("Amethi", "Gauriganj", "Musafirkhana", "Tiloi"),
            "Amroha" to listOf("Amroha Sadar", "Dhanaura", "Hasanpur", "Naugawan Sadat"),
            "Auraiya" to listOf("Auraiya", "Bidhuna", "Ajitmal"),
            "Ayodhya" to listOf("Ayodhya Sadar", "Faizabad", "Bikapur", "Tarun", "Milkipur", "Amaniganj", "Rudauli", "Mawai", "Sohawal", "Maya Bazar"),
            "Azamgarh" to listOf("Azamgarh Sadar", "Sagri", "Phoolpur", "Martinganj", "Nizamabad", "Lalganj", "Mehnagar", "Budhanpur"),
            "Baghpat" to listOf("Baghpat", "Baraut", "Khekra"),
            "Bahraich" to listOf("Bahraich Sadar", "Nanpara", "Mihinpurwa", "Kaiserganj", "Mahasi", "Payagpur"),
            "Ballia" to listOf("Ballia Sadar", "Rasara", "Bansdih", "Sikanderpur", "Belthara Road", "Bairia"),
            "Balrampur" to listOf("Balrampur Sadar", "Tulsipur", "Utraula"),
            "Banda" to listOf("Banda Sadar", "Baberu", "Naraini", "Atarra", "Pailani"),
            "Barabanki" to listOf("Nawabganj", "Fatehpur", "Ramnagar", "Ramsanehighat", "Haidergarh", "Sirauli Gauspur"),
            "Bareilly" to listOf("Bareilly Sadar", "Baheri", "Shergarh", "Meerganj", "Fatehganj West", "Nawabganj", "Bhadpura", "Faridpur", "Bhuta", "Aonla", "Ramnagar"),
            "Basti" to listOf("Basti Sadar", "Harraiya", "Bhanpur", "Rudhauli"),
            "Bhadohi" to listOf("Bhadohi", "Gyanpur", "Aurai"),
            "Bijnor" to listOf("Bijnor Sadar", "Najibabad", "Nagina", "Dhampur", "Chandpur"),
            "Budaun" to listOf("Budaun Sadar", "Bisauli", "Sahaswan", "Bilsi", "Dataganj"),
            "Bulandshahr" to listOf("Bulandshahr Sadar", "Sikandrabad", "Syana", "Anupshahr", "Debai", "Shikarpur", "Khurja"),
            "Chandauli" to listOf("Chakia", "Naugarh", "Pt. Deen Dayal Upadhyaya Nagar", "Sakaldiha", "Chandauli"),
            "Chitrakoot" to listOf("Karwi", "Rajapur", "Manikpur", "Mau"),
            "Deoria" to listOf("Deoria Sadar", "Rudrapur", "Barhaj", "Salempur", "Bhatpar Rani"),
            "Etah" to listOf("Etah Sadar", "Aliganj", "Jalesar"),
            "Etawah" to listOf("Etawah Sadar", "Jaswantnagar", "Saifai", "Bharthana", "Chakarnagar", "Takha"),
            "Farrukhabad" to listOf("Farrukhabad Sadar", "Kaimganj", "Amritpur"),
            "Fatehpur" to listOf("Fatehpur Sadar", "Bindki", "Khaga"),
            "Firozabad" to listOf("Firozabad Sadar", "Tundla", "Jasrana", "Shikohabad", "Sirsaganj"),
            "Gautam Buddha Nagar" to listOf("Dadri", "Noida Sector", "Bisrakh", "Jewar", "Dankaur"),
            "Ghaziabad" to listOf("Ghaziabad Sadar", "Indirapuram", "Loni", "Modinagar", "Muradnagar", "Bhojpur", "Vasundhara"),
            "Ghazipur" to listOf("Ghazipur Sadar", "Saidpur", "Zamania", "Sevrai", "Mohammadabad", "Kasimabad", "Jakhania"),
            "Gonda" to listOf("Gonda Sadar", "Colonelganj", "Tarabganj", "Mankapur"),
            "Gorakhpur" to listOf("Gorakhpur Sadar", "Campierganj", "Jangal Kaudia", "Sahajanwa", "Pali", "Khajani", "Belghat", "Chauri-Chaura", "Sardarnagar", "Bansgaon", "Kauriram", "Gola", "Barhalganj"),
            "Hamirpur" to listOf("Hamirpur", "Maudaha", "Rath", "Sarila"),
            "Hapur" to listOf("Hapur", "Dhaulana", "Garhmukteshwar"),
            "Hardoi" to listOf("Hardoi Sadar", "Shahabad", "Sawayajpur", "Bilgram", "Sandila"),
            "Hathras" to listOf("Hathras", "Sasni", "Sadabad", "Sikandra Rao"),
            "Jalaun" to listOf("Orai", "Kalpi", "Madhogarh", "Jalaun", "Konch"),
            "Jaunpur" to listOf("Jaunpur Sadar", "Shahganj", "Badlapur", "Machhlishahr", "Mariahu", "Kerakat"),
            "Jhansi" to listOf("Jhansi Sadar", "Baragaon", "Mauranipur", "Bangra", "Garautha", "Moth", "Tahrauli"),
            "Kannauj" to listOf("Kannauj Sadar", "Chhibramau", "Tirwa"),
            "Kanpur Dehat" to listOf("Akbarpur", "Rasulabad", "Sikandra", "Derapur", "Bhognipur", "Maitha"),
            "Kanpur Nagar" to listOf("Kanpur Sadar", "Chakeri", "Panki", "Bilhaur", "Shivrajpur", "Ghatampur", "Patara", "Narwal", "Kalyanpur"),
            "Kasganj" to listOf("Kasganj", "Patiyali", "Sahawar"),
            "Kaushambi" to listOf("Manjhanpur", "Sirathu", "Chail"),
            "Kushinagar" to listOf("Kasia", "Padrauna", "Hata", "Tamkuhi Raj", "Khadda", "Captanganj"),
            "Lakhimpur Kheri" to listOf("Lakhimpur Sadar", "Palia", "Nighasan", "Gola", "Mohammdi", "Dhaurahra", "Mitauli"),
            "Lalitpur" to listOf("Lalitpur", "Talbehat", "Pali", "Mehroni", "Madawara"),
            "Lucknow" to listOf("Lucknow Sadar", "Hazratganj", "Bakshi Ka Talab", "Aliganj", "Gomti Nagar", "Chinhat", "Mohanlalganj", "Gosainganj", "Malihabad", "Kakori", "Sarojini Nagar", "Banthra"),
            "Maharajganj" to listOf("Maharajganj Sadar", "Nautanwa", "Pharenda", "Nichlaul"),
            "Mahoba" to listOf("Mahoba", "Charkhari", "Kulpahar"),
            "Mainpuri" to listOf("Mainpuri Sadar", "Bhongaon", "Kishni", "Karhal", "Ghiror", "Kurawali"),
            "Mathura" to listOf("Mathura Sadar", "Vrindavan", "Chhata", "Kosi Kalan", "Mant", "Naujhil", "Goverdhan", "Sonkh", "Mahavan", "Raya"),
            "Mau" to listOf("Mau Sadar", "Ghosi", "Madhuban", "Muhammadabad Gohna"),
            "Meerut" to listOf("Meerut Sadar", "Sardhana", "Daurala", "Mawana", "Hastinapur", "Parikshitgarh", "Jani"),
            "Mirzapur" to listOf("Mirzapur Sadar", "Chunar", "Marihan", "Lalganj"),
            "Moradabad" to listOf("Moradabad Sadar", "Kanth", "Chhajlet", "Thakurdwara", "Dilari", "Bilari", "Kundarki"),
            "Muzaffarnagar" to listOf("Muzaffarnagar Sadar", "Budhana", "Shahpur", "Khatauli", "Jansath", "Baghra"),
            "Pilibhit" to listOf("Pilibhit Sadar", "Puranpur", "Kalimnagar", "Bisalpur", "Amaria"),
            "Pratapgarh" to listOf("Pratapgarh Sadar", "Kunda", "Patti", "Raniganj", "Lalganj"),
            "Prayagraj" to listOf("Sadar Prayagraj", "Civil Lines", "Phulpur", "Bahadurpur", "Soraon", "Holagarh", "Handia", "Saidabad", "Karchhana", "Chaka", "Meja", "Uruwan", "Bara", "Shankargarh", "Koraon"),
            "Raebareli" to listOf("Raebareli Sadar", "Maharajganj", "Lalganj", "Unchahar", "Salon", "Dalmau"),
            "Rampur" to listOf("Rampur Sadar", "Suar", "Tanda", "Bilaspur", "Milak", "Shahabad"),
            "Saharanpur" to listOf("Saharanpur Sadar", "Behat", "Muzaffarabad", "Nakur", "Sarsawa", "Deoband", "Nagal", "Rampur Maniharan", "Nanauta"),
            "Sambhal" to listOf("Sambhal", "Chandausi", "Gunnaur"),
            "Sant Kabir Nagar" to listOf("Khalilabad", "Menhdawal", "Dhanghata"),
            "Shahjahanpur" to listOf("Shahjahanpur Sadar", "Tilhar", "Powayan", "Jalalabad", "Kalan"),
            "Shamli" to listOf("Shamli", "Kairana", "Un"),
            "Shravasti" to listOf("Bhinga", "Ikauna", "Jamunaha"),
            "Siddharthnagar" to listOf("Naugarh", "Shohratgarh", "Bansi", "Itwa", "Domariyaganj"),
            "Sitapur" to listOf("Sitapur Sadar", "Misrikh", "Laharpur", "Biswan", "Mahmoodabad", "Sidhauli", "Maholi"),
            "Sonbhadra" to listOf("Robertsganj", "Ghorawal", "Obra", "Duddhi"),
            "Sultanpur" to listOf("Sultanpur Sadar", "Kadipur", "Lambhua", "Baldirai", "Jaisinghpur"),
            "Unnao" to listOf("Unnao Sadar", "Bangarmau", "Safipur", "Hasanganj", "Purwa", "Bighapur"),
            "Varanasi" to listOf("Varanasi Sadar", "Shivpur", "Dashashwamedh", "Pindra", "Phulpur", "Rajatalab", "Kashi Vidyapeeth", "Sevapuri")
        ),

        // =========================================================================
        // PUNJAB (23 Districts -> Tehsils)
        // =========================================================================
        StateCode.PB to mapOf(
            "Amritsar" to listOf("Amritsar-I", "Amritsar-II", "Ajnala", "Ramdass", "Majitha", "Baba Bakala", "Rayya", "Lopoke", "Attari"),
            "Barnala" to listOf("Barnala", "Mehal Kalan", "Tapa"),
            "Bathinda" to listOf("Bathinda", "Goniana", "Rampura Phul", "Talwandi Sabo", "Maur", "Nathana"),
            "Faridkot" to listOf("Faridkot", "Kotkapura", "Jaitu"),
            "Fatehgarh Sahib" to listOf("Fatehgarh Sahib", "Bassi Pathana", "Amloh", "Mandi Gobindgarh", "Khamanon"),
            "Fazilka" to listOf("Fazilka", "Abohar", "Jalalabad"),
            "Ferozepur" to listOf("Ferozepur", "Zira", "Makhu", "Guru Har Sahai"),
            "Gurdaspur" to listOf("Gurdaspur", "Dinanagar", "Batala", "Fatehgarh Churian", "Dera Baba Nanak", "Kalanaur"),
            "Hoshiarpur" to listOf("Hoshiarpur", "Dasuya", "Tanda", "Mukerian", "Garhshankar", "Mahilpur"),
            "Jalandhar" to listOf("Jalandhar-I", "Jalandhar-II", "Nakodar", "Mehatpur", "Phillaur", "Goraya", "Shahkot", "Lohian Khas", "Adampur", "Bhogpur"),
            "Kapurthala" to listOf("Kapurthala", "Phagwara", "Sultanpur Lodhi", "Bholath"),
            "Ludhiana" to listOf("Ludhiana East", "Ludhiana West", "Jagraon", "Sidhwan Bet", "Khanna", "Samrala", "Machhiwara", "Payal", "Doraha", "Raikot"),
            "Malerkotla" to listOf("Malerkotla", "Amargarh", "Ahmedgarh"),
            "Mansa" to listOf("Mansa", "Budhlada", "Sardulgarh"),
            "Moga" to listOf("Moga", "Bagha Purana", "Nihal Singh Wala", "Dharamkot"),
            "Pathankot" to listOf("Pathankot", "Dhar Kalan", "Sujanpur", "Narot Jaimal Singh", "Bamial"),
            "Patiala" to listOf("Patiala", "Dudhan Sadhan", "Rajpura", "Ghanaur", "Nabha", "Bhadson", "Samana", "Patran"),
            "Rupnagar" to listOf("Rupnagar", "Anandpur Sahib", "Nangal", "Chamkaur Sahib", "Morinda"),
            "Sahibzada Ajit Singh Nagar" to listOf("Mohali", "Banur", "Kharar", "Kurali", "Dera Bassi", "Zirakpur", "Lalru"),
            "Sangrur" to listOf("Sangrur", "Bhawanigarh", "Dhuri", "Sunam", "Dirba", "Lehragaga", "Moonak"),
            "Shahid Bhagat Singh Nagar" to listOf("Nawanshahr", "Banga", "Balachaur"),
            "Sri Muktsar Sahib" to listOf("Sri Muktsar Sahib", "Malout", "Gidderbaha", "Lambi"),
            "Tarn Taran" to listOf("Tarn Taran", "Patti", "Bhikhiwind", "Khadur Sahib")
        ),

        // =========================================================================
        // UTTARAKHAND (13 Districts -> Tehsils)
        // =========================================================================
        StateCode.UK to mapOf(
            "Almora" to listOf("Almora", "Someshwar", "Ranikhet", "Dwarahat", "Bhikiyasain", "Syalde", "Bhanoli", "Jainti"),
            "Bageshwar" to listOf("Bageshwar", "Garur", "Kapkot", "Kanda"),
            "Chamoli" to listOf("Joshimath", "Chamoli", "Karnaprayag", "Gairsain", "Tharali", "Pokhari"),
            "Champawat" to listOf("Champawat", "Purnagiri (Tanakpur)", "Lohaghat", "Pati", "Barakot"),
            "Dehradun" to listOf("Dehradun Sadar", "Mussoorie", "Rajpur", "Rishikesh", "Doiwala", "Vikasnagar", "Kalsi", "Chakrata", "Tyuni"),
            "Haridwar" to listOf("Haridwar Sadar", "Roorkee", "Laksar", "Bhagwanpur", "Manglaur"),
            "Nainital" to listOf("Nainital", "Kosyakutauli", "Haldwani", "Lalkuan", "Ramnagar", "Kaladhungi", "Dhari", "Okhalkanda"),
            "Pauri Garhwal" to listOf("Pauri", "Srinagar", "Kotdwar", "Lansdowne", "Satpuli", "Thalisain", "Dhumakot"),
            "Pithoragarh" to listOf("Pithoragarh", "Didihat", "Berinag", "Dharchula", "Munsyari", "Gangolihat"),
            "Rudraprayag" to listOf("Rudraprayag", "Jakholi", "Ukhimath", "Basukedar"),
            "Tehri Garhwal" to listOf("Tehri", "Narendranagar", "Devprayag", "Kirtinagar", "Ghansali", "Pratapnagar", "Dhanaulti"),
            "Udham Singh Nagar" to listOf("Rudrapur", "Kashipur", "Kichha", "Bazpur", "Jaspur", "Sitarganj", "Khatima", "Nanakmatta"),
            "Uttarkashi" to listOf("Bhatwari", "Dunda", "Chinyalisaur", "Barkot", "Purola", "Mori")
        ),

        // =========================================================================
        // HIMACHAL PRADESH (12 Districts -> Tehsils)
        // =========================================================================
        StateCode.HP to mapOf(
            "Bilaspur" to listOf("Bilaspur Sadar", "Ghumarwin", "Jhanduta", "Sri Naina Devi Ji"),
            "Chamba" to listOf("Chamba", "Dalhousie", "Salooni", "Bhattiyat", "Churah", "Bharmour", "Pangi"),
            "Hamirpur" to listOf("Hamirpur", "Tauni Devi", "Nadaun", "Bhoranj", "Sujanpur Tira", "Barsar"),
            "Kangra" to listOf("Dharamshala", "Kangra", "Nagrota Bagwan", "Palampur", "Baijnath", "Nurpur", "Indora", "Jawali", "Dehra Gopipur", "Jwalamukhi", "Shahpur"),
            "Kinnaur" to listOf("Kalpa", "Nichar", "Pooh", "Sangla", "Morang"),
            "Kullu" to listOf("Kullu", "Bhuntar", "Manali", "Banjar", "Sainj", "Anni", "Nirmand"),
            "Lahaul and Spiti" to listOf("Keylong", "Udaipur", "Kaza (Spiti)"),
            "Mandi" to listOf("Mandi Sadar", "Sundernagar", "Jogindernagar", "Padhar", "Sarkaghat", "Dharampur", "Karsog", "Thunag", "Bali Chowki"),
            "Shimla" to listOf("Shimla Urban", "Shimla Rural", "Theog", "Kotkhai", "Rampur Bushahr", "Kumarsain", "Rohru", "Chirgaon", "Chopal", "Nerwa", "Jubbal"),
            "Sirmaur" to listOf("Nahan", "Paonta Sahib", "Pachhad", "Rajgarh", "Sangrah", "Shillai"),
            "Solan" to listOf("Solan", "Kandaghat", "Kasauli", "Arki", "Nalagarh", "Baddi"),
            "Una" to listOf("Una", "Gagret", "Amb", "Haroli", "Bangana")
        ),

        // =========================================================================
        // GUJARAT (33 Districts -> Talukas)
        // =========================================================================
        StateCode.GJ to mapOf(
            "Ahmedabad" to listOf("Ahmedabad City", "Daskroi", "Sanand", "Bavla", "Viramgam", "Detroj-Rampura", "Mandal", "Dholka", "Dhandhuka", "Dholera"),
            "Amreli" to listOf("Amreli", "Kunkavav Vadia", "Savarkundla", "Lilia", "Rajula", "Jafrabad", "Dhari", "Bagasara", "Khambha", "Lathi", "Babra"),
            "Anand" to listOf("Anand", "Borsad", "Anklav", "Petlad", "Sojitra", "Khambhat", "Tarapur", "Umreth"),
            "Aravalli" to listOf("Modasa", "Dhansura", "Bhiloda", "Meghraj", "Bayad", "Malpur"),
            "Banaskantha" to listOf("Palanpur", "Deesa", "Tharad", "Vav", "Suigam", "Dhanera", "Dantiwada", "Danta", "Amirgadh", "Kankrej", "Bhabhar", "Deodar", "Lakhani", "Vadgam"),
            "Bharuch" to listOf("Bharuch", "Ankleshwar", "Hansot", "Jambusar", "Amod", "Vagra", "Jhagadia", "Valia", "Netrang"),
            "Bhavnagar" to listOf("Bhavnagar", "Ghogha", "Mahuva", "Talaja", "Palitana", "Jesar", "Gariadhar", "Sihor", "Umrala", "Vallabhipur"),
            "Botad" to listOf("Botad", "Ranpur", "Gadhada", "Barwala"),
            "Chhota Udaipur" to listOf("Chhota Udaipur", "Kawant", "Jetpur Pavi", "Bodeli", "Sankheda", "Nasvadi"),
            "Dahod" to listOf("Dahod", "Jhalod", "Sanjeli", "Limkheda", "Singvad", "Devgadh Baria", "Dhanpur", "Garbada", "Fatepura"),
            "Dang" to listOf("Ahwa", "Subir", "Waghai"),
            "Devbhoomi Dwarka" to listOf("Okhamandal (Dwarka)", "Kalyanpur", "Khambhalia", "Bhanvad"),
            "Gandhinagar" to listOf("Gandhinagar", "Kalol", "Mansa", "Dehgam"),
            "Gir Somnath" to listOf("Veraval", "Talala", "Sutrapada", "Kodinar", "Una", "Gir Gadhada"),
            "Jamnagar" to listOf("Jamnagar", "Kalavad", "Jamjodhpur", "Lalpur", "Jodiya", "Dhrol"),
            "Junagadh" to listOf("Junagadh City", "Junagadh Rural", "Keshod", "Vanthali", "Mangrol", "Malia", "Manavadar", "Mendarda", "Visavadar", "Bhesan"),
            "Kheda" to listOf("Nadiad", "Kapadvanj", "Kathlal", "Matar", "Kheda", "Mehmedabad", "Thasra", "Galteshwar", "Mahudha", "Vaso"),
            "Kutch" to listOf("Bhuj", "Gandhidham", "Anjar", "Mandvi", "Mundra", "Abdasa", "Nakhatrana", "Lakhpat", "Rapar", "Bhachau"),
            "Mahisagar" to listOf("Lunawada", "Khanpur", "Santrampur", "Kadana", "Balasinor", "Virpur"),
            "Mehsana" to listOf("Mehsana", "Unjha", "Visnagar", "Vadnagar", "Vijapur", "Kadi", "Becharaji", "Satlasana", "Kheralu"),
            "Morbi" to listOf("Morbi", "Maliya Miyana", "Wankaner", "Tankara", "Halvad"),
            "Narmada" to listOf("Nandod", "Garudeshwar", "Tilakwada", "Dediapada", "Sagbara"),
            "Navsari" to listOf("Navsari", "Jalalpore", "Gandevi", "Chikhli", "Khergam", "Vansda"),
            "Panchmahal" to listOf("Godhra", "Halol", "Jambughoda", "Kalol", "Ghoghamba", "Shehra", "Morva Hadaf"),
            "Patan" to listOf("Patan", "Saraswati", "Sidhpur", "Chanasma", "Harij", "Radhanpur", "Santalpur", "Sami", "Shankheshwar"),
            "Porbandar" to listOf("Porbandar", "Kutiyana", "Ranavav"),
            "Rajkot" to listOf("Rajkot City", "Lodhika", "Gondal", "Kotda Sangani", "Jetpur", "Jamkandorna", "Dhoraji", "Upleta", "Jasdan", "Vinchhiya", "Paddhari"),
            "Sabarkantha" to listOf("Himatnagar", "Idar", "Vadali", "Prantij", "Talod", "Khedbrahma", "Poshina", "Vijaynagar"),
            "Surat" to listOf("Surat City", "Majura", "Choryasi", "Olpad", "Kamrej", "Bardoli", "Palsana", "Mandvi", "Mangrol", "Mahuva", "Umarpada"),
            "Surendranagar" to listOf("Wadhwan", "Muli", "Dhrangadhra", "Limbdi", "Chuda", "Sayla", "Chotila", "Thangadh", "Dasada", "Lakhtar"),
            "Tapi" to listOf("Vyara", "Dolvan", "Valod", "Nizar", "Uchchhal", "Songadh", "Kukarmunda"),
            "Vadodara" to listOf("Vadodara City", "Vadodara Rural", "Savli", "Desar", "Waghodia", "Dabhoi", "Padra", "Karjan", "Sinor"),
            "Valsad" to listOf("Valsad", "Pardi", "Vapi", "Umbergaon", "Dharampur", "Kaprada")
        ),

        // =========================================================================
        // GOA (2 Districts -> Talukas)
        // =========================================================================
        StateCode.GA to mapOf(
            "North Goa" to listOf("Tiswadi (Panaji)", "Taleigao", "St. Cruz", "Bardez (Mapusa)", "Calangute", "Siolim", "Saligao", "Pernem", "Mandrem", "Bicholim", "Mayem", "Sattari (Valpoi)", "Poriem", "Ponda", "Priol", "Marcaim", "Shiroda"),
            "South Goa" to listOf("Salcete (Margao)", "Fatorda", "Benaulim", "Navelim", "Mormugao (Vasco)", "Dabolim", "Cortalim", "Quepem", "Curchorem", "Sanguem", "Sanvordem", "Canacona", "Dharbandora")
        ),

        // =========================================================================
        // MANIPUR (16 Districts -> Sub-Divisions)
        // =========================================================================
        StateCode.MN to mapOf(
            "Bishnupur" to listOf("Bishnupur", "Nambol", "Moirang"),
            "Chandel" to listOf("Chandel", "Chakpikarong", "Khengjoy"),
            "Churachandpur" to listOf("Churachandpur", "Tuibong", "Singngat", "Sangaikot", "Henglep", "Samulamlan"),
            "Imphal East" to listOf("Porompat", "Keirao Bitra", "Sawombung"),
            "Imphal West" to listOf("Lamphelpat", "Patsoi", "Lamsang", "Wangoi"),
            "Jiribam" to listOf("Jiribam", "Borobekra"),
            "Kakching" to listOf("Kakching", "Waikhong"),
            "Kamjong" to listOf("Kamjong", "Kasom Khullen", "Phungyar", "Sahamphung"),
            "Kangpokpi" to listOf("Kangpokpi", "Champhai", "Saitu-Gamphazol", "Kangchup Geljang", "Saikul", "Bungte Chiru"),
            "Noney" to listOf("Nungba", "Longmai (Noney)", "Haochong", "Khoupum"),
            "Pherzawl" to listOf("Pherzawl", "Tipaimukh", "Thanlon", "Vangai Range"),
            "Senapati" to listOf("Mao-Maram", "Paomata", "Purul", "Willong", "Song-Song"),
            "Tamenglong" to listOf("Tamenglong", "Tamei", "Tousem"),
            "Tengnoupal" to listOf("Tengnoupal", "Moreh", "Machi"),
            "Thoubal" to listOf("Thoubal", "Lilong"),
            "Ukhrul" to listOf("Ukhrul", "Lungchong Maiphai", "Chingai", "Jessami")
        )
    )

    fun getSubDistricts(district: String?, stateCode: StateCode? = null): List<String> {
        if (district.isNullOrBlank()) return emptyList()
        val clean = district.trim()

        if (stateCode != null) {
            val stateMap = STATE_SUB_DISTRICTS[stateCode]
            if (stateMap != null) {
                stateMap[clean]?.let { return it }
                stateMap.entries.firstOrNull { it.key.equals(clean, ignoreCase = true) }?.value?.let { return it }
            }
        }

        for ((_, stateMap) in STATE_SUB_DISTRICTS) {
            stateMap[clean]?.let { return it }
            stateMap.entries.firstOrNull { it.key.equals(clean, ignoreCase = true) }?.value?.let { return it }
        }
        return emptyList()
    }
}
